import { useCallback, useEffect, useRef, useState } from 'react'
import DayList, { ZOOM } from './DayList.jsx'
import NotePanel from './NotePanel.jsx'
import Totals from './Totals.jsx'
import { useDays } from './useDays.js'
import { getTags } from './api.js'
import { applyPaint, applyResize, removeBlock, setNote, setGame, newId, overlapCluster } from './blocks.js'
import { todayISO, formatDotted } from './time.js'

const zoomKey = (mode) => `daily-documenter:zoom:${mode}`

// "not saved" stays plain — it is the one of these you need to act on, and
// the chronicle voice is the wrong register for a problem.
const STATUS_WORDS = {
  loading: 'loading…',
  saving: 'inscribing…',
  saved: 'inscribed',
  error: 'not saved',
  idle: '',
}

/** The save state, as a word and a lit dot that agree with each other. */
function Status({ status }) {
  const word = STATUS_WORDS[status]
  return (
    <span className={`status ${status}`}>
      {word && <i className="statusdot" />}
      {word}
    </span>
  )
}

/**
 * Whether Delete would have nothing to do in this box: no selection, and the
 * cursor already at the end of what is written.
 *
 * Asked of the box rather than assumed from its kind, because a date field
 * has no cursor to ask about and throws when you try — which is a no, not a
 * crash.
 */
function nothingAhead(el) {
  try {
    return el.selectionStart === el.selectionEnd && el.selectionStart === el.value.length
  } catch {
    return false
  }
}

const storedZoom = (mode) => {
  const saved = Number(localStorage.getItem(zoomKey(mode)))
  const limits = ZOOM[mode]
  return saved >= limits.min && saved <= limits.max ? saved : limits.start
}

