import { slotToTime, timeToSlot, SLOTS_PER_DAY } from './time.js'

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

  // Which of its pieces says where the block stands. A stretch it has to
  // itself says nothing — every block is lane 0 of 1 when it is alone — so
  // the answer comes from where it actually shares the bar, and from the
  // longest such stretch, which is the one you would point at.
  const mine = layoutLanes(blocks).filter((p) => p.block.id === id)
  const shared = mine.filter((p) => p.lanes > 1)
  const drawn = (shared.length > 0 ? shared : mine)
    .reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a))

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
 * The bar is divided by how many things were happening **at that moment** —
 * nothing else. Two at once is halves, three is thirds, one is the whole bar.
 *
 * That "at that moment" is the whole of it. It used to be worked out per
 * group: everything joined by a chain of overlaps was divided by the deepest
 * pile-up anywhere in that chain. So two hours of music with a walk during it
 * were drawn a third of the bar high, because the music brushed a game that
 * brushed a ten-minute meal four hours earlier — and nothing was three-deep at
 * the moment you were walking the dog. Height meant "how busy was the day
 * around here", which is not a thing anyone reads a bar for.
 *
 * A lane is where a block *starts*: it is drawn from there down to the floor
 * of the bar, and whatever is layered over it covers the lower part. So a
 * block is never left as a thin band floating in empty space, every block ends
 * on the same line, and the moment a neighbour stops the block beneath it
 * grows into the room that just came free.
 *
 * Which lane is list order, and list order is yours: paint or drop one block
 * over another and it goes above it. Nothing here reorders that.
 *
 * The one softening: the bar makes room ten minutes before anything starts,
 * holding the lane the new block will take, so that it gives way ahead of the
 * block rather than jolting on the slot it appears. Whatever sits above that
 * lane reaches the floor and fills it in the meantime, so nothing shows
 * through and nothing moves twice.
 *
 * Where the block was a short one, the room stays open ten minutes after it
 * too: a ten-minute meal would otherwise cut a notch exactly its own width —
 * a spike, rather than somewhere the day made room. An hour of something keeps
 * no such room after it, which would only leave whatever is beside it standing
 * higher than anything running there could account for.
 *
 * A block is cut only where that count genuinely changes, and each run comes
 * back as one piece.
 *
 * Returns { block, from, to, lane, lanes, top, index, isFirst, isLast }.
 */
export function layoutLanes(blocks) {
  if (blocks.length === 0) return []

  // What is running at each ten minutes of the day, in list order — which is
  // stacking order.
  const running = []
  for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
    running[slot] = blocks.filter((b) => b.startSlot <= slot && b.endSlot > slot)
  }

  const pieces = []
  const open = new Map() // block -> the run being extended
  for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
    const from = slot
    const to = slot + 1
    const here = running[slot]
    if (here.length === 0) continue

    // The bar makes its change ten minutes early and holds it ten minutes
    // late: a lane is kept for a block that starts next, and kept a moment
    // longer for one that has just stopped. So a block steps aside once,
    // ahead of the new one, rather than being shoved on the very slot it
    // appears — and a short block sits in a shelf rather than in a notch
    // exactly its own width.
    //
    // The lane is what is kept, not merely the room. The block that has to
    // move goes straight to the place it will hold, instead of rising into
    // the gap and dropping back out of it ten minutes later. Nothing shows
    // through a kept lane: whatever is above it reaches the floor and fills
    // it until the new block lands there.
    //
    // Only underneath everything drawn, though. A lane kept above something
    // running would push that block down for ten minutes and let it back up
    // the moment the new one arrived — and the block on top of the pile,
    // which reaches the floor, would swell down into the kept lane and shrink
    // out of it again, the line under it dipping and coming back for no
    // reason anybody watching could see. Room made early has to lift what is
    // already there, or it is not worth making.
    const lowest = blocks.indexOf(here[here.length - 1])
    const held = blocks.filter((b) => here.includes(b)
      || ((b.startSlot === to || b.endSlot === from) && blocks.indexOf(b) > lowest))

    // And only where it can be seen: a share of the bar that works out the
    // same either way is not worth cutting the block for.
    const same = here.every((b) => held.indexOf(b) * here.length === here.indexOf(b) * held.length)
    const claiming = same ? here : held
    const lanes = claiming.length

    here.forEach((block) => {
      const lane = claiming.indexOf(block)
      const last = open.get(block)
      // One rectangle per run at the same height, so a block is only cut
      // where the number of things beside it really changes.
      if (last && last.to === from && last.lane === lane && last.lanes === lanes) {
        last.to = to
        return
      }
      const piece = { block, from, to, lane, lanes, top: lane }
      open.set(block, piece)
      pieces.push(piece)
    })
  }

  for (const block of blocks) {
    const mine = pieces.filter((p) => p.block === block)
    if (mine.length === 0) continue
    // Rounded ends and grab strips belong to the outermost pieces only; the
    // joins between them are drawn square so a stepped block reads as one.
    mine[0].isFirst = true
    mine[mine.length - 1].isLast = true
    // Which piece of its block this is. Counting from the start of the block
    // rather than naming a piece after where it begins gives it an identity
    // that survives the block being dragged.
    mine.forEach((piece, at) => { piece.index = at })
  }

  return pieces
}


/**
 * The strips of a block that can actually be seen, left to right.
 *
 * A block is cut into pieces where the bar changes how many ways it divides.
 * That is not the only thing that changes how much of the block shows,
 * though: a neighbour can start and stop inside one piece without the count
 * ever changing. Ask a piece how much room it has and the answer is the one
 * from its worst moment, applied across its whole width — which is how a
 * block standing at full height for most of its length ended up wearing a
 * picture sized for the sliver a neighbour was sitting on, drawn up in the
 * corner rather than in the middle of it.
 *
 * So the cuts come from both: the block's own pieces, and the edges of
 * everything drawn over it. Each strip is then a rectangle that is the
 * block's alone, and neighbouring strips with the same top and bottom are one
 * rectangle again.
 */
export function stripsOf(mine, pieces) {
  const block = mine[0].block
  const over = pieces.filter(
    (p) => p.block !== block && p.from < block.endSlot && p.to > block.startSlot,
  )
  const cuts = [...new Set([
    ...mine.flatMap((p) => [p.from, p.to]),
    ...over.flatMap((p) => [p.from, p.to]),
  ])]
    .filter((slot) => slot >= block.startSlot && slot <= block.endSlot)
    .sort((a, b) => a - b)

  const strips = []
  for (let i = 0; i < cuts.length - 1; i++) {
    const from = cuts[i]
    const to = cuts[i + 1]
    const piece = mine.find((p) => p.from <= from && p.to >= to)
    if (!piece) continue
    // A strip lies inside one cut, so anything over it covers all of it.
    const under = over.filter((p) => p.lane > piece.lane && p.from <= from && p.to >= to)
    const floor = under.length > 0 ? Math.min(...under.map((p) => p.lane)) : piece.lanes
    const top = piece.lane / piece.lanes
    const bottom = floor / piece.lanes
    const last = strips[strips.length - 1]
    if (last && last.to === from && last.top === top && last.bottom === bottom) last.to = to
    else strips.push({ from, to, top, bottom })
  }
  return strips
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
