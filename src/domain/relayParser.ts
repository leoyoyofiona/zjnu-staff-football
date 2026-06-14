import type { ParsedRelayEntry, Player, RelayParseResult } from './types'

const NUMBERED_LINE = /^\s*(?:\d+|[一二三四五六七八九十百]+)\s*[.、)、:：\s-]+\s*(.+)$/
const BULLET_LINE = /^\s*[-*•]\s+(.+)$/
export function normalizeName(name: string) {
  return name
    .replace(/[（(].*?[）)]/g, '')
    .replace(/[，,。；;：:、\s]/g, '')
    .trim()
    .toLocaleLowerCase('zh-CN')
}

export function findMatchingPlayer(name: string, players: Player[]) {
  const normalized = normalizeName(name)
  return players.find((player) => {
    if (normalizeName(player.name) === normalized) {
      return true
    }

    return player.aliases.some((alias) => normalizeName(alias) === normalized)
  })
}

export function parseRelayText(text: string, players: Player[] = []): RelayParseResult {
  const seen = new Set<string>()
  const duplicateNames = new Set<string>()
  const ignoredLines: string[] = []

  const entries = text
    .split(/\r?\n/)
    .map((line, index) => ({ line: line.trim(), index }))
    .flatMap(({ line, index }): ParsedRelayEntry[] => {
      if (!line) {
        return []
      }

      const numberedMatch = line.match(NUMBERED_LINE)
      const bulletMatch = line.match(BULLET_LINE)
      const rawContent = numberedMatch?.[1] ?? bulletMatch?.[1]

      if (!rawContent) {
        ignoredLines.push(line)
        return []
      }

      const { displayName, note } = splitNameAndNote(rawContent)
      const normalizedName = normalizeName(displayName)

      if (!normalizedName) {
        ignoredLines.push(line)
        return []
      }

      const duplicate = seen.has(normalizedName)
      if (duplicate) {
        duplicateNames.add(displayName)
      }
      seen.add(normalizedName)

      return [
        {
          id: `${index + 1}-${normalizedName}`,
          lineNumber: index + 1,
          originalLine: line,
          displayName,
          normalizedName,
          note,
          matchedPlayerId: findMatchingPlayer(displayName, players)?.id,
          duplicate,
        },
      ]
    })

  return {
    entries,
    ignoredLines,
    duplicateNames: Array.from(duplicateNames),
  }
}

function splitNameAndNote(rawContent: string) {
  const content = rawContent.trim()
  const parenMatch = content.match(/^(.+?)[（(](.*)[）)]\s*$/)
  if (parenMatch) {
    return {
      displayName: cleanDisplayName(parenMatch[1]),
      note: parenMatch[2].trim(),
    }
  }

  const parts = content.split(/\s+/).filter(Boolean)
  if (parts.length > 1) {
    return {
      displayName: cleanDisplayName(parts[0]),
      note: parts.slice(1).join(' '),
    }
  }

  const dashParts = content.split(/\s*[-—]\s+/).filter(Boolean)
  if (dashParts.length > 1) {
    return {
      displayName: cleanDisplayName(dashParts[0]),
      note: dashParts.slice(1).join(' '),
    }
  }

  return {
    displayName: cleanDisplayName(content),
    note: '',
  }
}

function cleanDisplayName(name: string) {
  return name.replace(/[，,。；;：:、]+$/g, '').trim()
}
