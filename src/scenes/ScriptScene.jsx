import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ivy, keptUp } from './manuscript.js'
import { stillness } from './loop.js'
import { useMinute } from '../useMinute.js'
import { todayISO } from '../time.js'

// Black Hours.
//
// A book of hours on black vellum, read by candlelight. The light pools from
// a candle low at the corner of the desk and moves a little as it burns; the
// page is ruled in gold at its edge.
//
// Along the head of the page runs a border of ivy, the way the bar borders of
// the books of hours ran from their initials: hairline stems drawn in silver,
// curling into spirals, with ivy leaves along them. As today is kept up with,
// the leaves are gilded one by one — a morning with nothing written has the
// border only drawn, a day kept to the minute has it all in gold. A snail
// lives on it, as one lived in every margin.
//
// Writing a stretch is laying gold: where the stroke ends, flakes of leaf
// lift off the page and settle.
//
// Nothing here runs on a clock. The border is drawn again only when how much
// of it is gilded changes, or the window does; the candle flickers by fading
// one layer, which the graphics card does on its own.

// Which ivy grows. Any number will do; this one grows a handsome border.
const SEED = 11
// The bird on the hour goes to sleep at Compline and wakes at Prime.
const NIGHT_FROM = 21 * 60
const NIGHT_UNTIL = 6 * 60

/** An ivy leaf, its stalk at the origin and its point along +x: two round
 *  lobes at the base and a pointed tip, the shape the margins are full of. */
function leafPath(g, s) {
  g.beginPath()
  g.moveTo(0, 0)
  g.quadraticCurveTo(-0.05 * s, -0.5 * s, 0.32 * s, -0.58 * s)
  g.quadraticCurveTo(0.62 * s, -0.64 * s, 0.6 * s, -0.3 * s)
  g.quadraticCurveTo(0.86 * s, -0.24 * s, 1.1 * s, 0)
  g.quadraticCurveTo(0.86 * s, 0.24 * s, 0.6 * s, 0.3 * s)
  g.quadraticCurveTo(0.62 * s, 0.64 * s, 0.32 * s, 0.58 * s)
  g.quadraticCurveTo(-0.05 * s, 0.5 * s, 0, 0)
  g.closePath()
}

/** Burnished gold for something `r` across at x, y: lit from the upper left. */
function gold(g, x, y, r) {
  const shine = g.createLinearGradient(x - r, y - r, x + r, y + r)
  shine.addColorStop(0, '#fff3c0')
  shine.addColorStop(0.35, '#e2bd62')
  shine.addColorStop(0.7, '#b08a3e')
  shine.addColorStop(1, '#7a5a1e')
  return shine
}

const SILVER = 'rgba(206, 204, 216, 0.5)'
const DRAWN = 'rgba(206, 204, 216, 0.32)'
const HUES = { lapis: '#3f63c8', vermilion: '#cf4a33' }

/** The whole border, `share` of it in gold and the rest only drawn. */
function drawIvy(canvas, w, h, share) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  const g = canvas.getContext('2d')
  g.setTransform(dpr, 0, 0, dpr, 0, 0)
  g.clearRect(0, 0, w, h)
  const { stems, leaves, flowers, bezants } = ivy(w, h, SEED)

  g.lineCap = 'round'
  g.lineJoin = 'round'
  g.strokeStyle = SILVER
  g.lineWidth = 0.8
  for (const line of stems) {
    g.beginPath()
    line.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    g.stroke()
  }

  for (const leaf of leaves) {
    g.save()
    g.translate(leaf.x, leaf.y)
    g.rotate(leaf.angle)
    leafPath(g, leaf.size)
    if (leaf.rank < share) {
      g.fillStyle = gold(g, leaf.size * 0.5, 0, leaf.size * 0.7)
      g.fill()
      g.strokeStyle = 'rgba(70, 48, 12, 0.9)'
      g.lineWidth = 0.5
      g.stroke()
      // The vein, scratched into the gold.
      g.beginPath()
      g.moveTo(leaf.size * 0.12, 0)
      g.lineTo(leaf.size * 0.8, 0)
      g.strokeStyle = 'rgba(90, 60, 16, 0.55)'
      g.stroke()
    } else {
      g.strokeStyle = DRAWN
      g.lineWidth = 0.7
      g.stroke()
    }
    g.restore()
  }

  for (const f of flowers) {
    const lit = f.rank < share
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2
      g.beginPath()
      g.arc(f.x + Math.cos(a) * f.r * 0.62, f.y + Math.sin(a) * f.r * 0.62, f.r * 0.5, 0, Math.PI * 2)
      if (lit) {
        g.fillStyle = HUES[f.hue]
        g.fill()
      } else {
        g.strokeStyle = DRAWN
        g.lineWidth = 0.6
        g.stroke()
      }
    }
    g.beginPath()
    g.arc(f.x, f.y, f.r * 0.32, 0, Math.PI * 2)
    if (lit) {
      g.fillStyle = gold(g, f.x, f.y, f.r * 0.4)
      g.fill()
    } else {
      g.strokeStyle = DRAWN
      g.stroke()
    }
  }

  for (const b of bezants) {
    g.beginPath()
    g.arc(b.x, b.y, b.r, 0, Math.PI * 2)
    if (b.rank < share) {
      g.fillStyle = gold(g, b.x, b.y, b.r)
      g.fill()
      g.strokeStyle = 'rgba(70, 48, 12, 0.9)'
      g.lineWidth = 0.4
      g.stroke()
    } else {
      g.strokeStyle = DRAWN
      g.lineWidth = 0.7
      g.stroke()
    }
  }
}

