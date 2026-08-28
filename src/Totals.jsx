import { formatDuration, formatShortDate, daysBetween, shiftDate } from './time.js'
import { coverUrl } from './api.js'
import { COVER_ASPECT } from './face.js'
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
  // What was played and what was watched, by name rather than by tag. "Game:
  // nineteen hours" is a number; the list of games is the week. Two lists,
  // because playing and watching are two things you did.
  const played = new Map()
  const watched = new Map()
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

      // The first cover seen wins. One of these has only one, and a block
      // logged before the cover was kept simply hasn't got it to offer.
      const name = b.game || b.show
      if (!name) continue
      const into = b.game ? played : watched
      const had = into.get(name) ?? { slots: 0, cover: '', episodes: 0 }
      into.set(name, {
        slots: had.slots + (b.endSlot - b.startSlot),
        cover: had.cover || b.cover,
        // Counted rather than listed: over a week the interesting number is
        // how many, and which ones is a question for the day itself.
        episodes: had.episodes + (b.episodes?.length ?? 0),
      })
    }
  }

  const rows = tags
    .filter((t) => slots.get(t.id))
    .map((t) => ({ tag: t, slots: slots.get(t.id) }))
    .sort((a, b) => b.slots - a.slots)

  const listOf = (map) => [...map]
    .map(([name, what]) => ({ name, ...what }))
    .sort((a, b) => b.slots - a.slots)
  const games = listOf(played)
  const shows = listOf(watched)

  return (
    <aside className="totals">
      <div className="totalshead">
        <span className="eyebrow">Ledger of hours</span>
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

      {/* Under the hours rather than among them: this is the same time said
          again, broken into what it was actually spent on. */}
      <Shelf title="What you played" rows={games} blank="🎮" />
      <Shelf title="What you watched" rows={shows} blank="🌸" />
    </aside>
  )
}

/**
 * One list of covers with a name and a total beside each.
 *
 * The same shelf twice: what was played and what was watched are the same
 * kind of answer to the same kind of question, and the day they are drawn
 * differently is the day the ledger stops reading as one page.
 */
function Shelf({ title, rows, blank }) {
  if (rows.length === 0) return null
  return (
    <div className="played">
      <span className="eyebrow">{title}</span>
      <ul className="playedlist">
        {rows.map((row) => (
          <li key={row.name} className="playedrow">
            {row.cover
              ? (
                <img
                  className="playedcover"
                  style={{ '--cover-aspect': COVER_ASPECT }}
                  src={coverUrl(row.cover)}
                  alt=""
                />
              )
              : <span className="playedcover none" aria-hidden="true">{blank}</span>}
            <span className="playedname">{row.name}</span>
            <span className="playedtime">
              {formatDuration(row.slots)}
              {row.episodes > 0 && (
                <b className="playedeps">
                  {row.episodes} ep{row.episodes === 1 ? '' : 's'}
                </b>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
