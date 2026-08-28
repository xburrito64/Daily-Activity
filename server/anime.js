// Finding an anime, keeping its cover in the vault, and telling AniList how
// far you got.
//
// One database this time rather than two. AniList answers without a key at
// all, and one reply carries the portrait cover, the genres, the year, the
// episode count and — the part that matters for a show still going out — how
// many episodes have actually aired. Where games needed RAWG to find them and
// Steam to draw them, this needs neither half.
//
// Seasons are separate entries here, not fields on one: "Frieren" and
// "Frieren Season 2" are two records joined by a SEQUEL relation. So a season
// list is a walk along that chain in both directions from whichever one was
// searched for, which is why it costs a few requests rather than none.
//
// Writing back to AniList is the only place in this app that sends anything
// anywhere, and it only ever happens because a button was pressed.

import fs from 'node:fs/promises'
import path from 'node:path'

const API = 'https://graphql.anilist.co'

// Where AniList keeps its cover art. Numbered hosts, so the check is on the
// shape rather than on one name.
const COVER_HOST_RE = /^s\d+\.anilist\.co$/
const COVER_PATH = '/file/anilistcdn/media/'

// What is known about each show, beside the covers it belongs with.
const FACTS_FILE = 'anime.json'

// Kept level with games.js: the same card, the same row of them.
const MAX_GENRES = 6
const GENRE_CHARS = 40

// The formats a season chain is made of. A sequel that is a film or a
// one-off special is a different kind of thing to sit down to, and listing it
// as "season 4" would be a lie about what it is.
const SERIES_FORMATS = new Set(['TV', 'TV_SHORT', 'ONA'])

// How far along the chain to walk. Long-running shows are long in episodes
// rather than in seasons; nothing has thirty of them, and a bound means a
// relation loop can never turn into an endless walk.
const MAX_SEASONS = 24
const MAX_HOPS = 8

const RESULTS = 8          // a screenful; more is a list to read, not a pick
const DESCRIPTION_CHARS = 260
const TIMEOUT_MS = 8000
const COVER_TIMEOUT_MS = 15000
const MAX_COVER_BYTES = 6 * 1024 * 1024

const CACHE_LIMIT = 120

/** Something went wrong out on the network rather than in here. */
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

// Everything asked about a show, in one place so the search, the season walk
// and the re-read after picking all come back shaped the same.
const MEDIA_FIELDS = `
  id
  title { english romaji }
  format
  status
  episodes
  duration
  seasonYear
  startDate { year month }
  genres
  averageScore
  description(asHtml: false)
  nextAiringEpisode { episode }
  coverImage { extraLarge large }
`

/** English where there is one — it is what the note will read as. */
export function titleOf(media) {
  const t = media?.title ?? {}
  return String(t.english || t.romaji || '').trim()
}

/**
 * How many episodes you could actually have watched.
 *
 * A show part-way through its run has a total that hasn't happened yet, and
 * offering episode 12 of a show that has aired 8 is offering to record
 * something that does not exist. The next one due is the honest edge: if 9 is
 * next, 8 have been.
 */
export function airedCount(media) {
  const next = media?.nextAiringEpisode?.episode
  if (Number.isInteger(next) && next > 0) return next - 1
  const total = media?.episodes
  return Number.isInteger(total) && total > 0 ? total : 0
}

/** "Sousou no Frieren" -> "sousou-no-frieren". Filenames only. */
export function slugify(name) {
  return String(name)
    // Accents split off their letters and dropped, rather than each becoming
    // a dash of its own — Ōkami is okami, not o-kami.
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'anime'
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '039': "'",
}

/**
 * AniList writes its descriptions in a bit of HTML. Asking for it without
 * still leaves the line breaks in, so they come out here — what this is for
 * is two lines under a title, and a tag in the middle of them is noise.
 */
