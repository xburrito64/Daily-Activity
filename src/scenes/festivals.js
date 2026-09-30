// The days of the year that are more than a date: which they are, the frost
// that grows over Christmas Eve, the fir of the four Sundays of Advent, the
// cobwebs strung across Halloween, and the blossom and the flower field of
// Easter.
//
// Only in Starlit, so far. Each festival is a date and a name; how it looks
// belongs to the theme (themes.css, Festive.jsx).

/**
 * Easter Sunday in a given year, by the Gregorian computus: the first Sunday
 * after the first full moon on or after the spring equinox, as the church
 * reckons them. Returns { month, day }.
 */
export function easterSunday(year) {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const n = h + l - 7 * m + 114
  return { month: Math.floor(n / 31), day: (n % 31) + 1 }
}

/**
 * The four Sundays of Advent in a given year, first to fourth, as
 * { month, day }. The fourth is the last Sunday before Christmas Day, so in a
 * year when Christmas Eve is a Sunday, it is Christmas Eve; each of the
 * others is a week before the next.
 */
export function adventSundays(year) {
  const eve = new Date(Date.UTC(year, 11, 24))
  const fourth = Date.UTC(year, 11, 24 - eve.getUTCDay())
  return [3, 2, 1, 0].map((weeks) => {
    const d = new Date(fourth - weeks * 7 * 86400000)
    return { month: d.getUTCMonth() + 1, day: d.getUTCDate() }
  })
}

const ORDINALS = ['First', 'Second', 'Third', 'Fourth']

// A festival on the same date every year has a month and a day; one that
// moves has `on`, which finds its date in a given year; one that comes more
// than once has `match`, which says which of it a date is, if any.
// Christmas Eve comes before Advent: in a year it falls on the fourth Sunday
// of Advent, it is Christmas Eve that day.
export const FESTIVALS = [
  { id: 'easter', name: 'Easter', on: easterSunday },
  { id: 'halloween', name: 'Halloween', month: 10, day: 31 },
  { id: 'christmas-eve', name: 'Christmas Eve', month: 12, day: 24 },
  {
    id: 'advent',
    match: (year, month, day) => {
      const nth = adventSundays(year).findIndex((d) => d.month === month && d.day === day)
      return nth < 0 ? null : { id: 'advent', name: `${ORDINALS[nth]} Advent`, nth: nth + 1 }
    },
  },
]

