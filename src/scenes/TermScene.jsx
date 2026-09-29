import { useEffect, useMemo, useRef, useState } from 'react'
import {
  uptime, loadAverage, topTags, runningNow, meter, slotOfDay, hhmm, span,
} from './terminal.js'
import { runLoop, stillness } from './loop.js'
import { useMinute } from '../useMinute.js'
import { todayISO, formatDotted } from '../time.js'

// Nightshift.
//
// The app as an old green-screen terminal on the night shift, reading your
// days the way it would read a machine.
//
// Across the top, beside the title, a system monitor like htop: what has
// been taking your time this week as coloured meters, how many days running
// you have logged as the uptime, and hours logged a day as the load average.
// Along the bottom, a status line like vim's: which mode the app is in
// (NORMAL, PAINT with the tag you picked up, FIND, NOTE, CONFIG), what is
// running now and for how long, which ten minutes of the day it is, and the
// clock.
//
// It boots when it comes on — a second of BIOS text, which any key or click
// skips. The glass curves at the edges, the cursors blink together,
// and the pointer leaves a phosphor trail that fades like a real tube's.
// Painting a stretch writes it: a scan sweeps across the new block with the
// data flickering behind it.
//
// Everything that moves runs on the shared clock (loop.js), and nothing does
// when less movement is asked for — no boot, no trail, no blinking.

const METER_WIDTH = 18

/** The monitor beside the title: this week's top tags, the uptime, the load. */
export function TermMonitor({ days, tags }) {
  const today = todayISO()
  const top = useMemo(() => topTags(days, today), [days, today])
  const up = useMemo(() => uptime(days, today), [days, today])
  const load = useMemo(() => loadAverage(days, today), [days, today])
  const tagById = (id) => tags.find((t) => t.id === id)

  return (
    <div
      className="term-monitor"
      title={'Top tags this week · days in a row with something logged · hours logged a day: yesterday, last 7 days, last 30 days'}
    >
      <div className="tm-meters">
        {top.length === 0 && <div className="tm-meter tm-none">no processes this week</div>}
        {top.map(({ tag, share }) => {
          const t = tagById(tag)
          const pct = `${(share * 100).toFixed(1)}%`
          const bars = meter(share, METER_WIDTH).slice(0, METER_WIDTH - pct.length)
          return (
            <div key={tag} className="tm-meter">
              <span className="tm-name">{(t?.name ?? tag).slice(0, 11)}</span>
              <span className="tm-bracket">[</span>
              <span className="tm-bars" style={{ color: t?.colour }}>{bars}</span>
              <span className="tm-pct">{pct}</span>
              <span className="tm-bracket">]</span>
            </div>
          )
        })}
      </div>
      <div className="tm-sys">
        <div><b>Uptime:</b> <em>{up}</em> {up === 1 ? 'day' : 'days'}</div>
        <div><b>Load average:</b> <em>{load[0].toFixed(2)}</em> {load[1].toFixed(2)} {load[2].toFixed(2)}</div>
        <div><b>Tasks:</b> {tags.filter((t) => !t.hidden).length} tags</div>
      </div>
    </div>
  )
}

/** The clock at the end of the status line, to the second. */
function Clock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])
  const two = (n) => String(n).padStart(2, '0')
  return <span className="ts-clock">{`${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`}</span>
}

/** A second of BIOS text as the terminal comes on. */
function Boot({ lines, onDone }) {
  const [shown, setShown] = useState(0)
  const [leaving, setLeaving] = useState(false)
  const done = useRef(onDone)
  done.current = onDone

  // Timed by how many lines there are, not by what they say: the numbers in
  // them can still be arriving from the vault while it types.
  const count = lines.length
  useEffect(() => {
    const timers = Array.from({ length: count }, (_, i) => setTimeout(() => setShown(i + 1), 160 + i * 105))
    const end = 160 + count * 105 + 260
    timers.push(setTimeout(() => setLeaving(true), end))
    timers.push(setTimeout(() => done.current(), end + 380))
    // Any key or click skips it: nobody should have to wait for a joke.
    const skip = () => done.current()
    window.addEventListener('keydown', skip, true)
    window.addEventListener('pointerdown', skip, true)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('keydown', skip, true)
      window.removeEventListener('pointerdown', skip, true)
    }
  }, [count])

  return (
    <div className={`term-boot${leaving ? ' leaving' : ''}`} aria-hidden="true">
      <pre>
        {lines.slice(0, shown).join('\n')}
        <span className="term-caret">█</span>
      </pre>
    </div>
  )
}

const dots = (label, answer, width = 44) => `${label} ${'.'.repeat(Math.max(3, width - label.length))} ${answer}`

