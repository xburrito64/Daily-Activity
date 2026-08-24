import { useCallback, useRef, useState } from 'react'
import { getRange, putDay } from './api.js'
import { serialise, deserialise } from './blocks.js'

const SAVE_DELAY = 400

/**
 * Every day the scroller has asked for, keyed by date. Days are fetched in
 * whole ranges as you scroll and written back one at a time.
 */
export function useDays() {
  const [days, setDays] = useState({})
  const [status, setStatus] = useState('idle') // idle | loading | saving | saved | error
  const [problem, setProblem] = useState(null)

  const daysRef = useRef(days)
  daysRef.current = days

  const loaded = useRef(new Set())
  const timers = useRef({})

  /** Load any day in from..to we don't already have. */
  const ensure = useCallback(async (from, to) => {
    const missing = []
    for (const date of eachDate(from, to)) {
      if (!loaded.current.has(date)) missing.push(date)
    }
    if (missing.length === 0) return

    // One request covering the gap, rather than one per day.
    missing.forEach((d) => loaded.current.add(d))
    setStatus((s) => (s === 'saving' ? s : 'loading'))

    try {
      const list = await getRange(missing[0], missing[missing.length - 1])
      setDays((prev) => {
        const next = { ...prev }
        for (const day of list) {
          // Never let a background load stomp on edits already in flight.
          if (next[day.date]) continue
          next[day.date] = {
            blocks: deserialise(day.entries),
            malformed: !!day.malformed,
            reason: day.reason,
          }
        }
        return next
      })
      setStatus((s) => (s === 'loading' ? 'idle' : s))
    } catch (err) {
      missing.forEach((d) => loaded.current.delete(d))
      setStatus('error')
      setProblem({ kind: 'offline', message: `Can't reach the server — is it running? (${err.message})` })
    }
  }, [])

  /** Change one day and schedule its write. */
  const editDay = useCallback((date, update) => {
    const current = daysRef.current[date]
    if (!current || current.malformed) return

    const blocks = typeof update === 'function' ? update(current.blocks) : update
    const merged = { ...daysRef.current, [date]: { ...current, blocks } }
    daysRef.current = merged
    setDays(merged)

    clearTimeout(timers.current[date])
    setStatus('saving')
    timers.current[date] = setTimeout(() => {
      putDay(date, serialise(blocks))
        .then(() => setStatus((s) => (s === 'saving' ? 'saved' : s)))
        .catch((err) => {
          setStatus('error')
          setProblem({ kind: 'save', message: `${date} not saved: ${err.message}` })
        })
    }, SAVE_DELAY)
  }, [])

  return { days, ensure, editDay, status, problem }
}

function* eachDate(from, to) {
  const cursor = new Date(`${from}T00:00:00`)
  const last = new Date(`${to}T00:00:00`)
  while (cursor <= last) {
    yield `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    cursor.setDate(cursor.getDate() + 1)
  }
}
