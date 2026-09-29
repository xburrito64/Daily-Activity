import { useEffect, useRef, useState } from 'react'
import { monthByTag, rankUps, completeDays, starField } from './starlit.js'
import { MagicCircle, Seal, RankGem, Moonweed } from './StarParts.jsx'
import { runLoop, stillness } from './loop.js'
import { todayISO } from '../time.js'

// Starlit: a grimoire, open at night.
//
// The window is framed like a leaf of an old spellbook, a fine gold rule
// all the way round. Up in its corner turns a great arcane seal, ring within
// ring, with the real moon at its heart in tonight's phase. Behind the days
// lies a still field of stars, a few of them breathing; now and then one
// falls.
//
// Logging is casting. While a tag is picked up, a magic circle in its colour
// follows the pointer over the days; press, and a second anchors where the
// stretch begins, runes running between them. Let go and the spell goes
// off: the circles flare and scatter into mana, and a star falls.
//
// Every tag is a school of magic with a rank earned by its hours this past
// month (starlit.js). A cast that lifts one to a new rank is announced; one
// that fills the last hour of a day brings a shower of falling stars and a
// moonweed by its date.
//
// Everything is drawn sharp, at the screen's own resolution: the still stars
// once, the few that move on the shared clock (loop.js), and the seal as
// finished pictures the graphics card only turns. With less movement asked
// for, nothing turns, breathes or falls.

const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'
const CAST_WINDOW_MS = 5000
const STARS = 190
const SHOWER = 22

/** A mote of mana, drawn once as a soft dot and stamped from then on. */
function moteSprite(core, edge) {
  const c = document.createElement('canvas')
  c.width = 20
  c.height = 20
  const g = c.getContext('2d')
  const fill = g.createRadialGradient(10, 10, 0, 10, 10, 10)
  fill.addColorStop(0, core)
  fill.addColorStop(0.3, edge)
  fill.addColorStop(1, 'rgba(0, 0, 0, 0)')
  g.fillStyle = fill
  g.fillRect(0, 0, 20, 20)
  return c
}

const starColour = (s, alpha) => (s.warm
  ? `rgba(255, 236, 200, ${Math.max(0, alpha).toFixed(3)})`
  : `rgba(220, 234, 255, ${Math.max(0, alpha).toFixed(3)})`)

/** A spell's colour, lifted toward the light of mana so even a dark tag glows. */
const manaOf = (colour) => `color-mix(in oklab, ${colour} 50%, #e2f3ff)`

