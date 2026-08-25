import assert from 'node:assert'
import { applyPaint, applyResize, layoutLanes, overlapCluster, serialise, deserialise } from './blocks.js'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

const b = (id, tag, startSlot, endSlot, note = '') => ({ id, tag, startSlot, endSlot, note })
/** compact view of a layout: "id from-to lane/lanes" */
const shape = (pieces) => pieces
  .map((p) => `${p.block.id} ${p.from}-${p.to} ${p.lane}/${p.lanes}`)
  .sort()

t('a lone block fills the bar', () => {
  assert.deepStrictEqual(shape(layoutLanes([b('g', 'game', 0, 10)])), ['g 0-10 0/1'])
})

t('overlap in the middle splits only the shared stretch', () => {
  const pieces = layoutLanes([b('g', 'game', 0, 12), b('d', 'dgg', 4, 8)])
  assert.deepStrictEqual(shape(pieces), [
    'd 4-8 1/2',    // dgg on the bottom half, only where it runs
    'g 0-4 0/1',    // game full height before
    'g 4-8 0/2',    // game top half across the overlap
    'g 8-12 0/1',   // game full height after
  ])
})

// Whatever was painted later is later in the list, and goes underneath.
const lanesAt = (pieces, slot) => Object.fromEntries(
  pieces.filter((p) => p.from <= slot && p.to > slot).map((p) => [p.block.id, p.lane]))

t('the block added first takes the top lane', () => {
  const pieces = layoutLanes([b('g', 'game', 0, 12), b('d', 'dgg', 4, 8)])
  assert.deepStrictEqual(lanesAt(pieces, 5), { g: 0, d: 1 })
})

t('a short block painted at the START of a long one goes underneath', () => {
  const pieces = layoutLanes([b('g', 'game', 48, 80), b('r', 'reading', 48, 52)])
  assert.deepStrictEqual(lanesAt(pieces, 49), { g: 0, r: 1 })
})

t('a short block painted at the END of a long one goes underneath', () => {
  const pieces = layoutLanes([b('g', 'game', 48, 80), b('r', 'reading', 76, 80)])
  assert.deepStrictEqual(lanesAt(pieces, 77), { g: 0, r: 1 })
})

t('identical spans put the newer block underneath', () => {
  const pieces = layoutLanes([b('b1', 'game', 0, 8), b('b2', 'reading', 0, 8)])
  assert.deepStrictEqual(lanesAt(pieces, 1), { b1: 0, b2: 1 })
})

t('a later block stays underneath even when it is LONGER', () => {
  // the reported bug: reading was dragged out past game, and jumped on top
  const pieces = layoutLanes([b('g', 'game', 48, 64), b('r', 'reading', 48, 90)])
  assert.deepStrictEqual(lanesAt(pieces, 50), { g: 0, r: 1 })
})

t('a later block stays underneath when it spans two earlier ones', () => {
  // reading dragged right so it covers the end of game and the start of dgg
  const pieces = layoutLanes([
    b('g', 'game', 48, 64), b('d', 'dgg', 70, 84), b('r', 'reading', 60, 76),
  ])
  assert.deepStrictEqual(lanesAt(pieces, 62), { g: 0, r: 1 }, 'over game')
  assert.deepStrictEqual(lanesAt(pieces, 72), { d: 0, r: 1 }, 'over dgg')
})

t('the whole of a long block stays in one lane while something nests in it', () => {
  const pieces = layoutLanes([b('g', 'game', 48, 80), b('r', 'reading', 48, 52)])
  const game = pieces.filter((p) => p.block.id === 'g')
  assert.ok(game.every((p) => p.lane === 0), 'game must not change lane part-way')
})

