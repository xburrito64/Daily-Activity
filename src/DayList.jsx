import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  SLOTS_PER_DAY, MINUTES_PER_DAY, slotToTime, formatDuration, shiftDate, todayISO,
  daysBetween, formatDayHeading, formatShortDate, weekdayOf, dayOfWeek,
  minutesNow, msToNextMinute, paintSpans,
} from './time.js'
import { applyPaint, applyResize, layoutLanes, stripsOf } from './blocks.js'
import { blockFace } from './face.js'
import TagIcon, { clampScale } from './TagIcon.jsx'

const pct = (slot) => (slot / SLOTS_PER_DAY) * 100
// How far the pointer may wander and still count as a click. Roughly a slot
// wide, so that letting go after a small slip opens the note rather than
// nudging the block ten minutes sideways.
const CLICK_SLOP_PX = 8
const CHUNK = 21 // days added each time you reach an end
const INITIAL = 70 // enough rows to fill the screen even at the smallest zoom
const EDGE_PX = 600 // how close to an end before more days load

/** Zoom is the height of the bar itself. */
export const ZOOM = {
  day: { min: 46, max: 200, start: 88 },
  // Same look as Day view, but it can shrink far enough to scan months.
  compact: { min: 8, max: 120, start: 44 },
}

/**
 * Everything in a row that isn't the bar: heading, hour scale, chips, spacing.
 * Measured from the DOM rather than hardcoded, so changing the CSS can't
 * silently break the scroll arithmetic. These are first-paint guesses only.
 */
const CHROME_GUESS = { day: 160, compact: 4 }

const WIPE_CONFIRM_MS = 4000
const PREVIEW_ID = '__preview' // the block being painted, not yet committed

// How far a painted stretch may run past the day it started on. One, because
// the point of it is an activity that ran past midnight, and a drag that
// reaches further than the next bar is far more likely to be a slip than a
// day and a half of the same thing.
const PAINT_REACH_DAYS = 1

// How long a block's wipe-in runs for, from the CSS. A block older than
// this is settled, and dropping the animation from it is not something
// anyone can see.
const INK_MS = 600

const LABEL_PADDING = 16 // matches the label's horizontal padding in the CSS
// How much of a block's width an icon on its own may fill.
//
// A share rather than a number of pixels, so the air reads the same at every
// width. Two thirds: an icon taking four fifths of its block looks wedged
// into it, and the width only ever binds on a narrow block anyway — a wide
// one runs out of height long before it runs out of room at the sides.
const ICON_FILL = 0.66
// How far along its block a picture may drift and still count as being in the
// middle of it, and how far off the middle of what it stands on it may sit
// before it counts as stranded at an edge. Both are shares: of the block's
// length, and of the bar's height.
const MIDDLE_ENOUGH = 0.15
const STRANDED = 0.2
const ICON_GAP = 6
const ICON_MIN_PX = 11 // any smaller and it reads as a smudge, not a picture
const LABEL_MIN_LANE = 34 // a lane shorter than this has no room for a name
const ICON_GROWTH = 4 // the most an icon may outgrow its normal size
const ICON_OF_LANE = 0.44 // how much of the row's height an icon reaches for
const ICON_INSET = 6 // an icon stops short of the lane's edges rather than filling it
// An upright picture — a game's cover — is bounded by the block it sits in
// rather than by a size of its own.
//
// Above and below, by a share of the row rather than a number of pixels, so
// that it looks like the same margin however tall the bar is. Seven pixels
// reads as a margin on an eighty-pixel row and as a hairline on a
// two-hundred-pixel one. Held between a floor and a ceiling: a tenth of a
// thirty-pixel row is nothing at all, and a tenth of the tallest bar would
// start being more air than picture.
//
// The floor has to clear the block's rounded corners and the bar's own inset
// with something to spare, or a cover in a half-height row is drawn across
// the very corner of the block it belongs to.
const COVER_GAP_SHARE = 0.1
const COVER_GAP_MIN = 8
const COVER_GAP_MAX = 22
// Either side, by a fixed distance. What a cover sits next to sideways is the
// end of its block and then whatever is next along, and none of that changes
// with the height of the bar.
const COVER_SIDE_ROOM = 14

/**
 * Width of a string in the label font, measured once per string. The font is
 * read from the type tokens so this stays honest if they change.
 */
const widths = new Map()
let labelFont = null
let measureCtx = null
let iconBase = null

/** The size a tag icon is normally drawn at, read from the tokens. */
function baseIconPx() {
  if (iconBase === null) {
    const token = getComputedStyle(document.documentElement).getPropertyValue('--tagicon-size')
    iconBase = parseFloat(token) || 16
  }
  return iconBase
}

function textWidth(text) {
  if (labelFont === null) {
    const root = getComputedStyle(document.documentElement)
    labelFont = [
      root.getPropertyValue('--w-medium').trim(),
      root.getPropertyValue('--f-md').trim(),
      root.getPropertyValue('--font-ui').trim(),
    ].join(' ')
  }
  if (!widths.has(text)) {
    measureCtx ??= document.createElement('canvas').getContext('2d')
    measureCtx.font = labelFont
    widths.set(text, measureCtx.measureText(text).width)
  }
  return widths.get(text)
}

/**
 * The outline of what can actually be seen of a block.
 *
 * Both edges move. The top steps up where the block rises to fill the strip
 * along the ceiling, and the bottom stops short wherever something painted
 * over it begins. Outlining the block's full rectangle instead would draw a
 * box straight through whatever is sitting on it, which reads as selecting
 * both.
 *
 * So the block's span is cut at every point either edge changes, and the
 * outline traces the tops left to right and the bottoms back again.
 */
function silhouette(mine, pieces) {
  const steps = stripsOf(mine, pieces)
  const x = (slot) => (slot / SLOTS_PER_DAY) * 100
  const points = []
  for (const s of steps) points.push(`${x(s.from)},${s.top * 100}`, `${x(s.to)},${s.top * 100}`)
  for (const s of [...steps].reverse()) {
    points.push(`${x(s.to)},${s.bottom * 100}`, `${x(s.from)},${s.bottom * 100}`)
  }
  return points.join(' ')
}

