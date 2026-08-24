import { formatDuration, formatShortDate, daysBetween, shiftDate } from './time.js'
import TagIcon from './TagIcon.jsx'

/**
 * How the days currently on screen were spent. Blocks are allowed to overlap,
 * so an hour spent gaming while music was on counts towards both — which
 * means the total can come to more than the days themselves.
 */
export default function Totals({ days, tags, range }) {
  if (!range) return null

  const span = daysBetween(range.from, range.to) + 1
  const slots = new Map()
  let logged = 0
  let busiest = 0

  for (let i = 0; i < span; i++) {
    const day = days[shiftDate(range.from, i)]
    if (!day || day.malformed || day.blocks.length === 0) continue
    logged++
    for (const b of day.blocks) {
      const next = (slots.get(b.tag) ?? 0) + (b.endSlot - b.startSlot)
      slots.set(b.tag, next)
      if (next > busiest) busiest = next
    }
  }

  const rows = tags
    .filter((t) => slots.get(t.id))
    .map((t) => ({ tag: t, slots: slots.get(t.id) }))
    .sort((a, b) => b.slots - a.slots)

  return (
    <aside className="totals">
      <div className="totalshead">
        <span className="totalsrange">
          {formatShortDate(range.from)} – {formatShortDate(range.to)}
        </span>
        <span className="totalsdays">
          {span} {span === 1 ? 'day' : 'days'} · {logged} logged
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="totalsempty">Nothing logged in view.</p>
      ) : (
        <ul className="totalslist">
          {rows.map(({ tag, slots: amount }) => (
            <li key={tag.id} className="totalsrow">
              <span className="totalsname">
                <TagIcon tag={tag} />
                <span className="totalslabel">{tag.name}</span>
                <span className="totalstime">{formatDuration(amount)}</span>
              </span>
              <span className="totalsbar">
                <span
                  className="totalsfill"
                  style={{ width: `${(amount / busiest) * 100}%`, background: tag.colour }}
                />
              </span>
              <span className="totalsavg">
                {/* Averaged over the days that actually have something in
                    them — dividing by empty days just reads as zero. */}
                {formatDuration(Math.round(amount / Math.max(1, logged)))}
                {logged === span ? ' / day' : ' / logged day'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}
