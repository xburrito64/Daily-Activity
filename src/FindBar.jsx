import { useEffect, useRef } from 'react'

/**
 * Find, the way find works everywhere else.
 *
 * Ctrl+F opens it, what you type lights up on the bars, and the arrows walk
 * you through the matches one at a time with a count beside them. Nothing
 * here is clever: the point of a find bar is that you already know how to use
 * it before you have used it.
 *
 * The order is the one every browser uses — box, count, back, forward, close —
 * because muscle memory is the whole feature.
 */

/** Up and down: the same hairline weight as the marks on the cards. */
function Chevron({ up }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path
        d={up ? 'M3.5 10 8 5.5 12.5 10' : 'M3.5 6 8 10.5 12.5 6'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function Cross() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
    </svg>
  )
}

export default function FindBar({ query, hits, at, onQuery, onStep, onClose }) {
  const box = useRef(null)

  // Opened to be typed in. Selecting what is already there means a second
  // Ctrl+F replaces the last search rather than appending to it.
  useEffect(() => {
    box.current?.focus()
    box.current?.select()
  }, [])

  const searched = query.trim() !== ''
  const none = searched && hits.length === 0

  function onKeyDown(e) {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return }
    if (e.key === 'Enter') { e.preventDefault(); onStep(e.shiftKey ? -1 : 1); return }
    // Nothing for a caret to do in a one-line box, so the arrows are free.
    if (e.key === 'ArrowDown') { e.preventDefault(); onStep(1) }
    if (e.key === 'ArrowUp') { e.preventDefault(); onStep(-1) }
  }

  return (
    <div className="findbar" role="search">
      <input
        ref={box}
        type="text"
        className={`findbox${none ? ' none' : ''}`}
        value={query}
        placeholder="Find a game, a show, a tag, a note"
        spellCheck="false"
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={onKeyDown}
      />

      <span className={`findcount${none ? ' none' : ''}`}>
        {!searched ? '' : none ? 'nothing' : `${at + 1}/${hits.length}`}
      </span>

      <button
        type="button"
        className="findstep"
        disabled={hits.length === 0}
        title="Previous — shift+enter"
        onClick={() => onStep(-1)}
      >
        <Chevron up />
      </button>
      <button
        type="button"
        className="findstep"
        disabled={hits.length === 0}
        title="Next — enter"
        onClick={() => onStep(1)}
      >
        <Chevron />
      </button>
      <button type="button" className="findstep close" title="Close — esc" onClick={onClose}>
        <Cross />
      </button>
    </div>
  )
}
