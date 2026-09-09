// The backup list.
//
// AniList is the one this app was built on, and when it is up it is better at
// everything that matters here: it knows which episode is due next, so it can
// offer only the ones that have actually gone out. But it goes down. Not
// briefly and not rarely — it turns its public API off under load and answers
// every request with "temporarily disabled due to severe stability issues"
// until it feels better, and an evening in front of something is not a thing
// that waits for a website to recover.
//
// So Kitsu stands behind it. The same idea as SteamGridDB behind Steam: only
// ever asked once the first one has failed, no key either, and what it gives
// back is shaped to look exactly like what AniList gives back, so nothing
// downstream has to know which of them answered.
//
// What it cannot do is write. Progress goes to an AniList account and only an
// AniList account, so a show found here is one you can log and cannot send.
// That is the trade, and it is the right way round: the record in the vault
// is the point, and the send is a nicety on top of it.

const API = 'https://kitsu.io/api/edge'

// Kitsu's art host. Checked on the shape rather than one name because the
// site moved from .io to .app and still answers on both.
export const COVER_HOST_RE = /^media\.kitsu\.(app|io)$/
export const COVER_PATH = '/anime/'

// Ids are prefixed on the way out, and this is the whole reason why.
//
// Both lists number their shows from one, independently, and neither has any
// idea the other exists. AniList's 21 is One Piece; Kitsu's 21 is something
// else. A number that could have come from either is a number that can be
// sent to the wrong one — and the thing at the far end of "send" is somebody's
// own AniList account. So a Kitsu id never looks like a number, and anything
// expecting a number turns it down without having to be told to.
export const PREFIX = 'kitsu-'
export const wireId = (number) => `${PREFIX}${number}`

/** The number inside a Kitsu id, or null if that is not what this is. */
export function kitsuNumber(raw) {
  const text = String(raw ?? '').trim()
  if (!text.startsWith(PREFIX)) return null
  const number = Number(text.slice(PREFIX.length))
  return Number.isInteger(number) && number > 0 ? number : null
}

// Kitsu's words for the same things, in AniList's words, so that everything
// downstream — the season filter, the card, what gets written beside the
// covers — keeps reading one vocabulary rather than two.
const FORMATS = {
  tv: 'TV', ona: 'ONA', ova: 'OVA', movie: 'MOVIE', special: 'SPECIAL', music: 'MUSIC',
}
const STATUSES = {
  finished: 'FINISHED',
  current: 'RELEASING',
  upcoming: 'NOT_YET_RELEASED',
  unreleased: 'NOT_YET_RELEASED',
  tba: 'NOT_YET_RELEASED',
}

const TIMEOUT_MS = 8000

/** Something went wrong out on the network rather than in here. */
const upstream = (message) => Object.assign(new Error(message), { status: 502 })
/** Something arrived that we are not going to act on. */
const refused = (message) => Object.assign(new Error(message), { status: 400 })

/**
 * How many episodes of this you could actually have watched.
 *
 * AniList answers it exactly: it knows which episode is due next, so the one
 * before it is the last that aired. Kitsu has no such field, and the count it
 * does have is the number the show is *going* to have.
 *
 * Which leaves a choice about which way to be wrong on a show still going
 * out, and the two are not equally bad. Offering one episode too many costs a
 * row in a list nobody has to tick. Offering one too few means an evening
 * that happened cannot be written down at all — the app refusing the record,
 * which is the entire point of it. So it errs long.
 */
export function airedCount(attributes, highest = null) {
  // Except at the one end where there is no choice to make. A season
  // announced for next year has aired nothing, whatever number is written
  // next to it, and offering fourteen episodes of it would not be erring
  // long — it would be offering to record something that cannot have
  // happened.
  if (STATUSES[String(attributes?.status ?? '').toLowerCase()] === 'NOT_YET_RELEASED') return 0
  const count = attributes?.episodeCount
  if (Number.isInteger(count) && count > 0) return count
  return Number.isInteger(highest) && highest > 0 ? highest : 0
}