t('stacking order survives a save and reload', () => {
  const painted = applyPaint([b('g', 'game', 48, 64)], b('r', 'reading', 48, 90))
  const reloaded = deserialise(serialise(painted))
  const ids = reloaded.map((x) => x.tag)
  assert.deepStrictEqual(ids, ['game', 'reading'], 'file order must not be re-sorted')
  const pieces = layoutLanes(reloaded)
  const at = pieces.filter((p) => p.from <= 50 && p.to > 50)
  assert.strictEqual(at.find((p) => p.block.tag === 'game').lane, 0)
  assert.strictEqual(at.find((p) => p.block.tag === 'reading').lane, 1)
})

t('three at once split into thirds', () => {
  const pieces = layoutLanes([
    b('a', 'game', 0, 10), b('b', 'dgg', 2, 10), b('c', 'anime', 4, 10),
  ])
  const last = pieces.filter((p) => p.from === 4)
  assert.strictEqual(last.length, 3)
  assert.deepStrictEqual(last.map((p) => p.lanes), [3, 3, 3])
  assert.deepStrictEqual(last.map((p) => p.lane).sort(), [0, 1, 2])
})

t('identical ranges share evenly', () => {
  const pieces = layoutLanes([b('a', 'game', 0, 4), b('b', 'dgg', 0, 4)])
  assert.deepStrictEqual(shape(pieces), ['a 0-4 0/2', 'b 0-4 1/2'])
})

t('touching but not overlapping stays full height', () => {
  const pieces = layoutLanes([b('a', 'game', 0, 4), b('b', 'dgg', 4, 8)])
  assert.deepStrictEqual(shape(pieces), ['a 0-4 0/1', 'b 4-8 0/1'])
})

t('a block fully inside another splits it into three drawn parts', () => {
  const pieces = layoutLanes([b('g', 'game', 0, 20), b('d', 'dgg', 8, 10)])
  assert.strictEqual(pieces.filter((p) => p.block.id === 'g').length, 3)
})

t('slices are stitched back together when the lane does not change', () => {
  // two separate overlaps against one long block: game should not be cut
  // into more pieces than the overlaps require
  const pieces = layoutLanes([
    b('g', 'game', 0, 20), b('d', 'dgg', 4, 6), b('y', 'youtube', 12, 14),
  ])
  assert.strictEqual(pieces.filter((p) => p.block.id === 'g').length, 5)
})

t('the name is written once, on the roomiest piece', () => {
  const pieces = layoutLanes([b('g', 'game', 0, 20), b('d', 'dgg', 4, 6)])
  const game = pieces.filter((p) => p.block.id === 'g')
  assert.strictEqual(game.filter((p) => p.isLabel).length, 1)
  const labelled = game.find((p) => p.isLabel)
  assert.strictEqual(labelled.to - labelled.from, 14, 'should label the widest run (6-20)')
})

t('the piece under the middle of a block is flagged', () => {
  // game runs 0-12, cut by dgg at 4-8, so its middle (6) is in the cut part
  const pieces = layoutLanes([b('g', 'game', 0, 12), b('d', 'dgg', 4, 8)])
  const middle = pieces.filter((p) => p.block.id === 'g' && p.isMiddle)
  assert.strictEqual(middle.length, 1, 'exactly one piece holds the middle')
  assert.deepStrictEqual([middle[0].from, middle[0].to], [4, 8])
})

t('an uncut block holds its own middle', () => {
  const [piece] = layoutLanes([b('g', 'game', 0, 12)])
  assert.strictEqual(piece.isMiddle, true)
  assert.strictEqual(piece.isLabel, true, 'and is still the roomiest piece')
})

t('handles sit on the outermost pieces only', () => {
  const pieces = layoutLanes([b('g', 'game', 0, 12), b('d', 'dgg', 4, 8)])
  const g = pieces.filter((p) => p.block.id === 'g').sort((x, y) => x.from - y.from)
  assert.strictEqual(g[0].isFirst, true)
  assert.strictEqual(g[0].isLast, undefined)
  assert.strictEqual(g[2].isLast, true)
  assert.strictEqual(g[1].isFirst, undefined)
})