/**
 * Where a block's name goes, and the rectangle it gets to itself there.
 *
 * Every run of touching strips is a candidate, along with the band all of
 * them have in common — a name may sit across a run like that without ever
 * leaving its block, so the two hours of music broken up by a walk are still
 * one place to write "Music". Each run is offered twice: as itself, and
 * trimmed to the widest stretch of it that is centred on the block's middle.
 *
 * Then, in order:
 *
 * A name beats no name. A block with room for one somewhere should say what
 * it is, and a bare picture in a slightly better spot says less.
 *
 * A cover goes where there is the most room for it. It is a picture of the
 * thing itself, it says more the bigger it is, and half a bar of it beside a
 * neighbour is worth less than a whole bar of it in the clear.
 *
 * An icon stays in the middle. It is a symbol, it stops saying anything more
 * past a certain size, and moving it off the middle of its own block to buy
 * a few pixels would be a bad trade. Anything within a twentieth of the
 * block's length of the middle counts as the middle, so where two places are
 * both centred the roomier one wins — which is the whole of what fixes a
 * picture squeezed by a neighbour that only covers part of the block.
 */
function bandFor(mine, middle, tag, fallback, barHeight, trackWidth, pieces) {
  const pxOf = (slots) => (slots / SLOTS_PER_DAY) * trackWidth
  const inSlots = (px) => (px / Math.max(1, trackWidth)) * SLOTS_PER_DAY
  const strips = stripsOf(mine, pieces)

  const measure = (top, bottom, from, to) => {
    const label = fitLabel(tag, fallback, pxOf(to - from), barHeight * (bottom - top))
    return label
      ? { label, top, bottom, from, to, off: Math.abs((from + to) / 2 - middle) }
      : null
  }

  const tries = []
  for (let i = 0; i < strips.length; i++) {
    let top = 0
    let bottom = 1
    for (let j = i; j < strips.length; j++) {
      if (j > i && strips[j].from !== strips[j - 1].to) break
      top = Math.max(top, strips[j].top)
      bottom = Math.min(bottom, strips[j].bottom)
      if (bottom <= top) break
      const from = strips[i].from
      const to = strips[j].to
      tries.push(measure(top, bottom, from, to))
      // Truly centred: the widest stretch of this run that has the middle of
      // the block at its own middle. Nearly every block is one run, and then
      // this is simply the block.
      const room = 2 * Math.min(middle - from, to - middle)
      if (room > 0) tries.push(measure(top, bottom, middle - room / 2, middle + room / 2))
    }
  }

  const found = tries.filter(Boolean)
  if (found.length === 0) return null

  const block = mine[0].block
  const span = block.endSlot - block.startSlot
  // How far off the middle of its block, as a share of the block's length —
  // and near enough is the middle. A picture that has drifted a tenth of the
  // way along has not drifted anywhere anyone would notice, and refusing it
  // the room it could have there would be pedantry.
  const centred = (f) => (f.off <= span * MIDDLE_ENOUGH ? 0 : Math.round((f.off / span) * 20))

  // Whether the picture is stranded near an edge of its own block.
  //
  // A picture centred in its band still reads as pushed against an edge when
  // the block carries on past that band underneath it. Forty minutes of
  // Youtube with ten minutes of it under a game is drawn as one band, the
  // lower half — and the picture ends up along the bottom of a block that is
  // full height for three quarters of its width, with nothing above it.
  //
  // Measured over the picture's own width, so a step somewhere else along the
  // block is not this picture's problem, and only past a fifth of the bar: a
  // picture that half stands on a neighbour and half doesn't is sitting where
  // it should, between the two.
  const adrift = (f) => {
    const wide = inSlots(f.label.iconPx)
    const at = (f.from + f.to) / 2
    let width = 0
    let middle = 0
    for (const s of strips) {
      const w = Math.min(s.to, at + wide / 2) - Math.max(s.from, at - wide / 2)
      if (w <= 0) continue
      width += w
      middle += w * (s.top + s.bottom) / 2
    }
    if (width === 0) return 0
    return Math.abs((f.top + f.bottom) / 2 - middle / width) > STRANDED ? 1 : 0
  }

  const upright = tag?.aspect > 0 && tag.aspect < 1
  // A name beats no name — for an icon. A cover is the exception: it is a
  // picture of the thing itself and says more than its name ever will, so it
  // takes the room over the words rather than sitting small beside them.
  const named = found.filter((f) => f.label.mode === 'full')
  const order = upright
    ? (a, b) => b.label.iconPx - a.label.iconPx
      || (b.label.mode === 'full') - (a.label.mode === 'full')
      || a.off - b.off
    : (a, b) => adrift(a) - adrift(b)
      || centred(a) - centred(b)
      || b.label.iconPx - a.label.iconPx
      || (b.bottom - b.top) - (a.bottom - a.top)
      || a.off - b.off
  return [...(!upright && named.length > 0 ? named : found)].sort(order)[0]
}

/**
 * How to draw a block's label: how much of it fits, and how big to draw the
 * icon. Returns { mode: 'full' | 'icon', iconPx }, or nothing at all when even
 * an icon would be a smudge.
 *
 * The icon is sized to the room available rather than fixed, and grows with
 * the height of the row. It never gives that height back to make room for the
 * name: a small icon beside a name reads worse than a big icon on its own, so
 * when both won't fit at full size the name is what goes.
 *
 * The two want different things from the lane. A name needs one tall enough to
 * read it in; an icon only needs one it fits inside. So a lane too short for a
 * name still carries an icon, and only when the icon itself no longer fits is
 * the block left bare.
 *
 * A custom image is square; an emoji is text, so its width has to be measured
 * and scales with the size it is drawn at; a game's cover is upright, and is
 * the one of the three that is bounded by the block rather than by a size.
 */
