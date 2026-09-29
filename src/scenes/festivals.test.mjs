// Festivals: which days are more than a date, and the frost on Christmas Eve.

import assert from 'node:assert/strict'
import { festivalOf, frostFerns } from './festivals.js'

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

t('Christmas Eve is the 24th of December, every year', () => {
  for (const year of [2025, 2026, 2031]) {
    assert.equal(festivalOf(`${year}-12-24`)?.id, 'christmas-eve')
    assert.equal(festivalOf(`${year}-12-24`)?.name, 'Christmas Eve')
  }
})

t('the days either side of it are ordinary', () => {
  assert.equal(festivalOf('2026-12-23'), null)
  assert.equal(festivalOf('2026-12-25'), null)
  assert.equal(festivalOf('2026-11-24'), null)
  assert.equal(festivalOf('2026-09-29'), null)
})

t('anything that is not a date is no festival', () => {
  assert.equal(festivalOf(undefined), null)
  assert.equal(festivalOf(''), null)
  assert.equal(festivalOf('24.12.2026'), null)
  assert.equal(festivalOf('2026-12-24T00:00'), null)
})

t('the frost is the same pane every time', () => {
  const a = frostFerns(240, 160, 7)
  const b = frostFerns(240, 160, 7)
  assert.deepEqual(a, b)
  assert.notDeepEqual(frostFerns(240, 160, 8).lines.slice(0, 5), a.lines.slice(0, 5))
})

t('the frost grows from its corner, and stays mostly near it', () => {
  const { lines, rime, glints } = frostFerns(600, 400, 24)
  assert.ok(lines.length > 200, `only ${lines.length} strokes`)
  assert.ok(glints.length > 0)
  const close = rime.filter((d) => Math.hypot(d.x, d.y) < 120).length
  assert.ok(close > rime.length / 3, 'the rime gathers in the corner')
  const near = lines.filter((l) => Math.hypot(l.x0, l.y0) < Math.hypot(600, 400) * 0.5).length
  assert.ok(near / lines.length > 0.7, 'most of it by the corner')
  for (const l of lines) {
    assert.ok(l.alpha > 0 && l.alpha <= 0.5)
    assert.ok(l.width > 0)
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
