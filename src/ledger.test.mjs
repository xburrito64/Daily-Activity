// The ledger's arithmetic: which days a choice covers, stepping through them,
// and what it adds up. Made-up days only.

import assert from 'node:assert/strict'
import {
  normalisePeriod, periodOf, stepPeriod, previousOf, ledgerOf, coveredSlots, weeksOf, datesIn,
} from './ledger.js'

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

console.log('\nledger')

const TODAY = '2026-10-14'
const b = (tag, startSlot, endSlot, more = {}) => ({ id: `${tag}${startSlot}`, tag, startSlot, endSlot, ...more })
const day = (...blocks) => ({ blocks, malformed: false })

t('nothing saved is the last thirty days', () => {
  const choice = normalisePeriod(null, TODAY)
  assert.equal(choice.kind, 'last30')
  const p = periodOf(choice, TODAY)
  assert.deepEqual([p.from, p.to], ['2026-09-15', TODAY], 'thirty days, today the last of them')
  assert.equal(datesIn(p.from, p.to).length, 30)
  assert.equal(p.steps, false)
})

t('a month is the whole month, a year the whole year', () => {
  const month = periodOf({ kind: 'month', at: '2026-02-10' }, TODAY)
  assert.deepEqual([month.from, month.to, month.title], ['2026-02-01', '2026-02-28', 'February 2026'])
  assert.equal(periodOf({ kind: 'month', at: '2028-02-03' }, TODAY).to, '2028-02-29', 'a leap year')
  const year = periodOf({ kind: 'year', at: '2026-06-01' }, TODAY)
  assert.deepEqual([year.from, year.to, year.title], ['2026-01-01', '2026-12-31', '2026'])
})

t('stepping moves a month, a year, or a range by its own length', () => {
  assert.equal(stepPeriod({ kind: 'month', at: '2026-01-20' }, -1).at, '2025-12-01')
  assert.equal(stepPeriod({ kind: 'month', at: '2026-12-05' }, 1).at, '2027-01-01')
  assert.equal(stepPeriod({ kind: 'year', at: '2026-03-01' }, 1).at, '2027-01-01')
  const fortnight = stepPeriod({ kind: 'range', at: TODAY, from: '2026-10-01', to: '2026-10-14' }, -1)
  assert.deepEqual([fortnight.from, fortnight.to], ['2026-09-17', '2026-09-30'])
})

t('the period before is the same kind of stretch', () => {
  assert.deepEqual(
    (({ from, to }) => [from, to])(previousOf({ kind: 'month', at: '2026-03-15' }, TODAY)),
    ['2026-02-01', '2026-02-28'], 'the month before, at its own length')
  assert.deepEqual(
    (({ from, to }) => [from, to])(previousOf({ kind: 'last30', at: TODAY }, TODAY)),
    ['2026-08-16', '2026-09-14'], 'the thirty days before the thirty')
})

t('a range read back the wrong way round is put right', () => {
  const choice = normalisePeriod({ kind: 'range', from: '2026-10-10', to: '2026-10-01' }, TODAY)
  assert.deepEqual([choice.from, choice.to], ['2026-10-01', '2026-10-10'])
  assert.equal(normalisePeriod({ kind: 'decade' }, TODAY).kind, 'last30')
})

t('overlapping time is counted once as logged, and once per tag', () => {
  // Music through the whole of a game: two tags, but one stretch of the day.
  assert.equal(coveredSlots([b('game', 0, 12), b('music', 0, 12)]), 12)
  const days = { '2026-10-13': day(b('game', 0, 12), b('music', 6, 18)) }
  const l = ledgerOf(days, '2026-10-13', '2026-10-13', TODAY)
  assert.equal(l.covered, 18)
  assert.equal(l.slots.get('game'), 12)
  assert.equal(l.slots.get('music'), 12)
})

t('only the days up to today are counted', () => {
  const days = { '2026-10-01': day(b('walk', 50, 56)) }
  const l = ledgerOf(days, '2026-10-01', '2026-10-31', TODAY)
  assert.equal(l.counted, 14, 'the first to the fourteenth')
  assert.equal(l.logged, 1)
  assert.equal(l.days.length, 31, 'though the calendar shows the whole month')
  assert.equal(l.days[20].covered, null, 'with the days ahead marked as not yet')
  assert.equal(l.days[2].covered, 0, 'and the days gone by with nothing in them as empty')
})

t('a malformed day is passed over, not counted as anything', () => {
  const days = { '2026-10-10': { blocks: [], malformed: true }, '2026-10-11': day(b('food', 70, 73)) }
  const l = ledgerOf(days, '2026-10-10', '2026-10-11', TODAY)
  assert.equal(l.logged, 1)
})

t('the longest streak, and the fullest day', () => {
  const days = {
    '2026-10-01': day(b('a', 0, 6)),
    '2026-10-02': day(b('a', 0, 6)),
    '2026-10-04': day(b('a', 0, 6)),
    '2026-10-05': day(b('a', 0, 60)),
    '2026-10-06': day(b('a', 0, 6)),
  }
  const l = ledgerOf(days, '2026-10-01', '2026-10-10', TODAY)
  assert.deepEqual(l.streak, { from: '2026-10-04', to: '2026-10-06', length: 3 })
  assert.deepEqual(l.fullest, { date: '2026-10-05', covered: 60 })
  assert.equal(l.days.find((d) => d.date === '2026-10-05').top, 'a')
})

t('a typical day says when something was on, and what it mostly was', () => {
  // Two logged days. Sleep from midnight to three on both; a walk at eight
  // on one of them.
  const days = {
    '2026-10-12': day(b('sleep', 0, 18), b('walk', 48, 51)),
    '2026-10-13': day(b('sleep', 0, 18)),
  }
  const l = ledgerOf(days, '2026-10-12', '2026-10-13', TODAY)
  assert.equal(l.rhythm.length, 48)
  assert.equal(l.rhythm[0].total, 1, 'something at midnight on every day')
  assert.equal(l.rhythm[0].tags.get('sleep'), 1)
  assert.equal(l.rhythm[16].total, 0.5, 'half the days had something at eight')
  assert.equal(l.rhythm[16].tags.get('walk'), 1)
  assert.equal(l.rhythm[30].total, 0)
})

t('games and shows are added up by name', () => {
  const days = {
    '2026-10-12': day(b('game', 0, 6, { game: 'Minecraft' }), b('anime', 6, 9, { show: 'Frieren', episodes: [3, 4] })),
    '2026-10-13': day(b('game', 0, 3, { game: 'Minecraft' })),
  }
  const l = ledgerOf(days, '2026-10-12', '2026-10-13', TODAY)
  assert.equal(l.played.get('Minecraft').slots, 9)
  assert.equal(l.watched.get('Frieren').episodes, 2)
})

t('a calendar starts its weeks on Monday', () => {
  const weeks = weeksOf(datesIn('2026-10-01', '2026-10-31'))
  assert.equal(weeks[0].indexOf('2026-10-01'), 3, 'the first of October 2026 is a Thursday')
  assert.ok(weeks.every((w) => w.length === 7))
  assert.equal(weeks.flat().filter(Boolean).length, 31)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
