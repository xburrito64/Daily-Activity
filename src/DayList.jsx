import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  SLOTS_PER_DAY, slotToTime, formatDuration, shiftDate, todayISO, daysBetween,
  formatDayHeading, formatShortDate, weekdayOf, dayOfWeek,
} from './time.js'
import { applyResize, layoutLanes } from './blocks.js'

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
  const topDate = useRef(today)
  const lastMode = useRef(mode)

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
      pendingAnchor.current = { date: topDate.current, offset: 0 }
    }

    const anchor = pendingAnchor.current
    if (!anchor) return
    // rowTotal is still a guess for this view; wait for the real measurement
    // rather than scrolling to a position computed from the wrong height.
    if (!chromeReady) return
    pendingAnchor.current = null

    const i = dates.indexOf(anchor.date)
    if (i < 0) return
    el.scrollTop = anchor.cursorY == null
      ? i * rowTotal + anchor.offset
      : (i + anchor.frac) * rowTotal - anchor.cursorY
  }, [dates.length, rowTotal, mode, chromeReady])

  // Short rows can leave the loaded window shorter than the viewport, which
  // means nothing to scroll. Keep at least two screens' worth loaded.
  useEffect(() => {
    const el = scrollRef.current
    if (!el || dates.length > 800) return
    if (el.scrollHeight >= el.clientHeight * 2) return
    pendingAnchor.current = { date: topDate.current, offset: 0 }
    setRange((r) => ({ start: shiftDate(r.start, -CHUNK), end: shiftDate(r.end, CHUNK) }))
  }, [dates.length, rowTotal])

  // Open with today at the top: the past above, the future below.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el || didInitialScroll.current || dates.length === 0 || !chromeReady) return
    const i = dates.indexOf(today)
    if (i < 0) return
    el.scrollTop = i * rowTotal
    topDate.current = today
    didInitialScroll.current = true
  }, [dates, rowTotal, today, chromeReady])

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return

    const h = rowTotalRef.current
    const index = Math.max(0, Math.floor(el.scrollTop / h))
    // Mid-correction the scroll position isn't a truthful answer to
    // "which day are you looking at", so don't record it.
    const atTop = datesRef.current[index]
    if (atTop && !pendingAnchor.current) topDate.current = atTop

    if (el.scrollTop < EDGE_PX) {
      if (atTop) pendingAnchor.current = { date: atTop, offset: el.scrollTop - index * h }
      setRange((r) => ({ ...r, start: shiftDate(r.start, -CHUNK) }))
    } else if (el.scrollHeight - el.scrollTop - el.clientHeight < EDGE_PX) {
      setRange((r) => ({ ...r, end: shiftDate(r.end, CHUNK) }))
    }
  }, [])

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
      setDragState({ mode: 'paint', date, trackEl, anchor: cell, cell })
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
        })
      } else if (d.mode === 'resize') {
        h.onResize(d.date, d.id, d.startSlot, d.endSlot)
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
    const el = scrollRef.current
    if (el) el.scrollTop = daysBetween(range.start, jumpTo) * rowTotal
    topDate.current = jumpTo
    onJumped()
  }, [jumpTo, range.start, range.end, rowTotal, onJumped])

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
                {readoutTag && `${readoutTag.icon} ${readoutTag.name}`}
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
          const blocks = resizing?.date === date
            ? applyResize(day?.blocks ?? [], resizing.id, resizing.startSlot, resizing.endSlot)
            : day?.blocks ?? []

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
              ) : layoutLanes(blocks).map((piece) => {
                const b = piece.block
                const tag = tagById(b.tag)
                const widthPct = (piece.to - piece.from) * (100 / SLOTS_PER_DAY)
                const laneHeight = barHeight / piece.lanes
                const isSelected = selected?.date === date && selected?.id === b.id
                return (
                  <div
                    key={`${b.id}:${piece.from}`}
                    data-block-id={b.id}
                    className={
                      `block${isSelected ? ' selected' : ''}` +
                      // square off the ends where this block carries on
                      `${piece.isFirst ? '' : ' joined-start'}${piece.isLast ? '' : ' joined-end'}`
                    }
                    style={{
                      left: `${pct(piece.from)}%`,
                      width: `${pct(piece.to - piece.from)}%`,
                      top: `calc(${(piece.lane / piece.lanes) * 100}% + var(--block-inset))`,
                      height: `calc(${100 / piece.lanes}% - var(--block-inset) * 2)`,
                      background: tag?.colour ?? '#555',
                    }}
                    title={`${tag?.name ?? b.tag} · ${slotToTime(b.startSlot)}–${slotToTime(b.endSlot)}${b.note ? `
${b.note}` : ''}`}
                  >
                    {isDay && piece.isFirst && widthPct > 2 && (
                      <span className="handle start" data-handle="start" />
                    )}
                    {piece.isLabel && laneHeight >= 34 && (
                      <span className="block-label">{tag ? `${tag.icon} ${tag.name}` : b.tag}</span>
                    )}
                    {isDay && piece.isLast && widthPct > 2 && (
                      <span className="handle end" data-handle="end" />
                    )}
                  </div>
                )
              })}

              {paintPreview && drag.date === date && (
                <div
                  className="block preview"
                  style={{
                    left: `${pct(paintPreview.startSlot)}%`,
                    width: `${pct(paintPreview.endSlot - paintPreview.startSlot)}%`,
                    background: armedTag.colour,
                  }}
                />
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
                    <span className="chip-icon">{t.icon}</span>
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
