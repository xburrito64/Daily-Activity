import { useEffect, useRef } from 'react'
import { frostFerns } from './festivals.js'
import { runLoop, stillness } from './loop.js'

// Christmas Eve, in Starlit.
//
// Wherever it falls in the list, the day is rimed: frost grown in over the
// ends of its bar, its date in ice, a snowflake for its diamond and a gift
// sealed in wax beside it. Painting on it casts a
// frost sigil that breaks into snow crystals.
//
// And on the night itself the whole sky joins in: the northern lights over
// the grimoire, the guiding star, frost creeping in at the corners of the
// window, and snow falling across everything.
//
// All of it is drawn once and then only shown, apart from the snow, which
// runs on the shared clock (loop.js) like every other scene.

/** A gift, wrapped in midnight blue, tied in crimson, sealed with a star. */
export function Gift({ glint = false }) {
  return (
    <span className={`gift${glint ? ' glint' : ''}`} title="Christmas Eve" aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="gift-bow" d="M13 8.6C11.9 5 7.6 3.6 6.9 5.8c-.6 1.9 2.9 2.9 6.1 2.8Z" />
        <path className="gift-bow" d="M13 8.6c1.1-3.6 5.4-5 6.1-2.8.6 1.9-2.9 2.9-6.1 2.8Z" />
        <rect className="gift-box" x="5" y="12" width="16" height="11.6" rx="0.6" />
        <circle className="gift-star" cx="8.2" cy="15.3" r="0.6" />
        <circle className="gift-star" cx="18" cy="15.6" r="0.45" />
        <circle className="gift-star" cx="17.6" cy="20.6" r="0.6" />
        <circle className="gift-star" cx="8.7" cy="20.9" r="0.4" />
        <rect className="gift-ribbon" x="11.6" y="12" width="2.8" height="11.6" />
        <rect className="gift-lid" x="3.8" y="8.6" width="18.4" height="3.9" rx="0.6" />
        <rect className="gift-ribbon" x="11.6" y="8.6" width="2.8" height="3.9" />
        <path className="gift-snow" d="M3.9 9.7c.3-1.3 1.5-1.6 2.4-1.1.8-1 2.4-.9 3 0 .6-.5 1.5-.5 2 .1h3.6c.7-.8 2-.9 2.7-.2.8-.7 2.3-.6 2.8.3.8-.2 1.7.1 1.9 1Z" />
        <circle className="gift-seal" cx="13" cy="10.9" r="2.2" />
        <path className="gift-sigil" d="m13 9.6.38.92.92.38-.92.38-.38.92-.38-.92-.92-.38.92-.38Z" />
      </svg>
    </span>
  )
}

// --- frost ----------------------------------------------------------------
// Two panes of frost, grown once and shared as pictures: a large one for the
// corners of the window, and a long low one for the ends of a bar, where it
// is shown a good deal smaller.

let frostMade = null
export function makeFrost() {
  if (frostMade) return frostMade
  const pane = (w, h, seed, { boldness = 1, mist = 0.2, edge = false, ...growth } = {}) => new Promise((resolve) => {
    const scale = 2
    const c = document.createElement('canvas')
    c.width = w * scale
    c.height = h * scale
    const g = c.getContext('2d')
    g.scale(scale, scale)
    const reach = Math.hypot(w, h)
    // A breath of mist where the cold is.
    const haze = g.createRadialGradient(0, 0, 0, 0, 0, reach * 0.62)
    haze.addColorStop(0, `rgba(200, 226, 255, ${mist})`)
    haze.addColorStop(1, 'rgba(200, 226, 255, 0)')
    g.fillStyle = haze
    g.fillRect(0, 0, w, h)
    const { lines, rime, glints } = frostFerns(w, h, seed, growth)
    for (const d of rime) {
      g.fillStyle = `rgba(232, 244, 255, ${d.alpha.toFixed(3)})`
      g.fillRect(d.x - d.r / 2, d.y - d.r / 2, d.r, d.r)
    }
    // The feathers on a sheet of their own, stroked in batches of the same
    // width and strength (there are tens of thousands of little lines), then
    // laid in twice: once softened, for the glow of the ice, once sharp.
    const sheet = document.createElement('canvas')
    sheet.width = c.width
    sheet.height = c.height
    const f = sheet.getContext('2d')
    f.scale(scale, scale)
    f.lineCap = 'round'
    const batches = new Map()
    for (const l of lines) {
      const key = `${Math.min(1, l.alpha * boldness).toFixed(2)}|${(l.width * boldness).toFixed(1)}`
      if (!batches.has(key)) batches.set(key, [])
      batches.get(key).push(l)
    }
    for (const [key, list] of batches) {
      const [alpha, width] = key.split('|').map(Number)
      f.strokeStyle = `rgba(232, 245, 255, ${alpha})`
      f.lineWidth = Math.max(0.35, width)
      f.beginPath()
      for (const l of list) { f.moveTo(l.x0, l.y0); f.lineTo(l.x1, l.y1) }
      f.stroke()
    }
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.filter = `blur(${2 * scale}px)`
    g.globalAlpha = 0.8
    g.drawImage(sheet, 0, 0)
    g.filter = 'none'
    g.globalAlpha = 1
    g.drawImage(sheet, 0, 0)
    g.restore()
    for (const s of glints) {
      const glow = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5)
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
      glow.addColorStop(1, 'rgba(210, 235, 255, 0)')
      g.fillStyle = glow
      g.fillRect(s.x - s.r * 5, s.y - s.r * 5, s.r * 10, s.r * 10)
    }
    // Thinning away to nothing, so the pane has no edge of its own: out
    // from the corner, or for frost along an edge, along it and away from it.
    g.globalCompositeOperation = 'destination-in'
    const fades = edge
      ? [g.createLinearGradient(w * 0.55, 0, w, 0), g.createLinearGradient(0, h * 0.35, 0, h)]
      : [g.createRadialGradient(0, 0, reach * 0.18, 0, 0, reach * 0.78)]
    for (const fade of fades) {
      fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
      g.fillStyle = fade
      g.fillRect(0, 0, w, h)
    }
    c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null))
  })
  frostMade = Promise.all([
    pane(600, 400, 24),
    // A bar is long and low, so its frost runs along the edge rather than
    // filling the corner.
    pane(560, 140, 7, {
      edge: true, boldness: 1.2, mist: 0.05, corner: 1, top: 13, side: 1, spread: 0.9, slant: 0.75, rime: 'edge', grains: 2000,
    }),
  ]).then(([big, small]) => {
    const root = document.documentElement.style
    if (big) root.setProperty('--frost-pane', `url(${big})`)
    if (small) root.setProperty('--frost-rim', `url(${small})`)
  })
  return frostMade
}

