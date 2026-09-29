import { useEffect, useMemo, useRef } from 'react'
import { fireOf, fireWords } from './hearth.js'
import { runLoop, stillness } from './loop.js'
import { useMinute } from '../useMinute.js'
import { todayISO } from '../time.js'

// Hearthfire.
//
// A fire burns at the foot of the page, and logging is what keeps it going.
// Log right up to now and it roars; leave it and it burns down, hour by hour,
// to embers and then to nothing. It sits behind the days, so it is only ever
// seen between them and in its own strip along the bottom — never in front
// of anything you need to read. Its light rises up the page with it.
//
// Filling in a stretch throws a log on: the fire flares, and sparks fly up
// out of the bar where you painted. Today's bar burns as the day does: the
// time already gone with nothing logged on it lies there as ash, and the
// line where it is now is a burning edge that throws off the odd spark.
//
// The fire is drawn on the graphics card at half resolution, the sparks on a
// canvas only while there are any, and both on the shared clock (loop.js).
// With less movement asked for it is one still fire, redrawn only when it
// changes, and no sparks.

const SCALE = 0.5
const MAX_SPARKS = 90

const VERTEX = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uHeat;   // 0 out, 1 roaring, a little over while it flares
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
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.02 + vec2(1.7, 9.2); a *= 0.5; }
  return v;
}
float capsule(vec2 p, vec2 a, vec2 b, float r) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h) - r;
}

