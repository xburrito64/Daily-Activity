import { useEffect, useId, useRef, useState } from 'react'
import { frostFerns, cobweb, blossomBranch, meadow, firBough, fireworksEvery, minuteOfDay } from './festivals.js'
import { runLoop, stillness } from './loop.js'

// The festival nights of Starlit.
//
// Christmas Eve. Wherever it falls in the list the day is rimed: frost grown
// in over the ends of its bar, its date in ice, a snowflake for its diamond
// and a gift sealed in wax beside it; painting on it casts a frost sigil
// that breaks into snow crystals. On the night itself the northern lights
// come out over the grimoire, the guiding star shows, frost creeps in at the
// corners of the window and snow falls across everything.
//
// The Sundays of Advent. Warm where Christmas Eve is cold: candlelight,
// fir and holly red. The day has fir boughs over the corners of its bar, a
// gold star hanging off one; its date in candlelight, a flame for its
// diamond, and beside it a wreath with as many candles lit as Sundays have
// come; painting on it casts an Advent star that goes up in embers. On the
// Sunday itself the moon rises behind a great wreath, its candles burning,
// glass baubles hang swinging from sprigs of fir along the top of the
// window, and embers drift up the page.
//
// Halloween. The day is strung with cobwebs, a spider hanging off its bar,
// its date lit amber like candlelight through a carved face, a pumpkin for
// its diamond and a jack-o'-lantern beside it; painting on it casts a
// grinning sigil that goes up in a flurry of bats. On the night itself the
// moon hangs orange over a violet mist, great webs fill the corners of the
// window with their spider going up and down, bats cross the moon, and
// will-o'-wisps drift about the page, shying away from the pointer.
//
// Easter. The day breaks into blossom: a flowering branch reaching in over
// its bar, a warm dawn along the foot of it, its date in the colours of
// sunrise, an egg for its diamond and a rune-painted egg beside it; painting
// on it casts a blossom sigil that scatters into petals and butterflies. On
// the day itself the night gives way to dawn, petals drift down, luminous
// butterflies wander the page, a field of flowers blooms along the foot of
// the window (the spell for a field of flowers, the gentlest there is), and
// five eggs are hidden about the grimoire for finding.
//
// The nights of falling stars, the Perseids in August and the Geminids in
// December: a falling star beside the date, streaks across its bar, and on
// the night a real shower, every star falling away from the one point in
// the sky the shower comes from, a fireball now and then leaving a trail.
//
// The turnings of the year. The Longest Night: a crescent beside the date,
// star dust over its bar, and on the night the darkest sky of the year with
// the Milky Way across it. Midsummer: a jar of fireflies, grass at the foot
// of its bar, and on the night a sky that never goes fully dark, fireflies
// drifting low about the page and toward the pointer.
//
// The turn of the year. New Year's Eve: an hourglass nearly run out beside
// the date, fireworks over its bar, and on the night fireworks going up
// more and more often as midnight nears, the last ten seconds counted down
// across the sky. New Year's Day: a quill and a fresh page beside the date,
// a ribbon marking its bar; the grimoire turns a new page as it opens, and
// the fireworks go on for the first hour or two.
//
// The folk days. St. Nicholas: a boot stuffed with treats by the date,
// walnuts and gold coins at the ends of its bar, and on the day boots
// standing at the foot of the window, filled in the night; a spell cast on
// it rains chocolate coins. Valentine's Day: a rose by the date, wild roses
// climbing over its bar, and on the day sky lanterns rising up the window;
// a spell cast on it goes up in hearts. Carnival: a mask by the date, a
// harlequin diamond, streamers and confetti over its bar, and on the day
// confetti tumbling down the page; a spell cast on it bursts into confetti.
//
// All of it is drawn once and then only shown, apart from what moves (the
// snow, the wisps, the bats, the petals, the butterflies, the embers, the
// falling stars and the fireflies), which runs on the shared clock
// (loop.js) like every other scene.

/** A gift, wrapped in midnight blue, tied in crimson, sealed with a star. */
export function Gift({ glint = false }) {
  return (
    <span className={`gift${glint ? ' glint' : ''}`} title="Christmas Eve" aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="gift-bow" d="M13 8.6C11.9 5 7.6 3.6 6.9 5.8c-.6 1.9 2.9 2.9 6.1 2.8Z" />
        <path className="gift-bow" d="M13 8.6c1.1-3.6 5.4-5 6.1-2.8.6 1.9-2.9 2.9-6.1 2.8Z" />
        <rect className="gift-box" x="5" y="12" width="16" height="11.6" rx="0.6" />
        <circle className="gift-star" cx="8.2" cy="15.3" r="0.6" />
        <circle className="gift-star" cx="18" cy="15.6" r="0.45" />
        <circle className="gift-star" cx="17.6" cy="20.6" r="0.6" />
        <circle className="gift-star" cx="8.7" cy="20.9" r="0.4" />
        <rect className="gift-ribbon" x="11.6" y="12" width="2.8" height="11.6" />
        <rect className="gift-lid" x="3.8" y="8.6" width="18.4" height="3.9" rx="0.6" />
        <rect className="gift-ribbon" x="11.6" y="8.6" width="2.8" height="3.9" />
        <path className="gift-snow" d="M3.9 9.7c.3-1.3 1.5-1.6 2.4-1.1.8-1 2.4-.9 3 0 .6-.5 1.5-.5 2 .1h3.6c.7-.8 2-.9 2.7-.2.8-.7 2.3-.6 2.8.3.8-.2 1.7.1 1.9 1Z" />
        <circle className="gift-seal" cx="13" cy="10.9" r="2.2" />
        <path className="gift-sigil" d="m13 9.6.38.92.92.38-.92.38-.38.92-.38-.92-.92-.38.92-.38Z" />
      </svg>
    </span>
  )
}

/** A jack-o'-lantern, a candle in it shining out through its carved face. */
export function Lantern({ lit = false }) {
  return (
    <span className={`lantern${lit ? ' lit' : ''}`} title="Halloween" aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="lantern-stem" d="M12.2 8.4c.1-2.3.9-4.3 2.9-5.4l1 1.1c-1.6.9-2.3 2.4-2.3 4.4Z" />
        <ellipse className="lantern-rind" cx="13" cy="15.6" rx="10.6" ry="8.2" />
        <ellipse className="lantern-rib" cx="8.4" cy="15.6" rx="5.2" ry="7.9" />
        <ellipse className="lantern-rib" cx="17.6" cy="15.6" rx="5.2" ry="7.9" />
        <ellipse className="lantern-rib middle" cx="13" cy="15.6" rx="3.5" ry="8.1" />
        <g className="lantern-face">
          <path d="M6.6 14.6 8.9 10.9 10.6 14.6Z" />
          <path d="M15.4 14.6 17.1 10.9 19.4 14.6Z" />
          <path d="M12.1 16.4 13 15 13.9 16.4Z" />
          <path d="M6.4 17.6c2.1 3.3 11.1 3.3 13.2 0l-.9-.3-.9 1.3-1.1-1.1-1.2 1.4-1.2-1.3L13 19l-1.3-1.4-1.2 1.3-1.2-1.4-1.1 1.1-.9-1.3Z" />
        </g>
      </svg>
    </span>
  )
}

// An egg's outline, for the painted eggs.
const EGG = 'M13 2.6C8.9 2.6 5.6 9.6 5.6 14.9c0 4.8 3.3 8.3 7.4 8.3s7.4-3.5 7.4-8.3C20.4 9.6 17.1 2.6 13 2.6Z'

/**
 * An egg painted the old way: two bands, a zigzag between them, dots at
 * either end, a fine gold rim. `tone` picks one of five sets of colours
 * (themes.css); a wobbling egg rocks now and then, as if about to hatch.
 */
