// Nightshift's readouts: uptime, load, the top of the week, what is running.

import assert from 'node:assert/strict'
import {
  loggedMinutes, uptime, loadAverage, topTags, runningNow, meter, slotOfDay, hhmm, span, modeOf,
} from './terminal.js'

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
const TODAY = '2026-09-29'
const day = (...blocks) => ({ blocks })

console.log('\nterminal')

t('logged time counts overlaps once', () => {
  assert.equal(loggedMinutes([block('a', 0, 6), block('b', 3, 9)]), 90)
})

t('uptime is the run of logged days up to today', () => {
  const days = {
    '2026-09-29': day(block('a', 0, 1)),
    '2026-09-28': day(block('a', 0, 1)),
    '2026-09-27': day(block('a', 0, 1)),
    '2026-09-25': day(block('a', 0, 1)),
  }
  assert.equal(uptime(days, TODAY), 3)
})

t('an empty today does not break the run, it just is not counted yet', () => {
  const days = { '2026-09-28': day(block('a', 0, 1)), '2026-09-27': day(block('a', 0, 1)) }
  assert.equal(uptime(days, TODAY), 2)
  assert.equal(uptime({}, TODAY), 0)
})

t('a broken day is not a logged day', () => {
  const days = { '2026-09-28': { malformed: true, blocks: [block('a', 0, 1)] } }
  assert.equal(uptime(days, TODAY), 0)
})

t('load average is hours a day over one, seven and thirty days, today left out', () => {
  const days = {
    '2026-09-29': day(block('a', 0, 144)), // today: ignored
    '2026-09-28': day(block('a', 0, 60)), // 10h
    '2026-09-27': day(block('a', 0, 24)), // 4h
  }
  const [one, seven, thirty] = loadAverage(days, TODAY)
  assert.equal(one, 10)
  assert.equal(seven, 2)
  assert.ok(Math.abs(thirty - 14 / 30) < 1e-9)
})

t('the top of the week is by time, biggest first, with shares', () => {
  const days = {
    '2026-09-29': day(block('game', 0, 12)),
    '2026-09-27': day(block('sleep', 0, 42), block('game', 50, 56)),
    '2026-09-10': day(block('walk', 0, 100)), // outside the week
  }
  const top = topTags(days, TODAY)
  assert.deepEqual(top.map((x) => x.tag), ['sleep', 'game'])
  assert.equal(top[0].minutes, 420)
  assert.ok(Math.abs(top[0].share - 420 / 600) < 1e-9)
  assert.equal(topTags({}, TODAY).length, 0)
})

t('running now is the block under the time, else idle since the last one ended', () => {
  const days = { [TODAY]: day(block('sleep', 0, 42), block('music', 30, 36), block('game', 48, 54)) }
  assert.deepEqual(runningNow(days, TODAY, 5 * 60 + 10), { state: 'running', tag: 'music', since: 300 })
  assert.deepEqual(runningNow(days, TODAY, 7 * 60 + 30), { state: 'idle', since: 420 })
  assert.deepEqual(runningNow(days, TODAY, 9 * 60 + 30), { state: 'idle', since: 540 })
  assert.deepEqual(runningNow({}, TODAY, 60), { state: 'idle', since: null })
})

t('meters, clocks and spans read the way a terminal writes them', () => {
  assert.equal(meter(0.5, 10), '|||||     ')
  assert.equal(meter(1.4, 4), '||||')
  assert.equal(meter(0, 3), '   ')
  assert.deepEqual(slotOfDay(0), { slot: 1, of: 144 })
  assert.deepEqual(slotOfDay(5 * 60 + 7), { slot: 31, of: 144 })
  assert.equal(hhmm(307), '05:07')
  assert.equal(span(220), '3h 40m')
  assert.equal(span(40), '40m')
})

t('the mode says what the app is in the middle of', () => {
  assert.deepEqual(modeOf({}), { mode: 'NORMAL', detail: '' })
  assert.deepEqual(modeOf({ armedTag: 'Game' }), { mode: 'PAINT', detail: 'Game' })
  assert.deepEqual(modeOf({ armedTag: 'Game', find: true }), { mode: 'FIND', detail: '' })
  assert.deepEqual(modeOf({ note: 'Sleep', settings: true }), { mode: 'CONFIG', detail: '' })
  assert.deepEqual(modeOf({ note: 'Sleep' }), { mode: 'NOTE', detail: 'Sleep' })
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
