// Scriptorium's book: the hours, the initials, the chronicle, the sun.

import assert from 'node:assert/strict'
import {
  hourOf, illumination, chronicle, chronicleWords, duration, sunOf, GILDED_FROM,
} from './manuscript.js'

let passed = 0
let failed = 0
const t = (name, fn) => {
  try {
    fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (err) {
    failed++
    console.log(`  FAIL ${name}\n       ${err.message}`)
  }
}

const block = (tag, startSlot, endSlot) => ({ tag, startSlot, endSlot })
const names = { sleep: 'Sleep', game: 'Game', music: 'Music', walk: 'Walk', read: 'Reading' }
const nameOf = (id) => names[id] ?? id
const words = (parts) => parts.map((p) => p.text).join('')

console.log('\nmanuscript')

t('the canonical hours keep the day', () => {
  assert.equal(hourOf(0), 'Matins')
  assert.equal(hourOf(2 * 60 + 59), 'Matins')
  assert.equal(hourOf(6 * 60), 'Prime')
  assert.equal(hourOf(13 * 60), 'Sext')
  assert.equal(hourOf(23 * 60 + 59), 'Compline')
})

t('a day with nothing written is a sketch waiting for its colours', () => {
  assert.deepEqual(illumination([]), { level: 'sketch', grounds: [] })
  assert.deepEqual(illumination(undefined), { level: 'sketch', grounds: [] })
})

t('a day with something is painted in what filled it most, up to four', () => {
  const day = [block('sleep', 0, 42), block('game', 42, 60), block('music', 42, 50), block('walk', 60, 62), block('read', 62, 63)]
  const lit = illumination(day)
  assert.equal(lit.level, 'painted')
  assert.deepEqual(lit.grounds, ['sleep', 'game', 'music', 'walk'])
})

t('a day nearly all accounted for is gilded', () => {
  const slots = GILDED_FROM / 10
  assert.equal(illumination([block('sleep', 0, slots)]).level, 'gilded')
  assert.equal(illumination([block('sleep', 0, slots - 1)]).level, 'painted')
  // Two things at once is still one stretch of the day.
  assert.equal(illumination([block('a', 0, slots - 1), block('b', 0, slots - 1)]).level, 'painted')
})

t('the chronicle says what a past day was given to, and what was left blank', () => {
  const day = [block('sleep', 0, 42), block('game', 60, 78), block('music', 60, 70)]
  const c = chronicle(day)
  assert.deepEqual(c.given.map((g) => g.tag), ['sleep', 'game', 'music'])
  assert.equal(c.blank, 24 * 60 - 420 - 180)
  assert.equal(words(chronicleWords(c, nameOf)), 'Given to Sleep 7h, Game 3h and Music 1h 40m; 14h left blank.')
})

t('beyond three it counts the rest, and a full day has nothing blank', () => {
  const day = [block('sleep', 0, 100), block('game', 100, 130), block('music', 130, 140), block('walk', 140, 143), block('read', 143, 144)]
  assert.equal(
    words(chronicleWords(chronicle(day), nameOf)),
    'Given to Sleep 16h 40m, Game 5h, Music 1h 40m, and 2 more.',
  )
})

t('today only counts as blank the part already gone by', () => {
  const day = [block('sleep', 0, 36)] // up to 06:00
  const c = chronicle(day, { now: 8 * 60 + 5 })
  assert.equal(c.blank, 120)
  assert.equal(words(chronicleWords(c, nameOf)), 'So far given to Sleep 6h; 2h left blank.')
})

t('the tag names are kept apart, to be written in red', () => {
  const parts = chronicleWords(chronicle([block('game', 0, 6)]), nameOf)
  assert.deepEqual(parts.filter((p) => p.tag).map((p) => p.tag), ['game'])
  assert.deepEqual(chronicleWords(chronicle([]), nameOf), [])
})

t('durations read as a person would say them', () => {
  assert.equal(duration(440), '7h 20m')
  assert.equal(duration(180), '3h')
  assert.equal(duration(40), '40m')
})

t('the sun rises on the left, stands highest at one, and sets on the right', () => {
  assert.deepEqual(sunOf(3 * 60), { day: 0, from: -1 })
  assert.deepEqual(sunOf(22 * 60), { day: 0, from: 1 })
  const noon = sunOf(13 * 60)
  assert.ok(Math.abs(noon.day - 1) < 1e-9 && Math.abs(noon.from) < 1e-9)
  assert.ok(sunOf(8 * 60).from < 0 && sunOf(18 * 60).from > 0)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
