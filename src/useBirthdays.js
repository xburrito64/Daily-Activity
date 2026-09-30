import { useEffect, useState } from 'react'
import { getBirthdays, saveBirthdays } from './api.js'

// The birthdays, asked for once and shared by everything that shows them:
// the list (for each birthday's row), the sky (for the day itself) and the
// settings (where they are changed). A change saved in the settings reaches
// all of them at once.
let list = []
let asked = null
const listeners = new Set()
const tell = () => { for (const fn of listeners) fn(list) }

/** The birthdays, [] until they have been read. */
export function useBirthdays() {
  const [now, setNow] = useState(list)
  useEffect(() => {
    listeners.add(setNow)
    asked ??= getBirthdays()
      .then((got) => { list = Array.isArray(got) ? got : []; tell() })
      .catch(() => { asked = null })
    setNow(list)
    return () => { listeners.delete(setNow) }
  }, [])
  return now
}

/** Save a changed list; everything showing birthdays follows. */
export async function changeBirthdays(next) {
  list = await saveBirthdays(next)
  tell()
  return list
}
