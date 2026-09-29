import { useEffect, useRef, useState } from 'react'
import { moonPhase, monthByTag, rankUps, completeDays } from './starlit.js'
import { MagicCircle } from './StarParts.jsx'
import { runLoop, stillness } from './loop.js'
import { todayISO } from '../time.js'

// Starlit.
//
// A mage's journal, kept on the road under the night sky. The sky is alive:
// stars at three depths drifting past as the days scroll, the band of the
// galaxy with its dust, a faint veil of aurora, and the real moon in
// tonight's phase. Now and then a star falls.
//
// Logging is casting. While a tag is picked up, a magic circle in its colour
// follows the pointer over the days; press, and a second circle anchors
// where the stretch begins, with a line of runes running between them. Let
// go and the spell goes off: the circles flare and scatter into motes of
// mana that drift upward, and a star falls across the sky.
//
// Every tag is a school of magic with a rank (starlit.js). When a cast lifts
// one to a new rank the sky says so; when it fills the last hour of a day, a
// meteor shower goes over — Frieren's once-in-fifty-years one, every time
// you finish a day — and a moonweed flowers beside its date.
//
// The sky is one small shader at half resolution on the shared clock
// (loop.js); with less movement asked for it is drawn once and nothing moves
// or falls.

const SCALE = 0.5
const METEORS = 8
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'
const CAST_WINDOW_MS = 5000

const VERTEX = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;   // how far the days have scrolled, in screen heights
uniform float uMoon;     // 0 new, 0.5 full
uniform vec2 uMoonAt;    // where it hangs, in heights of the screen from the bottom left
uniform vec4 uMeteor[${METEORS}]; // start x, start y, time it began, direction
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}

