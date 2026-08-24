import { slotToTime, timeToSlot } from './time.js'

let seq = 0
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`

const byStart = (a, b) =>
  a.startSlot - b.startSlot || a.endSlot - b.endSlot || (a.id < b.id ? -1 : 1)

const overlaps = (a, b) => a.startSlot < b.endSlot && a.endSlot > b.startSlot

/*
 * Lane order is the order blocks were added, so whatever you paint last sits
 * underneath what was already there. That can't be worked out from the times
 * — a block painted later may be longer, shorter, earlier or later — so the
 * list is kept in the order things were created and saved that way. Read the
 * file back and the order, and therefore the stacking, is unchanged.
 */

/**
 * Add a painted range. Different tags are allowed to overlap — they stack in
 * lanes when drawn. Painting a tag over itself merges instead of stacking,
 * since one activity can't run alongside itself.
 */
export function applyPaint(blocks, painted) {
  const sameTag = blocks.filter(
    (b) => b.tag === painted.tag && b.endSlot >= painted.startSlot && b.startSlot <= painted.endSlot,
  )

  // Appended, so it lands underneath anything it overlaps.
  if (sameTag.length === 0) return [...blocks, painted]

  const keep = sameTag[0]
  const notes = sameTag.map((b) => b.note).filter(Boolean)
  const merged = {
    ...keep,
    startSlot: Math.min(painted.startSlot, ...sameTag.map((b) => b.startSlot)),
    endSlot: Math.max(painted.endSlot, ...sameTag.map((b) => b.endSlot)),
    // Don't lose anything that was written on the blocks being absorbed.
    note: [...new Set(notes)].join('\n'),
  }
  // Merging isn't creating, so the survivor keeps its place in the order.
  return blocks
    .filter((b) => b === keep || !sameTag.includes(b))
    .map((b) => (b === keep ? merged : b))
}

/**
 * Move one block's edges. Neighbours are left alone; overlaps just stack.
 *
 * Dragging keeps the block at the height it is already drawn at. A block
 * sitting on top of another stays on top of whatever it reaches; one sitting
 * underneath stays underneath. A block that isn't overlapping anything yet has
 * no height to keep, so it behaves like painting and tucks under.
 */
export function applyResize(blocks, id, startSlot, endSlot) {
  if (endSlot <= startSlot) return blocks
  const target = blocks.find((b) => b.id === id)
  if (!target) return blocks

  const drawn = layoutLanes(blocks).filter((p) => p.block.id === id)
  const sharesWithAnything = drawn.some((p) => p.lanes > 1)
  const lowestLane = drawn.reduce((low, p) => Math.max(low, p.lane), 0)
  const onTop = sharesWithAnything && lowestLane === 0

  const moved = { ...target, startSlot, endSlot }
  const rest = blocks.filter((b) => b.id !== id)
  if (!onTop) return [...rest, moved]

  // Ahead of everything the new extent touches, so it stays the upper one.
  const first = rest.findIndex((b) => b.startSlot < endSlot && b.endSlot > startSlot)
  return first === -1
    ? [...rest, moved]
    : [...rest.slice(0, first), moved, ...rest.slice(first)]
}

export const removeBlock = (blocks, id) => blocks.filter((b) => b.id !== id)

export const setNote = (blocks, id, note) =>
  blocks.map((b) => (b.id === id ? { ...b, note } : b))

/**
 * Work out where every block should be drawn once overlaps are allowed.
 *
 * The day is cut at every start and end, and within each slice the blocks
 * covering it share the bar's height. A block therefore keeps full height
 * except across the stretch something else runs alongside it. Slices where a
 * block keeps the same lane are stitched back together so it draws as one
 * rectangle rather than a row of abutting ones.
 *
 * Returns pieces: { block, from, to, lane, lanes, isFirst, isLast }
 */
export function layoutLanes(blocks) {
  if (blocks.length === 0) return []

  const sorted = blocks // list order is stacking order: first added, top lane
  const cuts = [...new Set(sorted.flatMap((b) => [b.startSlot, b.endSlot]))].sort((a, b) => a - b)

  const pieces = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const from = cuts[i]
    const to = cuts[i + 1]
    const covering = sorted.filter((b) => b.startSlot <= from && b.endSlot >= to)

    covering.forEach((block, lane) => {
      // Extend the block's previous piece if it stayed in the same lane.
      const prev = pieces.find(
        (p) => p.block.id === block.id && p.to === from && p.lane === lane && p.lanes === covering.length,
      )
      if (prev) prev.to = to
      else pieces.push({ block, from, to, lane, lanes: covering.length })
    })
  }

  for (const block of sorted) {
    const mine = pieces.filter((p) => p.block.id === block.id)
    if (mine.length === 0) continue
    // Only the outermost pieces carry the resize handles and the rounded
    // ends; the joins between them are drawn square so a split block still
    // reads as one thing.
    mine.reduce((a, b) => (a.from <= b.from ? a : b)).isFirst = true
    mine.reduce((a, b) => (a.to >= b.to ? a : b)).isLast = true
    // The name is written once, on the roomiest piece, rather than repeated
    // on every fragment.
    mine.reduce((a, b) => (a.to - a.from >= b.to - b.from ? a : b)).isLabel = true
  }

  return pieces
}

/**
 * Every block joined to this one by overlap, directly or through others.
 * They share a single note, so the answer must be the same whichever member
 * you click. Sorted, so the first is the one that owns the note.
 */
export function overlapCluster(blocks, id) {
  const start = blocks.find((b) => b.id === id)
  if (!start) return []

  const cluster = [start]
  let grew = true
  while (grew) {
    grew = false
    for (const b of blocks) {
      if (cluster.includes(b)) continue
      if (cluster.some((c) => overlaps(b, c))) {
        cluster.push(b)
        grew = true
      }
    }
  }
  return cluster.sort(byStart)
}

/** Internal blocks -> the JSON shape stored in the Obsidian fence. */
export function serialise(blocks) {
  // Saved in list order, not sorted by time: the order is what decides which
  // block stacks above which, and it has to survive a reload.
  return blocks.map(({ tag, startSlot, endSlot, note }) => {
    const entry = { tag, start: slotToTime(startSlot), end: slotToTime(endSlot) }
    if (note) entry.note = note
    return entry
  })
}

export function deserialise(entries) {
  return entries.map((e) => ({
    id: newId(),
    tag: e.tag,
    startSlot: timeToSlot(e.start),
    endSlot: timeToSlot(e.end),
    note: e.note ?? '',
  }))
}