t('painting a different tag stacks instead of trimming', () => {
  const out = applyPaint([b('g', 'game', 0, 12)], b('d', 'dgg', 4, 8))
  assert.strictEqual(out.length, 2)
  assert.deepStrictEqual(out.map((x) => [x.tag, x.startSlot, x.endSlot]),
    [['game', 0, 12], ['dgg', 4, 8]])
})

t('a merge keeps the surviving block in its original place in the order', () => {
  const out = applyPaint(
    [b('g', 'game', 0, 12), b('d', 'dgg', 20, 24)],
    b('n', 'game', 12, 16),
  )
  assert.deepStrictEqual(out.map((x) => x.tag), ['game', 'dgg'], 'game must not jump to the end')
})

// Painting says where it goes: `at` is the slot the pointer went down on and
// the lane that height came out as.
t('painting in the upper half puts the new block on top', () => {
  const out = applyPaint([b('g', 'game', 0, 12)], b('m', 'music', 4, 8), { slot: 4, lane: 0 })
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 5), { m: 0, g: 1 })
})

t('painting in the lower half puts the new block underneath', () => {
  const out = applyPaint([b('g', 'game', 0, 12)], b('m', 'music', 4, 8), { slot: 4, lane: 1 })
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 5), { g: 0, m: 1 })
})

t('painting at the seam between two blocks lands between them', () => {
  const out = applyPaint(
    [b('g', 'game', 0, 12), b('d', 'dgg', 0, 12)],
    b('m', 'music', 4, 8),
    { slot: 4, lane: 1 },
  )
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 5), { g: 0, m: 1, d: 2 })
})

t('a block painted on top stays on top when it is dragged wider', () => {
  const painted = applyPaint(
    [b('g', 'game', 0, 12), b('d', 'dgg', 16, 24)],
    b('m', 'music', 4, 8),
    { slot: 4, lane: 0 },
  )
  const out = applyResize(painted, 'm', 4, 20)
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 5), { m: 0, g: 1 }, 'still over game')
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 18), { m: 0, d: 1 }, 'and over dgg too')
})

t('where you painted it survives a save and reload', () => {
  const painted = applyPaint([b('g', 'game', 0, 12)], b('m', 'music', 4, 8), { slot: 4, lane: 0 })
  const reloaded = deserialise(serialise(painted))
  assert.deepStrictEqual(reloaded.map((x) => x.tag), ['music', 'game'])
})

t('a block wedged between two others keeps its place when resized', () => {
  const start = [
    b('a', 'game', 0, 20), b('n', 'music', 0, 20), b('c', 'dgg', 0, 20), b('d', 'anime', 24, 28),
  ]
  const out = applyResize(start, 'n', 0, 30)
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 5), { a: 0, n: 1, c: 2 }, 'still the middle one')
})

t('dragging a lone block onto another tucks it underneath', () => {
  // nothing is stacked with music yet, so it has no height to keep
  const start = [b('m', 'music', 0, 8), b('d', 'dgg', 20, 30)]
  const out = applyResize(start, 'm', 0, 24)
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 22), { d: 0, m: 1 })
})

t('dragging a block that sits underneath keeps it underneath', () => {
  // music is under game; dragged right across dgg it must stay the lower one
  const start = [b('g', 'game', 0, 12), b('m', 'music', 8, 20), b('d', 'dgg', 30, 40)]
  const out = applyResize(start, 'm', 8, 34)
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 10), { g: 0, m: 1 }, 'still under game')
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 32), { d: 0, m: 1 }, 'and under dgg too')
})

t('dragging a block that sits on top keeps it on top', () => {
  // game is over music; dragged right across dgg it must stay the upper one
  const start = [b('g', 'game', 0, 12), b('m', 'music', 8, 20), b('d', 'dgg', 30, 40)]
  const out = applyResize(start, 'g', 0, 34)
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 10), { g: 0, m: 1 }, 'still over music')
  assert.deepStrictEqual(lanesAt(layoutLanes(out), 32), { g: 0, d: 1 }, 'and over dgg too')
})

