import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { createStore, DATE_RE } from './store.js'
import { createGames } from './games.js'
import { readJson } from './config.js'

const MAX_RANGE_DAYS = 400

// Best first: a vector scales to any zoom level without going fuzzy.
const ICON_EXTENSIONS = ['.svg', '.png', '.webp', '.gif', '.jpg', '.jpeg']

/**
 * A tag uses a custom image when a file named after its id sits in the icon
 * folder, and falls back to its emoji otherwise. Nothing to configure — the
 * file being there is the whole switch.
 */
function withIcons(tags, tagIconsDir) {
  let names = []
  try {
    names = fs.readdirSync(tagIconsDir)
  } catch {
    return tags // no folder yet, everyone keeps their emoji
  }

  // Windows doesn't care about capitals anywhere else, so neither does this:
  // Anime.gif and anime.gif both count. Two files that differ only in case
  // can't sit in one folder there, so there is nothing to disambiguate.
  const byName = new Map(names.map((name) => [name.toLowerCase(), name]))

  return tags.map((tag) => {
    const wanted = ICON_EXTENSIONS
      .map((ext) => tag.id.toLowerCase() + ext)
      .find((name) => byName.has(name))
    if (!wanted) return tag
    const file = byName.get(wanted)
    return { ...tag, image: `/tag-icons/${encodeURIComponent(file)}` }
  })
}

/**
 * The API, and optionally the built frontend alongside it.
 *
 * Everything it needs is passed in rather than read from the project folder,
 * so the same server runs under `npm start` during development and inside the
 * packaged desktop app, where the files live somewhere else entirely.
 */
export function createApp({
  vaultDailyDir, tagsFile, tagIconsDir, rawgKey = '', settingsFile = '', staticDir = null,
}) {
  const store = createStore(vaultDailyDir)
  // Covers sit beside the notes they belong to, in a folder of their own.
  // Nothing else in the vault is ours to put things in, and a folder full of
  // pictures next to the days that mention them is the version of this that
  // still makes sense to somebody reading the vault without the app.
  const coversDir = path.join(vaultDailyDir, 'covers')
  const games = createGames({ apiKey: rawgKey, coversDir })
  const app = express()
  app.use(express.json({ limit: '1mb' }))

  const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
    console.error(err)
    res.status(err.status ?? 500).json({ error: err.message })
  })

  app.get('/api/tags', wrap(async (_req, res) => {
    // Re-read each time, so editing tags.json or dropping in an icon file
    // only needs a refresh rather than a restart.
    res.json(withIcons(readJson(tagsFile), tagIconsDir))
  }))

  app.use('/tag-icons', express.static(tagIconsDir))

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

  // --- games ------------------------------------------------------------
  // Under /api, along with everything else the frontend asks for, so the dev
  // server's proxy carries them without being told about each one.

  /**
   * Search results, or an honest answer about why there aren't any. A missing
   * key is not an error — it is a thing that hasn't been set up yet, and the
   * search box says so itself rather than showing a red banner over the app.
   */
  app.get('/api/games', wrap(async (req, res) => {
    if (!games.configured) {
      // Which file, in full. There are two of them — the one in the project
      // folder and the installed app's own copy — and the answer to "put it
      // in config.json" is only useful if it says which config.json.
      return res.json({ configured: false, results: [], settingsFile })
    }
    res.json({ configured: true, results: await games.search(req.query.q) })
  }))

  /** Bring a game's cover into the vault. Answers with the file it became. */
  app.post('/api/games/cover', wrap(async (req, res) => {
    const { id, name, image } = req.body ?? {}
    res.json(await games.keep({ id: Number(id), name, image }))
  }))

  // Covers are read straight off disk. They only ever arrive through the
  // route above, so this folder holds pictures and nothing else.
  app.use('/api/covers', express.static(coversDir, { fallthrough: true }))

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
