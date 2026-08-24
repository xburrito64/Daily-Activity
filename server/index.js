import express from 'express'
import { createStore, DATE_RE } from './store.js'
import { loadJson } from './config.js'

const config = loadJson('config.json')
const store = createStore(config.vaultDailyDir)

const app = express()
app.use(express.json({ limit: '1mb' }))

const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err)
  res.status(err.status ?? 500).json({ error: err.message })
})

app.get('/api/tags', wrap(async (_req, res) => {
  // Re-read each time so editing tags.json doesn't need a restart.
  res.json(loadJson('tags.json'))
}))

app.get('/api/day/:date', wrap(async (req, res) => {
  const { date } = req.params
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'bad date' })
  res.json({ date, ...(await store.readDay(date)) })
}))

app.put('/api/day/:date', wrap(async (req, res) => {
  const { date } = req.params
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'bad date' })
  const result = await store.writeDay(date, req.body?.entries ?? [])
  res.json({ date, ...result })
}))

app.get('/api/days', wrap(async (_req, res) => {
  res.json(await store.listDates())
}))

/** Many days at once, for the stacked review. Missing days come back empty. */
app.get('/api/range', wrap(async (req, res) => {
  const { from, to } = req.query
  if (!DATE_RE.test(from ?? '') || !DATE_RE.test(to ?? '')) {
    return res.status(400).json({ error: 'bad from/to' })
  }
  const dates = datesBetween(from, to)
  if (dates === null) return res.status(400).json({ error: 'range too long' })

  const days = await Promise.all(
    dates.map(async (date) => ({ date, ...(await store.readDay(date)) })),
  )
  res.json(days)
}))

const MAX_RANGE_DAYS = 400

function datesBetween(from, to) {
  const out = []
  const cursor = new Date(`${from}T00:00:00`)
  const last = new Date(`${to}T00:00:00`)
  while (cursor <= last) {
    out.push(
      `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
    )
    if (out.length > MAX_RANGE_DAYS) return null
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`daily-documenter api  http://127.0.0.1:${config.port}`)
  console.log(`vault daily notes     ${config.vaultDailyDir}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`
  The app is already running somewhere else (port ${config.port} is taken).
  Close that window first, then try again.
`)
    process.exit(1)
  }
  throw err
})
