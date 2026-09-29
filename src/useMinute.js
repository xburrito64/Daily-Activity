import { useEffect, useState } from 'react'
import { minutesNow, msToNextMinute } from './time.js'

/**
 * The minute it is now, as minutes since midnight, updated as the clock
 * turns over.
 *
 * The first tick is timed to the turn of the minute rather than a minute from
 * now, so whatever reads it moves when the clock does. Used by the few things
 * that follow the time of day, each on its own, so the minute turning over
 * re-renders them and not the whole list.
 */
export function useMinute() {
  const [minute, setMinute] = useState(minutesNow)

  useEffect(() => {
    let interval
    const timeout = setTimeout(() => {
      setMinute(minutesNow())
      interval = setInterval(() => setMinute(minutesNow()), 60_000)
    }, msToNextMinute())
    return () => { clearTimeout(timeout); clearInterval(interval) }
  }, [])

  return minute
}
