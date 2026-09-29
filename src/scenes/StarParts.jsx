import { useId } from 'react'
import { moonPhase, moonName, rankOf } from './starlit.js'
import { useMinute } from '../useMinute.js'

// The pieces of Starlit that live in the page: the magic circle every spell
// is cast through, the blue moonweed that marks a day fully accounted for,
// the sigil of a tag's rank, and the moon's phase beside the count of days.
// See starlit.js for what decides them.

// Elder futhark, written round the outer ring. Segoe UI Historic carries
// them on Windows; anywhere without it they fall back to plain marks, which
// at this size reads the same.
const RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ'

const star = (points, outer, inner, turn = -Math.PI / 2) => Array.from({ length: points * 2 }, (_, i) => {
  const r = i % 2 === 0 ? outer : inner
  const a = turn + (i * Math.PI) / points
  return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`
}).join(' ')

const triangle = (r, turn) => [0, 1, 2].map((i) => {
  const a = turn + (i * 2 * Math.PI) / 3
  return `${(Math.cos(a) * r).toFixed(2)},${(Math.sin(a) * r).toFixed(2)}`
}).join(' ')

const TICKS = Array.from({ length: 36 }, (_, i) => {
  const a = (i / 36) * Math.PI * 2
  const inner = i % 3 === 0 ? 45.5 : 46.6
  return `M${(Math.cos(a) * inner).toFixed(2)} ${(Math.sin(a) * inner).toFixed(2)}L${(Math.cos(a) * 48.5).toFixed(2)} ${(Math.sin(a) * 48.5).toFixed(2)}`
}).join('')

const NODES = Array.from({ length: 6 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 3
  return [Math.cos(a) * 34, Math.sin(a) * 34]
})

/**
 * A magic circle: runes round the rim, a hexagram, a star at the heart, each
 * ring turning its own way. Drawn in currentColor, so it takes the colour of
 * whatever spell it is casting.
 */
export function MagicCircle({ size = 100, className = '', style }) {
  const ring = `r${useId().replace(/:/g, '')}`
  return (
    <svg
      className={`magic-circle ${className}`}
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      style={style}
      aria-hidden="true"
    >
      <defs>
        <path id={ring} d="M0,-42.6a42.6,42.6 0 1,1 0,85.2a42.6,42.6 0 1,1 0,-85.2" />
      </defs>
      <g className="mc-outer">
        <circle r="48.5" />
        <circle r="39.6" />
        <path d={TICKS} />
        <text className="mc-runes">
          <textPath href={`#${ring}`} textLength="266" lengthAdjust="spacing">{RUNES}{RUNES.slice(0, 8)}</textPath>
        </text>
      </g>
      <g className="mc-mid">
        <polygon points={triangle(34, -Math.PI / 2)} />
        <polygon points={triangle(34, Math.PI / 2)} />
        <circle r="24" />
        {NODES.map(([x, y], i) => <circle key={i} className="mc-node" cx={x} cy={y} r="2.4" />)}
      </g>
      <g className="mc-inner">
        <circle r="17" strokeDasharray="1.6 2.4" />
        <polygon points={star(8, 14, 5.5)} />
        <circle className="mc-heart" r="2.6" />
      </g>
    </svg>
  )
}

/** Blue moonweed: the little flower that only blooms by moonlight. */
export function Moonweed({ title }) {
  const id = `m${useId().replace(/:/g, '')}`
  return (
    <svg className="moonweed" viewBox="-12 -12 24 24" width="22" height="22" role="img" aria-label={title}>
      <title>{title}</title>
      <defs>
        <radialGradient id={id}>
          <stop offset="0" stopColor="#f2fbff" />
          <stop offset="0.45" stopColor="#9fd4ff" />
          <stop offset="1" stopColor="#3f73d6" />
        </radialGradient>
      </defs>
      <g fill={`url(#${id})`}>
        {[0, 72, 144, 216, 288].map((a) => (
          <path key={a} transform={`rotate(${a})`} d="M0 0C-2.6-2.6-2.8-7 0-10.6 2.8-7 2.6-2.6 0 0Z" />
        ))}
      </g>
      <circle r="1.7" fill="#fffbe6" />
    </svg>
  )
}

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** A tag's rank, as a small sigil on its box: I for Beginner up to VII for God. */
export function RankSigil({ minutes }) {
  const rank = rankOf(minutes)
  return <i className="rank-sigil" data-rank={rank.index}>{NUMERALS[rank.index]}</i>
}

/** What a tag's box says of its rank when the pointer rests on it. */
export function rankTitle(name, minutes) {
  const rank = rankOf(minutes)
  const hours = Math.floor(minutes / 60)
  const next = rank.toNext > 0 ? ` · ${Math.ceil(rank.toNext)}h to the next` : ''
  return `${name} · ${rank.name} rank · ${hours}h this month${next}`
}

/** "· waning gibbous", for beside the count of days. */
export function MoonWords() {
  useMinute() // enough to turn over at midnight; the moon is in no hurry
  const phase = moonPhase(new Date())
  return <span className="star-moon"> · {moonName(phase)}</span>
}
