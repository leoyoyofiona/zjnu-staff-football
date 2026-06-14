import type Database from '@tauri-apps/plugin-sql'
import { DEFAULT_SCORING_RULES, EMPTY_STATE } from '../domain/defaults'
import type {
  AppState,
  Attendance,
  FootballSession,
  Match,
  Player,
  PlayerMatchStats,
  ScoringRule,
  Team,
  TeamCount,
  TeamMember,
} from '../domain/types'

const STORAGE_KEY = 'zjnu-staff-football-state'
const AUTH_TOKEN_KEY = 'zjnu-staff-football-admin-token'
const DATABASE_URL = 'sqlite:football_app.db'

type SqlDatabase = Database
export type StorageMode = 'tauri' | 'server' | 'local'

export interface AdminUser {
  username: string
  role: 'admin'
}

export interface LoadedAppState {
  state: AppState
  storageMode: StorageMode
  user: AdminUser | null
  authRequired: boolean
}

interface PlayerRow {
  id: string
  name: string
  aliases: string
  active: number
  created_at: string
}

interface SessionRow {
  id: string
  date: string
  location: string
  team_count: number
  colors: string
  note: string
  raw_relay_text: string
  status: FootballSession['status']
  created_at: string
}

interface AttendanceRow {
  id: string
  session_id: string
  player_id: string
  display_name: string
  note: string
}

interface TeamRow {
  id: string
  session_id: string
  name: string
  color: string
  seed: number
}

interface TeamMemberRow {
  id: string
  team_id: string
  player_id: string
  is_captain: number
}

interface MatchRow {
  id: string
  session_id: string
  home_team_id: string
  away_team_id: string
  home_score: number
  away_score: number
  match_order: number
}

interface PlayerMatchStatsRow {
  id: string
  match_id: string
  player_id: string
  goals: number
  assists: number
  keeper_saves: number
  yellow_cards: number
  red_cards: number
  referee: number
  assistant_referee: number
}

