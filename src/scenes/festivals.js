// The days of the year that are more than a date: which they are, and the
// frost that grows over Christmas Eve.
//
// Only Christmas Eve for now, and only in Starlit. Each festival is a date
// and a name; how it looks belongs to the theme (themes.css, Festive.jsx).

export const FESTIVALS = [
  { id: 'christmas-eve', name: 'Christmas Eve', month: 12, day: 24 },
]

/** The festival falling on this date (YYYY-MM-DD), or null. */
export function festivalOf(date) {
  const m = String(date ?? '').match(/^\d{4}-(\d{2})-(\d{2})$/)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  return FESTIVALS.find((f) => f.month === month && f.day === day) ?? null
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
