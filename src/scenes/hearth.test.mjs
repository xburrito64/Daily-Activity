// Hearthfire's fire: how far the log reaches, and how high that makes it burn.

import assert from 'node:assert/strict'
import { fedUntil, fireOf, fireWords, COLD_AFTER } from './hearth.js'

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

const block = (startSlot, endSlot) => ({ startSlot, endSlot })
const TODAY = '2026-09-29'
const YESTERDAY = '2026-09-28'
const at = (h, m = 0) => h * 60 + m

console.log('\nhearth')

t('the fire is fed as far as the latest thing logged today', () => {
  const days = { [TODAY]: { blocks: [block(48, 54), block(60, 66)] } } // 08:00–09:00, 10:00–11:00
  assert.equal(fedUntil(days, TODAY, at(14)), at(11))
})

t('something logged ahead of now only counts up to now', () => {
  const days = { [TODAY]: { blocks: [block(60, 90)] } } // 10:00–15:00
  assert.equal(fedUntil(days, TODAY, at(12, 7)), at(12, 7))
})

t('something that has not started yet does not feed it at all', () => {
  const days = { [TODAY]: { blocks: [block(48, 54), block(120, 132)] } } // 08:00–09:00, 20:00–22:00
  assert.equal(fedUntil(days, TODAY, at(14)), at(9))
})

t('last night keeps it going into the small hours', () => {
  const days = { [YESTERDAY]: { blocks: [block(130, 143)] } } // …23:50
  assert.equal(fedUntil(days, TODAY, at(0, 5)), -10)
  assert.equal(fireOf(days, TODAY, at(0, 5)).state, 'roaring')
})

t('nothing today or yesterday: no fire at all', () => {
  assert.equal(fedUntil({}, TODAY, at(9)), null)
  const fire = fireOf({}, TODAY, at(9))
  assert.equal(fire.heat, 0)
  assert.equal(fire.state, 'cold')
})

t('it burns down the longer it goes unfed, and goes out', () => {
  const fed = { [TODAY]: { blocks: [block(0, 60)] } } // up to 10:00
  const heats = [10, 10.5, 12, 14, 18].map((h) => fireOf(fed, TODAY, at(h, (h % 1) * 60)).heat)
  assert.equal(heats[0], 1)
  for (let i = 1; i < heats.length; i++) assert.ok(heats[i] <= heats[i - 1], `${heats}`)
  assert.equal(fireOf(fed, TODAY, at(10) + COLD_AFTER).heat, 0)
  assert.deepEqual(
    [10.25, 11.5, 13, 14.5, 16].map((h) => fireOf(fed, TODAY, at(h)).state),
    ['roaring', 'burning', 'low', 'embers', 'cold'],
  )
})

t('a broken day feeds nothing and breaks nothing', () => {
  const days = { [TODAY]: { malformed: true, blocks: [] } }
  assert.equal(fedUntil(days, TODAY, at(12)), null)
})

t('the hearth says how it is doing in words', () => {
  const days = { [TODAY]: { blocks: [block(0, 87)] } } // up to 14:30
  assert.deepEqual(fireWords(fireOf(days, TODAY, at(14, 40))), { state: 'roaring', detail: 'fed right up to now' })
  assert.deepEqual(fireWords(fireOf(days, TODAY, at(15, 30))), { state: 'burning well', detail: 'fed until 14:30' })
  assert.deepEqual(fireWords(fireOf(days, TODAY, at(17, 30))), { state: 'burning low', detail: 'nothing since 14:30' })
  assert.deepEqual(fireWords(fireOf({}, TODAY, at(9))), { state: 'gone cold', detail: 'nothing kindled today' })
  const toMidnight = { [YESTERDAY]: { blocks: [block(120, 144)] } } // …24:00
  assert.deepEqual(fireWords(fireOf(toMidnight, TODAY, at(4))), { state: 'down to embers', detail: 'nothing since midnight' })
  const late = { [YESTERDAY]: { blocks: [block(120, 138)] } } // …23:00
  assert.deepEqual(fireWords(fireOf(late, TODAY, at(1))), { state: 'burning well', detail: 'fed until 23:00 yesterday' })
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
