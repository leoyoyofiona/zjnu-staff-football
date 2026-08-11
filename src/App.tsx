import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, FormEvent, ReactNode, RefObject, SetStateAction } from 'react'
import { toPng } from 'html-to-image'
import clsx from 'clsx'
import {
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Coffee,
  Download,
  Eye,
  GitFork,
  ListChecks,
  LockKeyhole,
  LogOut,
  Mail,
  Moon,
  PanelsTopLeft,
  Plus,
  QrCode,
  RefreshCw,
  Save,
  Settings,
  Shirt,
  Shuffle,
  ShieldAlert,
  Sun,
  Table2,
  Trophy,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import './App.css'
import { DEFAULT_SCORING_RULES, defaultColors } from './domain/defaults'
import { generateRoundRobinMatches, buildTeamStandings } from './domain/matches'
import { parseRelayText, findMatchingPlayer } from './domain/relayParser'
import { buildAnnualStats } from './domain/stats'
import { assignBalancedTeams } from './domain/teamAssignment'
import type {
  AppState,
  FootballSession,
  Player,
  PlayerMatchStats,
  ScoringRule,
  TeamCount,
} from './domain/types'
import { LEO_WORKS } from './data/leoWorks'
import { useAppState } from './hooks/useAppState'
import { makeId, todayLocalIso } from './utils/id'

type TabKey = 'activity' | 'relay' | 'teams' | 'matches' | 'stats' | 'settings'
type SessionForm = {
  date: string
  location: string
  teamCount: TeamCount
  colors: string[]
  note: string
}
type StatKey =
  | 'goals'
  | 'assists'
  | 'saves'
  | 'yellowCards'
  | 'redCards'
  | 'referee'
  | 'assistantReferee'

type ThemeMode = 'light' | 'dark'

const TABS: Array<{ key: TabKey; label: string; icon: LucideIcon }> = [
  { key: 'activity', label: '活动', icon: CalendarDays },
  { key: 'relay', label: '接龙', icon: ClipboardList },
  { key: 'teams', label: '分队', icon: Shuffle },
  { key: 'matches', label: '赛后', icon: ListChecks },
  { key: 'stats', label: '统计', icon: Trophy },
  { key: 'settings', label: '设置', icon: Settings },
]

const STAT_FIELDS: Array<{ key: StatKey; label: string }> = [
  { key: 'goals', label: '进球' },
  { key: 'assists', label: '助攻' },
  { key: 'saves', label: '扑救' },
  { key: 'yellowCards', label: '黄牌' },
  { key: 'redCards', label: '红牌' },
  { key: 'referee', label: '裁判' },
  { key: 'assistantReferee', label: '边裁' },
]

const DEFAULT_LOCATION = '浙师大足球场'
const THEME_STORAGE_KEY = 'zjnu-staff-football-theme'

function App() {
  const {
    state,
    setState,
    loading,
    saveStatus,
    storageMode,
    user,
    canEdit,
    authError,
    login,
    logout,
    refreshState,
  } = useAppState()
  const [activeTab, setActiveTab] = useState<TabKey>('activity')
  const [activeSessionId, setActiveSessionId] = useState('')
  const [sessionForm, setSessionForm] = useState({
    date: todayLocalIso(),
    location: DEFAULT_LOCATION,
    teamCount: 2 as TeamCount,
    colors: defaultColors(2),
    note: '',
  })
  const [relayText, setRelayText] = useState('')
  const [captainIds, setCaptainIds] = useState<string[]>(['', '', ''])
  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerAliases, setNewPlayerAliases] = useState('')
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: '' })
  const [loginBusy, setLoginBusy] = useState(false)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return stored === 'dark' ? 'dark' : 'light'
  })
  const sessionReportRef = useRef<HTMLDivElement>(null)
  const annualReportRef = useRef<HTMLDivElement>(null)

  const activeSession = useMemo(
    () => state.sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, state.sessions],
  )

  const visibleTabs = useMemo(() => {
    if (canEdit) {
      return TABS
    }

    return TABS.filter((tab) => ['activity', 'teams', 'matches', 'stats'].includes(tab.key))
  }, [canEdit])

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  useEffect(() => {
    if (!activeSessionId && state.sessions.length) {
      setActiveSessionId(state.sessions[0].id)
    }
  }, [activeSessionId, state.sessions])

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab)) {
      setActiveTab('stats')
    }
  }, [activeTab, visibleTabs])

  useEffect(() => {
    if (!activeSession) {
      return
    }

    setSessionForm({
      date: activeSession.date,
      location: activeSession.location,
      teamCount: activeSession.teamCount,
      colors: normalizeColors(activeSession.colors, activeSession.teamCount),
      note: activeSession.note,
    })
    setRelayText(activeSession.rawRelayText)
  }, [activeSession])

  const playersById = useMemo(() => {
    return new Map(state.players.map((player) => [player.id, player]))
  }, [state.players])

  const sessionAttendance = useMemo(() => {
    return state.attendance.filter((entry) => entry.sessionId === activeSessionId)
  }, [activeSessionId, state.attendance])

  const sessionTeams = useMemo(() => {
    return state.teams.filter((team) => team.sessionId === activeSessionId)
  }, [activeSessionId, state.teams])

  const sessionTeamMembers = useMemo(() => {
    const teamIds = new Set(sessionTeams.map((team) => team.id))
    return state.teamMembers.filter((member) => teamIds.has(member.teamId))
  }, [sessionTeams, state.teamMembers])

  const sessionMatches = useMemo(() => {
    return state.matches
      .filter((match) => match.sessionId === activeSessionId)
      .sort((a, b) => a.order - b.order)
  }, [activeSessionId, state.matches])

  const relayParse = useMemo(() => {
    return parseRelayText(relayText, state.players)
  }, [relayText, state.players])

  const standings = useMemo(() => {
    return buildTeamStandings(sessionTeams, sessionMatches)
  }, [sessionMatches, sessionTeams])

  const selectedYear = Number(activeSession?.date.slice(0, 4)) || new Date().getFullYear()
  const annualStats = useMemo(() => {
    return buildAnnualStats(state, selectedYear)
  }, [selectedYear, state])

  const updateState = (updater: (previous: AppState) => AppState) => {
    if (!canEdit) {
      return
    }
    setState((previous) => updater(previous))
  }

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginBusy(true)
    await login(loginForm.username.trim(), loginForm.password).catch(() => undefined)
    setLoginBusy(false)
    setLoginForm((previous) => ({ ...previous, password: '' }))
  }

  const createSession = () => {
    const now = new Date().toISOString()
    const session: FootballSession = {
      id: makeId('session'),
      date: sessionForm.date,
      location: sessionForm.location.trim() || DEFAULT_LOCATION,
      teamCount: sessionForm.teamCount,
      colors: normalizeColors(sessionForm.colors, sessionForm.teamCount),
      note: sessionForm.note.trim(),
      rawRelayText: relayText,
      status: 'draft',
      createdAt: now,
    }

    updateState((previous) => ({
      ...previous,
      sessions: [session, ...previous.sessions],
    }))
    setActiveSessionId(session.id)
    setActiveTab('relay')
  }

  const saveActiveSession = () => {
    if (!activeSession) {
      createSession()
      return
    }

    updateState((previous) => ({
      ...previous,
      sessions: previous.sessions.map((session) =>
        session.id === activeSession.id
          ? {
              ...session,
              date: sessionForm.date,
              location: sessionForm.location.trim() || DEFAULT_LOCATION,
              teamCount: sessionForm.teamCount,
              colors: normalizeColors(sessionForm.colors, sessionForm.teamCount),
              note: sessionForm.note.trim(),
              rawRelayText: relayText,
            }
          : session,
      ),
    }))
  }

  const confirmRelay = () => {
    if (!activeSession) {
      return
    }

    const uniqueEntries = relayParse.entries.filter((entry) => !entry.duplicate)
    const now = new Date().toISOString()

    updateState((previous) => {
      const nextPlayers = [...previous.players]
      const nextAttendance = uniqueEntries.map((entry) => {
        const existing = entry.matchedPlayerId
          ? nextPlayers.find((player) => player.id === entry.matchedPlayerId)
          : findMatchingPlayer(entry.displayName, nextPlayers)

        const player =
          existing ??
          createPlayer({
            name: entry.displayName,
            aliases: [],
            createdAt: now,
          })

        if (!existing) {
          nextPlayers.push(player)
        } else if (
          entry.displayName !== existing.name &&
          !existing.aliases.some((alias) => alias === entry.displayName)
        ) {
          existing.aliases = [...existing.aliases, entry.displayName]
        }

        return {
          id: makeId('attendance'),
          sessionId: activeSession.id,
          playerId: player.id,
          displayName: entry.displayName,
          note: entry.note,
        }
      })

      const relatedMatchIds = new Set(
        previous.matches
          .filter((match) => match.sessionId === activeSession.id)
          .map((match) => match.id),
      )
      const relatedTeamIds = new Set(
        previous.teams.filter((team) => team.sessionId === activeSession.id).map((team) => team.id),
      )

      return {
        ...previous,
        players: nextPlayers,
        sessions: previous.sessions.map((session) =>
          session.id === activeSession.id
            ? {
                ...session,
                rawRelayText: relayText,
                status: 'draft',
              }
            : session,
        ),
        attendance: [
          ...previous.attendance.filter((entry) => entry.sessionId !== activeSession.id),
          ...nextAttendance,
        ],
        teams: previous.teams.filter((team) => team.sessionId !== activeSession.id),
        teamMembers: previous.teamMembers.filter((member) => !relatedTeamIds.has(member.teamId)),
        matches: previous.matches.filter((match) => match.sessionId !== activeSession.id),
        playerMatchStats: previous.playerMatchStats.filter((stat) => !relatedMatchIds.has(stat.matchId)),
      }
    })
    setCaptainIds(['', '', ''])
    setActiveTab('teams')
  }

  const assignTeams = () => {
    if (!activeSession || sessionAttendance.length < activeSession.teamCount) {
      return
    }

    const colors = normalizeColors(sessionForm.colors, activeSession.teamCount)
    const result = assignBalancedTeams({
      sessionId: activeSession.id,
      attendance: sessionAttendance,
      teamCount: activeSession.teamCount,
      colors,
      captainPlayerIds: captainIds,
    })
    const generatedMatches = generateRoundRobinMatches(activeSession.id, result.teams)

    updateState((previous) => {
      const oldMatchIds = new Set(
        previous.matches
          .filter((match) => match.sessionId === activeSession.id)
          .map((match) => match.id),
      )
      const oldTeamIds = new Set(
        previous.teams.filter((team) => team.sessionId === activeSession.id).map((team) => team.id),
      )

      return {
        ...previous,
        sessions: previous.sessions.map((session) =>
          session.id === activeSession.id
            ? {
                ...session,
                colors,
                status: 'grouped',
              }
            : session,
        ),
        teams: [
          ...previous.teams.filter((team) => team.sessionId !== activeSession.id),
          ...result.teams,
        ],
        teamMembers: [
          ...previous.teamMembers.filter((member) => !oldTeamIds.has(member.teamId)),
          ...result.teamMembers,
        ],
        matches: [
          ...previous.matches.filter((match) => match.sessionId !== activeSession.id),
          ...generatedMatches,
        ],
        playerMatchStats: previous.playerMatchStats.filter((stat) => !oldMatchIds.has(stat.matchId)),
      }
    })
    setActiveTab('matches')
  }

  const moveMember = (memberId: string, teamId: string) => {
    updateState((previous) => ({
      ...previous,
      teamMembers: previous.teamMembers.map((member) =>
        member.id === memberId ? { ...member, teamId } : member,
      ),
    }))
  }

  const updateMatchScore = (matchId: string, side: 'homeScore' | 'awayScore', value: number) => {
    updateState((previous) => ({
      ...previous,
      matches: previous.matches.map((match) =>
        match.id === matchId ? { ...match, [side]: Math.max(0, value) } : match,
      ),
    }))
  }

  const updateStat = (matchId: string, playerId: string, key: StatKey, value: number) => {
    updateState((previous) => {
      const existing = previous.playerMatchStats.find(
        (stat) => stat.matchId === matchId && stat.playerId === playerId,
      )
      const normalizedValue = Math.max(0, value)

      if (!existing) {
        return {
          ...previous,
          playerMatchStats: [
            ...previous.playerMatchStats,
            {
              id: makeId('stat'),
              matchId,
              playerId,
              goals: 0,
              assists: 0,
              saves: 0,
              yellowCards: 0,
              redCards: 0,
              referee: 0,
              assistantReferee: 0,
              [key]: normalizedValue,
            },
          ],
        }
      }

      return {
        ...previous,
        playerMatchStats: previous.playerMatchStats.map((stat) =>
          stat.id === existing.id ? { ...stat, [key]: normalizedValue } : stat,
        ),
      }
    })
  }

  const markSessionCompleted = () => {
    if (!activeSession) {
      return
    }

    updateState((previous) => ({
      ...previous,
      sessions: previous.sessions.map((session) =>
        session.id === activeSession.id ? { ...session, status: 'completed' } : session,
      ),
    }))
  }

  const addPlayer = () => {
    const name = newPlayerName.trim()
    if (!name) {
      return
    }

    const aliases = splitAliases(newPlayerAliases)
    updateState((previous) => {
      const existing = findMatchingPlayer(name, previous.players)
      if (existing) {
        return {
          ...previous,
          players: previous.players.map((player) =>
            player.id === existing.id
              ? {
                  ...player,
                  aliases: Array.from(new Set([...player.aliases, ...aliases])),
                  active: true,
                }
              : player,
          ),
        }
      }

      return {
        ...previous,
        players: [
          ...previous.players,
          createPlayer({
            name,
            aliases,
            createdAt: new Date().toISOString(),
          }),
        ].sort((a, b) => a.name.localeCompare(b.name, 'zh-CN')),
      }
    })
    setNewPlayerName('')
    setNewPlayerAliases('')
  }

  const updatePlayer = (playerId: string, patch: Partial<Player>) => {
    updateState((previous) => ({
      ...previous,
      players: previous.players.map((player) =>
        player.id === playerId ? { ...player, ...patch } : player,
      ),
    }))
  }

  const updateRule = (rule: ScoringRule, value: number) => {
    updateState((previous) => ({
      ...previous,
      scoringRules: previous.scoringRules.map((item) =>
        item.key === rule.key ? { ...item, value } : item,
      ),
    }))
  }

  const exportReport = async (node: HTMLDivElement | null, filename: string) => {
    if (!node) {
      return
    }

    const dataUrl = await toPng(node, {
      cacheBust: true,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
    })
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }

  if (loading) {
    return (
      <main className="app-shell loading-shell">
        <div className="loading-panel">正在载入约球数据...</div>
      </main>
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <button type="button" className="leo-brand" onClick={() => setActiveTab('activity')}>
          <span className="leo-mark" aria-hidden="true">
            LEO<span>.</span>
          </span>
          <span className="leo-brand-copy">
            <strong>浙师大教工约球</strong>
            <small>STAFF FOOTBALL / ORGANIZER DESK</small>
          </span>
        </button>
        <nav className="top-menu" aria-label="LEO主导航">
          <TopMenu icon={PanelsTopLeft} label="约球工作台">
            <div className="workbench-menu">
              <div className="dropdown-intro">
                <span className="dropdown-kicker">ZJNU STAFF FOOTBALL</span>
                <strong>把一场球，安排得更漂亮。</strong>
                <p>接龙、随机分队、赛后数据和年度榜单，都在这里完成。</p>
              </div>
              <div className="workbench-links">
                {visibleTabs.map((tab) => {
                  const Icon = tab.icon
                  return (
                    <button
                      type="button"
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                    >
                      <Icon size={16} />
                      <span>{tab.label}</span>
                      <ArrowUpRight size={14} />
                    </button>
                  )
                })}
              </div>
              <div className="menu-stat-line">
                <span><strong>{state.sessions.length}</strong> 场活动</span>
                <span><strong>{state.players.length}</strong> 位老师</span>
                <span><strong>{selectedYear}</strong> 年榜单</span>
              </div>
            </div>
          </TopMenu>

          <TopMenu icon={BriefcaseBusiness} label="LEO作品" wide>
            <div className="works-dropdown">
              <div className="works-heading">
                <div>
                  <span className="dropdown-kicker">LEO / OPEN WORKS</span>
                  <strong>一些认真做过的东西</strong>
                </div>
                <span className="works-count">{LEO_WORKS.length} PROJECTS</span>
              </div>
              <div className="works-grid">
                {LEO_WORKS.map((work, index) => (
                  <WorkCard key={work.title} work={work} index={index} />
                ))}
              </div>
              <div className="works-footer">
                <GitFork size={15} />
                <span>所有作品优先保留真实的 GitHub 入口，持续更新中。</span>
                <a href="https://github.com/leoyoyofiona" target="_blank" rel="noreferrer">
                  查看 GitHub <ArrowUpRight size={14} />
                </a>
              </div>
            </div>
          </TopMenu>

          <TopMenu icon={Coffee} label="请LEO喝球咖啡">
            <div className="coffee-dropdown">
              <div className="coffee-copy">
                <span className="dropdown-kicker">SPONSOR THE NEXT BUILD</span>
                <strong>如果这个小工具帮你省下了一点时间</strong>
                <p>欢迎请 LEO 喝一杯球场边的咖啡。每一杯都用来继续做些有趣、好用的小作品。</p>
              </div>
              <div className="qr-grid">
                <QrPlaceholder label="支付宝" />
                <QrPlaceholder label="微信" />
              </div>
              <p className="qr-note">二维码图片待放入后即可扫码。请上传支付宝和微信收款码原图，我会直接替换这两个位置。</p>
            </div>
          </TopMenu>

          <TopMenu icon={Mail} label="联系LEO">
            <div className="contact-dropdown">
              <span className="dropdown-kicker">SAY HELLO</span>
              <strong>想聊作品、合作或下一场球？</strong>
              <a className="contact-link" href="mailto:leooelcn@gmail.com">
                <Mail size={17} />
                <span>leooelcn@gmail.com</span>
                <ArrowUpRight size={14} />
              </a>
              <a className="contact-link" href="https://github.com/leoyoyofiona" target="_blank" rel="noreferrer">
                <GitFork size={17} />
                <span>github.com/leoyoyofiona</span>
                <ArrowUpRight size={14} />
              </a>
              <p>欢迎反馈使用体验，也欢迎带着真实问题来找我一起做一个小工具。</p>
            </div>
          </TopMenu>

          <TopMenu icon={themeMode === 'dark' ? Moon : Sun} label="显示模式">
            <div className="theme-dropdown">
              <span className="dropdown-kicker">GLOBAL APPEARANCE</span>
              <strong>整个页面一起切换</strong>
              <button type="button" className={clsx('theme-option', themeMode === 'light' && 'selected')} onClick={() => setThemeMode('light')}>
                <Sun size={17} />
                <span><b>白天模式</b><small>清爽、明亮、适合球场白天使用</small></span>
              </button>
              <button type="button" className={clsx('theme-option', themeMode === 'dark' && 'selected')} onClick={() => setThemeMode('dark')}>
                <Moon size={17} />
                <span><b>夜间模式</b><small>低亮、沉浸、适合晚上约球</small></span>
              </button>
            </div>
          </TopMenu>
        </nav>
        <div className="topbar-actions">
          <button type="button" className="icon-button" onClick={refreshState} title="刷新服务器数据">
            <RefreshCw size={16} />
          </button>
          <select
            aria-label="选择活动"
            value={activeSessionId}
            onChange={(event) => setActiveSessionId(event.target.value)}
          >
            <option value="">新活动</option>
            {state.sessions.map((session) => (
              <option key={session.id} value={session.id}>
                {session.date} · {session.location}
              </option>
            ))}
          </select>
          {storageMode === 'server' ? (
            user ? (
              <div className="auth-box">
                <span className="role-pill admin">
                  <LockKeyhole size={14} />
                  管理员
                </span>
                <button type="button" onClick={logout}>
                  <LogOut size={15} />
                  退出
                </button>
              </div>
            ) : (
              <form className="login-form" onSubmit={submitLogin}>
                <input
                  aria-label="管理员账号"
                  value={loginForm.username}
                  onChange={(event) =>
                    setLoginForm((previous) => ({ ...previous, username: event.target.value }))
                  }
                />
                <input
                  aria-label="管理员密码"
                  type="password"
                  value={loginForm.password}
                  placeholder="管理员密码"
                  onChange={(event) =>
                    setLoginForm((previous) => ({ ...previous, password: event.target.value }))
                  }
                />
                <button type="submit" className="primary" disabled={loginBusy}>
                  <LockKeyhole size={15} />
                  登录
                </button>
                {authError && <span className="auth-error">{authError}</span>}
              </form>
            )
          ) : (
            <span className="role-pill admin">
              <LockKeyhole size={14} />
              本机编辑
            </span>
          )}
          {!canEdit && (
            <span className="role-pill readonly">
              <Eye size={14} />
              访客只读
            </span>
          )}
          <span className={clsx('save-pill', saveStatus)}>
            {formatSaveStatus(saveStatus, canEdit)}
          </span>
        </div>
      </header>

      <section className="disclaimer-banner" role="note">
        <ShieldAlert size={19} />
        <div>
          <strong>使用说明与免责声明</strong>
          <p>本页面用于浙师大教工足球活动的报名、分队和内部数据记录，数据以管理员录入为准；统计结果仅供群组内部交流，不构成正式赛事认证、商业建议或任何其他承诺。</p>
        </div>
        <span>LEO · ORGANIZER WORKSPACE</span>
      </section>

      <div className="workspace">
        <nav className="sidebar" aria-label="主要功能">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.key}
                type="button"
                className={clsx('nav-button', activeTab === tab.key && 'active')}
                onClick={() => setActiveTab(tab.key)}
                title={tab.label}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>

        <section className="content">
          {activeTab === 'activity' && (
            <ActivityPanel
              activeSession={activeSession}
              sessionForm={sessionForm}
              setSessionForm={setSessionForm}
              createSession={createSession}
              saveActiveSession={saveActiveSession}
              readOnly={!canEdit}
            />
          )}

          {activeTab === 'relay' && (
            <RelayPanel
              activeSession={activeSession}
              relayText={relayText}
              setRelayText={setRelayText}
              relayParse={relayParse}
              confirmRelay={confirmRelay}
              readOnly={!canEdit}
            />
          )}

          {activeTab === 'teams' && (
            <TeamsPanel
              activeSession={activeSession}
              attendanceCount={sessionAttendance.length}
              playersById={playersById}
              sessionAttendance={sessionAttendance}
              teams={sessionTeams}
              teamMembers={sessionTeamMembers}
              captainIds={captainIds}
              setCaptainIds={setCaptainIds}
              assignTeams={assignTeams}
              moveMember={moveMember}
              readOnly={!canEdit}
            />
          )}

          {activeTab === 'matches' && (
            <MatchesPanel
              activeSession={activeSession}
              playersById={playersById}
              teams={sessionTeams}
              attendance={sessionAttendance}
              matches={sessionMatches}
              stats={state.playerMatchStats}
              updateMatchScore={updateMatchScore}
              updateStat={updateStat}
              markSessionCompleted={markSessionCompleted}
              readOnly={!canEdit}
            />
          )}

          {activeTab === 'stats' && (
            <StatsPanel
              activeSession={activeSession}
              selectedYear={selectedYear}
              playersById={playersById}
              teams={sessionTeams}
              teamMembers={sessionTeamMembers}
              matches={sessionMatches}
              standings={standings}
              annualStats={annualStats}
              sessionReportRef={sessionReportRef}
              annualReportRef={annualReportRef}
              exportReport={exportReport}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPanel
              players={state.players}
              scoringRules={state.scoringRules}
              newPlayerName={newPlayerName}
              newPlayerAliases={newPlayerAliases}
              setNewPlayerName={setNewPlayerName}
              setNewPlayerAliases={setNewPlayerAliases}
              addPlayer={addPlayer}
              updatePlayer={updatePlayer}
              updateRule={updateRule}
              readOnly={!canEdit}
            />
          )}
        </section>
      </div>

      <footer className="site-footer">
        <span>LEO / ZJNU STAFF FOOTBALL</span>
        <a href="mailto:leooelcn@gmail.com"><Mail size={14} /> leooelcn@gmail.com</a>
        <span>访客只读 · 管理员维护</span>
      </footer>
    </main>
  )
}

