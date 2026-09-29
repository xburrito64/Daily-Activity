import { useId } from 'react'
import { moonPhase, moonName, moonPath, rankOf, rankProgress, RANKS, RANK_DAYS } from './starlit.js'
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

/**
 * A tag's rank as a gem: an empty setting for a Beginner, then bronze,
 * silver, gold, ruby, amethyst, and a clear stone that holds every colour
 * for a God. Cut the same way at every rank, so it reads as one thing that
 * gets finer rather than seven different badges.
 */
export function RankGem({ minutes }) {
  return <i className="rank-gem" data-rank={rankOf(minutes).index} aria-hidden="true" />
}

/** What a tag's box says of its rank when the pointer rests on it. */
export function rankTitle(name, minutes) {
  const rank = rankOf(minutes)
  const hours = Math.floor(minutes / 60)
  const next = rank.toNext > 0 ? ` · ${Math.ceil(rank.toNext)}h to ${RANKS[rank.index + 1].name}` : ''
  return `${name} · ${rank.name} · ${hours}h this month${next}`
}

/** The moon in its real phase: the dark disc, and the lit part over it. */
export function Moon({ size = 40, phase }) {
  const at = phase ?? moonPhase(new Date())
  return (
    <svg className="moon" viewBox="-12 -12 24 24" width={size} height={size} aria-hidden="true">
      <circle r="10" className="moon-dark" />
      <path d={moonPath(at, 10)} className="moon-lit" />
      <circle cx="-3" cy="-2.5" r="1.8" className="moon-mare" />
      <circle cx="2.6" cy="3" r="2.4" className="moon-mare" />
      <circle cx="3.4" cy="-4.2" r="1.1" className="moon-mare" />
    </svg>
  )
}

/** "· waning gibbous", for beside the count of days. */
export function MoonWords() {
  useMinute() // enough to turn over at midnight; the moon is in no hurry
  return <span className="star-moon"> · {moonName(moonPhase(new Date()))}</span>
}

// --- the seal ---------------------------------------------------------------
// A great arcane seal, each ring of it its own picture so that turning it
// is the graphics card moving a finished image rather than the page
// redrawing lines every frame. Every stroke is one screen pixel whatever the
// size, so it stays as sharp as the text.

const polar = (r, a) => [Math.cos(a) * r, Math.sin(a) * r]
const fmt = (n) => n.toFixed(2)
const ticks = (count, r0, r1, every, r2) => Array.from({ length: count }, (_, i) => {
  const a = (i / count) * Math.PI * 2
  const [x0, y0] = polar(i % every === 0 ? r2 : r0, a)
  const [x1, y1] = polar(r1, a)
  return `M${fmt(x0)} ${fmt(y0)}L${fmt(x1)} ${fmt(y1)}`
}).join('')
const starPolygon = (n, step, r, turn = -Math.PI / 2) => {
  let path = ''
  for (let i = 0; i <= n; i++) {
    const [x, y] = polar(r, turn + ((i * step) % n) * ((Math.PI * 2) / n))
    path += `${i === 0 ? 'M' : 'L'}${fmt(x)} ${fmt(y)}`
  }
  return path
}

function Ring({ className, children }) {
  return (
    <svg className={`seal-ring ${className}`} viewBox="-100 -100 200 200" aria-hidden="true">
      {children}
    </svg>
  )
}

export function Seal() {
  const band = `b${useId().replace(/:/g, '')}`
  return (
    <div className="seal" aria-hidden="true">
      <Ring className="seal-outer">
        <defs>
          <path id={band} d="M0,-86a86,86 0 1,1 0,172a86,86 0 1,1 0,-172" />
        </defs>
        <circle r="98.5" />
        <circle r="94" />
        <circle r="79" />
        <path d={ticks(120, 94, 97, 10, 91.5)} />
        <text className="seal-runes">
          <textPath href={`#${band}`} textLength="536" lengthAdjust="spacing">
            {`${RUNES} ✦ ${RUNES} ✦ `}
          </textPath>
        </text>
      </Ring>
      <Ring className="seal-middle">
        <path d={starPolygon(12, 5, 76)} />
        <circle r="62" />
        {Array.from({ length: 12 }, (_, i) => {
          const [x, y] = polar(70, -Math.PI / 2 + (i * Math.PI) / 6)
          return <circle key={i} cx={fmt(x)} cy={fmt(y)} r={i % 3 === 0 ? 3.2 : 1.8} />
        })}
      </Ring>
      <Ring className="seal-inner">
        <path d={starPolygon(6, 2, 56)} />
        <path d={starPolygon(6, 2, 56, Math.PI / 2)} />
        <circle r="41" />
        <circle r="31" className="seal-dashed" />
        <path d={ticks(24, 41, 44, 6, 38)} />
      </Ring>
      <div className="seal-moon"><Moon size="100%" /></div>
    </div>
  )
}

/**
 * The Grimoire: every school of magic you have practised this past month,
 * its rank, and how far it is toward the next. Shown with the ledger in the
 * Overview.
 */
export function Grimoire({ month, tags }) {
  const rows = tags
    .filter((t) => (month.get(t.id) ?? 0) > 0)
    .map((t) => ({ tag: t, minutes: month.get(t.id) }))
    .sort((a, b) => b.minutes - a.minutes)
  if (rows.length === 0) return null
  return (
    <div className="grimoire">
      <span className="eyebrow">Grimoire · the last {RANK_DAYS} days</span>
      <ul className="grimoire-list">
        {rows.map(({ tag, minutes }) => {
          const rank = rankOf(minutes)
          return (
            <li key={tag.id} className="grimoire-row" title={rankTitle(tag.name, minutes)}>
              <RankGem minutes={minutes} />
              <span className="grimoire-name">{tag.name}</span>
              <span className="grimoire-rank" data-rank={rank.index}>{rank.name}</span>
              <span className="grimoire-bar">
                <span className="grimoire-fill" style={{ width: `${rankProgress(minutes) * 100}%` }} />
              </span>
              <span className="grimoire-hours">{Math.floor(minutes / 60)}h</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
