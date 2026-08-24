import express from 'express'
import path from 'node:path'
import { createStore, DATE_RE } from './store.js'
import { readJson } from './config.js'

const MAX_RANGE_DAYS = 400

/**
 * The API, and optionally the built frontend alongside it.
 *
 * Everything it needs is passed in rather than read from the project folder,
 * so the same server runs under `npm start` during development and inside the
 * packaged desktop app, where the files live somewhere else entirely.
 */
export function createApp({ vaultDailyDir, tagsFile, staticDir = null }) {
  const store = createStore(vaultDailyDir)
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    console.error(err)
    res.status(err.status ?? 500).json({ error: err.message })
  })

  app.get('/api/tags', wrap(async (_req, res) => {
    // Re-read each time so editing tags.json doesn't need a restart.
    res.json(readJson(tagsFile))
  }))

  app.get('/api/day/:date', wrap(async (req, res) => {
    const { date } = req.params
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'bad date' })
    res.json({ date, ...(await store.readDay(date)) })
  }))

  app.put('/api/day/:date', wrap(async (req, res) => {
    const { date } = req.params
    if (!DATE_RE.test(date)) return res.status(400).json({ error: 'bad date' })
    res.json({ date, ...(await store.writeDay(date, req.body?.entries ?? [])) })
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

    res.json(await Promise.all(
      dates.map(async (date) => ({ date, ...(await store.readDay(date)) })),
    ))
  }))

  // Packaged app only: serve the built frontend from the same port.
  if (staticDir) {
    app.use(express.static(staticDir))
    // Anything left over falls back to the page itself. Written as plain
    // middleware rather than a '*' route, which Express 5 rejects.
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) return next()
      res.sendFile(path.join(staticDir, 'index.html'))
    })
  }

  return app
}

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