/** Frost in the four corners of the window, as if the pane had iced over. */
export function FrostPane() {
  return <div className="frost-pane" aria-hidden="true"><i /><i /><i /><i /></div>
}

// --- the northern lights --------------------------------------------------
/** Curtains of light over the upper sky, drawn once, breathing slowly. */
export function Aurora() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = Math.round(window.innerHeight * 0.55)
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      const g = el.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      // Drawn sharp into a second canvas, then laid in softened.
      const raw = document.createElement('canvas')
      raw.width = w
      raw.height = h
      const r = raw.getContext('2d')
      r.globalCompositeOperation = 'lighter'
      const TAU = Math.PI * 2
      for (let x = 0; x < w; x += 2) {
        const u = x / w
        // Two ribbons, one high and far, one lower and nearer, the nearer
        // strongest over the left of the sky, away from the seal.
        for (const [lift, depth, centre, spread] of [[0.5, 0.75, 0.3, 0.3], [0.3, 0.45, 0.72, 0.22]]) {
          const envelope = Math.exp(-(((u - centre) / spread) ** 2))
          if (envelope < 0.03) continue
          const base = h * (lift + 0.1 * Math.sin(u * TAU * 0.9 + depth * 3) + 0.04 * Math.sin(u * TAU * 3.1 + 1.2))
          const ray = 0.55 + 0.45 * Math.sin(x * 0.08 + Math.sin(x * 0.011 + depth) * 5)
          const top = base - h * depth * (0.45 + 0.4 * ray)
          const strength = envelope * (0.35 + 0.65 * ray)
          const curtain = r.createLinearGradient(0, base + 4, 0, top)
          curtain.addColorStop(0, 'rgba(120, 255, 200, 0)')
          curtain.addColorStop(0.06, `rgba(130, 255, 200, ${(0.34 * strength).toFixed(3)})`)
          curtain.addColorStop(0.35, `rgba(90, 210, 215, ${(0.16 * strength).toFixed(3)})`)
          curtain.addColorStop(0.75, `rgba(130, 110, 230, ${(0.08 * strength).toFixed(3)})`)
          curtain.addColorStop(1, 'rgba(140, 100, 230, 0)')
          r.fillStyle = curtain
          r.fillRect(x, top, 2, base + 4 - top)
        }
      }
      g.filter = 'blur(3px)'
      g.drawImage(raw, 0, 0, w, h)
      g.filter = 'none'
    }
    paint()
    window.addEventListener('resize', paint)
    return () => window.removeEventListener('resize', paint)
  }, [])
  return <canvas ref={ref} className="aurora" aria-hidden="true" />
}