// One depth of stars: a star in some cells of a grid, each with its own
// size, colour and rate of twinkling. The brightest carry a cross of light.
vec3 stars(vec2 p, float scale, float keep, float size, float t, float boost) {
  vec2 g = p * scale;
  vec2 c = floor(g);
  vec2 f = fract(g);
  float h = hash(c);
  if (h < keep - boost) return vec3(0.0);
  vec2 at = vec2(hash(c + 3.1), hash(c + 7.7)) * 0.7 + 0.15;
  vec2 d = f - at;
  float s = size * (0.5 + hash(c + 1.7));
  float core = exp(-dot(d, d) / (s * s));
  float tw = 0.55 + 0.45 * sin(t * (0.6 + 2.4 * hash(c + 5.3)) + h * 40.0);
  float bright = smoothstep(0.992, 1.0, h);
  vec2 q = abs(d);
  float cross = bright * (exp(-q.y * 90.0) * exp(-q.x * 7.0) + exp(-q.x * 90.0) * exp(-q.y * 7.0));
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.68), hash(c + 9.9));
  return tint * (core * (0.6 + 0.8 * bright) + cross * 0.7) * tw;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  float t = uTime;

  // The night: deepest overhead, a little lighter and violet at the foot.
  vec3 col = mix(vec3(0.035, 0.04, 0.075), vec3(0.018, 0.024, 0.055), uv.y);
  col += vec3(0.07, 0.04, 0.1) * pow(1.0 - uv.y, 3.0) * 0.6;

  // The galaxy: a band across the sky, clouds of violet and teal with a
  // lane of dust down it, thick with faint stars.
  vec2 mid = vec2(aspect * 0.5, 0.5);
  vec2 along = normalize(vec2(1.0, 0.42));
  vec2 rel = p - mid + vec2(0.0, uScroll * 0.05);
  float across = dot(rel, vec2(-along.y, along.x));
  float band = exp(-across * across / 0.05);
  vec2 cp = vec2(dot(rel, along) * 1.6, across * 3.0);
  float cloud = fbm(cp * 2.2 + vec2(t * 0.004, 0.0));
  float tint = fbm(cp * 1.3 + 7.0);
  vec3 glow = mix(vec3(0.34, 0.2, 0.55), vec3(0.14, 0.4, 0.5), tint);
  col += glow * band * smoothstep(0.35, 0.85, cloud) * 0.22;
  col += vec3(0.8, 0.75, 0.95) * band * smoothstep(0.55, 0.95, fbm(cp * 5.0)) * 0.05;
  col *= 1.0 - band * smoothstep(0.55, 0.75, fbm(cp * 4.0 + 3.0)) * 0.35;

  // Aurora: a veil of mana along the top of the sky, barely there.
  float veilX = p.x * 2.3 + fbm(vec2(p.x * 1.2, t * 0.03)) * 3.0;
  float curtain = 0.5 + 0.5 * sin(veilX + t * 0.08);
  float veil = smoothstep(0.55, 1.0, uv.y) * curtain * fbm(vec2(p.x * 5.0, uv.y * 1.5 - t * 0.04));
  col += (vec3(0.2, 0.75, 0.62) * 0.06 + vec3(0.45, 0.35, 0.9) * 0.035) * veil;

  // Stars, nearer ones drifting further as the days scroll.
  col += stars(p + vec2(0.0, uScroll * 0.03), 95.0, 0.72, 0.1, t, band * 0.18) * 0.55;
  col += stars(p + vec2(0.0, uScroll * 0.07), 44.0, 0.86, 0.085, t * 1.3, band * 0.06) * 0.8;
  col += stars(p + vec2(0.0, uScroll * 0.14), 17.0, 0.93, 0.06, t * 0.9, 0.0) * 1.0;

  // The moon, in tonight's phase, with its glow and the faint earthshine on
  // its dark side.
  vec2 m = uMoonAt;
  float R = 0.034;
  vec2 q = (p - m) / R;
  float r2 = dot(q, q);
  float lit = 0.5 * (1.0 - cos(uMoon * 6.2831853));
  col += vec3(0.75, 0.82, 1.0) * lit * 0.1 / (1.0 + r2 * 0.9);
  if (r2 < 1.0) {
    float edge = sqrt(1.0 - q.y * q.y);
    float k = cos(uMoon * 6.2831853);
    float side = uMoon < 0.5 ? q.x - k * edge : -k * edge - q.x;
    float day = smoothstep(-0.08, 0.08, side);
    float maria = fbm(q * 2.4 + 11.0);
    vec3 surface = vec3(0.88, 0.87, 0.82) * (0.68 + 0.3 * smoothstep(0.35, 0.7, maria));
    surface *= 0.85 + 0.15 * sqrt(max(0.0, 1.0 - r2));
    vec3 disc = mix(vec3(0.05, 0.06, 0.09), surface, day);
    col = mix(col, disc, smoothstep(1.0, 0.94, r2));
  }

  // Falling stars.
  for (int i = 0; i < ${METEORS}; i++) {
    vec4 me = uMeteor[i];
    float age = t - me.z;
    if (age < 0.0 || age > 1.3) continue;
    vec2 dir = vec2(cos(me.w), sin(me.w));
    vec2 head = me.xy + dir * age * 0.95;
    vec2 back = p - head;
    float s = -dot(back, dir);
    float len = 0.32;
    float fade = smoothstep(0.0, 0.12, age) * smoothstep(1.3, 0.8, age);
    if (s > -0.01 && s < len) {
      float perp = length(back + dir * s);
      float trail = (1.0 - s / len) * exp(-perp * perp / 0.000012);
      col += vec3(1.0, 0.94, 0.8) * trail * fade * 1.2;
    }
    col += vec3(1.0, 0.95, 0.85) * fade * 0.0009 / (dot(back, back) + 0.0004);
  }

  // The corners of the sky fall away.
  vec2 v = uv - 0.5;
  col *= 1.0 - dot(v, v) * 0.55;
  o = vec4(col, 1.0);
}`

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const problem = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(problem)
  }
  return shader
}

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

export default function StarScene({ days, tags }) {
  const sky = useRef(null)
  const moteCanvas = useRef(null)
  const caster = useRef(null)
  const anchor = useRef(null)
  const beam = useRef(null)
  const [notices, setNotices] = useState([])

  // Shared between the sky, the casting and the reckoning after it.
  const meteors = useRef(Array.from({ length: METEORS }, () => [0, 0, -99, 0]))
  const scroll = useRef(0)
  const skyClock = useRef(0)
  const lastCast = useRef(0)
  const motes = useRef([])

  /** Send a star across the sky, soon. */
  const fall = useRef((delay = 0, from = null) => {
    const slot = meteors.current.reduce((best, m, i, all) => (m[2] < all[best][2] ? i : best), 0)
    const aspect = window.innerWidth / Math.max(1, window.innerHeight)
    const x = from?.x ?? (0.25 + Math.random() * 0.9) * aspect
    const y = from?.y ?? 0.72 + Math.random() * 0.25
    const angle = Math.PI + 0.35 + Math.random() * 0.35 // down and to the left
    meteors.current[slot] = [x, y, skyClock.current + delay, angle]
  })

  // --- the sky -------------------------------------------------------------
  useEffect(() => {
    const el = sky.current
    const gl = el?.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) return undefined
    let program
    try {
      program = gl.createProgram()
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
    } catch (err) {
      console.error('the sky could not be drawn:', err.message)
      return undefined
    }
    gl.useProgram(program)
    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const at = gl.getAttribLocation(program, 'p')
    gl.enableVertexAttribArray(at)
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0)
    const uRes = gl.getUniformLocation(program, 'uRes')
    const uTime = gl.getUniformLocation(program, 'uTime')
    const uScroll = gl.getUniformLocation(program, 'uScroll')
    const uMoon = gl.getUniformLocation(program, 'uMoon')
    const uMeteor = gl.getUniformLocation(program, 'uMeteor')
    const uMoonAt = gl.getUniformLocation(program, 'uMoonAt')

    // The moon hangs in the open sky of the header, between the view switch
    // and the Today button, wherever the window's width puts that.
    const moonAt = [0, 0]
    const hang = () => {
      const h = Math.max(1, window.innerHeight)
      const left = document.querySelector('.viewswitch')?.getBoundingClientRect()
      const right = document.querySelector('.nav.today')?.getBoundingClientRect()
      const x = left && right && right.left - left.right > 90
        ? (left.right + right.left) / 2
        : window.innerWidth - 150
      const y = left ? left.top + left.height / 2 : 40
      moonAt[0] = x / h
      moonAt[1] = 1 - y / h
    }
    hang()
    let hungAt = 0

    const still = stillness()
    const started = performance.now()
    const size = () => {
      el.width = Math.max(1, Math.round(window.innerWidth * SCALE))
      el.height = Math.max(1, Math.round(window.innerHeight * SCALE))
      gl.viewport(0, 0, el.width, el.height)
    }
    size()

    const flat = new Float32Array(METEORS * 4)
    let drift = 0
    const draw = (now) => {
      const t = still ? 20 : (now - started) / 1000
      skyClock.current = t
      // The stars follow the scroll a little behind it, so a jump is a drift.
      drift += (scroll.current - drift) * (still ? 1 : 0.12)
      meteors.current.forEach((m, i) => flat.set(m, i * 4))
      gl.uniform2f(uRes, el.width, el.height)
      gl.uniform1f(uTime, t)
      gl.uniform1f(uScroll, drift)
      if (now - hungAt > 1500) { hang(); hungAt = now }
      gl.uniform1f(uMoon, moonPhase(new Date()))
      gl.uniform2f(uMoonAt, moonAt[0], moonAt[1])
      gl.uniform4fv(uMeteor, flat)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const onScroll = (e) => {
      if (e.target instanceof Element && e.target.classList.contains('scroller')) {
        scroll.current = e.target.scrollTop / Math.max(1, window.innerHeight)
        if (still) draw(performance.now())
      }
    }
    window.addEventListener('scroll', onScroll, true)

    let stop
    if (still) {
      draw(performance.now())
      const timer = setInterval(() => draw(performance.now()), 60_000)
      stop = () => clearInterval(timer)
    } else {
      // Now and then, on its own, a star falls.
      let nextFall = 6 + Math.random() * 10
      stop = runLoop((now) => {
        draw(now)
        if (skyClock.current > nextFall) {
          fall.current()
          nextFall = skyClock.current + 18 + Math.random() * 30
        }
      })
    }
    const onResize = () => { size(); hang(); if (still) draw(performance.now()) }
    window.addEventListener('resize', onResize)
    return () => {
      stop()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onScroll, true)
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    }
  }, [])

  // --- casting ---------------------------------------------------------------
  useEffect(() => {
    if (stillness()) return undefined
    const el = moteCanvas.current
    const g = el.getContext('2d')
    const gold = moteSprite('rgba(255, 248, 225, 1)', 'rgba(232, 196, 110, 0.8)')
    const blue = moteSprite('rgba(235, 248, 255, 1)', 'rgba(140, 190, 255, 0.8)')
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
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      el.width = Math.round(window.innerWidth * dpr)
      el.height = Math.round(window.innerHeight * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    const armedColour = () => {
      const chip = document.querySelector('.daychips .chip.armed')
      return chip?.style.getPropertyValue('--chip')?.trim() || '#d8b260'
    }
    const show = (node, x, y, px, colour) => {
      node.style.display = 'block'
      node.style.color = `color-mix(in oklab, ${colour} 55%, #fff1cc)`
      node.style.width = `${px}px`
      node.style.height = `${px}px`
      node.style.transform = `translate(${x - px / 2}px, ${y - px / 2}px)`
    }
    const hide = (node) => { if (node) node.style.display = 'none' }

    let casting = null // { x, y, px, colour, track } while the pointer is down

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
        const left = Math.min(casting.x, x)
        const width = Math.abs(x - casting.x)
        Object.assign(beam.current.style, {
          display: width > 6 ? 'block' : 'none',
          color: `color-mix(in oklab, ${colour} 55%, #fff1cc)`,
          left: `${left}px`,
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
      casting = { x: e.clientX, y: r.top + r.height / 2, px, colour: armedColour(), track }
      show(anchor.current, casting.x, casting.y, px, casting.colour)
      onMove(e)
    }

    const burst = (x0, x1, y, colour, count) => {
      const sprite = spriteFor(colour)
      for (let i = 0; i < count; i++) {
        motes.current.push({
          x: x0 + Math.random() * Math.max(1, x1 - x0),
          y: y + (Math.random() - 0.5) * 30,
          vx: (Math.random() - 0.5) * 50,
          vy: -(30 + Math.random() * 90),
          age: 0,
          life: 1.4 + Math.random() * 1.8,
          size: 0.4 + Math.random() * 0.7,
          seed: Math.random() * 100,
          sprite: i % 3 === 0 ? gold : i % 7 === 0 ? blue : sprite,
        })
      }
    }

    const onUp = (e) => {
      if (!casting) return
      const c = casting
      casting = null
      const x = Math.max(c.track.getBoundingClientRect().left, Math.min(c.track.getBoundingClientRect().right, e.clientX))
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
        for (const node of [anchor.current, caster.current]) {
          node?.classList.remove('released')
        }
        hide(anchor.current)
        if (!document.querySelector('.scroller.armed')) hide(caster.current)
      }, 650)
      burst(Math.min(c.x, x), Math.max(c.x, x), c.y, c.colour, Math.min(60, 16 + Math.abs(x - c.x) / 12))
      fall.current(0.15)
      lastCast.current = performance.now()
    }

    const onKey = (e) => { if (e.key === 'Escape') { casting = null; hide(caster.current); hide(anchor.current); hide(beam.current) } }

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
        said.push({ kind: 'rank', tag: up.tag, rank: up.rank })
      }
      for (const date of nextDone) {
        if (!done.current.has(date)) said.push({ kind: 'complete', date })
      }
      if (said.length) {
        const stamp = Date.now()
        setNotices((was) => [...was, ...said.map((n, i) => ({ ...n, id: `${stamp}-${i}` }))].slice(-3))
        if (said.some((n) => n.kind === 'complete') && !stillness()) {
          // The meteor shower: a sky's worth of falling stars.
          for (let i = 0; i < METEORS * 3; i++) setTimeout(() => fall.current(Math.random() * 0.2), i * 140 + Math.random() * 120)
        }
      }
    }
    month.current = nextMonth
    done.current = nextDone
  }, [days])

  // Each notice goes after a few seconds.
  useEffect(() => {
    if (notices.length === 0) return undefined
    const timer = setTimeout(() => setNotices((was) => was.slice(1)), 4200)
    return () => clearTimeout(timer)
  }, [notices])

  return (
    <>
      <canvas ref={sky} className="star-sky" aria-hidden="true" />
      <canvas ref={moteCanvas} className="star-motes" aria-hidden="true" />
      <div ref={anchor} className="star-cast anchor" aria-hidden="true"><MagicCircle size="100%" /></div>
      <div ref={caster} className="star-cast" aria-hidden="true"><MagicCircle size="100%" /></div>
      <div ref={beam} className="star-beam" aria-hidden="true"><span>{RUNES.repeat(12)}</span></div>
      <StarNotices notices={notices} tags={tags} />
    </>
  )
}

function StarNotices({ notices, tags }) {
  if (notices.length === 0) return null
  const tagOf = (id) => tags.find((t) => t.id === id)
  return (
    <div className="star-notices" role="status">
      {notices.map((n) => (
        <div
          key={n.id}
          className={`star-notice ${n.kind}`}
          style={{ '--spell': n.kind === 'rank' ? tagOf(n.tag)?.colour ?? '#d8b260' : '#9fd4ff' }}
        >
          <MagicCircle size={120} className="notice-circle" />
          {n.kind === 'rank' ? (
            <>
              <b>{tagOf(n.tag)?.name ?? n.tag}</b>
              <span>has reached <em>{n.rank}</em> rank</span>
            </>
          ) : (
            <>
              <b>Every hour accounted for</b>
              <span>a moonweed blooms · the stars fall</span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
