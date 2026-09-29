import { useEffect, useState } from 'react'
import { getIconSets } from './api.js'
import TagIcon from './TagIcon.jsx'
import {
  BAR_WIDTH, NO_LIMIT, CHIP_LOOKS, LABEL_STYLES, DEFAULTS,
} from './appearance.js'

// How many tags a tag-box look is shown with. Enough to see the colours
// against each other, few enough that five looks fit down one panel.
const SAMPLE_TAGS = 3

/**
 * The settings panel: a column down the right of the window, so the days
 * stay in view beside it and every change can be seen as it is made rather
 * than pictured.
 *
 * Nothing here is saved by a button. Each choice takes effect the moment it
 * is made and is kept from then on; closing the panel is only closing it.
 */
export default function Settings({ appearance, onChange, tags, onClose }) {
  const [sets, setSets] = useState(null)

  // Asked each time the panel opens, so a set dropped into the icon folder
  // while the app is running shows up the next time you look.
  useEffect(() => {
    let alive = true
    getIconSets()
      .then((body) => { if (alive) setSets(body.sets ?? []) })
      .catch(() => { if (alive) setSets([]) })
    return () => { alive = false }
  }, [])

  const set = (key) => (value) => onChange({ ...appearance, [key]: value })
  const sample = tags.slice(0, SAMPLE_TAGS)
  const width = appearance.barWidth

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
    </aside>
  )
}
