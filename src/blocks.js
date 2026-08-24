import { slotToTime, timeToSlot } from './time.js'

let seq = 0
export const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`

const byStart = (a, b) =>
  a.startSlot - b.startSlot || a.endSlot - b.endSlot || (a.id < b.id ? -1 : 1)

const overlaps = (a, b) => a.startSlot < b.endSlot && a.endSlot > b.startSlot

const span = (b) => b.endSlot - b.startSlot

/**
 * Which lane a block takes when several share a stretch of the bar.
 * The longest runs on top and shorter ones nest underneath it, so something
 * painted onto an existing block drops below it rather than covering it.
 * Equal spans fall back to the earlier start, then to the newer block, whose
 * id always sorts last — so the one you just painted still ends up at the
 * bottom.
 */
const byLane = (a, b) =>
  span(b) - span(a) || a.startSlot - b.startSlot || (a.id < b.id ? -1 : 1)

/**
 * Add a painted range. Different tags are allowed to overlap — they stack in
 * lanes when drawn. Painting a tag over itself merges instead of stacking,
 * since one activity can't run alongside itself.
 */
export function applyPaint(blocks, painted) {
  const sameTag = blocks.filter(
    (b) => b.tag === painted.tag && b.endSlot >= painted.startSlot && b.startSlot <= painted.endSlot,
  )

  if (sameTag.length === 0) return [...blocks, painted].sort(byStart)

  const keep = sameTag.reduce((a, b) => (byStart(a, b) <= 0 ? a : b))
  const notes = sameTag.map((b) => b.note).filter(Boolean)
  const merged = {
    ...keep,
    startSlot: Math.min(painted.startSlot, ...sameTag.map((b) => b.startSlot)),
    endSlot: Math.max(painted.endSlot, ...sameTag.map((b) => b.endSlot)),
    // Don't lose anything that was written on the blocks being absorbed.
    note: [...new Set(notes)].join('\n'),
  }
  return [...blocks.filter((b) => !sameTag.includes(b)), merged].sort(byStart)
}

/** Move one block's edges. Neighbours are left alone; overlaps just stack. */
export function applyResize(blocks, id, startSlot, endSlot) {
  if (endSlot <= startSlot) return blocks
  return blocks
    .map((b) => (b.id === id ? { ...b, startSlot, endSlot } : b))
    .sort(byStart)
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

  const sorted = [...blocks].sort(byLane)
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
  return [...blocks].sort(byStart).map(({ tag, startSlot, endSlot, note }) => {
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
