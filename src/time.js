export const MINUTES_PER_SLOT = 15
export const SLOTS_PER_DAY = (24 * 60) / MINUTES_PER_SLOT // 96

/** Slot boundary index (0..96) -> "HH:MM". Slot 96 is "24:00". */
export function slotToTime(slot) {
  const total = slot * MINUTES_PER_SLOT
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "HH:MM" -> slot boundary index. */
export function timeToSlot(text) {
  const [h, m] = text.split(':').map(Number)
  return (h * 60 + m) / MINUTES_PER_SLOT
}

/** Slot span -> "7h 15m" / "45m" / "8h". */
export function formatDuration(slots) {
  const total = slots * MINUTES_PER_SLOT
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatDateLong(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

/** Move an ISO date by whole days, staying in local time. */
export function shiftDate(iso, days) {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/** Whole days from one ISO date to another (b - a). */
export function daysBetween(a, b) {
  const da = new Date(`${a}T00:00:00`)
  const db = new Date(`${b}T00:00:00`)
  return Math.round((db - da) / 86400000)
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** "11. August 2026" — the heading above a day in the Day view. */
export function formatDayHeading(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}. ${MONTHS[m - 1]} ${y}`
}

/** "13.09" — the compact date in the Overview gutter. */
export function formatShortDate(iso) {
  const [, m, d] = iso.split('-')
  return `${d}.${m}`
}

export function weekdayOf(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

/** 0 = Sunday. */
export function dayOfWeek(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}
