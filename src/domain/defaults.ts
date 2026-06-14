import type { AppState, ScoringRule, TeamCount } from './types'

export const TEAM_COLOR_PRESETS = ['白色', '蓝色', '红色']

export const DEFAULT_SCORING_RULES: ScoringRule[] = [
  { key: 'attendance', label: '出勤', value: 1 },
  { key: 'goal', label: '进球', value: 2 },
  { key: 'assist', label: '助攻', value: 1 },
  { key: 'save', label: '扑救', value: 1 },
  { key: 'referee', label: '裁判', value: 1 },
  { key: 'assistantReferee', label: '边裁', value: 1 },
  { key: 'yellowCard', label: '黄牌', value: -1 },
  { key: 'redCard', label: '红牌', value: -2 },
]

export const EMPTY_STATE: AppState = {
  players: [],
  sessions: [],
  attendance: [],
  teams: [],
  teamMembers: [],
  matches: [],
  playerMatchStats: [],
  scoringRules: DEFAULT_SCORING_RULES,
}

export function defaultColors(teamCount: TeamCount) {
  return TEAM_COLOR_PRESETS.slice(0, teamCount)
}