void main() {
  // In heights of the canvas: x from the middle, y up from the floor.
  float H = uRes.y;
  vec2 p = vec2((gl_FragCoord.x - uRes.x * 0.5) / H, gl_FragCoord.y / H);
  float halfW = uRes.x * 0.5 / H;
  float t = uTime;
  float heat = uHeat;
  float warm = clamp(heat, 0.0, 1.0);

  // How far along the hearth it has spread: wide when it roars, drawn in to
  // the middle when it is low.
  float spread = min(halfW - 0.2, 0.55 + 0.75 * warm);
  float bed = 1.0 - smoothstep(0.25 * spread, spread, abs(p.x));

  // The flames. Tongues along the hearth, each rising to its own height and
  // changing as they go, their edges torn more the higher they reach.
  float tall = (0.05 + 0.7 * heat) * (0.3 + 0.7 * bed);
  float n = fbm(vec2(p.x * 3.0, p.y * 1.8 - t * 1.7));
  float n2 = fbm(vec2(p.x * 7.0, p.y * 3.2 - t * 2.9) + n);
  float tongues = fbm(vec2(p.x * 4.2 + (n - 0.5) * 1.6, t * 0.45));
  float crown = tall * (0.3 + 1.25 * tongues * (0.65 + 0.6 * n2));
  float y = p.y / max(crown, 0.001);
  float f = 1.0 - y + (n2 - 0.5) * 0.55 * y;
  f = clamp(f, 0.0, 1.0) * smoothstep(0.0, 0.12, bed);
  vec3 flame = mix(vec3(0.5, 0.05, 0.015), vec3(1.0, 0.33, 0.05), smoothstep(0.08, 0.38, f));
  flame = mix(flame, vec3(1.0, 0.68, 0.24), smoothstep(0.42, 0.75, f));
  flame = mix(flame, vec3(1.0, 0.93, 0.76), smoothstep(0.8, 1.0, f));
  float a = smoothstep(0.0, 0.5, f);
  vec3 col = flame * a;
  float alpha = a;

  // Light thrown on the hearth floor.
  float floorLight = exp(-p.y * 5.0) * (1.0 - smoothstep(0.0, spread + 0.7, abs(p.x))) * (0.12 + 0.4 * warm);
  col += vec3(1.0, 0.33, 0.07) * floorLight * 0.55;
  alpha += floorLight * 0.55;

  // The coals: a bed of them along the floor, breathing, dull when it is low.
  float coalBand = (1.0 - smoothstep(0.0, 0.05, p.y)) * (1.0 - smoothstep(0.7 * spread, spread + 0.35, abs(p.x)));
  float glow = noise(p * 26.0 + vec2(0.0, t * 0.12));
  float breathe = 0.55 + 0.45 * noise(vec2(p.x * 3.0, t * 0.6));
  vec3 coals = mix(vec3(0.1, 0.025, 0.01), vec3(1.0, 0.36, 0.06),
                   clamp(smoothstep(0.35, 0.85, glow) * breathe * (0.3 + 0.7 * warm) + 0.08, 0.0, 1.0));
  col = mix(col, coals, coalBand);
  alpha = mix(alpha, 1.0, coalBand);

  // The logs, charred, crossed over the coals, with the fire showing
  // through their cracks and the cut ends paler where the bark stops.
  vec2 a1 = vec2(-0.62, 0.05); vec2 b1 = vec2(0.3, 0.16);
  vec2 a2 = vec2(0.66, 0.045); vec2 b2 = vec2(-0.26, 0.17);
  vec2 a3 = vec2(-0.3, 0.045); vec2 b3 = vec2(0.34, 0.05);
  float logs = capsule(p, a1, b1, 0.048);
  logs = min(logs, capsule(p, a2, b2, 0.046));
  logs = min(logs, capsule(p, a3, b3, 0.04));
  float wood = 1.0 - smoothstep(0.0, 0.005, logs);
  float cut = min(min(length(p - a1), length(p - a2)), min(length(p - b1), length(p - b2)));
  float grain = noise(vec2(p.x * 42.0, p.y * 9.0));
  float crack = smoothstep(0.6, 0.76, noise(vec2(p.x * 15.0, p.y * 34.0) + 3.0));
  vec3 bark = vec3(0.085, 0.045, 0.03) * (0.6 + 0.6 * grain);
  bark += vec3(1.0, 0.38, 0.08) * crack * (0.2 + 0.8 * warm) * (0.65 + 0.35 * sin(t * 1.3 + p.x * 4.0));
  bark += vec3(1.0, 0.45, 0.12) * (1.0 - smoothstep(0.0, 0.014, -logs)) * 0.55 * warm;
  bark = mix(bark, vec3(0.2, 0.11, 0.06) * (0.8 + 0.4 * grain), 1.0 - smoothstep(0.036, 0.044, cut));
  bark += vec3(1.0, 0.4, 0.1) * (1.0 - smoothstep(0.0, 0.006, abs(cut - 0.026))) * (0.15 + 0.5 * warm);
  col = mix(col, bark, wood);
  alpha = mix(alpha, 1.0, wood);

  // Sparks rising off it: more of them the hotter it burns.
  for (int i = 0; i < 22; i++) {
    float fi = float(i);
    if (fi > 4.0 + 18.0 * warm) break;
    float speed = 0.07 + 0.12 * hash(vec2(fi, 7.7));
    float life = fract(t * speed + hash(vec2(fi, 3.1)));
    float x0 = (hash(vec2(fi, 1.3)) * 2.0 - 1.0) * spread * 0.7;
    vec2 e = vec2(x0 + sin(t * (0.9 + hash(vec2(fi, 2.2))) + fi) * 0.24 * life,
                  0.06 + life * (0.35 + 0.6 * warm));
    vec2 d = p - e;
    float r = 0.0035 + 0.003 * hash(vec2(fi, 5.0));
    float g = r * r / (dot(d, d) + r * r * 0.25);
    float fade = (1.0 - life) * smoothstep(0.0, 0.08, life);
    col += vec3(1.0, 0.55, 0.18) * g * fade * 0.8;
    alpha += g * fade * 0.8;
  }

  // Gone before the top of the canvas and before its sides.
  float keep = (1.0 - smoothstep(0.72, 1.0, p.y)) * (1.0 - smoothstep(halfW - 0.35, halfW, abs(p.x)));
  col *= keep;
  alpha *= keep;
  alpha = clamp(max(alpha, max(col.r, max(col.g, col.b))), 0.0, 1.0);
  o = vec4(min(col, vec3(alpha)), alpha);
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

/** A spark, drawn once as a soft dot and stamped from then on. */
function sparkSprite(core, edge) {
  const c = document.createElement('canvas')
  c.width = 24
  c.height = 24
  const g = c.getContext('2d')
  const fill = g.createRadialGradient(12, 12, 0, 12, 12, 12)
  fill.addColorStop(0, core)
  fill.addColorStop(0.25, edge)
  fill.addColorStop(1, 'rgba(255, 80, 10, 0)')
  g.fillStyle = fill
  g.fillRect(0, 0, 24, 24)
  return c
}

export default function HearthScene({ days, onToday }) {
  const fireCanvas = useRef(null)
  const sparkCanvas = useRef(null)
  const light = useRef(null)
  const minute = useMinute()
  const fire = useMemo(() => fireOf(days, todayISO(), minute), [days, minute])
  const words = fireWords(fire)

  // What the drawing reads without being restarted: how high the fire should
  // burn, and a flare that jumps when it is fed and dies back down.
  const heatTarget = useRef(fire.heat)
  const flare = useRef(0)
  const fedAt = useRef(fire.fed)
  useEffect(() => {
    if (fire.fed !== null && (fedAt.current === null || fire.fed > fedAt.current)) flare.current = 0.45
    fedAt.current = fire.fed
    heatTarget.current = fire.heat
  }, [fire.fed, fire.heat])

  // --- the fire ---------------------------------------------------------
  useEffect(() => {
    const el = fireCanvas.current
    const gl = el?.getContext('webgl2', { antialias: false, premultipliedAlpha: true, powerPreference: 'low-power' })
    if (!gl) return undefined

    let program
    try {
      program = gl.createProgram()
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
    } catch (err) {
      console.error('the fire could not be drawn:', err.message)
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
    const uHeat = gl.getUniformLocation(program, 'uHeat')

    const still = stillness()
    let heat = heatTarget.current
    const started = performance.now()

    const size = () => {
      const box = el.getBoundingClientRect()
      el.width = Math.max(1, Math.round(box.width * SCALE))
      el.height = Math.max(1, Math.round(box.height * SCALE))
      gl.viewport(0, 0, el.width, el.height)
    }
    size()

    const draw = (now, dt) => {
      const t = (now - started) / 1000
      flare.current *= Math.exp(-dt * 0.9)
      const goal = heatTarget.current + flare.current
      heat += (goal - heat) * (still ? 1 : Math.min(1, dt * 2.2))
      gl.uniform2f(uRes, el.width, el.height)
      gl.uniform1f(uTime, still ? 7 : t)
      gl.uniform1f(uHeat, heat)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      // The fire's light on the page, flickering with it.
      if (light.current) {
        const flicker = still ? 1 : 0.86 + 0.14 * Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1.3)
        light.current.style.opacity = String(Math.min(1, (0.16 + 0.72 * heat) * flicker))
      }
    }

    let stop
    if (still) {
      draw(performance.now(), 0)
      flare.current = 0
      let drawnAt = heatTarget.current
      const timer = setInterval(() => {
        if (heatTarget.current !== drawnAt) { drawnAt = heatTarget.current; draw(performance.now(), 0) }
      }, 1000)
      stop = () => clearInterval(timer)
    } else {
      stop = runLoop(draw)
    }

    const onResize = () => { size(); if (still) draw(performance.now(), 0) }
    window.addEventListener('resize', onResize)
    return () => {
      stop()
      window.removeEventListener('resize', onResize)
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    }
  }, [])

  // --- the sparks ---------------------------------------------------------
  useEffect(() => {
    if (stillness()) return undefined
    const el = sparkCanvas.current
    const g = el.getContext('2d')
    const hot = sparkSprite('rgba(255, 250, 220, 1)', 'rgba(255, 190, 90, 0.9)')
    const cool = sparkSprite('rgba(255, 190, 110, 1)', 'rgba(240, 90, 30, 0.8)')
    const sparks = []
    let dirty = false
    let nextFromEdge = 0
    let nextFromChip = 0

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      el.width = Math.round(window.innerWidth * dpr)
      el.height = Math.round(window.innerHeight * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)

    const spark = (x, y, vx, vy, life) => {
      if (sparks.length >= MAX_SPARKS) return
      sparks.push({ x, y, vx, vy, age: 0, life, size: 0.28 + Math.random() * 0.4, seed: Math.random() * 100 })
    }
    const burst = (x, y, n, spreadX = 0) => {
      for (let i = 0; i < n; i++) {
        spark(
          x + (Math.random() - 0.5) * spreadX,
          y,
          (Math.random() - 0.5) * 140,
          -(80 + Math.random() * 200),
          0.9 + Math.random() * 1.4,
        )
      }
    }

    // Painting a stretch is throwing a log on: sparks fly out of the bar
    // along the part you painted, and the fire flares.
    let paintFrom = null
    const onDown = (e) => {
      const target = e.target instanceof Element ? e.target : null
      const chip = target?.closest('.daychips .chip')
      if (chip) {
        const r = chip.getBoundingClientRect()
        burst(r.left + r.width / 2, r.top + 2, 5, r.width * 0.6)
      }
      paintFrom = document.querySelector('.scroller.armed') && target?.closest('.track') ? e.clientX : null
    }
    const onUp = (e) => {
      if (paintFrom === null) return
      const track = e.target instanceof Element ? e.target.closest('.track') : null
      const from = paintFrom
      paintFrom = null
      if (!track) return
      const r = track.getBoundingClientRect()
      const left = Math.max(r.left, Math.min(from, e.clientX))
      const right = Math.min(r.right, Math.max(from, e.clientX))
      const count = Math.min(30, 10 + Math.round((right - left) / 40))
      for (let i = 0; i < count; i++) {
        spark(
          left + Math.random() * Math.max(8, right - left),
          r.top + Math.random() * r.height * 0.5,
          (Math.random() - 0.5) * 120,
          -(90 + Math.random() * 220),
          0.9 + Math.random() * 1.5,
        )
      }
      flare.current = Math.max(flare.current, 0.35)
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('pointerup', onUp, true)

    const stop = runLoop((now, dt) => {
      // The burning edge on today's bar throws off the odd spark.
      if (now > nextFromEdge) {
        nextFromEdge = now + 900 + Math.random() * 1800
        const edge = document.querySelector('.nowline')
        const r = edge?.getBoundingClientRect()
        if (r && r.top > 0 && r.bottom < window.innerHeight) {
          spark(r.left + 1, r.top + 3, (Math.random() - 0.5) * 40, -(40 + Math.random() * 60), 1.1 + Math.random() * 1.2)
        }
      }

      // A picked-up tag is alight, and gives off sparks while it is.
      if (now > nextFromChip) {
        nextFromChip = now + 160 + Math.random() * 340
        const r = document.querySelector('.daychips .chip.armed')?.getBoundingClientRect()
        if (r && r.top > 0 && r.bottom < window.innerHeight) {
          spark(
            r.left + 8 + Math.random() * (r.width - 16),
            r.top - 4,
            (Math.random() - 0.5) * 50,
            -(50 + Math.random() * 90),
            0.7 + Math.random() * 1.1,
          )
        }
      }

      if (sparks.length === 0) {
        if (dirty) { g.clearRect(0, 0, window.innerWidth, window.innerHeight); dirty = false }
        return
      }
      const t = now / 1000
      g.clearRect(0, 0, window.innerWidth, window.innerHeight)
      g.globalCompositeOperation = 'lighter'
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.age += dt
        if (s.age >= s.life) { sparks.splice(i, 1); continue }
        // Hot air carries them up and slows their sideways flight; they
        // wander as they go.
        s.vy -= 40 * dt
        s.vx *= Math.exp(-dt * 1.6)
        s.vy *= Math.exp(-dt * 0.7)
        s.x += (s.vx + Math.sin(t * 5 + s.seed) * 22) * dt
        s.y += s.vy * dt
        const k = s.age / s.life
        const alpha = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9
        const px = 24 * s.size * (1 - k * 0.5)
        g.globalAlpha = alpha * (0.7 + 0.3 * Math.sin(t * 23 + s.seed))
        g.drawImage(k < 0.35 ? hot : cool, s.x - px / 2, s.y - px / 2, px, px)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
      dirty = true
    })

    return () => {
      stop()
      window.removeEventListener('resize', size)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('pointerup', onUp, true)
    }
  }, [])

  return (
    <>
      <div ref={light} className="hearth-light" aria-hidden="true" />
      <canvas ref={fireCanvas} className="hearth-fire" aria-hidden="true" />
      <canvas ref={sparkCanvas} className="hearth-sparks" aria-hidden="true" />
      {/* The hearth's own strip along the bottom, and what it says about
          itself. Pressing it takes you to today, which is where it gets fed. */}
      <div className={`hearth ${fire.state}`}>
        <button type="button" className="hearth-words" onClick={onToday} title="Go to today and feed the fire">
          <b>{words.state}</b>
          <span>{words.detail}</span>
        </button>
      </div>
    </>
  )
}
