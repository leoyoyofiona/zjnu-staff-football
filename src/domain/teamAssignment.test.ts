import { describe, expect, it } from 'vitest'
import { assignBalancedTeams } from './teamAssignment'
import type { Attendance } from './types'

const attendance: Attendance[] = Array.from({ length: 10 }, (_, index) => ({
  id: `attendance_${index}`,
  sessionId: 'session_1',
  playerId: `player_${index}`,
  displayName: `老师${index}`,
  note: '',
}))

describe('assignBalancedTeams', () => {
  it('keeps team sizes balanced for two teams', () => {
    const result = assignBalancedTeams({
      sessionId: 'session_1',
      attendance,
      teamCount: 2,
      colors: ['白色', '蓝色'],
      seed: 42,
    })

    const sizes = result.teams.map(
      (team) => result.teamMembers.filter((member) => member.teamId === team.id).length,
    )
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  })

  it('pins specified captains before assigning the remaining players', () => {
    const result = assignBalancedTeams({
      sessionId: 'session_1',
      attendance,
      teamCount: 3,
      colors: ['白色', '蓝色', '红色'],
      captainPlayerIds: ['player_0', 'player_1', 'player_2'],
      seed: 42,
    })

    result.teams.forEach((team, index) => {
      const captain = result.teamMembers.find(
        (member) => member.teamId === team.id && member.isCaptain,
      )
      expect(captain?.playerId).toBe(`player_${index}`)
    })
  })
})