function TopMenu({
  icon: Icon,
  label,
  children,
  wide = false,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div className={clsx('menu-group', wide && 'menu-group-wide')}>
      <button type="button" className="menu-trigger" aria-haspopup="true">
        <Icon size={16} />
        <span>{label}</span>
        <ChevronDown size={14} />
      </button>
      <div className="dropdown-panel">{children}</div>
    </div>
  )
}

function WorkCard({ work, index }: { work: (typeof LEO_WORKS)[number]; index: number }) {
  const content = (
    <>
      <div className="work-card-topline">
        <span>{String(index + 1).padStart(2, '0')}</span>
        <ArrowUpRight size={15} />
      </div>
      <span className="work-kicker">{work.kicker}</span>
      <strong>{work.title}</strong>
      <p>{work.description}</p>
      <div className="work-tags">
        {work.tags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
    </>
  )

  if (!work.href) {
    return <article className="work-card work-card-disabled" style={{ borderTopColor: work.accent }}>{content}</article>
  }

  return (
    <a className="work-card" style={{ borderTopColor: work.accent }} href={work.href} target="_blank" rel="noreferrer">
      {content}
    </a>
  )
}

function QrPlaceholder({ label }: { label: string }) {
  const [imageReady, setImageReady] = useState(false)
  const source = label === '支付宝' ? '/alipay-qr.png' : '/wechat-qr.png'

  return (
    <div className="qr-placeholder">
      <img
        className={clsx('qr-image', !imageReady && 'qr-image-hidden')}
        src={source}
        alt={`${label}收款码`}
        onLoad={() => setImageReady(true)}
        onError={() => setImageReady(false)}
      />
      {!imageReady && <QrCode size={38} strokeWidth={1.3} />}
      <strong>{label}收款码</strong>
      <span>{imageReady ? '扫码支持' : '待上传原图'}</span>
    </div>
  )
}

interface ActivityPanelProps {
  activeSession?: FootballSession
  sessionForm: SessionForm
  setSessionForm: Dispatch<SetStateAction<SessionForm>>
  createSession: () => void
  saveActiveSession: () => void
  readOnly: boolean
}

function ActivityPanel({
  activeSession,
  sessionForm,
  setSessionForm,
  createSession,
  saveActiveSession,
  readOnly,
}: ActivityPanelProps) {
  return (
    <div className="panel-grid two">
      <section className="panel">
        <div className="panel-title">
          <CalendarDays size={18} />
          <div>
            <h2>{activeSession ? '活动信息' : '新建活动'}</h2>
            <p>确认日期、地点、队伍数量和球衣颜色。</p>
          </div>
        </div>
        <div className="form-grid">
          <label>
            日期
            <input
              type="date"
              value={sessionForm.date}
              disabled={readOnly}
              onChange={(event) =>
                setSessionForm((previous) => ({ ...previous, date: event.target.value }))
              }
            />
          </label>
          <label>
            地点
            <input
              value={sessionForm.location}
              disabled={readOnly}
              onChange={(event) =>
                setSessionForm((previous) => ({ ...previous, location: event.target.value }))
              }
            />
          </label>
          <label>
            队伍
            <div className="segmented">
              {[2, 3].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={sessionForm.teamCount === count ? 'active' : ''}
                  disabled={readOnly}
                  onClick={() =>
                    setSessionForm((previous) => ({
                      ...previous,
                      teamCount: count as TeamCount,
                      colors: normalizeColors(previous.colors, count as TeamCount),
                    }))
                  }
                >
                  {count}队
                </button>
              ))}
            </div>
          </label>
          <label>
            备注
            <input
              value={sessionForm.note}
              placeholder="如：周三晚、三国杀、雨天备选"
              disabled={readOnly}
              onChange={(event) =>
                setSessionForm((previous) => ({ ...previous, note: event.target.value }))
              }
            />
          </label>
        </div>
        <div className="color-row">
          {normalizeColors(sessionForm.colors, sessionForm.teamCount).map((color, index) => (
            <label key={index}>
              <Shirt size={15} />
              {index + 1}队颜色
              <input
                value={color}
                disabled={readOnly}
                onChange={(event) =>
                  setSessionForm((previous) => {
                    const colors = normalizeColors(previous.colors, previous.teamCount)
                    colors[index] = event.target.value
                    return { ...previous, colors }
                  })
                }
              />
            </label>
          ))}
        </div>
        {readOnly ? (
          <p className="readonly-note">访客只能查看活动信息，不能创建或修改。</p>
        ) : (
          <div className="button-row">
            <button type="button" className="primary" onClick={saveActiveSession}>
              <Save size={16} />
              保存活动
            </button>
            <button type="button" onClick={createSession}>
              <Plus size={16} />
              新建活动
            </button>
          </div>
        )}
      </section>

      <section className="panel compact-panel">
        <h2>首版流程</h2>
        <div className="flow-list">
          <span>1. 保存活动</span>
          <span>2. 粘贴接龙</span>
          <span>3. 随机分队</span>
          <span>4. 录入赛后数据</span>
          <span>5. 导出图片发群</span>
        </div>
      </section>
    </div>
  )
}

