import { useEffect, useState } from 'react'
import { getIconSets, refillCovers } from './api.js'
import TagIcon from './TagIcon.jsx'
import TagEditor from './TagEditor.jsx'
import SetupPanel from './SetupPanel.jsx'
import {
  BAR_WIDTH, NO_LIMIT, CHIP_LOOKS, LABEL_STYLES, DEFAULTS, THEMES,
} from './appearance.js'

// How many tags a tag-box look is shown with. Enough to see the colours
// against each other, few enough that five looks fit down one panel.
const SAMPLE_TAGS = 3

const TABS = [
  { id: 'tags', name: 'Tags' },
  { id: 'look', name: 'Look' },
  { id: 'setup', name: 'Setup' },
]
// The tab last looked at, for as long as the app is open: closing the panel
// to try something and opening it again should land back where you were.
let lastTab = 'tags'

/**
 * The settings panel: a column down the right of the window, so the days
 * stay in view beside it and every change can be seen as it is made rather
 * than pictured.
 *
 * Nothing here is saved by a button. Each choice takes effect the moment it
 * is made and is kept from then on; closing the panel is only closing it.
 */
export default function Settings({
  appearance, onChange, tags, onClose, onTagsSaved, onPictureChanged, onResetRows, onCoversFound,
}) {
  const [tab, setTab] = useState(lastTab)
  const pick = (id) => { lastTab = id; setTab(id) }

  return (
    <aside className="settings" aria-label="Settings">
      <div className="settingshead">
        <h2>Settings</h2>
        <button type="button" className="settingsclose" onClick={onClose} aria-label="Close settings">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="settingstabs" role="tablist">
        {TABS.map((one) => (
          <button
            key={one.id}
            type="button"
            role="tab"
            aria-selected={tab === one.id}
            className={tab === one.id ? 'on' : ''}
            onClick={() => pick(one.id)}
          >
            {one.name}
          </button>
        ))}
      </div>

      {tab === 'tags' && (
        <TagEditor
          tags={tags}
          iconSet={appearance.iconSet}
          onSaved={onTagsSaved}
          onPictureChanged={onPictureChanged}
        />
      )}
      {tab === 'look' && (
        <Look
          appearance={appearance}
          onChange={onChange}
          tags={tags}
          onResetRows={onResetRows}
          onCoversFound={onCoversFound}
        />
      )}
      {tab === 'setup' && <SetupPanel />}
    </aside>
  )
}

