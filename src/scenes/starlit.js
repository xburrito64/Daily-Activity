// The arithmetic of Starlit, apart from the drawing so it can be checked.
//
// Starlit is a mage's journal kept on the road, under the night sky. Its moon
// is the real one, in tonight's phase. Every tag is a school of magic, ranked
// by how many hours went into it this past month, the way a mage is ranked —
// Beginner up to God. A day with every hour of it accounted for gets a blue
// moonweed flower beside its date, and finishing one brings a meteor shower.

import { shiftDate, MINUTES_PER_SLOT, SLOTS_PER_DAY } from '../time.js'

// A new moon everyone agrees on (6 January 2000, 18:14 UTC), and the length
// of the moon's month.
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14)
const SYNODIC_DAYS = 29.530588853

/** How far through its month the moon is: 0 new, 0.25 first quarter, 0.5 full. */
export function moonPhase(when) {
  const days = (when.getTime() - NEW_MOON) / 86_400_000
  const phase = (days / SYNODIC_DAYS) % 1
  return phase < 0 ? phase + 1 : phase
}

/** The moon's phase in words. */
export function moonName(phase) {
  const names = [
    'new moon', 'waxing crescent', 'first quarter', 'waxing gibbous',
    'full moon', 'waning gibbous', 'last quarter', 'waning crescent',
  ]
  return names[Math.round(phase * 8) % 8]
}

/**
 * The ranks of magic, and the hours in the past thirty days that earn each.
 * A tag done a little is a Beginner's spell; one that fills the month is a
 * God's.
 */
export const RANKS = [
  { name: 'Beginner', hours: 0 },
  { name: 'Intermediate', hours: 5 },
  { name: 'Advanced', hours: 15 },
  { name: 'Saint', hours: 30 },
  { name: 'King', hours: 60 },
  { name: 'Emperor', hours: 100 },
  { name: 'God', hours: 160 },
]
export const RANK_DAYS = 30

/** A tag's rank from its minutes, with its place in the list and the hours to the next. */
export function rankOf(minutes) {
  let at = 0
  for (let i = 0; i < RANKS.length; i++) if (minutes >= RANKS[i].hours * 60) at = i
  const next = RANKS[at + 1]
  return {
    name: RANKS[at].name,
    index: at,
    toNext: next ? Math.max(0, next.hours - minutes / 60) : 0,
  }
}

const blocksOf = (days, date) => {
  const day = days?.[date]
  return day && !day.malformed ? day.blocks ?? [] : []
}

/** Each tag's minutes over the last thirty days, today included. */
export function monthByTag(days, today, span = RANK_DAYS) {
  const minutes = new Map()
  for (let back = 0; back < span; back++) {
    for (const b of blocksOf(days, shiftDate(today, -back))) {
      minutes.set(b.tag, (minutes.get(b.tag) ?? 0) + (b.endSlot - b.startSlot) * MINUTES_PER_SLOT)
    }
  }
  return minutes
}

/** The tags whose rank went up between two readings, and what they reached. */
export function rankUps(before, after) {
  const ups = []
  for (const [tag, minutes] of after) {
    const was = rankOf(before.get(tag) ?? 0)
    const now = rankOf(minutes)
    if (now.index > was.index) ups.push({ tag, rank: now.name })
  }
  return ups
}

/** Whether every ten minutes of a day has something on it. */
export function isComplete(blocks) {
  const slots = new Set()
  for (const b of blocks ?? []) for (let s = b.startSlot; s < b.endSlot; s++) slots.add(s)
  return slots.size >= SLOTS_PER_DAY
}

/** The days, among those given, that are complete. */
export function completeDays(days) {
  const done = new Set()
  for (const [date, day] of Object.entries(days ?? {})) {
    if (!day.malformed && isComplete(day.blocks)) done.add(date)
  }
  return done
}
