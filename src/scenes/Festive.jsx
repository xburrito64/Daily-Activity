import { useEffect, useId, useRef, useState } from 'react'
import { frostFerns, cobweb, blossomBranch, meadow } from './festivals.js'
import { runLoop, stillness } from './loop.js'

// The festival nights of Starlit.
//
// Christmas Eve. Wherever it falls in the list the day is rimed: frost grown
// in over the ends of its bar, its date in ice, a snowflake for its diamond
// and a gift sealed in wax beside it; painting on it casts a frost sigil
// that breaks into snow crystals. On the night itself the northern lights
// come out over the grimoire, the guiding star shows, frost creeps in at the
// corners of the window and snow falls across everything.
//
// Halloween. The day is strung with cobwebs, a spider hanging off its bar,
// its date lit amber like candlelight through a carved face, a pumpkin for
// its diamond and a jack-o'-lantern beside it; painting on it casts a
// grinning sigil that goes up in a flurry of bats. On the night itself the
// moon hangs orange over a violet mist, great webs fill the corners of the
// window with their spider going up and down, bats cross the moon, and
// will-o'-wisps drift about the page, shying away from the pointer.
//
// Easter. The day breaks into blossom: a flowering branch reaching in over
// its bar, a warm dawn along the foot of it, its date in the colours of
// sunrise, an egg for its diamond and a rune-painted egg beside it; painting
// on it casts a blossom sigil that scatters into petals and butterflies. On
// the day itself the night gives way to dawn, petals drift down, luminous
// butterflies wander the page, a field of flowers blooms along the foot of
// the window (the spell for a field of flowers, the gentlest there is), and
// five eggs are hidden about the grimoire for finding.
//
// All of it is drawn once and then only shown, apart from the snow, the
// wisps, the bats, the petals and the butterflies, which run on the shared
// clock (loop.js) like every other scene.

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

/** A jack-o'-lantern, a candle in it shining out through its carved face. */
export function Lantern({ lit = false }) {
  return (
    <span className={`lantern${lit ? ' lit' : ''}`} title="Halloween" aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="lantern-stem" d="M12.2 8.4c.1-2.3.9-4.3 2.9-5.4l1 1.1c-1.6.9-2.3 2.4-2.3 4.4Z" />
        <ellipse className="lantern-rind" cx="13" cy="15.6" rx="10.6" ry="8.2" />
        <ellipse className="lantern-rib" cx="8.4" cy="15.6" rx="5.2" ry="7.9" />
        <ellipse className="lantern-rib" cx="17.6" cy="15.6" rx="5.2" ry="7.9" />
        <ellipse className="lantern-rib middle" cx="13" cy="15.6" rx="3.5" ry="8.1" />
        <g className="lantern-face">
          <path d="M6.6 14.6 8.9 10.9 10.6 14.6Z" />
          <path d="M15.4 14.6 17.1 10.9 19.4 14.6Z" />
          <path d="M12.1 16.4 13 15 13.9 16.4Z" />
          <path d="M6.4 17.6c2.1 3.3 11.1 3.3 13.2 0l-.9-.3-.9 1.3-1.1-1.1-1.2 1.4-1.2-1.3L13 19l-1.3-1.4-1.2 1.3-1.2-1.4-1.1 1.1-.9-1.3Z" />
        </g>
      </svg>
    </span>
  )
}

// An egg's outline, for the painted eggs.
const EGG = 'M13 2.6C8.9 2.6 5.6 9.6 5.6 14.9c0 4.8 3.3 8.3 7.4 8.3s7.4-3.5 7.4-8.3C20.4 9.6 17.1 2.6 13 2.6Z'

/**
 * An egg painted the old way: two bands, a zigzag between them, dots at
 * either end, a fine gold rim. `tone` picks one of five sets of colours
 * (themes.css); a wobbling egg rocks now and then, as if about to hatch.
 */