/** The festival falling on this date (YYYY-MM-DD), or null. */
export function festivalOf(date) {
  const m = String(date ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  for (const f of FESTIVALS) {
    if (f.match) {
      const found = f.match(year, month, day)
      if (found) return found
      continue
    }
    const at = f.on ? f.on(year) : f
    if (at.month === month && at.day === day) return f
  }
  return null
}

/** The same small generator the star field uses: one seed, one picture. */
function seeded(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Frost on a window pane, grown in from its top-left corner, the way ice
 * flowers grow on glass: feathers of ice, each a gently curving stem with
 * barbs off both sides all the way along, leaning forward and shortening
 * toward its tip, the longer barbs feathered again. Where the cold starts
 * the glass is matt with rime, a dust of tiny crystals, thinning outward.
 *
 * `corner` feathers start in the corner itself, `top` along the top edge and
 * `side` down the left one, spread over the first `spread` of each edge, the
 * top ones leaning `slant` radians down from the edge. The rime gathers in
 * the corner, or with `rime: 'edge'` all along the top edge.
 *
 * Returns line segments on a `w` by `h` pane, each with the width and
 * strength it is drawn at, the grains of rime, and a few glints. Always the
 * same pane for the same seed.
 */
export function frostFerns(w, h, seed = 24, {
  corner = 3, top = 4, side = 4, spread = 0.7, slant = 1.0, rime = 'corner', grains = 1400,
} = {}) {
  const rand = seeded(seed)
  const lines = []
  const reach = Math.hypot(w, h)

  const feather = (x, y, angle, length, depth, width, bend) => {
    const step = Math.max(depth === 0 ? 2 : 1.6, length / 44)
    const count = Math.max(2, Math.floor(length / step))
    let a = angle
    for (let i = 0; i < count; i++) {
      a += bend / count + (rand() - 0.5) * 0.06
      const nx = x + Math.cos(a) * step
      const ny = y + Math.sin(a) * step
      const along = i / count
      lines.push({
        x0: x, y0: y, x1: nx, y1: ny,
        width: width * (1 - along * 0.75),
        alpha: (0.46 - along * 0.26) * [0.6, 0.8, 1][depth],
      })
      // Barbs off both sides, a gap here and there, curving back toward
      // the way the stem is growing.
      if (depth > 0 && (depth === 2 || i % 2 === 0)) {
        const room = length * (1 - along)
        const barb = room * (depth === 2 ? 0.2 : 0.3) * (0.7 + rand() * 0.6)
        if (barb > (depth === 2 ? 3 : 5)) {
          for (const turn of [-1, 1]) {
            if (rand() < 0.12) continue
            feather(nx, ny, a + turn * (0.72 + (rand() - 0.5) * 0.16), barb, depth - 1, width * 0.55, -turn * 0.25)
          }
        }
      }
      x = nx
      y = ny
    }
  }

  // From the corner itself, fanning out across the pane.
  for (let i = 0; i < corner; i++) {
    const angle = 0.2 + (i / Math.max(1, corner - 1)) * 1.15 + (rand() - 0.5) * 0.15
    feather(0, 0, angle, reach * (0.3 + rand() * 0.12), 2, 1.5, (rand() - 0.5) * 0.8)
  }
  // Along both edges, shorter the further from the corner they start.
  for (let i = 0; i < top; i++) {
    const k = (i + 0.5 + (rand() - 0.5) * 0.6) / top
    feather(w * spread * k, 0, slant + (rand() - 0.5) * 0.4, reach * 0.26 * (1 - k * 0.7), 2, 1.3, (rand() - 0.5) * 0.9)
  }
  for (let i = 0; i < side; i++) {
    const k = (i + 0.5 + (rand() - 0.5) * 0.6) / side
    feather(0, h * spread * k, 0.4 + (rand() - 0.5) * 0.4, reach * 0.26 * (1 - k * 0.7), 2, 1.3, (rand() - 0.5) * 0.9)
  }

  const kept = lines.filter((l) => l.alpha > 0.02)

  // The rime: grains of ice, thickest where the frost began.
  const dust = []
  for (let i = 0; i < grains; i++) {
    let x
    let y
    let near
    if (rime === 'edge') {
      const depth = rand() ** 1.8
      x = w * spread * rand()
      y = h * 0.3 * depth
      near = 1 - depth
    } else {
      const d = reach * 0.4 * rand() ** 1.7
      const t = rand() * Math.PI * 0.5
      x = Math.cos(t) * d
      y = Math.sin(t) * d
      near = 1 - d / (reach * 0.4)
    }
    dust.push({ x, y, r: 0.3 + rand() * 0.8, alpha: 0.5 * near * (0.3 + rand() * 0.7) })
  }

  // Glints: points on the ice that catch the light.
  const glints = []
  for (let i = 0; i < 22; i++) {
    const l = kept[Math.floor(rand() * kept.length)]
    glints.push({ x: l.x1, y: l.y1, r: 0.6 + rand() * 1.0 })
  }
  return { lines: kept, rime: dust, glints }
}

/**
 * A cobweb strung across the top-left corner of a `w` by `h` pane: spokes
 * out from the corner to the edges, and the silk laid round them ring by
 * ring, each strand sagging a little toward the corner between its spokes.
 * A strand or two is broken, as in any web that has seen some weather, and
 * a few drops of dew have settled where the silk crosses a spoke.
 *
 * Returns the spokes as lines, the silk as curves (a start, a pull and an
 * end), and the dew. Always the same web for the same seed.
 */
export function cobweb(w, h, seed = 31, { spokes = 8, rings = 10, reach = 0.92 } = {}) {
  const rand = seeded(seed)
  const angles = []
  for (let i = 0; i < spokes; i++) {
    const a = 0.05 + (i / (spokes - 1)) * (Math.PI / 2 - 0.1) + (rand() - 0.5) * 0.09
    angles.push(Math.max(0.02, Math.min(Math.PI / 2 - 0.02, a)))
  }
  // Each spoke runs to the edge of the pane.
  const lengths = angles.map((a) => Math.min(w / Math.cos(a), h / Math.sin(a)))
  const lines = angles.map((a, i) => ({
    x0: 0, y0: 0, x1: Math.cos(a) * lengths[i], y1: Math.sin(a) * lengths[i], alpha: 0.42,
  }))

  const outer = Math.min(w, h) * reach
  const silk = []
  const dew = []
  for (let k = 1; k <= rings; k++) {
    const base = outer * (k / rings) ** 0.92
    const at = angles.map(() => base * (1 + (rand() - 0.5) * 0.08))
    for (let i = 0; i < spokes - 1; i++) {
      const r0 = Math.min(at[i], lengths[i])
      const r1 = Math.min(at[i + 1], lengths[i + 1])
      if (rand() < 0.07) continue // broken
      const x0 = Math.cos(angles[i]) * r0
      const y0 = Math.sin(angles[i]) * r0
      const x1 = Math.cos(angles[i + 1]) * r1
      const y1 = Math.sin(angles[i + 1]) * r1
      const sag = 0.1 + rand() * 0.08
      silk.push({
        x0, y0, x1, y1,
        cx: ((x0 + x1) / 2) * (1 - sag), cy: ((y0 + y1) / 2) * (1 - sag),
        alpha: 0.36 - (k / rings) * 0.12,
      })
      if (rand() < 0.1) dew.push({ x: x0, y: y0, r: 0.7 + rand() * 0.9 })
    }
  }
  return { lines, silk, dew }
}

/**
 * A branch in blossom reaching in over the top-left corner of a `w` by `h`
 * pane: a crooked bough out along the top edge, twigs off it bending down,
 * and blossom gathered at their tips, five petals each, with a few leaves.
 *
 * Returns the wood as tapering segments, the blossoms (where, how big, which
 * of four tints, turned how far) and the leaves. Always the same branch for
 * the same seed.
 */
export function blossomBranch(w, h, seed = 12) {
  const rand = seeded(seed)
  const wood = []
  const blossoms = []
  const leaves = []
  const grow = (x, y, angle, length, width, depth) => {
    const steps = Math.max(3, Math.floor(length / 7))
    let a = angle
    for (let i = 0; i < steps; i++) {
      a += (rand() - 0.5) * 0.35
      const nx = x + Math.cos(a) * (length / steps)
      const ny = y + Math.sin(a) * (length / steps)
      const along = i / steps
      wood.push({ x0: x, y0: y, x1: nx, y1: ny, width: width * (1 - along * 0.6) })
      if (depth > 0 && i > 0 && rand() < 0.32) {
        const turn = rand() < 0.7 ? 1 : -1 // twigs mostly hang down
        grow(nx, ny, a + turn * (0.5 + rand() * 0.6), length * (0.3 + rand() * 0.25), width * 0.55, depth - 1)
      }
      if (depth < 2 && rand() < 0.16) {
        blossoms.push({ x: nx + (rand() - 0.5) * 6, y: ny + (rand() - 0.5) * 6, r: 2.4 + rand() * 2.2, tone: Math.floor(rand() * 4), turn: rand() * Math.PI })
      }
      if (rand() < 0.22) leaves.push({ x: nx, y: ny, angle: a + (rand() < 0.5 ? 1 : -1) * (0.7 + rand() * 0.5), length: 5 + rand() * 5 })
      x = nx
      y = ny
    }
    // A little cluster at the tip.
    for (let i = 0; i < 2 + Math.floor(rand() * 2); i++) {
      blossoms.push({ x: x + (rand() - 0.5) * 9, y: y + (rand() - 0.5) * 7, r: 2.8 + rand() * 2.4, tone: Math.floor(rand() * 4), turn: rand() * Math.PI })
    }
  }
  grow(-4, h * 0.08, 0.12, w * 0.8, 3.2, 2)
  grow(-4, h * 0.3, 0.45, w * 0.35, 2.2, 1)
  return { wood, blossoms, leaves }
}

/**
 * A field of flowers along the foot of a `w` wide pane, `h` tall: grass
 * blades leaning this way and that, and flowers standing among them, each
 * of four kinds, the taller ones fewer. Positions are measured up from the
 * bottom. Always the same field for the same seed and width.
 */
export function meadow(w, h, seed = 5) {
  const rand = seeded(seed)
  const blades = []
  const flowers = []
  for (let x = 0; x < w; x += 2.2 + rand() * 2.6) {
    blades.push({ x, height: h * (0.18 + rand() ** 1.6 * 0.5), lean: (rand() - 0.5) * 14, width: 1.2 + rand() * 1.6 })
  }
  for (let x = 6; x < w; x += 12 + rand() * 30) {
    const tall = rand()
    flowers.push({
      x: x + (rand() - 0.5) * 8,
      height: h * (0.22 + tall ** 1.8 * 0.6),
      lean: (rand() - 0.5) * 10,
      r: 2.6 + rand() * 2.8,
      kind: Math.floor(rand() * 4),
      turn: rand() * Math.PI,
    })
  }
  return { blades, flowers }
}

/**
 * A fir bough reaching in from the top-left corner of a `w` by `h` pane:
 * a branch out along the top edge, drooping a little under its own weight,
 * twigs off both sides, and every stick of it thick with needles leaning
 * toward its tip; red berries in clusters here and there, and a small gold
 * star hanging off a twig on a thread. With `side`, a second bough comes
 * down the left edge as well.
 *
 * Returns the wood, the needles (each with one of three greens), the
 * berries and the hanging stars. Always the same bough for the same seed.
 */
export function firBough(w, h, seed = 3, { reach = 0.8, side = false, stars = 1 } = {}) {
  const rand = seeded(seed)
  const wood = []
  const needles = []
  const berries = []
  const tips = []
  const grow = (x, y, angle, length, width, depth, droop) => {
    const step = 2.4
    const count = Math.max(3, Math.floor(length / step))
    let a = angle
    for (let i = 0; i < count; i++) {
      a += droop / count + (rand() - 0.5) * 0.08
      const nx = x + Math.cos(a) * step
      const ny = y + Math.sin(a) * step
      const along = i / count
      wood.push({ x0: x, y0: y, x1: nx, y1: ny, width: width * (1 - along * 0.6) })
      const size = (depth === 1 ? 9 : 6.5) * (1 - along * 0.45)
      for (const turn of [-1, 1]) {
        const n = a + turn * (0.95 + (rand() - 0.5) * 0.3)
        needles.push({ x0: nx, y0: ny, x1: nx + Math.cos(n) * size, y1: ny + Math.sin(n) * size, tone: Math.floor(rand() * 3) })
      }
      if (depth === 1 && i > 2 && i % 4 === 0) {
        const turn = i % 8 === 0 ? 1 : -1
        grow(nx, ny, a + turn * (0.75 + rand() * 0.3), length * (1 - along) * (0.28 + rand() * 0.14), width * 0.5, 0, turn * 0.2 + 0.15)
      }
      x = nx
      y = ny
    }
    tips.push({ x, y })
  }
  grow(-6, h * 0.06, 0.1, w * reach, 2.6, 1, 0.3)
  if (side) grow(w * 0.05, -6, 1.45, h * reach, 2.6, 1, -0.3)
  for (let i = 0; i < 7; i++) {
    const t = wood[Math.floor(rand() * wood.length * 0.7)]
    for (let k = 0; k < 3; k++) berries.push({ x: t.x1 + (rand() - 0.5) * 6, y: t.y1 + 2 + rand() * 4, r: 1.5 + rand() * 0.8 })
  }
  // Stars hang from twigs that come down into the pane, not ones reaching
  // up out of it.
  const hanging = tips
    .filter((t) => t.y > h * 0.12 && t.x > w * 0.12 && t.x < w * 0.7)
    .slice(0, Math.max(0, stars))
    .map((t) => ({ x: t.x, y: t.y + 1, drop: 10 + rand() * 8 }))
  return { wood, needles, berries, stars: hanging }
}
