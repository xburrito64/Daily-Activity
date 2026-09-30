import { useEffect, useState } from 'react'
import { useBirthdays, changeBirthdays } from './useBirthdays.js'
import { parseBirthday, formatBirthday, nextBirthday } from './birthdays.js'
import { todayISO } from './time.js'

/**
 * The birthdays, in the settings: a name and a date each, written the way
 * anyone writes one ("03.06.2001", or "09.10" when the year is not known),
 * soonest first. A star marks your own.
 *
 * Like the rest of the settings, nothing waits for a button: a change is
 * kept as soon as you leave the field or press Enter, as long as it reads as
 * a birthday; if it does not, the row says so and keeps what you typed.
 */
export default function BirthdayEditor() {
  const list = useBirthdays()
  const today = todayISO()
  const [drafts, setDrafts] = useState({})
  const [problem, setProblem] = useState('')
  const [adding, setAdding] = useState({ name: '', date: '' })

  // Once saved, a row shows what was saved.
  useEffect(() => { setDrafts({}) }, [list])

  const soonest = [...list].sort((a, b) => (nextBirthday(a, today)?.inDays ?? 0) - (nextBirthday(b, today)?.inDays ?? 0))

  const save = async (next) => {
    setProblem('')
    try {
      await changeBirthdays(next)
      return true
    } catch (err) {
      setProblem(err.message)
      return false
    }
  }

  const draftOf = (b) => drafts[b.id] ?? { name: b.name, date: formatBirthday(b) }
  const edit = (b, field, value) => setDrafts((d) => ({ ...d, [b.id]: { ...draftOf(b), [field]: value } }))

  const commit = (b) => {
    const draft = drafts[b.id]
    if (!draft) return
    const name = draft.name.trim()
    const when = parseBirthday(draft.date)
    if (!name || !when) return
    if (name === b.name && when.day === b.day && when.month === b.month && when.year === b.year) return
    save(list.map((one) => (one.id === b.id ? { ...one, name, ...when } : one)))
  }

  const add = async () => {
    const name = adding.name.trim()
    const when = parseBirthday(adding.date)
    if (!name || !when) return
    if (await save([...list, { name, ...when }])) setAdding({ name: '', date: '' })
  }

  const makeMine = (b) => save(list.map((one) => {
    const { self, ...rest } = one
    return one.id === b.id && !b.self ? { ...rest, self: true } : rest
  }))

  const remove = (b) => save(list.filter((one) => one.id !== b.id))

  const when = (b) => {
    const next = nextBirthday(b, today)
    if (!next) return ''
    const days = next.inDays === 0 ? 'today' : next.inDays === 1 ? 'tomorrow' : `in ${next.inDays} days`
    return next.turns != null ? `${days} · turns ${next.turns}` : days
  }

  const addReady = adding.name.trim() && parseBirthday(adding.date)
  const addBad = adding.date.trim() && !parseBirthday(adding.date)

  return (
    <div className="bdayeditor">
      <p className="settingsnote">
        In Starlit, each one is marked on its day. They stay on this computer, never in your notes.
      </p>
      {problem && <p className="settingsproblem" role="alert">{problem}</p>}

      <ul className="bdaylist">
        {soonest.map((b) => {
          const draft = draftOf(b)
          const bad = draft.date.trim() !== '' && !parseBirthday(draft.date)
          const keys = (e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') { e.stopPropagation(); setDrafts((d) => { const { [b.id]: _, ...rest } = d; return rest }) }
          }
          return (
            <li key={b.id} className={`bdayrow${b.self ? ' mine' : ''}`}>
              <button
                type="button"
                className="bdaystar"
                aria-pressed={Boolean(b.self)}
                title={b.self ? 'This is your birthday' : 'Mark as your own birthday'}
                onClick={() => makeMine(b)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="m8 1.6 1.9 4 4.4.5-3.3 3 .9 4.3L8 11.2l-3.9 2.2.9-4.3-3.3-3 4.4-.5Z" />
                </svg>
              </button>
              <input
                type="text"
                className="bdayname"
                aria-label="Name"
                maxLength={40}
                value={draft.name}
                onChange={(e) => edit(b, 'name', e.target.value)}
                onBlur={() => commit(b)}
                onKeyDown={keys}
              />
              <input
                type="text"
                className={`bdaydate${bad ? ' bad' : ''}`}
                aria-label="Birthday"
                aria-invalid={bad}
                placeholder="dd.mm.yyyy"
                value={draft.date}
                onChange={(e) => edit(b, 'date', e.target.value)}
                onBlur={() => commit(b)}
                onKeyDown={keys}
              />
              <button type="button" className="bdayremove" aria-label={`Remove ${b.name}'s birthday`} onClick={() => remove(b)}>
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
              <span className="bdaywhen">
                {bad ? 'Write it like 24.11 or 24.11.1950' : when(b)}
              </span>
            </li>
          )
        })}
      </ul>

      <form className="bdayadd" onSubmit={(e) => { e.preventDefault(); add() }}>
        <input
          type="text"
          placeholder="Name"
          aria-label="Name of the new birthday"
          maxLength={40}
          value={adding.name}
          onChange={(e) => setAdding((a) => ({ ...a, name: e.target.value }))}
        />
        <input
          type="text"
          className={`bdaydate${addBad ? ' bad' : ''}`}
          placeholder="dd.mm.yyyy"
          aria-label="Their birthday"
          value={adding.date}
          onChange={(e) => setAdding((a) => ({ ...a, date: e.target.value }))}
        />
        <button type="submit" className="settingsbutton" disabled={!addReady}>Add</button>
      </form>
      <p className="settingsnote small">The year can be left out; with it, the age is shown too.</p>
    </div>
  )
}