export function Egg({ tone = 0, wobble = false, className = '' }) {
  const clip = `egg${useId().replace(/:/g, '')}`
  return (
    <span className={`egg tone-${tone}${wobble ? ' wobble' : ''} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <defs><clipPath id={clip}><path d={EGG} /></clipPath></defs>
        <path className="egg-shell" d={EGG} />
        <g clipPath={`url(#${clip})`}>
          <rect className="egg-band" x="0" y="9.2" width="26" height="2.6" />
          <path className="egg-zig" d="M3.6 15.4l2.1-2 2.1 2 2.1-2 2.1 2 2.1-2 2.1 2 2.1-2 2.1 2 2.1-2" />
          <rect className="egg-band" x="0" y="17.8" width="26" height="2.2" />
          <circle className="egg-dot" cx="10.2" cy="6.6" r="0.85" />
          <circle className="egg-dot" cx="15.8" cy="6.6" r="0.85" />
          <circle className="egg-dot" cx="13" cy="4.8" r="0.75" />
          <circle className="egg-dot" cx="9.4" cy="21.9" r="0.75" />
          <circle className="egg-dot" cx="13" cy="22.5" r="0.75" />
          <circle className="egg-dot" cx="16.6" cy="21.9" r="0.75" />
        </g>
        <path className="egg-rim" d={EGG} />
      </svg>
    </span>
  )
}

/** Christmas Eve's gift, Halloween's lantern, or Easter's egg: what sits by the date. */
export function FestiveMark({ id, lit = false }) {
  if (id === 'easter') return <Egg wobble={lit} />
  if (id === 'halloween') return <Lantern lit={lit} />
  if (id === 'christmas-eve') return <Gift glint={lit} />
  return null
}

/** What the sky says as the app opens on a festival night. */
export const FESTIVE_LINES = {
  'christmas-eve': { line: 'snow falls over the grimoire', spell: '#cfeaff' },
  halloween: { line: 'the veil is thin tonight', spell: '#ffb866' },
  easter: { line: 'five eggs are hidden about the grimoire', spell: '#ffc4dc', eyebrow: 'A festival morning' },
}

/** A small spider, let down on its thread. */
export function Spider({ className = '' }) {
  return (
    <span className={`spider ${className}`} aria-hidden="true">
      <svg viewBox="0 0 20 20">
        <path
          className="spider-legs"
          d="M8.4 9.2 4.6 6.4 2.4 7.6M8.2 10.6 3.8 9.9 1.8 12M8.4 12 4.4 13.8 3.4 16.6M8.9 13.2 6.6 16.4 6.8 19M11.6 9.2l3.8-2.8 2.2 1.2M11.8 10.6l4.4-.7 2 2.1M11.6 12l4 1.8 1 2.8M11.1 13.2l2.3 3.2-.2 2.6"
        />
        <ellipse className="spider-body" cx="10" cy="12.6" rx="3.1" ry="3.7" />
        <circle className="spider-body" cx="10" cy="8.2" r="2" />
        <circle className="spider-eye" cx="9.3" cy="7.9" r="0.45" />
        <circle className="spider-eye" cx="10.7" cy="7.9" r="0.45" />
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

// --- cobwebs and mist -------------------------------------------------------
// Two webs, spun once and shared as pictures like the frost: a large one for
// the top corners of the window, and a small one for the corners of a bar.
// And the mist that rolls along the foot of the window on Halloween night,
// a strip that joins up end to end so it can drift forever.

let websMade = null
export function makeWebs() {
  if (websMade) return websMade
  const web = (w, h, seed, shape, strength) => new Promise((resolve) => {
    const scale = 2
    const c = document.createElement('canvas')
    c.width = w * scale
    c.height = h * scale
    const g = c.getContext('2d')
    g.scale(scale, scale)
    const { lines, silk, dew } = cobweb(w, h, seed, shape)
    g.lineCap = 'round'
    g.strokeStyle = `rgba(228, 222, 242, ${0.9 * strength})`
    g.lineWidth = 0.7
    g.beginPath()
    for (const l of lines) { g.moveTo(l.x0, l.y0); g.lineTo(l.x1, l.y1) }
    g.stroke()
    g.lineWidth = 0.55
    g.strokeStyle = `rgba(228, 222, 242, ${0.75 * strength})`
    g.beginPath()
    for (const t of silk) { g.moveTo(t.x0, t.y0); g.quadraticCurveTo(t.cx, t.cy, t.x1, t.y1) }
    g.stroke()
    for (const d of dew) {
      const glow = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 3)
      glow.addColorStop(0, 'rgba(255, 236, 200, 0.9)')
      glow.addColorStop(1, 'rgba(255, 200, 140, 0)')
      g.fillStyle = glow
      g.fillRect(d.x - d.r * 3, d.y - d.r * 3, d.r * 6, d.r * 6)
    }
    c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null))
  })
  const mist = () => new Promise((resolve) => {
    const w = 1200
    const h = 260
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    let a = 13
    const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647 }
    for (let i = 0; i < 70; i++) {
      const x = rand() * w
      const y = h * (0.45 + rand() * 0.6)
      const r = 50 + rand() * 110
      const tone = rand() < 0.5 ? '150, 118, 196' : '108, 98, 150'
      const alpha = 0.06 + rand() * 0.1
      // Drawn at both ends as well, so the strip meets itself seamlessly.
      for (const dx of [-w, 0, w]) {
        const puff = g.createRadialGradient(x + dx, y, 0, x + dx, y, r)
        puff.addColorStop(0, `rgba(${tone}, ${alpha})`)
        puff.addColorStop(1, `rgba(${tone}, 0)`)
        g.fillStyle = puff
        g.fillRect(x + dx - r, y - r, r * 2, r * 2)
      }
    }
    c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null))
  })
  websMade = Promise.all([
    web(520, 520, 31, { spokes: 9, rings: 13, reach: 0.9 }, 0.8),
    web(240, 120, 5, { spokes: 7, rings: 7, reach: 0.95 }, 1),
    mist(),
  ]).then(([big, small, fog]) => {
    const root = document.documentElement.style
    if (big) root.setProperty('--web-pane', `url(${big})`)
    if (small) root.setProperty('--web-rim', `url(${small})`)
    if (fog) root.setProperty('--mist', `url(${fog})`)
  })
  return websMade
}

