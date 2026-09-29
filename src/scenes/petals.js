// The arithmetic of Petalfall, apart from the drawing so it can be checked.
//
// The branch across the top of the page is made of your days: one place on
// it for each of the last few weeks, oldest by the trunk and today at the
// tip. A day with anything logged on it is a blossom; a day with nothing is
// a bud, still closed.

import { shiftDate, MINUTES_PER_SLOT } from '../time.js'

export const BRANCH_DAYS = 30

/**
 * The days on the branch, oldest first, each with whether it bloomed and how
 * much of it was logged. Time is counted once however many blocks overlap,
 * because two things at once is still one hour.
 */
export function branchDays(days, today, count = BRANCH_DAYS) {
  const out = []
  for (let back = count - 1; back >= 0; back--) {
    const date = shiftDate(today, -back)
    const blocks = days?.[date]?.blocks ?? []
    const covered = new Set()
    for (const b of blocks) for (let s = b.startSlot; s < b.endSlot; s++) covered.add(s)
    out.push({ date, bloom: covered.size > 0, minutes: covered.size * MINUTES_PER_SLOT })
  }
  return out
}

/** A small seeded random, so the branch grows the same shape every time. */
export function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const bezier = (p0, p1, p2, p3, t) => {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

/**
 * The branch's shape inside a box: a bough from the right-hand edge, where
 * the trunk would be, reaching left and a little down, and one place on it
 * for each day, each on a short twig to one side or the other.
 *
 * Only geometry — where things go and how big — so the same shape can be
 * drawn at any size and checked without a canvas.
 */
export function growBranch(box, count, seed = 7) {
  const rand = seeded(seed)
  const { x0, x1, y0, y1 } = box
  const w = x1 - x0
  const h = y1 - y0
  const p0 = { x: x1 + 24, y: y0 + h * 0.3 }
  const p1 = { x: x1 - w * 0.3, y: y0 + h * 0.05 }
  const p2 = { x: x0 + w * 0.35, y: y0 + h * 0.85 }
  const p3 = { x: x0 + 8, y: y0 + h * 0.5 }

  const bough = []
  for (let i = 0; i <= 48; i++) bough.push(bezier(p0, p1, p2, p3, i / 48))

  const reach = Math.min(h * 0.42, 30)
  const nodes = []
  for (let i = 0; i < count; i++) {
    // Oldest by the trunk, today at the tip.
    const t = 0.1 + (i / Math.max(1, count - 1)) * 0.88
    const at = bezier(p0, p1, p2, p3, t)
    const ahead = bezier(p0, p1, p2, p3, Math.min(1, t + 0.01))
    const angle = Math.atan2(ahead.y - at.y, ahead.x - at.x)
    const side = i % 2 === 0 ? 1 : -1
    const along = reach * (0.3 + rand() * 0.7)
    const tilt = angle + side * (Math.PI / 2 - 0.5 + rand() * 0.5)
    nodes.push({
      stem: at,
      x: at.x + Math.cos(tilt) * along,
      y: at.y + Math.sin(tilt) * along,
      turn: rand() * Math.PI * 2,
      size: 0.7 + rand() * 0.55,
      // How thick the bough is here: thick by the trunk, fine at the tip.
      width: 5.5 * (1 - t) + 1.2,
    })
  }

  // A few bare twigs between the days, so the branch reads as grown.
  const twigs = []
  for (let i = 0; i < 7; i++) {
    const t = 0.15 + rand() * 0.75
    const at = bezier(p0, p1, p2, p3, t)
    const side = rand() < 0.5 ? 1 : -1
    const tilt = -Math.PI / 2 * side + (rand() - 0.5) * 0.9 + Math.PI
    const len = reach * (0.6 + rand() * 0.8)
    twigs.push({ from: at, to: { x: at.x + Math.cos(tilt) * len, y: at.y + Math.sin(tilt) * len } })
  }

  return { bough, nodes, twigs, widths: bough.map((_, i) => 6 * (1 - i / 48) + 1.2) }
}

/** What hovering a place on the branch says. */
export function branchWords(day) {
  if (!day) return ''
  if (!day.bloom) return 'still in bud — nothing logged'
  const h = Math.floor(day.minutes / 60)
  const m = day.minutes % 60
  const time = h === 0 ? `${m} min` : m === 0 ? `${h}h` : `${h}h ${m}m`
  return `${time} in bloom`
}