export default function StarScene({ days, tags }) {
  const stillCanvas = useRef(null)
  const liveCanvas = useRef(null)
  const moteCanvas = useRef(null)
  const caster = useRef(null)
  const anchor = useRef(null)
  const beam = useRef(null)
  const [notices, setNotices] = useState([])

  const lastCast = useRef(-Infinity)
  const motes = useRef([])
  const falling = useRef([])

  /** Send a star falling, down and to the left across the upper sky. */
  const fall = useRef((delay = 0) => {
    const w = window.innerWidth
    const h = window.innerHeight
    const speed = 850 + Math.random() * 500
    const angle = 0.42 + Math.random() * 0.25 // below the horizontal, heading left
    falling.current.push({
      x: w * (0.35 + Math.random() * 0.65),
      y: h * Math.random() * 0.3,
      vx: -Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      age: -delay,
      life: 0.6 + Math.random() * 0.4,
    })
  })

  // --- the stars ------------------------------------------------------------
  useEffect(() => {
    const still = stillCanvas.current
    const live = liveCanvas.current
    const gs = still.getContext('2d')
    const gl = live.getContext('2d')
    const field = starField(STARS)
    const breathing = field.filter((s) => s.twinkle)
    const calm = stillness()
    let w = 0
    let h = 0

    const dot = (g, s, alpha, grow = 0) => {
      g.fillStyle = starColour(s, alpha)
      g.beginPath()
      g.arc(s.x * w, s.y * h, s.r + grow, 0, Math.PI * 2)
      g.fill()
    }
    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      for (const [el, g] of [[still, gs], [live, gl]]) {
        el.width = Math.round(w * dpr)
        el.height = Math.round(h * dpr)
        g.setTransform(dpr, 0, 0, dpr, 0, 0)
      }
      for (const s of field) {
        if (s.twinkle && !calm) continue
        if (s.glow) {
          const x = s.x * w
          const y = s.y * h
          const halo = gs.createRadialGradient(x, y, 0, x, y, 7)
          halo.addColorStop(0, starColour(s, 0.3))
          halo.addColorStop(1, starColour(s, 0))
          gs.fillStyle = halo
          gs.fillRect(x - 7, y - 7, 14, 14)
        }
        dot(gs, s, s.glow ? 0.95 : 0.4 + s.r * 0.25)
      }
    }
    paint()
    window.addEventListener('resize', paint)
    if (calm) return () => window.removeEventListener('resize', paint)

    let nextFall = performance.now() + 7000 + Math.random() * 10000
    const stop = runLoop((now, dt) => {
      const t = now / 1000
      gl.clearRect(0, 0, w, h)
      // The few stars that breathe, with a fine cross of light at their brightest.
      for (const s of breathing) {
        const a = 0.2 + 0.75 * (0.5 + 0.5 * Math.sin(t * 1.1 + s.phase * 3))
        dot(gl, s, a, 0.15)
        if (a > 0.82) {
          const x = s.x * w
          const y = s.y * h
          const reach = 3 + (a - 0.82) * 30
          gl.strokeStyle = starColour(s, (a - 0.82) * 4)
          gl.lineWidth = 0.6
          gl.beginPath()
          gl.moveTo(x - reach, y); gl.lineTo(x + reach, y)
          gl.moveTo(x, y - reach); gl.lineTo(x, y + reach)
          gl.stroke()
        }
      }
      // Falling stars: a fine bright line, its tail fading out behind it.
      if (now > nextFall) {
        fall.current()
        nextFall = now + 18000 + Math.random() * 30000
      }
      const list = falling.current
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i]
        m.age += dt
        if (m.age < 0) continue
        if (m.age > m.life) { list.splice(i, 1); continue }
        const k = m.age / m.life
        const hx = m.x + m.vx * m.age
        const hy = m.y + m.vy * m.age
        const tx = hx - m.vx * 0.14
        const ty = hy - m.vy * 0.14
        const fade = Math.sin(Math.PI * Math.min(1, k * 1.05))
        const line = gl.createLinearGradient(hx, hy, tx, ty)
        line.addColorStop(0, `rgba(255, 252, 240, ${(0.95 * fade).toFixed(3)})`)
        line.addColorStop(0.25, `rgba(210, 232, 255, ${(0.45 * fade).toFixed(3)})`)
        line.addColorStop(1, 'rgba(200, 220, 255, 0)')
        gl.strokeStyle = line
        gl.lineCap = 'round'
        gl.lineWidth = 1.3
        gl.beginPath(); gl.moveTo(hx, hy); gl.lineTo(tx, ty); gl.stroke()
        gl.fillStyle = `rgba(255, 253, 244, ${fade.toFixed(3)})`
        gl.beginPath(); gl.arc(hx, hy, 1.2, 0, Math.PI * 2); gl.fill()
      }
    })
    return () => { stop(); window.removeEventListener('resize', paint) }
  }, [])

  // --- the seal ----------------------------------------------------------------
  // It crowns the page: centred over the open stretch of the header between
  // the view switch and the Today button, so the moon at its heart sits in
  // the one part of the top of the window with nothing else in it.
  useEffect(() => {
    const place = () => {
      const seal = document.querySelector('.app > .seal')
      const left = document.querySelector('.viewswitch')?.getBoundingClientRect()
      const right = document.querySelector('.nav.today')?.getBoundingClientRect()
      if (!seal) return
      const x = left && right && right.left - left.right > 160
        ? (left.right + right.left) / 2
        : window.innerWidth * 0.62
      const y = left ? left.top + left.height / 2 : 48
      seal.style.setProperty('--seal-x', `${Math.round(x)}px`)
      seal.style.setProperty('--seal-y', `${Math.round(y)}px`)
    }
    place()
    const settle = () => requestAnimationFrame(() => requestAnimationFrame(place))
    const watch = new ResizeObserver(settle)
    const header = document.querySelector('.app > header')
    if (header) watch.observe(header)
    window.addEventListener('resize', settle)
    return () => { watch.disconnect(); window.removeEventListener('resize', settle) }
  }, [])

  // --- casting ---------------------------------------------------------------
  useEffect(() => {
    if (stillness()) return undefined
    const el = moteCanvas.current
    const g = el.getContext('2d')
    const gold = moteSprite('rgba(255, 248, 225, 1)', 'rgba(226, 196, 130, 0.8)')
    const pale = moteSprite('rgba(240, 250, 255, 1)', 'rgba(160, 210, 255, 0.8)')
    let tinted = new Map()
    const spriteFor = (colour) => {
      if (!tinted.has(colour)) {
        if (tinted.size > 40) tinted = new Map()
        tinted.set(colour, moteSprite('rgba(255, 255, 255, 1)', colour))
      }
      return tinted.get(colour)
    }
    let dirty = false

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      el.width = Math.round(window.innerWidth * dpr)
      el.height = Math.round(window.innerHeight * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    const armedColour = () => {
      const chip = document.querySelector('.daychips .chip.armed')
      return chip?.style.getPropertyValue('--chip')?.trim() || '#c9a86a'
    }
    const show = (node, x, y, px, colour) => {
      node.style.display = 'block'
      node.style.color = manaOf(colour)
      node.style.width = `${px}px`
      node.style.height = `${px}px`
      node.style.transform = `translate(${x - px / 2}px, ${y - px / 2}px)`
    }
    const hide = (node) => { if (node) node.style.display = 'none' }

    let casting = null // { x, y, colour, track } while the pointer is down

    const onMove = (e) => {
      const armed = document.querySelector('.scroller.armed')
      const track = e.target instanceof Element ? e.target.closest('.track') : null
      if (!armed || (!track && !casting)) {
        if (!casting) hide(caster.current)
        return
      }
      const r = (casting?.track ?? track).getBoundingClientRect()
      const px = Math.max(52, Math.min(140, r.height * 1.35))
      const y = r.top + r.height / 2
      const x = Math.max(r.left, Math.min(r.right, e.clientX))
      const colour = casting?.colour ?? armedColour()
      show(caster.current, x, y, px, colour)
      if (casting && beam.current) {
        const width = Math.abs(x - casting.x)
        Object.assign(beam.current.style, {
          display: width > 6 ? 'block' : 'none',
          color: manaOf(colour),
          left: `${Math.min(casting.x, x)}px`,
          top: `${y - 9}px`,
          width: `${width}px`,
        })
      }
    }

    const onDown = (e) => {
      if (!document.querySelector('.scroller.armed')) return
      const track = e.target instanceof Element ? e.target.closest('.track') : null
      if (!track) return
      const r = track.getBoundingClientRect()
      const px = Math.max(52, Math.min(140, r.height * 1.35))
      casting = { x: e.clientX, y: r.top + r.height / 2, colour: armedColour(), track }
      show(anchor.current, casting.x, casting.y, px, casting.colour)
      onMove(e)
    }

    const burst = (x0, x1, y, colour, count) => {
      const sprite = spriteFor(manaOf(colour))
      for (let i = 0; i < count; i++) {
        motes.current.push({
          x: x0 + Math.random() * Math.max(1, x1 - x0),
          y: y + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 50,
          vy: -(30 + Math.random() * 90),
          age: 0,
          life: 1.4 + Math.random() * 1.6,
          size: 0.35 + Math.random() * 0.6,
          seed: Math.random() * 100,
          sprite: i % 3 === 0 ? gold : i % 5 === 0 ? pale : sprite,
        })
      }
    }

    const onUp = (e) => {
      if (!casting) return
      const c = casting
      casting = null
      const r = c.track.getBoundingClientRect()
      const x = Math.max(r.left, Math.min(r.right, e.clientX))
      // The spell goes off: both circles flare and are gone, and the mana
      // scatters upward.
      for (const node of [anchor.current, caster.current]) {
        if (!node) continue
        node.classList.remove('released')
        void node.offsetWidth
        node.classList.add('released')
      }
      hide(beam.current)
      setTimeout(() => {
        for (const node of [anchor.current, caster.current]) node?.classList.remove('released')
        hide(anchor.current)
        if (!document.querySelector('.scroller.armed')) hide(caster.current)
      }, 650)
      burst(Math.min(c.x, x), Math.max(c.x, x), c.y, c.colour, Math.min(60, 16 + Math.abs(x - c.x) / 12))
      fall.current(0.15)
      lastCast.current = performance.now()
    }

    const onKey = (e) => {
      if (e.key !== 'Escape') return
      casting = null
      hide(caster.current); hide(anchor.current); hide(beam.current)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)
    window.addEventListener('keydown', onKey)

    const stop = runLoop((now, dt) => {
      // Put the pointer's circle away once nothing is picked up any more.
      if (!casting && caster.current?.style.display === 'block' && !document.querySelector('.scroller.armed')) {
        hide(caster.current)
      }
      const list = motes.current
      if (list.length === 0) {
        if (dirty) { g.clearRect(0, 0, window.innerWidth, window.innerHeight); dirty = false }
        return
      }
      const t = now / 1000
      g.clearRect(0, 0, window.innerWidth, window.innerHeight)
      g.globalCompositeOperation = 'lighter'
      for (let i = list.length - 1; i >= 0; i--) {
        const m = list[i]
        m.age += dt
        if (m.age >= m.life) { list.splice(i, 1); continue }
        m.vx *= Math.exp(-dt * 1.2)
        m.vy += 12 * dt
        m.x += (m.vx + Math.sin(t * 2.2 + m.seed) * 16) * dt
        m.y += m.vy * dt
        const k = m.age / m.life
        const px = 20 * m.size * (1 - k * 0.4)
        g.globalAlpha = (k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85) * (0.75 + 0.25 * Math.sin(t * 9 + m.seed))
        g.drawImage(m.sprite, m.x - px / 2, m.y - px / 2, px, px)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
      dirty = true
    })

    return () => {
      stop()
      window.removeEventListener('resize', size)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  // --- the reckoning after a cast -------------------------------------------
  // Ranks and finished days are read every time the days change, but only
  // announced when a cast has just happened: days arriving from the vault as
  // you scroll are not a thing you did.
  const month = useRef(null)
  const done = useRef(null)
  useEffect(() => {
    const today = todayISO()
    const nextMonth = monthByTag(days, today)
    const nextDone = completeDays(days)
    const fresh = performance.now() - lastCast.current < CAST_WINDOW_MS && month.current
    if (fresh) {
      const said = []
      for (const up of rankUps(month.current, nextMonth)) {
        said.push({ kind: 'rank', tag: up.tag, rank: up.rank, minutes: nextMonth.get(up.tag) })
      }
      for (const date of nextDone) {
        if (!done.current.has(date)) said.push({ kind: 'complete', date })
      }
      if (said.length) {
        const stamp = Date.now()
        setNotices((was) => [...was, ...said.map((n, i) => ({ ...n, id: `${stamp}-${i}` }))].slice(-3))
        if (said.some((n) => n.kind === 'complete') && !stillness()) {
          // A shower of falling stars, for a day with every hour in it.
          for (let i = 0; i < SHOWER; i++) fall.current(i * 0.14 + Math.random() * 0.12)
        }
      }
    }
    month.current = nextMonth
    done.current = nextDone
  }, [days])

  // Each notice goes after a few seconds.
  useEffect(() => {
    if (notices.length === 0) return undefined
    const timer = setTimeout(() => setNotices((was) => was.slice(1)), 4400)
    return () => clearTimeout(timer)
  }, [notices])

  return (
    <>
      <canvas ref={stillCanvas} className="star-field" aria-hidden="true" />
      <canvas ref={liveCanvas} className="star-field" aria-hidden="true" />
      <Seal />
      <div className="grimoire-frame" aria-hidden="true"><i /><i /><i /><i /></div>
      <canvas ref={moteCanvas} className="star-motes" aria-hidden="true" />
      <div ref={anchor} className="star-cast anchor" aria-hidden="true"><MagicCircle size="100%" /></div>
      <div ref={caster} className="star-cast" aria-hidden="true"><MagicCircle size="100%" /></div>
      <div ref={beam} className="star-beam" aria-hidden="true"><span>{RUNES.repeat(12)}</span></div>
      <StarNotices notices={notices} tags={tags} />
    </>
  )
}

/** What the sky announces: a rank attained, or a day complete. */
function StarNotices({ notices, tags }) {
  if (notices.length === 0) return null
  const tagOf = (id) => tags.find((t) => t.id === id)
  return (
    <div className="star-notices" role="status">
      {notices.map((n) => {
        const tag = n.kind === 'rank' ? tagOf(n.tag) : null
        return (
          <div
            key={n.id}
            className={`star-notice ${n.kind}`}
            style={{ '--spell': tag?.colour ?? '#9fd8ff' }}
          >
            <span className="notice-mark">
              <MagicCircle size="100%" className="notice-circle" />
              {n.kind === 'rank' ? <RankGem minutes={n.minutes} /> : <Moonweed title="" />}
            </span>
            <span className="notice-words">
              <span className="notice-eyebrow">{n.kind === 'rank' ? 'Rank attained' : 'A day complete'}</span>
              <b className="notice-title">{n.kind === 'rank' ? tag?.name ?? n.tag : 'Every hour accounted for'}</b>
              <span className="notice-line">
                {n.kind === 'rank' ? <>now of <em>{n.rank}</em> rank</> : 'a moonweed blooms by its date'}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}