// --- blossom ------------------------------------------------------------------
// The four tints of blossom, and of the flowers in the field.
const BLOOM_TONES = ['255, 196, 220', '250, 246, 255', '255, 214, 232', '232, 206, 255']
const FLOWER_TONES = ['150, 205, 255', '242, 246, 255', '255, 188, 214', '255, 226, 140']

/** Five round petals about a golden heart, with a soft light round them. */
function drawBloom(g, x, y, r, rgb, turn, glow = 0.3) {
  const halo = g.createRadialGradient(x, y, 0, x, y, r * 2.6)
  halo.addColorStop(0, `rgba(${rgb}, ${glow})`)
  halo.addColorStop(1, `rgba(${rgb}, 0)`)
  g.fillStyle = halo
  g.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2)
  g.fillStyle = `rgba(${rgb}, 0.95)`
  for (let i = 0; i < 5; i++) {
    const a = turn + (i * Math.PI * 2) / 5
    g.beginPath()
    g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.4, a, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = 'rgba(255, 222, 130, 1)'
  g.beginPath()
  g.arc(x, y, r * 0.26, 0, Math.PI * 2)
  g.fill()
}

// The flowering branch, grown once and shared as a picture like the frost
// and the webs, for the top corners of a bar.
let bloomsMade = null
export function makeBlooms() {
  if (bloomsMade) return bloomsMade
  bloomsMade = new Promise((resolve) => {
    const w = 360
    const h = 120
    const scale = 2
    const c = document.createElement('canvas')
    c.width = w * scale
    c.height = h * scale
    const g = c.getContext('2d')
    g.scale(scale, scale)
    const { wood, blossoms, leaves } = blossomBranch(w, h)
    g.lineCap = 'round'
    for (const l of wood) {
      g.strokeStyle = '#3a2a2a'
      g.lineWidth = l.width + 0.8
      g.beginPath(); g.moveTo(l.x0, l.y0); g.lineTo(l.x1, l.y1); g.stroke()
      g.strokeStyle = 'rgba(140, 104, 96, 0.9)'
      g.lineWidth = Math.max(0.5, l.width * 0.45)
      g.beginPath(); g.moveTo(l.x0, l.y0 - l.width * 0.2); g.lineTo(l.x1, l.y1 - l.width * 0.2); g.stroke()
    }
    for (const f of leaves) {
      g.save()
      g.translate(f.x, f.y)
      g.rotate(f.angle)
      g.fillStyle = 'rgba(120, 196, 140, 0.85)'
      g.beginPath()
      g.ellipse(f.length / 2, 0, f.length / 2, f.length / 5, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    for (const b of blossoms) drawBloom(g, b.x, b.y, b.r, BLOOM_TONES[b.tone], b.turn, 0.2)
    // Fading out along the bar and down it, so the branch has no edge of
    // its own.
    g.globalCompositeOperation = 'destination-in'
    for (const fade of [g.createLinearGradient(w * 0.6, 0, w, 0), g.createLinearGradient(0, h * 0.6, 0, h)]) {
      fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
      g.fillStyle = fade
      g.fillRect(0, 0, w, h)
    }
    c.toBlob((blob) => {
      if (blob) document.documentElement.style.setProperty('--bloom-rim', `url(${URL.createObjectURL(blob)})`)
      resolve()
    })
  })
  return bloomsMade
}

/** Every festival's pictures, made once, whichever festival is in view. */
export function makePictures() {
  return Promise.all([makeFrost(), makeWebs(), makeBlooms()])
}

/**
 * Halloween night's own furniture: the mist along the foot of the window,
 * great webs in its top corners, and their spider going slowly up and down.
 */
export function HallowPane() {
  return (
    <>
      <div className="hallow-mist" aria-hidden="true"><i /><i /></div>
      <div className="web-pane" aria-hidden="true"><i /><i /></div>
      <div className="web-spider" aria-hidden="true"><Spider /></div>
    </>
  )
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

// --- Halloween night: bats and will-o'-wisps -----------------------------------
/**
 * A bat, in three beats of its wings (up, level, down), drawn once each.
 * Dark against the sky, with a thin rim of light so it shows against it.
 */
export function batFrames(px) {
  return [-0.9, 0, 0.8].map((lift) => {
    const c = document.createElement('canvas')
    c.width = px
    c.height = px
    const g = c.getContext('2d')
    const k = px / 32
    g.translate(px / 2, px / 2)
    g.scale(k, k)
    g.fillStyle = '#1c1128'
    g.strokeStyle = 'rgba(206, 170, 255, 0.7)'
    g.lineWidth = 1.1
    g.lineJoin = 'round'
    const wing = (side) => {
      const y = (v) => v * lift
      g.moveTo(side * 2.5, -1)
      g.lineTo(side * 8, -3 + y(-7))
      g.lineTo(side * 14.5, -1 + y(-10))
      g.quadraticCurveTo(side * 12.5, 1.5 + y(-6), side * 11.5, 4 + y(-5))
      g.quadraticCurveTo(side * 9.5, 2.5 + y(-3), side * 7.5, 4.5 + y(-3))
      g.quadraticCurveTo(side * 5.5, 3 + y(-1), side * 2.5, 3)
      g.closePath()
    }
    g.beginPath()
    wing(-1)
    wing(1)
    // Body, head and the two ears.
    g.moveTo(3, 1)
    g.ellipse(0, 1, 3, 4.2, 0, 0, Math.PI * 2)
    g.moveTo(-2.4, -3.2)
    g.lineTo(-2.2, -7)
    g.lineTo(-0.6, -4.6)
    g.lineTo(0.6, -4.6)
    g.lineTo(2.2, -7)
    g.lineTo(2.4, -3.2)
    g.closePath()
    g.stroke()
    g.fill()
    return c
  })
}

/** A will-o'-wisp's glow, in one of its colours. */
function wispSprite(rgb) {
  const px = 64
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')
  const r = px / 2
  const glow = g.createRadialGradient(r, r, 0, r, r, r)
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)')
  glow.addColorStop(0.12, `rgba(${rgb}, 0.95)`)
  glow.addColorStop(0.4, `rgba(${rgb}, 0.28)`)
  glow.addColorStop(1, `rgba(${rgb}, 0)`)
  g.fillStyle = glow
  g.fillRect(0, 0, px, px)
  return c
}

/**
 * Will-o'-wisps wandering about the page, each on a slow path of its own,
 * trailing a little light behind it and drifting away from the pointer when
 * it comes close; and now and then a few bats crossing the sky by the moon.
 */
export function HallowNight() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const g = el.getContext('2d')
    const tones = ['168, 255, 222', '170, 214, 255', '206, 182, 255']
    const sprites = tones.map(wispSprite)
    const bat = batFrames(48)
    let w = 0
    let h = 0
    let wisps = []
    const pointer = { x: -9999, y: -9999 }

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (wisps.length === 0) {
        wisps = Array.from({ length: 7 }, (_, i) => ({
          x: w * (0.08 + Math.random() * 0.84),
          y: h * (0.2 + Math.random() * 0.7),
          vx: 0,
          vy: 0,
          r: 9 + Math.random() * 9,
          sprite: sprites[i % sprites.length],
          a: Math.random() * 100,
          b: Math.random() * 100,
          trail: [],
        }))
      }
    }
    size()
    window.addEventListener('resize', size)
    const onMove = (e) => { pointer.x = e.clientX; pointer.y = e.clientY }
    const onLeave = () => { pointer.x = -9999; pointer.y = -9999 }
    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)

    const draw = (t) => {
      g.clearRect(0, 0, w, h)
      g.globalCompositeOperation = 'lighter'
      for (const s of wisps) {
        const flicker = 0.62 + 0.25 * Math.sin(t * 2.3 + s.a) + 0.13 * Math.sin(t * 7.1 + s.b)
        s.trail.forEach((p, i) => {
          const k = (i + 1) / (s.trail.length + 1)
          const px = s.r * 1.6 * k
          g.globalAlpha = 0.22 * k * flicker
          g.drawImage(s.sprite, p.x - px, p.y - px, px * 2, px * 2)
        })
        const px = s.r * 2
        g.globalAlpha = Math.max(0, Math.min(1, flicker))
        g.drawImage(s.sprite, s.x - px, s.y - px, px * 2, px * 2)
      }
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
    }

    // Bats cross close by the moon, from one side of the sky to the other.
    let flock = []
    let nextFlock = performance.now() + 3000 + Math.random() * 4000
    const launch = () => {
      const seal = document.querySelector('.app > .seal')
      const moonY = seal ? parseFloat(seal.style.getPropertyValue('--seal-y')) || 60 : 60
      const leftward = Math.random() < 0.5
      const count = 3 + Math.floor(Math.random() * 4)
      const speed = 190 + Math.random() * 80
      flock = Array.from({ length: count }, (_, i) => ({
        x: leftward ? w + 40 + i * (30 + Math.random() * 40) : -40 - i * (30 + Math.random() * 40),
        y: moonY + (Math.random() - 0.5) * 90,
        vx: (leftward ? -1 : 1) * speed * (0.85 + Math.random() * 0.3),
        size: 18 + Math.random() * 12,
        beat: 8 + Math.random() * 4,
        phase: Math.random() * 10,
      }))
    }

    if (stillness()) {
      draw(0)
      return () => {
        window.removeEventListener('resize', size)
        window.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerleave', onLeave)
      }
    }

    const stop = runLoop((now, dt) => {
      const t = now / 1000
      for (const s of wisps) {
        // A slow wandering of its own...
        let ax = Math.sin(t * 0.31 + s.a) * 16 + Math.sin(t * 0.73 + s.b) * 9
        let ay = Math.cos(t * 0.27 + s.b) * 12 + Math.sin(t * 0.57 + s.a) * 7
        // ...away from the pointer when it comes close...
        const dx = s.x - pointer.x
        const dy = s.y - pointer.y
        const d = Math.hypot(dx, dy)
        if (d < 170 && d > 0.1) {
          const push = ((170 - d) / 170) ** 2 * 900
          ax += (dx / d) * push
          ay += (dy / d) * push
        }
        // ...and back in off the edges.
        if (s.x < 40) ax += 60
        if (s.x > w - 40) ax -= 60
        if (s.y < 60) ay += 60
        if (s.y > h - 40) ay -= 60
        s.vx = (s.vx + ax * dt) * Math.exp(-dt * 1.1)
        s.vy = (s.vy + ay * dt) * Math.exp(-dt * 1.1)
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.trail.push({ x: s.x, y: s.y })
        if (s.trail.length > 7) s.trail.shift()
      }
      draw(t)

      if (flock.length === 0 && now > nextFlock) {
        launch()
        nextFlock = now + 14000 + Math.random() * 18000
      }
      for (const b of flock) {
        b.x += b.vx * dt
        const y = b.y + Math.sin(t * 3 + b.phase) * 10
        const frame = [0, 1, 2, 1][Math.floor((t + b.phase) * b.beat) % 4]
        g.drawImage(bat[frame], b.x - b.size / 2, y - b.size / 2, b.size, b.size)
      }
      if (flock.length && flock.every((b) => b.x < -80 || b.x > w + 80)) flock = []
    })
    return () => {
      stop()
      window.removeEventListener('resize', size)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])
  return <canvas ref={ref} className="hallow-night" aria-hidden="true" />
}

