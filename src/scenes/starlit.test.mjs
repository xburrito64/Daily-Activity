// Starlit: the real moon, the ranks of magic, and days fully accounted for.

import assert from 'node:assert/strict'
import {
  moonPhase, moonName, rankOf, monthByTag, rankUps, isComplete, completeDays, RANKS,
} from './starlit.js'

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
const near = (a, b, within) => Math.abs(a - b) <= within

console.log('\nstarlit')

t('the moon is where it really was', () => {
  // Known moons: full on 2024-04-23 23:49 UTC, new on 2024-05-08 03:22 UTC.
  assert.ok(near(moonPhase(new Date(Date.UTC(2024, 3, 23, 23, 49))), 0.5, 0.02))
  const newMoon = moonPhase(new Date(Date.UTC(2024, 4, 8, 3, 22)))
  assert.ok(newMoon < 0.02 || newMoon > 0.98, `new moon read as ${newMoon}`)
  // And before the moon everyone counts from, it still lands in 0–1.
  const old = moonPhase(new Date(Date.UTC(1990, 0, 1)))
  assert.ok(old >= 0 && old < 1)
})

t('the moon has a name for each part of its month', () => {
  assert.equal(moonName(0), 'new moon')
  assert.equal(moonName(0.25), 'first quarter')
  assert.equal(moonName(0.5), 'full moon')
  assert.equal(moonName(0.62), 'waning gibbous')
  assert.equal(moonName(0.99), 'new moon')
})

t('ranks rise with the hours, from Beginner to God', () => {
  assert.equal(rankOf(0).name, 'Beginner')
  assert.equal(rankOf(5 * 60 - 1).name, 'Beginner')
  assert.equal(rankOf(5 * 60).name, 'Intermediate')
  assert.equal(rankOf(40 * 60).name, 'Saint')
  assert.equal(rankOf(500 * 60).name, 'God')
  assert.equal(rankOf(500 * 60).index, RANKS.length - 1)
  assert.equal(rankOf(12 * 60).toNext, 3)
  assert.equal(rankOf(500 * 60).toNext, 0)
})

t('a month of a tag counts the last thirty days, today included', () => {
  const days = {
    '2026-09-29': { blocks: [block('read', 0, 6)] },
    '2026-08-31': { blocks: [block('read', 0, 6)] }, // 29 days back: in
    '2026-08-30': { blocks: [block('read', 0, 6)] }, // 30 days back: out
    '2026-09-10': { malformed: true, blocks: [block('read', 0, 6)] },
  }
  assert.equal(monthByTag(days, TODAY).get('read'), 120)
})

t('a rank-up is a tag that crossed into a higher rank', () => {
  const before = new Map([['read', 14 * 60], ['game', 70 * 60]])
  const after = new Map([['read', 15 * 60], ['game', 71 * 60], ['walk', 5 * 60]])
  assert.deepEqual(rankUps(before, after), [
    { tag: 'read', rank: 'Advanced' },
    { tag: 'walk', rank: 'Intermediate' },
  ])
  assert.deepEqual(rankUps(after, after), [])
})

t('a day is complete when every ten minutes of it holds something', () => {
  assert.equal(isComplete([block('a', 0, 144)]), true)
  assert.equal(isComplete([block('a', 0, 70), block('b', 70, 144)]), true)
  assert.equal(isComplete([block('a', 0, 70), block('b', 71, 144)]), false)
  assert.equal(isComplete([]), false)
  const days = {
    a: { blocks: [block('x', 0, 144)] },
    b: { blocks: [block('x', 0, 143)] },
    c: { malformed: true, blocks: [block('x', 0, 144)] },
  }
  assert.deepEqual([...completeDays(days)], ['a'])
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
