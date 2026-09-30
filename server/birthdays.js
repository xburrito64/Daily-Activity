// The birthdays list, changed from the settings.
//
// A file beside the tags on this machine, never in a note and never sent
// anywhere: a birthday is a name, a day, a month and, when it is known, a
// year, and one of them may be marked as your own. Nothing here can reach
// the vault.

const refused = (message) => Object.assign(new Error(message), { status: 400 })

const MAX_BIRTHDAYS = 200
const NAME_CHARS = 40
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const ID_RE = /^[a-z0-9-]{1,40}$/

const leap = (year) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** An id for a new birthday, not one already in the list. */
function freshId(taken) {
  for (;;) {
    const id = `b-${Math.random().toString(36).slice(2, 10)}`
    if (!taken.has(id)) return id
  }
}

/**
 * A birthday list fit to write, from one sent by the app: only the fields a
 * birthday is made of, each checked, in the order given. A birthday without
 * an id is new and is given one. At most one can be your own; if more are
 * marked, the first keeps it.
 */
export function cleanBirthdays(list) {
  if (!Array.isArray(list)) throw refused('the birthday list is not a list')
  if (list.length > MAX_BIRTHDAYS) throw refused(`at most ${MAX_BIRTHDAYS} birthdays`)
  const taken = new Set(list.map((b) => String(b?.id ?? '')).filter((id) => ID_RE.test(id)))
  const seen = new Set()
  let mine = false
  return list.map((b, i) => {
    const name = String(b?.name ?? '').trim().replace(/\s+/g, ' ')
    if (!name) throw refused(`birthday ${i + 1} has no name`)
    if (name.length > NAME_CHARS) throw refused(`${name.slice(0, 20)}… is longer than ${NAME_CHARS} letters`)
    const day = Number(b?.day)
    const month = Number(b?.month)
    const year = b?.year == null || b.year === '' ? null : Number(b.year)
    if (!Number.isInteger(month) || month < 1 || month > 12
      || !Number.isInteger(day) || day < 1 || day > DAYS_IN[month - 1]) {
      throw refused(`${name}'s birthday is not a day of the year`)
    }
    if (year != null && (!Number.isInteger(year) || year < 1900 || year > 2100
      || (month === 2 && day === 29 && !leap(year)))) {
      throw refused(`${name}'s birthday is not a date there has been`)
    }
    let id = String(b?.id ?? '')
    if (!ID_RE.test(id) || seen.has(id)) id = freshId(taken)
    taken.add(id)
    seen.add(id)
    const self = Boolean(b?.self) && !mine
    if (self) mine = true
    return self ? { id, name, day, month, year, self } : { id, name, day, month, year }
  })
}

/** The list as written to its file: one birthday a line, so it reads by hand. */
export function birthdaysText(list) {
  return `[\n${list.map((b) => `  ${JSON.stringify(b)}`).join(',\n')}\n]\n`
}
