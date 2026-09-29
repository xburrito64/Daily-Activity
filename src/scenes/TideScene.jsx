import { useEffect, useRef } from 'react'
import { depthWords, depthOf } from './tide.js'
import { runLoop, stillness } from './loop.js'

export { daysDown } from './tide.js'

// Tidewater, seen from under the water.
//
// Today is the waterline. The list runs the way the page does — the past
// above, the days to come below — so scrolling down is diving: into the days
// that haven't happened yet, where the light thins, the rays from the surface
// fade, the caustics go and the water turns dark, with the drifting specks
// streaming up past you as you sink. Scrolling back up through what you have
// already lived brings you into the sunlit shallows.
//
// It is drawn on the graphics card, in one small shader, at half the
// window's resolution, on the clock every scene shares (see loop.js) —
// enough to move, not enough to warm the laptop. Anyone whose machine asks
// for less movement gets one still frame, redrawn only when the depth
// changes.

const SCALE = 0.5

const VERTEX = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const FRAGMENT = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uDepth;   // -1 the shallows, 0 the waterline, 1 the deep
uniform float uSink;    // how far down, in screens, for the specks to scroll
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Light focused by a moving surface: bright threads where the warped waves
// line up, dark between. Four layers, each warping the last.
float caustic(vec2 p, float t) {
  vec2 q = p;
  float c = 0.0;
  for (int i = 0; i < 4; i++) {
    float f = float(i);
    q = p + 0.42 * vec2(sin(q.y * 1.7 + t * 0.6 + f), cos(q.x * 1.3 - t * 0.5 + f * 1.3));
    c += 1.0 / (1.0 + 16.0 * abs(sin(q.x * 2.1 + f) * sin(q.y * 2.3 - f)));
  }
  return c * 0.25;
}

