import express from 'express'
import fs from 'node:fs'
import path from 'node:path'
import { createStore, DATE_RE } from './store.js'
import { createGames } from './games.js'
import { createAnime } from './anime.js'
import { findIn } from './find.js'
import { readJson } from './config.js'

const MAX_RANGE_DAYS = 400
// How long a total may be reused before the vault is read again. Only an edit
// made outside the app can go stale — our own writes clear it.
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

  /**
   * The settings file as it is right now, or nothing at all if it can't be
   * read. Asked again every time rather than held, since it is a file you
   * edit — by hand, or through the app — while the app is open.
   */
  const settings = () => {
    try { return settingsFile ? readJson(settingsFile) : {} } catch { return {} }
  }

  const games = createGames({
    apiKey: rawgKey,
    // Read off the settings each time, like everything else here: a key put
    // in while the app is open should count without closing it.
    gridKey: () => settings().steamGridKey ?? '',
    coversDir,
  })
  const anime = createAnime({
    coversDir,
    token: () => settings().anilistToken ?? '',
    clientId: () => settings().anilistClientId ?? '',
  })
  const played = createTotals(store, games, 'game')
  const watched = createTotals(store, anime, 'show')
  const forget = () => { played.forget(); watched.forget() }
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
    forget() // a day changed, so every total that mentions it has too
    res.json({ date, ...written })
  }))

  app.get('/api/days', wrap(async (_req, res) => {
    res.json(await store.listDates())
  }))

  /**
   * Every block in the vault that answers to a search.
   *
   * The whole vault, every time, rather than a cached index: there are as
   * many days as there have been days, each one a small file, and an index
   * would only be a second copy of them to keep honest. Nothing is written,
   * so a search can never be the thing that breaks a note.
   */
  app.get('/api/find', wrap(async (req, res) => {
    const query = String(req.query.q ?? '')
    if (query.trim() === '') return res.json({ query, hits: [] })

    const dates = await store.listDates()
    const days = await Promise.all(
      dates.map(async (date) => ({ date, ...(await store.readDay(date)) })),
    )
    res.json({ query, hits: findIn(days, query, readJson(tagsFile)) })
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
      forget()
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

  /**
   * File a game under different genres. Yours, not the database's, and kept
   * against it: nothing written later puts its own back.
   */
  app.post('/api/games/genres', wrap(async (req, res) => {
    const { name, genres } = req.body ?? {}
    const saved = await games.setGenres(name, genres)
    forget()
    res.json(saved)
  }))

  // --- anime --------------------------------------------------------------
  // The same shape as games, one database lighter: AniList wants no key to be
  // read, so there is no "configured" to answer with. A key only comes into
  // it further down, where this writes back to an account.

  app.get('/api/anime', wrap(async (req, res) => {
    res.json({ results: await anime.search(req.query.q) })
  }))

  /**
   * Every season of one show, earliest first. Its own route because it costs
   * a walk along AniList's prequel/sequel links rather than a lookup, and
   * because it is only wanted once a show has been picked.
   */
  app.get('/api/anime/seasons', wrap(async (req, res) => {
    res.json({ seasons: await anime.seasons(req.query.id) })
  }))

  /** Take a show: its cover into the vault, and what it is written beside it. */
  app.post('/api/anime/attach', wrap(async (req, res) => {
    const show = req.body ?? {}
    const kept = await anime.keep({ id: Number(show.id), name: show.name, image: show.cover })
    // The facts are a nicety; the name and the cover are the record.
    try {
      await anime.remember({ ...show, id: Number(show.id), cover: kept.cover })
      forget()
    } catch (err) {
      console.error('could not write down what this show is:', err.message)
    }
    res.json(kept)
  }))

  /**
   * How long has gone into each show across the whole vault, which episodes
   * of it are already written down somewhere, and what is known about it.
   */
  app.get('/api/anime/watched', wrap(async (_req, res) => {
    res.json(await watched.all())
  }))

  /** File a show under different genres. Yours, not the database's. */
  app.post('/api/anime/genres', wrap(async (req, res) => {
    const { name, genres } = req.body ?? {}
    const saved = await anime.setGenres(name, genres)
    forget()
    res.json(saved)
  }))

  /**
   * Where the connection to AniList stands. Asked before anything is sent,
   * so the button on the card can say "connect" rather than failing at it.
   *
   * Checking a token means asking AniList who it belongs to, which is a round
   * trip — so a name coming back is proof, and a name not coming back says
   * why rather than leaving the card to guess.
   */
  app.get('/api/anilist', wrap(async (_req, res) => {
    if (!anime.connected) {
      return res.json({ connected: false, clientId: anime.clientId, settingsFile })
    }
    try {
      const user = await anime.viewer()
      res.json({ connected: true, clientId: anime.clientId, settingsFile, user })
    } catch (err) {
      res.json({
        connected: false, clientId: anime.clientId, settingsFile, problem: err.message,
      })
    }
  }))

  /**
   * Keep the AniList connection in the settings file.
   *
   * Written from in here rather than left as something to go and edit. There
   * are two config.json files, only one of them is read, an invisible mark at
   * the front of it stops the app reading either, and none of that is worth
   * knowing to connect an account. The token is checked before it is kept, so
   * a bad paste is refused at the moment it can still be explained.
   */
  app.post('/api/anilist', wrap(async (req, res) => {
    if (!settingsFile) return res.status(400).json({ error: 'no settings file to write to' })
    const clientId = String(req.body?.clientId ?? '').trim()
    const token = String(req.body?.token ?? '').trim()
    if (clientId && !/^\d{1,12}$/.test(clientId)) {
      return res.status(400).json({ error: 'the client id is the number AniList shows, digits only' })
    }
    if (token && /\s/.test(token)) {
      return res.status(400).json({ error: 'that token has a space in it — copy the whole line, nothing around it' })
    }

    // Tried before it is kept. A token that doesn't work has no business in
    // the settings file — it would sit there looking connected and failing
    // at the one moment it is used.
    let user = null
    if (token) {
      try {
        user = await anime.viewer(token)
      } catch (err) {
        return res.json({ connected: false, clientId, settingsFile, problem: err.message })
      }
    }

    // Everything already in the file survives; only these two lines are ours.
    let current = {}
    try { current = readJson(settingsFile) } catch { /* start from what we have */ }
    const next = { ...current }
    if (clientId) next.anilistClientId = clientId
    if (token) next.anilistToken = token
    fs.writeFileSync(settingsFile, `${JSON.stringify(next, null, 2)}\n`, 'utf8')

    res.json({ connected: Boolean(user), clientId, settingsFile, user })
  }))

  /**
   * Say on AniList that a show has been watched up to an episode.
   *
   * The id AniList knows the show by is looked up here rather than sent from
   * the app — it lives beside the covers, keyed by the name in the note, and
   * the note itself has no business carrying a number that means nothing
   * without a website.
   */
  app.post('/api/anime/sync', wrap(async (req, res) => {
    const name = String(req.body?.name ?? '').trim()
    const episode = Number(req.body?.episode)
    if (!name) return res.status(400).json({ error: 'which show?' })

    const known = await anime.known()
    const mediaId = known[name]?.anilistId
    if (!mediaId) {
      return res.status(400).json({
        error: 'this show has no AniList entry saved — change it and pick it again',
      })
    }

    const asked = Boolean(req.body?.rewatching ?? known[name]?.rewatching)
    const done = await anime.sync({ mediaId, episode, asked })

    // A rewatch that has started is remembered, so the next evening of the
    // show does not have to be told again; one that has just finished is
    // forgotten, because AniList has counted it and there is nothing left to
    // carry. Neither is worth failing the send over.
    try {
      if (done.rewatch && !done.finished) await anime.setRewatching(name, true)
      else if (done.finished || !done.rewatch) await anime.setRewatching(name, false)
      forget()
    } catch (err) {
      console.error('could not remember the rewatch:', err.message)
    }
    res.json(done)
  }))

  /**
   * Where a show stands on AniList, and whether a rewatch is under way.
   *
   * Asked when a card opens so its button can say what pressing it would do,
   * rather than the answer arriving afterwards as a surprise.
   */
  app.get('/api/anime/standing', wrap(async (req, res) => {
    res.json(await anime.standing(req.query.name))
  }))

  /** Say a show is being watched again, or that it isn't any more. */
  app.post('/api/anime/rewatch', wrap(async (req, res) => {
    const { name, rewatching } = req.body ?? {}
    const on = await anime.setRewatching(name, Boolean(rewatching))
    forget()
    res.json({ rewatching: on })
  }))

  // Covers are read straight off disk. They only ever arrive through the
  // routes above, so this folder holds pictures and nothing else.
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
 * Everything of one kind, totalled across the whole vault.
 *
 * `field` is what a day calls it — `game` on a game block, `show` on an anime
 * one — and `source` is whichever of the two keeps the facts to go with it.
 * The counting is the same either way: how long, over how many days, between
 * which two of them.
 *
 * Anime carries one thing more, which is which episodes are already written
 * down somewhere. That is what lets the grid of them say where you had got
 * to without having to ask a website, and it costs nothing here — the days
 * are being read anyway.
 *
 * Reading every day for every question would be silly, and never re-reading
 * them would go stale the moment a day is written — so the answer is kept
 * until something changes it, or until it is old enough that a change made in
 * Obsidian rather than in here will have been noticed.
 */
function createTotals(store, source, field) {
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
          const name = entry[field]
          if (!name) continue
          const had = totals.get(name) ?? { minutes: 0, days: new Set(), episodes: new Set() }
          had.minutes += minutesOf(entry.end) - minutesOf(entry.start)
          had.days.add(date)
          for (const episode of entry.episodes ?? []) had.episodes.add(episode)
          totals.set(name, had)
        }
      }

      // Everything counted, and everything merely known. The second half
      // matters the moment something is attached: the day it was attached on
      // has not been written yet, so counting alone would find nothing and
      // the card would open blank on the thing you just picked. What a show
      // is does not depend on having logged an hour of it.
      const known = await source.known()
      const out = {}
      for (const name of new Set([...totals.keys(), ...Object.keys(known)])) {
        const total = totals.get(name) ?? { minutes: 0, days: new Set(), episodes: new Set() }
        const dates = [...total.days].sort()
        out[name] = {
          minutes: total.minutes,
          days: dates.length,
          first: dates[0],
          last: dates[dates.length - 1],
          // `seen`, not `episodes` — the facts beside the covers already use
          // that word for how many the show has, and the two would land on
          // each other. How many there are and which ones you watched are
          // different questions with the same noun in them.
          ...(total.episodes.size > 0
            ? { seen: [...total.episodes].sort((a, b) => a - b) }
            : {}),
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
