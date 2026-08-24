import { useCallback, useEffect, useRef, useState } from 'react'
import DayList, { ZOOM } from './DayList.jsx'
import NotePanel from './NotePanel.jsx'
import { useDays } from './useDays.js'
import { getTags } from './api.js'
import { applyPaint, applyResize, removeBlock, setNote, newId, overlapCluster } from './blocks.js'
import { todayISO } from './time.js'

const zoomKey = (mode) => `daily-documenter:zoom:${mode}`

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

  const [zoom, setZoom] = useState(() => ({
    day: storedZoom('day'),
    compact: storedZoom('compact'),
  }))

  const { days, ensure, editDay, status, problem } = useDays()

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

  function handlePaint(date, { startSlot, endSlot }) {
    if (!armed || armed.date !== date) return
    editDay(date, (prev) =>
      applyPaint(prev, { id: newId(), tag: armed.tag, startSlot, endSlot, note: '' }))
    setArmed(null)
  }

  const handleResize = (date, id, startSlot, endSlot) =>
    editDay(date, (prev) => applyResize(prev, id, startSlot, endSlot))

  const dayBlocks = selected ? days[selected.date]?.blocks ?? [] : []
  const selectedBlock = selected ? dayBlocks.find((b) => b.id === selected.id) ?? null : null
  // Everything running alongside it shares one note.
  const selectedCluster = selectedBlock ? overlapCluster(dayBlocks, selected.id) : []

  return (
    <div className="app">
      <header>
        <div className="titlerow">
          <h1>Daily Documentation</h1>

          <div className="viewswitch">
            <button className={view === 'day' ? 'on' : ''} onClick={() => setView('day')}>Day</button>
            <button className={view === 'compact' ? 'on' : ''} onClick={() => setView('compact')}>Overview</button>
          </div>

          <button className="control nav today" onClick={() => setJumpTo(todayISO())}>Today</button>
          <input
            className="datepick"
            type="date"
            onChange={(e) => e.target.value && setJumpTo(e.target.value)}
          />
          <span className={`status ${status}`}>{
            { loading: 'loading…', saving: 'saving…', saved: 'saved', error: 'not saved', idle: '' }[status]
          }</span>
        </div>
      </header>

      {tagError && <div className="banner offline">Couldn't load tags.json — {tagError}</div>}
      {problem && <div className={`banner ${problem.kind}`}>{problem.message}</div>}

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
        jumpTo={jumpTo}
        onJumped={() => setJumpTo(null)}
      />

      {selectedBlock && (
        <NotePanel
          block={selectedBlock}
          cluster={selectedCluster}
          date={selected.date}
          tags={tags}
          onNote={(id, note) => editDay(selected.date, (prev) => setNote(prev, id, note))}
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
