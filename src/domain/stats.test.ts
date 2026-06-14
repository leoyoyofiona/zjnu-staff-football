import { describe, expect, it } from 'vitest'
import { EMPTY_STATE } from './defaults'
import { buildAnnualStats } from './stats'
import type { AppState } from './types'

const state: AppState = {
  ...EMPTY_STATE,
  players: [
    {
      id: 'player_1',
      name: '张三',
      aliases: [],
      active: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  sessions: [
    {
      id: 'session_1',
      date: '2026-05-01',
      location: '浙师大足球场',
      teamCount: 2,
      colors: ['白色', '蓝色'],
      note: '',
      rawRelayText: '',
      status: 'completed',
      createdAt: '2026-05-01T00:00:00.000Z',
    },
  ],
  attendance: [
    {
      id: 'attendance_1',
      sessionId: 'session_1',
      playerId: 'player_1',
      displayName: '张三',
      note: '',
    },
  ],
  matches: [
    {
      id: 'match_1',
      sessionId: 'session_1',
      homeTeamId: 'team_a',
      awayTeamId: 'team_b',
      homeScore: 2,
      awayScore: 1,
      order: 1,
    },
  ],
  playerMatchStats: [
    {
      id: 'stat_1',
      matchId: 'match_1',
      playerId: 'player_1',
      goals: 2,
      assists: 1,
      saves: 1,
      yellowCards: 1,
      redCards: 0,
      referee: 0,
      assistantReferee: 1,
    },
  ],
}

describe('buildAnnualStats', () => {
  it('aggregates attendance, events, and default scoring rules by natural year', () => {
    const rows = buildAnnualStats(state, 2026)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      attendance: 1,
      goals: 2,
      assists: 1,
      saves: 1,
      yellowCards: 1,
      assistantReferee: 1,
      score: 7,
    })
  })
})
