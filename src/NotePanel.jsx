import { useEffect, useRef } from 'react'
import { slotToTime, formatDuration } from './time.js'

/**
 * One note for everything overlapping at that moment. `cluster` is the whole
 * group (earliest first, which is the one holding the text); `block` is the
 * one actually clicked, which is what Delete removes.
 */
export default function NotePanel({ cluster, block, date, tags, onNote, onDelete, onClose }) {
  const area = useRef(null)
  const tagFor = (id) => tags.find((t) => t.id === id)

  const owner = cluster[0]
  const from = Math.min(...cluster.map((b) => b.startSlot))
  const to = Math.max(...cluster.map((b) => b.endSlot))
  const clickedTag = tagFor(block.tag)

  // Opening the panel should put the cursor straight in the text. Keyed on the
  // group, so clicking between halves of one note doesn't yank the cursor.
  useEffect(() => { area.current?.focus() }, [owner.id])

  return (
    <div className="notepanel">
      <div className="notehead">
        {cluster.map((b) => {
          const tag = tagFor(b.tag)
          return (
            <span
              key={b.id}
              className={`notetag${b.id === block.id ? ' current' : ''}`}
              style={{ color: tag?.colour }}
              title={`${slotToTime(b.startSlot)} – ${slotToTime(b.endSlot)}`}
            >
              {tag ? `${tag.icon} ${tag.name}` : b.tag}
            </span>
          )
        })}

        <span className="notedate">{date}</span>
        <span className="notetime">{slotToTime(from)} – {slotToTime(to)}</span>
        <span className="notedur">{formatDuration(to - from)}</span>

        <button
          className="notebtn danger"
          onClick={onDelete}
          title={`Remove the ${clickedTag?.name ?? block.tag} block`}
        >
          Delete {cluster.length > 1 ? (clickedTag?.name ?? block.tag) : ''}
        </button>
        <button className="notebtn" onClick={onClose}>Close</button>
      </div>

      <textarea
        ref={area}
        className="notetext"
        placeholder="Anything worth remembering about this…"
        value={owner.note ?? ''}
        onChange={(e) => onNote(owner.id, e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}
      />
    </div>
  )
}