function fitLabel(tag, fallback, widthPx, lanePx) {
  const room = widthPx - LABEL_PADDING
  const named = lanePx >= LABEL_MIN_LANE
  if (!tag) {
    if (!named) return null
    const width = textWidth(fallback)
    return width <= room ? { mode: 'full', iconPx: 0 } : null
  }

  const iconPx = baseIconPx()
  const base = iconPx * clampScale(tag.iconScale)
  // How wide the picture comes out per unit of height. Everything below is
  // reasoned in heights, since that is what the lane limits, and this is the
  // one number that turns a height back into the room it takes up.
  const aspect = tag.image
    ? (tag.aspect > 0 ? tag.aspect : 1)
    : (textWidth(tag.icon) || iconPx) / iconPx
  // The tallest icon that fits a given width, and how wide one of a given
  // height comes out.
  const sizeFor = (width) => width / aspect
  const widthAt = (px) => px * aspect

  const upright = aspect < 1
  // What is left of the block's width once the picture has been given room to
  // stand clear of its edges.
  const sideways = upright ? widthPx - COVER_SIDE_ROOM : widthPx * ICON_FILL

  // How tall it would like to be.
  //
  // An icon is a symbol: it grows with the row, but only to a share of it and
  // never past four times its normal size, because past a certain size a
  // symbol stops saying any more than it already did.
  //
  // A cover is a picture, and does say more the bigger it is, so nothing caps
  // it but the block — it fills the row bar its margin.
  const gap = Math.min(COVER_GAP_MAX, Math.max(COVER_GAP_MIN, lanePx * COVER_GAP_SHARE))
  const reach = upright
    ? lanePx - 2 * gap
    : Math.min(
      base * ICON_GROWTH,
      Math.max(base, lanePx * ICON_OF_LANE),
      Math.max(0, lanePx - ICON_INSET),
    )

  // What the block is wide enough to hold. Whichever of height and width runs
  // out first is what stops it, which on a short block is the width and on a
  // tall row is the height.
  //
  // The width only ever holds it back from growing, and never shrinks it
  // below its normal size: a narrow block keeps its picture, which is the
  // whole reason one is drawn without a name.
  const wanted = Math.min(reach, Math.max(base, sizeFor(sideways)))
  // Never insist on more than the tag asked for: a deliberately small icon
  // shouldn't be dropped for being small. Measured against what the tag asks
  // for rather than what the lane allows, or a lane too short for anything
  // readable would let a smudge through.
  const floor = Math.min(ICON_MIN_PX, base)

  const withName = widthAt(wanted) + ICON_GAP + textWidth(tag.name)
  if (named && withName <= room) {
    return { mode: 'full', iconPx: wanted }
  }

  // Only now does the icon give any ground, and only because at this width
  // there is nothing else to give. A picture with no name beside it may fill
  // the block right up to the share it is allowed — the room a cover keeps
  // clear at its sides is room for a name, and there is no name here.
  const alone = Math.min(wanted, sizeFor(widthPx * ICON_FILL))
  return alone >= floor ? { mode: 'icon', iconPx: alone } : null
}

/**
 * Where you are in the day, drawn on today's bar.
 *
 * It keeps its own clock rather than taking the time as a prop, so the minute
 * turning over re-renders this one line instead of every day in the list —
 * there can be several hundred of those, and none of the rest of them have
 * changed.
 *
 * The first tick is timed to the turn of the minute rather than a minute from
 * now, so the mark moves when the clock does.
 */
function NowLine({ date }) {
  const [minute, setMinute] = useState(minutesNow)

  useEffect(() => {
    let interval
    const timeout = setTimeout(() => {
      setMinute(minutesNow())
      interval = setInterval(() => setMinute(minutesNow()), 60_000)
    }, msToNextMinute())
    return () => { clearTimeout(timeout); clearInterval(interval) }
  }, [])

  // Past midnight this is yesterday's row, and the mark belongs on the new
  // day rather than back at the start of this one.
  if (date !== todayISO()) return null
  return <i className="nowline" style={{ left: `${(minute / MINUTES_PER_DAY) * 100}%` }} />
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.6 6.6v4.6M9.4 6.6v4.6" strokeLinecap="round" />
    </svg>
  )
}