/**
 * A show as this app talks about it, from a show as Kitsu sends it.
 *
 * `shorten` is handed in rather than written here so that a description cut
 * short is cut by the same rule whichever list it came off — see anime.js,
 * which owns that rule and passes it down.
 */
export function shape(record, { genres = [], highest = null, shorten = (t) => t } = {}) {
  const a = record?.attributes ?? {}
  const titles = a.titles ?? {}
  const name = String(titles.en || titles.en_jp || a.canonicalTitle || '').trim()
  const canonical = String(a.canonicalTitle || '').trim()
  // Kitsu scores out of a hundred, to two decimal places, as a string.
  const score = Math.round(Number(a.averageRating))
  const year = Number(String(a.startDate ?? '').slice(0, 4))

  return {
    id: wireId(record?.id),
    name,
    original: canonical && canonical !== name ? canonical : '',
    format: FORMATS[String(a.subtype ?? '').toLowerCase()] ?? '',
    status: STATUSES[String(a.status ?? '').toLowerCase()] ?? '',
    year: Number.isInteger(year) && year > 0 ? year : null,
    episodes: Number.isInteger(a.episodeCount) && a.episodeCount > 0 ? a.episodeCount : null,
    aired: airedCount(a, highest),
    duration: Number.isInteger(a.episodeLength) && a.episodeLength > 0 ? a.episodeLength : null,
    genres,
    score: Number.isInteger(score) && score > 0 ? score : null,
    cover: a.posterImage?.large || a.posterImage?.original || '',
    description: shorten(String(a.synopsis ?? '').replace(/\s+/g, ' ').trim()),
    // So a card can say where this came from, and so the send knows it has
    // nothing to send with. Never written into a note.
    from: 'kitsu',
  }
}

/** When it started, which is the only order to list seasons in. */
export const startedAt = (record) => String(record?.attributes?.startDate ?? '9999-99-99')

// Kitsu files a film, a recap, a music video and the manga it came from all as
// relations of a show. Only two of its words mean "and then it went on", and
// only some formats can be a season of anything.
export const CHAIN_ROLES = new Set(['sequel', 'prequel'])
export const SERIES_FORMATS = new Set(['TV', 'ONA'])