export function Egg({ tone = 0, wobble = false, className = '' }) {
  const clip = `egg${useId().replace(/:/g, '')}`
  return (
    <span className={`egg tone-${tone}${wobble ? ' wobble' : ''} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <defs><clipPath id={clip}><path d={EGG} /></clipPath></defs>
        <path className="egg-shell" d={EGG} />
        <g clipPath={`url(#${clip})`}>
          <rect className="egg-band" x="0" y="9.2" width="26" height="2.6" />
          <path className="egg-zig" d="M3.6 15.4l2.1-2 2.1 2 2.1-2 2.1 2 2.1-2 2.1 2 2.1-2 2.1 2 2.1-2" />
          <rect className="egg-band" x="0" y="17.8" width="26" height="2.2" />
          <circle className="egg-dot" cx="10.2" cy="6.6" r="0.85" />
          <circle className="egg-dot" cx="15.8" cy="6.6" r="0.85" />
          <circle className="egg-dot" cx="13" cy="4.8" r="0.75" />
          <circle className="egg-dot" cx="9.4" cy="21.9" r="0.75" />
          <circle className="egg-dot" cx="13" cy="22.5" r="0.75" />
          <circle className="egg-dot" cx="16.6" cy="21.9" r="0.75" />
        </g>
        <path className="egg-rim" d={EGG} />
      </svg>
    </span>
  )
}

// Where the four candles of the little wreath stand, left to right: two at
// the front of the ring, two further back on it, lit in that order.
const WREATH_CANDLES = [[6.2, 20.4], [12.8, 17.2], [21.2, 17.2], [27.8, 20.4]]

/** The Advent wreath beside the date, `lit` of its four candles burning. */
export function Wreath({ lit = 1, flicker = false }) {
  const candle = ([x, base], i) => (
    <g key={i}>
      <rect className="wreath-candle" x={x - 1.3} y={base - 8} width="2.6" height="8" rx="0.4" />
      <rect className="wreath-shine" x={x - 0.9} y={base - 7.6} width="0.7" height="7.2" />
      {i < lit
        ? <path className="wreath-flame" d={`M${x} ${base - 13.2}q1.6 2.4 0 4.1q-1.6-1.7 0-4.1Z`} />
        : <path className="wreath-wick" d={`M${x} ${base - 8}v-1.1`} />}
    </g>
  )
  return (
    <span className={`wreath${flicker ? ' lit' : ''}`} title="Advent" aria-hidden="true">
      <svg viewBox="0 0 34 26">
        <path className="wreath-fir" d="M3.5 19.8A13.5 4.4 0 0 1 30.5 19.8" />
        <path className="wreath-needles" d="M3.5 19.8A13.5 4.4 0 0 1 30.5 19.8" />
        {[1, 2].map((i) => candle(WREATH_CANDLES[i], i))}
        <path className="wreath-fir" d="M3.5 19.8A13.5 4.4 0 0 0 30.5 19.8" />
        <path className="wreath-needles" d="M3.5 19.8A13.5 4.4 0 0 0 30.5 19.8" />
        {[[8.5, 23.3], [12.6, 24.1], [17, 24.4], [21.4, 24.1], [25.5, 23.3]].map(([x, y]) => (
          <circle key={x} className="wreath-berry" cx={x} cy={y} r="0.95" />
        ))}
        {[0, 3].map((i) => candle(WREATH_CANDLES[i], i))}
      </svg>
    </span>
  )
}

/** A falling star, gold for the Perseids, pale blue for the Geminids. */
export function ShootingStar({ tone = 'gold' }) {
  const tail = `tail${useId().replace(/:/g, '')}`
  return (
    <span className={`meteor-mark ${tone}`} aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <defs>
          <linearGradient id={tail} x1="17" y1="9" x2="2" y2="24" gradientUnits="userSpaceOnUse">
            <stop offset="0" className="meteor-tail-head" />
            <stop offset="1" className="meteor-tail-end" />
          </linearGradient>
        </defs>
        <path d="M17 9 2.5 23.5" stroke={`url(#${tail})`} strokeWidth="2.2" strokeLinecap="round" />
        <path d="M13.6 8.6 1.8 20.4" stroke={`url(#${tail})`} strokeWidth="0.8" strokeLinecap="round" opacity="0.6" />
        <path className="meteor-star" d="m17.6 3.6 1.4 3.4 3.6.3-2.7 2.4.8 3.5-3.1-1.9-3.1 1.9.8-3.5-2.7-2.4 3.6-.3Z" />
      </svg>
    </span>
  )
}

/** A crescent and three stars, for the Longest Night. */
export function MoonMark() {
  return (
    <span className="moon-mark" aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="moon-mark-crescent" d="M15.5 3.5a9.8 9.8 0 1 0 7 16.6A8.2 8.2 0 0 1 15.5 3.5Z" />
        <path className="moon-mark-star" d="m21 3 .6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6-1.6-.6 1.6-.6Z" />
        <path className="moon-mark-star" d="m23 10.5.4 1 1 .4-1 .4-.4 1-.4-1-1-.4 1-.4Z" />
        <path className="moon-mark-star" d="m17.5 11 .3.8.8.3-.8.3-.3.8-.3-.8-.8-.3.8-.3Z" />
      </svg>
    </span>
  )
}

/** A jar of fireflies, for Midsummer; on the night itself its light pulses. */
export function FireflyJar({ lit = false }) {
  return (
    <span className={`jar${lit ? ' lit' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <rect className="jar-lid" x="8.2" y="3.4" width="9.6" height="3" rx="0.8" />
        <path className="jar-glass" d="M8.6 6.4h8.8v1.4c2 1 2.6 2.6 2.6 4.4v8.2c0 1.8-1.2 2.8-3 2.8H9c-1.8 0-3-1-3-2.8v-8.2c0-1.8.6-3.4 2.6-4.4Z" />
        {[[10.5, 17.5], [15, 14], [13, 20.2], [16.8, 19], [11.4, 12.4]].map(([x, y]) => (
          <circle key={`${x}-${y}`} className="jar-fly" cx={x} cy={y} r="1.1" />
        ))}
        <path className="jar-shine" d="M8.4 11.5v7.5" />
      </svg>
    </span>
  )
}

/** An hourglass with its sand nearly run out, for New Year's Eve. */
export function Hourglass({ lit = false }) {
  return (
    <span className={`hourglass${lit ? ' lit' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="hourglass-glass" d="M8 5.5h10c0 4-4 5.5-4 7.5s4 3.5 4 7.5H8c0-4 4-5.5 4-7.5S8 9.5 8 5.5Z" />
        <path className="hourglass-sand" d="M11.4 10.6h3.2L13 12.5Z" />
        <path className="hourglass-stream" d="M13 12.6v4" />
        <path className="hourglass-sand" d="M8.6 20.2c.4-2.6 2.6-4.2 4.4-4.5 1.8.3 4 1.9 4.4 4.5Z" />
        <rect className="hourglass-frame" x="5.6" y="3" width="14.8" height="2.4" rx="0.6" />
        <rect className="hourglass-frame" x="5.6" y="20.6" width="14.8" height="2.4" rx="0.6" />
        <path className="hourglass-post" d="M6.6 5.4v15.2M19.4 5.4v15.2" />
      </svg>
    </span>
  )
}

/** A quill over a fresh page, for New Year's Day. */
export function FreshPage() {
  return (
    <span className="fresh-page" aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="page-leaf" d="M5.5 5h10l4.5 4.5V23h-14.5Z" />
        <path className="page-fold" d="M15.5 5v4.5H20" />
        <path className="page-rule" d="M8.2 13h8.6M8.2 16h8.6M8.2 19h5.4" />
        <path className="page-quill" d="M22.6 1.8C17.4 3 12.9 7.6 11.2 14.6l1.3.4C14.3 9.8 18.2 5.2 22.6 1.8Z" />
        <path className="page-shaft" d="M22 2.4 10.2 17.6" />
      </svg>
    </span>
  )
}

/** A boot put out for St. Nicholas, stuffed with an orange, a candy cane and a coin. */
export function Boot({ className = '' }) {
  return (
    <span className={`boot ${className}`} aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="boot-cane" d="M15.2 9V2.9c0-1.5 2.8-1.5 2.8 0" />
        <path className="boot-stripe" d="M15.2 9V2.9c0-1.5 2.8-1.5 2.8 0" />
        <circle className="boot-orange" cx="10.4" cy="5.6" r="2.7" />
        <circle className="boot-coin" cx="13.2" cy="4.6" r="1.8" />
        <path className="boot-leather" d="M7.6 7.4h9v9.2c2.7.4 5.6 1.6 6.1 3.8.2.9-.4 1.7-1.4 1.7H7c-.8 0-1.3-.5-1.3-1.3Z" />
        <rect className="boot-cuff" x="7" y="7" width="10.2" height="2.4" rx="0.8" />
        <path className="boot-sole" d="M6 21.8h16.4" />
        <path className="boot-shine" d="M9.4 11v7" />
      </svg>
    </span>
  )
}

/** A red rose, for Valentine's Day. */
export function Rose() {
  return (
    <span className="rose" aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="rose-stem" d="M13 12.6c-.4 4 .8 7.5 2.4 11" />
        <path className="rose-leaf" d="M13.8 17.6c2.6-2.4 5.6-2.4 6.6-1.6-1.4 2.2-4.2 3-6.6 1.6Z" />
        <path className="rose-leaf" d="M13.2 20.4c-2.4-1.6-5-1.4-5.8-.6 1.4 1.8 3.8 2.2 5.8.6Z" />
        <path className="rose-petal back" d="M6.5 7.8c0-3.6 3-5.8 6.5-5.8s6.5 2.2 6.5 5.8c0 3.4-2.8 5.6-6.5 5.6s-6.5-2.2-6.5-5.6Z" />
        <path className="rose-petal" d="M8.2 8.4c.6-2.4 2.6-3.6 4.8-3.6s4.2 1.2 4.8 3.6c-.6 2.4-2.4 4-4.8 4s-4.2-1.6-4.8-4Z" />
        <path className="rose-curl" d="M10.8 7.8c.4-1.3 1.5-2 2.6-1.8 1.3.2 1.9 1.3 1.5 2.3-.4 1.1-1.7 1.3-2.3.6" />
      </svg>
    </span>
  )
}

/** A carnival mask with a feather in it. */
export function Mask() {
  return (
    <span className="carnival-mask" aria-hidden="true">
      <svg viewBox="0 0 26 26">
        <path className="mask-feather teal" d="M20.2 9.4c1-3.8 3.4-6.6 4.2-7.2-.2 2.8-1.2 5.8-3.2 7.9Z" />
        <path className="mask-feather pink" d="M18.8 9c.2-3.4 1.6-6.2 2.2-6.8.2 2.6-.4 5.4-1.4 7.2Z" />
        <path className="mask-face" d="M2.5 10.8c2-2.6 6-3 10.5-.8 4.5-2.2 8.5-1.8 10.5.8-.4 4-2.8 6.6-6 6.6-2.2 0-3.4-1.4-4.5-2.8-1.1 1.4-2.3 2.8-4.5 2.8-3.2 0-5.6-2.6-6-6.6Z" />
        <path className="mask-eye" d="M6 12c1.4-1.2 3.4-1.2 4.6.2-1.2 1.4-3.2 1.4-4.6-.2Z" />
        <path className="mask-eye" d="M15.4 12.2c1.2-1.4 3.2-1.4 4.6-.2-1.4 1.4-3.4 1.4-4.6.2Z" />
        <circle className="mask-gem" cx="13" cy="10.6" r="0.95" />
      </svg>
    </span>
  )
}

/** What sits by the date on a festival. */
export function FestiveMark({ id, lit = false, nth = 1 }) {
  if (id === 'st-nicholas') return <Boot />
  if (id === 'valentines') return <Rose />
  if (id === 'carnival') return <Mask />
  if (id === 'new-years-eve') return <Hourglass lit={lit} />
  if (id === 'new-year') return <FreshPage />
  if (id === 'perseids') return <ShootingStar tone="gold" />
  if (id === 'geminids') return <ShootingStar tone="blue" />
  if (id === 'longest-night') return <MoonMark />
  if (id === 'midsummer') return <FireflyJar lit={lit} />
  if (id === 'advent') return <Wreath lit={nth} flicker={lit} />
  if (id === 'easter') return <Egg wobble={lit} />
  if (id === 'halloween') return <Lantern lit={lit} />
  if (id === 'christmas-eve') return <Gift glint={lit} />
  return null
}

/** The colour a spell cast on each festival's day is drawn in. */
export const FESTIVE_TINTS = {
  'christmas-eve': '#e6f6ff',
  halloween: '#ffb866',
  easter: '#ffc4dc',
  advent: '#ffd98a',
  perseids: '#ffe7a8',
  geminids: '#aee8ff',
  'longest-night': '#d6d0ff',
  midsummer: '#e4ff9c',
  'new-years-eve': '#ffe6a6',
  'new-year': '#fff2cf',
  'st-nicholas': '#ffcf9a',
  valentines: '#ff9ab8',
  carnival: '#ffd34f',
}

/** What the sky says as the app opens on a festival night. */
export const FESTIVE_LINES = {
  perseids: { eyebrow: 'A night of falling stars', line: 'the Perseids are falling; look up', spell: '#ffe7a8' },
  geminids: { eyebrow: 'A night of falling stars', line: 'the Geminids fall, slow and many-coloured', spell: '#aee8ff' },
  'longest-night': { eyebrow: 'The turning of the year', line: 'the longest night; from here the days grow', spell: '#d6d0ff' },
  midsummer: { eyebrow: 'The turning of the year', line: 'the shortest night; the sky never quite goes dark', spell: '#e4ff9c' },
  'new-years-eve': { eyebrow: 'The last night of the year', line: 'the old year runs out at midnight', spell: '#ffe6a6' },
  'st-nicholas': { eyebrow: 'A festival day', line: 'the boots were filled in the night', spell: '#ffcf9a' },
  valentines: { eyebrow: 'A festival day', line: 'lanterns rise for everyone you love', spell: '#ff9ab8' },
  carnival: { eyebrow: 'A festival day', line: 'masks on; the whole grimoire is dancing', spell: '#ffd34f' },
  'new-year': {
    eyebrow: 'A new year',
    line: 'a fresh page in the grimoire',
    spell: '#fff2cf',
    title: () => String(new Date().getFullYear()),
  },
  'christmas-eve': { line: 'snow falls over the grimoire', spell: '#cfeaff' },
  halloween: { line: 'the veil is thin tonight', spell: '#ffb866' },
  easter: { line: 'five eggs are hidden about the grimoire', spell: '#ffc4dc', eyebrow: 'A festival morning' },
  advent: {
    eyebrow: 'A Sunday in Advent',
    spell: '#ffd98a',
    line: (nth) => [
      'the first candle is lit',
      'two candles burn in the wreath',
      'three candles burn, and one still waits',
      'all four candles burn; Christmas is near',
    ][nth - 1],
  },
}

/** A small spider, let down on its thread. */
export function Spider({ className = '' }) {
  return (
    <span className={`spider ${className}`} aria-hidden="true">
      <svg viewBox="0 0 20 20">
        <path
          className="spider-legs"
          d="M8.4 9.2 4.6 6.4 2.4 7.6M8.2 10.6 3.8 9.9 1.8 12M8.4 12 4.4 13.8 3.4 16.6M8.9 13.2 6.6 16.4 6.8 19M11.6 9.2l3.8-2.8 2.2 1.2M11.8 10.6l4.4-.7 2 2.1M11.6 12l4 1.8 1 2.8M11.1 13.2l2.3 3.2-.2 2.6"
        />
        <ellipse className="spider-body" cx="10" cy="12.6" rx="3.1" ry="3.7" />
        <circle className="spider-body" cx="10" cy="8.2" r="2" />
        <circle className="spider-eye" cx="9.3" cy="7.9" r="0.45" />
        <circle className="spider-eye" cx="10.7" cy="7.9" r="0.45" />
      </svg>
    </span>
  )
}

// --- frost ----------------------------------------------------------------
// Two panes of frost, grown once and shared as pictures: a large one for the
// corners of the window, and a long low one for the ends of a bar, where it
// is shown a good deal smaller.

let frostMade = null
export function makeFrost() {
  if (frostMade) return frostMade
  const pane = (w, h, seed, { boldness = 1, mist = 0.2, edge = false, ...growth } = {}) => new Promise((resolve) => {
    const scale = 2
    const c = document.createElement('canvas')
    c.width = w * scale
    c.height = h * scale
    const g = c.getContext('2d')
    g.scale(scale, scale)
    const reach = Math.hypot(w, h)
    // A breath of mist where the cold is.
    const haze = g.createRadialGradient(0, 0, 0, 0, 0, reach * 0.62)
    haze.addColorStop(0, `rgba(200, 226, 255, ${mist})`)
    haze.addColorStop(1, 'rgba(200, 226, 255, 0)')
    g.fillStyle = haze
    g.fillRect(0, 0, w, h)
    const { lines, rime, glints } = frostFerns(w, h, seed, growth)
    for (const d of rime) {
      g.fillStyle = `rgba(232, 244, 255, ${d.alpha.toFixed(3)})`
      g.fillRect(d.x - d.r / 2, d.y - d.r / 2, d.r, d.r)
    }
    // The feathers on a sheet of their own, stroked in batches of the same
    // width and strength (there are tens of thousands of little lines), then
    // laid in twice: once softened, for the glow of the ice, once sharp.
    const sheet = document.createElement('canvas')
    sheet.width = c.width
    sheet.height = c.height
    const f = sheet.getContext('2d')
    f.scale(scale, scale)
    f.lineCap = 'round'
    const batches = new Map()
    for (const l of lines) {
      const key = `${Math.min(1, l.alpha * boldness).toFixed(2)}|${(l.width * boldness).toFixed(1)}`
      if (!batches.has(key)) batches.set(key, [])
      batches.get(key).push(l)
    }
    for (const [key, list] of batches) {
      const [alpha, width] = key.split('|').map(Number)
      f.strokeStyle = `rgba(232, 245, 255, ${alpha})`
      f.lineWidth = Math.max(0.35, width)
      f.beginPath()
      for (const l of list) { f.moveTo(l.x0, l.y0); f.lineTo(l.x1, l.y1) }
      f.stroke()
    }
    g.save()
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.filter = `blur(${2 * scale}px)`
    g.globalAlpha = 0.8
    g.drawImage(sheet, 0, 0)
    g.filter = 'none'
    g.globalAlpha = 1
    g.drawImage(sheet, 0, 0)
    g.restore()
    for (const s of glints) {
      const glow = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5)
      glow.addColorStop(0, 'rgba(255, 255, 255, 0.9)')
      glow.addColorStop(1, 'rgba(210, 235, 255, 0)')
      g.fillStyle = glow
      g.fillRect(s.x - s.r * 5, s.y - s.r * 5, s.r * 10, s.r * 10)
    }
    // Thinning away to nothing, so the pane has no edge of its own: out
    // from the corner, or for frost along an edge, along it and away from it.
    g.globalCompositeOperation = 'destination-in'
    const fades = edge
      ? [g.createLinearGradient(w * 0.55, 0, w, 0), g.createLinearGradient(0, h * 0.35, 0, h)]
      : [g.createRadialGradient(0, 0, reach * 0.18, 0, 0, reach * 0.78)]
    for (const fade of fades) {
      fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
      g.fillStyle = fade
      g.fillRect(0, 0, w, h)
    }
    c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null))
  })
  frostMade = Promise.all([
    pane(600, 400, 24),
    // A bar is long and low, so its frost runs along the edge rather than
    // filling the corner.
    pane(560, 140, 7, {
      edge: true, boldness: 1.2, mist: 0.05, corner: 1, top: 13, side: 1, spread: 0.9, slant: 0.75, rime: 'edge', grains: 2000,
    }),
  ]).then(([big, small]) => {
    const root = document.documentElement.style
    if (big) root.setProperty('--frost-pane', `url(${big})`)
    if (small) root.setProperty('--frost-rim', `url(${small})`)
  })
  return frostMade
}

/** Frost in the four corners of the window, as if the pane had iced over. */
export function FrostPane() {
  return <div className="frost-pane" aria-hidden="true"><i /><i /><i /><i /></div>
}

// --- cobwebs and mist -------------------------------------------------------
// Two webs, spun once and shared as pictures like the frost: a large one for
// the top corners of the window, and a small one for the corners of a bar.
// And the mist that rolls along the foot of the window on Halloween night,
// a strip that joins up end to end so it can drift forever.

let websMade = null
export function makeWebs() {
  if (websMade) return websMade
  const web = (w, h, seed, shape, strength) => new Promise((resolve) => {
    const scale = 2
    const c = document.createElement('canvas')
    c.width = w * scale
    c.height = h * scale
    const g = c.getContext('2d')
    g.scale(scale, scale)
    const { lines, silk, dew } = cobweb(w, h, seed, shape)
    g.lineCap = 'round'
    g.strokeStyle = `rgba(228, 222, 242, ${0.9 * strength})`
    g.lineWidth = 0.7
    g.beginPath()
    for (const l of lines) { g.moveTo(l.x0, l.y0); g.lineTo(l.x1, l.y1) }
    g.stroke()
    g.lineWidth = 0.55
    g.strokeStyle = `rgba(228, 222, 242, ${0.75 * strength})`
    g.beginPath()
    for (const t of silk) { g.moveTo(t.x0, t.y0); g.quadraticCurveTo(t.cx, t.cy, t.x1, t.y1) }
    g.stroke()
    for (const d of dew) {
      const glow = g.createRadialGradient(d.x, d.y, 0, d.x, d.y, d.r * 3)
      glow.addColorStop(0, 'rgba(255, 236, 200, 0.9)')
      glow.addColorStop(1, 'rgba(255, 200, 140, 0)')
      g.fillStyle = glow
      g.fillRect(d.x - d.r * 3, d.y - d.r * 3, d.r * 6, d.r * 6)
    }
    c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null))
  })
  const mist = () => new Promise((resolve) => {
    const w = 1200
    const h = 260
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    const g = c.getContext('2d')
    let a = 13
    const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647 }
    for (let i = 0; i < 70; i++) {
      const x = rand() * w
      const y = h * (0.45 + rand() * 0.6)
      const r = 50 + rand() * 110
      const tone = rand() < 0.5 ? '150, 118, 196' : '108, 98, 150'
      const alpha = 0.06 + rand() * 0.1
      // Drawn at both ends as well, so the strip meets itself seamlessly.
      for (const dx of [-w, 0, w]) {
        const puff = g.createRadialGradient(x + dx, y, 0, x + dx, y, r)
        puff.addColorStop(0, `rgba(${tone}, ${alpha})`)
        puff.addColorStop(1, `rgba(${tone}, 0)`)
        g.fillStyle = puff
        g.fillRect(x + dx - r, y - r, r * 2, r * 2)
      }
    }
    c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null))
  })
  websMade = Promise.all([
    web(520, 520, 31, { spokes: 9, rings: 13, reach: 0.9 }, 0.8),
    web(240, 120, 5, { spokes: 7, rings: 7, reach: 0.95 }, 1),
    mist(),
  ]).then(([big, small, fog]) => {
    const root = document.documentElement.style
    if (big) root.setProperty('--web-pane', `url(${big})`)
    if (small) root.setProperty('--web-rim', `url(${small})`)
    if (fog) root.setProperty('--mist', `url(${fog})`)
  })
  return websMade
}

