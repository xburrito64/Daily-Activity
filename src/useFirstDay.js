import { useEffect, useState } from 'react'
import { getFirstDay } from './api.js'

// The first day anything was logged, asked for once however many things
// want it: the list, for the anniversary of it on its row each year, and the
// sky, for the night itself.
let asked = null

/** The first day anything was logged (YYYY-MM-DD), or null until known. */
export function useFirstDay() {
  const [first, setFirst] = useState(null)
  useEffect(() => {
    let live = true
    asked ??= getFirstDay().then((r) => r.date ?? null).catch(() => { asked = null; return null })
    asked.then((date) => { if (live) setFirst(date) })
    return () => { live = false }
  }, [])
  return first
}
