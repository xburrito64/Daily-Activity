import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { createStore, DATE_RE } from './store.js'
import { createGames } from './games.js'
import { readJson } from './config.js'

const MAX_RANGE_DAYS = 400
// How long a playtime total may be reused before the vault is read again. Only
// an edit made outside the app can go stale — our own writes clear it.
const PLAYED_TTL_MS = 20_000

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
  const played = createPlayed(store, games)
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
    const written = await store.writeDay(date, req.body?.entries ?? [])
    played.forget() // a day changed, so every total that mentions it has too
    res.json({ date, ...written })
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

  /**
   * Take a game: bring its cover into the vault and write down what it is.
   * Answers with the file the cover became, which is the only half of it the
   * note itself carries.
   */
  app.post('/api/games/attach', wrap(async (req, res) => {
    const game = req.body ?? {}
    const kept = await games.keep({ id: Number(game.id), name: game.name, image: game.cover })
    // The facts are a nicety; the name and the cover are the record. A game
    // that cannot be written down is still perfectly attachable.
    try {
      await games.remember({ ...game, cover: kept.cover })
      played.forget()
    } catch (err) {
      console.error('could not write down what this game is:', err.message)
    }
    res.json(kept)
  }))

  /**
   * How long has gone into each game, across every day in the vault, with
   * what is known about it alongside.
   *
   * Counted here rather than in the app because the app only ever holds the
   * days you have scrolled past, and "how long have I played this" is a
   * question about all of them.
   */
  app.get('/api/games/played', wrap(async (_req, res) => {
    res.json(await played.all())
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

/**
 * Everything played, totalled across the whole vault.
 *
 * Reading every day for every question would be silly, and never re-reading
 * them would go stale the moment a day is written — so the answer is kept
 * until something changes it, or until it is old enough that a change made in
 * Obsidian rather than in here will have been noticed.
 */
function createPlayed(store, games) {
  let cached = null
  let when = 0

  const minutesOf = (time) => {
    const [h, m] = time.split(':').map(Number)
    return h * 60 + m
  }

  return {
    forget() { cached = null },

    async all() {
      if (cached && Date.now() - when < PLAYED_TTL_MS) return cached

      const totals = new Map()
      for (const date of await store.listDates()) {
        const day = await store.readDay(date)
        if (day.malformed) continue
        for (const entry of day.entries) {
          if (!entry.game) continue
          const had = totals.get(entry.game) ?? { minutes: 0, days: new Set() }
          had.minutes += minutesOf(entry.end) - minutesOf(entry.start)
          had.days.add(date)
          totals.set(entry.game, had)
        }
      }

      const known = await games.known()
      const out = {}
      for (const [name, total] of totals) {
        const dates = [...total.days].sort()
        out[name] = {
          minutes: total.minutes,
          days: dates.length,
          first: dates[0],
          last: dates[dates.length - 1],
          ...(known[name] ?? {}),
        }
      }

      cached = out
      when = Date.now()
      return out
    },
  }
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
