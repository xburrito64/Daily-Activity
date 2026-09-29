// Where Tidewater puts you, and what it says about it.

import assert from 'node:assert/strict'
import { daysDown, depthWords, depthOf, FATHOMS } from './tide.js'
import { wordsFor } from '../themeWords.js'

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

console.log('\ntide')

t('today at the top of the screen is the waterline', () => {
  assert.equal(daysDown({ from: '2026-09-29', to: '2026-10-03' }, '2026-09-29'), 0)
})

t('the days to come are below it, the days behind above', () => {
  // The list runs the way the page does: scrolling down is diving.
  assert.equal(daysDown({ from: '2026-11-08', to: '2026-11-10' }, '2026-09-29'), 40)
  assert.equal(daysDown({ from: '2026-08-26', to: '2026-08-28' }, '2026-09-29'), -34)
})

t('a clock change in between does not make a day of it', () => {
  // 25 October is the day the clocks go back in Europe.
  assert.equal(daysDown({ from: '2026-10-26' }, '2026-10-24'), 2)
})

t('nothing on screen yet is the surface', () => {
  assert.equal(daysDown(null, '2026-09-29'), 0)
  assert.equal(daysDown({}, '2026-09-29'), 0)
})

t('the gauge says it plainly', () => {
  assert.equal(depthWords(0), 'at the waterline')
  assert.equal(depthWords(1), '1 day down')
  assert.equal(depthWords(40), '40 days down')
  assert.equal(depthWords(-1), '1 day up')
  assert.equal(depthWords(-34), '34 days up')
})

t('depth runs from the shallows to a bottom, and no further', () => {
  assert.equal(depthOf(0), 0)
  assert.equal(depthOf(FATHOMS), 1)
  assert.equal(depthOf(FATHOMS * 10), 1)
  assert.equal(depthOf(-1000), -0.6)
})

t('a theme with its own words says them, and borrows the rest', () => {
  assert.equal(wordsFor('tidewater').recorded(38), '38 days charted')
  assert.equal(wordsFor('tidewater').recorded(1), 'one day charted')
  assert.equal(wordsFor('tidewater').wipe, 'Wash away')
  assert.equal(wordsFor('nightshift').recorded(38), '38 days on disk')
  assert.equal(wordsFor('scriptorium').recorded(38), '38 leaves inscribed')
  assert.equal(wordsFor('starlit').recorded(38), '38 days recorded')
  assert.equal(wordsFor('nonsense').emptyDay, 'nothing has happened here yet')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