export default function TermScene({ days, tags, mode, recorded }) {
  const minute = useMinute()
  const today = todayISO()
  const tagName = (id) => tags.find((t) => t.id === id)?.name ?? id
  const running = useMemo(() => runningNow(days, today, minute), [days, today, minute])
  const where = slotOfDay(minute)

  // Booting, once, when the terminal comes on.
  const [booting, setBooting] = useState(() => !stillness())
  let bootLines = null
  if (booting) {
    const up = uptime(days, today)
    bootLines = [
      'DAILY-DOC BIOS v4.20   nightshift terminal',
      '',
      dots('CPU: one (1) human', 'OK'),
      dots('Memory test: 1440 min', 'OK'),
      dots('Mounting vault /Daily', 'OK'),
      dots('Reading days', recorded > 0 ? `${recorded} found` : 'OK'),
      dots('Loading tags', tags.length > 0 ? String(tags.length) : 'OK'),
      dots('Uptime', `${up} ${up === 1 ? 'day' : 'days'}`),
      '',
      '> starting shell',
    ]
  }

  // --- the phosphor trail and the writes ------------------------------------
  const trailCanvas = useRef(null)
  const writes = useRef(null)

  // Every cursor on the screen blinks on this one clock, together, by a
  // switch on the page (themes.css). Held lit when less movement is asked for.
  useEffect(() => {
    const page = document.documentElement
    if (stillness()) return undefined
    const timer = setInterval(() => page.classList.toggle('cursor-off'), 550)
    return () => { clearInterval(timer); page.classList.remove('cursor-off') }
  }, [])
  useEffect(() => {
    if (stillness()) return undefined
    const el = trailCanvas.current
    const g = el.getContext('2d')
    const trail = []
    let dirty = false

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      el.width = Math.round(window.innerWidth * dpr)
      el.height = Math.round(window.innerHeight * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    const onMove = (e) => {
      trail.push({ x: e.clientX, y: e.clientY, t: performance.now() })
      if (trail.length > 40) trail.shift()
    }

    // Painting a stretch writes it: a scan across the new block, with the
    // data flickering behind it.
    let paintFrom = null
    const onDown = (e) => {
      const target = e.target instanceof Element ? e.target : null
      paintFrom = document.querySelector('.scroller.armed') && target?.closest('.track') ? e.clientX : null
    }
    const onUp = (e) => {
      if (paintFrom === null) return
      const track = e.target instanceof Element ? e.target.closest('.track') : null
      const from = paintFrom
      paintFrom = null
      if (!track || !writes.current) return
      const r = track.getBoundingClientRect()
      const left = Math.max(r.left, Math.min(from, e.clientX) - 4)
      const right = Math.min(r.right, Math.max(from, e.clientX) + 4)
      const w = Math.max(24, right - left)
      const write = document.createElement('span')
      write.className = 'term-write'
      Object.assign(write.style, { left: `${left}px`, top: `${r.top}px`, width: `${w}px`, height: `${r.height}px` })
      const rows = Math.max(1, Math.floor(r.height / 13))
      const cols = Math.max(2, Math.floor(w / 8))
      let bits = ''
      for (let row = 0; row < rows; row++) {
        for (let c = 0; c < cols; c++) bits += Math.random() < 0.5 ? '0' : '1'
        bits += '\n'
      }
      write.textContent = bits
      writes.current.appendChild(write)
      setTimeout(() => write.remove(), 900)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)

    const LIFE = 320
    const stop = runLoop((now) => {
      while (trail.length && now - trail[0].t > LIFE) trail.shift()
      if (trail.length < 2) {
        if (dirty) { g.clearRect(0, 0, window.innerWidth, window.innerHeight); dirty = false }
        return
      }
      g.clearRect(0, 0, window.innerWidth, window.innerHeight)
      g.lineCap = 'round'
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1]
        const b = trail[i]
        const fade = 1 - (now - b.t) / LIFE
        g.strokeStyle = `rgba(93, 255, 143, ${0.35 * fade})`
        g.lineWidth = 1 + 3 * fade
        g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.stroke()
      }
      dirty = true
    })

    return () => {
      stop()
      window.removeEventListener('resize', size)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [])

  let run
  if (running.state === 'running') {
    run = <><b>▶ {tagName(running.tag)}</b> since {hhmm(running.since)} · {span(minute - running.since)}</>
  } else if (running.since !== null) {
    run = <><b>■ idle</b> since {hhmm(running.since)} · {span(minute - running.since)}</>
  } else {
    run = <><b>■ idle</b> — nothing logged today</>
  }

  return (
    <>
      <div className="term-glass" aria-hidden="true" />
      <canvas ref={trailCanvas} className="term-trail" aria-hidden="true" />
      <div ref={writes} className="term-writes" aria-hidden="true" />
      {booting && <Boot lines={bootLines} onDone={() => setBooting(false)} />}

      {/* The status line along the foot of the page. */}
      <div className="term-status">
        <span className={`ts-mode ${mode.mode.toLowerCase()}`}>{mode.mode}</span>
        {mode.detail && <span className="ts-detail">{mode.detail}</span>}
        <span className="ts-run">{run}</span>
        <span className="ts-fill" />
        <span className="ts-pos">slot {where.slot}/{where.of}</span>
        <span className="ts-date">{formatDotted(today)}</span>
        <Clock />
      </div>
    </>
  )
}