interface ScoringRuleRow {
  rule_key: ScoringRule['key']
  label: string
  value: number
}

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS players (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aliases TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    location TEXT NOT NULL,
    team_count INTEGER NOT NULL,
    colors TEXT NOT NULL DEFAULT '[]',
    note TEXT NOT NULL DEFAULT '',
    raw_relay_text TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS attendance (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    display_name TEXT NOT NULL,
    note TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    seed INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS team_members (
    id TEXT PRIMARY KEY,
    team_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    is_captain INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS matches (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    home_team_id TEXT NOT NULL,
    away_team_id TEXT NOT NULL,
    home_score INTEGER NOT NULL DEFAULT 0,
    away_score INTEGER NOT NULL DEFAULT 0,
    match_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS player_match_stats (
    id TEXT PRIMARY KEY,
    match_id TEXT NOT NULL,
    player_id TEXT NOT NULL,
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    keeper_saves INTEGER NOT NULL DEFAULT 0,
    yellow_cards INTEGER NOT NULL DEFAULT 0,
    red_cards INTEGER NOT NULL DEFAULT 0,
    referee INTEGER NOT NULL DEFAULT 0,
    assistant_referee INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS scoring_rules (
    rule_key TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    value INTEGER NOT NULL
  )`,
]

let databasePromise: Promise<SqlDatabase> | null = null

export async function loadAppState(): Promise<LoadedAppState> {
  if (!isTauriRuntime()) {
    const serverState = await loadServerState()
    if (serverState) {
      return serverState
    }

    return {
      state: loadLocalState(),
      storageMode: 'local',
      user: { username: 'local', role: 'admin' },
      authRequired: false,
    }
  }

  try {
    const db = await getDatabase()
    await ensureSchema(db)

    const [
      playerRows,
      sessionRows,
      attendanceRows,
      teamRows,
      teamMemberRows,
      matchRows,
      statRows,
      ruleRows,
    ] = await Promise.all([
      db.select<PlayerRow[]>('SELECT * FROM players ORDER BY name'),
      db.select<SessionRow[]>('SELECT * FROM sessions ORDER BY date DESC, created_at DESC'),
      db.select<AttendanceRow[]>('SELECT * FROM attendance'),
      db.select<TeamRow[]>('SELECT * FROM teams'),
      db.select<TeamMemberRow[]>('SELECT * FROM team_members'),
      db.select<MatchRow[]>('SELECT * FROM matches ORDER BY match_order'),
      db.select<PlayerMatchStatsRow[]>('SELECT * FROM player_match_stats'),
      db.select<ScoringRuleRow[]>('SELECT * FROM scoring_rules'),
    ])

    return {
      state: normalizeState({
        players: playerRows.map(mapPlayerRow),
        sessions: sessionRows.map(mapSessionRow),
        attendance: attendanceRows.map(mapAttendanceRow),
        teams: teamRows.map(mapTeamRow),
        teamMembers: teamMemberRows.map(mapTeamMemberRow),
        matches: matchRows.map(mapMatchRow),
        playerMatchStats: statRows.map(mapStatsRow),
        scoringRules: ruleRows.length ? ruleRows.map(mapRuleRow) : DEFAULT_SCORING_RULES,
      }),
      storageMode: 'tauri',
      user: { username: 'local', role: 'admin' },
      authRequired: false,
    }
  } catch (error) {
    console.warn('SQLite unavailable, falling back to localStorage.', error)
    return {
      state: loadLocalState(),
      storageMode: 'local',
      user: { username: 'local', role: 'admin' },
      authRequired: false,
    }
  }
}

export async function saveAppState(
  state: AppState,
  options: { storageMode?: StorageMode; token?: string } = {},
): Promise<void> {
  const storageMode = options.storageMode ?? (isTauriRuntime() ? 'tauri' : 'local')

  if (storageMode === 'server') {
    await saveServerState(state, options.token)
    return
  }

  if (storageMode === 'local') {
    saveLocalState(state)
    return
  }

  try {
    const db = await getDatabase()
    await ensureSchema(db)
    await replaceSqlState(db, normalizeState(state))
  } catch (error) {
    console.warn('SQLite save failed, falling back to localStorage.', error)
    saveLocalState(state)
  }
}

export async function loginAdmin(username: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })

  if (!response.ok) {
    const message = await errorMessage(response)
    throw new Error(message)
  }

  const data = (await response.json()) as { token: string; user: AdminUser }
  window.localStorage.setItem(AUTH_TOKEN_KEY, data.token)
  return data
}

export async function logoutAdmin() {
  const token = getAuthToken()
  if (token) {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: authHeaders(token),
    }).catch(() => undefined)
  }
  window.localStorage.removeItem(AUTH_TOKEN_KEY)
}

export function getAuthToken() {
  if (typeof window === 'undefined') {
    return ''
  }
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || ''
}

function isTauriRuntime() {
  if (typeof window === 'undefined') {
    return false
  }
  return Boolean((window as Window & { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
}

async function getDatabase() {
  databasePromise ??= import('@tauri-apps/plugin-sql').then((module) =>
    module.default.load(DATABASE_URL),
  )
  return databasePromise
}

async function ensureSchema(db: SqlDatabase) {
  for (const statement of SCHEMA) {
    await db.execute(statement)
  }
}

async function loadServerState(): Promise<LoadedAppState | null> {
  try {
    const token = getAuthToken()
    const response = await fetch('/api/state', {
      headers: token ? authHeaders(token) : undefined,
    })

    if (!response.ok || !isJsonResponse(response)) {
      return null
    }

    const data = (await response.json()) as {
      state?: Partial<AppState>
      user?: AdminUser | null
      authRequired?: boolean
    }

    return {
      state: normalizeState(data.state ?? EMPTY_STATE),
      storageMode: 'server',
      user: data.user ?? null,
      authRequired: data.authRequired ?? true,
    }
  } catch {
    return null
  }
}

async function saveServerState(state: AppState, token = getAuthToken()) {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify({ state: normalizeState(state) }),
  })

  if (!response.ok) {
    const message = await errorMessage(response)
    throw new Error(message)
  }
}

function authHeaders(token: string): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function isJsonResponse(response: Response) {
  return response.headers.get('content-type')?.includes('application/json')
}

async function errorMessage(response: Response) {
  try {
    const data = (await response.json()) as { error?: string }
    return data.error || `请求失败：${response.status}`
  } catch {
    return `请求失败：${response.status}`
  }
}

function loadLocalState() {
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) {
    return normalizeState(EMPTY_STATE)
  }

  try {
    return normalizeState(JSON.parse(raw) as Partial<AppState>)
  } catch {
    return normalizeState(EMPTY_STATE)
  }
}

function saveLocalState(state: AppState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeState(state)))
}

function normalizeState(state: Partial<AppState>): AppState {
  return {
    players: state.players ?? [],
    sessions: state.sessions ?? [],
    attendance: state.attendance ?? [],
    teams: state.teams ?? [],
    teamMembers: state.teamMembers ?? [],
    matches: state.matches ?? [],
    playerMatchStats: state.playerMatchStats ?? [],
    scoringRules: state.scoringRules?.length ? state.scoringRules : DEFAULT_SCORING_RULES,
  }
}

async function replaceSqlState(db: SqlDatabase, state: AppState) {
  const deleteOrder = [
    'player_match_stats',
    'matches',
    'team_members',
    'teams',
    'attendance',
    'sessions',
    'players',
    'scoring_rules',
  ]

  for (const table of deleteOrder) {
    await db.execute(`DELETE FROM ${table}`)
  }

  for (const player of state.players) {
    await db.execute(
      'INSERT INTO players (id, name, aliases, active, created_at) VALUES ($1, $2, $3, $4, $5)',
      [player.id, player.name, JSON.stringify(player.aliases), player.active ? 1 : 0, player.createdAt],
    )
  }

  for (const session of state.sessions) {
    await db.execute(
      'INSERT INTO sessions (id, date, location, team_count, colors, note, raw_relay_text, status, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
      [
        session.id,
        session.date,
        session.location,
        session.teamCount,
        JSON.stringify(session.colors),
        session.note,
        session.rawRelayText,
        session.status,
        session.createdAt,
      ],
    )
  }

  for (const entry of state.attendance) {
    await db.execute(
      'INSERT INTO attendance (id, session_id, player_id, display_name, note) VALUES ($1, $2, $3, $4, $5)',
      [entry.id, entry.sessionId, entry.playerId, entry.displayName, entry.note],
    )
  }

  for (const team of state.teams) {
    await db.execute(
      'INSERT INTO teams (id, session_id, name, color, seed) VALUES ($1, $2, $3, $4, $5)',
      [team.id, team.sessionId, team.name, team.color, team.seed],
    )
  }

  for (const member of state.teamMembers) {
    await db.execute(
      'INSERT INTO team_members (id, team_id, player_id, is_captain) VALUES ($1, $2, $3, $4)',
      [member.id, member.teamId, member.playerId, member.isCaptain ? 1 : 0],
    )
  }

  for (const match of state.matches) {
    await db.execute(
      'INSERT INTO matches (id, session_id, home_team_id, away_team_id, home_score, away_score, match_order) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [
        match.id,
        match.sessionId,
        match.homeTeamId,
        match.awayTeamId,
        match.homeScore,
        match.awayScore,
        match.order,
      ],
    )
  }

  for (const stat of state.playerMatchStats) {
    await db.execute(
      'INSERT INTO player_match_stats (id, match_id, player_id, goals, assists, keeper_saves, yellow_cards, red_cards, referee, assistant_referee) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        stat.id,
        stat.matchId,
        stat.playerId,
        stat.goals,
        stat.assists,
        stat.saves,
        stat.yellowCards,
        stat.redCards,
        stat.referee,
        stat.assistantReferee,
      ],
    )
  }

  for (const rule of state.scoringRules) {
    await db.execute(
      'INSERT INTO scoring_rules (rule_key, label, value) VALUES ($1, $2, $3)',
      [rule.key, rule.label, rule.value],
    )
  }
}

function mapPlayerRow(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    aliases: parseStringArray(row.aliases),
    active: Boolean(row.active),
    createdAt: row.created_at,
  }
}

function mapSessionRow(row: SessionRow): FootballSession {
  return {
    id: row.id,
    date: row.date,
    location: row.location,
    teamCount: (row.team_count === 3 ? 3 : 2) as TeamCount,
    colors: parseStringArray(row.colors),
    note: row.note,
    rawRelayText: row.raw_relay_text,
    status: row.status,
    createdAt: row.created_at,
  }
}

function mapAttendanceRow(row: AttendanceRow): Attendance {
  return {
    id: row.id,
    sessionId: row.session_id,
    playerId: row.player_id,
    displayName: row.display_name,
    note: row.note,
  }
}

function mapTeamRow(row: TeamRow): Team {
  return {
    id: row.id,
    sessionId: row.session_id,
    name: row.name,
    color: row.color,
    seed: row.seed,
  }
}

function mapTeamMemberRow(row: TeamMemberRow): TeamMember {
  return {
    id: row.id,
    teamId: row.team_id,
    playerId: row.player_id,
    isCaptain: Boolean(row.is_captain),
  }
}

function mapMatchRow(row: MatchRow): Match {
  return {
    id: row.id,
    sessionId: row.session_id,
    homeTeamId: row.home_team_id,
    awayTeamId: row.away_team_id,
    homeScore: row.home_score,
    awayScore: row.away_score,
    order: row.match_order,
  }
}

function mapStatsRow(row: PlayerMatchStatsRow): PlayerMatchStats {
  return {
    id: row.id,
    matchId: row.match_id,
    playerId: row.player_id,
    goals: row.goals,
    assists: row.assists,
    saves: row.keeper_saves,
    yellowCards: row.yellow_cards,
    redCards: row.red_cards,
    referee: row.referee,
    assistantReferee: row.assistant_referee,
  }
}

function mapRuleRow(row: ScoringRuleRow): ScoringRule {
  return {
    key: row.rule_key,
    label: row.label,
    value: row.value,
  }
}

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
