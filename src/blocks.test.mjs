import assert from 'node:assert'
import { applyPaint, applyResize, layoutLanes, overlapCluster, serialise, deserialise, setGame, setShow } from './blocks.js'
import { paintSpans, SLOTS_PER_DAY } from './time.js'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

const b = (id, tag, startSlot, endSlot, note = '') => ({ id, tag, startSlot, endSlot, note })
/** compact view of a layout: "id from-to top/lanes" — where it is drawn from */
const shape = (pieces) => pieces
  .map((p) => `${p.block.id} ${p.from}-${p.to} ${p.top}/${p.lanes}`)
  .sort()

t('a lone block fills the bar', () => {
  assert.deepStrictEqual(shape(layoutLanes([b('g', 'game', 0, 10)])), ['g 0-10 0/1'])
})

t('the bar is shared while it is shared, and a block either side', () => {
  const pieces = layoutLanes([b('g', 'game', 0, 12), b('d', 'dgg', 4, 8)])
  assert.deepStrictEqual(shape(pieces), [
    'd 4-8 1/2',    // dgg underneath, exactly where it runs
    'g 0-3 0/1',    // game has the bar to itself
    'g 3-9 0/2',    // halves — from one block before dgg to one block after
    'g 9-12 0/1',   // and the whole bar again
  ])
})

t('a block gives up room when a third thing starts, and takes it back after', () => {
  // This used to go the other way: a block held one height for its whole
  // length, which meant it stayed a third high long after the third thing had
  // stopped — and, worse, could be thinned by a pile-up hours away that it
  // only touched through a chain of others. Asked for again the other way
  // round: the height says how many things were running just there.
  const pieces = layoutLanes([
    b('s', 'sleep', 0, 60), b('m', 'music', 0, 60), b('a', 'anime', 20, 40),
  ])
  const music = pieces.filter((p) => p.block.id === 'm')
  assert.deepStrictEqual(music.map((p) => p.from + '-' + p.to + ' ' + p.lane + '/' + p.lanes),
    ['0-19 1/2', '19-41 1/3', '41-60 1/2'])
})

t('a block rises to fill the top once nothing is above it', () => {
  // dgg is pushed down while game is there; past the end of game there is
  // nothing above it, so it takes the whole bar rather than leaving a gap.
  const pieces = layoutLanes([b('g', 'game', 6, 11), b('d', 'dgg', 10, 13)])
  assert.deepStrictEqual(shape(pieces), [
    'd 10-11 1/2',   // under game
    'd 11-12 0/2',   // top of the bar the moment game ends, still in halves
    'd 12-13 0/1',   // and the whole bar a block later
    'g 6-9 0/1',
    'g 9-11 0/2',    // halves from a block before dgg starts
  ])
})

t('a block cut where it rises is still one block', () => {
  const pieces = layoutLanes([b('g', 'game', 6, 11), b('d', 'dgg', 10, 13)])
  const dgg = pieces.filter((p) => p.block.id === 'd')
  assert.strictEqual(dgg.length, 3)
  assert.deepStrictEqual(dgg.map((p) => [p.isFirst, p.isLast]),
    [[true, undefined], [undefined, undefined], [undefined, true]],
    'only the outer ends are rounded, and only they carry handles')
  assert.deepStrictEqual(dgg.map((p) => p.lane), [1, 0, 0], 'it rises when the block above it ends')
})

t('nothing is left empty above the shallowest block', () => {
  // whatever is topmost at any moment reaches the ceiling
  const pieces = layoutLanes([
    b('a', 'game', 0, 10), b('bb', 'dgg', 5, 20), b('c', 'anime', 15, 30),
  ])
  for (const slot of [0, 5, 10, 15, 20, 25]) {
    const here = pieces.filter((p) => p.from <= slot && p.to > slot)
    assert.ok(here.some((p) => p.top === 0), `nothing reaches the top at slot ${slot}`)
  }
})