export default function ScriptScene({ days }) {
  const minute = useMinute()
  const today = days?.[todayISO()]
  // Rounded, so the border is drawn again a few dozen times a day rather than
  // every minute.
  const share = Math.round(keptUp(today && !today.malformed ? today.blocks : [], minute) * 40) / 40

  // --- where the border goes: from the view switch to the controls ---------
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    const measure = () => {
      const header = document.querySelector('.app > header')
      const after = document.querySelector('.viewswitch')
      const before = document.querySelector('.nav.today')
      const rule = document.querySelector('.goldrule')
      if (!header || !after || !before || !rule) return
      const top = header.getBoundingClientRect().top
      const left = after.getBoundingClientRect().right + 24
      const right = before.getBoundingClientRect().left - 24
      const foot = rule.getBoundingClientRect().top
      const next = { left, top: Math.max(0, top - 4), width: Math.max(0, right - left), height: Math.max(0, foot - top + 4) }
      setBox((was) => (was && Object.keys(next).every((k) => Math.abs(was[k] - next[k]) < 1) ? was : next))
    }
    measure()
    // The header can keep its size while what is in it moves — the title
    // narrowing once its face has loaded pushes everything after it along —
    // so the pieces either side of the border are watched too.
    const watch = new ResizeObserver(measure)
    for (const sel of ['.app > header', '.titleblock', '.viewswitch', '.nav.today']) {
      const el = document.querySelector(sel)
      if (el) watch.observe(el)
    }
    let alive = true
    document.fonts?.ready.then(() => { if (alive) measure() })
    window.addEventListener('resize', measure)
    return () => { alive = false; watch.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  const canvas = useRef(null)
  useEffect(() => {
    if (!box || !canvas.current || box.width < 80 || box.height < 30) return
    drawIvy(canvas.current, box.width, box.height, share)
  }, [box, share])

  // --- the bird on the hour sleeps through the night ------------------------
  const night = minute >= NIGHT_FROM || minute < NIGHT_UNTIL
  useEffect(() => {
    document.documentElement.dataset.vigil = night ? 'night' : 'day'
  }, [night])
  useEffect(() => () => { delete document.documentElement.dataset.vigil }, [])

  // --- gold where a stroke ends ---------------------------------------------
  const leaf = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    let armedDown = false
    const onDown = (e) => {
      armedDown = Boolean(document.querySelector('.scroller.armed'))
        && e.target instanceof Element && Boolean(e.target.closest('.track'))
    }
    const onUp = (e) => {
      if (!armedDown) return
      armedDown = false
      const track = e.target instanceof Element ? e.target.closest('.track') : null
      if (!track || !leaf.current) return
      const r = track.getBoundingClientRect()
      const x = Math.max(r.left + 6, Math.min(r.right - 6, e.clientX))
      const y = Math.min(r.bottom - 6, Math.max(r.top + 6, e.clientY))
      const flakes = document.createElement('div')
      flakes.className = 'hours-flakes'
      Object.assign(flakes.style, { left: `${x}px`, top: `${y}px` })
      for (let i = 0; i < 11; i++) {
        const flake = document.createElement('i')
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4
        const d = 18 + Math.random() * 34
        flake.style.setProperty('--dx', `${(Math.cos(a) * d).toFixed(1)}px`)
        flake.style.setProperty('--dy', `${(Math.sin(a) * d).toFixed(1)}px`)
        flake.style.setProperty('--fall', `${(14 + Math.random() * 22).toFixed(1)}px`)
        flake.style.setProperty('--turn', `${Math.round((Math.random() - 0.5) * 540)}deg`)
        flake.style.setProperty('--size', `${(3 + Math.random() * 4).toFixed(1)}px`)
        flake.style.animationDelay = `${Math.round(Math.random() * 90)}ms`
        flakes.appendChild(flake)
      }
      leaf.current.appendChild(flakes)
      setTimeout(() => flakes.remove(), 1900)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [])

  // The snail keeps to the stem along the rule, a little past the middle.
  const snailAt = box ? Math.round(box.width * 0.71) : 0

  return (
    <>
      <div className="hours-candle" aria-hidden="true" />
      <div className="hours-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      {box && box.width >= 80 && (
        <div
          className="hours-border"
          aria-hidden="true"
          style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          title={share >= 1 ? 'Today kept to the minute' : undefined}
        >
          <canvas ref={canvas} style={{ width: box.width, height: box.height }} />
          <span className="hours-snail" style={{ left: snailAt - 15, top: box.height - 4 - 19 }} />
        </div>
      )}
      <div ref={leaf} className="hours-leaf" aria-hidden="true" />
    </>
  )
}
