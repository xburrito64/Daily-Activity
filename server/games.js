// Finding a game, and keeping its cover in the vault.
//
// Two databases, because neither one does both jobs. RAWG knows about nine
// hundred thousand games including everything that never came to a PC, which
// makes it the right thing to search — but it has no cover art at all. What
// it has is `background_image`, which is key art or a screenshot: the picture
// across the top of a store page, not the box. Steam has the actual cover for
// every game it sells, at a fixed address worked out from the game's id, and
// wants no key to hand it over. So: RAWG finds the game, Steam draws it.
//
// A game Steam has never sold has no cover here. That is most console
// exclusives, and they get their name and nothing else, which is honest — a
// screenshot standing in for a cover is what this replaced.
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
  if (url.hostname !== STEAM_HOST) throw refused('not a Steam cover')
  if (path.basename(url.pathname) !== COVER_FILE) throw refused('not a Steam cover')
  return url
}

export function createGames({ apiKey, coversDir }) {
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
  async function coverOf(id) {
    const had = covers.get(id)
    if (had !== undefined) return had

    let found = ''
    try {
      const body = await ask(`/games/${id}/stores`, {}, SEARCH_TIMEOUT_MS)
      const app = (body.results ?? [])
        .map((s) => STEAM_APP_RE.exec(s.url ?? ''))
        .find(Boolean)
      if (app) {
        const url = steamCover(app[1])
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS) })
        if (res.ok) found = url
      }
    } catch { /* no cover, which a game is allowed not to have */ }

    covers.set(id, found)
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

      const had = searches.get(q.toLowerCase())
      if (had) return had

      const body = await ask('/games', { search: q, page_size: String(RESULTS) }, SEARCH_TIMEOUT_MS)
      const found = (body.results ?? []).slice(0, RESULTS)

      // Every result is worked out beside every other one. Eight games one
      // after another would be a wait; eight at once is one.
      const results = await Promise.all(found.map(async (game) => {
        const [description, cover] = await Promise.all([describe(game.id), coverOf(game.id)])
        return {
          id: game.id,
          name: game.name,
          released: game.released ? game.released.slice(0, 4) : '',
          cover,
          genres: (game.genres ?? []).slice(0, 3).map((g) => g.name),
          description,
        }
      }))

      searches.set(q.toLowerCase(), results)
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
      const file = `${slugify(name)}-${id}.jpg`
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
