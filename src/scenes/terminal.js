// The arithmetic of Nightshift, apart from the drawing so it can be checked.
//
// Nightshift reads your days the way a terminal reads a machine. Across the
// top, a system monitor: what has been taking your time this week as meters,
// how many days running you have logged as the uptime, and how many hours a
// day get logged as the load average. Along the bottom, a status line: what
// is running now, where in the day you are, and which mode the app is in.

import { shiftDate, MINUTES_PER_SLOT, SLOTS_PER_DAY } from '../time.js'

const blocksOf = (days, date) => {
  const day = days?.[date]
  return day && !day.malformed ? day.blocks ?? [] : []
}

/** Minutes of a day with anything on it, counting overlaps once. */
export function loggedMinutes(blocks) {
  const covered = new Set()
  for (const b of blocks) for (let s = b.startSlot; s < b.endSlot; s++) covered.add(s)
  return covered.size * MINUTES_PER_SLOT
}

/**
 * Days running with something logged, up to today. A today with nothing on
 * it yet doesn't end the run — the day isn't over — it just isn't counted.
 */
export function uptime(days, today) {
  let date = blocksOf(days, today).length > 0 ? today : shiftDate(today, -1)
  let run = 0
  while (blocksOf(days, date).length > 0) {
    run++
    date = shiftDate(date, -1)
  }
  return run
}

/**
 * Hours logged a day, the way a machine gives its load: over the last day,
 * the last week and the last month. Today is still going, so it is left out
 * of all three — the first is yesterday.
 */
export function loadAverage(days, today) {
  const over = (count) => {
    let minutes = 0
    for (let back = 1; back <= count; back++) minutes += loggedMinutes(blocksOf(days, shiftDate(today, -back)))
    return minutes / 60 / count
  }
  return [over(1), over(7), over(30)]
}

/**
 * What has been taking your time over the last week, today included: each
 * tag's minutes and its share of everything logged, biggest first.
 */
export function topTags(days, today, count = 4, span = 7) {
  const minutes = new Map()
  for (let back = 0; back < span; back++) {
    for (const b of blocksOf(days, shiftDate(today, -back))) {
      minutes.set(b.tag, (minutes.get(b.tag) ?? 0) + (b.endSlot - b.startSlot) * MINUTES_PER_SLOT)
    }
  }
  const total = [...minutes.values()].reduce((a, m) => a + m, 0)
  return [...minutes]
    .map(([tag, m]) => ({ tag, minutes: m, share: total ? m / total : 0 }))
    .sort((a, b) => b.minutes - a.minutes || (a.tag < b.tag ? -1 : 1))
    .slice(0, count)
}

/**
 * What is running now: the block under the time it is, the latest-started
 * if there are several. Failing that, when the last thing logged today
 * stopped — the machine has been idle since.
 */
export function runningNow(days, today, now) {
  const blocks = blocksOf(days, today)
  const slot = now / MINUTES_PER_SLOT
  const running = blocks
    .filter((b) => b.startSlot <= slot && slot < b.endSlot)
    .sort((a, b) => b.startSlot - a.startSlot)[0]
  if (running) return { state: 'running', tag: running.tag, since: running.startSlot * MINUTES_PER_SLOT }
  const ended = blocks.filter((b) => b.endSlot <= slot).map((b) => b.endSlot * MINUTES_PER_SLOT)
  if (ended.length) return { state: 'idle', since: Math.max(...ended) }
  return { state: 'idle', since: null }
}

/** An htop meter: bars for the share, padded to its width. */
export function meter(share, width) {
  const bars = Math.max(0, Math.min(width, Math.round(share * width)))
  return '|'.repeat(bars) + ' '.repeat(width - bars)
}

/** Which ten minutes of the day it is, counting from one, and of how many. */
export const slotOfDay = (now) => ({ slot: Math.floor(now / MINUTES_PER_SLOT) + 1, of: SLOTS_PER_DAY })

/** "05:07", from minutes since midnight. */
export const hhmm = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(Math.round(minutes) % 60).padStart(2, '0')}`

/** "3h 40m", "40m", "0m". */
export function span(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** Which mode the status line shows, from what the app is doing. */
export function modeOf({ settings, find, armedTag, note }) {
  if (settings) return { mode: 'CONFIG', detail: '' }
  if (find) return { mode: 'FIND', detail: '' }
  if (armedTag) return { mode: 'PAINT', detail: armedTag }
  if (note) return { mode: 'NOTE', detail: note }
  return { mode: 'NORMAL', detail: '' }
}