export default function DayList({
  mode, // 'day' (editable) | 'compact' (read-only)
  days,
  tags,
  ensure,
  armed, // { date, tag } | null
  onArm,
  selected, // { date, id } | null
  barHeight,
  onZoom,
  onPaint,
  onResize,
  onSelect,
  onPickDay,
  onWipeDay,
  onVisibleRange,
  jumpTo,
  onJumped,
  find,
}) {
  const today = todayISO()
  const scrollRef = useRef(null)
  const isDay = mode === 'day'
  // Below this the insets and gridlines are more noise than information.
  const dense = barHeight < 26

  // Chrome is whatever a row measures minus its bar. It doesn't change with
  // zoom, so measuring it once per view keeps every row a known height.
  const firstRowRef = useRef(null)
  const [chrome, setChrome] = useState({ mode, value: CHROME_GUESS[mode], measured: false })
  const rowTotal = barHeight + chrome.value
  // Not just "matches this view" — it must be a real measurement, or the
  // first scroll is computed from a guess and lands on the wrong day.
  const chromeReady = chrome.mode === mode && chrome.measured

  useLayoutEffect(() => {
    const row = firstRowRef.current
    const track = row?.querySelector('.track')
    if (!row || !track) return
    const value = row.getBoundingClientRect().height - track.getBoundingClientRect().height
    if (value > 0 && (!chromeReady || Math.abs(value - chrome.value) > 0.5)) {
      setChrome({ mode, value, measured: true })
    }
  })

  const [range, setRange] = useState(() => ({
    start: shiftDate(today, -INITIAL),
    end: shiftDate(today, INITIAL),
  }))

  const dates = []
  for (let d = range.start; d <= range.end; d = shiftDate(d, 1)) dates.push(d)

  const datesRef = useRef(dates)
  datesRef.current = dates

  /**
   * Which blocks have already wiped themselves in, and when.
   *
   * A block wipes in when it arrives — painted, or the day it belongs to
   * being read for the first time. It should not do it again for anything
   * else, and until now it did: a block cut around an overlap is several
   * elements, and dragging one block's edge changes how many pieces its
   * neighbours are cut into. Every piece that appears is a new element, and a
   * new element plays whatever it plays on arrival. So a neighbour nobody
   * touched wiped itself in again, in the middle of a drag, for no reason
   * anyone watching could see.
   *
   * Remembered per block rather than per piece, and the time is kept rather
   * than a flag: a redraw a tenth of a second after a block appears must not
   * take the animation off it half way through. Once the wipe is over,
   * dropping it changes nothing on screen.
   *
   * Filled in after the frame is on screen, so the frame a block arrives on
   * is the one that animates.
   */
  const inked = useRef(new Map())
  const wiping = (date, block) => {
    const at = inked.current.get(`${date}:${block.id}`)
    return at === undefined || performance.now() - at < INK_MS
  }
  useEffect(() => {
    const now = performance.now()
    for (const date of dates) {
      for (const b of days[date]?.blocks ?? []) {
        if (!inked.current.has(`${date}:${b.id}`)) inked.current.set(`${date}:${b.id}`, now)
      }
    }
  })

  const rowTotalRef = useRef(rowTotal)
  rowTotalRef.current = rowTotal

  useEffect(() => { ensure(range.start, range.end) }, [range.start, range.end, ensure])

  // --- keeping your place while the list grows or the rows resize --------
  const didInitialScroll = useRef(false)
  // Each view keeps its own place. Scrolling back through the Overview
  // shouldn't drag the Day view along with it, so switching between them
  // returns to wherever that view was left.
  const topDates = useRef({ day: today, compact: today })
  const lastMode = useRef(mode)
  // handleScroll is memoised, so it reads the view from here rather than
  // from a closure that was made several views ago.
  const modeRef = useRef(mode)
  modeRef.current = mode

  /**
   * Every correction says "put this date back where it was", never "shift by
   * N pixels". That makes them idempotent, so loading more days, switching
   * view and zooming can all land on the same frame without fighting.
   */
  const pendingAnchor = useRef(null)

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return

    if (lastMode.current !== mode) {
      lastMode.current = mode
      pendingAnchor.current = { date: topDates.current[mode], offset: 0 }
    }

    const anchor = pendingAnchor.current
    if (!anchor) return
    // rowTotal is still a guess for this view; wait for the real measurement
    // rather than scrolling to a position computed from the wrong height.
    if (!chromeReady) return

    const i = dates.indexOf(anchor.date)
    if (i < 0) {
      // The day this view was left on isn't loaded any more — jumping to a
      // date in the other view moves the window. Load around it and let this
      // run again; the anchor stays pending until it lands.
      setRange({ start: shiftDate(anchor.date, -INITIAL), end: shiftDate(anchor.date, INITIAL) })
      return
    }
    pendingAnchor.current = null
    el.scrollTop = anchor.cursorY == null
      ? i * rowTotal + anchor.offset
      : (i + anchor.frac) * rowTotal - anchor.cursorY
  }, [range.start, dates.length, rowTotal, mode, chromeReady])

  // Short rows can leave the loaded window shorter than the viewport, which
  // means nothing to scroll. Keep at least two screens' worth loaded.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || dates.length > 800) return
    if (el.scrollHeight >= el.clientHeight * 2) return
    pendingAnchor.current = { date: topDates.current[mode], offset: 0 }
    setRange((r) => ({ start: shiftDate(r.start, -CHUNK), end: shiftDate(r.end, CHUNK) }))
  }, [dates.length, rowTotal])

  // Open with today at the top: the past above, the future below.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || didInitialScroll.current || dates.length === 0 || !chromeReady) return
    const i = dates.indexOf(today)
    if (i < 0) return
    el.scrollTop = i * rowTotal
    topDates.current[mode] = today
    didInitialScroll.current = true
  }, [dates, rowTotal, today, chromeReady])

  // Which days are actually on screen, for the totals beside the list.
  const reportedRange = useRef('')
  const reportVisible = useCallback(() => {
    const el = scrollRef.current
    if (!el || !onVisibleRange) return
    const h = rowTotalRef.current
    const list = datesRef.current
    const first = Math.max(0, Math.floor(el.scrollTop / h))
    const last = Math.min(list.length - 1, Math.ceil((el.scrollTop + el.clientHeight) / h) - 1)
    if (last < first) return

    const range = { from: list[first], to: list[last] }
    const key = `${range.from}|${range.to}`
    if (key === reportedRange.current) return
    reportedRange.current = key
    onVisibleRange(range)
  }, [onVisibleRange])

  useEffect(reportVisible)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    reportVisible()

    const h = rowTotalRef.current
    const index = Math.max(0, Math.floor(el.scrollTop / h))
    // Mid-correction the scroll position isn't a truthful answer to
    // "which day are you looking at", so don't record it.
    const atTop = datesRef.current[index]
    if (atTop && !pendingAnchor.current) topDates.current[modeRef.current] = atTop

    if (el.scrollTop < EDGE_PX) {
      if (atTop) pendingAnchor.current = { date: atTop, offset: el.scrollTop - index * h }
      setRange((r) => ({ ...r, start: shiftDate(r.start, -CHUNK) }))
    } else if (el.scrollHeight - el.scrollTop - el.clientHeight < EDGE_PX) {
      setRange((r) => ({ ...r, end: shiftDate(r.end, CHUNK) }))
    }
  }, [reportVisible])

  // --- ctrl+scroll zoom, anchored on whatever is under the cursor --------
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    // Non-passive, so the browser doesn't zoom the whole page instead.
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()

      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      const limits = ZOOM[mode]
      const next = Math.round(Math.min(limits.max, Math.max(limits.min, barHeight * factor)))
      if (next === barHeight) return

      const rect = el.getBoundingClientRect()
      const cursorY = e.clientY - rect.top
      const position = (el.scrollTop + cursorY) / rowTotal
      const index = Math.min(datesRef.current.length - 1, Math.max(0, Math.floor(position)))

      pendingAnchor.current = {
        date: datesRef.current[index],
        frac: position - Math.floor(position),
        cursorY,
      }
      onZoom(next)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [barHeight, rowTotal, mode, onZoom])

  // Pixel width of a bar. Labels need it to decide whether the tag name fits,
  // and every block is placed on it — so it is measured before the frame is
  // painted rather than after. Measuring afterwards would show one frame of
  // blocks laid out against the width of whichever view was on screen last.
  const [trackWidth, setTrackWidth] = useState(0)
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      const t = el.querySelector('.track')
      if (t) setTrackWidth((w) => (Math.abs(w - t.clientWidth) > 1 ? t.clientWidth : w))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [mode])

  /**
   * Where a slot boundary falls, as a whole pixel.
   *
   * Two blocks that meet share a slot, but as percentages they do not share a
   * number: one block's right edge is worked out as its left plus its width,
   * while its neighbour's left edge is worked out on its own. Land that shared
   * boundary on half a pixel and the two roundings can disagree, leaving a
   * one-pixel crack between blocks that are supposed to be touching — and at
   * every hour there is a gridline sitting directly behind the crack, which is
   * what shows through it.
   *
   * Both edges are the same slot, so here they are the same number, and there
   * is nothing left for anything to show through. Until the bar has been
   * measured there is no pixel to snap to, so percentages stand in — one frame
   * of the old behaviour beats one frame of no blocks at all.
   */
  const xAt = (slot) => Math.round((slot / SLOTS_PER_DAY) * trackWidth)
  const edgeAt = (slot) => (trackWidth ? `${xAt(slot)}px` : `${pct(slot)}%`)
  const spanAt = (from, to) => (trackWidth
    ? { left: `${xAt(from)}px`, width: `${xAt(to) - xAt(from)}px` }
    : { left: `${pct(from)}%`, width: `${pct(to - from)}%` })

  /**
   * Which blocks the find bar has lit, and which of them it is standing on.
   *
   * Keyed by what a block *is* — its times, its tag, and what was played or
   * watched — rather than by its id. The ids are minted when a day is read
   * into the app and mean nothing to the vault the search actually read, and
   * two blocks that agree on all of that are the same block by any test the
   * app has.
   */
  const found = new Map()
  for (const [at, hit] of (find?.hits ?? []).entries()) {
    const onDay = found.get(hit.date) ?? new Map()
    onDay.set(`${hit.start}|${hit.end}|${hit.tag}|${hit.game}|${hit.show}`, at)
    found.set(hit.date, onDay)
  }
  const searching = (find?.hits.length ?? 0) > 0
  const markOf = (date, b) => found.get(date)?.get(
    `${slotToTime(b.startSlot)}|${slotToTime(b.endSlot)}|${b.tag}|${b.game ?? ''}|${b.show ?? ''}`,
  )
  /** '', ' hit', or ' hit current' — what a search has to say about a block. */
  const litFor = (date, b) => {
    const at = markOf(date, b)
    return at === undefined ? '' : at === find.at ? ' hit current' : ' hit'
  }

  // --- the paint / resize / click gesture --------------------------------
  const [drag, setDrag] = useState(null)
  const dragRef = useRef(null)
  const handlers = useRef({})
  handlers.current = { onPaint, onResize, onSelect, onPickDay }

  function setDragState(next) {
    dragRef.current = next
    setDrag(next)
  }

  function cellFrom(trackEl, clientX) {
    const rect = trackEl.getBoundingClientRect()
    const cell = Math.floor(((clientX - rect.left) / rect.width) * SLOTS_PER_DAY)
    return Math.min(SLOTS_PER_DAY - 1, Math.max(0, cell))
  }

  /**
   * Which lane a new block should take, from how far down the bar the pointer
   * went. The bar is split into one band per block already there, plus one:
   * with a single block that means the top half puts the new one above it and
   * the bottom half below, and aiming at the seam between two blocks slots the
   * new one in between them. Decided once, when the drag starts — dragging
   * sideways over more blocks must not shuffle it.
   */
  function laneFrom(trackEl, clientY, blocks, cell) {
    const rect = trackEl.getBoundingClientRect()
    const bands = blocks.filter((b) => b.startSlot <= cell && b.endSlot > cell).length + 1
    const band = Math.floor(((clientY - rect.top) / rect.height) * bands)
    return Math.min(bands - 1, Math.max(0, band))
  }

  /**
   * Which lane a block being slid is asking for.
   *
   * Measured from where it was picked up, not from where the pointer is in
   * the bar. A block is drawn from its lane down to the floor, so grabbing a
   * top-lane block near its bottom edge puts the pointer in the band below
   * it — read absolutely, sliding it sideways would shove it down a lane it
   * was never asked to leave. Moving up or down by one lane's worth of height
   * moves it one lane, and holding still leaves it alone.
   */
  function laneWhileSliding(trackEl, clientY, d, cell) {
    const rect = trackEl.getBoundingClientRect()
    const bands = d.others.filter((b) => b.startSlot <= cell && b.endSlot > cell).length + 1
    const by = (clientY - rect.top) / rect.height - d.grabY
    return Math.min(bands - 1, Math.max(0, d.wasLane + Math.round(by * bands)))
  }

  function boundaryFrom(trackEl, clientX) {
    const rect = trackEl.getBoundingClientRect()
    const slot = Math.round(((clientX - rect.left) / rect.width) * SLOTS_PER_DAY)
    return Math.min(SLOTS_PER_DAY, Math.max(0, slot))
  }

  function handlePointerDown(e) {
    if (e.button !== 0) return

    const trackEl = e.target.closest?.('[data-track-date]')
    if (!trackEl) return
    const date = trackEl.dataset.trackDate

    if (!isDay) {
      setDragState({ mode: 'press', date, originX: e.clientX, originY: e.clientY, compact: true })
      return
    }
    if (days[date]?.malformed) return

    // A tag is armed for one specific day, so it can't paint on another.
    if (armed?.date === date) {
      e.preventDefault()
      const cell = cellFrom(trackEl, e.clientX)
      const lane = laneFrom(trackEl, e.clientY, days[date]?.blocks ?? [], cell)
      setDragState({ mode: 'paint', date, trackEl, anchor: cell, cell, lane, toDate: date })
      return
    }

    const blockEl = e.target.closest('[data-block-id]')
    if (!blockEl) return
    const block = days[date]?.blocks.find((b) => b.id === blockEl.dataset.blockId)
    if (!block) return

    e.preventDefault()
    const edge = e.target.dataset?.handle
    if (edge) {
      setDragState({
        mode: 'resize', date, trackEl, id: block.id, edge,
        startSlot: block.startSlot, endSlot: block.endSlot,
        // Kept so a press that goes nowhere can be told from a real drag.
        was: { startSlot: block.startSlot, endSlot: block.endSlot },
      })
    } else {
      // A press, until it moves far enough to be a drag. Everything a slide
      // needs is taken now, while the block is still where it started.
      const rect = trackEl.getBoundingClientRect()
      setDragState({
        mode: 'press', date, trackEl, id: block.id,
        originX: e.clientX, originY: e.clientY,
        startSlot: block.startSlot, endSlot: block.endSlot,
        was: { startSlot: block.startSlot, endSlot: block.endSlot },
        // Where it sits now, and how far down the bar it was taken hold of.
        // Both are what a slide is measured against.
        wasLane: layoutLanes(days[date]?.blocks ?? [])
          .find((p) => p.block.id === block.id)?.lane ?? 0,
        grabY: (e.clientY - rect.top) / rect.height,
        // The day without this block in it. Which lane the pointer is asking
        // for is a question about what it would be landing among, and a block
        // is not among itself.
        others: (days[date]?.blocks ?? []).filter((b) => b.id !== block.id),
      })
    }
  }

  useEffect(() => {
    if (!drag) return

    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return

      if (d.mode === 'paint') {
        // Which bar the pointer is over now, which need not be the one it
        // started on: ending on the next day's bar is how a stretch carries
        // past midnight. Off the bars entirely, it keeps the day it last
        // reached rather than snapping back — you are on your way somewhere.
        //
        // Past the reach it stops at the furthest day it is allowed, rather
        // than giving up and going home: a drag that has gone too far should
        // stop at the limit, not turn into a stretch on the day it started.
        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-track-date]')
        const onto = over?.dataset.trackDate
        let toDate = d.toDate
        if (onto) {
          const reach = Math.max(-PAINT_REACH_DAYS,
            Math.min(PAINT_REACH_DAYS, daysBetween(d.date, onto)))
          const target = shiftDate(d.date, reach)
          if (days[target] && !days[target].malformed) toDate = target
        }
        // Every bar in this view has the same left edge and the same width,
        // so the time under the pointer reads the same off any of them.
        const cell = cellFrom(d.trackEl, e.clientX)
        if (cell !== d.cell || toDate !== d.toDate) setDragState({ ...d, cell, toDate })
        return
      }
      if (d.mode === 'resize') {
        const at = boundaryFrom(d.trackEl, e.clientX)
        const next = d.edge === 'start'
          ? { ...d, startSlot: Math.min(at, d.endSlot - 1) }
          : { ...d, endSlot: Math.max(at, d.startSlot + 1) }
        if (next.startSlot !== d.startSlot || next.endSlot !== d.endSlot) setDragState(next)
        return
      }
      if (d.mode === 'move' || d.mode === 'press') {
        const moved = Math.abs(e.clientX - d.originX) > CLICK_SLOP_PX
          || Math.abs(e.clientY - d.originY) > CLICK_SLOP_PX
        if (!moved) return
        // Both edges together, so the block keeps its length. The whole block
        // has to stay in the day, so the shift is clamped rather than the
        // edges — clamping the edges would squash it against midnight.
        // How far it has travelled, in slots, measured from where it was
        // taken hold of. Counting whole cells crossed instead would make the
        // first step depend on where inside a cell the press landed — a pixel
        // from the edge and it jumps, halfway across and it takes a full slot.
        // From the grab point it is always half a slot, wherever you grabbed.
        const rect = d.trackEl.getBoundingClientRect()
        const travelled = Math.round(
          ((e.clientX - d.originX) / rect.width) * SLOTS_PER_DAY)
        const shift = Math.max(-d.was.startSlot,
          Math.min(SLOTS_PER_DAY - d.was.endSlot, travelled))
        const cell = cellFrom(d.trackEl, e.clientX)
        // How high you are holding it says where it should sit — judged where
        // the pointer is, since that is what you are aiming at. Judging it at
        // the block's own start would ask about a moment that can be hours
        // away and over something else entirely.
        const lane = laneWhileSliding(d.trackEl, e.clientY, d, cell)
        const next = {
          ...d, mode: 'move', moved: true,
          startSlot: d.was.startSlot + shift, endSlot: d.was.endSlot + shift,
          at: { slot: cell, lane },
        }
        if (next.mode !== d.mode || next.startSlot !== d.startSlot || lane !== d.at?.lane) {
          setDragState(next)
        }
        return
      }
      const moved = Math.abs(e.clientX - d.originX) > CLICK_SLOP_PX
        || Math.abs(e.clientY - d.originY) > CLICK_SLOP_PX
      if (moved && !d.moved) setDragState({ ...d, moved: true })
    }

    const onUp = () => {
      const d = dragRef.current
      setDragState(null)
      if (!d) return
      const h = handlers.current

      if (d.mode === 'paint') {
        h.onPaint(d.date, paintSpans(d.date, d.anchor, d.toDate, d.cell), {
          slot: d.anchor, lane: d.lane,
        })
      } else if (d.mode === 'resize' || d.mode === 'move') {
        // Landing back where it started isn't an edit — it's a click. Which is
        // the only way to open the note on a block too narrow to have anywhere
        // else to click, and what a stray wobble on any other block should
        // come to as well.
        //
        // A slide can change where a block sits without changing when it
        // happened, though, and dragging one straight up is the plainest way
        // to ask for that. Times alone would call it a click and throw the
        // whole thing away.
        const sameTimes = d.startSlot === d.was.startSlot && d.endSlot === d.was.endSlot
        const sameLane = d.mode !== 'move' || d.at?.lane === d.wasLane
        if (sameTimes && sameLane) {
          h.onSelect(d.date, d.id)
        } else {
          h.onResize(d.date, d.id, d.startSlot, d.endSlot, d.at)
        }
      } else if (!d.moved) {
        if (d.compact) h.onPickDay(d.date)
        else h.onSelect(d.date, d.id)
      }
    }

    const onCancel = () => setDragState(null)
    const onKey = (e) => { if (e.key === 'Escape') setDragState(null) }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
    }
  }, [drag !== null])

  // Clearing a whole day is the one thing here with no way back, so it asks
  // once. Second click within a few seconds does it; otherwise it forgets.
  const [confirmWipe, setConfirmWipe] = useState(null)
  const wipeTimer = useRef(null)

  useEffect(() => () => clearTimeout(wipeTimer.current), [])

  function askWipe(date) {
    clearTimeout(wipeTimer.current)
    if (confirmWipe === date) {
      setConfirmWipe(null)
      onWipeDay(date)
      return
    }
    setConfirmWipe(date)
    wipeTimer.current = setTimeout(() => setConfirmWipe(null), WIPE_CONFIRM_MS)
  }

  const tagById = (id) => tags.find((t) => t.id === id)
  const armedTag = armed ? tagById(armed.tag) : null

  // Abandon a paint if the armed tag disappears mid-gesture.
  useEffect(() => {
    if (dragRef.current?.mode === 'paint' && !armedTag) setDragState(null)
  }, [armedTag])

  // --- jump to a date from the date picker -------------------------------
  useEffect(() => {
    if (!jumpTo) return
    if (jumpTo < range.start || jumpTo > range.end) {
      setRange({ start: shiftDate(jumpTo, -INITIAL), end: shiftDate(jumpTo, INITIAL) })
      return // re-runs once the range covers it
    }
    topDates.current[mode] = jumpTo
    // Asking for a date beats every correction still queued, including the one
    // that puts a view back where you left it — which is what makes clicking a
    // day in the Overview open that day rather than the last one you read.
    const el = scrollRef.current
    if (el && chromeReady) {
      pendingAnchor.current = null
      el.scrollTop = daysBetween(range.start, jumpTo) * rowTotal
    } else {
      pendingAnchor.current = { date: jumpTo, offset: 0 }
    }
    onJumped()
  }, [jumpTo, range.start, range.end, rowTotal, onJumped, mode, chromeReady])

  const painting = drag?.mode === 'paint' && armedTag
    ? paintSpans(drag.date, drag.anchor, drag.toDate, drag.cell)
    : null
  // A move is a resize where both edges went the same way, so it previews and
  // reads out through the same path.
  const resizing = drag?.mode === 'resize' || drag?.mode === 'move' ? drag : null

  // The readout says the whole stretch, however many days it lands on: the
  // time it starts, the time it ends, and how long it comes to. Across
  // midnight the end time belongs to a later day, which the count says.
  const readoutRange = painting
    ? {
      startSlot: painting[0].startSlot,
      endSlot: painting[painting.length - 1].endSlot,
      slots: painting.reduce((sum, p) => sum + (p.endSlot - p.startSlot), 0),
      overnights: painting.length - 1,
    }
    : resizing
  const resizingBlock = resizing
    ? days[resizing.date]?.blocks.find((b) => b.id === resizing.id)
    : null
  // Dragging a named game around should read as that game, not as "Game".
  const readoutTag = painting
    ? armedTag
    : resizingBlock && blockFace(tagById(resizingBlock.tag), resizingBlock)

  const hourTicks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]


  return (
    <div className={`daylist ${mode}`}>
      <div className="listbar">
        <div className="listreadout">
          {readoutRange ? (
            <>
              <span className="readout-tag" style={{ '--tag': readoutTag?.colour }}>
                <TagIcon tag={readoutTag} />
                {readoutTag?.name}
              </span>
              <span className="readout-range">
                {slotToTime(readoutRange.startSlot)} – {slotToTime(readoutRange.endSlot)}
              </span>
              <span className="readout-dur">
                {formatDuration(readoutRange.slots ?? readoutRange.endSlot - readoutRange.startSlot)}
              </span>
              {readoutRange.overnights > 0 && (
                <span className="readout-over">
                  over {readoutRange.overnights === 1 ? 'midnight' : `${readoutRange.overnights} nights`}
                </span>
              )}
            </>
          ) : (
            <span className="readout-hint">
              {!isDay
                ? 'Click a day to open it · ctrl+scroll to resize'
                : armedTag
                  ? `Drag across ${formatDayHeading(armed.date)} to paint ${armedTag.name}`
                  : 'Pick a tag under a day to add time · click a block for its note, drag its middle to move it · ctrl+z undoes · ctrl+scroll to resize'}
            </span>
          )}
        </div>

        {!isDay && (
          <div className="listruler">
            {hourTicks.map((h) => (
              <span key={h} className="ltick" style={{ left: edgeAt(h * 6) }}>
                {String(h).padStart(2, '0')}
              </span>
            ))}
            <span className="ltick last" style={{ left: edgeAt(SLOTS_PER_DAY) }}>24</span>
          </div>
        )}
      </div>

      <div
        className={`scroller${armedTag ? ' armed' : ''}`}
        ref={scrollRef}
        onScroll={handleScroll}
        onPointerDown={handlePointerDown}
      >
        {dates.map((date, rowIndex) => {
          const day = days[date]
          const isToday = date === today
          let blocks = resizing?.date === date
            ? applyResize(day?.blocks ?? [], resizing.id, resizing.startSlot, resizing.endSlot, resizing.at)
            : day?.blocks ?? []

          // While painting, lay the day out as it will be once the drag is
          // released — so the new block shows at the height it will land at,
          // and anything it overlaps shrinks to make room for it. A stretch
          // that runs past midnight previews on every day it reaches, which
          // is what shows you it is going to land as more than one block.
          let previewId = null
          const span = painting?.find((p) => p.date === date)
          if (span) {
            const before = blocks
            blocks = applyPaint(
              before,
              {
                id: PREVIEW_ID,
                tag: armed.tag,
                startSlot: span.startSlot,
                endSlot: span.endSlot,
                note: '',
              },
              // Where the pointer went down decides the height on the day it
              // went down on. The days it carried into take the same lane,
              // measured from where the stretch enters them.
              { slot: date === drag.date ? drag.anchor : span.startSlot, lane: drag.lane },
            )
            // Usually the new block, but painting a tag over itself merges,
            // in which case the survivor is what changed.
            previewId = blocks.find((b) => {
              const was = before.find((o) => o.id === b.id)
              return !was || was.startSlot !== b.startSlot || was.endSlot !== b.endSlot
            })?.id ?? null
          }

          // Counted after the paint preview is folded in, so the first drag
          // on an empty day fills it in as you draw rather than after.
          const blank = !day?.malformed && blocks.length === 0

          const pieces = layoutLanes(blocks)
          // Which block covers which is the lane's business, not the DOM's.
          //
          // The list order is the stacking order, and dragging an edge
          // rewrites it to keep a block at the height it already had. If the
          // blocks were drawn in list order, that rewrite would shuffle the
          // elements on screen — and moving an element is enough to start
          // anything that plays on arrival over again, for every block in the
          // day, twice: once on the way out and once on the way back.
          //
          // So they are drawn in an order that never changes, and depth is
          // said out loud with a z-index instead. Sorting by id is arbitrary,
          // which is the point: nothing about the day can reorder it.
          const drawn = [...pieces].sort((a, b) =>
            (a.block.id < b.block.id ? -1 : a.block.id > b.block.id ? 1 : a.index - b.index))
          // One piece per block, for the grab strips: they belong to the
          // block's own ends rather than to any slice of it.
          const wholes = drawn.filter((p) => p.isFirst)
          // A name belongs to the block rather than to any slice of it, so it
          // is centred on the whole block. Choosing a slice and centring in
          // that instead is what pushed names off to one side: the roomiest
          // slice of a two-hour block can sit right at one end of it.
          //
          // Each block keeps its pieces, though, because the band a name sits
          // in has to be one the block holds along the whole width the name
          // reaches — see below.
          const named = [...drawn.reduce((byBlock, p) => {
            const had = byBlock.get(p.block) ?? []
            had.push(p)
            byBlock.set(p.block, had)
            return byBlock
          }, new Map())].map(([block, mine]) => ({
            block,
            mine,
            middle: (block.startSlot + block.endSlot) / 2,
          }))
          const selectedPieces = selected?.date === date
            ? pieces.filter((p) => p.block.id === selected.id)
            : []

          const track = (
            <div
              className={`track${dense ? ' dense' : ''}${blank ? ' empty' : ''}`
                + `${searching ? ' finding' : ''}`}
              data-track-date={date}
              style={{ height: barHeight }}
            >
              {/* One per hour, on the same whole pixels the blocks use, so a
                  gridline sits exactly under the edge that covers it. */}
              {!dense && Array.from({ length: 23 }, (_, i) => (
                <div key={i} className="gridline" style={{ left: edgeAt((i + 1) * 6) }} />
              ))}

              {/* Said out loud rather than left blank — but only in the Day
                  view, where there is room for it. In the Overview a row is
                  a few pixels tall and the hatching alone reads fine. */}
              {blank && isDay && (
                <span className="emptyday">nothing has happened here yet</span>
              )}

              {/* The blocks keep their depths to themselves, so a block three
                  lanes down still sits under every name and grab strip. */}
              {day?.malformed ? (
                <span className="rowbroken">needs fixing in Obsidian</span>
              ) : (
              <div className="blocks">
                {drawn.map((piece) => {
                const b = piece.block
                const tag = tagById(b.tag)
                return (
                  <div
                    // Named for which piece of its block it is, not for where
                    // it happens to start. Dragging an edge moves where a
                    // piece begins, and a key built from that would make every
                    // step look like a different element: React would replace
                    // it, and anything that plays on arrival would play again.
                    key={`${b.id}#${piece.index}`}
                    data-block-id={b.id}
                    className={
                      'block' + (b.id === previewId ? ' preview' : '')
                      + litFor(date, b)
                      // Only on the way in. A piece that appears because
                      // something else moved is not an arrival.
                      + (wiping(date, b) ? '' : ' settled')
                      // Square where the block carries on: a block cut where
                      // it steps up has to read as one shape.
                      + `${piece.isFirst ? '' : ' joined-start'}${piece.isLast ? '' : ' joined-end'}`
                    }
                    style={{
                      ...spanAt(piece.from, piece.to),
                      // Every block runs from wherever it starts to the floor
                      // of the bar. Whatever is layered over it covers the
                      // lower part, so nothing is left standing in empty
                      // space. Inset only against the edges of the bar itself.
                      top: piece.top === 0
                        ? 'var(--block-inset)'
                        : `${(piece.top / piece.lanes) * 100}%`,
                      bottom: 'var(--block-inset)',
                      // How deep the block sits is how it stacks.
                      zIndex: piece.lane,
                      background: tag?.colour ?? '#555',
                    }}
                    title={`${b.game || b.show || tag?.name || b.tag} · ${slotToTime(b.startSlot)}–${slotToTime(b.endSlot)}${b.note ? `
${b.note}` : ''}`}
                  />
                )
                })}
              </div>
              )}

              {/* Over the blocks, so it can be found against a full day, but
                  under the names and grab strips, which you have to be able to
                  read and grab through it. */}
              {isToday && <NowLine date={date} />}

              {/* Names are drawn over the blocks, one per block rather than
                  one per piece: a block cut where it steps up is still one
                  thing with one name, sitting in its own lane across the whole
                  of it. */}
              {!day?.malformed && named.map(({ block: b, mine, middle }) => {
                // A named game wears its own name and its own cover here.
                // Twenty Game blocks in a week all called "Game" say nothing
                // the colour hasn't already said.
                const tag = blockFace(tagById(b.tag), b)
                const band = bandFor(mine, middle, tag, b.tag, barHeight, trackWidth, drawn)
                if (!band) return null
                const { label, top, bottom, from, to } = band
                return (
                  <span
                    key={`l${b.id}`}
                    className={`block-label${litFor(date, b)}`}
                    // Names its block, the way the block itself does. It is
                    // not always drawn across the whole of it, so there is
                    // otherwise no way to tell from the page which is which.
                    data-block-id={b.id}
                    style={{
                      ...spanAt(from, to),
                      top: `${top * 100}%`,
                      height: `${(bottom - top) * 100}%`,
                    }}
                  >
                    <TagIcon tag={tag} scale={label.iconPx / baseIconPx()} />
                    {label.mode === 'full' && (tag ? tag.name : b.tag)}
                  </span>
                )
              })}

              {/* Handles are drawn over the blocks so they are never buried,
                  but only as tall as the block itself — a full-height strip
                  would reach into whatever is stacked above or below and steal
                  its clicks. A ten-minute block is narrower than two grab
                  strips, so they halve to fit; it ends up entirely covered,
                  which is why a press that goes nowhere opens the note instead
                  of counting as a resize. */}
              {isDay && !day?.malformed && !previewId && wholes.map((piece) => {
                const b = piece.block
                const lane = {
                  top: piece.lane === 0
                    ? 'var(--block-inset)'
                    : `${(piece.lane / piece.lanes) * 100}%`,
                  height: `calc(${100 / piece.lanes}%`
                    + `${piece.lane === 0 ? ' - var(--block-inset)' : ''}`
                    + `${piece.lane === piece.lanes - 1 ? ' - var(--block-inset)' : ''})`,
                  '--block-w': `${((b.endSlot - b.startSlot) / SLOTS_PER_DAY) * trackWidth}px`,
                }
                return (
                  <span key={`h${b.id}`}>
                    <span
                      className="handle start"
                      data-block-id={b.id}
                      data-handle="start"
                      style={{ left: edgeAt(b.startSlot), ...lane }}
                    />
                    <span
                      className="handle end"
                      data-block-id={b.id}
                      data-handle="end"
                      style={{ left: edgeAt(b.endSlot), ...lane }}
                    />
                  </span>
                )
              })}

              {selectedPieces.length > 0 && (
                <svg className="selection" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon points={silhouette(selectedPieces, pieces)} vectorEffect="non-scaling-stroke" />
                </svg>
              )}

           </div>
          )

          if (!isDay) {
            return (
              <div
                key={date}
                ref={rowIndex === 0 ? firstRowRef : undefined}
                className={`compactrow${isToday ? ' today' : ''}${dayOfWeek(date) === 0 ? ' weekedge' : ''}`}
              >
                <div className="gutter">
                  <span className="gday">{weekdayOf(date)}</span>
                  <span className="gdate">{formatShortDate(date)}</span>
                </div>
                {track}
              </div>
            )
          }

          return (
            <section
              key={date}
              ref={rowIndex === 0 ? firstRowRef : undefined}
              className={`daysection${isToday ? ' today' : ''}${blank ? ' blank' : ''}`}
            >
              <h2 className="dayhead">
                <span className="dayweekday">{weekdayOf(date)}</span>
                {formatDayHeading(date)}
                {isToday && <span className="todaymark">today</span>}
                {blank && <span className="daysummary">unwritten</span>}
              </h2>

              {track}

              <div className="dayruler">
                {Array.from({ length: 25 }, (_, h) => (
                  <span
                    key={h}
                    className={`rtick${h % 2 === 0 ? ' major' : ''}`}
                    style={{ left: edgeAt(h * 6) }}
                  >
                    <i className="rmark" />
                    {h % 2 === 0 && (
                      <b className={`rlabel${h === 0 ? ' first' : ''}${h === 24 ? ' last' : ''}`}>
                        {String(h).padStart(2, '0')}:00
                      </b>
                    )}
                  </span>
                ))}
              </div>

              <div className="daychips">
                <div className="chipgroup">
                {tags.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip${armed?.date === date && armed?.tag === t.id ? ' armed' : ''}`}
                    style={{ '--chip': t.colour }}
                    disabled={day?.malformed}
                    onClick={() => onArm(date, t.id)}
                  >
                    <TagIcon tag={t} />
                    {t.name}
                  </button>
                ))}
                </div>

                <button
                  type="button"
                  className={`wipe${confirmWipe === date ? ' confirming' : ''}`}
                  disabled={day?.malformed || (day?.blocks.length ?? 0) === 0}
                  title={confirmWipe === date ? 'Click again to clear' : 'Clear this whole day'}
                  onClick={() => askWipe(date)}
                >
                  <TrashIcon />
                  {confirmWipe === date ? 'Unwrite?' : 'Unwrite'}
                </button>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
