import { useEffect, useRef, useState } from 'react'
import { growBranch, branchWords } from './petals.js'
import { runLoop, stillness } from './loop.js'
import { formatDayHeading } from '../time.js'

// Petalfall.
//
// A sakura branch grows across the top of the page, in the space between the
// title and the buttons, and it is made of your last few weeks: a blossom for
// every day with anything logged on it, a closed bud for every day without,
// today at the tip. Hover one and it says which day it is; click it and the
// list goes there.
//
// Petals come off the blossoms and drift down over the days. Some settle on
// top of the bars and rest there a while; scrolling is a gust that lifts them
// off again. Painting a block shakes a flurry loose from where it was
// painted, and moving the mouse through them stirs them.
//
// The branch is drawn once, and again only when it changes. The petals run on
// the shared clock (loop.js). With less movement asked for, there are no
// petals at all — only the branch.

const MAX_FALLING = 38
const REST_CHANCE = 0.55
const SPRITE = 40
// Dark cherry bark, a few shades up from the evening so the branch reads.
const BARK = '#6b3a55'

/** A petal, drawn once into a small canvas per tint and stamped from then on. */
function petalSprite(inner, outer) {
  const c = document.createElement('canvas')
  c.width = SPRITE
  c.height = SPRITE
  const g = c.getContext('2d')
  g.translate(SPRITE / 2, SPRITE / 2 + 6)
  const r = 15
  const fill = g.createRadialGradient(0, 0, 1, 0, -r * 0.6, r * 1.1)
  fill.addColorStop(0, inner)
  fill.addColorStop(1, outer)
  g.fillStyle = fill
  petalPath(g, r)
  g.fill()
  return c
}

/** One sakura petal pointing up from the origin, with its notched tip. */
function petalPath(g, r) {
  g.beginPath()
  g.moveTo(0, 0)
  g.bezierCurveTo(-r * 0.62, -r * 0.35, -r * 0.6, -r * 1.02, -r * 0.2, -r * 1.02)
  g.lineTo(0, -r * 0.84)
  g.lineTo(r * 0.2, -r * 1.02)
  g.bezierCurveTo(r * 0.6, -r * 1.02, r * 0.62, -r * 0.35, 0, 0)
  g.closePath()
}

function drawBlossom(g, x, y, r, turn, lit) {
  g.save()
  g.translate(x, y)
  g.rotate(turn)
  if (lit) {
    g.shadowColor = 'rgba(255, 190, 215, 0.9)'
    g.shadowBlur = 14
  }
  for (let i = 0; i < 5; i++) {
    g.save()
    g.rotate((i * Math.PI * 2) / 5)
    const fill = g.createLinearGradient(0, 0, 0, -r)
    fill.addColorStop(0, '#e9709f')
    fill.addColorStop(0.45, '#f7b6cf')
    fill.addColorStop(1, '#fff0f6')
    g.fillStyle = fill
    petalPath(g, r)
    g.fill()
    g.restore()
  }
  g.shadowBlur = 0
  g.fillStyle = '#ffd98a'
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 + 0.6
    g.beginPath()
    g.arc(Math.cos(a) * r * 0.28, Math.sin(a) * r * 0.28, Math.max(0.8, r * 0.07), 0, Math.PI * 2)
    g.fill()
  }
  g.restore()
}

function drawBud(g, x, y, r, turn, lit) {
  g.save()
  g.translate(x, y)
  g.rotate(turn)
  if (lit) {
    g.shadowColor = 'rgba(255, 190, 215, 0.8)'
    g.shadowBlur = 10
  }
  g.fillStyle = '#6f8a52'
  g.beginPath()
  g.ellipse(0, r * 0.55, r * 0.45, r * 0.35, 0, 0, Math.PI * 2)
  g.fill()
  const fill = g.createLinearGradient(0, r * 0.5, 0, -r)
  fill.addColorStop(0, '#b8487a')
  fill.addColorStop(1, '#f39bbd')
  g.fillStyle = fill
  g.beginPath()
  g.moveTo(0, -r)
  g.bezierCurveTo(r * 0.7, -r * 0.4, r * 0.55, r * 0.5, 0, r * 0.55)
  g.bezierCurveTo(-r * 0.55, r * 0.5, -r * 0.7, -r * 0.4, 0, -r)
  g.fill()
  g.restore()
}

