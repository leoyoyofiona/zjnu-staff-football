import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const distDir = path.join(rootDir, 'dist')
const dataFile =
  process.env.DATA_FILE || path.join(rootDir, 'data', 'football-state.json')
const port = Number(process.env.PORT || 3000)
const adminUsername = process.env.ADMIN_USERNAME || 'admin'
const adminPassword = process.env.ADMIN_PASSWORD || ''
const isProduction = process.env.NODE_ENV === 'production'
const tokenTtlMs = 1000 * 60 * 60 * 12
const sessions = new Map()

const emptyState = {
  players: [],
  sessions: [],
  attendance: [],
  teams: [],
  teamMembers: [],
  matches: [],
  playerMatchStats: [],
  scoringRules: [
    { key: 'attendance', label: '出勤', value: 1 },
    { key: 'goal', label: '进球', value: 2 },
    { key: 'assist', label: '助攻', value: 1 },
    { key: 'save', label: '扑救', value: 1 },
    { key: 'referee', label: '裁判', value: 1 },
    { key: 'assistantReferee', label: '边裁', value: 1 },
    { key: 'yellowCard', label: '黄牌', value: -1 },
    { key: 'redCard', label: '红牌', value: -2 },
  ],
}

const app = express()

app.use(express.json({ limit: '5mb' }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true })
})

app.get('/api/state', async (request, response, next) => {
  try {
    const state = await readState()
    response.json({
      state,
      user: userFromRequest(request),
      authRequired: true,
      storage: 'server',
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/auth/login', (request, response) => {
  if (isProduction && !adminPassword) {
    response.status(500).json({ error: 'ADMIN_PASSWORD is not configured.' })
    return
  }

  const username = String(request.body?.username || '')
  const password = String(request.body?.password || '')
  const expectedPassword = adminPassword || 'admin123'

  if (username !== adminUsername || password !== expectedPassword) {
    response.status(401).json({ error: '用户名或密码错误' })
    return
  }

  const token = crypto.randomBytes(32).toString('hex')
  sessions.set(token, {
    username,
    expiresAt: Date.now() + tokenTtlMs,
  })
  response.json({
    token,
    user: {
      username,
      role: 'admin',
    },
  })
})

app.get('/api/auth/me', (request, response) => {
  response.json({ user: userFromRequest(request) })
})

app.post('/api/auth/logout', (request, response) => {
  const token = tokenFromRequest(request)
  if (token) {
    sessions.delete(token)
  }
  response.json({ ok: true })
})

app.put('/api/state', requireAdmin, async (request, response, next) => {
  try {
    const state = normalizeState(request.body?.state)
    await writeState(state)
    response.json({ ok: true, state })
  } catch (error) {
    next(error)
  }
})

app.use(express.static(distDir))

app.get(/.*/, (_request, response) => {
  response.sendFile(path.join(distDir, 'index.html'))
})

app.use((error, _request, response, _next) => {
  console.error(error)
  response.status(500).json({ error: '服务器处理失败' })
})

app.listen(port, () => {
  if (!adminPassword) {
    const message = isProduction
      ? 'ADMIN_PASSWORD is required in production.'
      : 'ADMIN_PASSWORD not set; local default password is admin123.'
    console.warn(message)
  }
  console.log(`ZJNU staff football server listening on ${port}`)
  console.log(`State file: ${dataFile}`)
})

async function readState() {
  try {
    const raw = await fs.readFile(dataFile, 'utf8')
    return normalizeState(JSON.parse(raw))
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error
    }

    await writeState(emptyState)
    return emptyState
  }
}

async function writeState(state) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true })
  const temporaryFile = `${dataFile}.tmp`
  await fs.writeFile(temporaryFile, `${JSON.stringify(normalizeState(state), null, 2)}\n`)
  await fs.rename(temporaryFile, dataFile)
}

function normalizeState(input) {
  const state = input && typeof input === 'object' ? input : {}

  return {
    players: arrayOfObjects(state.players),
    sessions: arrayOfObjects(state.sessions),
    attendance: arrayOfObjects(state.attendance),
    teams: arrayOfObjects(state.teams),
    teamMembers: arrayOfObjects(state.teamMembers),
    matches: arrayOfObjects(state.matches),
    playerMatchStats: arrayOfObjects(state.playerMatchStats),
    scoringRules: arrayOfObjects(state.scoringRules).length
      ? arrayOfObjects(state.scoringRules)
      : emptyState.scoringRules,
  }
}

function arrayOfObjects(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item) => item && typeof item === 'object')
}

function requireAdmin(request, response, next) {
  const user = userFromRequest(request)
  if (!user) {
    response.status(401).json({ error: '需要管理员登录' })
    return
  }

  request.user = user
  next()
}

function userFromRequest(request) {
  const token = tokenFromRequest(request)
  if (!token) {
    return null
  }

  const session = sessions.get(token)
  if (!session) {
    return null
  }

  if (session.expiresAt < Date.now()) {
    sessions.delete(token)
    return null
  }

  return {
    username: session.username,
    role: 'admin',
  }
}

function tokenFromRequest(request) {
  const header = request.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? ''
}