// --- the guiding star -------------------------------------------------------
/** One star brighter than the rest, with long rays, low in the east. */
export function GuidingStar() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const size = 220
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = size * dpr
    el.height = size * dpr
    const g = el.getContext('2d')
    g.scale(dpr, dpr)
    const c = size / 2
    const halo = g.createRadialGradient(c, c, 0, c, c, 34)
    halo.addColorStop(0, 'rgba(255, 250, 235, 0.55)')
    halo.addColorStop(0.3, 'rgba(210, 230, 255, 0.16)')
    halo.addColorStop(1, 'rgba(200, 225, 255, 0)')
    g.fillStyle = halo
    g.fillRect(0, 0, size, size)
    const ray = (angle, length, width) => {
      g.save()
      g.translate(c, c)
      g.rotate(angle)
      const fade = g.createLinearGradient(0, 0, 0, length)
      fade.addColorStop(0, 'rgba(255, 252, 240, 0.95)')
      fade.addColorStop(0.3, 'rgba(215, 235, 255, 0.4)')
      fade.addColorStop(1, 'rgba(200, 225, 255, 0)')
      g.fillStyle = fade
      g.beginPath()
      g.moveTo(-width, 0)
      g.lineTo(0, length)
      g.lineTo(width, 0)
      g.closePath()
      g.fill()
      g.restore()
    }
    // The long ray points down, toward what it is guiding to.
    ray(0, 104, 1.6)
    ray(Math.PI, 58, 1.4)
    ray(Math.PI / 2, 52, 1.3)
    ray(-Math.PI / 2, 52, 1.3)
    for (const a of [1, 3, 5, 7]) ray((a * Math.PI) / 4, 18, 0.9)
    g.fillStyle = '#fffdf5'
    g.beginPath()
    g.arc(c, c, 2.2, 0, Math.PI * 2)
    g.fill()
  }, [])
  return <canvas ref={ref} className="guiding-star" aria-hidden="true" />
}

// --- snow -------------------------------------------------------------------
/** A soft round flake, drawn once and stamped from then on. */
function softFlake(px) {
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')
  const r = px / 2
  const fill = g.createRadialGradient(r, r, 0, r, r, r)
  fill.addColorStop(0, 'rgba(255, 255, 255, 1)')
  fill.addColorStop(0.45, 'rgba(236, 246, 255, 0.85)')
  fill.addColorStop(1, 'rgba(220, 238, 255, 0)')
  g.fillStyle = fill
  g.fillRect(0, 0, px, px)
  return c
}

/** A snow crystal, six-armed and sharp, with a faint glow round it. */
export function crystalFlake(px) {
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')
  const r = px / 2
  const glow = g.createRadialGradient(r, r, 0, r, r, r)
  glow.addColorStop(0, 'rgba(220, 240, 255, 0.35)')
  glow.addColorStop(1, 'rgba(220, 240, 255, 0)')
  g.fillStyle = glow
  g.fillRect(0, 0, px, px)
  g.translate(r, r)
  g.strokeStyle = 'rgba(248, 252, 255, 0.95)'
  g.lineCap = 'round'
  g.lineWidth = Math.max(1, px / 16)
  const arm = r * 0.8
  for (let k = 0; k < 6; k++) {
    g.save()
    g.rotate((k * Math.PI) / 3)
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(0, -arm)
    for (const [at, reach] of [[0.45, 0.24], [0.72, 0.16]]) {
      g.moveTo(0, -arm * at)
      g.lineTo(-arm * reach, -arm * (at + reach * 0.7))
      g.moveTo(0, -arm * at)
      g.lineTo(arm * reach, -arm * (at + reach * 0.7))
    }
    g.stroke()
    g.restore()
  }
  return c
}

/** Snow falling over everything, in three depths. */
export function Snowfall() {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    const soft = softFlake(24)
    const crystal = crystalFlake(48)
    let w = 0
    let h = 0
    let flakes = []

    const make = (depth, anywhere) => {
      const kind = [
        { size: [2, 3.4], fall: [16, 26], sway: 10, alpha: [0.3, 0.55], sprite: soft },
        { size: [4, 6], fall: [30, 44], sway: 18, alpha: [0.6, 0.85], sprite: soft },
        { size: [11, 16], fall: [44, 60], sway: 26, alpha: [0.75, 0.95], sprite: crystal },
      ][depth]
      const pick = ([a, b]) => a + Math.random() * (b - a)
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -20,
        size: pick(kind.size),
        fall: pick(kind.fall),
        sway: kind.sway * (0.5 + Math.random()),
        alpha: pick(kind.alpha),
        sprite: kind.sprite,
        phase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.8,
        turn: Math.random() * Math.PI,
        depth,
      }
    }
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const area = w * h
      flakes = [
        ...Array.from({ length: Math.round(area / 42000) }, () => make(0, true)),
        ...Array.from({ length: Math.round(area / 120000) }, () => make(1, true)),
        ...Array.from({ length: 7 }, () => make(2, true)),
      ]
    }
    size()
    window.addEventListener('resize', size)

    const stop = runLoop((now, dt) => {
      const t = now / 1000
      g.clearRect(0, 0, w, h)
      for (const f of flakes) {
        f.y += f.fall * dt
        f.x += (Math.sin(t * 0.7 + f.phase) * f.sway - 6) * dt
        if (f.y > h + 20) Object.assign(f, make(f.depth, false))
        if (f.x < -20) f.x += w + 40
        g.globalAlpha = f.alpha
        if (f.sprite === crystal) {
          f.turn += f.spin * dt
          g.save()
          g.translate(f.x, f.y)
          g.rotate(f.turn)
          g.drawImage(f.sprite, -f.size / 2, -f.size / 2, f.size, f.size)
          g.restore()
        } else {
          g.drawImage(f.sprite, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size)
        }
      }
      g.globalAlpha = 1
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="snowfall" aria-hidden="true" />
}
