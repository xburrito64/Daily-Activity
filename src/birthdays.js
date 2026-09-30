// Birthdays: reading one as it is written ("03.06.2001", or "09.10" when the
// year is not known), and which of them fall on a day, with the age turned.
//
// The list itself lives beside the tags on this machine (server/birthdays.js),
// never in a note, and is changed in the settings.

const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const leap = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** Whether a day and month (and year, if known) make a date there has been. */
export function isBirthDate(day, month, year = null) {
  if (!Number.isInteger(day) || !Number.isInteger(month)) return false
  if (month < 1 || month > 12 || day < 1 || day > DAYS_IN[month - 1]) return false
  if (year != null) {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) return false
    if (month === 2 && day === 29 && !leap(year)) return false
  }
  return true
}

/**
 * A birthday as someone would write it: day and month, then the year if it
 * is known — "03.06.2001", "3.6.2001", "09.10", "09.10.", also with slashes
 * or dashes. { day, month, year } with year null, or null if it is not one.
 */
export function parseBirthday(text) {
  const m = String(text ?? '').trim().match(/^(\d{1,2})[./-](\d{1,2})(?:[./-](\d{4})?)?\.?$/)
  if (!m) return null
  const day = Number(m[1])
  const month = Number(m[2])
  const year = m[3] ? Number(m[3]) : null
  return isBirthDate(day, month, year) ? { day, month, year } : null
}

/** A birthday written back the way it is typed: "03.06.2001", or "09.10.". */
export function formatBirthday({ day, month, year }) {
  const dm = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.`
  return year ? `${dm}${year}` : dm
}

/**
 * The day a birthday falls on in a given year. The 29th of February is kept
 * on the 28th in the years without one.
 */
export function birthdayIn(b, year) {
  const day = b.month === 2 && b.day === 29 && !leap(year) ? 28 : b.day
  return { month: b.month, day }
}

/** "Ada's birthday", or "Your birthday" for your own. */
const birthdayName = (b) => (b.self ? 'Your birthday' : `${b.name}'s birthday`)

/**
 * The birthdays falling on this date (YYYY-MM-DD), each as a festival: its
 * name, whose it is, the age turned that day if the year is known, and
 * whether it is your own. Your own comes first.
 */
export function birthdaysOn(date, list) {
  const m = String(date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m || !Array.isArray(list) || list.length === 0) return []
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  return list
    .filter((b) => {
      const at = birthdayIn(b, year)
      return at.month === month && at.day === day && (b.year == null || b.year < year)
    })
    .sort((a, b) => Number(Boolean(b.self)) - Number(Boolean(a.self)))
    .map((b) => ({
      id: 'birthday',
      key: `birthday-${b.id}`,
      name: birthdayName(b),
      person: b.name,
      self: Boolean(b.self),
      age: b.year == null ? null : year - b.year,
      eyebrow: b.self ? 'Your day' : 'A birthday',
    }))
}

/**
 * How long until a birthday comes round again from `today` (YYYY-MM-DD):
 * { inDays, turns }, turns null when the year is not known. Today itself
 * is 0.
 */
export function nextBirthday(b, today) {
  const [y, mo, d] = today.split('-').map(Number)
  const from = Date.UTC(y, mo - 1, d)
  for (const year of [y, y + 1]) {
    const at = birthdayIn(b, year)
    const when = Date.UTC(year, at.month - 1, at.day)
    if (when >= from) {
      return { inDays: Math.round((when - from) / 86400000), turns: b.year == null ? null : year - b.year }
    }
  }
  return null
}