export function createKitsu({
  results = 8, maxSeasons = 24, maxHops = 8, shorten = (t) => t,
} = {}) {
  /** One request to Kitsu. Everything here is public; nothing is signed. */
  async function ask(path, params = {}) {
    const url = new URL(API + path)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)

    let res
    try {
      res = await fetch(url, {
        headers: { Accept: 'application/vnd.api+json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw upstream('could not reach the backup list either')
    }
    const body = await res.json().catch(() => null)
    if (!res.ok || !body) throw upstream(`the backup list answered ${res.status}`)
    return body
  }

  /** The genre names sitting alongside a page of records, by record id. */
  function genresIn(body) {
    const named = new Map(
      (body.included ?? [])
        .filter((each) => each.type === 'categories')
        .map((each) => [each.id, each.attributes?.title]),
    )
    const found = new Map()
    for (const record of body.data ?? []) {
      found.set(String(record.id), (record.relationships?.categories?.data ?? [])
        .map((each) => named.get(each.id))
        .filter(Boolean))
    }
    return found
  }

  /**
   * Genres for several shows at once — one request for the list rather than
   * one each. Nothing depends on them: a show with no genres beside it is a
   * card with a blank line, so a failure here is swallowed rather than passed
   * on.
   */
  async function genresFor(ids) {
    if (ids.length === 0) return new Map()
    try {
      return genresIn(await ask('/anime', {
        'filter[id]': ids.join(','),
        'page[limit]': String(Math.min(ids.length, 20)),
        include: 'categories',
      }))
    } catch {
      return new Map()
    }
  }

  /**
   * The highest episode number Kitsu has a record of, for a show whose total
   * it does not know. Only asked for when there is no count to use, which is
   * the handful of shows that have been running for twenty years.
   */
  async function highestEpisode(id) {
    try {
      const body = await ask('/episodes', {
        'filter[mediaId]': String(id),
        'filter[mediaType]': 'Anime',
        sort: '-number',
        'page[limit]': '1',
      })
      const number = body.data?.[0]?.attributes?.number
      return Number.isInteger(number) ? number : null
    } catch {
      return null
    }
  }

  /** Episode numbers for whichever of these has no count of its own. */
  async function countsFor(records) {
    const missing = records.filter((r) => !Number.isInteger(r.attributes?.episodeCount))
    return new Map(await Promise.all(
      missing.map(async (r) => [String(r.id), await highestEpisode(r.id)]),
    ))
  }

  return {
    /** Shows matching what has been typed so far, best first. */
    async search(query) {
      const q = String(query ?? '').trim()
      if (q === '') return []

      const body = await ask('/anime', {
        'filter[text]': q,
        'page[limit]': String(results),
        include: 'categories',
      })
      const records = body.data ?? []
      const genres = genresIn(body)
      const counts = await countsFor(records)

      return records.map((record) => shape(record, {
        genres: genres.get(String(record.id)) ?? [],
        highest: counts.get(String(record.id)) ?? null,
        shorten,
      }))
    },

    /**
     * Every season of the show one entry belongs to, earliest first.
     *
     * The same walk AniList needs, along the same kind of links — and cheaper
     * here, because Kitsu hands over the whole related record beside the link
     * rather than only its id, so a hop is one request and not two.
     */
    async seasons(rootId) {
      const id = kitsuNumber(rootId) ?? Number(rootId)
      if (!Number.isInteger(id) || id <= 0) throw refused('bad show id')

      const found = new Map()
      let frontier = [String(id)]
      for (let hop = 0; hop < maxHops && frontier.length > 0 && found.size < maxSeasons; hop++) {
        const pages = await Promise.all(frontier.map((each) => ask('/media-relationships', {
          'filter[source_id]': each,
          'filter[source_type]': 'Anime',
          include: 'destination',
          'page[limit]': '20',
        }).catch(() => null)))

        const next = []
        for (const page of pages) {
          if (!page) continue
          const included = page.included ?? []
          for (const link of page.data ?? []) {
            const role = String(link.attributes?.role ?? '')
            if (!CHAIN_ROLES.has(role)) continue
            const to = link.relationships?.destination?.data
            if (!to || to.type !== 'anime' || found.has(String(to.id))) continue
            const record = included.find((each) => each.type === 'anime' && each.id === to.id)
            if (!record) continue
            const format = FORMATS[String(record.attributes?.subtype ?? '').toLowerCase()]
            if (!SERIES_FORMATS.has(format)) continue
            found.set(String(record.id), record)
            next.push(String(record.id))
          }
        }
        frontier = next
      }

      // The one that was picked is always in the list, whatever format it is
      // and whether or not anything links to it — if you went looking for a
      // film, the film is what you meant. It is only ever mentioned in other
      // shows' relations, never its own, so it is asked for by name.
      if (!found.has(String(id))) {
        try {
          const body = await ask(`/anime/${id}`, { include: 'categories' })
          if (body.data) found.set(String(body.data.id), body.data)
        } catch { /* then the chain is what it is */ }
      }

      const records = [...found.values()].slice(0, maxSeasons)
      const [genres, counts] = await Promise.all([
        genresFor(records.map((r) => r.id)),
        countsFor(records),
      ])

      return records
        .sort((a, b) => (startedAt(a) < startedAt(b) ? -1 : startedAt(a) > startedAt(b) ? 1 : 0))
        .map((record) => shape(record, {
          genres: genres.get(String(record.id)) ?? [],
          highest: counts.get(String(record.id)) ?? null,
          shorten,
        }))
    },
  }
}
