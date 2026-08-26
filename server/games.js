// Looking games up in RAWG, and keeping their covers in the vault.
//
// Two jobs, and the second one is the point. The lookup is a convenience —
// it saves typing a name out and gets the spelling right. Copying the cover
// into the vault is what makes the record yours: the folder still reads
// offline, still reads in five years, and still reads if this app is gone.
// Nothing here ever writes into a note; covers live in their own folder.

import fs from 'node:fs/promises'
import path from 'node:path'

const API = 'https://api.rawg.io/api'

// The only host a cover may be fetched from. Everything RAWG returns is
// served from here, so anything else is either a mistake or someone else's
// idea of what this app should be downloading.
const MEDIA_HOST = 'media.rawg.io'

const RESULTS = 8          // a screenful; more is a list to read, not a pick
const DESCRIPTION_CHARS = 260
const SEARCH_TIMEOUT_MS = 6000
const COVER_TIMEOUT_MS = 15_000
const MAX_COVER_BYTES = 6 * 1024 * 1024

// RAWG's own resizer. Full-size art is a few hundred kilobytes of screenshot;
// this is the same picture at a width nothing here draws past.
const COVER_WIDTH = 420

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

/** The same picture, at a width worth storing. */
export function thumbnailUrl(raw) {
  const url = new URL(raw)
  if (url.hostname !== MEDIA_HOST) throw refused('not a RAWG image')
  if (url.pathname.startsWith('/media/resize/')) return url
  url.pathname = url.pathname.replace(/^\/media\//, `/media/resize/${COVER_WIDTH}/-/`)
  return url
}

export function createGames({ apiKey, coversDir }) {
  const searches = boundedCache(CACHE_LIMIT)
  const details = boundedCache(CACHE_LIMIT * 4)

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

      const had = searches.get(q.toLowerCase())
      if (had) return had

      const body = await ask('/games', { search: q, page_size: String(RESULTS) }, SEARCH_TIMEOUT_MS)
      const found = (body.results ?? []).slice(0, RESULTS)

      const results = await Promise.all(found.map(async (game) => ({
        id: game.id,
        name: game.name,
        released: game.released ? game.released.slice(0, 4) : '',
        image: game.background_image ?? '',
        genres: (game.genres ?? []).slice(0, 3).map((g) => g.name),
        description: await describe(game.id),
      })))

      searches.set(q.toLowerCase(), results)
      return results
    },

    /**
     * Copy a cover into the vault and answer with the name it was given.
     *
     * Linking to RAWG would leave the record depending on a website: no
     * network, no covers, and one day no RAWG. A file in the vault beside the
     * notes is the whole point — it is yours, and it keeps.
     *
     * A cover already there is left alone. The same game logged on fifty days
     * is one picture, and it is named after the game rather than after the
     * day, so the fifty-first costs nothing.
     */
    async keep({ id, name, image }) {
      if (!Number.isInteger(id) || id <= 0) throw refused('bad game id')
      if (!image) return { cover: '' }

      const url = thumbnailUrl(image)
      const ext = (path.extname(url.pathname) || '.jpg').toLowerCase()
      if (!['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        throw refused(`not a picture: ${ext}`)
      }

      const file = `${slugify(name)}-${id}${ext}`
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
  }
}
