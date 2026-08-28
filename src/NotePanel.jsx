import { useEffect, useRef, useState } from 'react'
import { slotToTime, formatDuration } from './time.js'
import { gameFace } from './game.js'
import GameSearch from './GameSearch.jsx'
import GameCard from './GameCard.jsx'
import TagIcon from './TagIcon.jsx'

/** Only Game blocks ask what they were. */
const SEARCHABLE = 'game'

/**
 * The note for one block. `block` is the one clicked — its own text, its own
 * times, and what Delete removes. `cluster` is everything overlapping it, listed
 * across the top so you can see what else was running at the same time.
 */
export default function NotePanel({ cluster, block, date, tags, onNote, onGame, onDelete, onClose }) {
  const area = useRef(null)
  const tagFor = (id) => tags.find((t) => t.id === id)

  const clickedTag = tagFor(block.tag)
  const searchable = block.tag === SEARCHABLE

  // Asking to change a game opens the search back over it without taking it
  // off first: a search that finds nothing should leave you where you were
  // rather than having thrown away what you had.
  const [changing, setChanging] = useState(false)
  useEffect(() => { setChanging(false) }, [block.id])

  const searching = searchable && (!block.game || changing)
  // A game block with nothing attached opens on the question, not on the
  // note: naming what you played is the thing you came here to do, and the
  // note is still one tab away.
  const askFirst = searchable && !block.game

  // Opening the panel should put the cursor straight in the text — unless the
  // search is going to want it.
  //
  // On opening, and only on opening. Attaching a game turns the question off,
  // and following that with the cursor would drag it into the note nobody
  // asked to write — and take ctrl+z with it, which at that moment means
  // "not that one", and is the first thing you would reach for.
  const opened = useRef(null)
  useEffect(() => {
    const fresh = opened.current !== block.id
    opened.current = block.id
    if (fresh && !askFirst) area.current?.focus()
  }, [block.id, askFirst])

  return (
    <div className="notepanel">
      <div className="notehead">
        {cluster.map((b) => {
          const tag = gameFace(tagFor(b.tag), b)
          return (
            <span
              key={b.id}
              className={`notetag${b.id === block.id ? ' current' : ''}`}
              style={{ '--tag': tagFor(b.tag)?.colour }}
              title={`${slotToTime(b.startSlot)} – ${slotToTime(b.endSlot)}`}
            >
              <TagIcon tag={tag} />
              {tag ? tag.name : b.tag}
            </span>
          )
        })}

        <span className="notedate">{date}</span>
        {/* The clicked block's own hours, not the whole overlap's. */}
        <span className="notetime">{slotToTime(block.startSlot)} – {slotToTime(block.endSlot)}</span>
        <span className="notedur">{formatDuration(block.endSlot - block.startSlot)}</span>

        <button
          className="notebtn danger"
          onClick={onDelete}
          title={`Remove the ${clickedTag?.name ?? block.tag} block — or press Delete`}
        >
          Delete {cluster.length > 1 ? (clickedTag?.name ?? block.tag) : ''}
        </button>
        <button className="notebtn" onClick={onClose}>Close</button>
      </div>

      {/* One column for the game and one for the note, whichever state the
          game is in. Looking for one and having found one are two things to
          see in the same place, and the panel changing shape between them
          reads as having landed somewhere else.

          Keyed on the block, so clicking a different one starts a fresh search
          rather than showing the last block's results under it. */}
      <div className="notebody">
        {searchable && (searching ? (
          <GameSearch
            key={block.id}
            block={block}
            onAttach={(game) => { setChanging(false); onGame(block.id, game) }}
            onCancel={() => setChanging(false)}
          />
        ) : (
          <GameCard
            key={block.id}
            block={block}
            onChange={() => setChanging(true)}
            onRemove={() => onGame(block.id, null)}
          />
        ))}
        <textarea
          ref={area}
          className="notetext"
          placeholder="Anything worth remembering about this…"
          value={block.note ?? ''}
          onChange={(e) => onNote(block.id, e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
        />
      </div>
    </div>
  )
}
