// The arithmetic of Black Hours, apart from the drawing so it can be checked.
//
// Black Hours keeps your days as a book of hours written in gold on black
// vellum, the way the finest were in fifteenth-century Bruges. Each day opens
// with an illuminated initial: its ground quartered like a coat of arms in the
// colours of what filled the day, painted when the day has something in it and
// gilded when it is nearly all accounted for, left drawn in silver when
// nothing has been written yet. A line of chronicle beside it says what the
// day was given to. The day is kept by the canonical hours — Matins, Lauds,
// Prime, Terce, Sext, None, Vespers, Compline — and the border of gold ivy
// along the head of the page is gilded leaf by leaf as today is kept up with.

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
 * How well today has been kept up with, from 0 to 1: of the time gone by
 * since midnight, how much has something written on it. The first hour
 * counts as a whole hour, so the border is not all or nothing at five past
 * twelve.
 */
export function keptUp(blocks, minute) {
  const list = blocks ?? []
  const gone = Math.max(60, minute)
  const upto = Math.ceil(minute / MINUTES_PER_SLOT)
  return Math.min(1, covered(list, upto) / gone)
}

/** A small seeded random, so the ivy grows the same way every time it is drawn. */
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The gold ivy of the border, grown by rule in a box `width` by `height`:
 * one hairline stem running the length of it in a slow wave, and off each
 * crest and each trough a tendril curling into a spiral — above the stem
 * from a crest, below it from a trough — with ivy leaves along stem and
 * tendrils by turns, and a gold bezant or a little flower where each spiral
 * closes. The ivy-leaf rinceaux of the French books of hours.
 *
 * Every leaf, flower and bezant carries a `rank` between 0 and 1, so the
 * border can be gilded a share at a time: everything below the share in gold,
 * the rest still only drawn.
 *
 * Returns { stems: [[x, y], ...][], leaves: [{ x, y, angle, size, rank }],
 *           flowers: [{ x, y, r, hue, rank }], bezants: [{ x, y, r, rank }] }.
 */
export function ivy(width, height, seed = 7) {
  const rand = seeded(seed)
  const stems = []
  const leaves = []
  const flowers = []
  const bezants = []
  const inside = (x, y, pad = 3) => x > pad && x < width - pad && y > pad && y < height - pad

  const leafAt = (x, y, angle, size) => {
    // On a short stalk, pointing out from where it grows.
    const sx = x + Math.cos(angle) * 2.5
    const sy = y + Math.sin(angle) * 2.5
    if (!inside(sx + Math.cos(angle) * size, sy + Math.sin(angle) * size, 2) || !inside(sx, sy, 2)) return
    stems.push([[x, y], [sx, sy]])
    leaves.push({ x: sx, y: sy, angle, size, rank: rand() })
  }

  // The stem: a slow wave along the middle of the box.
  const mid = height * 0.62
  const swing = Math.min(height * 0.13, 14)
  const wave = 170 + rand() * 30
  const phase = rand() * Math.PI * 2
  const yAt = (x) => mid + swing * Math.sin((x / wave) * Math.PI * 2 + phase)
  const slope = (x) => (swing * Math.PI * 2 / wave) * Math.cos((x / wave) * Math.PI * 2 + phase)
  const stem = []
  for (let x = 0; x <= width; x += 3) stem.push([x, yAt(x)])
  stems.push(stem)

  // Leaves along the stem, by turns above and below.
  let side = -1
  for (let x = 10 + rand() * 8; x < width - 8; x += 15 + rand() * 9) {
    const along = Math.atan(slope(x))
    leafAt(x, yAt(x), along + side * (1.05 + rand() * 0.35), 7 + rand() * 2.5)
    side = -side
  }

  /** A tendril from x, y heading `angle`, turning `turn` (+1 or -1) as it
   *  goes, opening out at `open` px across before it coils. */
  const tendril = (x, y, angle, length, turn, open) => {
    const line = [[x, y]]
    const lead = length * 0.45
    let side2 = -turn
    let nextLeaf = 8 + rand() * 4
    for (let s = 0; s < length; s += 1.5) {
      const radius = s < lead ? open * 1.5 : open * (1 - (s - lead) / (length - lead)) + 2.2
      angle += (turn * 1.5) / radius
      x += Math.cos(angle) * 1.5
      y += Math.sin(angle) * 1.5
      if (!inside(x, y, 1.5)) break
      line.push([x, y])
      if (s >= nextLeaf && s < length * 0.62) {
        // Leaves on the outside of the curl, where there is room for them.
        leafAt(x, y, angle + side2 * (1.15 + rand() * 0.3), 6 + rand() * 2.2)
        side2 = -side2
        nextLeaf = s + 10 + rand() * 5
      }
    }
    stems.push(line)
    const [ex, ey] = line[line.length - 1]
    if (line.length > 8 && inside(ex, ey, 4)) {
      if (rand() < 0.4) {
        flowers.push({ x: ex, y: ey, r: 3 + rand() * 0.8, hue: rand() < 0.5 ? 'lapis' : 'vermilion', rank: rand() })
      } else {
        bezants.push({ x: ex, y: ey, r: 1.8 + rand() * 0.6, rank: rand() })
      }
    }
  }

  // Off each crest a tendril rising away from the stem and coiling above it,
  // off each trough one falling away and coiling below. They start a little
  // before the turn of the wave, run on the way it is going, and turn back
  // against it — the C of a vine scroll.
  for (let k = 0; ; k++) {
    // Where the wave tops out and bottoms out: sin = -1 at a crest (smaller y).
    const crestAt = ((0.75 - phase / (Math.PI * 2) + k * 0.5) % 1 + 1) % 1
    const x = (Math.floor(k / 2) + crestAt) * wave - wave * 0.12
    if (x > width - 20) break
    if (x < 14) continue
    const up = Math.abs(Math.sin((x / wave) * Math.PI * 2 + phase) + 1) < Math.abs(Math.sin((x / wave) * Math.PI * 2 + phase) - 1)
    const along = Math.atan(slope(x))
    // The ones above have the room; the ones below are short curls that keep
    // clear of the rule.
    if (up) tendril(x, yAt(x), along + 0.2, 78 + rand() * 20, -1, 13 + rand() * 3)
    else tendril(x, yAt(x), along - 0.25, 34 + rand() * 8, 1, 7 + rand() * 2)
  }
  return { stems, leaves, flowers, bezants }
}
