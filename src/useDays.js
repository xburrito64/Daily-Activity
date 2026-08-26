import { useCallback, useRef, useState } from 'react'
import { getRange, putDay } from './api.js'
import { serialise, deserialise } from './blocks.js'

const SAVE_DELAY = 400
// Deep enough to cover a bad few minutes, short enough that it is obviously
// a safety net rather than a record of the session.
const UNDO_DEPTH = 50

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
  // What the days looked like before each of the last few changes, newest
  // last. One entry per change, and a change can touch more than one day —
  // painting across midnight is one thing that happened, so it is one thing
  // to take back.
  const undoStack = useRef([])

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

  /** Put a day's blocks in place and schedule its write. */
  const write = useCallback((date, blocks) => {
    const current = daysRef.current[date]
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

  /**
   * Change some days as one act, remembering what they were first.
   *
   * The changes are applied in order and each sees the one before it, so two
   * changes to the same day in a single call compose rather than fight.
   */
  const editDays = useCallback((changes) => {
    const before = []
    for (const { date, update } of changes) {
      const current = daysRef.current[date]
      if (!current || current.malformed) continue
      const blocks = typeof update === 'function' ? update(current.blocks) : update
      before.push({ date, blocks: current.blocks })
      write(date, blocks)
    }
    if (before.length === 0) return
    undoStack.current.push(before)
    if (undoStack.current.length > UNDO_DEPTH) undoStack.current.shift()
  }, [write])

  /** Change one day, remembering what it was first. */
  const editDay = useCallback((date, update) => editDays([{ date, update }]), [editDays])

  /**
   * Put the last change back. Returns the date it happened on, so the caller
   * can go and look at it, or null if there is nothing left to undo.
   *
   * Undoing does not itself go on the stack: there is no redo, and stacking
   * it would only let undo undo itself.
   */
  const undo = useCallback(() => {
    const last = undoStack.current.pop()
    if (!last) return null
    let landed = null
    for (const { date, blocks } of last) {
      const current = daysRef.current[date]
      // Unloaded since, or turned out to be malformed. Its old blocks are no
      // longer something we can safely write back over it.
      if (!current || current.malformed) continue
      write(date, blocks)
      landed ??= date
    }
    return landed
  }, [write])

  return { days, ensure, editDay, editDays, undo, status, problem }
}

function* eachDate(from, to) {
  const cursor = new Date(`${from}T00:00:00`)
  const last = new Date(`${to}T00:00:00`)
  while (cursor <= last) {
    yield `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`
    cursor.setDate(cursor.getDate() + 1)
  }
}
