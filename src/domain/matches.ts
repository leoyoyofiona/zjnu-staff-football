import type { Match, Team, TeamStanding } from './types'
import { makeId } from '../utils/id'

export function generateRoundRobinMatches(sessionId: string, teams: Team[]) {
  if (teams.length < 2) {
    return []
  }

  const pairs =
    teams.length === 3
      ? [
          [teams[0], teams[1]],
          [teams[1], teams[2]],
          [teams[2], teams[0]],
        ]
      : [[teams[0], teams[1]]]

  return pairs.map(([home, away], index): Match => {
    return {
      id: makeId('match'),
      sessionId,
      homeTeamId: home.id,
      awayTeamId: away.id,
      homeScore: 0,
      awayScore: 0,
      order: index + 1,
    }
  })
}

export function buildTeamStandings(teams: Team[], matches: Match[]) {
  const standings = new Map<string, TeamStanding>()

  teams.forEach((team) => {
    standings.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      color: team.color,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      headToHeadPoints: 0,
    })
  })

  matches.forEach((match) => {
    const home = standings.get(match.homeTeamId)
    const away = standings.get(match.awayTeamId)
    if (!home || !away) {
      return
    }

    applyMatch(home, match.homeScore, match.awayScore)
    applyMatch(away, match.awayScore, match.homeScore)
  })

  const allStandings = Array.from(standings.values()).map((standing) => ({
    ...standing,
    goalDifference: standing.goalsFor - standing.goalsAgainst,
  }))

  allStandings.forEach((standing) => {
    standing.headToHeadPoints = headToHeadPoints(standing.teamId, allStandings, matches)
  })

  return allStandings.sort(
    (a, b) =>
      b.points - a.points ||
      b.goalDifference - a.goalDifference ||
      b.goalsFor - a.goalsFor ||
      b.headToHeadPoints - a.headToHeadPoints ||
      a.teamName.localeCompare(b.teamName, 'zh-CN'),
  )
}

function applyMatch(standing: TeamStanding, ownScore: number, opponentScore: number) {
  standing.played += 1
  standing.goalsFor += ownScore
  standing.goalsAgainst += opponentScore

  if (ownScore > opponentScore) {
    standing.wins += 1
    standing.points += 3
  } else if (ownScore === opponentScore) {
    standing.draws += 1
    standing.points += 1
  } else {
    standing.losses += 1
  }
}

function headToHeadPoints(teamId: string, standings: TeamStanding[], matches: Match[]) {
  const tiedTeamIds = standings
    .filter((candidate) => {
      const current = standings.find((standing) => standing.teamId === teamId)
      return current && candidate.points === current.points
    })
    .map((standing) => standing.teamId)

  if (tiedTeamIds.length <= 1) {
    return 0
  }

  return matches
    .filter(
      (match) => tiedTeamIds.includes(match.homeTeamId) && tiedTeamIds.includes(match.awayTeamId),
    )
    .reduce((points, match) => {
      if (match.homeTeamId === teamId) {
        return points + pointsFor(match.homeScore, match.awayScore)
      }
      if (match.awayTeamId === teamId) {
        return points + pointsFor(match.awayScore, match.homeScore)
      }
      return points
    }, 0)
}

function pointsFor(ownScore: number, opponentScore: number) {
  if (ownScore > opponentScore) {
    return 3
  }
  if (ownScore === opponentScore) {
    return 1
  }
  return 0
}
