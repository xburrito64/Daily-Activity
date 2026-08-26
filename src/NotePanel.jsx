import { useEffect, useRef } from 'react'
import { slotToTime, formatDuration } from './time.js'
import TagIcon from './TagIcon.jsx'

/**
 * The note for one block. `block` is the one clicked — its own text, its own
 * times, and what Delete removes. `cluster` is everything overlapping it, listed
 * across the top so you can see what else was running at the same time.
 */
export default function NotePanel({ cluster, block, date, tags, onNote, onDelete, onClose }) {
  const area = useRef(null)
  const tagFor = (id) => tags.find((t) => t.id === id)

  const clickedTag = tagFor(block.tag)

  // Opening the panel should put the cursor straight in the text.
  useEffect(() => { area.current?.focus() }, [block.id])

  return (
    <div className="notepanel">
      <div className="notehead">
        {cluster.map((b) => {
          const tag = tagFor(b.tag)
          return (
            <span
              key={b.id}
              className={`notetag${b.id === block.id ? ' current' : ''}`}
              style={{ '--tag': tag?.colour }}
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

      <textarea
        ref={area}
        className="notetext"
        placeholder="Anything worth remembering about this…"
        value={block.note ?? ''}
        onChange={(e) => onNote(block.id, e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      />
    </div>
  )
}
