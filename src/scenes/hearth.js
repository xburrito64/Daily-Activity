// The arithmetic of Hearthfire, apart from the drawing so it can be checked.
//
// The fire at the foot of the page is fed by logging. It burns as high as
// your log is up to date: logged right up to now and it roars; leave it and
// it burns down, hour by hour, to embers and then to nothing. Logging the
// time you missed throws a log on.

import { shiftDate, MINUTES_PER_SLOT, MINUTES_PER_DAY } from '../time.js'

// How long a fire burns with nothing new on it. Five hours unfed and it is out.
export const COLD_AFTER = 300
// Anything logged this close to now counts as right up to date — nobody logs
// the ten minutes they are still in the middle of.
export const WARM_WITHIN = 20

/**
 * The latest moment the log reaches, in minutes from today's midnight, or
 * null if neither today nor yesterday has anything on it.
 *
 * Yesterday counts, as minutes before midnight, so a log that ran up to
 * 23:50 keeps the fire going into the small hours. Anything logged ahead of
 * now — sleep put in before going to bed — only counts up to now: the fire is
 * fed by what has happened, not by what is planned.
 */
export function fedUntil(days, today, now) {
  let reach = null
  const consider = (date, offset) => {
    for (const b of days?.[date]?.blocks ?? []) {
      const start = b.startSlot * MINUTES_PER_SLOT + offset
      if (start > now) continue
      const end = Math.min(b.endSlot * MINUTES_PER_SLOT + offset, now)
      if (reach === null || end > reach) reach = end
    }
  }
  consider(shiftDate(today, -1), -MINUTES_PER_DAY)
  consider(today, 0)
  return reach
}

/** How the fire is doing: how long it has gone unfed, and how high it burns (0–1). */
export function fireOf(days, today, now) {
  const fed = fedUntil(days, today, now)
  const gap = fed === null ? Infinity : now - fed
  const heat = gap <= WARM_WITHIN ? 1 : Math.max(0, 1 - (gap - WARM_WITHIN) / (COLD_AFTER - WARM_WITHIN))
  let state = 'cold'
  if (gap <= 30) state = 'roaring'
  else if (gap <= 120) state = 'burning'
  else if (gap <= 210) state = 'low'
  else if (gap < COLD_AFTER) state = 'embers'
  return { fed, gap, heat, state }
}

const clock = (minutes) => {
  const m = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
const since = (fed) => (fed === 0 ? 'midnight' : fed < 0 ? `${clock(fed)} yesterday` : clock(fed))

/** What the hearth says about itself, as a state and a line of detail. */
export function fireWords(fire) {
  if (!fire) return { state: '', detail: '' }
  switch (fire.state) {
    case 'roaring': return { state: 'roaring', detail: 'fed right up to now' }
    case 'burning': return { state: 'burning well', detail: `fed until ${since(fire.fed)}` }
    case 'low': return { state: 'burning low', detail: `nothing since ${since(fire.fed)}` }
    case 'embers': return { state: 'down to embers', detail: `nothing since ${since(fire.fed)}` }
    default:
      return fire.fed === null
        ? { state: 'gone cold', detail: 'nothing kindled today' }
        : { state: 'gone cold', detail: `nothing since ${since(fire.fed)}` }
  }
}
