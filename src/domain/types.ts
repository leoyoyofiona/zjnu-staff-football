export type TeamCount = 2 | 3

export type SessionStatus = 'draft' | 'grouped' | 'completed'

export type RuleKey =
  | 'attendance'
  | 'goal'
  | 'assist'
  | 'save'
  | 'referee'
  | 'assistantReferee'
  | 'yellowCard'
  | 'redCard'

export interface Player {
  id: string
  name: string
  aliases: string[]
  active: boolean
  createdAt: string
}

export interface FootballSession {
  id: string
  date: string
  location: string
  teamCount: TeamCount
  colors: string[]
  note: string
  rawRelayText: string
  status: SessionStatus
  createdAt: string
}

export interface Attendance {
  id: string
  sessionId: string
  playerId: string
  displayName: string
  note: string
}

export interface Team {
  id: string
  sessionId: string
  name: string
  color: string
  seed: number
}

export interface TeamMember {
  id: string
  teamId: string
  playerId: string
  isCaptain: boolean
}

export interface Match {
  id: string
  sessionId: string
  homeTeamId: string
  awayTeamId: string
  homeScore: number
  awayScore: number
  order: number
}

export interface PlayerMatchStats {
  id: string
  matchId: string
  playerId: string
  goals: number
  assists: number
  saves: number
  yellowCards: number
  redCards: number
  referee: number
  assistantReferee: number
}

export interface ScoringRule {
  key: RuleKey
  label: string
  value: number
}

export interface AppState {
  players: Player[]
  sessions: FootballSession[]
  attendance: Attendance[]
  teams: Team[]
  teamMembers: TeamMember[]
  matches: Match[]
  playerMatchStats: PlayerMatchStats[]
  scoringRules: ScoringRule[]
}

export interface ParsedRelayEntry {
  id: string
  lineNumber: number
  originalLine: string
  displayName: string
  normalizedName: string
  note: string
  matchedPlayerId?: string
  duplicate: boolean
}

export interface RelayParseResult {
  entries: ParsedRelayEntry[]
  ignoredLines: string[]
  duplicateNames: string[]
}

export interface TeamStanding {
  teamId: string
  teamName: string
  color: string
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  goalDifference: number
  points: number
  headToHeadPoints: number
}

export interface PlayerAnnualStats {
  playerId: string
  name: string
  attendance: number
  goals: number
  assists: number
  saves: number
  yellowCards: number
  redCards: number
  referee: number
  assistantReferee: number
  score: number
}
