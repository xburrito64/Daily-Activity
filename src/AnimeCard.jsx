import { useEffect, useRef, useState } from 'react'
import { coverUrl, getWatched, setShowGenres, getAnilist, saveAnilist, syncAnime } from './api.js'
import { COVER_ASPECT } from './face.js'
import { formatMinutes } from './time.js'
import { episodeLabel, furthest } from './episodes.js'
import { PenIcon, TagsIcon, ClockIcon, EpisodeIcon } from './icons.jsx'

// Kept level with MAX_GENRES in server/anime.js: the server is the one that
// enforces it, this only stops the + offering a slot there is no room for.
const MAX_GENRES = 6

const DEVELOPER = 'https://anilist.co/settings/developer'
// The redirect that shows the token on a page instead of sending it to a
// server we don't have. It is the whole reason this works without one.
const PIN = 'https://anilist.co/api/v2/oauth/pin'

/**
 * The show a block was, beside the note about it.
 *
 * The cover at the size a cover deserves, the name, which episodes the
 * evening was, and how much of your life the whole show has taken — every
 * sitting of it in the vault added up, not just this one.
 *
 * And a way to tell AniList. That is the one thing in this app that leaves
 * the machine, so it is a button and never a consequence of typing.
 */
export default function AnimeCard({ block, onChange, onEpisodes, onRemove }) {
  const [watched, setWatched] = useState(null)
  // Held here as well as on disk so a genre appears the moment you add it,
  // rather than after a round trip.
  const [genres, setLocalGenres] = useState(null)
  const [adding, setAdding] = useState(false)
  // Off by default. A card is for looking at; the handles for changing it are
  // clutter every time you are not changing it, which is nearly always.
  const [editing, setEditing] = useState(false)

  const [link, setLink] = useState(null) // null until AniList has been asked
  const [connecting, setConnecting] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(null)
  const [problem, setProblem] = useState('')

  // Asked for once per card. It is a count over every day in the vault, so it
  // cannot come from the days the list happens to be holding.
  useEffect(() => {
    let alive = true
    getWatched()
      .then((all) => {
        if (!alive) return
        setWatched(all[block.show] ?? null)
        setLocalGenres(all[block.show]?.genres ?? [])
      })
      .catch(() => { if (alive) setWatched(null) })
    return () => { alive = false }
  }, [block.show, block.startSlot, block.endSlot])

  // Whether there is an account to send to. Asked quietly on opening, so the
  // button can say "connect" rather than finding out by failing.
  useEffect(() => {
    let alive = true
    getAnilist().then((state) => { if (alive) setLink(state) }).catch(() => {})
    return () => { alive = false }
  }, [])

  // A different evening is a different thing to have sent.
  useEffect(() => { setSent(null); setProblem('') }, [block.id, block.show])

  function keep(next) {
    setLocalGenres(next)
    setAdding(false)
    // Nothing to do if it fails: the list on disk simply stays as it was, and
    // reopening the card shows that. Not worth a banner over the whole app.
    setShowGenres(block.show, next).catch(() => {})
  }

  const episode = furthest(block.episodes)

  async function send() {
    if (!episode) return
    if (!link?.connected) { setConnecting(true); return }
    setSending(true)
    setProblem('')
    try {
      setSent(await syncAnime(block.show, episode))
    } catch (err) {
      setProblem(err.message)
    }
    setSending(false)
  }

  if (connecting) {
    return (
      <AnilistSetup
        link={link}
        onDone={(state) => { setLink(state); setConnecting(false) }}
        onCancel={() => setConnecting(false)}
      />
    )
  }

  const shown = genres ?? []
  const total = watched?.episodes ?? null

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
        : <span className="gamecover none" aria-hidden="true">🌸</span>}

      <div className="gamefacts">
        <span className="gamename">{block.show}</span>
        {/* The rule under the name, with the same mark the rest of the app
            uses for a small ornament. Decoration, so it is not read out. */}
        <span className="gamerule" aria-hidden="true"><i /></span>

        {/* What the evening was. With nothing picked it says what the show is
            instead, which is the only true thing left to say. */}
        <span className="gamestat" title={watchedTitle(watched, block.episodes)}>
          <EpisodeIcon />
          {episode
            ? `${episodeLabel(block.episodes)}${total ? ` of ${total}` : ''}`
            : total ? `${total} episodes` : 'No episodes marked'}
          {watched?.year && <b className="gameyear">{watched.year}</b>}
        </span>

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

        {/* The last line of facts, with the handles at the end of it. Given a
            row of their own they stretch the card past the cover, and the gap
            that opens under the picture is the first thing you see. */}
        <span className="gamefoot">
          {/* Only once there is some. A show attached a moment ago is in
              a day that has not been written yet, and "0m" under a cover is
              a wrong answer where no answer was needed. */}
          {watched?.minutes > 0 && (
            <span className="gamestat" title={spanOf(watched)}>
              <ClockIcon />
              {formatMinutes(watched.minutes)}
            </span>
          )}

          {/* The only thing here that leaves the machine, so it is a press
              and never a consequence. It says what it would do before it
              does it, and what it did afterwards. */}
          {episode > 0 && (
            <button
              type="button"
              className={`anilist${sent ? ' done' : ''}`}
              disabled={sending}
              title={sendTitle({ link, sent, episode, show: block.show })}
              onClick={send}
            >
              {sendLabel({ link, sent, sending, episode })}
            </button>
          )}

          <button
            type="button"
            className={`gameedit${editing ? ' on' : ''}`}
            title={editing ? 'Done' : 'Change what this is'}
            aria-pressed={editing}
            onClick={() => { setAdding(false); setEditing(!editing) }}
          >
            <PenIcon />
          </button>
        </span>

        {problem && <p className="gameproblem">{problem}</p>}

        {editing && (
          <span className="gamecardbtns">
            <button type="button" className="notebtn" onClick={onEpisodes}>Episodes</button>
            <button type="button" className="notebtn" onClick={onChange}>Change</button>
            <button type="button" className="notebtn" onClick={onRemove}>Remove</button>
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * What the AniList button says. Four things it can be: no account yet, ready
 * to send, sending, and sent — plus the one that reads as nothing happening
 * but is the right answer, which is being told you are already further on
 * than the evening you are looking at.
 */
function sendLabel({ link, sent, sending, episode }) {
  if (sending) return 'sending…'
  if (sent?.already) return `already at ${sent.progress}`
  if (sent) return `✓ episode ${sent.progress}`
  if (link && !link.connected) return 'Connect AniList'
  return `AniList · ${episode}`
}

function sendTitle({ link, sent, episode, show }) {
  if (sent?.already) return `AniList already had you at episode ${sent.progress} of ${show}`
  if (sent) return `AniList now says episode ${sent.progress} of ${show}`
  if (link && !link.connected) return 'Connect an AniList account to send progress'
  const who = link?.user?.name ? ` as ${link.user.name}` : ''
  return `Mark ${show} watched to episode ${episode} on AniList${who}`
}

/** Which episodes, in full, for the line that has room for a range. */
function watchedTitle(watched, episodes) {
  const seen = watched?.seen ?? []
  if (episodes?.length) {
    return seen.length > episodes.length
      ? `This block: ${episodeLabel(episodes)}. In the vault: ${episodeLabel(seen)}`
      : undefined
  }
  return seen.length ? `Written down elsewhere: ${episodeLabel(seen)}` : undefined
}

/** How many days the total is spread over, and between which of them. */
function spanOf(watched) {
  if (!watched?.days) return undefined
  const days = watched.days === 1 ? 'one day' : `${watched.days} days`
  return watched.first === watched.last
    ? `All of it on ${watched.first}`
    : `Across ${days}, ${watched.first} to ${watched.last}`
}

/**
 * Connecting the account, in the box the card was in.
 *
 * AniList has no way to hand a token to a program that isn't a website, so
 * the way through is to let it show you one and paste it back. Three steps,
 * two of them a copy — and the app writes the settings file itself, because
 * there are two of those, only one is read, and none of that is worth
 * learning to connect an account.
 */
function AnilistSetup({ link, onDone, onCancel }) {
  const [clientId, setClientId] = useState(link?.clientId ?? '')
  const [token, setToken] = useState('')
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')

  const id = clientId.trim()
  const allow = `https://anilist.co/api/v2/oauth/authorize?client_id=${encodeURIComponent(id)}&response_type=token`

  async function save() {
    setSaving(true)
    setProblem('')
    try {
      const state = await saveAnilist(id, token.trim())
      if (state.connected) onDone(state)
      else setProblem(state.problem ?? 'AniList would not confirm that token.')
    } catch (err) {
      setProblem(err.message)
    }
    setSaving(false)
  }

  return (
    <div className="gamepick">
      <div className="stepline">
        <button type="button" className="stepback" onClick={onCancel} title="Back">←</button>
        <span className="stepwhere">Connect AniList</span>
      </div>

      <ol className="setup">
        <li>
          Open <a href={DEVELOPER} target="_blank" rel="noreferrer">your developer settings</a>,
          make a new client with any name, and give it this redirect URL:
          <code className="gamepath">{PIN}</code>
        </li>
        <li>
          Paste the client id it gives you — just the number.
          <input
            className="gameinput"
            value={clientId}
            placeholder="12345"
            inputMode="numeric"
            onChange={(e) => setClientId(e.target.value)}
          />
        </li>
        <li className={id ? '' : 'waiting'}>
          {id
            ? <><a href={allow} target="_blank" rel="noreferrer">Allow it here</a>, then paste the code that page shows you.</>
            : 'Then a link appears here to allow it, and a code to paste back.'}
          <input
            className="gameinput"
            value={token}
            placeholder="the code from that page"
            disabled={!id}
            onChange={(e) => setToken(e.target.value)}
          />
        </li>
      </ol>

      {problem && <p className="gameproblem">{problem}</p>}
      <p className="gamenote">The code lasts a year. It is kept in your settings file, nowhere else.</p>

      <span className="gamecardbtns">
        <button type="button" className="notebtn" onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className="notebtn keep"
          disabled={saving || !id || !token.trim()}
          onClick={save}
        >
          {saving ? 'checking…' : 'Connect'}
        </button>
      </span>
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