/** The space between the view switch and the Today button, where the branch grows. */
function branchBox() {
  const header = document.querySelector('.app > header')
  const left = document.querySelector('.viewswitch')
  const right = document.querySelector('.nav.today')
  if (!header || !left || !right) return null
  const h = header.getBoundingClientRect()
  const a = left.getBoundingClientRect()
  const b = right.getBoundingClientRect()
  const box = { x0: a.right + 28, x1: b.left - 12, y0: h.top - 4, y1: h.bottom + 10 }
  // A window too narrow for a branch simply doesn't grow one.
  return box.x1 - box.x0 < 180 ? null : box
}

export default function PetalScene({ branch, onPick }) {
  const branchCanvas = useRef(null)
  const fallCanvas = useRef(null)
  const shape = useRef(null) // the branch as last drawn, in screen coordinates
  const [hover, setHover] = useState(null)
  const hoverRef = useRef(null)
  hoverRef.current = hover
  const pick = useRef(onPick)
  pick.current = onPick
  const days = useRef(branch)
  days.current = branch

  // --- the branch -------------------------------------------------------
  // Drawn when it first appears, when a day blooms or the window changes
  // size, and when the one under the pointer changes — never on a clock.
  useEffect(() => {
    const el = branchCanvas.current
    if (!el) return undefined
    const draw = () => {
      const box = branchBox()
      const g = el.getContext('2d')
      if (!box) {
        shape.current = null
        el.width = 0
        return
      }
      const pad = 40
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const left = box.x0 - pad
      const top = box.y0 - pad
      const w = box.x1 - box.x0 + pad * 2 + 40
      const h = box.y1 - box.y0 + pad * 2
      Object.assign(el.style, { left: `${left}px`, top: `${top}px`, width: `${w}px`, height: `${h}px` })
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, -left * dpr, -top * dpr)

      const grown = growBranch(box, days.current.length)
      shape.current = grown

      // The bough, thick by the trunk and fine at the tip, with a thin line
      // of light along its top.
      g.lineCap = 'round'
      for (let i = 1; i < grown.bough.length; i++) {
        const a = grown.bough[i - 1]
        const b = grown.bough[i]
        g.strokeStyle = BARK
        g.lineWidth = grown.widths[i]
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke()
      }
      g.strokeStyle = 'rgba(255, 196, 220, 0.5)'
      g.lineWidth = 1.2
      g.beginPath()
      grown.bough.forEach((p, i) => (i === 0 ? g.moveTo(p.x, p.y - 1.5) : g.lineTo(p.x, p.y - grown.widths[i] * 0.3)))
      g.stroke()
      g.strokeStyle = BARK
      g.lineWidth = 1.6
      for (const twig of grown.twigs) {
        g.beginPath(); g.moveTo(twig.from.x, twig.from.y); g.lineTo(twig.to.x, twig.to.y); g.stroke()
      }

      // A day on each twig.
      const lastIndex = days.current.length - 1
      grown.nodes.forEach((node, i) => {
        const day = days.current[i]
        g.strokeStyle = BARK
        g.lineWidth = Math.max(1.1, node.width * 0.4)
        g.beginPath(); g.moveTo(node.stem.x, node.stem.y); g.lineTo(node.x, node.y); g.stroke()
        const lit = hoverRef.current === i || i === lastIndex
        const r = (day?.bloom ? 8.5 : 4.2) * node.size * (i === lastIndex ? 1.2 : 1)
        if (day?.bloom) drawBlossom(g, node.x, node.y, r, node.turn, lit)
        else drawBud(g, node.x, node.y, r, node.turn, lit)
      })
    }

    draw()
    // Measured once the page has finished moving, not while it is: a window
    // that has just grown can still report the old gap for a moment, and a
    // branch measured then would decide there was no room and stay hidden.
    let pending = 0
    const later = () => {
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(() => requestAnimationFrame(draw))
    }
    const header = document.querySelector('.app > header')
    const watch = new ResizeObserver(later)
    if (header) watch.observe(header)
    for (const el of document.querySelectorAll('.viewswitch, .nav.today')) watch.observe(el)
    window.addEventListener('resize', later)
    return () => {
      cancelAnimationFrame(pending)
      watch.disconnect()
      window.removeEventListener('resize', later)
    }
  }, [branch, hover])

  // --- hovering and picking a day on the branch -------------------------
  useEffect(() => {
    const nodeAt = (x, y) => {
      const nodes = shape.current?.nodes ?? []
      let best = null
      let near = 14 * 14
      nodes.forEach((n, i) => {
        const d = (n.x - x) ** 2 + (n.y - y) ** 2
        if (d < near) { near = d; best = i }
      })
      return best
    }
    const onMove = (e) => {
      const over = e.target instanceof Element && e.target.closest('button, input, label, a, .settings')
      const i = over ? null : nodeAt(e.clientX, e.clientY)
      if (i !== hoverRef.current) setHover(i)
      document.documentElement.classList.toggle('petal-pointing', i !== null)
    }
    const onClick = (e) => {
      const i = hoverRef.current
      if (i === null || !days.current[i]) return
      if (e.target instanceof Element && e.target.closest('button, input, label, a, .settings')) return
      pick.current?.(days.current[i].date)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('click', onClick)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('click', onClick)
      document.documentElement.classList.remove('petal-pointing')
    }
  }, [])

  // --- the petals ---------------------------------------------------------
  useEffect(() => {
    if (stillness()) return undefined
    const el = fallCanvas.current
    const g = el.getContext('2d')
    const sprites = [
      petalSprite('#f07aa6', '#ffe6ef'),
      petalSprite('#f39bbd', '#fff4f8'),
      petalSprite('#e76b9a', '#ffd3e2'),
    ]
    const petals = []
    let tracks = []
    let tracksAt = 0
    const mouse = { x: -999, y: -999, vx: 0, vy: 0 }

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      el.width = Math.round(window.innerWidth * dpr)
      el.height = Math.round(window.innerHeight * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    // The bars on screen, as the surfaces a petal can land on.
    const findTracks = () => {
      tracks = [...document.querySelectorAll('.track')]
        .map((t) => t.getBoundingClientRect())
        .filter((r) => r.bottom > 0 && r.top < window.innerHeight)
    }

    const spawn = (x, y, vx, vy) => petals.push({
      x, y, vx, vy,
      fall: 26 + Math.random() * 22,
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.2,
      phase: Math.random() * Math.PI * 2,
      flip: 1.5 + Math.random() * 2.5,
      size: 0.4 + Math.random() * 0.28,
      sprite: sprites[Math.floor(Math.random() * sprites.length)],
      seed: Math.random() * 100,
      state: 'fall',
      alpha: 0.9,
      until: 0,
    })

    const burst = (x, y, n) => {
      for (let i = 0; i < n; i++) spawn(x, y, (Math.random() - 0.5) * 240, -(70 + Math.random() * 170))
    }

    const onScroll = () => {
      findTracks()
      // A gust: whatever had settled is lifted off again.
      for (const p of petals) {
        if (p.state !== 'rest') continue
        p.state = 'fall'
        p.vy = -(50 + Math.random() * 70)
        p.vx = (Math.random() - 0.5) * 160
      }
    }
    const onMove = (e) => {
      mouse.vx = (e.clientX - mouse.x) * 6
      mouse.vy = (e.clientY - mouse.y) * 6
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    const onDown = (e) => {
      const chip = e.target instanceof Element ? e.target.closest('.daychips .chip') : null
      if (chip) {
        const r = chip.getBoundingClientRect()
        burst(r.left + r.width / 2, r.top + 4, 6)
      }
    }
    const onUp = (e) => {
      // A paint ends where the pointer is let go, on a bar, while a tag is armed.
      if (!document.querySelector('.scroller.armed')) return
      if (e.target instanceof Element && e.target.closest('.track')) burst(e.clientX, e.clientY, 16)
    }
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)

    const stop = runLoop((now, dt) => {
      if (now - tracksAt > 300) { findTracks(); tracksAt = now }

      // New petals come off the blossoms, now and then one from further up.
      const falling = petals.reduce((n, p) => n + (p.state === 'fall' ? 1 : 0), 0)
      if (falling < MAX_FALLING && Math.random() < 0.35) {
        const nodes = shape.current?.nodes ?? []
        const blooms = nodes.filter((_, i) => days.current[i]?.bloom)
        if (blooms.length > 0 && Math.random() < 0.7) {
          const n = blooms[Math.floor(Math.random() * blooms.length)]
          spawn(n.x, n.y, (Math.random() - 0.5) * 20, 10)
        } else {
          spawn(Math.random() * window.innerWidth, -12, 0, 20)
        }
      }

      const t = now / 1000
      const wind = 14 + Math.sin(t * 0.21) * 10
      mouse.vx *= 0.85
      mouse.vy *= 0.85

      g.clearRect(0, 0, window.innerWidth, window.innerHeight)
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i]
        if (p.state === 'fall') {
          p.vx += (wind + Math.sin(t * 0.9 + p.seed) * 18 - p.vx) * dt * 1.1
          p.vy += (p.fall - p.vy) * dt * 1.4
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d2 = dx * dx + dy * dy
          if (d2 < 110 * 110) {
            const f = 1 - Math.sqrt(d2) / 110
            p.vx += mouse.vx * f * dt * 4
            p.vy += mouse.vy * f * dt * 4
          }
          const before = p.y
          p.x += p.vx * dt
          p.y += p.vy * dt
          p.rot += p.spin * dt
          p.phase += p.flip * dt
          for (const r of tracks) {
            if (before < r.top - 1 && p.y >= r.top - 1 && p.x > r.left + 6 && p.x < r.right - 6) {
              if (Math.random() < REST_CHANCE) {
                p.state = 'rest'
                p.y = r.top - 2
                p.until = now + 5000 + Math.random() * 8000
              }
              break
            }
          }
        } else if (p.state === 'rest') {
          if (now > p.until) p.state = 'fade'
        } else {
          p.alpha -= dt / 1.4
        }
        if (p.alpha <= 0 || p.y > window.innerHeight + 30 || p.x < -40 || p.x > window.innerWidth + 40) {
          petals.splice(i, 1)
          continue
        }
        const squash = p.state === 'fall' ? Math.max(0.18, Math.abs(Math.cos(p.phase))) : 0.55
        g.globalAlpha = p.alpha
        g.save()
        g.translate(p.x, p.y)
        g.rotate(p.state === 'fall' ? p.rot : Math.PI / 2 + p.seed % 0.6)
        g.scale(squash * p.size, p.size)
        g.drawImage(p.sprite, -SPRITE / 2, -SPRITE / 2)
        g.restore()
      }
      g.globalAlpha = 1
    })

    return () => {
      stop()
      window.removeEventListener('resize', size)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [])

  const node = hover !== null ? shape.current?.nodes?.[hover] : null
  const day = hover !== null ? branch[hover] : null
  return (
    <>
      <canvas ref={branchCanvas} className="petal-branch" aria-hidden="true" />
      <canvas ref={fallCanvas} className="petal-fall" aria-hidden="true" />
      {node && day && (
        <div className="petal-tip" style={{ left: `${node.x}px`, top: `${node.y + 16}px` }}>
          <strong>{formatDayHeading(day.date)}</strong>
          <span>{branchWords(day)}</span>
        </div>
      )}
    </>
  )
}