// Specks in a grid of cells, one in some cells, drifting with the water.
float specks(vec2 g, float keep, float size) {
  vec2 cell = floor(g);
  vec2 f = fract(g);
  float r = hash(cell);
  if (r < keep) return 0.0;
  vec2 at = vec2(hash(cell + 7.1), hash(cell + 3.7)) * 0.8 + 0.1;
  return (1.0 - smoothstep(0.0, size, length(f - at))) * (0.5 + 0.5 * hash(cell + 1.3));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  float deep = clamp(uDepth * 0.5 + 0.5, 0.0, 1.0);
  float shallow = 1.0 - deep;

  // The water itself: lit from above, darker below, darker still the deeper.
  vec3 top = mix(vec3(0.07, 0.27, 0.33), vec3(0.012, 0.06, 0.09), deep);
  vec3 bottom = mix(vec3(0.02, 0.08, 0.11), vec3(0.002, 0.012, 0.02), deep);
  vec3 col = mix(bottom, top, pow(uv.y, 1.25));

  // Rays down from the surface, slanting, slowly swaying.
  float x = uv.x * aspect + (1.0 - uv.y) * 0.38;
  float rays = (sin(x * 6.3 + uTime * 0.19) * 0.5 + 0.5) * (sin(x * 11.7 - uTime * 0.13 + 1.7) * 0.5 + 0.5);
  rays = pow(rays, 3.0) * smoothstep(0.1, 1.0, uv.y);
  col += vec3(0.4, 0.8, 0.85) * rays * 0.17 * pow(shallow, 1.5);

  // Caustics: strongest near the surface, gone in the deep.
  float c = caustic(vec2(uv.x * aspect, uv.y) * 3.1, uTime * 0.33);
  col += vec3(0.5, 0.88, 0.92) * pow(c, 3.0) * 0.24 * smoothstep(0.05, 1.0, uv.y) * pow(shallow, 1.2);

  // The moon, through the surface.
  vec2 m = vec2(uv.x * aspect - aspect * 0.86, uv.y - 1.04);
  col += vec3(0.85, 0.97, 0.97) * 0.14 / (1.0 + dot(m, m) * 34.0) * pow(shallow, 2.0);

  // Marine snow drifts down; sinking makes it stream up past you.
  vec2 g = vec2(uv.x * aspect, uv.y + uSink) * vec2(24.0, 24.0) + vec2(sin(uTime * 0.1) * 0.3, uTime * 0.05);
  col += vec3(0.62, 0.86, 0.86) * specks(g, 0.86, 0.09) * (0.12 + 0.18 * deep);
  vec2 g2 = vec2(uv.x * aspect, uv.y + uSink * 0.6) * vec2(11.0, 11.0) + vec2(0.0, uTime * 0.02);
  col += vec3(0.7, 0.92, 0.92) * specks(g2, 0.93, 0.07) * 0.25;

  // Bubbles, only up near the light: thin rings, rising.
  vec2 b = vec2(uv.x * aspect, uv.y) * vec2(9.0, 9.0) - vec2(sin(uv.y * 9.0 + uTime) * 0.05, uTime * 0.22);
  vec2 bc = floor(b);
  vec2 bf = fract(b) - (vec2(hash(bc + 2.2), hash(bc + 9.4)) * 0.6 + 0.2);
  float ring = (1.0 - smoothstep(0.0, 0.035, abs(length(bf) - 0.05))) * step(0.95, hash(bc));
  col += vec3(0.7, 0.95, 0.95) * ring * 0.35 * shallow;

  // The edges fall away into the dark.
  vec2 v = uv - 0.5;
  col *= 1.0 - dot(v, v) * 0.9;

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

export default function TideScene({ days }) {
  const canvas = useRef(null)
  const ripples = useRef(null)
  // Where the scene is heading, read by the drawing loop without restarting it.
  const target = useRef(0)
  target.current = depthOf(days)

  useEffect(() => {
    const el = canvas.current
    const gl = el?.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power' })
    // No WebGL2: the theme's painted background is already underneath.
    if (!gl) return undefined

    let program
    try {
      program = gl.createProgram()
      gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX))
      gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT))
      gl.linkProgram(program)
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program))
    } catch (err) {
      console.error('the water could not be drawn:', err.message)
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
    const uDepth = gl.getUniformLocation(program, 'uDepth')
    const uSink = gl.getUniformLocation(program, 'uSink')

    const still = stillness()
    let depth = target.current
    const started = performance.now()

    const size = () => {
      el.width = Math.max(1, Math.round(window.innerWidth * SCALE))
      el.height = Math.max(1, Math.round(window.innerHeight * SCALE))
      gl.viewport(0, 0, el.width, el.height)
    }
    size()

    const draw = (now) => {
      // Eased toward where the screen is, so a jump of a month is a dive
      // rather than a cut.
      depth += (target.current - depth) * (still ? 1 : 0.04)
      gl.uniform2f(uRes, el.width, el.height)
      gl.uniform1f(uTime, still ? 12 : (now - started) / 1000)
      gl.uniform1f(uDepth, depth)
      gl.uniform1f(uSink, depth * 2.5)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    let stop
    if (still) {
      // One frame, and another only when there is somewhere new to be.
      draw(performance.now())
      let drawnAt = depth
      const timer = setInterval(() => {
        if (target.current !== drawnAt) { drawnAt = target.current; draw(performance.now()) }
      }, 300)
      stop = () => clearInterval(timer)
    } else {
      stop = runLoop((now) => draw(now))
    }

    const onResize = () => { size(); if (still) draw(performance.now()) }
    window.addEventListener('resize', onResize)
    return () => {
      stop()
      window.removeEventListener('resize', onResize)
      gl.deleteProgram(program)
      gl.deleteBuffer(buffer)
    }
  }, [])

  // A ripple wherever a bar is pressed, clipped to that bar. Drawn over the
  // page rather than inside the bar, so nothing here can get in the way of
  // what the press was for.
  useEffect(() => {
    if (stillness()) return undefined
    const onDown = (e) => {
      const track = e.target instanceof Element ? e.target.closest('.track') : null
      if (!track || !ripples.current) return
      const box = track.getBoundingClientRect()
      const clip = document.createElement('span')
      clip.className = 'tide-clip'
      Object.assign(clip.style, {
        left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px`,
      })
      for (const delay of [0, 180]) {
        const ring = document.createElement('span')
        ring.className = 'tide-ripple'
        Object.assign(ring.style, {
          left: `${e.clientX - box.left}px`,
          top: `${e.clientY - box.top}px`,
          animationDelay: `${delay}ms`,
        })
        clip.appendChild(ring)
      }
      ripples.current.appendChild(clip)
      setTimeout(() => clip.remove(), 1400)
    }
    window.addEventListener('pointerdown', onDown, true)
    return () => window.removeEventListener('pointerdown', onDown, true)
  }, [])

  const depth = depthOf(days)

  return (
    <>
      <canvas ref={canvas} className="tide-water" aria-hidden="true" />

      {/* The title seen through the surface: a slow ripple across it. */}
      <svg className="tide-defs" width="0" height="0" aria-hidden="true">
        <filter id="tide-waver" x="-5%" y="-30%" width="110%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.045" numOctaves="2" seed="4">
            <animate attributeName="baseFrequency" dur="16s" repeatCount="indefinite"
              values="0.011 0.045;0.016 0.06;0.011 0.045" />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="3.5" />
        </filter>
      </svg>

      <div ref={ripples} className="tide-ripples" aria-hidden="true" />

      {/* How far down you are: today is the surface. */}
      <div className="tide-gauge" aria-hidden="true">
        <span className="tide-gauge-end">surface</span>
        <span className="tide-gauge-line">
          <span className="tide-gauge-water" style={{ top: `${(0.6 / 1.6) * 100}%` }} />
          <span className="tide-gauge-mark" style={{ top: `${((depth + 0.6) / 1.6) * 100}%` }} />
        </span>
        <span className="tide-gauge-end">deep</span>
        <span className="tide-gauge-read">{depthWords(days)}</span>
      </div>
    </>
  )
}