t('blocks that miss each other never thin one another', () => {
  // dgg and anime both sit under game, but never at the same moment: halves
  // where each of them runs, and the whole bar in between. Nothing is ever a
  // third here, because nothing was ever three-deep.
  const pieces = layoutLanes([b('g', 'game', 0, 20), b('d', 'dgg', 0, 4), b('a', 'anime', 16, 20)])
  assert.deepStrictEqual(shape(pieces),
    ['a 16-20 1/2', 'd 0-4 1/2', 'g 0-5 0/2', 'g 15-20 0/2', 'g 5-15 0/1'])
})

t('a block that overlaps nothing keeps the full height', () => {
  const pieces = layoutLanes([b('g', 'game', 0, 10), b('d', 'dgg', 2, 8), b('far', 'walk', 30, 40)])
  assert.strictEqual(pieces.find((p) => p.block.id === 'far').lanes, 1)
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

t('three at once split into thirds, and only then', () => {
  const pieces = layoutLanes([
    b('a', 'game', 0, 10), b('b', 'dgg', 2, 10), b('c', 'anime', 4, 10),
  ])
  // The whole bar, then halves, then thirds, each arriving a block early.
  assert.deepStrictEqual(shape(pieces),
    ['a 0-1 0/1', 'a 1-3 0/2', 'a 3-10 0/3', 'b 2-3 1/2', 'b 3-10 1/3', 'c 4-10 2/3'])
})

t('identical ranges share evenly', () => {
  const pieces = layoutLanes([b('a', 'game', 0, 4), b('b', 'dgg', 0, 4)])
  assert.deepStrictEqual(shape(pieces), ['a 0-4 0/2', 'b 0-4 1/2'])
})

t('touching but not overlapping stays full height', () => {
  const pieces = layoutLanes([b('a', 'game', 0, 4), b('b', 'dgg', 4, 8)])
  assert.deepStrictEqual(shape(pieces), ['a 0-4 0/1', 'b 4-8 0/1'])
})

t('a short block inside a long one notches it rather than halving all of it', () => {
  // Twenty minutes of dgg in the middle of a long game is no reason for the
  // game to be half height for its whole length.
  const pieces = layoutLanes([b('g', 'game', 0, 20), b('d', 'dgg', 8, 10)])
  assert.deepStrictEqual(shape(pieces),
    ['d 8-10 1/2', 'g 0-7 0/1', 'g 11-20 0/1', 'g 7-11 0/2'])
})

t('the shelf a short block sits in is a block wider at each end', () => {
  // A notch exactly the width of a ten-minute block reads as a spike. One
  // block of room at each end makes it a shelf the day made room in.
  const pieces = layoutLanes([b('g', 'game', 0, 20), b('d', 'dgg', 9, 10)])
  const dgg = pieces.find((p) => p.block.id === 'd')
  const shelf = pieces.find((p) => p.block.id === 'g' && p.lanes === 2)
  assert.deepStrictEqual([dgg.from, dgg.to], [9, 10], 'the block keeps its own times')
  assert.deepStrictEqual([shelf.from, shelf.to], [8, 11], 'the room around it does not')
})

t('a block covered in two places is notched twice and whole in between', () => {
  const pieces = layoutLanes([
    b('g', 'game', 0, 20), b('d', 'dgg', 4, 6), b('y', 'youtube', 12, 14),
  ])
  const game = pieces.filter((p) => p.block.id === 'g')
  assert.deepStrictEqual(game.map((p) => p.from + '-' + p.to + ' of ' + p.lanes),
    ['0-3 of 1', '3-7 of 2', '7-11 of 1', '11-15 of 2', '15-20 of 1'])
  // Still one block: only the outer ends are rounded and carry the handles.
  assert.deepStrictEqual([game[0].isFirst, game[game.length - 1].isLast], [true, true])
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

// --- painting a stretch that runs past midnight ---------------------------

/** compact view of spans: "date start-end" */
const spans = (list) => list.map((s) => `${s.date} ${s.startSlot}-${s.endSlot}`)

t('a stretch inside one day is one span', () => {
  assert.deepEqual(
    spans(paintSpans('2026-08-26', 60, '2026-08-26', 89)),
    ['2026-08-26 60-90'],
  )
})

t('a single slot is one span one slot long', () => {
  assert.deepEqual(
    spans(paintSpans('2026-08-26', 60, '2026-08-26', 60)),
    ['2026-08-26 60-61'],
  )
})

t('dragged backwards inside a day reads the same stretch', () => {
  assert.deepEqual(
    paintSpans('2026-08-26', 89, '2026-08-26', 60),
    paintSpans('2026-08-26', 60, '2026-08-26', 89),
  )
})

t('a stretch onto the next day is cut at midnight', () => {
  // 23:00 through to 07:00, which is what sleep actually looks like
  assert.deepEqual(
    spans(paintSpans('2026-08-26', 138, '2026-08-27', 41)),
    ['2026-08-26 138-144', '2026-08-27 0-42'],
  )
})

t('dragged back from the next day is the same two spans', () => {
  assert.deepEqual(
    paintSpans('2026-08-27', 41, '2026-08-26', 138),
    paintSpans('2026-08-26', 138, '2026-08-27', 41),
  )
})

t('the days in the middle of a long stretch are whole', () => {
  assert.deepEqual(
    spans(paintSpans('2026-08-26', 100, '2026-08-29', 20)),
    ['2026-08-26 100-144', '2026-08-27 0-144', '2026-08-28 0-144', '2026-08-29 0-21'],
  )
})

t('every span is a real stretch, and they join end to end', () => {
  const list = paintSpans('2026-08-26', 138, '2026-08-28', 41)
  for (const s of list) {
    assert.ok(s.endSlot > s.startSlot, s.date + ' is empty')
    assert.ok(s.startSlot >= 0 && s.endSlot <= SLOTS_PER_DAY, s.date + ' leaves the day')
  }
  for (let i = 1; i < list.length; i++) {
    assert.equal(list[i - 1].endSlot, SLOTS_PER_DAY, 'runs to midnight')
    assert.equal(list[i].startSlot, 0, 'picks up at midnight')
  }
})

t('a stretch ending at midnight itself does not open an empty day', () => {
  // released on the last slot of the day it started on
  assert.deepEqual(
    spans(paintSpans('2026-08-26', 138, '2026-08-26', 143)),
    ['2026-08-26 138-144'],
  )
})

// --- meeting your own tag, and choosing a height while sliding ------------

t('sliding a block until it touches the same tag merges them', () => {
  const day = [b('a', 'youtube', 60, 72), b('b', 'youtube', 90, 102)]
  // b slid back so it starts exactly where a ends
  const after = applyResize(day, 'b', 72, 84)
  assert.equal(after.length, 1)
  assert.deepEqual([after[0].startSlot, after[0].endSlot], [60, 84])
})

t('overlapping the same tag merges too', () => {
  const day = [b('a', 'youtube', 60, 72), b('b', 'youtube', 90, 102)]
  const after = applyResize(day, 'b', 66, 78)
  assert.equal(after.length, 1)
  assert.deepEqual([after[0].startSlot, after[0].endSlot], [60, 78])
})

t('a different tag brought alongside is left alone', () => {
  const day = [b('a', 'youtube', 60, 72), b('b', 'music', 90, 102)]
  assert.equal(applyResize(day, 'b', 72, 84).length, 2)
})

t('dragging an edge into the same tag merges it as well', () => {
  const day = [b('a', 'youtube', 60, 72), b('b', 'youtube', 90, 102)]
  const after = applyResize(day, 'a', 60, 90) // a stretched out to meet b
  assert.equal(after.length, 1)
  assert.deepEqual([after[0].startSlot, after[0].endSlot], [60, 102])
})

t('merging keeps what was written on both', () => {
  const day = [b('a', 'youtube', 60, 72, 'first'), b('b', 'youtube', 90, 102, 'second')]
  const after = applyResize(day, 'b', 72, 84)
  assert.equal(after.length, 1)
  assert.ok(after[0].note.includes('first') && after[0].note.includes('second'))
})

t('slid onto the upper half, a block lands on top', () => {
  const day = [b('a', 'dgg', 60, 90), b('b', 'music', 0, 20)]
  const after = applyResize(day, 'b', 66, 78, { slot: 66, lane: 0 })
  assert.equal(layoutLanes(after).find((p) => p.block.id === 'b').lane, 0)
})

t('slid onto the lower half, the same block lands underneath', () => {
  const day = [b('a', 'dgg', 60, 90), b('b', 'music', 0, 20)]
  const after = applyResize(day, 'b', 66, 78, { slot: 66, lane: 1 })
  assert.equal(layoutLanes(after).find((p) => p.block.id === 'b').lane, 1)
})

t('dragging an edge still cannot change the height', () => {
  const day = [b('a', 'dgg', 60, 90), b('b', 'music', 66, 78)]
  const before = layoutLanes(day).find((p) => p.block.id === 'b').lane
  const after = applyResize(day, 'b', 66, 84)
  assert.equal(layoutLanes(after).find((p) => p.block.id === 'b').lane, before)
})

// --- games: two Game blocks are not always the same thing -----------------

const g = (id, name, startSlot, endSlot, cover = '') =>
  ({ ...b(id, 'game', startSlot, endSlot), game: name, cover })

t('two stretches of the same game still fold together', () => {
  const day = [g('a', 'Elden Ring', 60, 72), g('c', 'Elden Ring', 72, 84)]
  const after = applyResize(day, 'c', 72, 90)
  assert.equal(after.length, 1)
  assert.deepStrictEqual([after[0].startSlot, after[0].endSlot, after[0].game],
    [60, 90, 'Elden Ring'])
})

t('two different games do not, however much they touch', () => {
  // The reason the merge asks about more than the tag: finishing one game and
  // starting another is two things, and they are both tagged Game.
  const day = [g('a', 'Elden Ring', 60, 72), g('c', 'Hades', 72, 84)]
  const after = applyResize(day, 'c', 70, 84)
  assert.equal(after.length, 2)
  assert.deepStrictEqual(after.map((x) => x.game).sort(), ['Elden Ring', 'Hades'])
})

t('a game nobody has named does not fold into a named one', () => {
  // There is no way to know it was the same game, and guessing would put a
  // name on time that was not spent there.
  const day = [g('a', 'Elden Ring', 60, 72), b('c', 'game', 72, 84)]
  const after = applyResize(day, 'c', 72, 90)
  assert.equal(after.length, 2)
})

t('two unnamed Game blocks still fold together, as they always did', () => {
  const after = applyResize([b('a', 'game', 60, 72), b('c', 'game', 72, 84)], 'c', 70, 84)
  assert.equal(after.length, 1)
})

t('naming a block says what it was', () => {
  const after = setGame([b('a', 'game', 60, 72)], 'a', { name: 'Hades', cover: 'hades-1.jpg' })
  assert.deepStrictEqual([after[0].game, after[0].cover], ['Hades', 'hades-1.jpg'])
})

t('naming a block folds it into the same game beside it', () => {
  const day = [g('a', 'Hades', 60, 72), b('c', 'game', 72, 84)]
  const after = setGame(day, 'c', { name: 'Hades', cover: 'hades-1.jpg' })
  assert.equal(after.length, 1)
  assert.deepStrictEqual([after[0].id, after[0].startSlot, after[0].endSlot], ['a', 60, 84])
})

t('taking the name back off leaves the block where it was', () => {
  const after = setGame([g('a', 'Hades', 60, 72, 'hades-1.jpg')], 'a', null)
  assert.equal(after.length, 1)
  assert.deepStrictEqual([after[0].game, after[0].cover, after[0].startSlot], ['', '', 60])
})

t('the game and its cover survive the round trip', () => {
  const written = serialise([g('a', 'Elden Ring', 60, 72, 'elden-ring-326243.jpg')])
  assert.deepStrictEqual(written, [{
    tag: 'game', start: '10:00', end: '12:00',
    game: 'Elden Ring', cover: 'elden-ring-326243.jpg',
  }])
  const back = deserialise(written)
  assert.deepStrictEqual([back[0].game, back[0].cover], ['Elden Ring', 'elden-ring-326243.jpg'])
})

t('a cover with no game is not written — it would mean nothing on its own', () => {
  assert.deepStrictEqual(serialise([g('a', '', 60, 72, 'stray.jpg')]),
    [{ tag: 'game', start: '10:00', end: '12:00' }])
})

t('a day written before any of this reads back with no game', () => {
  const back = deserialise([{ tag: 'game', start: '10:00', end: '12:00' }])
  assert.deepStrictEqual([back[0].game, back[0].cover], ['', ''])
})

// --- anime: the same again, plus which episodes ---------------------------

const a = (id, show, startSlot, endSlot, episodes = [], cover = '') =>
  ({ ...b(id, 'anime', startSlot, endSlot), show, episodes, cover })

t('two stretches of the same show fold together', () => {
  const day = [a('a', 'Frieren', 120, 126, [1]), a('c', 'Frieren', 126, 132, [2])]
  const after = applyResize(day, 'c', 126, 138)
  assert.equal(after.length, 1)
  assert.deepStrictEqual([after[0].startSlot, after[0].endSlot, after[0].show],
    [120, 138, 'Frieren'])
})

t('and the episodes join up rather than one evening losing half of itself', () => {
  const day = [a('a', 'Frieren', 120, 126, [1, 2]), a('c', 'Frieren', 126, 132, [3])]
  const after = applyResize(day, 'c', 126, 138)
  assert.deepStrictEqual(after[0].episodes, [1, 2, 3])
})

t('two different shows do not fold, however much they touch', () => {
  const day = [a('a', 'Frieren', 120, 126, [1]), a('c', 'Dandadan', 126, 132, [1])]
  const after = applyResize(day, 'c', 124, 132)
  assert.equal(after.length, 2)
})

t('a show nobody has named does not fold into a named one', () => {
  const day = [a('a', 'Frieren', 120, 126, [1]), a('c', '', 126, 132)]
  const after = applyResize(day, 'c', 126, 138)
  assert.equal(after.length, 2)
})

t('naming a block says what was watched, and which of it', () => {
  const day = [a('a', '', 120, 132)]
  const after = setShow(day, 'a', { name: 'Frieren', cover: 'frieren-154587.jpg', episodes: [7, 5, 6] })
  assert.deepStrictEqual(
    [after[0].show, after[0].cover, after[0].episodes],
    ['Frieren', 'frieren-154587.jpg', [5, 6, 7]],
  )
})

t('changing to another show drops the episodes with it', () => {
  // Episode 7 of one thing is not episode 7 of another, and carrying the
  // numbers across would be a quiet lie about the evening.
  const day = [a('a', 'Frieren', 120, 132, [5, 6, 7])]
  const after = setShow(day, 'a', { name: 'Dandadan', cover: '', episodes: [] })
  assert.deepStrictEqual([after[0].show, after[0].episodes], ['Dandadan', []])
})

t('taking the show back off leaves the block where it was', () => {
  const day = [a('a', 'Frieren', 120, 132, [5])]
  const after = setShow(day, 'a', null)
  assert.equal(after.length, 1)
  assert.deepStrictEqual(
    [after[0].show, after[0].episodes, after[0].startSlot, after[0].endSlot],
    ['', [], 120, 132],
  )
})

t('the show, its episodes and its cover survive the round trip', () => {
  const written = serialise([a('a', 'Frieren', 120, 132, [5, 6, 7], 'frieren-154587.jpg')])
  assert.deepStrictEqual(written, [{
    tag: 'anime', start: '20:00', end: '22:00',
    show: 'Frieren', episodes: [5, 6, 7], cover: 'frieren-154587.jpg',
  }])
  const back = deserialise(written)
  assert.deepStrictEqual([back[0].show, back[0].episodes], ['Frieren', [5, 6, 7]])
})

t('episodes with no show are not written — they would number nothing', () => {
  assert.deepStrictEqual(serialise([a('a', '', 120, 132, [5, 6])]),
    [{ tag: 'anime', start: '20:00', end: '22:00' }])
})

t('a day written before any of this reads back with no show', () => {
  const back = deserialise([{ tag: 'anime', start: '20:00', end: '22:00' }])
  assert.deepStrictEqual([back[0].show, back[0].episodes], ['', []])
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
