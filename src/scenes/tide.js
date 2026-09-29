// The arithmetic of Tidewater's depth, apart from the drawing so it can be
// checked on its own.

// How many days below the waterline counts as the bottom. Further than this
// is simply dark. The shallows are shorter: past this many above, the water
// is as bright as it gets.
export const FATHOMS = 45
const SHALLOWEST = -0.6

/**
 * How far below the waterline the screen is, in days: the day at the top of
 * the screen against today. The days to come are below, so they count down;
 * the days behind are above, and count up.
 */
export function daysDown(visible, today) {
  if (!visible?.from) return 0
  const at = (iso) => new Date(`${iso}T12:00:00`).getTime()
  return Math.round((at(visible.from) - at(today)) / 86_400_000)
}

/** What the depth gauge says. */
export function depthWords(days) {
  if (days === 0) return 'at the waterline'
  const n = Math.abs(days)
  return `${n} ${n === 1 ? 'day' : 'days'} ${days > 0 ? 'down' : 'up'}`
}

/** Days below the waterline as a depth: 0 the surface, 1 the bottom, below 0 the shallows. */
export const depthOf = (days) => Math.max(SHALLOWEST, Math.min(1, days / FATHOMS))
