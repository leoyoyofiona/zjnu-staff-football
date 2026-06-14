import { describe, expect, it } from 'vitest'
import { parseRelayText } from './relayParser'
import type { Player } from './types'

const players: Player[] = [
  {
    id: 'player_1',
    name: '张三',
    aliases: ['老张'],
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

describe('parseRelayText', () => {
  it('parses numbered relay lines with notes', () => {
    const result = parseRelayText('1. 张三\n2、李四 守门\n3. 王五（晚到）', players)

    expect(result.entries).toHaveLength(3)
    expect(result.entries[0].matchedPlayerId).toBe('player_1')
    expect(result.entries[1]).toMatchObject({ displayName: '李四', note: '守门' })
    expect(result.entries[2]).toMatchObject({ displayName: '王五', note: '晚到' })
  })

  it('matches aliases and marks duplicates', () => {
    const result = parseRelayText('1. 老张\n2. 老张\n3. 李四', players)

    expect(result.entries[0].matchedPlayerId).toBe('player_1')
    expect(result.entries[1].duplicate).toBe(true)
    expect(result.duplicateNames).toEqual(['老张'])
  })

  it('ignores blank and non-numbered lines', () => {
    const result = parseRelayText('今晚7点\n\n1. 张三', players)

    expect(result.entries).toHaveLength(1)
    expect(result.ignoredLines).toEqual(['今晚7点'])
  })
})
