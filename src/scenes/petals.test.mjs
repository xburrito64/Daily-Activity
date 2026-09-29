// Petalfall's branch: which days bloomed, and where they grow.

import assert from 'node:assert/strict'
import { branchDays, growBranch, branchWords, seeded, BRANCH_DAYS } from './petals.js'

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

console.log('\npetals')

t('the branch holds the last weeks, oldest first, today at the tip', () => {
  const days = branchDays({}, '2026-09-29')
  assert.equal(days.length, BRANCH_DAYS)
  assert.equal(days[0].date, '2026-08-31')
  assert.equal(days[days.length - 1].date, '2026-09-29')
})

t('a day with anything on it blooms; a day with nothing is a bud', () => {
  const days = branchDays({
    '2026-09-29': { blocks: [block(0, 6)] },
    '2026-09-28': { blocks: [] },
  }, '2026-09-29', 3)
  assert.deepEqual(days.map((d) => d.bloom), [false, false, true])
})

t('overlapping blocks count their time once', () => {
  const [day] = branchDays({ '2026-09-29': { blocks: [block(0, 6), block(3, 9)] } }, '2026-09-29', 1)
  assert.equal(day.minutes, 90, 'nine ten-minute marks, not twelve')
})

t('a day not loaded yet is a bud, not a fault', () => {
  const [day] = branchDays({}, '2026-09-29', 1)
  assert.deepEqual([day.bloom, day.minutes], [false, 0])
})

t('the branch grows the same shape every time', () => {
  const box = { x0: 400, x1: 1400, y0: 10, y1: 90 }
  assert.deepEqual(growBranch(box, 30), growBranch(box, 30))
  const a = seeded(3)
  const b = seeded(3)
  assert.deepEqual([a(), a(), a()], [b(), b(), b()])
})

t('one place for every day, spread along it from the trunk to the tip', () => {
  const box = { x0: 400, x1: 1400, y0: 10, y1: 90 }
  const { nodes } = growBranch(box, 30)
  assert.equal(nodes.length, 30)
  // The trunk is at the right; today, the last, is furthest left.
  assert.ok(nodes[0].stem.x > nodes[29].stem.x)
  for (const n of nodes) {
    assert.ok(n.x > box.x0 - 40 && n.x < box.x1 + 60, `x ${n.x} stays near the gap`)
    assert.ok(n.y > box.y0 - 40 && n.y < box.y1 + 40, `y ${n.y} stays near the header`)
  }
})

t('hovering a day says how much of it bloomed', () => {
  assert.equal(branchWords({ bloom: true, minutes: 450 }), '7h 30m in bloom')
  assert.equal(branchWords({ bloom: true, minutes: 120 }), '2h in bloom')
  assert.equal(branchWords({ bloom: true, minutes: 40 }), '40 min in bloom')
  assert.equal(branchWords({ bloom: false, minutes: 0 }), 'still in bud — nothing logged')
  assert.equal(branchWords(null), '')
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
