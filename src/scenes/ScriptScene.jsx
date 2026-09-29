import { useEffect, useRef } from 'react'
import { sunOf } from './manuscript.js'
import { runLoop, stillness } from './loop.js'
import { useMinute } from '../useMinute.js'

// Scriptorium.
//
// The page lies on a desk under a window. Through the day the light from it
// moves across the page as the sun does — in from the left in the morning,
// straight down at midday, from the right towards evening — with dust
// turning slowly in the beam. After dark the window goes out and the page is
// read by a candle, the edges of the room falling away into brown.
//
// Painting a stretch is writing it: the pointer is a quill while a tag is
// picked up, and where the stroke ends the pen leaves a blot and a spatter
// of ink, which dries and fades.
//
// The light is set once a minute. The dust runs on the shared clock
// (loop.js), and not at all when less movement is asked for; the ink does
// not either.

const MOTES = 46
const INK = '45, 33, 20'

/** An ink blot's outline: a rough circle, different every time. */
function blotPath(r) {
  const n = 11
  const points = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    const d = r * (0.72 + Math.random() * 0.5)
    return [Math.cos(a) * d, Math.sin(a) * d]
  })
  const at = ([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`
  const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]
  // Smooth through the midpoints, bending toward each point in turn.
  let path = `M${at(mid(points[n - 1], points[0]))}`
  for (let i = 0; i < n; i++) path += `Q${at(points[i])} ${at(mid(points[i], points[(i + 1) % n]))}`
  return `${path}Z`
}

export default function ScriptScene() {
  const minute = useMinute()
  const sun = sunOf(minute)
  const light = useRef(null)
  const night = useRef(null)
  const motes = useRef(null)
  const ink = useRef(null)
  const sunRef = useRef(sun)
  sunRef.current = sun

  // --- the light of the hour ---------------------------------------------
  useEffect(() => {
    const beam = light.current
    if (beam) {
      // The band leans the way the light falls: down to the right in the
      // morning, down to the left in the evening, and lands further across
      // the page the lower the sun is.
      beam.style.setProperty('--beam-angle', `${90 + sun.from * 32}deg`)
      beam.style.setProperty('--beam-at', `${50 - sun.from * 22}%`)
      beam.style.opacity = String(Math.min(1, sun.day * 1.4))
    }
    // The candle takes over as the light goes, over the last hour or so.
    if (night.current) night.current.style.opacity = String(Math.max(0, 1 - sun.day * 3.2))
  }, [sun.day, sun.from])

  // --- the dust in the beam ------------------------------------------------
  useEffect(() => {
    if (stillness()) return undefined
    const el = motes.current
    const g = el.getContext('2d')
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      el.width = Math.round(window.innerWidth * dpr)
      el.height = Math.round(window.innerHeight * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    const dust = Array.from({ length: MOTES }, () => ({
      x: Math.random(), y: Math.random(),
      vx: (Math.random() - 0.5) * 0.004, vy: (Math.random() - 0.5) * 0.003,
      r: 0.6 + Math.random() * 1.4, seed: Math.random() * 100,
    }))
    let dark = false

    const stop = runLoop((now, dt) => {
      const s = sunRef.current
      const w = window.innerWidth
      const h = window.innerHeight
      if (s.day < 0.04) {
        if (!dark) { g.clearRect(0, 0, w, h); dark = true }
        return
      }
      dark = false
      g.clearRect(0, 0, w, h)
      // The beam as a line across the screen, matching the one painted in CSS.
      const angle = ((90 + s.from * 32) * Math.PI) / 180
      const nx = Math.sin(angle)
      const ny = -Math.cos(angle)
      const cx = w * (0.5 - s.from * 0.22)
      const t = now / 1000
      for (const m of dust) {
        m.x += (m.vx + Math.sin(t * 0.3 + m.seed) * 0.0015) * dt
        m.y += (m.vy + Math.cos(t * 0.23 + m.seed) * 0.0012) * dt
        if (m.x < 0) m.x += 1
        if (m.x > 1) m.x -= 1
        if (m.y < 0) m.y += 1
        if (m.y > 1) m.y -= 1
        const px = m.x * w
        const py = m.y * h
        // How far across the beam this speck is: bright in it, gone outside.
        const across = ((px - cx) * nx + (py - h / 2) * ny) / (w * 0.14)
        const lit = Math.exp(-across * across * 2.2) * s.day
        if (lit < 0.03) continue
        const twinkle = 0.55 + 0.45 * Math.sin(t * 1.7 + m.seed * 3)
        g.fillStyle = `rgba(255, 238, 190, ${(0.75 * lit * twinkle).toFixed(3)})`
        g.beginPath()
        g.arc(px, py, m.r, 0, Math.PI * 2)
        g.fill()
      }
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [])

  // --- ink where a stroke ends ---------------------------------------------
  useEffect(() => {
    if (stillness()) return undefined
    let armedDown = false
    const onDown = (e) => {
      armedDown = Boolean(document.querySelector('.scroller.armed')) &&
        e.target instanceof Element && Boolean(e.target.closest('.track'))
    }
    const onUp = (e) => {
      if (!armedDown) return
      armedDown = false
      const track = e.target instanceof Element ? e.target.closest('.track') : null
      if (!track || !ink.current) return
      const r = track.getBoundingClientRect()
      const x = Math.max(r.left + 6, Math.min(r.right - 6, e.clientX))
      const y = Math.min(r.bottom - 6, Math.max(r.top + 6, e.clientY))
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('class', 'script-blot')
      svg.setAttribute('width', '120')
      svg.setAttribute('height', '120')
      svg.setAttribute('viewBox', '-60 -60 120 120')
      Object.assign(svg.style, { left: `${x - 60}px`, top: `${y - 60}px` })
      const drops = [{ x: 0, y: 0, r: 7 + Math.random() * 3 }]
      for (let i = 0; i < 5; i++) {
        const a = Math.random() * Math.PI * 2
        const d = 12 + Math.random() * 22
        drops.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: 1 + Math.random() * 2.4 })
      }
      for (const d of drops) {
        const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
        p.setAttribute('d', blotPath(d.r))
        p.setAttribute('transform', `translate(${d.x.toFixed(1)} ${d.y.toFixed(1)})`)
        p.setAttribute('fill', `rgba(${INK}, 0.88)`)
        svg.appendChild(p)
      }
      ink.current.appendChild(svg)
      setTimeout(() => svg.remove(), 2600)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [])

  return (
    <>
      <div ref={light} className="script-light" aria-hidden="true" />
      <div ref={night} className="script-night" aria-hidden="true" />
      <canvas ref={motes} className="script-motes" aria-hidden="true" />
      <div ref={ink} className="script-ink" aria-hidden="true" />
    </>
  )
}
