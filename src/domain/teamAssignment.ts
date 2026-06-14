import type { Attendance, Team, TeamCount, TeamMember } from './types'
import { makeId } from '../utils/id'

const TEAM_NAMES = ['白队', '蓝队', '红队']

export interface AssignmentResult {
  teams: Team[]
  teamMembers: TeamMember[]
}

export function assignBalancedTeams(params: {
  sessionId: string
  attendance: Attendance[]
  teamCount: TeamCount
  colors: string[]
  captainPlayerIds?: string[]
  seed?: number
}): AssignmentResult {
  const seed = params.seed ?? Date.now()
  const random = seededRandom(seed)
  const teams: Team[] = Array.from({ length: params.teamCount }, (_, index) => ({
    id: makeId('team'),
    sessionId: params.sessionId,
    name: TEAM_NAMES[index] ?? `${index + 1}队`,
    color: params.colors[index] || TEAM_NAMES[index] || `${index + 1}队`,
    seed,
  }))

  const teamMembers: TeamMember[] = []
  const captainIds = params.captainPlayerIds?.filter(Boolean).slice(0, params.teamCount) ?? []
  const assignedCaptains = new Set<string>()

  captainIds.forEach((playerId, index) => {
    const team = teams[index]
    if (!team || assignedCaptains.has(playerId)) {
      return
    }

    teamMembers.push({
      id: makeId('member'),
      teamId: team.id,
      playerId,
      isCaptain: true,
    })
    assignedCaptains.add(playerId)
  })

  const remaining = shuffle(
    params.attendance
      .map((entry) => entry.playerId)
      .filter((playerId) => !assignedCaptains.has(playerId)),
    random,
  )

  remaining.forEach((playerId) => {
    const targetTeam = teams
      .map((team, index) => ({
        team,
        index,
        size: teamMembers.filter((member) => member.teamId === team.id).length,
      }))
      .sort((a, b) => a.size - b.size || a.index - b.index)[0].team

    teamMembers.push({
      id: makeId('member'),
      teamId: targetTeam.id,
      playerId,
      isCaptain: false,
    })
  })

  return { teams, teamMembers }
}

export function seededRandom(seed: number) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(items: T[], random: () => number) {
  const copy = [...items]
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]]
  }
  return copy
}
