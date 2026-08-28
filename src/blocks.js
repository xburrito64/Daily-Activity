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
 * Whether two blocks are the same activity, and so cannot be two blocks.
 *
 * The tag says it for eighteen tags out of twenty. Games and anime are the
 * exceptions: finishing one and starting another is two things that happened,
 * and they are both tagged Game, or both tagged Anime. So what is being
 * played or watched counts too, and one nobody has named yet is its own
 * answer — it never folds into a named one, because there is no way to know
 * it was the same thing, and getting that wrong would put a name on time that
 * wasn't spent there.
 *
 * Which episodes deliberately do not count. Two stretches of the same show
 * back to back are one evening in front of it, whether you sat through three
 * episodes or one — the episodes join up rather than keeping the blocks
 * apart.
 */
const sameThing = (a, b) =>
  a.tag === b.tag && (a.game ?? '') === (b.game ?? '') && (a.show ?? '') === (b.show ?? '')

/**
 * Fold a block together with every block of the same activity it meets.
 *
 * One activity can't run alongside itself, so two stretches of it that touch
 * or overlap are one stretch — however they came to meet. Painting one over
 * the other, dragging an edge until it reaches, or sliding the whole block up
 * against it all end in the same place.
 *
 * Ends that merely touch count: a block ending at 14:00 and one starting at
 * 14:00 are not two things.
 *
 * The survivor is the earliest of them in the list and keeps its place, so
 * joining two blocks is not a reason to restack anything around them.
 */
function mergeSameTag(blocks, block) {
  const touching = blocks.filter(
    (b) => sameThing(b, block) && b.endSlot >= block.startSlot && b.startSlot <= block.endSlot,
  )
  if (touching.length < 2) return blocks

  const keep = touching[0]
  const notes = touching.map((b) => b.note).filter(Boolean)
  const episodes = touching.flatMap((b) => b.episodes ?? [])
  const merged = {
    ...keep,
    startSlot: Math.min(...touching.map((b) => b.startSlot)),
    endSlot: Math.max(...touching.map((b) => b.endSlot)),
    // Don't lose anything that was written on the blocks being absorbed.
    note: [...new Set(notes)].join('\n'),
    // Nor anything that was watched during them. Two stretches of one show
    // becoming one stretch means the evening was all of those episodes.
    ...(episodes.length > 0 ? { episodes: [...new Set(episodes)].sort((a, b) => a - b) } : {}),
  }
  return blocks
    .filter((b) => b === keep || !touching.includes(b))
    .map((b) => (b === keep ? merged : b))
}

/**
 * Add a painted range. Different tags are allowed to overlap — they stack in
 * lanes when drawn. Painting a tag over itself merges instead of stacking.
 *
 * `at` is { slot, lane }: where the pointer went down, and which lane that
 * height means. Without it the block lands underneath, as it always did.
 */
export function applyPaint(blocks, painted, at) {
  const index = at ? placeFor(blocks, at.slot, at.lane) : blocks.length
  return mergeSameTag([...blocks.slice(0, index), painted, ...blocks.slice(index)], painted)
}

/**
 * Move one block's edges, or the whole block. Neighbours are left alone;
 * overlaps just stack, and meeting its own tag merges.
 *
 * With an `at` of { slot, lane } the block is being slid bodily, and that is
 * the height the pointer is asking for — read the same way painting reads it,
 * so dropping a block on the upper half of something puts it above rather
 * than always underneath.
 *
 * Without one, an edge is being dragged, and that must never change the
 * height the block is drawn at: the point is to change the times, not the
 * stacking. So whatever height it has now, it keeps over everything the new
 * extent reaches — top stays top, bottom stays bottom. A block wedged between
 * two others keeps its exact place in the order, since that is the only
 * record of where it sits. One that isn't overlapping anything has no height
 * to keep, so it tucks under, the same as painting it there would.
 */
export function applyResize(blocks, id, startSlot, endSlot, at) {
  if (endSlot <= startSlot) return blocks
  const target = blocks.find((b) => b.id === id)
  if (!target) return blocks

  const moved = { ...target, startSlot, endSlot }
  const rest = blocks.filter((b) => b.id !== id)

  if (at) {
    const index = placeFor(rest, at.slot, at.lane)
    return mergeSameTag([...rest.slice(0, index), moved, ...rest.slice(index)], moved)
  }

  const drawn = layoutLanes(blocks).find((p) => p.block.id === id)
  // Sharing with nothing means there is no height to keep.
  const placed = drawn.lanes === 1 || drawn.lane === drawn.lanes - 1
    ? [...rest, moved]
    : drawn.lane === 0
      ? [moved, ...rest]
      : blocks.map((b) => (b.id === id ? moved : b))
  return mergeSameTag(placed, moved)
}

export const removeBlock = (blocks, id) => blocks.filter((b) => b.id !== id)

export const setNote = (blocks, id, note) =>
  blocks.map((b) => (b.id === id ? { ...b, note } : b))

/**
 * Say what was being played, or take it back off.
 *
 * `game` is { name, cover } or null. The cover is only ever the file the
 * picture was saved as — the name is the record, and it is what the note in
 * the vault reads as with nothing else installed.
 *
 * Naming a block can leave it up against another stretch of the same game
 * that it was already touching, so it merges on the way out, exactly as it
 * would have if the two had been dragged together.
 */
export function setGame(blocks, id, game) {
  const named = blocks.map((b) => (
    b.id === id ? { ...b, game: game?.name ?? '', cover: game?.cover ?? '' } : b
  ))
  const target = named.find((b) => b.id === id)
  return target ? mergeSameTag(named, target) : named
}

/**
 * Say what was being watched, and which of it, or take it back off.
 *
 * `show` is { name, cover, episodes } or null. The same bargain the game
 * above strikes: the name and the episodes are the record and are written out
 * in the note, the cover is only ever the file the picture was saved as.
 *
 * Changing to a different show drops the episodes with it. Episode 7 of one
 * thing is not episode 7 of another, and carrying the numbers across would be
 * a quiet lie about an evening rather than an empty field.
 */
export function setShow(blocks, id, show) {
  const named = blocks.map((b) => (b.id === id
    ? {
      ...b,
      show: show?.name ?? '',
      cover: show?.cover ?? '',
      episodes: show?.name ? [...new Set(show.episodes ?? [])].sort((a, b2) => a - b2) : [],
    }
    : b))
  const target = named.find((b) => b.id === id)
  return target ? mergeSameTag(named, target) : named
}

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
 * Returns { block, from, to, lane, lanes, top, index, isFirst, isLast }, where
 * `top` is the lane the piece is drawn from and `lane` is still the block's
 * own — the band its name sits in, and what decides which of two blocks
 * covers the other.
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
    // Which piece of its block this is. Counting from the start of the block
    // rather than naming a piece after where it begins gives it an identity
    // that survives the block being dragged: the same piece stays the same
    // piece, at new times, instead of looking like a different one.
    mine.forEach((piece, i) => { piece.index = i })
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
  return blocks.map(({ tag, startSlot, endSlot, note, game, show, episodes, cover }) => {
    const entry = { tag, start: slotToTime(startSlot), end: slotToTime(endSlot) }
    if (note) entry.note = note
    // The name goes in whether or not there is a picture; the picture is no
    // use on its own, so it only goes in behind the name.
    if (game) entry.game = game
    if (show) entry.show = show
    if (show && episodes?.length) entry.episodes = episodes
    if ((game || show) && cover) entry.cover = cover
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
    game: e.game ?? '',
    show: e.show ?? '',
    episodes: e.episodes ?? [],
    cover: e.cover ?? '',
  }))
}
