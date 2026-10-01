// What the block looks are told about each piece: where it starts, how much
// of it shows, where it steps, and where a line of runes may go.

import assert from 'node:assert/strict'
import { pieceLook, runeSpans, RUNE_CELL, RUNE_MARGIN, RUNE_HOLE_ROOM } from './blockLooks.js'

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

console.log('\nblock looks')

const piece = (top, lanes) => ({ top, lanes })

t('a piece starts where the bar draws it', () => {
  assert.equal(pieceLook(piece(0, 1)).vars['--top'], 'var(--block-inset)', 'the top lane sits inside the ceiling')
  assert.equal(pieceLook(piece(1, 2)).vars['--top'], 'calc(100cqh * 0.5)')
})

t('what shows of a piece is its own lane, inset only against the bar', () => {
  assert.equal(pieceLook(piece(0, 1)).vars['--band'], 'calc(100cqh / 1 - 2 * var(--block-inset))', 'alone: ceiling and floor')
  assert.equal(pieceLook(piece(0, 2)).vars['--band'], 'calc(100cqh / 2 - 1 * var(--block-inset))', 'on top: the ceiling only')
  assert.equal(pieceLook(piece(1, 3)).vars['--band'], 'calc(100cqh / 3 - 0 * var(--block-inset))', 'between two: neither')
})

t('an end is a step only where the piece beside it starts lower', () => {
  // A block rising once something above it stops: the tall piece has an end
  // standing clear of the low one, from its top down to the low one's top.
  const low = piece(1, 2)
  const tall = piece(0, 1)
  const rises = pieceLook(tall, low, null)
  assert.equal(rises.stepStart, true)
  assert.equal(rises.stepEnd, false)
  assert.equal(rises.vars['--step-l'], 'calc(calc(100cqh * 0.5) - var(--block-inset))')
  // And the low piece has nothing standing clear: the tall one covers that end.
  const under = pieceLook(low, null, tall)
  assert.equal(under.stepEnd, false)
  assert.equal(under.vars['--step-r'], undefined)
  // Pieces at the same height are one shape running on.
  assert.equal(pieceLook(piece(0, 2), piece(0, 1), piece(0, 3)).stepStart, false)
})

t('runes are whole, centred, and kept clear of the ends', () => {
  const [span, more] = runeSpans(100, 200, 100, 200)
  const count = Math.floor((100 - 2 * RUNE_MARGIN) / RUNE_CELL)
  assert.equal((100 - span.left - span.right) / RUNE_CELL, count, 'a whole number of runes')
  assert.ok(span.left >= RUNE_MARGIN && span.right >= RUNE_MARGIN, 'with room at both ends')
  assert.ok(Math.abs(span.left - span.right) <= 1, 'and the same room at each')
  assert.equal(span.shift, 0)
  assert.equal(more, undefined, 'in one stretch')
})

t('a block too short for two whole runes has none', () => {
  const two = 2 * RUNE_MARGIN + 2 * RUNE_CELL
  assert.deepEqual(runeSpans(0, two - 1, 0, two - 1), [], 'a lone rune is a stray mark')
  assert.equal(runeSpans(0, two, 0, two).length, 1)
})

t('across a step no rune is split or pressed against it, and every piece reads from the same first rune', () => {
  // One block 0-200 cut at 103: the rune straddling the cut is in neither.
  const [whole] = runeSpans(0, 200, 0, 200)
  const origin = whole.left
  const [a] = runeSpans(0, 200, 0, 103)
  const [b] = runeSpans(0, 200, 103, 200)
  const aEnd = 103 - a.right
  const bStart = 103 + b.left
  assert.equal((aEnd - origin) % RUNE_CELL, 0, 'the first piece stops on a rune boundary')
  assert.equal((bStart - origin) % RUNE_CELL, 0, 'the second starts on one')
  assert.ok(aEnd <= 103 - RUNE_MARGIN && bStart >= 103 + RUNE_MARGIN, 'kept clear of the cut, like an end')
  assert.ok(bStart - aEnd < 2 * RUNE_MARGIN + 2 * RUNE_CELL, 'and no further off than that')
  assert.equal((b.shift + (bStart - origin)) % (RUNE_CELL * 8), 0, 'the pattern is the block\'s, not the piece\'s')
})

t('the runes part for a name, and pick up again after it', () => {
  // A name 60px wide in the middle of a 300px block.
  const hole = [120, 180]
  const [left, right, extra] = runeSpans(0, 300, 0, 300, hole)
  assert.equal(extra, undefined)
  const leftEnd = 300 - left.right
  const rightStart = right.left
  assert.ok(leftEnd <= hole[0] - RUNE_HOLE_ROOM, 'stopping clear of it')
  assert.ok(rightStart >= hole[1] + RUNE_HOLE_ROOM, 'and starting clear of it')
  assert.ok(hole[0] - RUNE_HOLE_ROOM - leftEnd < RUNE_CELL, 'but no further off than a rune')
  assert.equal((rightStart - left.left) % RUNE_CELL, 0, 'and on the same beat, as one line')
  assert.equal(Math.abs(right.shift % RUNE_CELL), 0)
})

t('a name with no room either side of it leaves no runes', () => {
  assert.deepEqual(runeSpans(0, 60, 0, 60, [5, 55]), [])
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed) process.exit(1)
