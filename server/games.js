// Finding a game, and keeping its cover in the vault.
//
// Three databases, because no one of them does the whole job. RAWG knows
// about nine hundred thousand games including everything that never came to a
// PC, which makes it the right thing to search — but it has no cover art at
// all. What it has is `background_image`, which is key art or a screenshot:
// the picture across the top of a store page, not the box. Steam has the
// actual cover for every game it sells, at a fixed address worked out from
// the game's id, and wants no key to hand it over. So: RAWG finds the game,
// Steam draws it.
//
// Steam cannot draw all of them. It never sold Minecraft, and a game it does
// sell can still have no library art up yet, which is ordinary for something
// just released. SteamGridDB is people collecting the covers for both cases,
// at the size Steam uses, so it stands behind Steam rather than beside it: it
// is only ever asked once Steam has come back empty. It wants a free key, and
// without one this simply ends where it used to — a name and no picture.
//
// Copying the cover into the vault is the part that matters. The folder still
// reads offline, still reads in five years, and still reads if this app is
// gone. Nothing here ever writes into a note; covers live in their own folder.

import fs from 'node:fs/promises'
import path from 'node:path'

const API = 'https://api.rawg.io/api'

// Steam's own art, addressed by app id. `library_600x900` is the upright
// picture Steam shows in your library — the modern box art, and the only one
// of its sizes that is a cover rather than a banner.
const STEAM_HOST = 'shared.cloudflare.steamstatic.com'
const STEAM_ART = `https://${STEAM_HOST}/store_item_assets/steam/apps`
const COVER_FILE = 'library_600x900.jpg'

// Where a cover comes from when Steam has none, which happens two ways: a
// game Steam never sold — Minecraft is on five shops and not that one — and a
// game with a Steam page whose library art was never published. SteamGridDB
// is people drawing and collecting the covers for both, at the size Steam
// uses, so it slots in behind without anything downstream noticing.
const GRID_API = 'https://www.steamgriddb.com/api/v2'
const GRID_HOST_RE = /^cdn\d*\.steamgriddb\.com$/
const GRID_SIZE = { width: 600, height: 900 }

// What is known about each game, beside the covers it belongs with.
const FACTS_FILE = 'games.json'

// Genres are yours to edit, so they need bounds. Three is what the database
// offers and what a card was drawn for; six is where a row of them stops
// reading as a handful and starts reading as a list.
const MAX_GENRES = 6
const GENRE_CHARS = 40

const STEAM_APP_RE = /store\.steampowered\.com\/app\/(\d+)/

const RESULTS = 8          // a screenful; more is a list to read, not a pick
const DESCRIPTION_CHARS = 260
const SEARCH_TIMEOUT_MS = 6000
const COVER_TIMEOUT_MS = 15_000
const MAX_COVER_BYTES = 6 * 1024 * 1024

const CACHE_LIMIT = 120

/**
 * Something went wrong out on the network rather than in here. Said with a
 * status of its own so a cover that will not download reads as what it is,
 * rather than as this app having fallen over.
 */
const upstream = (message) => Object.assign(new Error(message), { status: 502 })
/** Something arrived that we are not going to act on. */
const refused = (message) => Object.assign(new Error(message), { status: 400 })

/** Smallest thing that behaves like a cache: oldest out once it's full. */
function boundedCache(limit) {
  const map = new Map()
  return {
    get: (key) => map.get(key),
    set(key, value) {
      map.set(key, value)
      if (map.size > limit) map.delete(map.keys().next().value)
    },
  }
}

/** "Grand Theft Auto V" -> "grand-theft-auto-v". Filenames only. */
export function slugify(name) {
  return String(name)
    // Split the accents off their letters and drop them, rather than turning
    // each one into a dash of its own — Ōkami is okami, not o-kami.
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'game'
}

/**
 * Enough of a description to tell two games of the same name apart, which is
 * the whole reason it is shown. Cut on a sentence where there is one nearby,
 * so it ends rather than just stopping.
 */
