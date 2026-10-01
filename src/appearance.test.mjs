// What a saved appearance turns into when it is read back. Anything that
// comes out of storage may be from an older version, or hand-edited, or
// simply wrong, and the app has to draw something sensible regardless.

import assert from 'node:assert/strict'
import { normalise, widthOf, DEFAULTS, BAR_WIDTH, NO_LIMIT } from './appearance.js'

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

console.log('\nappearance')

t('nothing saved is the app as it has always looked', () => {
  assert.deepEqual(normalise(null), DEFAULTS)
  assert.deepEqual(normalise(undefined), DEFAULTS)
  assert.deepEqual(normalise('nonsense'), DEFAULTS)
  assert.equal(DEFAULTS.barWidth, 2400, 'the width it was drawn at before this was a setting')
  assert.equal(DEFAULTS.theme, 'starlit', 'and the theme it was drawn in')
})

t('a good choice is kept exactly', () => {
  const picked = {
    theme: 'tidewater', barWidth: 1650, iconSet: 'Fantasy - Very Simple', chipLook: 'stub', blockLook: 'woven', labels: 'icon', covers: false, hints: false, keepPauses: true,
  }
  assert.deepEqual(normalise(picked), picked)
})

t('a width is kept inside the slider', () => {
  assert.equal(normalise({ barWidth: 10 }).barWidth, BAR_WIDTH.min)
  assert.equal(normalise({ barWidth: 99999 }).barWidth, BAR_WIDTH.max)
  assert.equal(normalise({ barWidth: 'wide' }).barWidth, DEFAULTS.barWidth)
  assert.equal(normalise({ barWidth: 1234.6 }).barWidth, 1235)
})

t('a look or a label style that no longer exists falls back', () => {
  assert.equal(normalise({ chipLook: 'retired-look' }).chipLook, 'classic')
  assert.equal(normalise({ labels: 'sideways' }).labels, 'auto')
  assert.equal(normalise({ blockLook: 'marble' }).blockLook, 'classic')
  assert.equal(normalise({}).blockLook, 'classic', 'the blocks look as they always have until one is picked')
  assert.equal(normalise({ iconSet: 42 }).iconSet, '')
  assert.equal(normalise({ theme: 'vaporwave' }).theme, 'starlit')
})

t('covers and hints are on unless switched off', () => {
  assert.equal(normalise({}).covers, true)
  assert.equal(normalise({}).hints, true)
  assert.equal(normalise({ covers: 'no' }).covers, true, 'only a real false turns one off')
  assert.equal(normalise({ hints: false }).hints, false)
  assert.equal(normalise({}).keepPauses, false, 'the bar is filled unless a gap is asked for')
  assert.equal(normalise({ keepPauses: 'yes' }).keepPauses, false)
})

t('the far end of the slider takes the limit off', () => {
  assert.equal(widthOf(NO_LIMIT), 'none')
  assert.equal(widthOf(2400), '2400px')
  assert.equal(widthOf(BAR_WIDTH.min), `${BAR_WIDTH.min}px`)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
