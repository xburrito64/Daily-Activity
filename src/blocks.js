import { slotToTime, timeToSlot } from './time.js'

let seq = 0
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`

const byStart = (a, b) =>
  a.startSlot - b.startSlot || a.endSlot - b.endSlot || (a.id < b.id ? -1 : 1)

const overlaps = (a, b) => a.startSlot < b.endSlot && a.endSlot > b.startSlot

/*
 * Lane order is list order: the first block in the list is drawn in the top
 * lane wherever things overlap. Which one that should be can't be worked out
 * from the times — a block painted later may be longer, shorter, earlier or
 * later — so the list is kept in whatever order things end up in and saved
 * that way. Read the file back and the stacking is unchanged.
 */

/**
 * Where a block has to sit in the list to be drawn in `lane` at `atSlot`.
 * List order is stacking order, so this is the one place that decides it.
 *
 * A single list can only ever approximate this: the top and bottom lanes are
 * exact, but a block wedged between two others is placed by the company it
 * keeps at `atSlot` and takes its chances everywhere else.
 */
function placeFor(blocks, atSlot, lane) {
  const covering = blocks.filter((b) => b.startSlot <= atSlot && b.endSlot > atSlot)
  if (lane <= 0) return 0 // above everything
  if (lane >= covering.length) return blocks.length // below everything
  return blocks.indexOf(covering[lane - 1]) + 1
}

/**
 * Add a painted range. Different tags are allowed to overlap — they stack in
 * lanes when drawn. Painting a tag over itself merges instead of stacking,
 * since one activity can't run alongside itself.
 *
 * `at` is { slot, lane }: where the pointer went down, and which lane that
 * height means. Without it the block lands underneath, as it always did.
 */
export function applyPaint(blocks, painted, at) {
  const sameTag = blocks.filter(
    (b) => b.tag === painted.tag && b.endSlot >= painted.startSlot && b.startSlot <= painted.endSlot,
  )

  if (sameTag.length === 0) {
    const index = at ? placeFor(blocks, at.slot, at.lane) : blocks.length
    return [...blocks.slice(0, index), painted, ...blocks.slice(index)]
  }

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
 * Dragging an edge must never change the height the block is drawn at — the
 * whole point is to change the times, not the stacking. So whatever height it
 * has now, it keeps over everything the new extent reaches: top stays top,
 * bottom stays bottom. A block wedged between two others keeps its exact place
 * in the order, since that is the only record of where it sits. One that isn't
 * overlapping anything has no height to keep, so it tucks under, the same as
 * painting it there would.
 */
export function applyResize(blocks, id, startSlot, endSlot) {
  if (endSlot <= startSlot) return blocks
  const target = blocks.find((b) => b.id === id)
  if (!target) return blocks

  const drawn = layoutLanes(blocks).find((p) => p.block.id === id)
  const moved = { ...target, startSlot, endSlot }
  const rest = blocks.filter((b) => b.id !== id)

  // Sharing with nothing means there is no height to keep.
  if (drawn.lanes === 1) return [...rest, moved]
  if (drawn.lane === 0) return [moved, ...rest]
  if (drawn.lane === drawn.lanes - 1) return [...rest, moved]
  return blocks.map((b) => (b.id === id ? moved : b))
}

export const removeBlock = (blocks, id) => blocks.filter((b) => b.id !== id)

export const setNote = (blocks, id, note) =>
  blocks.map((b) => (b.id === id ? { ...b, note } : b))

/**
 * Work out where every block should be drawn once overlaps are allowed.
 *
 * One rectangle per block, the same height and position for its whole length.
 * Blocks that overlap — directly, or through a chain of others — form a group
 * that divides the bar into lanes between them; everything else has the bar
 * to itself.
 *
 * A lane is where a block *starts*: it is drawn from there down to the floor
 * of the bar, and whatever is layered over it covers the lower part. So a
 * block is never left as a thin band floating in empty space, and every block
 * ends on the same line.
 *
 * Then whatever is still empty is given to the block beneath it, which can
 * only ever be the strip along the top of the bar. A block is cut where that
 * changes, so it comes back as one piece per run at the same height.
 *
 * Returns { block, from, to, lane, lanes, top, isFirst, isLast }, where `top`
 * is the lane the piece is drawn from and `lane` is still the block's own —
 * the band its name sits in, and what decides which of two blocks covers the
 * other.
 */
export function layoutLanes(blocks) {
  if (blocks.length === 0) return []

  // List order is stacking order, so a block sits one lane below the lowest
  // of the blocks it overlaps that were added before it. That is the least
  // deep it can go without ending up above something that should cover it.
  const lane = new Map()
  for (const block of blocks) {
    let above = -1
    for (const earlier of blocks) {
      if (earlier === block) break
      if (overlaps(earlier, block)) above = Math.max(above, lane.get(earlier))
    }
    lane.set(block, above + 1)
  }

  // Everything in one group is divided by the same number, or the blocks in
  // it wouldn't line up with each other. A group is as deep as its deepest
  // stack, and a block that overlaps nothing is a group of one at full
  // height.
  const lanes = new Map()
  for (const group of clustersOf(blocks)) {
    const depth = Math.max(...group.map((b) => lane.get(b))) + 1
    for (const block of group) lanes.set(block, depth)
  }

  // Second pass: fill what the first one leaves empty. A block reaches the
  // floor, so the only space that can be left is the strip along the top,
  // above whichever block is shallowest at that moment. That block gets it —
  // it is what was happening — but only across the stretch where nothing sits
  // above it, so the block is cut where it rises.
  const placed = blocks.map((block) => ({
    block,
    from: block.startSlot,
    to: block.endSlot,
    lane: lane.get(block),
    lanes: lanes.get(block),
  }))

  const cuts = [...new Set(placed.flatMap((p) => [p.from, p.to]))].sort((a, b) => a - b)
  const pieces = []
  for (const p of placed) {
    for (let i = 0; i < cuts.length - 1; i++) {
      const from = Math.max(p.from, cuts[i])
      const to = Math.min(p.to, cuts[i + 1])
      if (from >= to) continue
      const shallowest = placed
        .filter((o) => o.from <= from && o.to >= to)
        .reduce((a, b) => (a.lane <= b.lane ? a : b))
      const top = shallowest === p ? 0 : p.lane

      // One rectangle per run at the same height, so a block is only ever cut
      // where its top actually steps.
      const last = pieces[pieces.length - 1]
      if (last && last.block === p.block && last.to === from && last.top === top) last.to = to
      else pieces.push({ ...p, from, to, top })
    }
  }

  for (const p of placed) {
    const mine = pieces.filter((piece) => piece.block === p.block)
    // Rounded ends and grab strips belong to the outermost pieces only; the
    // joins between them are drawn square so a stepped block reads as one.
    mine[0].isFirst = true
    mine[mine.length - 1].isLast = true
  }

  return pieces
}

/** The blocks split into groups that overlap, directly or through others. */
function clustersOf(blocks) {
  const groups = []
  const seen = new Set()
  for (const block of blocks) {
    if (seen.has(block)) continue
    const group = [block]
    seen.add(block)
    for (let i = 0; i < group.length; i++) {
      for (const other of blocks) {
        if (seen.has(other) || !overlaps(group[i], other)) continue
        seen.add(other)
        group.push(other)
      }
    }
    groups.push(group)
  }
  return groups
}

/**
 * Every block joined to this one by overlap, directly or through others.
 * Each keeps its own note; this is only so the note panel can name what else
 * was running at the time. Sorted by start, so it reads in order.
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