function shorten(text) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (clean.length <= DESCRIPTION_CHARS) return clean
  const cut = clean.slice(0, DESCRIPTION_CHARS)
  const stop = cut.lastIndexOf('. ')
  return stop > DESCRIPTION_CHARS * 0.6 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`
}

/**
 * A list of genres fit to write down: trimmed, nothing blank, nothing twice,
 * and few enough and short enough to sit on a card.
 *
 * The same name in different capitals is the same genre — "FPS" typed once as
 * "fps" should not become a second one. The first spelling wins, since that
 * is the one already on screen.
 */
export function cleanGenres(list) {
  const seen = new Set()
  const out = []
  for (const raw of Array.isArray(list) ? list : []) {
    const genre = String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, GENRE_CHARS)
    if (!genre || seen.has(genre.toLowerCase())) continue
    seen.add(genre.toLowerCase())
    out.push(genre)
    if (out.length === MAX_GENRES) break
  }
  return out
}

/** Where Steam keeps a game's cover. */
export const steamCover = (appId) => `${STEAM_ART}/${appId}/${COVER_FILE}`

/**
 * Check a cover address before downloading it.
 *
 * What ends up in a note eventually turns into a download, so the address is
 * not something to take on trust: it has to be Steam's art host, and it has
 * to be a cover rather than any other file that host happens to serve.
 */
export function coverSource(raw) {
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw refused('not a cover')
  // Steam's, at the one address that is a cover rather than a banner.
  if (url.hostname === STEAM_HOST) {
    if (path.basename(url.pathname) !== COVER_FILE) throw refused('not a Steam cover')
    return url
  }
  // SteamGridDB's, which are named by a hash rather than by a size, so the
  // check is on the host and on it being a picture at all.
  if (GRID_HOST_RE.test(url.hostname)) {
    if (!/\.(jpe?g|png|webp)$/i.test(url.pathname)) throw refused('not a SteamGridDB cover')
    return url
  }
  throw refused('not a cover we know')
}

/**
 * The best of the covers offered for one game.
 *
 * SteamGridDB is people uploading art, so a game can have fifty and they are
 * not all the box: some are fan-made, some are the wrong shape, some are a
 * joke. Only the ones at exactly the size Steam's own covers are, and then
 * the one the site's own voting likes most — which is as close to "the
 * obvious one" as anything here can get.
 */
export function pickGrid(body) {
  const best = (body?.data ?? [])
    .filter((g) => (
      g?.width === GRID_SIZE.width && g?.height === GRID_SIZE.height && typeof g.url === 'string'
    ))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]
  return best?.url ?? ''
}

export function createGames({ apiKey, gridKey = '', coversDir }) {
  const searches = boundedCache(CACHE_LIMIT)
  const details = boundedCache(CACHE_LIMIT * 4)
  const covers = boundedCache(CACHE_LIMIT * 4)

  /**
   * The key, as it is on disk right now.
   *
   * `apiKey` may be a function, and from the app it is: the settings file is
   * something you edit while the app is open, and having to close it and open
   * it again before it counts is exactly the sort of thing nobody is told and
   * everybody trips over. Same as the tag list, which is re-read per request
   * for the same reason.
   */
  const keyNow = () => String(typeof apiKey === 'function' ? apiKey() : apiKey ?? '').trim()
  const gridNow = () => String(typeof gridKey === 'function' ? gridKey() : gridKey ?? '').trim()

  async function ask(pathname, params, timeout) {
    const url = new URL(API + pathname)
    url.search = new URLSearchParams({ ...params, key: keyNow() }).toString()
    const res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
    if (res.status === 401) throw upstream('RAWG turned the key down — check rawgKey in config.json')
    if (!res.ok) throw upstream(`RAWG answered ${res.status}`)
    return res.json()
  }

  /**
   * A game's description, which the search results don't carry — RAWG only
   * hands those out one game at a time. They are fetched alongside each other
   * rather than one after another, and a game whose description doesn't
   * arrive is still perfectly pickable, so a failure here is a shrug.
   */
  async function describe(id) {
    const had = details.get(id)
    if (had !== undefined) return had
    try {
      const game = await ask(`/games/${id}`, {}, SEARCH_TIMEOUT_MS)
      const text = shorten(game.description_raw)
      details.set(id, text)
      return text
    } catch {
      return ''
    }
  }

  /**
   * The game's cover, by way of its Steam page.
   *
   * RAWG knows which shops sell a game and links to each of them, so the app
   * id is sitting in the Steam link — and the address of the cover follows
   * from the app id alone. Asked for rather than assumed, because a game can
   * be on Steam without that particular picture having been made.
   *
   * No Steam page, or no cover on it, and the answer is nothing at all. A
   * screenshot in a cover's place is what this replaced.
   */
  async function askGrid(pathname, params) {
    const url = new URL(GRID_API + pathname)
    if (params) url.search = new URLSearchParams(params).toString()
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${gridNow()}` },
      signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
    })
    if (res.status === 401 || res.status === 403) {
      throw upstream('SteamGridDB turned the key down — check steamGridKey in config.json')
    }
    if (!res.ok) throw upstream(`SteamGridDB answered ${res.status}`)
    return res.json()
  }

  /**
   * A cover for a game Steam has none for.
   *
   * By Steam id where there is one, because an id names one game exactly and
   * a search by name never can — a game with a Steam page but no library art
   * is still the same game over there. Only then by name, which is the only
   * handle left for something Steam has never sold.
   *
   * Every failure here is a shrug. This is already the second place asked,
   * and a game is allowed to end up with no picture — that is what it did
   * before any of this existed.
   */
  async function gridCover(name, appId) {
    if (!gridNow()) return ''
    const wanted = { dimensions: '600x900', types: 'static', nsfw: 'false', humor: 'false' }
    try {
      if (appId) {
        const found = pickGrid(await askGrid(`/grids/steam/${appId}`, wanted))
        if (found) return found
      }
      const hits = await askGrid(`/search/autocomplete/${encodeURIComponent(name)}`)
      const game = (hits?.data ?? [])[0]
      if (!game?.id) return ''
      return pickGrid(await askGrid(`/grids/game/${game.id}`, wanted))
    } catch (err) {
      // Said out loud rather than only swallowed. A game with no cover
      // anywhere and a game whose key was typed wrong look identical from
      // the outside, and only one of them is worth doing something about.
      console.error(`no SteamGridDB cover for "${name}": ${err.message}`)
      return ''
    }
  }

  async function coverOf(id, name) {
    // The key is part of what was asked, not just how. A cover looked for
    // before there was a SteamGridDB key must not be remembered as "there
    // isn't one" after the key is put in — that would make adding it look
    // like it did nothing until the app was restarted.
    const at = `${id}:${gridNow() ? 'grid' : 'steam'}`
    const had = covers.get(at)
    if (had !== undefined) return had

    let found = ''
    let appId = ''
    try {
      const body = await ask(`/games/${id}/stores`, {}, SEARCH_TIMEOUT_MS)
      const app = (body.results ?? [])
        .map((s) => STEAM_APP_RE.exec(s.url ?? ''))
        .find(Boolean)
      if (app) {
        appId = app[1]
        const url = steamCover(appId)
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) })
        if (res.ok) found = url
      }
    } catch { /* no cover, which a game is allowed not to have */ }

    // Steam had nothing. Either it never sold the game, or it sells it and
    // the library art was never put up — the second is common for something
    // just released, and looks identical from here.
    if (!found) found = await gridCover(name, appId)

    covers.set(at, found)
    return found
  }

  return {
    get configured() { return keyNow() !== '' },

    /**
     * Games matching what has been typed so far, best first.
     *
     * Cached by query: typing a name out and then backspacing over it should
     * not spend a second round trip on every letter of the way back.
     */
    async search(query) {
      const q = String(query ?? '').trim()
      if (q === '') return []

      // Keyed on the second database being available too, for the same
      // reason the cover cache is: a search run before the key was put in
      // must not keep answering with the covers it could not find then.
      const at = `${q.toLowerCase()}:${gridNow() ? 'grid' : 'steam'}`
      const had = searches.get(at)
      if (had) return had

      const body = await ask('/games', { search: q, page_size: String(RESULTS) }, SEARCH_TIMEOUT_MS)
      const found = (body.results ?? []).slice(0, RESULTS)

      // Every result is worked out beside every other one. Eight games one
      // after another would be a wait; eight at once is one.
      const results = await Promise.all(found.map(async (game) => {
        const [description, cover] = await Promise.all([
          describe(game.id),
          coverOf(game.id, game.name),
        ])
        return {
          id: game.id,
          name: game.name,
          released: game.released ? game.released.slice(0, 4) : '',
          cover,
          genres: cleanGenres((game.genres ?? []).slice(0, 3).map((g) => g.name)),
          // What it is sold on, which is not quite what it was played on —
          // see `remember`. PC first, since that is where a cover came from.
          platforms: (game.parent_platforms ?? [])
            .map((p) => p.platform.name)
            .sort((a, b) => (a === 'PC' ? -1 : b === 'PC' ? 1 : 0)),
          description,
        }
      }))

      searches.set(at, results)
      return results
    },

    /**
     * Copy a cover into the vault and answer with the name it was given.
     *
     * Linking to Steam would leave the record depending on a website: no
     * network, no covers, and one day no page. A file in the vault beside the
     * notes is the whole point — it is yours, and it keeps.
     *
     * A cover already there is left alone. The same game logged on fifty days
     * is one picture, and it is named after the game rather than after the
     * day, so the fifty-first costs nothing.
     */
    async keep({ id, name, image }) {
      if (!Number.isInteger(id) || id <= 0) throw refused('bad game id')
      if (!image) return { cover: '' }

      const url = coverSource(image)
      // Named for the game as RAWG knows it, since that is what was searched
      // and picked. Where the picture came from is not the game's identity.
      // SteamGridDB serves png and webp as well as jpg, so the name follows
      // the picture rather than assuming what Steam alone used to send.
      const ext = /\.(png|webp)$/i.exec(url.pathname)?.[1]?.toLowerCase() ?? 'jpg'
      const file = `${slugify(name)}-${id}.${ext}`
      const target = path.join(coversDir, file)
      try {
        await fs.access(target)
        return { cover: file, already: true }
      } catch { /* not there yet, fetch it */ }

      const res = await fetch(url, { signal: AbortSignal.timeout(COVER_TIMEOUT_MS) })
      if (!res.ok) throw upstream(`the cover answered ${res.status}`)
      const bytes = Buffer.from(await res.arrayBuffer())
      if (bytes.length === 0) throw upstream('the cover came back empty')
      if (bytes.length > MAX_COVER_BYTES) throw upstream('the cover is far too big')

      await fs.mkdir(coversDir, { recursive: true })
      // Beside it then swapped over, the same as a note: a half-written
      // picture should never be something the vault has in it.
      const tmp = `${target}.tmp-${process.pid}`
      await fs.writeFile(tmp, bytes)
      await fs.rename(tmp, target)
      return { cover: file, already: false }
    },

    /**
     * What is known about a game, kept once for the game rather than once for
     * every hour spent on it.
     *
     * This does not go in the daily notes. A day is a record of what happened,
     * and "Action, Strategy, PC" is not something that happened — it would be
     * the same forty lines of it in a year of playing one game, in the file
     * you actually read. It sits beside the covers instead, keyed by the name
     * the notes use, so the two halves still find each other offline and a
     * person opening it can see what it is.
     *
     * The platforms are the ones it is sold on rather than the one it was
     * played on, which nothing here can know. PC comes first because that is
     * where the cover came from.
     */
    async remember(game) {
      const all = await this.known()
      const had = all[game.name]
      all[game.name] = {
        platforms: game.platforms ?? [],
        // Genres are the one thing here you can change by hand, so a game
        // already on the list keeps the ones it has. Picking the same game
        // again — to fix a cover, or by way of changing your mind back —
        // must not quietly throw your own filing away.
        genres: had?.genres?.length ? had.genres : cleanGenres(game.genres),
        released: game.released ?? '',
        cover: game.cover ?? '',
      }
      await this.write(all)
    },

    /**
     * File a game under different genres.
     *
     * The database's are a starting point and a coarse one — it has no name
     * for the difference between a shooter and a first-person shooter, and no
     * idea which of the five it lists is the one you would have said. These
     * are yours, and nothing overwrites them afterwards.
     */
    async setGenres(name, genres) {
      const game = String(name ?? '').trim()
      if (!game) throw refused('which game?')
      const all = await this.known()
      all[game] = { ...(all[game] ?? {}), genres: cleanGenres(genres) }
      await this.write(all)
      return all[game]
    },

    async write(all) {
      await fs.mkdir(coversDir, { recursive: true })
      const target = path.join(coversDir, FACTS_FILE)
      const tmp = `${target}.tmp-${process.pid}`
      await fs.writeFile(tmp, `${JSON.stringify(all, null, 1)}\n`, 'utf8')
      await fs.rename(tmp, target)
    },

    /** Everything remembered so far, by game name. Empty if there is none. */
    async known() {
      try {
        const text = await fs.readFile(path.join(coversDir, FACTS_FILE), 'utf8')
        const parsed = JSON.parse(text.replace(/^﻿/, ''))
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        // Missing, or edited into something we can't read. Either way there is
        // nothing to say about a game, which the card is built to survive.
        return {}
      }
    },
  }
}
