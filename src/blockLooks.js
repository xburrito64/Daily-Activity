// What the block looks in styles/app.css ("Block looks") need to know about a
// piece of a block that CSS cannot work out for itself.
//
// A block is drawn from where its lane starts down to the floor of the bar,
// and whatever is layered over it hides its lower part. Where it steps around
// an overlap it is several pieces side by side. So a piece has to be told
// three things: where it starts down the bar, so shading can be measured on
// the whole bar and run straight across a step; how deep the part of it that
// shows is, so what sits in the middle sits in the middle of what you see;
// and how far an end of it stands clear of the piece beside it, which is an
// edge of the block like any other and is drawn as one.
//
// Lengths come back as CSS, in container units of the .blocks box the piece
// sits in (100cqh is the bar), so they hold at any zoom without being told it.

/** How far down the bar a piece starts, as a fraction of the bar. */
const depth = (piece) => piece.top / piece.lanes

/** The top of a piece as CSS, the same value its own `top` is drawn at. */
const topOf = (piece) => (piece.top === 0 ? 'var(--block-inset)' : `calc(100cqh * ${depth(piece)})`)

/**
 * The custom properties for one piece, and whether either end is a step.
 * `before` and `after` are the pieces of the same block either side of it,
 * where there are any.
 */
export function pieceLook(piece, before, after) {
  // Inset against the bar's own ceiling and floor, not against a neighbour.
  const insets = (piece.top === 0 ? 1 : 0) + (piece.top === piece.lanes - 1 ? 1 : 0)
  const vars = {
    '--top': topOf(piece),
    '--band': `calc(100cqh / ${piece.lanes} - ${insets} * var(--block-inset))`,
  }
  // A neighbour that starts lower down leaves this end showing from the top
  // of this piece down to the top of that one.
  const stepStart = !!before && depth(before) > depth(piece)
  const stepEnd = !!after && depth(after) > depth(piece)
  if (stepStart) vars['--step-l'] = `calc(${topOf(before)} - ${topOf(piece)})`
  if (stepEnd) vars['--step-r'] = `calc(${topOf(after)} - ${topOf(piece)})`
  return { vars, stepStart, stepEnd }
}

/** One rune and the space after it, in px; and the room kept at each end. */
export const RUNE_CELL = 10
export const RUNE_MARGIN = 12
/** Below this many px of block showing, a line of runes is only clutter. */
export const RUNES_MIN_BAND = 16

/** Room kept clear between the runes and a name or picture drawn over them. */
export const RUNE_HOLE_ROOM = 8

/**
 * Where a line of runes goes along one piece of a block, in px along the bar.
 *
 * Only whole runes, never one cut off by an end: the block is given as many
 * as fit with RUNE_MARGIN clear at both ends, and the line is centred on it.
 * A piece shows the runes that fall wholly inside it, so at a step — where
 * the line moves to the middle of what shows — no rune is split across the
 * two heights. And `hole`, where the block's name sits across the line, is
 * left clear by RUNE_HOLE_ROOM either side, the way the dotted line on an
 * empty day parts for its words.
 *
 * Returns up to two stretches, left to right, each { left, right, shift }:
 * how far in from the piece's left and right it starts and stops, and where
 * the pattern starts relative to that (zero or less), so every stretch of a
 * block reads on from the same first rune. Empty where not one whole rune
 * fits, or nowhere two runes fit side by side.
 */
export function runeSpans(blockFrom, blockTo, from, to, hole = null, cell = RUNE_CELL, margin = RUNE_MARGIN) {
  const count = Math.floor((blockTo - blockFrom - 2 * margin) / cell)
  if (count < 1) return []
  const origin = Math.round(blockFrom + (blockTo - blockFrom - count * cell) / 2)
  const fits = (k) => {
    const lo = origin + k * cell
    const hi = lo + cell
    if (lo < from || hi > to) return false
    return !hole || hi <= hole[0] - RUNE_HOLE_ROOM || lo >= hole[1] + RUNE_HOLE_ROOM
  }
  const runs = []
  for (let k = 0; k < count; k++) {
    if (!fits(k)) continue
    const last = runs[runs.length - 1]
    if (last && last.to === k) last.to = k + 1
    else runs.push({ from: k, to: k + 1 })
  }
  // A rune left on its own beside a name or a cut reads as a stray mark, not
  // as part of a line; it takes two to be one.
  return runs.filter((run) => run.to - run.from >= 2).slice(0, 2).map((run) => {
    const lo = origin + run.from * cell
    const hi = origin + run.to * cell
    return { left: lo - from, right: to - hi, shift: origin - lo }
  })
}
