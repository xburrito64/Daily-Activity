// The arithmetic of Scriptorium, apart from the drawing so it can be checked.
//
// Scriptorium keeps your days as a monk kept a book. Each day opens with an
// illuminated initial: its ground quartered like a coat of arms in the
// colours of what filled the day, painted when the day has something in it
// and gilded when it is nearly all accounted for, left as a bare frame with
// a guide letter when nothing has been written yet. A line of chronicle
// beside it says what the day was given to. The day is kept by the canonical
// hours — Matins, Lauds, Prime, Terce, Sext, None, Vespers, Compline — and
// the light through the window follows the sun.

import { MINUTES_PER_SLOT } from '../time.js'

/** The hours of the monastic day, three hours apart from midnight. */
export const CANONICAL_HOURS = [
  { hour: 0, name: 'Matins' },
  { hour: 3, name: 'Lauds' },
  { hour: 6, name: 'Prime' },
  { hour: 9, name: 'Terce' },
  { hour: 12, name: 'Sext' },
  { hour: 15, name: 'None' },
  { hour: 18, name: 'Vespers' },
  { hour: 21, name: 'Compline' },
]

/** Which canonical hour it is, from minutes since midnight. */
export function hourOf(minute) {
  let now = CANONICAL_HOURS[0]
  for (const h of CANONICAL_HOURS) if (minute >= h.hour * 60) now = h
  return now.name
}

// A day this full or more is gilded: eighteen hours of twenty-four.
export const GILDED_FROM = 18 * 60

/** Each tag's minutes on a day, most first. Overlapping tags each keep their own time. */
function byTag(blocks) {
  const minutes = new Map()
  for (const b of blocks) minutes.set(b.tag, (minutes.get(b.tag) ?? 0) + (b.endSlot - b.startSlot) * MINUTES_PER_SLOT)
  return [...minutes]
    .map(([tag, m]) => ({ tag, minutes: m }))
    .sort((a, b) => b.minutes - a.minutes || (a.tag < b.tag ? -1 : 1))
}

/** Minutes with anything on them, overlaps counted once. */
function covered(blocks, uptoSlot = Infinity) {
  const slots = new Set()
  for (const b of blocks) for (let s = b.startSlot; s < Math.min(b.endSlot, uptoSlot); s++) slots.add(s)
  return slots.size * MINUTES_PER_SLOT
}

/**
 * How a day's initial is illuminated: 'sketch' with nothing written, 'painted'
 * with something, 'gilded' when nearly all of it is accounted for. Its ground
 * is quartered in the colours of up to four tags that filled it most.
 */
export function illumination(blocks) {
  const list = blocks ?? []
  if (list.length === 0) return { level: 'sketch', grounds: [] }
  return {
    level: covered(list) >= GILDED_FROM ? 'gilded' : 'painted',
    grounds: byTag(list).slice(0, 4).map((t) => t.tag),
  }
}

/**
 * What a day was given to, for the line of chronicle beside its heading: the
 * three tags it held longest, how many others, and how much of it was left
 * unwritten. For today only the part already past counts as left blank.
 */
export function chronicle(blocks, { now = null } = {}) {
  const list = blocks ?? []
  const tags = byTag(list)
  const upto = now === null ? Infinity : Math.floor(now / MINUTES_PER_SLOT)
  const passed = now === null ? 24 * 60 : Math.floor(now / MINUTES_PER_SLOT) * MINUTES_PER_SLOT
  return {
    given: tags.slice(0, 3),
    more: Math.max(0, tags.length - 3),
    blank: Math.max(0, passed - covered(list, upto)),
    today: now !== null,
  }
}

/** "7h 20m", "3h", "40m". */
export function duration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/**
 * The chronicle as words, in pieces: plain text, and the tag names apart so
 * they can be written in red the way a rubric was.
 * "Given to Sleep 7h, Game 3h and Music 2h 10m, and 2 more; 4h left blank."
 */
export function chronicleWords(c, nameOf) {
  if (!c || c.given.length === 0) return []
  const out = [{ text: c.today ? 'So far given to ' : 'Given to ' }]
  c.given.forEach((g, i) => {
    if (i > 0) out.push({ text: i === c.given.length - 1 && c.more === 0 ? ' and ' : ', ' })
    out.push({ tag: g.tag, text: nameOf(g.tag) })
    out.push({ text: ` ${duration(g.minutes)}` })
  })
  if (c.more > 0) out.push({ text: `, and ${c.more} more` })
  out.push({ text: c.blank > 0 ? `; ${duration(c.blank)} left blank.` : '.' })
  return out
}

/**
 * Where the sun is, for the light through the window: how strong it is
 * (0 at night, 1 at noon) and which side it comes from (-1 morning, from the
 * left, to 1 evening, from the right). Up at six, down at eight.
 */
export function sunOf(minute) {
  const t = (minute / 60 - 6) / 14
  if (t <= 0 || t >= 1) return { day: 0, from: t <= 0 ? -1 : 1 }
  return { day: Math.sin(Math.PI * t), from: t * 2 - 1 }
}