// --- blossom ------------------------------------------------------------------
// The four tints of blossom, and of the flowers in the field.
const BLOOM_TONES = ['255, 196, 220', '250, 246, 255', '255, 214, 232', '232, 206, 255']
const FLOWER_TONES = ['150, 205, 255', '242, 246, 255', '255, 188, 214', '255, 226, 140']

/** Five round petals about a golden heart, with a soft light round them. */
function drawBloom(g, x, y, r, rgb, turn, glow = 0.3) {
  const halo = g.createRadialGradient(x, y, 0, x, y, r * 2.6)
  halo.addColorStop(0, `rgba(${rgb}, ${glow})`)
  halo.addColorStop(1, `rgba(${rgb}, 0)`)
  g.fillStyle = halo
  g.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2)
  g.fillStyle = `rgba(${rgb}, 0.95)`
  for (let i = 0; i < 5; i++) {
    const a = turn + (i * Math.PI * 2) / 5
    g.beginPath()
    g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.55, r * 0.4, a, 0, Math.PI * 2)
    g.fill()
  }
  g.fillStyle = 'rgba(255, 222, 130, 1)'
  g.beginPath()
  g.arc(x, y, r * 0.26, 0, Math.PI * 2)
  g.fill()
}

// The flowering branch, grown once and shared as a picture like the frost
// and the webs, for the top corners of a bar.
let bloomsMade = null
export function makeBlooms() {
  if (bloomsMade) return bloomsMade
  bloomsMade = new Promise((resolve) => {
    const w = 360
    const h = 120
    const scale = 2
    const c = document.createElement('canvas')
    c.width = w * scale
    c.height = h * scale
    const g = c.getContext('2d')
    g.scale(scale, scale)
    const { wood, blossoms, leaves } = blossomBranch(w, h)
    g.lineCap = 'round'
    for (const l of wood) {
      g.strokeStyle = '#3a2a2a'
      g.lineWidth = l.width + 0.8
      g.beginPath(); g.moveTo(l.x0, l.y0); g.lineTo(l.x1, l.y1); g.stroke()
      g.strokeStyle = 'rgba(140, 104, 96, 0.9)'
      g.lineWidth = Math.max(0.5, l.width * 0.45)
      g.beginPath(); g.moveTo(l.x0, l.y0 - l.width * 0.2); g.lineTo(l.x1, l.y1 - l.width * 0.2); g.stroke()
    }
    for (const f of leaves) {
      g.save()
      g.translate(f.x, f.y)
      g.rotate(f.angle)
      g.fillStyle = 'rgba(120, 196, 140, 0.85)'
      g.beginPath()
      g.ellipse(f.length / 2, 0, f.length / 2, f.length / 5, 0, 0, Math.PI * 2)
      g.fill()
      g.restore()
    }
    for (const b of blossoms) drawBloom(g, b.x, b.y, b.r, BLOOM_TONES[b.tone], b.turn, 0.2)
    // Fading out along the bar and down it, so the branch has no edge of
    // its own.
    g.globalCompositeOperation = 'destination-in'
    for (const fade of [g.createLinearGradient(w * 0.6, 0, w, 0), g.createLinearGradient(0, h * 0.6, 0, h)]) {
      fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
      g.fillStyle = fade
      g.fillRect(0, 0, w, h)
    }
    c.toBlob((blob) => {
      if (blob) document.documentElement.style.setProperty('--bloom-rim', `url(${URL.createObjectURL(blob)})`)
      resolve()
    })
  })
  return bloomsMade
}

// --- fir ------------------------------------------------------------------------
const NEEDLE_GREENS = ['#1d4631', '#2c6844', '#3f8a58']

/** A fir bough, as firBough grew it: wood, needles, berries, hanging stars. */
function drawFir(g, { wood, needles, berries, stars }) {
  g.lineCap = 'round'
  g.strokeStyle = '#3a2a1e'
  for (const l of wood) {
    g.lineWidth = l.width
    g.beginPath(); g.moveTo(l.x0, l.y0); g.lineTo(l.x1, l.y1); g.stroke()
  }
  NEEDLE_GREENS.forEach((green, tone) => {
    g.strokeStyle = green
    g.lineWidth = 1.1
    g.beginPath()
    for (const n of needles) {
      if (n.tone !== tone) continue
      g.moveTo(n.x0, n.y0)
      g.lineTo(n.x1, n.y1)
    }
    g.stroke()
  })
  for (const b of berries) {
    const fill = g.createRadialGradient(b.x - b.r * 0.35, b.y - b.r * 0.35, 0, b.x, b.y, b.r)
    fill.addColorStop(0, '#ff9a9a')
    fill.addColorStop(0.35, '#d8313f')
    fill.addColorStop(1, '#7a0f1c')
    g.fillStyle = fill
    g.beginPath(); g.arc(b.x, b.y, b.r, 0, Math.PI * 2); g.fill()
  }
  for (const s of stars) {
    g.strokeStyle = 'rgba(232, 200, 130, 0.7)'
    g.lineWidth = 0.6
    g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x, s.y + s.drop); g.stroke()
    const cy = s.y + s.drop + 5
    const halo = g.createRadialGradient(s.x, cy, 0, s.x, cy, 14)
    halo.addColorStop(0, 'rgba(255, 214, 120, 0.45)')
    halo.addColorStop(1, 'rgba(255, 214, 120, 0)')
    g.fillStyle = halo
    g.fillRect(s.x - 14, cy - 14, 28, 28)
    g.fillStyle = '#f3cf78'
    g.strokeStyle = '#9a6a22'
    g.lineWidth = 0.5
    g.beginPath()
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 5.2 : 2.2
      const a = -Math.PI / 2 + (i * Math.PI) / 5
      g[i ? 'lineTo' : 'moveTo'](s.x + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    g.closePath()
    g.fill()
    g.stroke()
  }
}

/** A red velvet bow, tied where the two boughs meet in the corner. */
function drawBow(g, x, y) {
  const red = g.createLinearGradient(x - 16, y - 10, x + 16, y + 20)
  red.addColorStop(0, '#e2404e')
  red.addColorStop(1, '#7c1020')
  g.fillStyle = red
  g.strokeStyle = 'rgba(255, 170, 170, 0.5)'
  g.lineWidth = 0.7
  for (const side of [-1, 1]) {
    g.beginPath()
    g.moveTo(x, y)
    g.bezierCurveTo(x + side * 6, y - 14, x + side * 22, y - 10, x + side * 17, y + 1)
    g.bezierCurveTo(x + side * 13, y + 7, x + side * 5, y + 4, x, y)
    g.fill(); g.stroke()
    g.beginPath()
    g.moveTo(x, y)
    g.lineTo(x + side * 7, y + 22)
    g.lineTo(x + side * 3, y + 19)
    g.lineTo(x + side * 1, y + 23)
    g.closePath()
    g.fill(); g.stroke()
  }
  g.fillStyle = '#b3202f'
  g.beginPath(); g.ellipse(x, y + 1, 4, 3.4, 0, 0, Math.PI * 2); g.fill(); g.stroke()
}

// Fir, grown once and shared as pictures: a bough for the top corners of a
// bar, and a sprig tied with a bow for a bauble to hang from.
let firsMade = null
export function makeFirs() {
  if (firsMade) return firsMade
  const picture = (w, h, draw) => new Promise((resolve) => {
    const scale = 2
    const c = document.createElement('canvas')
    c.width = w * scale
    c.height = h * scale
    const g = c.getContext('2d')
    g.scale(scale, scale)
    draw(g)
    c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null))
  })
  firsMade = Promise.all([
    picture(360, 120, (g) => drawFir(g, firBough(360, 120, 3, { reach: 0.8 }))),
    // Two short boughs out either way from the middle, the bow over the knot.
    picture(120, 44, (g) => {
      const bough = firBough(60, 44, 11, { reach: 1, stars: 0 })
      for (const side of [1, -1]) {
        g.save()
        g.translate(60, 4)
        g.scale(side, 1)
        g.rotate(0.12)
        drawFir(g, bough)
        g.restore()
      }
      g.save()
      g.translate(60, 9)
      g.scale(0.55, 0.55)
      drawBow(g, 0, 0)
      g.restore()
    }),
  ]).then(([rim, sprig]) => {
    const root = document.documentElement.style
    if (rim) root.setProperty('--fir-rim', `url(${rim})`)
    if (sprig) root.setProperty('--fir-sprig', `url(${sprig})`)
  })
  return firsMade
}

