import { useEffect, useRef, useState } from 'react'
import { searchGames, keepCover, coverUrl } from './api.js'
import { COVER_ASPECT } from './game.js'

// Long enough that typing a name doesn't fire a search per letter, short
// enough that stopping feels like the results were already waiting.
const DEBOUNCE_MS = 320
// One letter matches everything and answers with noise.
const MIN_QUERY = 2

const KEY_HELP = 'https://rawg.io/apikey'

/**
 * Which game a Game block was. A search box until something is picked, and
 * then the game itself, with a way back.
 *
 * The name is the record — it is what the note in the vault says, and what it
 * will still say with none of this installed. The cover is a copy kept in the
 * vault beside the notes, so the day still shows what was played offline, and
 * after this app is gone.
 */
export default function GameSearch({ block, onAttach }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [state, setState] = useState('idle') // idle | searching | done | error
  const [configured, setConfigured] = useState(null) // null until asked
  const [settingsFile, setSettingsFile] = useState('')
  const [problem, setProblem] = useState('')
  const [cursor, setCursor] = useState(0)
  const [saving, setSaving] = useState(null) // the game whose cover is coming
  // "Change" reopens the search over a game that is already attached, without
  // taking it off first — a search that finds nothing should leave you where
  // you were rather than having thrown away what you had.
  const [changing, setChanging] = useState(false)

  const input = useRef(null)
  const active = useRef(null)

  const searching = !block.game || changing

  // Ask once whether there is a key at all, so an empty box can say what is
  // missing instead of waiting for someone to type into a search that was
  // never going to answer.
  useEffect(() => {
    let alive = true
    searchGames('', undefined)
      .then((body) => {
        if (!alive) return
        setConfigured(body.configured)
        setSettingsFile(body.settingsFile ?? '')
      })
      .catch(() => { if (alive) setConfigured(true) }) // let a real search report it
    return () => { alive = false }
  }, [])

  // Whenever the box appears, the cursor is in it. Opening a Game block with
  // nothing attached is the question being asked; asking to change one is the
  // same question again, and neither should need a click to answer.
  useEffect(() => { if (searching) input.current?.focus() }, [searching])

  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY) {
      setResults([])
      setState('idle')
      return
    }

    // Every search abandons the one before it. Otherwise the answer to half a
    // word can arrive after the answer to the whole one and overwrite it.
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setState('searching')
      try {
        const body = await searchGames(q, controller.signal)
        if (controller.signal.aborted) return
        setConfigured(body.configured)
        setSettingsFile(body.settingsFile ?? '')
        setResults(body.results)
        setCursor(0)
        setState('done')
      } catch (err) {
        if (controller.signal.aborted || err.name === 'AbortError') return
        setProblem(err.message)
        setState('error')
      }
    }, DEBOUNCE_MS)

    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  useEffect(() => { active.current?.scrollIntoView({ block: 'nearest' }) }, [cursor])

  /**
   * Take a game. The cover is fetched first so the whole thing lands as one
   * change — one line in the note, and one ctrl+z to take it back.
   *
   * A cover that won't come is not a reason to lose the name. The name is the
   * part that matters; say what went wrong and keep it.
   */
  async function attach(result) {
    setSaving(result.id)
    setProblem('')
    let cover = ''
    try {
      const kept = await keepCover(result)
      cover = kept.cover
    } catch (err) {
      setProblem(`Kept the name, but not the cover — ${err.message}`)
    }
    setSaving(null)
    setChanging(false)
    setQuery('')
    setResults([])
    onAttach({ name: result.name, cover })
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      // Clear the box first; only an empty one lets escape close the note.
      if (query) { e.stopPropagation(); setQuery(''); return }
      if (changing) { e.stopPropagation(); setChanging(false) }
      return
    }
    if (results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => Math.min(results.length - 1, c + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => Math.max(0, c - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (saving === null) attach(results[cursor])
    }
  }

  if (!searching) {
    return (
      <div className="gamepick">
        <div className="gameheld">
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
          <span className="gamename">{block.game}</span>
          <button type="button" className="notebtn" onClick={() => { setChanging(true); setQuery('') }}>
            Change
          </button>
          <button type="button" className="notebtn" onClick={() => onAttach(null)}>
            Remove
          </button>
        </div>
        {problem && <p className="gameproblem">{problem}</p>}
      </div>
    )
  }

  return (
    <div className="gamepick">
      <div className="gamesearch">
        <input
          ref={input}
          className="gameinput"
          type="text"
          value={query}
          placeholder={block.game ? `Instead of ${block.game}…` : 'Which game?'}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {state === 'searching' && <span className="gamenote">looking…</span>}
        {changing && (
          <button type="button" className="notebtn" onClick={() => setChanging(false)}>
            Keep {block.game}
          </button>
        )}
      </div>

      {configured === false && (
        <p className="gameproblem">
          No game key yet. Get a free one from{' '}
          <a href={KEY_HELP} target="_blank" rel="noreferrer">rawg.io/apikey</a> and put it on the{' '}
          <code>"rawgKey"</code> line of this file:
          {/* The whole path. There is a second config.json in the project
              folder that this app never reads, and naming only the file is
              how you end up editing that one. */}
          {settingsFile && <><br /><code className="gamepath">{settingsFile}</code><br /></>}
          {' '}Save it and search again — there is nothing to restart.
        </p>
      )}
      {problem && <p className="gameproblem">{problem}</p>}
      {state === 'done' && results.length === 0 && configured !== false && (
        <p className="gamenote">Nothing by that name.</p>
      )}

      {results.length > 0 && (
        <ul className="gamelist">
          {results.map((game, i) => (
            <li key={game.id}>
              <button
                type="button"
                ref={i === cursor ? active : undefined}
                className={`gameresult${i === cursor ? ' on' : ''}`}
                disabled={saving !== null}
                onMouseEnter={() => setCursor(i)}
                onClick={() => attach(game)}
              >
                {game.cover
                  ? <img className="gameshot" src={game.cover} alt="" loading="lazy" />
                  : <span className="gameshot none" aria-hidden="true">🎮</span>}
                <span className="gamebody">
                  <span className="gametitle">
                    {game.name}
                    {game.released && <b className="gameyear">{game.released}</b>}
                  </span>
                  {game.genres.length > 0 && (
                    <span className="gamegenres">{game.genres.join(' · ')}</span>
                  )}
                  {game.description && <span className="gameblurb">{game.description}</span>}
                </span>
                {saving === game.id && <span className="gamenote">keeping the cover…</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