t('painting the same tag over itself merges', () => {
  const out = applyPaint([b('g', 'game', 0, 8)], b('n', 'game', 6, 14))
  assert.strictEqual(out.length, 1)
  assert.deepStrictEqual([out[0].startSlot, out[0].endSlot], [0, 14])
})

t('merging same-tag blocks keeps their notes', () => {
  const out = applyPaint([b('g', 'game', 0, 8, 'first half')], b('n', 'game', 8, 14))
  assert.strictEqual(out[0].note, 'first half')

  const two = applyPaint(
    [b('a', 'game', 0, 4, 'one'), b('b', 'game', 6, 10, 'two')],
    b('n', 'game', 4, 6),
  )
  assert.strictEqual(two.length, 1)
  assert.strictEqual(two[0].note, 'one\ntwo')
})

t('resize no longer eats its neighbour', () => {
  const out = applyResize([b('g', 'game', 0, 4), b('d', 'dgg', 6, 10)], 'g', 0, 8)
  assert.strictEqual(out.length, 2)
  // order is stacking order, so the dragged block is last; check contents
  const byId = Object.fromEntries(out.map((x) => [x.id, [x.startSlot, x.endSlot]]))
  assert.deepStrictEqual(byId, { g: [0, 8], d: [6, 10] })
})

t('cluster is the same whichever member you click', () => {
  const blocks = [b('g', 'game', 0, 12), b('d', 'dgg', 4, 8), b('far', 'walk', 20, 24)]
  const fromGame = overlapCluster(blocks, 'g').map((x) => x.id)
  const fromDgg = overlapCluster(blocks, 'd').map((x) => x.id)
  assert.deepStrictEqual(fromGame, ['g', 'd'])
  assert.deepStrictEqual(fromDgg, ['g', 'd'])
})

t('cluster follows a chain of overlaps', () => {
  // a overlaps b, b overlaps c, a and c do not touch
  const blocks = [b('a', 'game', 0, 6), b('b', 'dgg', 4, 12), b('c', 'anime', 10, 16)]
  for (const id of ['a', 'b', 'c']) {
    assert.deepStrictEqual(overlapCluster(blocks, id).map((x) => x.id), ['a', 'b', 'c'])
  }
})

t('a block with nothing around it is its own cluster', () => {
  const blocks = [b('a', 'game', 0, 4), b('b', 'dgg', 8, 12)]
  assert.deepStrictEqual(overlapCluster(blocks, 'a').map((x) => x.id), ['a'])
})

t('the cluster reads in time order, not list order', () => {
  const blocks = [b('late', 'dgg', 4, 8), b('early', 'game', 0, 12)]
  assert.strictEqual(overlapCluster(blocks, 'late')[0].id, 'early')
})

t('empty day lays out to nothing', () => {
  assert.deepStrictEqual(layoutLanes([]), [])
  assert.deepStrictEqual(overlapCluster([], 'x'), [])
})

t('every piece stays inside its block and covers it exactly once', () => {
  const blocks = [
    b('a', 'game', 0, 20), b('b', 'dgg', 4, 10), b('c', 'anime', 8, 14), b('d', 'walk', 30, 40),
  ]
  for (const block of blocks) {
    const mine = layoutLanes(blocks)
      .filter((p) => p.block.id === block.id)
      .sort((x, y) => x.from - y.from)
    assert.strictEqual(mine[0].from, block.startSlot, `${block.id} starts late`)
    assert.strictEqual(mine[mine.length - 1].to, block.endSlot, `${block.id} ends early`)
    for (let i = 1; i < mine.length; i++) {
      assert.strictEqual(mine[i].from, mine[i - 1].to, `${block.id} has a gap or overlap`)
    }
  }
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