export function plainText(html) {
  return String(html ?? '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&#?(\w+);/g, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Enough of a description to tell two shows of the same name apart, which is
 * the whole reason it is shown. Cut on a sentence where there is one nearby,
 * so it ends rather than just stopping.
 */
function shorten(text) {
  const clean = plainText(text)
  if (clean.length <= DESCRIPTION_CHARS) return clean
  const cut = clean.slice(0, DESCRIPTION_CHARS)
  const stop = cut.lastIndexOf('. ')
  return stop > DESCRIPTION_CHARS * 0.6 ? cut.slice(0, stop + 1) : `${cut.trimEnd()}…`
}

/**
 * A list of genres fit to write down: trimmed, nothing blank, nothing twice,
 * and few enough and short enough to sit on a card. The same rules games get,
 * for the same reason — they end up on the same shelf.
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

/**
 * Check a cover address before downloading it.
 *
 * What ends up in a note eventually turns into a download, so the address is
 * not something to take on trust: it has to be AniList's own art host, and it
 * has to be under the folder that host keeps media images in.
 */
export function coverSource(raw) {
  const url = new URL(raw)
  if (url.protocol !== 'https:') throw refused('not an AniList cover')
  if (!COVER_HOST_RE.test(url.hostname)) throw refused('not an AniList cover')
  if (!url.pathname.startsWith(COVER_PATH)) throw refused('not an AniList cover')
  if (!/\.(jpe?g|png|webp)$/i.test(url.pathname)) throw refused('not an AniList cover')
  return url
}

/** The order seasons happened in, which is the only order to list them in. */
const startedAt = (m) =>
  (m.startDate?.year ?? m.seasonYear ?? 9999) * 100 + (m.startDate?.month ?? 0)

export function createAnime({ coversDir, token = '', clientId = '' }) {
  const searches = boundedCache(CACHE_LIMIT)
  const chains = boundedCache(CACHE_LIMIT)

  // Both may be functions, and from the app they are: these are settings you
  // change while the app is open, and having to close it and open it again
  // before the change counts is the sort of thing nobody is told and
  // everybody trips over.
  const now = (v) => String(typeof v === 'function' ? v() : v ?? '').trim()
  const tokenNow = () => now(token)
  const clientIdNow = () => now(clientId)

  /**
   * One request to AniList. `auth` is for the handful of things that are
   * about you rather than about a show — everything else is public and is
   * asked for without saying who is asking.
   */
  async function ask(query, variables = {}, { auth = false, using = '' } = {}) {
    const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
    if (auth) {
      // `using` is a token being tried rather than one already kept — see
      // `viewer`. Everything else asks with whatever is on disk.
      const key = String(using || tokenNow()).trim()
      if (!key) throw refused('not connected to AniList yet')
      headers.Authorization = `Bearer ${key}`
    }

    let res
    try {
      res = await fetch(API, {
        method: 'POST',
        headers,
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw upstream('could not reach AniList')
    }

    if (res.status === 429) throw upstream('AniList is asking for a moment — try again shortly')
    // A rejected token comes back as a 400 on some of these calls and a 401
    // on others, so the two are told apart by whether we sent one at all.
    if (auth && (res.status === 401 || res.status === 400)) {
      throw upstream('AniList turned the connection down — connect it again')
    }

    const body = await res.json().catch(() => null)
    if (!body) throw upstream(`AniList answered ${res.status}`)
    if (body.errors?.length) {
      const first = body.errors[0]?.message ?? 'something it would not explain'
      throw upstream(`AniList said: ${first}`)
    }
    if (!res.ok) throw upstream(`AniList answered ${res.status}`)
    return body.data
  }

  /** A show as the app talks about it, from a show as AniList sends it. */
  const shape = (media) => {
    const name = titleOf(media)
    return {
      id: media.id,
      name,
      // The other title, for the row where telling two apart is the whole job.
      original: media.title?.romaji && media.title.romaji !== name ? media.title.romaji : '',
      format: media.format ?? '',
      status: media.status ?? '',
      year: media.startDate?.year ?? media.seasonYear ?? null,
      episodes: Number.isInteger(media.episodes) ? media.episodes : null,
      aired: airedCount(media),
      duration: Number.isInteger(media.duration) ? media.duration : null,
      genres: cleanGenres(media.genres),
      score: Number.isInteger(media.averageScore) ? media.averageScore : null,
      cover: media.coverImage?.extraLarge || media.coverImage?.large || '',
      description: shorten(media.description),
    }
  }

  return {
    /** Whether there is a token to write with. Reading never needs one. */
    get connected() { return tokenNow() !== '' },
    get clientId() { return clientIdNow() },

    /**
     * Shows matching what has been typed so far, best first.
     *
     * Cached by query: typing a name out and then backspacing over it should
     * not spend a round trip on every letter of the way back.
     */
    async search(query) {
      const q = String(query ?? '').trim()
      if (q === '') return []

      const had = searches.get(q.toLowerCase())
      if (had) return had

      const data = await ask(
        `query ($q: String, $n: Int) {
           Page(perPage: $n) {
             media(search: $q, type: ANIME, sort: [SEARCH_MATCH]) { ${MEDIA_FIELDS} }
           }
         }`,
        { q, n: RESULTS },
      )
      const results = (data?.Page?.media ?? []).map(shape)
      searches.set(q.toLowerCase(), results)
      return results
    },

    /**
     * Every season of the show one entry belongs to, earliest first.
     *
     * AniList keeps each season as its own record, joined to the one before
     * it by a prequel/sequel link, so this walks the links outwards from
     * whichever one was picked. Only the links that mean "and then it carried
     * on" are followed: a film, a recap or a side story is related to a show
     * without being another season of it, and putting one in this list would
     * be calling it something it isn't.
     *
     * The one that was picked is always in the list, whatever format it is —
     * if you went looking for a film, the film is what you meant.
     */
    async seasons(rootId) {
      const id = Number(rootId)
      if (!Number.isInteger(id) || id <= 0) throw refused('bad show id')

      const had = chains.get(id)
      if (had) return had

      const found = new Map()
      let frontier = [id]
      for (let hop = 0; hop < MAX_HOPS && frontier.length > 0; hop++) {
        // Everything the same distance along in one request rather than one
        // each: a four-season show should not be four round trips deep.
        const data = await ask(`query {
          ${frontier.map((each, i) => `
            m${i}: Media(id: ${Number(each)}) {
              ${MEDIA_FIELDS}
              relations { edges { relationType node { id format } } }
            }`).join('\n')}
        }`)

        const next = []
        for (const media of Object.values(data ?? {})) {
          if (!media || found.has(media.id)) continue
          found.set(media.id, media)
          if (found.size >= MAX_SEASONS) break

          for (const edge of media.relations?.edges ?? []) {
            if (edge.relationType !== 'SEQUEL' && edge.relationType !== 'PREQUEL') continue
            const node = edge.node
            if (!node || found.has(node.id) || next.includes(node.id)) continue
            if (!SERIES_FORMATS.has(node.format)) continue
            next.push(node.id)
          }
        }
        if (found.size >= MAX_SEASONS) break
        frontier = next
      }

      // Ordered on the records rather than on what comes back from `shape`,
      // since the month is only on the record and two seasons inside one
      // year is the ordinary case rather than the odd one.
      const when = new Map([...found.values()].map((m) => [m.id, startedAt(m)]))
      const seasons = [...found.values()]
        .map(shape)
        .sort((a, b) => (when.get(a.id) ?? 0) - (when.get(b.id) ?? 0))

      chains.set(id, seasons)
      return seasons
    },

    /**
     * Copy a cover into the vault and answer with the name it was given.
     *
     * Linking to AniList would leave the record depending on a website: no
     * network, no covers, and one day no page. A file in the vault beside the
     * notes is the whole point — it is yours, and it keeps.
     *
     * A cover already there is left alone. The same show logged on fifty days
     * is one picture, named after the show rather than after the day.
     */
    async keep({ id, name, image }) {
      if (!Number.isInteger(id) || id <= 0) throw refused('bad show id')
      if (!image) return { cover: '' }

      const url = coverSource(image)
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
     * What is known about a show, kept once for the show rather than once for
     * every evening spent on it.
     *
     * This does not go in the daily notes. A day is a record of what happened,
     * and "Adventure, Drama, 28 episodes" is not something that happened. It
     * sits beside the covers instead, keyed by the name the notes use, so the
     * two halves still find each other offline.
     *
     * The AniList id lives here rather than in the note for the same reason,
     * and one more: it is the one thing on this page that means nothing at
     * all to somebody reading the vault without this app.
     */
    async remember(show) {
      const all = await this.known()
      const had = all[show.name]
      all[show.name] = {
        anilistId: show.id,
        format: show.format ?? '',
        year: show.year ?? null,
        episodes: show.episodes ?? null,
        duration: show.duration ?? null,
        // Genres are the one thing here you can change by hand, so a show
        // already on the list keeps the ones it has. Picking the same show
        // again must not quietly throw your own filing away.
        genres: had?.genres?.length ? had.genres : cleanGenres(show.genres),
        cover: show.cover ?? '',
      }
      await this.write(all)
    },

    /** File a show under different genres. Yours, and nothing overwrites them. */
    async setGenres(name, genres) {
      const show = String(name ?? '').trim()
      if (!show) throw refused('which show?')
      const all = await this.known()
      all[show] = { ...(all[show] ?? {}), genres: cleanGenres(genres) }
      await this.write(all)
      return all[show]
    },

    async write(all) {
      await fs.mkdir(coversDir, { recursive: true })
      const target = path.join(coversDir, FACTS_FILE)
      const tmp = `${target}.tmp-${process.pid}`
      await fs.writeFile(tmp, `${JSON.stringify(all, null, 1)}\n`, 'utf8')
      await fs.rename(tmp, target)
    },

    /** Everything remembered so far, by show name. Empty if there is none. */
    async known() {
      try {
        const text = await fs.readFile(path.join(coversDir, FACTS_FILE), 'utf8')
        const parsed = JSON.parse(text.replace(/^﻿/, ''))
        return parsed && typeof parsed === 'object' ? parsed : {}
      } catch {
        // Missing, or edited into something we can't read. Either way there
        // is nothing to say about a show, which the card is built to survive.
        return {}
      }
    },

    /**
     * Who a token belongs to, which is how a token gets checked.
     *
     * Takes one to try rather than only reading the saved one, so a pasted
     * token can be tried before it is kept. Writing it first and finding out
     * afterwards would leave a settings file holding something that does not
     * work, which is exactly the state this whole panel exists to avoid.
     */
    async viewer(using = '') {
      const data = await ask('query { Viewer { id name } }', {}, { auth: true, using })
      return data?.Viewer ?? null
    },

    /** Where you already are on AniList, if it has heard of you watching it. */
    async progressOf(mediaId) {
      const id = Number(mediaId)
      if (!Number.isInteger(id) || id <= 0) throw refused('bad show id')
      const data = await ask(
        `query ($id: Int) {
           Media(id: $id) { id episodes mediaListEntry { id progress status } }
         }`,
        { id },
        { auth: true },
      )
      const media = data?.Media ?? null
      return {
        episodes: Number.isInteger(media?.episodes) ? media.episodes : null,
        progress: media?.mediaListEntry?.progress ?? 0,
        status: media?.mediaListEntry?.status ?? '',
      }
    },

    /**
     * Tell AniList you have watched up to an episode.
     *
     * Only ever forwards. A block from last month naming episode 3 is a true
     * record of that evening and no reason to un-watch the thirty episodes
     * since — progress there is how far you have got, not what you did on a
     * Tuesday, and the two are only the same number while you are logging as
     * you go. So an episode behind where AniList already has you changes
     * nothing, and says so rather than pretending to have done something.
     *
     * Finishing the last episode is finishing the show, which is a different
     * word there and worth getting right; anything short of that is watching
     * it now.
     */
    async sync({ mediaId, episode }) {
      const id = Number(mediaId)
      const wanted = Number(episode)
      if (!Number.isInteger(id) || id <= 0) throw refused('bad show id')
      if (!Number.isInteger(wanted) || wanted <= 0) throw refused('bad episode')

      const before = await this.progressOf(id)
      if (before.progress >= wanted) {
        return { already: true, progress: before.progress, status: before.status }
      }

      const done = before.episodes != null && wanted >= before.episodes
      const data = await ask(
        `mutation ($id: Int, $p: Int, $s: MediaListStatus) {
           SaveMediaListEntry(mediaId: $id, progress: $p, status: $s) {
             id progress status
           }
         }`,
        { id, p: wanted, s: done ? 'COMPLETED' : 'CURRENT' },
        { auth: true },
      )
      const saved = data?.SaveMediaListEntry ?? {}
      return {
        already: false,
        was: before.progress,
        progress: saved.progress ?? wanted,
        status: saved.status ?? (done ? 'COMPLETED' : 'CURRENT'),
      }
    },
  }
}
