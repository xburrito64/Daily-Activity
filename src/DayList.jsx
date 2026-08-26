import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  SLOTS_PER_DAY, slotToTime, formatDuration, shiftDate, todayISO, daysBetween,
  formatDayHeading, formatShortDate, weekdayOf, dayOfWeek,
} from './time.js'
import { applyPaint, applyResize, layoutLanes } from './blocks.js'
import TagIcon, { clampScale } from './TagIcon.jsx'

const pct = (slot) => (slot / SLOTS_PER_DAY) * 100
const CLICK_SLOP_PX = 4
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

const LABEL_PADDING = 16 // matches the label's horizontal padding in the CSS
const ICON_PADDING = 4 // an icon on its own can sit much closer to the edges
const ICON_GAP = 6
const ICON_MIN_PX = 11 // any smaller and it reads as a smudge, not a picture
const LABEL_MIN_LANE = 34 // a lane shorter than this has no room for a name
const ICON_GROWTH = 4 // the most an icon may outgrow its normal size
const ICON_OF_LANE = 0.44 // how much of the row's height an icon reaches for

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
 * The four corners of a block, as the polygon the selection is drawn with.
 * A block runs from its own lane down to the floor of the bar, so the whole
 * of that is outlined — including the part covered by whatever is layered
 * over it. That part is still the block, and seeing how far it reaches is the
 * point of selecting it.
 */
function silhouette([piece]) {
  const x1 = (piece.from / SLOTS_PER_DAY) * 100
  const x2 = (piece.to / SLOTS_PER_DAY) * 100
  const y = (piece.lane / piece.lanes) * 100
  return `${x1},${y} ${x2},${y} ${x2},100 ${x1},100`
}

/**
 * How to draw a block's label: how much of it fits, how big to draw the icon,
 * and how wide the result comes out. Returns { mode: 'full' | 'icon', iconPx,
 * widthPx }, or nothing when even an icon would be a smudge.
 *
 * The icon is sized to the room available rather than fixed, and grows with
 * the height of the row. It never gives that height back to make room for the
 * name: a small icon beside a name reads worse than a big icon on its own, so
 * when both won't fit at full size the name is what goes.
 *
 * A custom image is square; an emoji is text, so its width has to be measured
 * and scales with the size it is drawn at.
 */
