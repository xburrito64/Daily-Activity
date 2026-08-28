import { useEffect, useRef, useState } from 'react'
import { coverUrl, getPlayed, setGenres } from './api.js'
import { COVER_ASPECT } from './game.js'
import { formatMinutes } from './time.js'

// Kept level with MAX_GENRES in server/games.js: the server is the one that
// enforces it, this only stops the + offering a slot there is no room for.
const MAX_GENRES = 6

/**
 * The game a block was, beside the note about it.
 *
 * The cover at the size a cover deserves, the name, and then the things worth
 * knowing that the block itself cannot say: what it is on, what kind of game
 * it is, and how much of your life has gone into it — which is every session
 * of it in the vault added up, not just this one. This one is already in the
 * heading above.
 */
export default function GameCard({ block, onChange, onRemove }) {
  const [played, setPlayed] = useState(null)
  // Held here as well as on disk so a genre appears the moment you add it,
  // rather than after a round trip.
  const [genres, setLocalGenres] = useState(null)
  const [adding, setAdding] = useState(false)
  // Off by default. A card is for looking at; the handles for changing it are
  // clutter every time you are not changing it, which is nearly always.
  const [editing, setEditing] = useState(false)

  // Asked for once per card. It is a count over every day in the vault, so it
  // cannot come from the days the list happens to be holding.
  useEffect(() => {
    let alive = true
    getPlayed()
      .then((all) => {
        if (!alive) return
        setPlayed(all[block.game] ?? null)
        setLocalGenres(all[block.game]?.genres ?? [])
      })
      .catch(() => { if (alive) setPlayed(null) })
    return () => { alive = false }
  }, [block.game, block.startSlot, block.endSlot])

  function keep(next) {
    setLocalGenres(next)
    setAdding(false)
    // Nothing to do if it fails: the list on disk simply stays as it was, and
    // reopening the card shows that. Not worth a banner over the whole app.
    setGenres(block.game, next).catch(() => {})
  }

  // What it is sold on rather than what it was played on, which nothing here
  // can know — see the note in games.js. PC comes first.
  const platform = played?.platforms?.[0]
  const shown = genres ?? []

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

        {platform && (
          <span className="gamestat" title={playedOn(played)}>
            <ScreenIcon />
            {platform}
          </span>
        )}

        {/* Read as a line of text, edited as a row of chips. A chip is a
            handle, and a handle you are not reaching for is clutter — but
            there is no way to take one thing off a line of text. */}
        {(shown.length > 0 || editing) && (
          <span className={`gamestat genres${editing ? ' editing' : ''}`}>
            <TagsIcon />
            {editing ? (
              <span className="genrelist">
                {shown.map((genre) => (
                  <span className="genre" key={genre} title={genre}>
                    {/* The name in a box of its own: a flex item will not cut
                        its own text off, and the cross must survive the cut. */}
                    <span className="genrename">{genre}</span>
                    <button
                      type="button"
                      className="genrex"
                      title={`Not ${genre}`}
                      onClick={() => keep(shown.filter((g) => g !== genre))}
                    >
                      ×
                    </button>
                  </span>
                ))}
                {adding
                  ? <GenreInput onDone={(g) => (g ? keep([...shown, g]) : setAdding(false))} />
                  : shown.length < MAX_GENRES && (
                    <button
                      type="button"
                      className="genreadd"
                      title="Add a genre"
                      onClick={() => setAdding(true)}
                    >
                      +
                    </button>
                  )}
              </span>
            ) : (
              <span className="genretext" title={shown.join(' · ')}>{shown.join(' · ')}</span>
            )}
          </span>
        )}

        {/* The pen rides the last line of facts rather than sitting at the
            foot of the card. Given a row of its own it stretches the card
            past the cover, and the gap that opens under the picture is the
            first thing you see. */}
        <span className="gamefoot">
          {played && (
            <span className="gamestat" title={spanOf(played)}>
              <ClockIcon />
              {formatMinutes(played.minutes)}
            </span>
          )}
          <button
            type="button"
            className={`gameedit${editing ? ' on' : ''}`}
            title={editing ? 'Done' : 'Change what this game is'}
            aria-pressed={editing}
            onClick={() => { setAdding(false); setEditing(!editing) }}
          >
            <PenIcon />
          </button>
        </span>

        {editing && (
          <span className="gamecardbtns">
            <button type="button" className="notebtn" onClick={onChange}>Change</button>
            <button type="button" className="notebtn" onClick={onRemove}>Remove</button>
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Typing a genre in. Enter keeps it, escape or clicking away gives up — the
 * same two answers every other small box in here takes.
 */
function GenreInput({ onDone }) {
  const [text, setText] = useState('')
  const box = useRef(null)
  useEffect(() => { box.current?.focus() }, [])

  return (
    <input
      ref={box}
      className="genreinput"
      value={text}
      placeholder="genre"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onDone(text.trim())}
      onKeyDown={(e) => {
        // Escape belongs to the box before it belongs to the note.
        if (e.key === 'Escape') { e.stopPropagation(); onDone('') }
        if (e.key === 'Enter') { e.preventDefault(); onDone(text.trim()) }
      }}
    />
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

function PenIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M11.2 2.3a1.4 1.4 0 0 1 2 2L6 11.5l-2.7.8.8-2.7Z" strokeLinejoin="round" />
      <path d="M10 3.5 12.5 6" />
    </svg>
  )
}

function TagsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M8.4 1.9H2.4a.6.6 0 0 0-.6.6v6a.6.6 0 0 0 .18.42l5.6 5.6a.6.6 0 0 0 .84 0l5.6-5.6a.6.6 0 0 0 0-.84l-5.6-5.6a.6.6 0 0 0-.42-.18Z" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
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
