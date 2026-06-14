import { describe, expect, it } from 'vitest'
import { buildTeamStandings, generateRoundRobinMatches } from './matches'
import type { Team } from './types'

const teams: Team[] = [
  { id: 'team_a', sessionId: 'session_1', name: 'A队', color: '白色', seed: 1 },
  { id: 'team_b', sessionId: 'session_1', name: 'B队', color: '蓝色', seed: 1 },
  { id: 'team_c', sessionId: 'session_1', name: 'C队', color: '红色', seed: 1 },
]

describe('matches', () => {
  it('generates three matches for a three-team session', () => {
    const matches = generateRoundRobinMatches('session_1', teams)

    expect(matches).toHaveLength(3)
    expect(matches.map((match) => [match.homeTeamId, match.awayTeamId])).toEqual([
      ['team_a', 'team_b'],
      ['team_b', 'team_c'],
      ['team_c', 'team_a'],
    ])
  })

  it('ranks by points, goal difference, and goals for', () => {
    const matches = [
      {
        id: 'match_1',
        sessionId: 'session_1',
        homeTeamId: 'team_a',
        awayTeamId: 'team_b',
        homeScore: 2,
        awayScore: 0,
        order: 1,
      },
      {
        id: 'match_2',
        sessionId: 'session_1',
        homeTeamId: 'team_b',
        awayTeamId: 'team_c',
        homeScore: 1,
        awayScore: 1,
        order: 2,
      },
      {
        id: 'match_3',
        sessionId: 'session_1',
        homeTeamId: 'team_c',
        awayTeamId: 'team_a',
        homeScore: 0,
        awayScore: 1,
        order: 3,
      },
    ]

    const standings = buildTeamStandings(teams, matches)
    expect(standings[0]).toMatchObject({ teamId: 'team_a', points: 6, goalDifference: 3 })
    expect(standings[1]).toMatchObject({ teamId: 'team_c', points: 1 })
  })
})