interface RelayPanelProps {
  activeSession?: FootballSession
  relayText: string
  setRelayText: (value: string) => void
  relayParse: ReturnType<typeof parseRelayText>
  confirmRelay: () => void
  readOnly: boolean
}

function RelayPanel({
  activeSession,
  relayText,
  setRelayText,
  relayParse,
  confirmRelay,
  readOnly,
}: RelayPanelProps) {
  return (
    <div className="panel-grid relay-layout">
      <section className="panel">
        <div className="panel-title">
          <ClipboardList size={18} />
          <div>
            <h2>微信接龙导入</h2>
            <p>支持“1. 张三”“2、李四 守门”这类编号文本。</p>
          </div>
        </div>
        <textarea
          className="relay-input"
          value={relayText}
          placeholder={'1. 张三\n2. 李四 守门\n3. 王五（晚到）'}
          disabled={readOnly}
          onChange={(event) => setRelayText(event.target.value)}
        />
        {readOnly ? (
          <p className="readonly-note">访客不能导入接龙。</p>
        ) : (
          <div className="button-row">
            <button
              type="button"
              className="primary"
              onClick={confirmRelay}
              disabled={!activeSession || relayParse.entries.length === 0}
            >
              <Save size={16} />
              确认导入名单
            </button>
            <span className="hint">
              解析 {relayParse.entries.length} 人，重复 {relayParse.duplicateNames.length} 人
            </span>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>解析预览</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>行</th>
                <th>姓名</th>
                <th>备注</th>
                <th>状态</th>
              </tr>
            </thead>
            <tbody>
              {relayParse.entries.map((entry) => (
                <tr key={entry.id} className={entry.duplicate ? 'muted-row' : ''}>
                  <td>{entry.lineNumber}</td>
                  <td>{entry.displayName}</td>
                  <td>{entry.note || '-'}</td>
                  <td>
                    {entry.duplicate ? '重复' : entry.matchedPlayerId ? '已匹配名册' : '新老师'}
                  </td>
                </tr>
              ))}
              {!relayParse.entries.length && (
                <tr>
                  <td colSpan={4} className="empty-cell">
                    暂无可解析报名
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

interface TeamsPanelProps {
  activeSession?: FootballSession
  attendanceCount: number
  playersById: Map<string, Player>
  sessionAttendance: AppState['attendance']
  teams: AppState['teams']
  teamMembers: AppState['teamMembers']
  captainIds: string[]
  setCaptainIds: Dispatch<SetStateAction<string[]>>
  assignTeams: () => void
  moveMember: (memberId: string, teamId: string) => void
  readOnly: boolean
}

function TeamsPanel({
  activeSession,
  attendanceCount,
  playersById,
  sessionAttendance,
  teams,
  teamMembers,
  captainIds,
  setCaptainIds,
  assignTeams,
  moveMember,
  readOnly,
}: TeamsPanelProps) {
  return (
    <div className="panel-grid">
      <section className="panel">
        <div className="panel-title">
          <Shuffle size={18} />
          <div>
            <h2>随机均衡分队</h2>
            <p>三队赛可先指定队长，其余人员由系统随机平均分配。</p>
          </div>
        </div>
        <div className="metric-row">
          <Metric label="报名人数" value={attendanceCount} />
          <Metric label="队伍数量" value={activeSession?.teamCount ?? '-'} />
          <Metric label="每队约" value={activeSession ? Math.ceil(attendanceCount / activeSession.teamCount) : '-'} />
        </div>
        {activeSession?.teamCount === 3 && (
          <div className="captain-grid">
            {[0, 1, 2].map((index) => (
              <label key={index}>
                {index + 1}队队长
                <select
                  value={captainIds[index] ?? ''}
                  disabled={readOnly}
                  onChange={(event) =>
                    setCaptainIds((previous) => {
                      const next = [...previous]
                      next[index] = event.target.value
                      return next
                    })
                  }
                >
                  <option value="">不指定</option>
                  {sessionAttendance.map((entry) => (
                    <option key={entry.id} value={entry.playerId}>
                      {playersById.get(entry.playerId)?.name ?? entry.displayName}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}
        <button
          type="button"
          className="primary"
          onClick={assignTeams}
          disabled={readOnly || !activeSession || attendanceCount < (activeSession?.teamCount ?? 2)}
        >
          <Shuffle size={16} />
          随机分队并生成赛程
        </button>
      </section>

      <section className="teams-board">
        {teams.map((team) => {
          const members = teamMembers.filter((member) => member.teamId === team.id)
          return (
            <article className="team-column" key={team.id}>
              <header>
                <span className="team-color">{team.color}</span>
                <strong>{team.name}</strong>
                <span>{members.length}人</span>
              </header>
              <div className="member-list">
                {members.map((member) => (
                  <div className="member-row" key={member.id}>
                    <span>
                      {playersById.get(member.playerId)?.name ?? '未知老师'}
                      {member.isCaptain && <em>队长</em>}
                    </span>
                    {readOnly ? (
                      <span className="readonly-tag">查看</span>
                    ) : (
                      <select
                        value={member.teamId}
                        onChange={(event) => moveMember(member.id, event.target.value)}
                      >
                        {teams.map((targetTeam) => (
                          <option key={targetTeam.id} value={targetTeam.id}>
                            {targetTeam.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
                {!members.length && <p className="empty-text">暂无队员</p>}
              </div>
            </article>
          )
        })}
        {!teams.length && (
          <section className="panel empty-panel">
            <Users size={22} />
            <p>导入名单后点击随机分队。</p>
          </section>
        )}
      </section>
    </div>
  )
}

interface MatchesPanelProps {
  activeSession?: FootballSession
  playersById: Map<string, Player>
  teams: AppState['teams']
  attendance: AppState['attendance']
  matches: AppState['matches']
  stats: PlayerMatchStats[]
  updateMatchScore: (matchId: string, side: 'homeScore' | 'awayScore', value: number) => void
  updateStat: (matchId: string, playerId: string, key: StatKey, value: number) => void
  markSessionCompleted: () => void
  readOnly: boolean
}

function MatchesPanel({
  activeSession,
  playersById,
  teams,
  attendance,
  matches,
  stats,
  updateMatchScore,
  updateStat,
  markSessionCompleted,
  readOnly,
}: MatchesPanelProps) {
  return (
    <div className="match-stack">
      <section className="panel panel-title-row">
        <div className="panel-title">
          <ListChecks size={18} />
          <div>
            <h2>赛后录入</h2>
            <p>按场录入比分，再为老师填写进球、助攻、扑救和执裁数据。</p>
          </div>
        </div>
        {!readOnly && (
          <button type="button" className="primary" onClick={markSessionCompleted} disabled={!activeSession}>
            <Save size={16} />
            标记完成
          </button>
        )}
      </section>

      {matches.map((match) => {
        const home = teams.find((team) => team.id === match.homeTeamId)
        const away = teams.find((team) => team.id === match.awayTeamId)
        return (
          <section className="panel" key={match.id}>
            <div className="match-header">
              <strong>
                第{match.order}场 · {home?.name ?? '主队'} vs {away?.name ?? '客队'}
              </strong>
              <div className="score-inputs">
                <input
                  type="number"
                  min={0}
                  value={match.homeScore}
                  disabled={readOnly}
                  onChange={(event) => updateMatchScore(match.id, 'homeScore', toNumber(event.target.value))}
                />
                <span>:</span>
                <input
                  type="number"
                  min={0}
                  value={match.awayScore}
                  disabled={readOnly}
                  onChange={(event) => updateMatchScore(match.id, 'awayScore', toNumber(event.target.value))}
                />
              </div>
            </div>
            <div className="table-wrap stat-table">
              <table>
                <thead>
                  <tr>
                    <th>老师</th>
                    {STAT_FIELDS.map((field) => (
                      <th key={field.key}>{field.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((entry) => {
                    const stat = stats.find(
                      (item) => item.matchId === match.id && item.playerId === entry.playerId,
                    )
                    return (
                      <tr key={`${match.id}-${entry.playerId}`}>
                        <td>{playersById.get(entry.playerId)?.name ?? entry.displayName}</td>
                        {STAT_FIELDS.map((field) => (
                          <td key={field.key}>
                            <input
                              type="number"
                              min={0}
                              value={stat?.[field.key] ?? 0}
                              disabled={readOnly}
                              onChange={(event) =>
                                updateStat(match.id, entry.playerId, field.key, toNumber(event.target.value))
                              }
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      {!matches.length && (
        <section className="panel empty-panel">
          <Table2 size={22} />
          <p>完成分队后会自动生成赛程。</p>
        </section>
      )}
    </div>
  )
}

interface StatsPanelProps {
  activeSession?: FootballSession
  selectedYear: number
  playersById: Map<string, Player>
  teams: AppState['teams']
  teamMembers: AppState['teamMembers']
  matches: AppState['matches']
  standings: ReturnType<typeof buildTeamStandings>
  annualStats: ReturnType<typeof buildAnnualStats>
  sessionReportRef: RefObject<HTMLDivElement | null>
  annualReportRef: RefObject<HTMLDivElement | null>
  exportReport: (node: HTMLDivElement | null, filename: string) => Promise<void>
}

function StatsPanel({
  activeSession,
  selectedYear,
  playersById,
  teams,
  teamMembers,
  matches,
  standings,
  annualStats,
  sessionReportRef,
  annualReportRef,
  exportReport,
}: StatsPanelProps) {
  return (
    <div className="panel-grid two">
      <section className="panel">
        <div className="panel-title-row">
          <div className="panel-title">
            <Trophy size={18} />
            <div>
              <h2>活动战报</h2>
              <p>当前活动的分组、赛程和三队积分榜。</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              exportReport(sessionReportRef.current, `约球战报-${activeSession?.date ?? todayLocalIso()}.png`)
            }
          >
            <Download size={16} />
            导出PNG
          </button>
        </div>
        <div className="report-card" ref={sessionReportRef}>
          <ReportHeader title="浙师大教工约球战报" subtitle={activeSession ? `${activeSession.date} · ${activeSession.location}` : '暂无活动'} />
          <div className="report-teams">
            {teams.map((team) => {
              const members = teamMembers.filter((member) => member.teamId === team.id)
              return (
                <div key={team.id}>
                  <strong>
                    {team.name} · {team.color}
                  </strong>
                  <p>
                    {members
                      .map((member) => {
                        const name = playersById.get(member.playerId)?.name ?? '未知老师'
                        return member.isCaptain ? `${name}(队长)` : name
                      })
                      .join('、') || '暂无队员'}
                  </p>
                </div>
              )
            })}
          </div>
          <ReportStandings standings={standings} />
          <div className="report-matches">
            {matches.map((match) => {
              const home = teams.find((team) => team.id === match.homeTeamId)
              const away = teams.find((team) => team.id === match.awayTeamId)
              return (
                <span key={match.id}>
                  第{match.order}场 {home?.name ?? '主队'} {match.homeScore}:{match.awayScore}{' '}
                  {away?.name ?? '客队'}
                </span>
              )
            })}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title-row">
          <div className="panel-title">
            <Table2 size={18} />
            <div>
              <h2>{selectedYear}年度统计</h2>
              <p>自然年出勤、进球和个人积分。</p>
            </div>
          </div>
          <button type="button" onClick={() => exportReport(annualReportRef.current, `年度统计-${selectedYear}.png`)}>
            <Download size={16} />
            导出PNG
          </button>
        </div>
        <div className="report-card" ref={annualReportRef}>
          <ReportHeader title={`${selectedYear}年度教工足球统计`} subtitle="按自然年自动汇总" />
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>排名</th>
                  <th>姓名</th>
                  <th>出勤</th>
                  <th>进球</th>
                  <th>助攻</th>
                  <th>扑救</th>
                  <th>积分</th>
                </tr>
              </thead>
              <tbody>
                {annualStats.map((row, index) => (
                  <tr key={row.playerId}>
                    <td>{index + 1}</td>
                    <td>{row.name}</td>
                    <td>{row.attendance}</td>
                    <td>{row.goals}</td>
                    <td>{row.assists}</td>
                    <td>{row.saves}</td>
                    <td>
                      <strong>{row.score}</strong>
                    </td>
                  </tr>
                ))}
                {!annualStats.length && (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      暂无年度数据
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

interface SettingsPanelProps {
  players: Player[]
  scoringRules: ScoringRule[]
  newPlayerName: string
  newPlayerAliases: string
  setNewPlayerName: (value: string) => void
  setNewPlayerAliases: (value: string) => void
  addPlayer: () => void
  updatePlayer: (playerId: string, patch: Partial<Player>) => void
  updateRule: (rule: ScoringRule, value: number) => void
  readOnly: boolean
}

function SettingsPanel({
  players,
  scoringRules,
  newPlayerName,
  newPlayerAliases,
  setNewPlayerName,
  setNewPlayerAliases,
  addPlayer,
  updatePlayer,
  updateRule,
  readOnly,
}: SettingsPanelProps) {
  return (
    <div className="panel-grid two">
      <section className="panel">
        <div className="panel-title">
          <Users size={18} />
          <div>
            <h2>老师名册</h2>
            <p>维护标准姓名和微信昵称，接龙导入会自动匹配。</p>
          </div>
        </div>
        <div className="inline-form">
          <input
            value={newPlayerName}
            placeholder="标准姓名"
            disabled={readOnly}
            onChange={(event) => setNewPlayerName(event.target.value)}
          />
          <input
            value={newPlayerAliases}
            placeholder="别名，用顿号或逗号分隔"
            disabled={readOnly}
            onChange={(event) => setNewPlayerAliases(event.target.value)}
          />
          <button type="button" className="primary" onClick={addPlayer} disabled={readOnly}>
            <Plus size={16} />
            加入
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>启用</th>
                <th>姓名</th>
                <th>别名</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={player.active}
                      disabled={readOnly}
                      onChange={(event) => updatePlayer(player.id, { active: event.target.checked })}
                    />
                  </td>
                  <td>
                    <input
                      value={player.name}
                      disabled={readOnly}
                      onChange={(event) => updatePlayer(player.id, { name: event.target.value })}
                    />
                  </td>
                  <td>
                    <input
                      value={player.aliases.join('、')}
                      disabled={readOnly}
                      onChange={(event) => updatePlayer(player.id, { aliases: splitAliases(event.target.value) })}
                    />
                  </td>
                </tr>
              ))}
              {!players.length && (
                <tr>
                  <td colSpan={3} className="empty-cell">
                    接龙导入后会自动生成名册，也可在此提前录入。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <Settings size={18} />
          <div>
            <h2>个人积分规则</h2>
            <p>默认出勤、进球、助攻、扑救和执裁加分，红黄牌扣分。</p>
          </div>
        </div>
        <div className="rule-grid">
          {mergeRules(scoringRules).map((rule) => (
            <label key={rule.key}>
              {rule.label}
              <input
                type="number"
                value={rule.value}
                disabled={readOnly}
                onChange={(event) => updateRule(rule, toNumber(event.target.value, true))}
              />
            </label>
          ))}
        </div>
      </section>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function ReportHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="report-header">
      <h3>{title}</h3>
      <span>{subtitle}</span>
    </header>
  )
}

function ReportStandings({ standings }: { standings: ReturnType<typeof buildTeamStandings> }) {
  if (!standings.length) {
    return <p className="empty-text">暂无积分榜</p>
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>队伍</th>
            <th>赛</th>
            <th>胜</th>
            <th>平</th>
            <th>负</th>
            <th>净胜</th>
            <th>积分</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((standing) => (
            <tr key={standing.teamId}>
              <td>{standing.teamName}</td>
              <td>{standing.played}</td>
              <td>{standing.wins}</td>
              <td>{standing.draws}</td>
              <td>{standing.losses}</td>
              <td>{standing.goalDifference}</td>
              <td>
                <strong>{standing.points}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function createPlayer(params: { name: string; aliases: string[]; createdAt: string }): Player {
  return {
    id: makeId('player'),
    name: params.name,
    aliases: params.aliases,
    active: true,
    createdAt: params.createdAt,
  }
}

function normalizeColors(colors: string[], teamCount: TeamCount) {
  const defaults = defaultColors(teamCount)
  return Array.from({ length: teamCount }, (_, index) => colors[index] || defaults[index] || `${index + 1}队`)
}

function toNumber(value: string, allowNegative = false) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }
  return allowNegative ? parsed : Math.max(0, parsed)
}

function splitAliases(value: string) {
  return value
    .split(/[、,，\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function mergeRules(rules: ScoringRule[]) {
  return DEFAULT_SCORING_RULES.map((defaultRule) => {
    const existing = rules.find((rule) => rule.key === defaultRule.key)
    return existing ?? defaultRule
  })
}

function formatSaveStatus(status: 'idle' | 'saving' | 'saved' | 'error', canEdit: boolean) {
  if (!canEdit) {
    return '只读'
  }
  if (status === 'saving') {
    return '保存中'
  }
  if (status === 'saved') {
    return '已保存'
  }
  if (status === 'error') {
    return '保存异常'
  }
  return '待编辑'
}

export default App