function Look({ appearance, onChange, tags, onResetRows, onCoversFound }) {
  const [sets, setSets] = useState(null)
  const [coverNote, setCoverNote] = useState('')
  const [looking, setLooking] = useState(false)
  const [rowsNote, setRowsNote] = useState('')

  // Asked each time the tab opens, so a set dropped into the icon folder
  // while the app is running shows up the next time you look.
  useEffect(() => {
    let alive = true
    getIconSets()
      .then((body) => { if (alive) setSets(body.sets ?? []) })
      .catch(() => { if (alive) setSets([]) })
    return () => { alive = false }
  }, [])

  const set = (key) => (value) => onChange({ ...appearance, [key]: value })
  const sample = tags.filter((tag) => !tag.hidden).slice(0, SAMPLE_TAGS)
  const width = appearance.barWidth

  async function lookForCovers() {
    setLooking(true)
    setCoverNote('')
    try {
      const { filled, ready } = await refillCovers()
      setCoverNote(!ready
        ? 'Looking games up needs a RAWG key first — it goes in under Setup.'
        : filled.length === 0
        ? 'Nothing new yet — every game without a cover still has none to find.'
        : `Found ${filled.length}: ${filled.join(', ')}.`)
      if (filled.length > 0) onCoversFound()
    } catch (err) {
      setCoverNote(err.message)
    } finally {
      setLooking(false)
    }
  }

  // What a preview bar is painted with: the first few real tags, at the
  // shares a day might plausibly have them in.
  const barTags = tags.filter((tag) => !tag.hidden).slice(0, 5)
  const shares = [34, 12, 22, 9, 23]

  return (
    <>
      <section className="settingsgroup">
        <h3>Theme</h3>
        <p className="settingsnote">The whole look of the app. Tag colours stay the same in every one.</p>
        <div className="choicelist">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`choice${appearance.theme === theme.id ? ' on' : ''}`}
              aria-pressed={appearance.theme === theme.id}
              onClick={() => set('theme')(theme.id)}
            >
              {/* A little room in that theme: it sets its own names, so
                  everything in here wears it whatever the page is wearing. */}
              <span className="themepreview" data-theme={theme.id} aria-hidden="true">
                <span className="tp-title">Daily Documentation</span>
                <span className="tp-rule" />
                <span className="tp-bar">
                  {barTags.map((tag, i) => (
                    <span key={tag.id} style={{ flex: shares[i], background: tag.colour }} />
                  ))}
                </span>
                <span className="tp-row">
                  {barTags.slice(0, 2).map((tag) => (
                    <span key={tag.id} className="tp-chip" style={{ '--chip': tag.colour }}>{tag.name}</span>
                  ))}
                  <span className="tp-pill">Day</span>
                </span>
              </span>
              <span className="choicename">{theme.name}</span>
              <span className="choicenote">{theme.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settingsgroup">
        <h3>Bar width</h3>
        <p className="settingsnote">How wide the days may get. The bar never grows past the window.</p>
        <div className="widthrow">
          <input
            type="range"
            min={BAR_WIDTH.min}
            max={BAR_WIDTH.max}
            step={BAR_WIDTH.step}
            value={width}
            onChange={(e) => set('barWidth')(Number(e.target.value))}
            aria-label="Bar width"
          />
          <span className="widthvalue">{width >= NO_LIMIT ? 'No limit' : `${width} px`}</span>
        </div>
        {width !== DEFAULTS.barWidth && (
          <button type="button" className="settingsreset" onClick={() => set('barWidth')(DEFAULTS.barWidth)}>
            Back to {DEFAULTS.barWidth} px
          </button>
        )}
      </section>

      <section className="settingsgroup">
        <h3>Row height</h3>
        <p className="settingsnote">Ctrl+scroll over the days makes rows taller or shorter. This puts both views back.</p>
        <button
          type="button"
          className="settingsbutton"
          onClick={() => { onResetRows(); setRowsNote('Back to the usual height.') }}
        >
          Reset row heights
        </button>
        {rowsNote && <p className="keymessage">{rowsNote}</p>}
      </section>

      <section className="settingsgroup">
        <h3>Tag icons</h3>
        <p className="settingsnote">
          Each folder inside the tag-icons folder is a set. A tag a set has no picture for keeps its usual one.
        </p>
        {sets === null && <p className="settingsnote">Looking for sets…</p>}
        <div className="choicelist">
          {(sets ?? []).map((one) => (
            <button
              key={one.name || '(usual)'}
              type="button"
              className={`choice${appearance.iconSet === one.name ? ' on' : ''}`}
              aria-pressed={appearance.iconSet === one.name}
              onClick={() => set('iconSet')(one.name)}
            >
              <span className="choicename">
                {one.name || 'Current icons'}
                <span className="choicecount">{one.covers} of {one.of}</span>
              </span>
              <span className="setpreview">
                {one.preview.map((tag) => (
                  <img key={tag.id} src={tag.image} alt="" title={tag.name} />
                ))}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="settingsgroup">
        <h3>Tag boxes</h3>
        <p className="settingsnote">The row of tags under each day. The last one in each sample is armed.</p>
        <div className="choicelist">
          {CHIP_LOOKS.map((look) => (
            <button
              key={look.id}
              type="button"
              className={`choice${appearance.chipLook === look.id ? ' on' : ''}`}
              aria-pressed={appearance.chipLook === look.id}
              onClick={() => set('chipLook')(look.id)}
            >
              <span className="choicename">{look.name}</span>
              <span className="choicenote">{look.note}</span>
              <span className="chipsample">
                {sample.map((tag, i) => (
                  <span
                    key={tag.id}
                    className={`chip${i === sample.length - 1 ? ' armed' : ''}`}
                    data-look={look.id}
                    style={{ '--chip': tag.colour }}
                  >
                    <TagIcon tag={tag} />
                    {tag.name}
                  </span>
                ))}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="settingsgroup">
        <h3>Labels on the bar</h3>
        <div className="choicelist">
          {LABEL_STYLES.map((style) => (
            <button
              key={style.id}
              type="button"
              className={`choice${appearance.labels === style.id ? ' on' : ''}`}
              aria-pressed={appearance.labels === style.id}
              onClick={() => set('labels')(style.id)}
            >
              <span className="choicename">{style.name}</span>
              <span className="choicenote">{style.note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settingsgroup">
        <h3>Covers</h3>
        <Toggle
          on={appearance.covers}
          onFlip={() => set('covers')(!appearance.covers)}
          label="Game and anime covers on the bar"
          note="Off, a named block wears its tag's icon on the bar. The card in its note keeps the cover."
        />
        <p className="settingsnote">
          Games without a cover are looked for again by themselves every few hours. To look right now:
        </p>
        <button type="button" className="settingsbutton" onClick={lookForCovers} disabled={looking}>
          {looking ? 'Looking…' : 'Look for missing covers now'}
        </button>
        {coverNote && <p className="keymessage">{coverNote}</p>}
      </section>

      <section className="settingsgroup">
        <h3>Shortcut hints</h3>
        <Toggle
          on={appearance.hints}
          onFlip={() => set('hints')(!appearance.hints)}
          label="The line of shortcuts above the days"
          note="What to do while a tag is armed is still said there either way."
        />
      </section>
    </>
  )
}

function Toggle({ on, onFlip, label, note }) {
  return (
    <button type="button" role="switch" aria-checked={on} className={`toggle${on ? ' on' : ''}`} onClick={onFlip}>
      <span className="toggletrack" aria-hidden="true"><span className="toggleknob" /></span>
      <span className="toggletext">
        <span className="choicename">{label}</span>
        {note && <span className="choicenote">{note}</span>}
      </span>
    </button>
  )
}
