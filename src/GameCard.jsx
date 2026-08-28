import { useEffect, useState } from 'react'
import { coverUrl, getPlayed } from './api.js'
import { COVER_ASPECT } from './game.js'
import { formatMinutes } from './time.js'

/**
 * The game a block was, beside the note about it.
 *
 * The cover at the size a cover deserves, the name, and then the two things
 * worth knowing that the block itself cannot say: what kind of game it is, and
 * how much of your life has gone into it — which is every session of it in the
 * vault added up, not just this one. This one is already in the heading above.
 */
export default function GameCard({ block, onChange, onRemove }) {
  const [played, setPlayed] = useState(null)

  // Asked for once per card. It is a count over every day in the vault, so it
  // cannot come from the days the list happens to be holding.
  useEffect(() => {
    let alive = true
    getPlayed()
      .then((all) => { if (alive) setPlayed(all[block.game] ?? null) })
      .catch(() => { if (alive) setPlayed(null) })
    return () => { alive = false }
  }, [block.game, block.startSlot, block.endSlot])

  // What it is sold on rather than what it was played on, which nothing here
  // can know — see the note in games.js. PC comes first.
  const platform = played?.platforms?.[0]
  const genre = played?.genres?.[0]
  const facts = [platform, genre].filter(Boolean)

  return (
    <div className="gamecard">
      {block.cover
        ? (
          <img
            className="gamecover"
            style={{ '--cover-aspect': COVER_ASPECT }}
            src={coverUrl(block.cover)}
            alt=""
          />
        )
        : <span className="gamecover none" aria-hidden="true">🎮</span>}

      <div className="gamefacts">
        <span className="gamename">{block.game}</span>
        {/* The rule under the name, with the same mark the rest of the app
            uses for a small ornament. Decoration, so it is not read out. */}
        <span className="gamerule" aria-hidden="true"><i /></span>

        {facts.length > 0 && (
          <span className="gamestat" title={playedOn(played)}>
            <ScreenIcon />
            {facts.join(' · ')}
          </span>
        )}
        {played && (
          <span className="gamestat" title={spanOf(played)}>
            <ClockIcon />
            {formatMinutes(played.minutes)}
          </span>
        )}

        <span className="gamecardbtns">
          <button type="button" className="notebtn" onClick={onChange}>Change</button>
          <button type="button" className="notebtn" onClick={onRemove}>Remove</button>
        </span>
      </div>
    </div>
  )
}

/** Everything it is sold on, for the line that only has room for the first. */
function playedOn(played) {
  const all = played?.platforms ?? []
  if (all.length < 2) return undefined
  return `On ${all.join(', ')}`
}

/** How many days the total is spread over, and between which of them. */
function spanOf(played) {
  if (!played?.days) return undefined
  const days = played.days === 1 ? 'one day' : `${played.days} days`
  return played.first === played.last
    ? `All of it on ${played.first}`
    : `Across ${days}, ${played.first} to ${played.last}`
}

function ScreenIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
      <path d="M6 14h4M8 11.5V14" strokeLinecap="round" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.6V8l2.4 1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