// --- the sky days: what lies over their bars ------------------------------------
// Falling stars across a corner (gold, or pale blue), star dust, and grass
// with a firefly or two: made once, like the rest.
let skyRimsMade = null
export function makeSkyRims() {
  if (skyRimsMade) return skyRimsMade
  const picture = (draw) => new Promise((resolve) => {
    const w = 360
    const h = 120
    const c = document.createElement('canvas')
    c.width = w * 2
    c.height = h * 2
    const g = c.getContext('2d')
    g.scale(2, 2)
    let a = 17
    const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647 }
    draw(g, w, h, rand)
    c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null))
  })
  const streaks = (rgb) => (g, w, h, rand) => {
    for (const [x, y, len, width] of [[70, 58, 120, 1.6], [150, 26, 90, 1.1], [42, 104, 70, 0.9], [230, 60, 60, 0.8]]) {
      const tx = x + len * 0.85
      const ty = y - len * 0.5
      const line = g.createLinearGradient(x, y, tx, ty)
      line.addColorStop(0, 'rgba(255, 255, 250, 0.95)')
      line.addColorStop(0.25, `rgba(${rgb}, 0.55)`)
      line.addColorStop(1, `rgba(${rgb}, 0)`)
      g.strokeStyle = line
      g.lineWidth = width
      g.lineCap = 'round'
      g.beginPath(); g.moveTo(x, y); g.lineTo(tx, ty); g.stroke()
      const head = g.createRadialGradient(x, y, 0, x, y, 6)
      head.addColorStop(0, 'rgba(255, 255, 250, 0.9)')
      head.addColorStop(1, `rgba(${rgb}, 0)`)
      g.fillStyle = head
      g.fillRect(x - 6, y - 6, 12, 12)
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255, 255, 255, ${(0.2 + rand() * 0.5).toFixed(2)})`
      g.fillRect(rand() * w * 0.7, rand() * h, 1, 1)
    }
  }
  const dust = (g, w, h, rand) => {
    const haze = g.createRadialGradient(0, 0, 0, 0, 0, w * 0.6)
    haze.addColorStop(0, 'rgba(150, 140, 230, 0.16)')
    haze.addColorStop(1, 'rgba(150, 140, 230, 0)')
    g.fillStyle = haze
    g.fillRect(0, 0, w, h)
    for (let i = 0; i < 520; i++) {
      const d = rand() ** 1.6
      const x = d * w * 0.8 * (0.3 + rand() * 0.7) / 0.65
      const y = rand() * h * (1 - d * 0.4)
      const r = rand() < 0.06 ? 1.1 : 0.35 + rand() * 0.45
      g.fillStyle = `rgba(${rand() < 0.3 ? '255, 240, 220' : '225, 230, 255'}, ${((0.9 - d * 0.7) * (0.4 + rand() * 0.6)).toFixed(2)})`
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
    }
    // Thinning away from the corner, so the dust has no edge of its own.
    g.globalCompositeOperation = 'destination-in'
    const fade = g.createRadialGradient(0, 0, w * 0.1, 0, 0, w * 0.62)
    fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = fade
    g.fillRect(0, 0, w, h)
  }
  const grass = (g, w, h, rand) => {
    const { blades } = meadow(w * 0.75, h * 0.7, 23)
    const fill = g.createLinearGradient(0, h, 0, h * 0.35)
    fill.addColorStop(0, '#0b1714')
    fill.addColorStop(1, 'rgba(110, 170, 120, 0.85)')
    g.fillStyle = fill
    for (const b of blades) {
      const k = 1 - b.x / (w * 0.75)
      const height = b.height * (0.4 + k * 0.9)
      g.beginPath()
      g.moveTo(b.x - b.width / 2, h)
      g.quadraticCurveTo(b.x + b.lean * 0.3, h - height * 0.6, b.x + b.lean, h - height)
      g.quadraticCurveTo(b.x + b.lean * 0.3 + b.width * 0.3, h - height * 0.6, b.x + b.width / 2, h)
      g.fill()
    }
    for (const [x, y] of [[40, 62], [96, 84], [150, 52], [70, 30]]) {
      const glow = g.createRadialGradient(x, y, 0, x, y, 9)
      glow.addColorStop(0, 'rgba(250, 255, 200, 1)')
      glow.addColorStop(0.25, 'rgba(200, 255, 120, 0.7)')
      glow.addColorStop(1, 'rgba(160, 255, 90, 0)')
      g.fillStyle = glow
      g.fillRect(x - 9, y - 9, 18, 18)
    }
  }
  // Two fireworks bursting over the corner, and sparks drifting down from them.
  const bursts = (g, w, h, rand) => {
    g.globalCompositeOperation = 'lighter'
    for (const [cx, cy, r, rgb] of [[64, 50, 42, '255, 214, 120'], [160, 30, 28, '255, 140, 200'], [236, 64, 20, '150, 220, 255']]) {
      const n = Math.round(r * 0.8)
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rand() * 0.1
        const reach = r * (0.75 + rand() * 0.25)
        const x0 = cx + Math.cos(a) * reach * 0.35
        const y0 = cy + Math.sin(a) * reach * 0.35
        const x1 = cx + Math.cos(a) * reach
        const y1 = cy + Math.sin(a) * reach + reach * 0.12
        const line = g.createLinearGradient(x0, y0, x1, y1)
        line.addColorStop(0, `rgba(${rgb}, 0)`)
        line.addColorStop(1, `rgba(${rgb}, 0.8)`)
        g.strokeStyle = line
        g.lineWidth = 0.9
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
        g.fillStyle = 'rgba(255, 250, 235, 0.9)'
        g.beginPath(); g.arc(x1, y1, 0.9, 0, Math.PI * 2); g.fill()
      }
    }
    for (let i = 0; i < 30; i++) {
      g.fillStyle = `rgba(255, 226, 160, ${(0.3 + rand() * 0.6).toFixed(2)})`
      g.fillRect(20 + rand() * 220, 60 + rand() * 60, 1, 1)
    }
    g.globalCompositeOperation = 'destination-in'
    const fade = g.createLinearGradient(w * 0.55, 0, w * 0.9, 0)
    fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = fade
    g.fillRect(0, 0, w, h)
  }
  skyRimsMade = Promise.all([
    picture(streaks('255, 226, 150')),
    picture(streaks('170, 226, 255')),
    picture(dust),
    picture(grass),
    picture(bursts),
  ]).then(([gold, blue, stars, meadowRim, fireworks]) => {
    const root = document.documentElement.style
    if (fireworks) root.setProperty('--burst-rim', `url(${fireworks})`)
    if (gold) root.setProperty('--meteor-rim-gold', `url(${gold})`)
    if (blue) root.setProperty('--meteor-rim-blue', `url(${blue})`)
    if (stars) root.setProperty('--dust-rim', `url(${stars})`)
    if (meadowRim) root.setProperty('--grass-rim', `url(${meadowRim})`)
  })
  return skyRimsMade
}

// --- the folk days: what lies over their bars ----------------------------------
const ROSE_TONES = ['214, 46, 76', '240, 120, 150', '255, 190, 205', '176, 26, 58']
export const CONFETTI = ['255, 79, 163', '255, 211, 79', '63, 214, 194', '138, 92, 255', '255, 255, 255', '110, 200, 255']

let folkRimsMade = null
export function makeFolkRims() {
  if (folkRimsMade) return folkRimsMade
  const picture = (draw) => new Promise((resolve) => {
    const w = 360
    const h = 120
    const c = document.createElement('canvas')
    c.width = w * 2
    c.height = h * 2
    const g = c.getContext('2d')
    g.scale(2, 2)
    let a = 31
    const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647 }
    draw(g, w, h, rand)
    c.toBlob((blob) => resolve(blob ? URL.createObjectURL(blob) : null))
  })
  const fadeRight = (g, w, h, from = 0.55) => {
    g.globalCompositeOperation = 'destination-in'
    const fade = g.createLinearGradient(w * from, 0, w * 0.9, 0)
    fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
    fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.fillStyle = fade
    g.fillRect(0, 0, w, h)
    g.globalCompositeOperation = 'source-over'
  }
  // St. Nicholas: walnuts, gold coins and an orange along the foot of the bar.
  const treats = (g, w, h, rand) => {
    const coin = (x, y, r) => {
      const fill = g.createLinearGradient(x - r, y - r, x + r, y + r)
      fill.addColorStop(0, '#fff0b0')
      fill.addColorStop(0.5, '#e8b64a')
      fill.addColorStop(1, '#9a6a1c')
      g.fillStyle = fill
      g.beginPath(); g.ellipse(x, y, r, r * 0.8, 0, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(120, 80, 20, 0.8)'
      g.lineWidth = 0.7
      g.beginPath(); g.ellipse(x, y, r * 0.7, r * 0.55, 0, 0, Math.PI * 2); g.stroke()
    }
    const walnut = (x, y, r) => {
      const fill = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
      fill.addColorStop(0, '#c8955e')
      fill.addColorStop(1, '#6b4523')
      g.fillStyle = fill
      g.beginPath(); g.ellipse(x, y, r, r * 0.85, 0.3, 0, Math.PI * 2); g.fill()
      g.strokeStyle = 'rgba(60, 35, 15, 0.8)'
      g.lineWidth = 0.8
      g.beginPath(); g.moveTo(x - r * 0.8, y - r * 0.2); g.quadraticCurveTo(x, y + r * 0.2, x + r * 0.8, y + r * 0.1); g.stroke()
    }
    const orange = (x, y, r) => {
      const fill = g.createRadialGradient(x - r * 0.35, y - r * 0.35, 0, x, y, r)
      fill.addColorStop(0, '#ffc266')
      fill.addColorStop(1, '#d9661a')
      g.fillStyle = fill
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
      g.fillStyle = '#4f8a3a'
      g.beginPath(); g.ellipse(x + 2, y - r, 4, 1.8, -0.5, 0, Math.PI * 2); g.fill()
    }
    orange(30, h - 16, 13)
    walnut(58, h - 9, 8)
    coin(78, h - 8, 8)
    walnut(98, h - 10, 7.5)
    coin(116, h - 7, 6.5)
    coin(62, h - 20, 6)
    walnut(140, h - 8, 7)
    coin(160, h - 7, 6)
    for (let i = 0; i < 18; i++) {
      g.fillStyle = `rgba(255, 226, 150, ${(0.3 + rand() * 0.5).toFixed(2)})`
      g.fillRect(10 + rand() * 170, h - 60 + rand() * 40, 1, 1)
    }
    fadeRight(g, w, h)
  }
  // Valentine's Day: a branch of wild roses.
  const roses = (g, w, h) => {
    const { wood, blossoms, leaves } = blossomBranch(w, h, 21)
    g.lineCap = 'round'
    for (const l of wood) {
      g.strokeStyle = '#2f4a2a'
      g.lineWidth = Math.max(0.8, l.width * 0.7)
      g.beginPath(); g.moveTo(l.x0, l.y0); g.lineTo(l.x1, l.y1); g.stroke()
    }
    for (const f of leaves) {
      g.save()
      g.translate(f.x, f.y)
      g.rotate(f.angle)
      g.fillStyle = 'rgba(70, 140, 80, 0.9)'
      g.beginPath(); g.ellipse(f.length / 2, 0, f.length / 1.6, f.length / 3.6, 0, 0, Math.PI * 2); g.fill()
      g.restore()
    }
    for (const b of blossoms) drawBloom(g, b.x, b.y, b.r * 1.35, ROSE_TONES[b.tone], b.turn, 0.25)
    g.globalCompositeOperation = 'destination-in'
    for (const fade of [g.createLinearGradient(w * 0.6, 0, w, 0), g.createLinearGradient(0, h * 0.6, 0, h)]) {
      fade.addColorStop(0, 'rgba(0, 0, 0, 1)')
      fade.addColorStop(1, 'rgba(0, 0, 0, 0)')
      g.fillStyle = fade
      g.fillRect(0, 0, w, h)
    }
  }
  // Carnival: streamers curling down from the corner, and confetti.
  const streamers = (g, w, h, rand) => {
    g.lineCap = 'round'
    for (const [x0, rgb, len] of [[14, CONFETTI[0], 110], [46, CONFETTI[2], 90], [82, CONFETTI[1], 120], [120, CONFETTI[3], 80]]) {
      g.strokeStyle = `rgba(${rgb}, 0.9)`
      g.lineWidth = 2.2
      g.beginPath()
      for (let t = 0; t <= 1; t += 0.02) {
        const y = t * len
        const x = x0 + Math.sin(t * 14 + x0) * 7 * (0.4 + t) + t * 30
        if (t === 0) g.moveTo(x, y); else g.lineTo(x, y)
      }
      g.stroke()
    }
    for (let i = 0; i < 60; i++) {
      const x = rand() * w * 0.7
      const y = rand() * h
      g.save()
      g.translate(x, y)
      g.rotate(rand() * Math.PI)
      g.fillStyle = `rgba(${CONFETTI[Math.floor(rand() * CONFETTI.length)]}, 0.9)`
      g.fillRect(-2, -3.5, 4 * (0.3 + rand() * 0.7), 7)
      g.restore()
    }
    fadeRight(g, w, h, 0.5)
  }
  folkRimsMade = Promise.all([picture(treats), picture(roses), picture(streamers)]).then(([t, r, c]) => {
    const root = document.documentElement.style
    if (t) root.setProperty('--treats-rim', `url(${t})`)
    if (r) root.setProperty('--rose-rim', `url(${r})`)
    if (c) root.setProperty('--confetti-rim', `url(${c})`)
  })
  return folkRimsMade
}

/** Every festival's pictures, made once, whichever festival is in view. */
export function makePictures() {
  return Promise.all([makeFrost(), makeWebs(), makeBlooms(), makeFirs(), makeSkyRims(), makeFolkRims()])
}

/**
 * Halloween night's own furniture: the mist along the foot of the window,
 * great webs in its top corners, and their spider going slowly up and down.
 */
export function HallowPane() {
  return (
    <>
      <div className="hallow-mist" aria-hidden="true"><i /><i /></div>
      <div className="web-pane" aria-hidden="true"><i /><i /></div>
      <div className="web-spider" aria-hidden="true"><Spider /></div>
    </>
  )
}

// --- the northern lights --------------------------------------------------
/** Curtains of light over the upper sky, drawn once, breathing slowly. */
export function Aurora() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = Math.round(window.innerHeight * 0.55)
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      const g = el.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      // Drawn sharp into a second canvas, then laid in softened.
      const raw = document.createElement('canvas')
      raw.width = w
      raw.height = h
      const r = raw.getContext('2d')
      r.globalCompositeOperation = 'lighter'
      const TAU = Math.PI * 2
      for (let x = 0; x < w; x += 2) {
        const u = x / w
        // Two ribbons, one high and far, one lower and nearer, the nearer
        // strongest over the left of the sky, away from the seal.
        for (const [lift, depth, centre, spread] of [[0.5, 0.75, 0.3, 0.3], [0.3, 0.45, 0.72, 0.22]]) {
          const envelope = Math.exp(-(((u - centre) / spread) ** 2))
          if (envelope < 0.03) continue
          const base = h * (lift + 0.1 * Math.sin(u * TAU * 0.9 + depth * 3) + 0.04 * Math.sin(u * TAU * 3.1 + 1.2))
          const ray = 0.55 + 0.45 * Math.sin(x * 0.08 + Math.sin(x * 0.011 + depth) * 5)
          const top = base - h * depth * (0.45 + 0.4 * ray)
          const strength = envelope * (0.35 + 0.65 * ray)
          const curtain = r.createLinearGradient(0, base + 4, 0, top)
          curtain.addColorStop(0, 'rgba(120, 255, 200, 0)')
          curtain.addColorStop(0.06, `rgba(130, 255, 200, ${(0.34 * strength).toFixed(3)})`)
          curtain.addColorStop(0.35, `rgba(90, 210, 215, ${(0.16 * strength).toFixed(3)})`)
          curtain.addColorStop(0.75, `rgba(130, 110, 230, ${(0.08 * strength).toFixed(3)})`)
          curtain.addColorStop(1, 'rgba(140, 100, 230, 0)')
          r.fillStyle = curtain
          r.fillRect(x, top, 2, base + 4 - top)
        }
      }
      g.filter = 'blur(3px)'
      g.drawImage(raw, 0, 0, w, h)
      g.filter = 'none'
    }
    paint()
    window.addEventListener('resize', paint)
    return () => window.removeEventListener('resize', paint)
  }, [])
  return <canvas ref={ref} className="aurora" aria-hidden="true" />
}

// --- the guiding star -------------------------------------------------------
/** One star brighter than the rest, with long rays, low in the east. */
export function GuidingStar() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const size = 220
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    el.width = size * dpr
    el.height = size * dpr
    const g = el.getContext('2d')
    g.scale(dpr, dpr)
    const c = size / 2
    const halo = g.createRadialGradient(c, c, 0, c, c, 34)
    halo.addColorStop(0, 'rgba(255, 250, 235, 0.55)')
    halo.addColorStop(0.3, 'rgba(210, 230, 255, 0.16)')
    halo.addColorStop(1, 'rgba(200, 225, 255, 0)')
    g.fillStyle = halo
    g.fillRect(0, 0, size, size)
    const ray = (angle, length, width) => {
      g.save()
      g.translate(c, c)
      g.rotate(angle)
      const fade = g.createLinearGradient(0, 0, 0, length)
      fade.addColorStop(0, 'rgba(255, 252, 240, 0.95)')
      fade.addColorStop(0.3, 'rgba(215, 235, 255, 0.4)')
      fade.addColorStop(1, 'rgba(200, 225, 255, 0)')
      g.fillStyle = fade
      g.beginPath()
      g.moveTo(-width, 0)
      g.lineTo(0, length)
      g.lineTo(width, 0)
      g.closePath()
      g.fill()
      g.restore()
    }
    // The long ray points down, toward what it is guiding to.
    ray(0, 104, 1.6)
    ray(Math.PI, 58, 1.4)
    ray(Math.PI / 2, 52, 1.3)
    ray(-Math.PI / 2, 52, 1.3)
    for (const a of [1, 3, 5, 7]) ray((a * Math.PI) / 4, 18, 0.9)
    g.fillStyle = '#fffdf5'
    g.beginPath()
    g.arc(c, c, 2.2, 0, Math.PI * 2)
    g.fill()
  }, [])
  return <canvas ref={ref} className="guiding-star" aria-hidden="true" />
}

// --- snow -------------------------------------------------------------------
/** A soft round flake, drawn once and stamped from then on. */
function softFlake(px) {
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')
  const r = px / 2
  const fill = g.createRadialGradient(r, r, 0, r, r, r)
  fill.addColorStop(0, 'rgba(255, 255, 255, 1)')
  fill.addColorStop(0.45, 'rgba(236, 246, 255, 0.85)')
  fill.addColorStop(1, 'rgba(220, 238, 255, 0)')
  g.fillStyle = fill
  g.fillRect(0, 0, px, px)
  return c
}

/** A snow crystal, six-armed and sharp, with a faint glow round it. */
export function crystalFlake(px) {
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')
  const r = px / 2
  const glow = g.createRadialGradient(r, r, 0, r, r, r)
  glow.addColorStop(0, 'rgba(220, 240, 255, 0.35)')
  glow.addColorStop(1, 'rgba(220, 240, 255, 0)')
  g.fillStyle = glow
  g.fillRect(0, 0, px, px)
  g.translate(r, r)
  g.strokeStyle = 'rgba(248, 252, 255, 0.95)'
  g.lineCap = 'round'
  g.lineWidth = Math.max(1, px / 16)
  const arm = r * 0.8
  for (let k = 0; k < 6; k++) {
    g.save()
    g.rotate((k * Math.PI) / 3)
    g.beginPath()
    g.moveTo(0, 0)
    g.lineTo(0, -arm)
    for (const [at, reach] of [[0.45, 0.24], [0.72, 0.16]]) {
      g.moveTo(0, -arm * at)
      g.lineTo(-arm * reach, -arm * (at + reach * 0.7))
      g.moveTo(0, -arm * at)
      g.lineTo(arm * reach, -arm * (at + reach * 0.7))
    }
    g.stroke()
    g.restore()
  }
  return c
}

/** Snow falling over everything, in three depths. */
export function Snowfall() {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    const soft = softFlake(24)
    const crystal = crystalFlake(48)
    let w = 0
    let h = 0
    let flakes = []

    const make = (depth, anywhere) => {
      const kind = [
        { size: [2, 3.4], fall: [16, 26], sway: 10, alpha: [0.3, 0.55], sprite: soft },
        { size: [4, 6], fall: [30, 44], sway: 18, alpha: [0.6, 0.85], sprite: soft },
        { size: [11, 16], fall: [44, 60], sway: 26, alpha: [0.75, 0.95], sprite: crystal },
      ][depth]
      const pick = ([a, b]) => a + Math.random() * (b - a)
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : -20,
        size: pick(kind.size),
        fall: pick(kind.fall),
        sway: kind.sway * (0.5 + Math.random()),
        alpha: pick(kind.alpha),
        sprite: kind.sprite,
        phase: Math.random() * Math.PI * 2,
        spin: (Math.random() - 0.5) * 0.8,
        turn: Math.random() * Math.PI,
        depth,
      }
    }
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const area = w * h
      flakes = [
        ...Array.from({ length: Math.round(area / 42000) }, () => make(0, true)),
        ...Array.from({ length: Math.round(area / 120000) }, () => make(1, true)),
        ...Array.from({ length: 7 }, () => make(2, true)),
      ]
    }
    size()
    window.addEventListener('resize', size)

    const stop = runLoop((now, dt) => {
      const t = now / 1000
      g.clearRect(0, 0, w, h)
      for (const f of flakes) {
        f.y += f.fall * dt
        f.x += (Math.sin(t * 0.7 + f.phase) * f.sway - 6) * dt
        if (f.y > h + 20) Object.assign(f, make(f.depth, false))
        if (f.x < -20) f.x += w + 40
        g.globalAlpha = f.alpha
        if (f.sprite === crystal) {
          f.turn += f.spin * dt
          g.save()
          g.translate(f.x, f.y)
          g.rotate(f.turn)
          g.drawImage(f.sprite, -f.size / 2, -f.size / 2, f.size, f.size)
          g.restore()
        } else {
          g.drawImage(f.sprite, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size)
        }
      }
      g.globalAlpha = 1
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="snowfall" aria-hidden="true" />
}

// --- Halloween night: bats and will-o'-wisps -----------------------------------
/**
 * A bat, in three beats of its wings (up, level, down), drawn once each.
 * Dark against the sky, with a thin rim of light so it shows against it.
 */
export function batFrames(px) {
  return [-0.9, 0, 0.8].map((lift) => {
    const c = document.createElement('canvas')
    c.width = px
    c.height = px
    const g = c.getContext('2d')
    const k = px / 32
    g.translate(px / 2, px / 2)
    g.scale(k, k)
    g.fillStyle = '#1c1128'
    g.strokeStyle = 'rgba(206, 170, 255, 0.7)'
    g.lineWidth = 1.1
    g.lineJoin = 'round'
    const wing = (side) => {
      const y = (v) => v * lift
      g.moveTo(side * 2.5, -1)
      g.lineTo(side * 8, -3 + y(-7))
      g.lineTo(side * 14.5, -1 + y(-10))
      g.quadraticCurveTo(side * 12.5, 1.5 + y(-6), side * 11.5, 4 + y(-5))
      g.quadraticCurveTo(side * 9.5, 2.5 + y(-3), side * 7.5, 4.5 + y(-3))
      g.quadraticCurveTo(side * 5.5, 3 + y(-1), side * 2.5, 3)
      g.closePath()
    }
    g.beginPath()
    wing(-1)
    wing(1)
    // Body, head and the two ears.
    g.moveTo(3, 1)
    g.ellipse(0, 1, 3, 4.2, 0, 0, Math.PI * 2)
    g.moveTo(-2.4, -3.2)
    g.lineTo(-2.2, -7)
    g.lineTo(-0.6, -4.6)
    g.lineTo(0.6, -4.6)
    g.lineTo(2.2, -7)
    g.lineTo(2.4, -3.2)
    g.closePath()
    g.stroke()
    g.fill()
    return c
  })
}

/** A will-o'-wisp's glow, in one of its colours. */
function wispSprite(rgb) {
  const px = 64
  const c = document.createElement('canvas')
  c.width = px
  c.height = px
  const g = c.getContext('2d')
  const r = px / 2
  const glow = g.createRadialGradient(r, r, 0, r, r, r)
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)')
  glow.addColorStop(0.12, `rgba(${rgb}, 0.95)`)
  glow.addColorStop(0.4, `rgba(${rgb}, 0.28)`)
  glow.addColorStop(1, `rgba(${rgb}, 0)`)
  g.fillStyle = glow
  g.fillRect(0, 0, px, px)
  return c
}

/**
 * Will-o'-wisps wandering about the page, each on a slow path of its own,
 * trailing a little light behind it and drifting away from the pointer when
 * it comes close; and now and then a few bats crossing the sky by the moon.
 */
export function HallowNight() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const g = el.getContext('2d')
    const tones = ['168, 255, 222', '170, 214, 255', '206, 182, 255']
    const sprites = tones.map(wispSprite)
    const bat = batFrames(48)
    let w = 0
    let h = 0
    let wisps = []
    const pointer = { x: -9999, y: -9999 }

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (wisps.length === 0) {
        wisps = Array.from({ length: 7 }, (_, i) => ({
          x: w * (0.08 + Math.random() * 0.84),
          y: h * (0.2 + Math.random() * 0.7),
          vx: 0,
          vy: 0,
          r: 9 + Math.random() * 9,
          sprite: sprites[i % sprites.length],
          a: Math.random() * 100,
          b: Math.random() * 100,
          trail: [],
        }))
      }
    }
    size()
    window.addEventListener('resize', size)
    const onMove = (e) => { pointer.x = e.clientX; pointer.y = e.clientY }
    const onLeave = () => { pointer.x = -9999; pointer.y = -9999 }
    window.addEventListener('pointermove', onMove)
    document.addEventListener('pointerleave', onLeave)

    const draw = (t) => {
      g.clearRect(0, 0, w, h)
      g.globalCompositeOperation = 'lighter'
      for (const s of wisps) {
        const flicker = 0.62 + 0.25 * Math.sin(t * 2.3 + s.a) + 0.13 * Math.sin(t * 7.1 + s.b)
        s.trail.forEach((p, i) => {
          const k = (i + 1) / (s.trail.length + 1)
          const px = s.r * 1.6 * k
          g.globalAlpha = 0.22 * k * flicker
          g.drawImage(s.sprite, p.x - px, p.y - px, px * 2, px * 2)
        })
        const px = s.r * 2
        g.globalAlpha = Math.max(0, Math.min(1, flicker))
        g.drawImage(s.sprite, s.x - px, s.y - px, px * 2, px * 2)
      }
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
    }

    // Bats cross close by the moon, from one side of the sky to the other.
    let flock = []
    let nextFlock = performance.now() + 3000 + Math.random() * 4000
    const launch = () => {
      const seal = document.querySelector('.app > .seal')
      const moonY = seal ? parseFloat(seal.style.getPropertyValue('--seal-y')) || 60 : 60
      const leftward = Math.random() < 0.5
      const count = 3 + Math.floor(Math.random() * 4)
      const speed = 190 + Math.random() * 80
      flock = Array.from({ length: count }, (_, i) => ({
        x: leftward ? w + 40 + i * (30 + Math.random() * 40) : -40 - i * (30 + Math.random() * 40),
        y: moonY + (Math.random() - 0.5) * 90,
        vx: (leftward ? -1 : 1) * speed * (0.85 + Math.random() * 0.3),
        size: 18 + Math.random() * 12,
        beat: 8 + Math.random() * 4,
        phase: Math.random() * 10,
      }))
    }

    if (stillness()) {
      draw(0)
      return () => {
        window.removeEventListener('resize', size)
        window.removeEventListener('pointermove', onMove)
        document.removeEventListener('pointerleave', onLeave)
      }
    }

    const stop = runLoop((now, dt) => {
      const t = now / 1000
      for (const s of wisps) {
        // A slow wandering of its own...
        let ax = Math.sin(t * 0.31 + s.a) * 16 + Math.sin(t * 0.73 + s.b) * 9
        let ay = Math.cos(t * 0.27 + s.b) * 12 + Math.sin(t * 0.57 + s.a) * 7
        // ...away from the pointer when it comes close...
        const dx = s.x - pointer.x
        const dy = s.y - pointer.y
        const d = Math.hypot(dx, dy)
        if (d < 170 && d > 0.1) {
          const push = ((170 - d) / 170) ** 2 * 900
          ax += (dx / d) * push
          ay += (dy / d) * push
        }
        // ...and back in off the edges.
        if (s.x < 40) ax += 60
        if (s.x > w - 40) ax -= 60
        if (s.y < 60) ay += 60
        if (s.y > h - 40) ay -= 60
        s.vx = (s.vx + ax * dt) * Math.exp(-dt * 1.1)
        s.vy = (s.vy + ay * dt) * Math.exp(-dt * 1.1)
        s.x += s.vx * dt
        s.y += s.vy * dt
        s.trail.push({ x: s.x, y: s.y })
        if (s.trail.length > 7) s.trail.shift()
      }
      draw(t)

      if (flock.length === 0 && now > nextFlock) {
        launch()
        nextFlock = now + 14000 + Math.random() * 18000
      }
      for (const b of flock) {
        b.x += b.vx * dt
        const y = b.y + Math.sin(t * 3 + b.phase) * 10
        const frame = [0, 1, 2, 1][Math.floor((t + b.phase) * b.beat) % 4]
        g.drawImage(bat[frame], b.x - b.size / 2, y - b.size / 2, b.size, b.size)
      }
      if (flock.length && flock.every((b) => b.x < -80 || b.x > w + 80)) flock = []
    })
    return () => {
      stop()
      window.removeEventListener('resize', size)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [])
  return <canvas ref={ref} className="hallow-night" aria-hidden="true" />
}

// --- Easter: dawn, petals, butterflies, the flower field and the egg hunt ----------
/** The light of dawn coming up from below the page, rays and all. */
export function Dawn() {
  return <div className="dawn" aria-hidden="true" />
}

/** A field of flowers along the foot of the window, blooming in as it opens. */
export function Meadow() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = 96
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      const g = el.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const { blades, flowers } = meadow(w, h)
      const grass = g.createLinearGradient(0, h, 0, h * 0.3)
      grass.addColorStop(0, '#0b1714')
      grass.addColorStop(0.55, '#1d4636')
      grass.addColorStop(1, 'rgba(126, 200, 160, 0.9)')
      g.fillStyle = grass
      for (const b of blades) {
        g.beginPath()
        g.moveTo(b.x - b.width / 2, h)
        g.quadraticCurveTo(b.x + b.lean * 0.3, h - b.height * 0.6, b.x + b.lean, h - b.height)
        g.quadraticCurveTo(b.x + b.lean * 0.3 + b.width * 0.3, h - b.height * 0.6, b.x + b.width / 2, h)
        g.fill()
      }
      g.lineCap = 'round'
      for (const f of flowers) {
        g.strokeStyle = 'rgba(96, 164, 124, 0.8)'
        g.lineWidth = 0.9
        g.beginPath()
        g.moveTo(f.x, h)
        g.quadraticCurveTo(f.x + f.lean * 0.2, h - f.height * 0.5, f.x + f.lean, h - f.height)
        g.stroke()
        drawBloom(g, f.x + f.lean, h - f.height, f.r, FLOWER_TONES[f.kind], f.turn, 0.4)
      }
    }
    paint()
    window.addEventListener('resize', paint)
    return () => window.removeEventListener('resize', paint)
  }, [])
  return <canvas ref={ref} className="meadow" aria-hidden="true" />
}

/** A blossom petal, drawn once and stamped, turning, from then on. */
export function petalSprite(rgb = BLOOM_TONES[0]) {
  const c = document.createElement('canvas')
  c.width = 24
  c.height = 24
  const g = c.getContext('2d')
  const fill = g.createLinearGradient(12, 2, 12, 22)
  fill.addColorStop(0, 'rgba(255, 250, 252, 0.95)')
  fill.addColorStop(1, `rgba(${rgb}, 0.95)`)
  g.fillStyle = fill
  g.beginPath()
  g.moveTo(12, 22)
  g.bezierCurveTo(3, 15, 5, 4, 10, 2.5)
  g.quadraticCurveTo(12, 4.5, 14, 2.5)
  g.bezierCurveTo(19, 4, 21, 15, 12, 22)
  g.fill()
  return c
}

/**
 * A butterfly of light, its wings opening and closing (`flap`, -1 to 1),
 * drawn straight onto the canvas: there are only ever a few of them.
 */
export function drawButterfly(g, x, y, size, flap, rgb, heading = 0) {
  const k = size / 20
  const open = 0.18 + 0.82 * Math.abs(flap)
  g.save()
  g.translate(x, y)
  g.rotate(heading)
  g.scale(k, k)
  for (const side of [-1, 1]) {
    g.save()
    g.scale(side * open, 1)
    const fill = g.createRadialGradient(1, 0, 0, 5, 0, 9)
    fill.addColorStop(0, 'rgba(255, 255, 255, 0.95)')
    fill.addColorStop(0.35, `rgba(${rgb}, 0.85)`)
    fill.addColorStop(1, `rgba(${rgb}, 0.15)`)
    g.fillStyle = fill
    g.beginPath()
    g.ellipse(6, -3.4, 6.2, 5, -0.5, 0, Math.PI * 2)
    g.fill()
    g.beginPath()
    g.ellipse(4.6, 4, 4.2, 3.6, 0.55, 0, Math.PI * 2)
    g.fill()
    g.restore()
  }
  g.fillStyle = 'rgba(255, 250, 240, 0.9)'
  g.beginPath()
  g.ellipse(0, 0.6, 0.9, 5, 0, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

export const BUTTERFLY_TONES = ['255, 190, 222', '180, 212, 255', '200, 255, 214', '255, 232, 160', '224, 196, 255']

/**
 * Easter's sky: petals drifting down across the page, turning over as they
 * fall, and a few butterflies of light wandering about it.
 */
export function SpringDay() {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    const sprites = BLOOM_TONES.map(petalSprite)
    let w = 0
    let h = 0
    let petals = []
    let flies = []
    const make = (anywhere) => ({
      x: Math.random() * (w + 200),
      y: anywhere ? Math.random() * h : -20,
      size: 7 + Math.random() * 7,
      fall: 22 + Math.random() * 26,
      drift: -(14 + Math.random() * 20),
      sway: 12 + Math.random() * 18,
      turn: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 2.4,
      flip: Math.random() * Math.PI * 2,
      flipRate: 1.5 + Math.random() * 2.5,
      phase: Math.random() * 10,
      sprite: sprites[Math.floor(Math.random() * sprites.length)],
      alpha: 0.55 + Math.random() * 0.4,
    })
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      petals = Array.from({ length: Math.round((w * h) / 70000) }, () => make(true))
      if (flies.length === 0) {
        flies = Array.from({ length: 4 }, (_, i) => ({
          x: w * (0.15 + Math.random() * 0.7),
          y: h * (0.25 + Math.random() * 0.6),
          vx: 0,
          vy: 0,
          a: Math.random() * 100,
          b: Math.random() * 100,
          beat: 7 + Math.random() * 4,
          size: 16 + Math.random() * 8,
          tone: BUTTERFLY_TONES[i % BUTTERFLY_TONES.length],
        }))
      }
    }
    size()
    window.addEventListener('resize', size)

    const stop = runLoop((now, dt) => {
      const t = now / 1000
      g.clearRect(0, 0, w, h)
      for (const p of petals) {
        p.y += p.fall * dt
        p.x += (p.drift + Math.sin(t * 0.9 + p.phase) * p.sway) * dt
        p.turn += p.spin * dt
        p.flip += p.flipRate * dt
        if (p.y > h + 20 || p.x < -30) Object.assign(p, make(false))
        g.save()
        g.globalAlpha = p.alpha
        g.translate(p.x, p.y)
        g.rotate(p.turn)
        g.scale(Math.cos(p.flip), 1)
        g.drawImage(p.sprite, -p.size / 2, -p.size / 2, p.size, p.size)
        g.restore()
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'lighter'
      for (const f of flies) {
        // Wandering, with the fits and starts a butterfly flies in.
        const ax = Math.sin(t * 0.43 + f.a) * 40 + Math.sin(t * 1.7 + f.b) * 30
        let ay = Math.cos(t * 0.37 + f.b) * 30 + Math.sin(t * 2.3 + f.a) * 26
        let bx = 0
        if (f.x < 60) bx = 60
        if (f.x > w - 60) bx = -60
        if (f.y < 90) ay += 60
        if (f.y > h - 70) ay -= 60
        f.vx = (f.vx + (ax + bx) * dt) * Math.exp(-dt * 0.8)
        f.vy = (f.vy + ay * dt) * Math.exp(-dt * 0.8)
        f.x += f.vx * dt
        f.y += f.vy * dt
        drawButterfly(g, f.x, f.y, f.size, Math.sin((t + f.a) * f.beat), f.tone, Math.max(-0.5, Math.min(0.5, f.vx / 120)))
      }
      g.globalCompositeOperation = 'source-over'
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="spring-day" aria-hidden="true" />
}

export const EGGS = 5

/**
 * Five eggs hidden about the page: leaning on the moon, in the open sky of
 * the header either side of it, tucked against the left edge of the page,
 * and down in the flower field. Each one found is gone, and remembered for
 * the day; `onFound(x, y, found, of)` is told where, and how many so far.
 */
export function EggHunt({ day, onFound }) {
  const key = `daily-documenter:eggs:${day}`
  const [found, setFound] = useState(() => {
    try { return JSON.parse(localStorage.getItem(key) || '[]') } catch { return [] }
  })
  const [spots, setSpots] = useState([])
  useEffect(() => {
    const place = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      const left = document.querySelector('.viewswitch')?.getBoundingClientRect()
      const right = document.querySelector('.nav.today')?.getBoundingClientRect()
      const moon = document.querySelector('.seal-moon')?.getBoundingClientRect()
      const from = left?.right ?? w * 0.3
      const to = right?.left ?? w * 0.8
      const mid = left ? left.top + left.height / 2 : 50
      setSpots([
        moon ? { x: moon.right - 8, y: moon.bottom - 14, turn: 22 } : { x: w * 0.6, y: 60, turn: 22 },
        { x: from + (to - from) * 0.16, y: mid + 4, turn: -14 },
        { x: from + (to - from) * 0.86, y: mid - 18, turn: 9 },
        { x: 2, y: h * 0.57, turn: -26 },
        { x: w * 0.71, y: h - 28, turn: 6 },
      ])
    }
    place()
    const settle = () => requestAnimationFrame(() => requestAnimationFrame(place))
    const later = setTimeout(place, 800)
    window.addEventListener('resize', settle)
    return () => { clearTimeout(later); window.removeEventListener('resize', settle) }
  }, [])
  const find = (i, e) => {
    if (found.includes(i)) return
    const next = [...found, i]
    setFound(next)
    try { localStorage.setItem(key, JSON.stringify(next)) } catch { /* only remembered until closed */ }
    const r = e.currentTarget.getBoundingClientRect()
    onFound?.(r.left + r.width / 2, r.top + r.height / 2, next.length, EGGS)
  }
  return (
    <div className="egg-hunt">
      {spots.map((s, i) => (found.includes(i) ? null : (
        <button
          key={i}
          type="button"
          className="hidden-egg"
          aria-label="A hidden egg"
          style={{ left: `${s.x}px`, top: `${s.y}px`, transform: `rotate(${s.turn}deg)` }}
          onClick={(e) => find(i, e)}
        >
          <Egg tone={i} />
        </button>
      )))}
    </div>
  )
}

// --- the Sundays of Advent: the great wreath, the boughs, the embers ---------------
// Where the wreath's candles stand on its ring, as angles round it seen from
// a little above: front left, back left, back right, front right.
const RING_CANDLES = [165, 240, 300, 15]

/**
 * The great Advent wreath, set under the moon at the heart of the seal: a
 * ring of fir seen from a little above, berries and a red bow in it, and
 * four candles standing on it, `lit` of them burning.
 */
export function AdventWreath({ lit = 1 }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const paint = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (!w || !h) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      const g = el.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      const cx = w / 2
      const cy = h * 0.62
      const rx = w * 0.42
      const ry = h * 0.16
      const k = w / 200
      let a = 7
      const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647 }
      g.lineCap = 'round'
      // The ring: needles all round it, back half first so the front lies over it.
      for (const half of [0, 1]) {
        for (let i = 0; i < 360; i++) {
          const t = (half === 0 ? Math.PI : 0) + (i / 360) * Math.PI
          const x = cx + Math.cos(t) * rx
          const y = cy + Math.sin(t) * ry
          for (let n = 0; n < 3; n++) {
            const d = rand() * Math.PI * 2
            const len = (5 + rand() * 6) * k
            g.strokeStyle = NEEDLE_GREENS[Math.floor(rand() * 3)]
            g.lineWidth = 1.2 * k
            g.beginPath()
            g.moveTo(x, y)
            g.lineTo(x + Math.cos(d) * len, y + Math.sin(d) * len * 0.5)
            g.stroke()
          }
        }
      }
      for (let i = 0; i < 16; i++) {
        const t = rand() * Math.PI * 2
        const x = cx + Math.cos(t) * rx
        const y = cy + Math.sin(t) * ry + 2 * k
        for (let b = 0; b < 3; b++) {
          const bx = x + (rand() - 0.5) * 7 * k
          const by = y + (rand() - 0.5) * 4 * k
          const r = (1.6 + rand() * 0.8) * k
          const fill = g.createRadialGradient(bx - r * 0.35, by - r * 0.35, 0, bx, by, r)
          fill.addColorStop(0, '#ff9a9a')
          fill.addColorStop(0.35, '#d8313f')
          fill.addColorStop(1, '#7a0f1c')
          g.fillStyle = fill
          g.beginPath(); g.arc(bx, by, r, 0, Math.PI * 2); g.fill()
        }
      }
      g.save()
      g.translate(cx, cy + ry + 2 * k)
      g.scale(k * 0.8, k * 0.8)
      drawBow(g, 0, 0)
      g.restore()
    }
    paint()
    const watch = new ResizeObserver(paint)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])
  return (
    <div className="advent-wreath" aria-hidden="true">
      <canvas ref={ref} />
      {RING_CANDLES.map((deg, i) => {
        const t = (deg * Math.PI) / 180
        return (
          <span
            key={deg}
            className={`candle${Math.sin(t) < 0 ? ' back' : ''}`}
            style={{ left: `${50 + Math.cos(t) * 42}%`, top: `${62 + Math.sin(t) * 16}%` }}
          >
            {i < lit ? <i className="flame" style={{ animationDelay: `${-i * 0.7}s` }} /> : <i className="wick" />}
          </span>
        )
      })}
    </div>
  )
}

// Where the baubles hang along the top of the window, in the open sky either
// side of the moon, and how far down each one's thread lets it.
const BAUBLES = [
  { left: '31%', drop: 58, tone: 'red' },
  { left: '40%', drop: 30, tone: 'gold' },
  { left: '70%', drop: 44, tone: 'green' },
  { left: '78.5%', drop: 70, tone: 'red' },
]

/** Glass baubles hanging from sprigs of fir along the top of the window. */
export function AdventPane() {
  return (
    <div className="advent-pane" aria-hidden="true">
      {BAUBLES.map((b) => (
        <span key={b.left} className="ornament" style={{ left: b.left }}>
          <i className="sprig" />
          <span className={`bauble ${b.tone}`} style={{ '--drop': `${b.drop}px` }} />
        </span>
      ))}
    </div>
  )
}

/** A warm glow, for an ember. */
function emberSprite() {
  const c = document.createElement('canvas')
  c.width = 24
  c.height = 24
  const g = c.getContext('2d')
  const fill = g.createRadialGradient(12, 12, 0, 12, 12, 12)
  fill.addColorStop(0, 'rgba(255, 246, 220, 1)')
  fill.addColorStop(0.25, 'rgba(255, 196, 110, 0.85)')
  fill.addColorStop(1, 'rgba(255, 140, 60, 0)')
  g.fillStyle = fill
  g.fillRect(0, 0, 24, 24)
  return c
}

/** A little five-pointed star, gold unless told otherwise. */
export function starSprite(fill = '#ffe29a', halo = '255, 220, 140') {
  const c = document.createElement('canvas')
  c.width = 24
  c.height = 24
  const g = c.getContext('2d')
  const glow = g.createRadialGradient(12, 12, 0, 12, 12, 12)
  glow.addColorStop(0, `rgba(${halo}, 0.5)`)
  glow.addColorStop(1, `rgba(${halo}, 0)`)
  g.fillStyle = glow
  g.fillRect(0, 0, 24, 24)
  g.fillStyle = fill
  g.beginPath()
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 7 : 3
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    g[i ? 'lineTo' : 'moveTo'](12 + Math.cos(a) * r, 12 + Math.sin(a) * r)
  }
  g.closePath()
  g.fill()
  return c
}

/** Embers drifting slowly up the page, as off a room full of candles. */
export function AdventNight() {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    const sprite = emberSprite()
    let w = 0
    let h = 0
    let embers = []
    const make = (anywhere) => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      rise: 10 + Math.random() * 22,
      sway: 8 + Math.random() * 14,
      phase: Math.random() * 10,
      size: 5 + Math.random() * 7,
      life: 0,
      span: 8 + Math.random() * 10,
    })
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      embers = Array.from({ length: Math.round((w * h) / 90000) }, () => {
        const e = make(true)
        e.life = Math.random() * e.span
        return e
      })
    }
    size()
    window.addEventListener('resize', size)
    const stop = runLoop((now, dt) => {
      const t = now / 1000
      g.clearRect(0, 0, w, h)
      g.globalCompositeOperation = 'lighter'
      for (const e of embers) {
        e.life += dt
        e.y -= e.rise * dt
        e.x += Math.sin(t * 0.8 + e.phase) * e.sway * dt
        if (e.life > e.span || e.y < -20) Object.assign(e, make(false))
        const k = e.life / e.span
        g.globalAlpha = Math.sin(Math.PI * k) * (0.55 + 0.35 * Math.sin(t * 5 + e.phase))
        g.drawImage(sprite, e.x - e.size / 2, e.y - e.size / 2, e.size, e.size)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="advent-night" aria-hidden="true" />
}

// --- falling stars, the Milky Way, fireflies --------------------------------------
/**
 * A meteor shower. Every falling star comes away from the one point in the
 * sky the shower is named for (`radiant`, as fractions of the window), the
 * way real ones do; now and then one is a fireball, bigger and slower, that
 * leaves a faint trail hanging after it.
 */
export function MeteorShower({ radiant = [0.15, 0.03], speed = [900, 1500], tones = ['255, 240, 200'] }) {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    let w = 0
    let h = 0
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)
    const meteors = []
    const trails = []
    const spawn = () => {
      const x = Math.random() * w
      const y = h * (0.04 + Math.random() * 0.7)
      const dx = x - radiant[0] * w
      const dy = y - radiant[1] * h
      const d = Math.hypot(dx, dy) || 1
      const fireball = Math.random() < 0.08
      const v = (speed[0] + Math.random() * (speed[1] - speed[0])) * (fireball ? 0.7 : 1)
      meteors.push({
        x, y, ux: dx / d, uy: dy / d, v, age: 0,
        life: fireball ? 1 + Math.random() * 0.4 : 0.3 + Math.random() * 0.5,
        length: fireball ? 260 + Math.random() * 140 : 80 + Math.random() * 150,
        width: fireball ? 2.6 : 1.1 + Math.random() * 0.9,
        tone: tones[Math.floor(Math.random() * tones.length)],
        fireball,
      })
    }
    let next = performance.now() + 800
    const stop = runLoop((now, dt) => {
      if (now > next) {
        spawn()
        if (Math.random() < 0.18) spawn()
        next = now + 300 + Math.random() * 1100
      }
      g.clearRect(0, 0, w, h)
      g.globalCompositeOperation = 'lighter'
      g.lineCap = 'round'
      for (let i = trails.length - 1; i >= 0; i--) {
        const t = trails[i]
        t.age += dt
        if (t.age > t.life) { trails.splice(i, 1); continue }
        g.strokeStyle = `rgba(${t.tone}, ${(0.16 * (1 - t.age / t.life)).toFixed(3)})`
        g.lineWidth = 2 + t.age * 2
        g.beginPath(); g.moveTo(t.x0, t.y0); g.lineTo(t.x1, t.y1); g.stroke()
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        m.age += dt
        const k = m.age / m.life
        const hx = m.x + m.ux * m.v * m.age
        const hy = m.y + m.uy * m.v * m.age
        const reach = m.length * Math.min(1, k * 3)
        const tx = hx - m.ux * reach
        const ty = hy - m.uy * reach
        if (k >= 1) {
          if (m.fireball) trails.push({ x0: tx, y0: ty, x1: hx, y1: hy, age: 0, life: 1.8, tone: m.tone })
          meteors.splice(i, 1)
          continue
        }
        const fade = Math.sin(Math.PI * k) ** 0.7
        const line = g.createLinearGradient(hx, hy, tx, ty)
        line.addColorStop(0, `rgba(255, 255, 250, ${fade.toFixed(3)})`)
        line.addColorStop(0.2, `rgba(${m.tone}, ${(0.7 * fade).toFixed(3)})`)
        line.addColorStop(1, `rgba(${m.tone}, 0)`)
        g.strokeStyle = line
        g.lineWidth = m.width
        g.beginPath(); g.moveTo(hx, hy); g.lineTo(tx, ty); g.stroke()
        const r = m.width * (m.fireball ? 4 : 2.5)
        const head = g.createRadialGradient(hx, hy, 0, hx, hy, r)
        head.addColorStop(0, `rgba(255, 255, 250, ${fade.toFixed(3)})`)
        head.addColorStop(1, `rgba(${m.tone}, 0)`)
        g.fillStyle = head
        g.fillRect(hx - r, hy - r, r * 2, r * 2)
      }
      g.globalCompositeOperation = 'source-over'
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="meteor-shower" aria-hidden="true" />
}

/**
 * The Milky Way, across the sky from the lower left to the upper right: a
 * soft river of light, dark lanes of dust down it, and thousands of small
 * stars gathered along it. Drawn once.
 */
export function MilkyWay() {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const paint = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = window.innerWidth
      const h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      const g = el.getContext('2d')
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.clearRect(0, 0, w, h)
      let a = 29
      const rand = () => { a = (a * 16807) % 2147483647; return a / 2147483647 }
      const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5
      const along = (t, off) => {
        // The band's middle line, gently bowed, and a point off it.
        const x = t * w
        const y = h * (0.88 - t * 0.8) + Math.sin(t * Math.PI) * h * 0.06
        const nx = 0.8 * h
        const ny = w
        const n = Math.hypot(nx, ny)
        return [x + (nx / n) * off, y + (ny / n) * off]
      }
      const width = Math.min(w, h) * 0.2
      g.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 260; i++) {
        const t = rand()
        const [x, y] = along(t, gauss() * width * 0.8)
        const r = width * (0.25 + rand() * 0.5)
        const warm = Math.abs(t - 0.45) < 0.2 && rand() < 0.5
        const glow = g.createRadialGradient(x, y, 0, x, y, r)
        glow.addColorStop(0, warm ? 'rgba(255, 226, 200, 0.05)' : 'rgba(170, 180, 255, 0.045)')
        glow.addColorStop(1, 'rgba(170, 180, 255, 0)')
        g.fillStyle = glow
        g.fillRect(x - r, y - r, r * 2, r * 2)
      }
      g.globalCompositeOperation = 'destination-out'
      for (let i = 0; i < 70; i++) {
        const t = rand()
        const [x, y] = along(t, gauss() * width * 0.25)
        const r = width * (0.08 + rand() * 0.18)
        const dust = g.createRadialGradient(x, y, 0, x, y, r)
        dust.addColorStop(0, 'rgba(0, 0, 0, 0.35)')
        dust.addColorStop(1, 'rgba(0, 0, 0, 0)')
        g.fillStyle = dust
        g.fillRect(x - r, y - r, r * 2, r * 2)
      }
      g.globalCompositeOperation = 'lighter'
      for (let i = 0; i < 2200; i++) {
        const t = rand()
        const [x, y] = along(t, gauss() * width)
        const r = rand() < 0.03 ? 0.9 : 0.25 + rand() * 0.45
        g.fillStyle = `rgba(${rand() < 0.25 ? '255, 236, 210' : '222, 228, 255'}, ${(0.25 + rand() * 0.65).toFixed(2)})`
        g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
      }
    }
    paint()
    window.addEventListener('resize', paint)
    return () => window.removeEventListener('resize', paint)
  }, [])
  return <canvas ref={ref} className="milky-way" aria-hidden="true" />
}

/** A firefly's glow, drawn once and stamped. */
export function fireflySprite() {
  const c = document.createElement('canvas')
  c.width = 32
  c.height = 32
  const g = c.getContext('2d')
  const glow = g.createRadialGradient(16, 16, 0, 16, 16, 16)
  glow.addColorStop(0, 'rgba(250, 255, 210, 1)')
  glow.addColorStop(0.15, 'rgba(214, 255, 120, 0.9)')
  glow.addColorStop(0.45, 'rgba(170, 255, 90, 0.25)')
  glow.addColorStop(1, 'rgba(150, 255, 80, 0)')
  g.fillStyle = glow
  g.fillRect(0, 0, 32, 32)
  return c
}

/**
 * Fireflies about the lower part of the page, drifting slowly and lighting
 * up in their own time, and drawn a little toward the pointer when it
 * comes near.
 */
export function Fireflies() {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    const sprite = fireflySprite()
    let w = 0
    let h = 0
    let flies = []
    const pointer = { x: -9999, y: -9999 }
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (flies.length === 0) {
        flies = Array.from({ length: 26 }, () => ({
          x: Math.random() * w,
          y: h * (0.35 + Math.random() * 0.62),
          vx: 0,
          vy: 0,
          a: Math.random() * 100,
          b: Math.random() * 100,
          period: 2.2 + Math.random() * 3.4,
          size: 12 + Math.random() * 10,
        }))
      }
    }
    size()
    window.addEventListener('resize', size)
    const onMove = (e) => { pointer.x = e.clientX; pointer.y = e.clientY }
    window.addEventListener('pointermove', onMove)
    const stop = runLoop((now, dt) => {
      const t = now / 1000
      g.clearRect(0, 0, w, h)
      g.globalCompositeOperation = 'lighter'
      for (const f of flies) {
        let ax = Math.sin(t * 0.23 + f.a) * 9 + Math.sin(t * 0.61 + f.b) * 5
        let ay = Math.cos(t * 0.19 + f.b) * 7 + Math.sin(t * 0.47 + f.a) * 4
        const dx = pointer.x - f.x
        const dy = pointer.y - f.y
        const d = Math.hypot(dx, dy)
        if (d < 260 && d > 30) {
          ax += (dx / d) * 14
          ay += (dy / d) * 14
        }
        if (f.y < h * 0.3) ay += 12
        if (f.y > h - 10) ay -= 12
        if (f.x < 10) ax += 12
        if (f.x > w - 10) ax -= 12
        f.vx = (f.vx + ax * dt) * Math.exp(-dt * 0.7)
        f.vy = (f.vy + ay * dt) * Math.exp(-dt * 0.7)
        f.x += f.vx * dt
        f.y += f.vy * dt
        // A firefly's light: a slow swell and fade, then dark for a while.
        const phase = ((t + f.a) % f.period) / f.period
        const light = phase < 0.35 ? Math.sin((phase / 0.35) * Math.PI) : 0
        if (light < 0.02) continue
        g.globalAlpha = light
        g.drawImage(sprite, f.x - f.size / 2, f.y - f.size / 2, f.size, f.size)
      }
      g.globalAlpha = 1
      g.globalCompositeOperation = 'source-over'
    })
    return () => { stop(); window.removeEventListener('resize', size); window.removeEventListener('pointermove', onMove) }
  }, [])
  return <canvas ref={ref} className="fireflies" aria-hidden="true" />
}

// --- the turn of the year --------------------------------------------------------
const FIREWORK_TONES = ['255, 214, 120', '255, 140, 200', '150, 220, 255', '170, 255, 170', '255, 255, 240', '210, 170, 255']

/**
 * Fireworks: rockets going up from the foot of the page and bursting — some
 * in a round of stars, some in a ring like a magic circle, some in a
 * weeping willow of gold, some breaking again into smaller bursts.
 */
export function Fireworks({ festival }) {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    let w = 0
    let h = 0
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    size()
    window.addEventListener('resize', size)
    const rockets = []
    const sparks = []
    const flashes = []
    const GRAVITY = 300
    const pick = (list) => list[Math.floor(Math.random() * list.length)]
    const launch = () => {
      const x = w * (0.08 + Math.random() * 0.84)
      const top = h * (0.1 + Math.random() * 0.35)
      const y = h + 10
      rockets.push({
        x, y, vx: (Math.random() - 0.5) * 40, vy: -Math.sqrt(2 * GRAVITY * (y - top)),
        tone: pick(FIREWORK_TONES), kind: pick(['peony', 'peony', 'ring', 'willow', 'crossette']),
      })
    }
    const spark = (x, y, a, speed, tone, extra = {}) => sparks.push({
      x, y, px: x, py: y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
      age: 0, life: 1.1 + Math.random() * 0.7, tone, drag: 1.3, size: 1.4, ...extra,
    })
    const burst = (x, y, tone, kind) => {
      flashes.push({ x, y, age: 0, tone })
      if (kind === 'ring') {
        for (let i = 0; i < 40; i++) spark(x, y, (i / 40) * Math.PI * 2, 190, tone, { life: 1.3 })
        for (let i = 0; i < 14; i++) spark(x, y, (i / 14) * Math.PI * 2 + 0.2, 90, '255, 250, 235', { life: 1.1 })
      } else if (kind === 'willow') {
        for (let i = 0; i < 56; i++) spark(x, y, Math.random() * Math.PI * 2, 60 + Math.random() * 120, '255, 206, 120', { life: 2.6 + Math.random() * 0.8, drag: 2.2, size: 1.2 })
      } else if (kind === 'crossette') {
        for (let i = 0; i < 8; i++) spark(x, y, (i / 8) * Math.PI * 2, 150, tone, { life: 0.55, split: true, size: 1.8 })
      } else {
        for (let i = 0; i < 64; i++) spark(x, y, Math.random() * Math.PI * 2, 60 + Math.random() * 170, tone)
      }
    }
    let next = performance.now() + 600
    const stop = runLoop((now, dt) => {
      const every = fireworksEvery(festival, new Date())
      if (every != null && now > next) {
        launch()
        next = now + every * 1000 * (0.5 + Math.random())
      }
      g.clearRect(0, 0, w, h)
      g.globalCompositeOperation = 'lighter'
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i]
        f.age += dt
        if (f.age > 0.25) { flashes.splice(i, 1); continue }
        const r = 70
        const glow = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, r)
        glow.addColorStop(0, `rgba(${f.tone}, ${(0.35 * (1 - f.age / 0.25)).toFixed(3)})`)
        glow.addColorStop(1, `rgba(${f.tone}, 0)`)
        g.fillStyle = glow
        g.fillRect(f.x - r, f.y - r, r * 2, r * 2)
      }
      g.lineCap = 'round'
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        const px = r.x
        const py = r.y
        r.vy += GRAVITY * dt
        r.x += r.vx * dt
        r.y += r.vy * dt
        g.strokeStyle = 'rgba(255, 226, 170, 0.8)'
        g.lineWidth = 1.6
        g.beginPath(); g.moveTo(px, py + 14); g.lineTo(r.x, r.y); g.stroke()
        if (r.vy > -30) {
          burst(r.x, r.y, r.tone, r.kind)
          rockets.splice(i, 1)
        }
      }
      // Sparks are drawn in batches of one colour, strength and width: at
      // midnight there are hundreds of them, and a stroke each was a third
      // of a processor.
      const batches = new Map()
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        p.age += dt
        if (p.age > p.life) {
          if (p.split) for (let k = 0; k < 4; k++) spark(p.x, p.y, (k / 4) * Math.PI * 2 + 0.4, 80, '255, 250, 235', { life: 0.7, size: 1.1 })
          sparks.splice(i, 1)
          continue
        }
        p.px = p.x
        p.py = p.y
        const drag = Math.exp(-dt * p.drag)
        p.vx *= drag
        p.vy = p.vy * drag + 70 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        const k = p.age / p.life
        let alpha = (1 - k) ** 1.3
        if (k > 0.7) alpha *= 0.5 + 0.5 * Math.random()
        const key = `${p.tone}|${Math.ceil(alpha * 6) / 6}|${p.size}`
        if (!batches.has(key)) batches.set(key, [])
        batches.get(key).push(p)
      }
      for (const [key, list] of batches) {
        const [tone, alpha, width] = key.split('|')
        g.strokeStyle = `rgba(${tone}, ${Number(alpha).toFixed(3)})`
        g.lineWidth = Number(width)
        g.beginPath()
        for (const p of list) { g.moveTo(p.px - (p.x - p.px) * 2, p.py - (p.y - p.py) * 2); g.lineTo(p.x, p.y) }
        g.stroke()
      }
      g.globalCompositeOperation = 'source-over'
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [festival])
  return <canvas ref={ref} className="fireworks" aria-hidden="true" />
}

/** The last ten seconds of the year, counted down across the sky. */
export function Countdown() {
  const [left, setLeft] = useState(null)
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const s = Math.ceil(24 * 3600 - (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds() + now.getMilliseconds() / 1000))
      setLeft(s <= 10 && s > 0 ? s : null)
    }
    tick()
    const timer = setInterval(tick, 200)
    return () => clearInterval(timer)
  }, [])
  if (left == null) return null
  return <div className="countdown" aria-live="polite"><span key={left}>{left}</span></div>
}

/**
 * New Year's Day: the grimoire turns to a fresh page as the app opens, and
 * in the first minutes of the year the year itself is written across the sky.
 */
export function NewYearPage() {
  const [early] = useState(() => minuteOfDay(new Date()) < 3)
  return (
    <>
      <div className="page-turn" aria-hidden="true" />
      {early && <div className="year-mark" aria-hidden="true"><span>{new Date().getFullYear()}</span></div>}
    </>
  )
}

// --- the folk days: boots, lanterns, confetti -----------------------------------
/** The boots put out for St. Nicholas, standing at the foot of the window. */
export function BootsRow() {
  return (
    <div className="boots-row" aria-hidden="true">
      {['left', 'left', 'right', 'right'].map((side, i) => <Boot key={i} className={`standing ${side}`} />)}
    </div>
  )
}

/** A gold chocolate coin, turning as it falls. */
export function coinSprite() {
  const c = document.createElement('canvas')
  c.width = 24
  c.height = 24
  const g = c.getContext('2d')
  const fill = g.createLinearGradient(4, 4, 20, 20)
  fill.addColorStop(0, '#fff3b8')
  fill.addColorStop(0.5, '#e8b64a')
  fill.addColorStop(1, '#8a5a14')
  g.fillStyle = fill
  g.beginPath(); g.arc(12, 12, 9, 0, Math.PI * 2); g.fill()
  g.strokeStyle = 'rgba(110, 70, 15, 0.8)'
  g.lineWidth = 1.2
  g.beginPath(); g.arc(12, 12, 6.5, 0, Math.PI * 2); g.stroke()
  return c
}

/** A little heart, glowing. */
export function heartSprite() {
  const c = document.createElement('canvas')
  c.width = 24
  c.height = 24
  const g = c.getContext('2d')
  const halo = g.createRadialGradient(12, 12, 0, 12, 12, 12)
  halo.addColorStop(0, 'rgba(255, 150, 180, 0.5)')
  halo.addColorStop(1, 'rgba(255, 150, 180, 0)')
  g.fillStyle = halo
  g.fillRect(0, 0, 24, 24)
  g.fillStyle = '#ff8fae'
  g.beginPath()
  g.moveTo(12, 18)
  g.bezierCurveTo(4, 12.5, 5.5, 5.5, 12, 8.6)
  g.bezierCurveTo(18.5, 5.5, 20, 12.5, 12, 18)
  g.fill()
  return c
}

/** Sky lanterns rising slowly up the window, drifting, their flames flickering. */
export function SkyLanterns() {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    let w = 0
    let h = 0
    let lanterns = []
    const make = (anywhere) => {
      const depth = Math.random()
      return {
        x: Math.random() * w,
        y: anywhere ? h * (0.2 + Math.random() * 0.9) : h + 40,
        rise: 8 + depth * 16,
        sway: 6 + Math.random() * 10,
        phase: Math.random() * 10,
        size: 10 + depth * 16,
        glow: 0.5 + depth * 0.5,
      }
    }
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      lanterns = Array.from({ length: 14 }, () => make(true))
    }
    size()
    window.addEventListener('resize', size)
    const stop = runLoop((now, dt) => {
      const t = now / 1000
      g.clearRect(0, 0, w, h)
      for (const l of lanterns) {
        l.y -= l.rise * dt
        l.x += Math.sin(t * 0.3 + l.phase) * l.sway * dt
        if (l.y < -60) Object.assign(l, make(false))
        // Fading out as they climb away.
        const fade = Math.min(1, Math.max(0, l.y / (h * 0.25)))
        const flicker = 0.85 + 0.15 * Math.sin(t * 7 + l.phase)
        const s = l.size
        g.globalAlpha = fade * l.glow
        g.globalCompositeOperation = 'lighter'
        const halo = g.createRadialGradient(l.x, l.y, 0, l.x, l.y, s * 2.4)
        halo.addColorStop(0, `rgba(255, 170, 90, ${(0.4 * flicker).toFixed(3)})`)
        halo.addColorStop(1, 'rgba(255, 140, 70, 0)')
        g.fillStyle = halo
        g.fillRect(l.x - s * 2.4, l.y - s * 2.4, s * 4.8, s * 4.8)
        g.globalCompositeOperation = 'source-over'
        const body = g.createLinearGradient(l.x, l.y - s * 0.6, l.x, l.y + s * 0.6)
        body.addColorStop(0, '#ffcf8a')
        body.addColorStop(1, `rgba(255, ${Math.round(120 + 40 * flicker)}, 60, 1)`)
        g.fillStyle = body
        g.beginPath()
        g.moveTo(l.x - s * 0.42, l.y - s * 0.6)
        g.lineTo(l.x + s * 0.42, l.y - s * 0.6)
        g.lineTo(l.x + s * 0.3, l.y + s * 0.55)
        g.lineTo(l.x - s * 0.3, l.y + s * 0.55)
        g.closePath()
        g.fill()
        g.fillStyle = `rgba(255, 250, 220, ${(0.9 * flicker).toFixed(3)})`
        g.beginPath(); g.ellipse(l.x, l.y + s * 0.5, s * 0.22, s * 0.08, 0, 0, Math.PI * 2); g.fill()
      }
      g.globalAlpha = 1
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="sky-lanterns" aria-hidden="true" />
}

/** Confetti tumbling down the page, turning over as it falls. */
export function ConfettiFall() {
  const ref = useRef(null)
  useEffect(() => {
    if (stillness()) return undefined
    const el = ref.current
    const g = el.getContext('2d')
    let w = 0
    let h = 0
    let bits = []
    const make = (anywhere) => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -10,
      fall: 30 + Math.random() * 40,
      sway: 14 + Math.random() * 20,
      phase: Math.random() * 10,
      turn: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 4,
      flip: Math.random() * Math.PI,
      flipRate: 3 + Math.random() * 5,
      w: 3 + Math.random() * 3,
      h: 6 + Math.random() * 4,
      colour: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    })
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      bits = Array.from({ length: Math.round((w * h) / 45000) }, () => make(true))
    }
    size()
    window.addEventListener('resize', size)
    const stop = runLoop((now, dt) => {
      const t = now / 1000
      g.clearRect(0, 0, w, h)
      for (const b of bits) {
        b.y += b.fall * dt
        b.x += Math.sin(t * 1.3 + b.phase) * b.sway * dt
        b.turn += b.spin * dt
        b.flip += b.flipRate * dt
        if (b.y > h + 12) Object.assign(b, make(false))
        g.save()
        g.translate(b.x, b.y)
        g.rotate(b.turn)
        g.scale(Math.cos(b.flip), 1)
        g.fillStyle = `rgba(${b.colour}, 0.85)`
        g.fillRect(-b.w / 2, -b.h / 2, b.w, b.h)
        g.restore()
      }
    })
    return () => { stop(); window.removeEventListener('resize', size) }
  }, [])
  return <canvas ref={ref} className="confetti-fall" aria-hidden="true" />
}