export default function App() {
  const [view, setView] = useState('day') // day | compact
  const [tags, setTags] = useState([])
  const [tagError, setTagError] = useState(null)
  const [armed, setArmed] = useState(null) // { date, tag } — a tag armed for one day
  const [selected, setSelected] = useState(null) // { date, id }
  const [jumpTo, setJumpTo] = useState(null)
  const [visible, setVisible] = useState(null) // days currently on screen
  // Read from a keyboard handler that should not be torn down and rebuilt
  // every time the list scrolls.
  const visibleRef = useRef(visible)
  visibleRef.current = visible

  const [zoom, setZoom] = useState(() => ({
    day: storedZoom('day'),
    compact: storedZoom('compact'),
  }))

  const { days, ensure, editDay, editDays, undo, status, problem } = useDays()

  useEffect(() => {
    getTags().then(setTags).catch((err) => setTagError(err.message))
  }, [])

  // Escape disarms, then closes the note.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (armed) setArmed(null)
      else setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [armed])

  // Delete removes the block whose note is open. Same change the button in the
  // note makes, so ctrl+z takes it back the same way.
  useEffect(() => {
    if (!selected) return
    const onKey = (e) => {
      if (e.key !== 'Delete') return
      // Delete belongs to the text you are writing — but only while there is
      // text for it to take. Sitting in a box with nothing in front of the
      // cursor it does nothing at all, and having to click out of a box that
      // was going to ignore the key anyway is a step for no reason.
      const el = e.target
      const typing = el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement
      if (typing && !nothingAhead(el)) return
      e.preventDefault()
      editDay(selected.date, (prev) => removeBlock(prev, selected.id))
      setSelected(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selected, editDay])

  // Ctrl+Z puts the last change back — a mispainted block, a wrong slide, a
  // delete, a whole day cleared. Everything that changes a day goes through
  // one place, so everything that changes a day can be taken back.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'z' && e.key !== 'Z') return
      if (!e.ctrlKey && !e.metaKey) return
      // In the note, Ctrl+Z belongs to the text you are writing.
      const el = e.target
      if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return
      e.preventDefault()
      const date = undo()
      if (!date) return
      // Go and look at it, but only if it happened somewhere you can't see.
      // Undoing something already in front of you should not also throw the
      // list around.
      const seen = visibleRef.current
      if (!seen || date < seen.from || date > seen.to) setJumpTo(date)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])

  useEffect(() => { setArmed(null) }, [view])

  // handleZoom lives inside a wheel listener, so it reads the current view
  // from a ref rather than a stale closure.
  const viewRef = useRef(view)
  viewRef.current = view

  const handleZoom = useCallback((next) => {
    const mode = viewRef.current
    localStorage.setItem(zoomKey(mode), String(next))
    setZoom((z) => ({ ...z, [mode]: next }))
  }, [])

  const handleArm = useCallback((date, tag) => {
    setArmed((a) => (a && a.date === date && a.tag === tag ? null : { date, tag }))
  }, [])

  /**
   * Commit a painted stretch. Usually one day; more when it ran past
   * midnight, which a day file cannot hold, so it lands as one block per day.
   *
   * All of them go in as a single act, so one ctrl+z takes the whole stretch
   * back rather than half of it.
   *
   * `at` is where the pointer went down: it decides whether the new block
   * lands above or below whatever is already there.
   */
  function handlePaint(date, spans, at) {
    if (!armed || armed.date !== date) return
    editDays(spans.map((span) => ({
      date: span.date,
      update: (prev) => applyPaint(prev, {
        id: newId(),
        tag: armed.tag,
        startSlot: span.startSlot,
        endSlot: span.endSlot,
        note: '',
      }, { slot: span.date === date ? at.slot : span.startSlot, lane: at.lane }),
    })))
    setArmed(null)
  }

  /**
   * Say what a Game block was, or take the name back off.
   *
   * Naming one can fold it into a stretch of the same game it was already
   * touching, and the survivor of that is the other block. So the note
   * follows it in rather than closing on an id that no longer exists — from
   * where you are sitting nothing was deleted, two things became one.
   */
  function handleGame(id, game) {
    const date = selected.date
    const before = days[date]?.blocks ?? []
    const after = setGame(before, id, game)
    editDay(date, after)

    if (after.some((b) => b.id === id)) return
    const was = before.find((b) => b.id === id)
    const survivor = was && after.find((b) => (
      b.tag === was.tag && b.startSlot <= was.startSlot && b.endSlot >= was.endSlot
    ))
    if (survivor) setSelected({ date, id: survivor.id })
  }

  // `at` is only there when the whole block was slid: it is the height the
  // pointer was holding it at. Dragging an edge sends nothing, and keeps the
  // height it already had.
  const handleResize = (date, id, startSlot, endSlot, at) =>
    editDay(date, (prev) => applyResize(prev, id, startSlot, endSlot, at))

  // Days you have actually written something on — the count under the title.
  // Only the loaded window is in `days`, which is the window you have
  // scrolled through, so it grows as you go rather than being the true total.
  const recorded = Object.values(days).filter((d) => !d.malformed && d.blocks.length > 0).length

  // Whatever day is at the top of the list, or today before anything has
  // been scrolled. It is what the picker shows and what it opens on.
  const shownDate = visible?.from ?? todayISO()

  const dayBlocks = selected ? days[selected.date]?.blocks ?? [] : []
  const selectedBlock = selected ? dayBlocks.find((b) => b.id === selected.id) ?? null : null
  // Named across the top of the note, so you can see what else was running.
  const selectedCluster = selectedBlock ? overlapCluster(dayBlocks, selected.id) : []

  return (
    <div className="app">
      {/* The sky. Each layer is a size of star with its own rate and its own
          brightness — see app.css. Decoration only, so it is hidden from
          anything reading the page. */}
      <div className="sky" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i />
      </div>

      <header>
        <div className="titlerow">
          <div className="titleblock">
            <h1>Daily Documentation</h1>
            <span className="subtitle">
              {recorded === 1 ? 'one day recorded' : `${recorded} days recorded`}
            </span>
          </div>

          <div className="viewswitch">
            <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>Day</button>
            <button className={view === 'compact' ? 'on' : ''} onClick={() => setView('compact')}>Overview</button>
          </div>

          <button className="control nav today" onClick={() => setJumpTo(todayISO())}>Today</button>
          {/* The date reads as a date rather than as an empty form field, and
              says which day you are looking at rather than nothing at all. The
              real input is laid over it, invisible, so the calendar is still
              one click away — the native one cannot be made to look like this,
              but it can be made to sit behind something that does. */}
          <label className="datepick">
            <span className="datetext">{formatDotted(shownDate)}</span>
            <input
              type="date"
              value={shownDate}
              onChange={(e) => e.target.value && setJumpTo(e.target.value)}
              onClick={(e) => e.currentTarget.showPicker?.()}
            />
          </label>
          <Status status={status} />
        </div>
      </header>

      <div className="goldrule" />

      {tagError && <div className="banner offline">Couldn't load tags.json — {tagError}</div>}
      {problem && <div className={`banner ${problem.kind}`}>{problem.message}</div>}

      <div className={`workspace ${view}`}>
        <DayList
        mode={view}
        days={days}
        tags={tags}
        ensure={ensure}
        armed={view === 'day' ? armed : null}
        onArm={handleArm}
        selected={selected}
        barHeight={zoom[view]}
        onZoom={handleZoom}
        onPaint={handlePaint}
        onResize={handleResize}
        onSelect={(date, id) => setSelected({ date, id })}
        onPickDay={(date) => { setView('day'); setJumpTo(date) }}
        onWipeDay={(date) => {
          editDay(date, () => [])
          setSelected((sel) => (sel?.date === date ? null : sel))
        }}
        onVisibleRange={setVisible}
        jumpTo={jumpTo}
        onJumped={() => setJumpTo(null)}
        />
        {view === 'compact' && <Totals days={days} tags={tags} range={visible} />}
      </div>

      {selectedBlock && (
        <NotePanel
          block={selectedBlock}
          cluster={selectedCluster}
          date={selected.date}
          tags={tags}
          onNote={(id, note) => editDay(selected.date, (prev) => setNote(prev, id, note))}
          onGame={handleGame}
          onDelete={() => {
            editDay(selected.date, (prev) => removeBlock(prev, selected.id))
            setSelected(null)
          }}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
