import type { AppState, PlayerAnnualStats, RuleKey, ScoringRule } from './types'
import { DEFAULT_SCORING_RULES } from './defaults'

export function buildAnnualStats(state: AppState, year: number): PlayerAnnualStats[] {
  const sessionsInYear = state.sessions.filter((session) => {
    const sessionYear = Number(session.date.slice(0, 4))
    return sessionYear === year
  })
  const sessionIds = new Set(sessionsInYear.map((session) => session.id))
  const matchesInYear = state.matches.filter((match) => sessionIds.has(match.sessionId))
  const matchIds = new Set(matchesInYear.map((match) => match.id))
  const attendanceInYear = state.attendance.filter((entry) => sessionIds.has(entry.sessionId))
  const activePlayers = state.players.filter((player) => player.active)

  const rows = new Map<string, PlayerAnnualStats>()
  activePlayers.forEach((player) => {
    rows.set(player.id, {
      playerId: player.id,
      name: player.name,
      attendance: 0,
      goals: 0,
      assists: 0,
      saves: 0,
      yellowCards: 0,
      redCards: 0,
      referee: 0,
      assistantReferee: 0,
      score: 0,
    })
  })

  attendanceInYear.forEach((entry) => {
    const row = rows.get(entry.playerId)
    if (row) {
      row.attendance += 1
    }
  })

  state.playerMatchStats
    .filter((stat) => matchIds.has(stat.matchId))
    .forEach((stat) => {
      const row = rows.get(stat.playerId)
      if (!row) {
        return
      }

      row.goals += stat.goals
      row.assists += stat.assists
      row.saves += stat.saves
      row.yellowCards += stat.yellowCards
      row.redCards += stat.redCards
      row.referee += stat.referee
      row.assistantReferee += stat.assistantReferee
    })

  const ruleMap = buildRuleMap(state.scoringRules)
  rows.forEach((row) => {
    row.score =
      row.attendance * ruleMap.attendance +
      row.goals * ruleMap.goal +
      row.assists * ruleMap.assist +
      row.saves * ruleMap.save +
      row.referee * ruleMap.referee +
      row.assistantReferee * ruleMap.assistantReferee +
      row.yellowCards * ruleMap.yellowCard +
      row.redCards * ruleMap.redCard
  })

  return Array.from(rows.values())
    .filter(
      (row) =>
        row.attendance ||
        row.goals ||
        row.assists ||
        row.saves ||
        row.referee ||
        row.assistantReferee ||
        row.yellowCards ||
        row.redCards,
    )
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.attendance - a.attendance ||
        b.goals - a.goals ||
        a.name.localeCompare(b.name, 'zh-CN'),
    )
}

export function buildRuleMap(rules: ScoringRule[]) {
  return [...DEFAULT_SCORING_RULES, ...rules].reduce(
    (accumulator, rule) => ({
      ...accumulator,
      [rule.key]: Number(rule.value) || 0,
    }),
    {} as Record<RuleKey, number>,
  )
}