// --- Easter: dawn, petals, butterflies, the flower field and the egg hunt ----------
/** The light of dawn coming up from below the page, rays and all. */
export function Dawn() {
  return <div className="dawn" aria-hidden="true" />
}

/** A field of flowers along the foot of the window, blooming in as it opens. */
export function Meadow() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = 96
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      const g = el.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const { blades, flowers } = meadow(w, h)
      const grass = g.createLinearGradient(0, h, 0, h * 0.3)
      grass.addColorStop(0, '#0b1714')
      grass.addColorStop(0.55, '#1d4636')
      grass.addColorStop(1, 'rgba(126, 200, 160, 0.9)')
      g.fillStyle = grass
      for (const b of blades) {
        g.beginPath()
        g.moveTo(b.x - b.width / 2, h)
        g.quadraticCurveTo(b.x + b.lean * 0.3, h - b.height * 0.6, b.x + b.lean, h - b.height)
        g.quadraticCurveTo(b.x + b.lean * 0.3 + b.width * 0.3, h - b.height * 0.6, b.x + b.width / 2, h)
        g.fill()
      }
      g.lineCap = 'round'
      for (const f of flowers) {
        g.strokeStyle = 'rgba(96, 164, 124, 0.8)'
        g.lineWidth = 0.9
        g.beginPath()
        g.moveTo(f.x, h)
        g.quadraticCurveTo(f.x + f.lean * 0.2, h - f.height * 0.5, f.x + f.lean, h - f.height)
        g.stroke()
        drawBloom(g, f.x + f.lean, h - f.height, f.r, FLOWER_TONES[f.kind], f.turn, 0.4)
      }
    }
    paint()
    window.addEventListener('resize', paint)
    return () => window.removeEventListener('resize', paint)
  }, [])
  return <canvas ref={ref} className="meadow" aria-hidden="true" />
}

