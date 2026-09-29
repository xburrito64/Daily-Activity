// The days of the year that are more than a date: which they are, the frost
// that grows over Christmas Eve and the cobwebs strung across Halloween.
//
// Only in Starlit, so far. Each festival is a date and a name; how it looks
// belongs to the theme (themes.css, Festive.jsx).

export const FESTIVALS = [
  { id: 'halloween', name: 'Halloween', month: 10, day: 31 },
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