function fitLabel(tag, fallback, widthPx, lanePx) {
  const room = widthPx - LABEL_PADDING
  if (!tag) {
    const width = textWidth(fallback)
    return width <= room ? { mode: 'full', iconPx: 0, widthPx: width + LABEL_PADDING } : null
  }

  const iconPx = baseIconPx()
  const base = iconPx * clampScale(tag.iconScale)
  const emojiWidth = textWidth(tag.icon) || iconPx
  // The tallest icon that fits a given width, and how wide one of a given
  // height comes out — not the same thing for an emoji, which is text.
  const sizeFor = (width) => (tag.image ? width : (width * iconPx) / emojiWidth)
  const widthAt = (px) => (tag.image ? px : emojiWidth * (px / iconPx))

  const wanted = Math.min(base * ICON_GROWTH, Math.max(base, lanePx * ICON_OF_LANE))
  // Never insist on more than the tag asked for: a deliberately small icon
  // shouldn't be dropped for being small.
  const floor = Math.min(ICON_MIN_PX, wanted)

  const withName = widthAt(wanted) + ICON_GAP + textWidth(tag.name)
  if (withName <= room) {
    return { mode: 'full', iconPx: wanted, widthPx: withName + LABEL_PADDING }
  }

  // Only now does the icon give any ground, and only because at this width
  // there is nothing else to give.
  const alone = Math.min(wanted, sizeFor(widthPx - ICON_PADDING))
  return alone >= floor
    ? { mode: 'icon', iconPx: alone, widthPx: widthAt(alone) + ICON_PADDING }
    : null
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

  // Pixel width of a bar. Labels need it to decide whether the tag name fits.
  const [trackWidth, setTrackWidth] = useState(0)
  useEffect(() => {
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
      setDragState({ mode: 'paint', date, trackEl, anchor: cell, cell, lane })
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
      setDragState({ mode: 'press', date, id: block.id, originX: e.clientX, originY: e.clientY })
    }
  }

  useEffect(() => {
    if (!drag) return

    const onMove = (e) => {
      const d = dragRef.current
      if (!d) return

      if (d.mode === 'paint') {
        const cell = cellFrom(d.trackEl, e.clientX)
        if (cell !== d.cell) setDragState({ ...d, cell })
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
        h.onPaint(d.date, {
          startSlot: Math.min(d.anchor, d.cell),
          endSlot: Math.max(d.anchor, d.cell) + 1,
          at: { slot: d.anchor, lane: d.lane },
        })
      } else if (d.mode === 'resize') {
        // Landing back on the same slot isn't a resize — it's a click on a
        // block too narrow to have anywhere else to click.
        if (d.startSlot === d.was.startSlot && d.endSlot === d.was.endSlot) {
          h.onSelect(d.date, d.id)
        } else {
          h.onResize(d.date, d.id, d.startSlot, d.endSlot)
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

  const paintPreview = drag?.mode === 'paint' && armedTag
    ? { startSlot: Math.min(drag.anchor, drag.cell), endSlot: Math.max(drag.anchor, drag.cell) + 1 }
    : null
  const resizing = drag?.mode === 'resize' ? drag : null
  const readoutRange = paintPreview ?? resizing
  const readoutTag = paintPreview
    ? armedTag
    : resizing && tagById(days[resizing.date]?.blocks.find((b) => b.id === resizing.id)?.tag)

  const hourTicks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]


  return (
    <div className={`daylist ${mode}`}>
      <div className="listbar">
        <div className="listreadout">
          {readoutRange ? (
            <>
              <span className="readout-tag" style={{ color: readoutTag?.colour }}>
                <TagIcon tag={readoutTag} />
                {readoutTag?.name}
              </span>
              <span className="readout-range">
                {slotToTime(readoutRange.startSlot)} – {slotToTime(readoutRange.endSlot)}
              </span>
              <span className="readout-dur">
                {formatDuration(readoutRange.endSlot - readoutRange.startSlot)}
              </span>
            </>
          ) : (
            <span className="readout-hint">
              {!isDay
                ? 'Click a day to open it · ctrl+scroll to resize'
                : armedTag
                  ? `Drag across ${formatDayHeading(armed.date)} to paint ${armedTag.name}`
                  : 'Pick a tag under a day to add time, click a block for its note · ctrl+scroll to resize'}
            </span>
          )}
        </div>

        {!isDay && (
          <div className="listruler">
            {hourTicks.map((h) => (
              <span key={h} className="ltick" style={{ left: `${(h / 24) * 100}%` }}>
                {String(h).padStart(2, '0')}
              </span>
            ))}
            <span className="ltick last" style={{ left: '100%' }}>24</span>
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
            ? applyResize(day?.blocks ?? [], resizing.id, resizing.startSlot, resizing.endSlot)
            : day?.blocks ?? []

          // While painting, lay the day out as it will be once the drag is
          // released — so the new block shows at the height it will land at,
          // and anything it overlaps shrinks to make room for it.
          let previewId = null
          if (paintPreview && drag.date === date) {
            const before = blocks
            blocks = applyPaint(
              before,
              {
                id: PREVIEW_ID,
                tag: armed.tag,
                startSlot: paintPreview.startSlot,
                endSlot: paintPreview.endSlot,
                note: '',
              },
              { slot: drag.anchor, lane: drag.lane },
            )
            // Usually the new block, but painting a tag over itself merges,
            // in which case the survivor is what changed.
            previewId = blocks.find((b) => {
              const was = before.find((o) => o.id === b.id)
              return !was || was.startSlot !== b.startSlot || was.endSlot !== b.endSlot
            })?.id ?? null
          }

          const pieces = layoutLanes(blocks)
          const selectedPieces = selected?.date === date
            ? pieces.filter((p) => p.block.id === selected.id)
            : []

          const track = (
            <div
              className={`track${dense ? ' dense' : ''}`}
              data-track-date={date}
              style={{ height: barHeight }}
            >
              {!dense && Array.from({ length: 23 }, (_, i) => (
                <div key={i} className="gridline" style={{ left: `${((i + 1) / 24) * 100}%` }} />
              ))}

              {day?.malformed ? (
                <span className="rowbroken">needs fixing in Obsidian</span>
              ) : pieces.map((piece) => {
                const b = piece.block
                const tag = tagById(b.tag)
                const widthPct = (piece.to - piece.from) * (100 / SLOTS_PER_DAY)
                const laneHeight = barHeight / piece.lanes
                const label = fitLabel(
                  tag, b.tag, ((piece.to - piece.from) / SLOTS_PER_DAY) * trackWidth, laneHeight,
                )
                return (
                  <div
                    key={`${b.id}:${piece.from}`}
                    data-block-id={b.id}
                    className={
                      'block' + (b.id === previewId ? ' preview' : '')
                    }
                    style={{
                      left: `${pct(piece.from)}%`,
                      width: `${pct(piece.to - piece.from)}%`,
                      // Every block runs from its own lane to the floor of the
                      // bar. Whatever is layered over it covers the lower part,
                      // so nothing is left standing in empty space. Inset only
                      // against the edges of the bar itself.
                      top: piece.lane === 0
                        ? 'var(--block-inset)'
                        : `${(piece.lane / piece.lanes) * 100}%`,
                      bottom: 'var(--block-inset)',
                      background: tag?.colour ?? '#555',
                    }}
                    title={`${tag?.name ?? b.tag} · ${slotToTime(b.startSlot)}–${slotToTime(b.endSlot)}${b.note ? `
${b.note}` : ''}`}
                  >
                    {laneHeight >= LABEL_MIN_LANE && label && (
                      // The name goes in the block's own lane — the band along
                      // its top that nothing else is drawn over.
                      <span
                        className="block-label"
                        style={{ height: `${100 / (piece.lanes - piece.lane)}%` }}
                      >
                        <TagIcon tag={tag} scale={label.iconPx / baseIconPx()} />
                        {label.mode === 'full' && (tag ? tag.name : b.tag)}
                      </span>
                    )}
                  </div>
                )
              })}

              {/* Handles are drawn over the blocks so they are never buried,
                  but only as tall as the block itself — a full-height strip
                  would reach into whatever is stacked above or below and steal
                  its clicks. A ten-minute block is narrower than two grab
                  strips, so they halve to fit; it ends up entirely covered,
                  which is why a press that goes nowhere opens the note instead
                  of counting as a resize. */}
              {isDay && !day?.malformed && !previewId && pieces.map((piece) => {
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
                      style={{ left: `${pct(b.startSlot)}%`, ...lane }}
                    />
                    <span
                      className="handle end"
                      data-block-id={b.id}
                      data-handle="end"
                      style={{ left: `${pct(b.endSlot)}%`, ...lane }}
                    />
                  </span>
                )
              })}

              {selectedPieces.length > 0 && (
                <svg className="selection" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <polygon points={silhouette(selectedPieces)} vectorEffect="non-scaling-stroke" />
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
              className={`daysection${isToday ? ' today' : ''}`}
            >
              <h2 className="dayhead">
                <span className="dayweekday">{weekdayOf(date)}</span>
                {formatDayHeading(date)}
                {isToday && <span className="todaymark">today</span>}
              </h2>

              {track}

              <div className="dayruler">
                {Array.from({ length: 25 }, (_, h) => (
                  <span
                    key={h}
                    className={`rtick${h % 2 === 0 ? ' major' : ''}`}
                    style={{ left: `${(h / 24) * 100}%` }}
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
                  {confirmWipe === date && 'Sure?'}
                </button>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