/** A blossom petal, drawn once and stamped, turning, from then on. */
export function petalSprite(rgb = BLOOM_TONES[0]) {
  const c = document.createElement('canvas')
  c.width = 24
  c.height = 24
  const g = c.getContext('2d')
  const fill = g.createLinearGradient(12, 2, 12, 22)
  fill.addColorStop(0, 'rgba(255, 250, 252, 0.95)')
  fill.addColorStop(1, `rgba(${rgb}, 0.95)`)
  g.fillStyle = fill
  g.beginPath()
  g.moveTo(12, 22)
  g.bezierCurveTo(3, 15, 5, 4, 10, 2.5)
  g.quadraticCurveTo(12, 4.5, 14, 2.5)
  g.bezierCurveTo(19, 4, 21, 15, 12, 22)
  g.fill()
  return c
}

/**
 * A butterfly of light, its wings opening and closing (`flap`, -1 to 1),
 * drawn straight onto the canvas: there are only ever a few of them.
 */
export function drawButterfly(g, x, y, size, flap, rgb, heading = 0) {
  const k = size / 20
  const open = 0.18 + 0.82 * Math.abs(flap)
  g.save()
  g.translate(x, y)
  g.rotate(heading)
  g.scale(k, k)
  for (const side of [-1, 1]) {
    g.save()
    g.scale(side * open, 1)
    const fill = g.createRadialGradient(1, 0, 0, 5, 0, 9)
    fill.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    fill.addColorStop(0.35, `rgba(${rgb}, 0.85)`)
    fill.addColorStop(1, `rgba(${rgb}, 0.15)`)
    g.fillStyle = fill
    g.beginPath()
    g.ellipse(6, -3.4, 6.2, 5, -0.5, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.ellipse(4.6, 4, 4.2, 3.6, 0.55, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  g.fillStyle = 'rgba(255, 250, 240, 0.9)'
  g.beginPath()
  g.ellipse(0, 0.6, 0.9, 5, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

export const BUTTERFLY_TONES = ['255, 190, 222', '180, 212, 255', '200, 255, 214', '255, 232, 160', '224, 196, 255']

/**
 * Easter's sky: petals drifting down across the page, turning over as they
 * fall, and a few butterflies of light wandering about it.
 */
export function SpringDay() {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    const sprites = BLOOM_TONES.map(petalSprite)
    let w = 0
    let h = 0
    let petals = []
    let flies = []
    const make = (anywhere) => ({
      x: Math.random() * (w + 200),
      y: anywhere ? Math.random() * h : -20,
      size: 7 + Math.random() * 7,
      fall: 22 + Math.random() * 26,
      drift: -(14 + Math.random() * 20),
      sway: 12 + Math.random() * 18,
      turn: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.4,
      flip: Math.random() * Math.PI * 2,
      flipRate: 1.5 + Math.random() * 2.5,
      phase: Math.random() * 10,
      sprite: sprites[Math.floor(Math.random() * sprites.length)],
      alpha: 0.55 + Math.random() * 0.4,
    })
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      petals = Array.from({ length: Math.round((w * h) / 70000) }, () => make(true))
      if (flies.length === 0) {
        flies = Array.from({ length: 4 }, (_, i) => ({
          x: w * (0.15 + Math.random() * 0.7),
          y: h * (0.25 + Math.random() * 0.6),
          vx: 0,
          vy: 0,
          a: Math.random() * 100,
          b: Math.random() * 100,
          beat: 7 + Math.random() * 4,
          size: 16 + Math.random() * 8,
          tone: BUTTERFLY_TONES[i % BUTTERFLY_TONES.length],
        }))
      }
    }
    size()
    window.addEventListener('resize', size)

    const stop = runLoop((now, dt) => {
      const t = now / 1000
      g.clearRect(0, 0, w, h)
      for (const p of petals) {
        p.y += p.fall * dt
        p.x += (p.drift + Math.sin(t * 0.9 + p.phase) * p.sway) * dt
        p.turn += p.spin * dt
        p.flip += p.flipRate * dt
        if (p.y > h + 20 || p.x < -30) Object.assign(p, make(false))
        g.save()
        g.globalAlpha = p.alpha
        g.translate(p.x, p.y)
        g.rotate(p.turn)
        g.scale(Math.cos(p.flip), 1)
        g.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size)
        g.restore()
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'lighter'
      for (const f of flies) {
        // Wandering, with the fits and starts a butterfly flies in.
        const ax = Math.sin(t * 0.43 + f.a) * 40 + Math.sin(t * 1.7 + f.b) * 30
        let ay = Math.cos(t * 0.37 + f.b) * 30 + Math.sin(t * 2.3 + f.a) * 26
        let bx = 0
        if (f.x < 60) bx = 60
        if (f.x > w - 60) bx = -60
        if (f.y < 90) ay += 60
        if (f.y > h - 70) ay -= 60
        f.vx = (f.vx + (ax + bx) * dt) * Math.exp(-dt * 0.8)
        f.vy = (f.vy + ay * dt) * Math.exp(-dt * 0.8)
        f.x += f.vx * dt
        f.y += f.vy * dt
        drawButterfly(g, f.x, f.y, f.size, Math.sin((t + f.a) * f.beat), f.tone, Math.max(-0.5, Math.min(0.5, f.vx / 120)))
      }
      g.globalCompositeOperation = 'source-over'
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="spring-day" aria-hidden="true" />
}

export const EGGS = 5

/**
 * Five eggs hidden about the page: leaning on the moon, in the open sky of
 * the header either side of it, tucked against the left edge of the page,
 * and down in the flower field. Each one found is gone, and remembered for
 * the day; `onFound(x, y, found, of)` is told where, and how many so far.
 */
export function EggHunt({ day, onFound }) {
  const key = `daily-documenter:eggs:${day}`
  const [found, setFound] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
  })
  const [spots, setSpots] = useState([])
  useEffect(() => {
    const place = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const left = document.querySelector('.viewswitch')?.getBoundingClientRect()
      const right = document.querySelector('.nav.today')?.getBoundingClientRect()
      const moon = document.querySelector('.seal-moon')?.getBoundingClientRect()
      const from = left?.right ?? w * 0.3
      const to = right?.left ?? w * 0.8
      const mid = left ? left.top + left.height / 2 : 50
      setSpots([
        moon ? { x: moon.right - 8, y: moon.bottom - 14, turn: 22 } : { x: w * 0.6, y: 60, turn: 22 },
        { x: from + (to - from) * 0.16, y: mid + 4, turn: -14 },
        { x: from + (to - from) * 0.86, y: mid - 18, turn: 9 },
        { x: 2, y: h * 0.57, turn: -26 },
        { x: w * 0.71, y: h - 28, turn: 6 },
      ])
    }
    place()
    const settle = () => requestAnimationFrame(() => requestAnimationFrame(place))
    const later = setTimeout(place, 800)
    window.addEventListener('resize', settle)
    return () => { clearTimeout(later); window.removeEventListener('resize', settle) }
  }, [])
  const find = (i, e) => {
    if (found.includes(i)) return
    const next = [...found, i]
    setFound(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* only remembered until closed */ }
    const r = e.currentTarget.getBoundingClientRect()
    onFound?.(r.left + r.width / 2, r.top + r.height / 2, next.length, EGGS)
  }
  return (
    <div className="egg-hunt">
      {spots.map((s, i) => (found.includes(i) ? null : (
        <button
          key={i}
          type="button"
          className="hidden-egg"
          aria-label="A hidden egg"
          style={{ left: `${s.x}px`, top: `${s.y}px`, transform: `rotate(${s.turn}deg)` }}
          onClick={(e) => find(i, e)}
        >
          <Egg tone={i} />
        </button>
      )))}
    </div>
  )
}
