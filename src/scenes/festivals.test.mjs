// Festivals: which days are more than a date, and the frost on Christmas Eve.

import assert from 'node:assert/strict'
import { festivalOf, frostFerns, cobweb, easterSunday, blossomBranch, meadow } from './festivals.js'

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

t('Halloween is the 31st of October, every year', () => {
  for (const year of [2025, 2026, 2030]) {
    assert.equal(festivalOf(`${year}-10-31`)?.id, 'halloween')
    assert.equal(festivalOf(`${year}-10-31`)?.name, 'Halloween')
  }
  assert.equal(festivalOf('2026-10-30'), null)
  assert.equal(festivalOf('2026-11-01'), null)
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

t('a cobweb is the same web every time, spun inside its corner', () => {
  const a = cobweb(240, 120, 5)
  assert.deepEqual(a, cobweb(240, 120, 5))
  assert.ok(a.lines.length >= 5 && a.silk.length > 20)
  for (const l of a.lines) {
    assert.equal(l.x0, 0)
    assert.equal(l.y0, 0)
    assert.ok(l.x1 <= 240.001 && l.y1 <= 120.001 && l.x1 >= 0 && l.y1 >= 0, 'every spoke ends on the pane')
  }
  for (const s of a.silk) {
    // Each strand sags toward the corner, never away from it.
    assert.ok(Math.hypot(s.cx, s.cy) < Math.hypot((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2))
  }
})

t('Easter Sunday moves with the moon, and lands where the calendars say', () => {
  const known = {
    2019: '04-21', 2024: '03-31', 2025: '04-20', 2026: '04-05', 2027: '03-28',
    2028: '04-16', 2030: '04-21', 2038: '04-25', 2285: '03-22',
  }
  for (const [year, day] of Object.entries(known)) {
    const { month, day: d } = easterSunday(Number(year))
    assert.equal(`${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day, year)
    assert.equal(festivalOf(`${year}-${day}`)?.id, 'easter', year)
  }
  // The day before and after it are ordinary, and so is last year's date.
  assert.equal(festivalOf('2027-03-27'), null)
  assert.equal(festivalOf('2027-03-29'), null)
  assert.equal(festivalOf('2027-04-05'), null)
})

t('the blossom branch and the flower field stay on their panes', () => {
  const b = blossomBranch(360, 120)
  assert.deepEqual(b, blossomBranch(360, 120))
  assert.ok(b.wood.length > 10 && b.blossoms.length > 5)
  for (const f of b.blossoms) assert.ok(f.tone >= 0 && f.tone < 4)
  const m = meadow(1200, 96)
  assert.ok(m.blades.length > 200 && m.flowers.length > 20)
  for (const f of m.flowers) {
    assert.ok(f.height > 0 && f.height < 96, 'no flower taller than the field')
    assert.ok(f.kind >= 0 && f.kind < 4)
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
