// Black Hours' book: the hours, the initials, the chronicle, the ivy border.

import assert from 'node:assert/strict'
import {
  hourOf, illumination, chronicle, chronicleWords, duration, keptUp, ivy, GILDED_FROM,
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

t('the border is gilded as far as today has been kept up with', () => {
  // Nine in the morning: nine hours gone by.
  assert.equal(keptUp([], 9 * 60), 0)
  assert.equal(keptUp([block('sleep', 0, 54)], 9 * 60), 1, 'all nine written')
  assert.equal(keptUp([block('sleep', 0, 27)], 9 * 60), 0.5, 'half of them')
  // Overlaps count once, and what lies ahead of now does not count yet.
  assert.equal(keptUp([block('sleep', 0, 27), block('music', 0, 27), block('game', 60, 90)], 9 * 60), 0.5)
  // Five past midnight is measured against a whole hour, not five minutes.
  assert.ok(keptUp([block('sleep', 0, 1)], 5) < 0.2)
})

t('the ivy grows the same every time, and stays inside its box', () => {
  const a = ivy(640, 96, 7)
  const b = ivy(640, 96, 7)
  assert.deepEqual(a, b, 'the same seed, the same border')
  assert.notDeepEqual(ivy(640, 96, 8).leaves, a.leaves, 'another seed, another border')
  assert.ok(a.leaves.length > 20, 'leafy enough to be a border')
  for (const p of [...a.leaves, ...a.flowers, ...a.bezants]) {
    assert.ok(p.x >= 0 && p.x <= 640 && p.y >= 0 && p.y <= 96, `in the box: ${p.x}, ${p.y}`)
    assert.ok(p.rank >= 0 && p.rank < 1)
  }
  for (const line of a.stems) for (const [x, y] of line) assert.ok(x >= 0 && x <= 640 && y >= 0 && y <= 96)
})

t('half kept up is about half the leaves gilded', () => {
  const { leaves } = ivy(900, 110, 3)
  const gilded = leaves.filter((l) => l.rank < 0.5).length / leaves.length
  assert.ok(gilded > 0.3 && gilded < 0.7, `${gilded}`)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
