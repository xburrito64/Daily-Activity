import { useEffect, useRef, useState } from 'react'
import TagIcon from './TagIcon.jsx'
import { saveTags, setTagPicture } from './api.js'

// How long typing may pause before it is saved. Long enough that a name is
// not written a letter at a time, short enough that closing the panel
// straight after typing doesn't lose the last word.
const SAVE_AFTER_MS = 450

// What a new tag is dressed in until you change it: a colour in the same
// range as the others — dark enough for white writing, mid enough to be told
// apart — turned round the wheel by how many tags there are, so two new tags
// in a row don't come out the same.
const newColour = (count) => `oklch(0.46 0.08 ${(count * 47) % 360})`
const NEW_ICON = '🏷️'

/**
 * Any CSS colour, as the #rrggbb a colour picker can show.
 *
 * The tag list is written in oklch, which the browser's picker cannot read,
 * so the browser is asked to paint it and the pixel is read back. The picker
 * then writes hex; the two sit side by side in the file happily.
 */
const hexes = new Map()
function hexOf(colour) {
  if (hexes.has(colour)) return hexes.get(colour)
  let hex = '#555555'
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = colour
    ctx.fillRect(0, 0, 1, 1)
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
    hex = `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
  } catch { /* a grey is a fine thing to start a picker from */ }
  hexes.set(colour, hex)
  return hex
}

/** A file from the picker, as a data: address to send. */
const readFile = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = () => reject(new Error('that file could not be read'))
  reader.readAsDataURL(file)
})

/**
 * The tag list, editable: names, colours, emoji, pictures, order, which are
 * hidden, new tags, and — for one never used — taking it away.
 *
 * Every change is saved as it is made, the way everything else in the
 * settings is. A change the server turns down is said in words and put back,
 * so the list on screen is never one the file doesn't agree with.
 */
export default function TagEditor({ tags, iconSet, onSaved, onPictureChanged }) {
  const [list, setList] = useState(tags)
  const [open, setOpen] = useState(null)
  const [problem, setProblem] = useState('')
  const [naming, setNaming] = useState(null) // the name of a tag being added
  const [deleting, setDeleting] = useState(null)
  const [dragging, setDragging] = useState(null)
  const [uploading, setUploading] = useState(null)

  // The last list the file agreed with, to go back to if a save is refused.
  const agreed = useRef(tags)
  const timer = useRef(null)
  const queued = useRef(null)
  const running = useRef(false)

  // A list saved elsewhere — or the same list wearing a different icon set —
  // comes in from above; nothing is lost by taking it while nothing is
  // waiting to be written.
  useEffect(() => {
    if (!timer.current && !running.current && !queued.current) {
      setList(tags)
      agreed.current = tags
    }
  }, [tags])

  useEffect(() => () => clearTimeout(timer.current), [])

  /**
   * Write whatever the latest list is, one save at a time. A save that is
   * still on its way when another change is made is followed by one more,
   * never raced by it.
   */
  async function flush() {
    if (running.current) return
    running.current = true
    try {
      while (queued.current) {
        const next = queued.current
        queued.current = null
        try {
          const saved = await saveTags(next, iconSet)
          agreed.current = saved
          setProblem('')
          if (!queued.current) {
            setList(saved)
            onSaved(saved)
          }
        } catch (err) {
          queued.current = null
          setProblem(err.message)
          setList(agreed.current)
        }
      }
    } finally {
      running.current = false
    }
  }

  function save(next, { now = false } = {}) {
    setList(next)
    queued.current = next
    clearTimeout(timer.current)
    if (now) {
      timer.current = null
      flush()
    } else {
      timer.current = setTimeout(() => {
        timer.current = null
        flush()
      }, SAVE_AFTER_MS)
    }
  }

  const change = (id, fields, options) =>
    save(list.map((tag) => (tag.id === id ? { ...tag, ...fields } : tag)), options)

  function move(from, to) {
    if (from === to || from == null || to == null) return
    const next = [...list]
    const [tag] = next.splice(from, 1)
    next.splice(to, 0, tag)
    save(next, { now: true })
  }

  async function add() {
    const name = (naming ?? '').trim()
    if (!name) return
    try {
      const saved = await saveTags(
        [...list, { id: '', name, colour: newColour(list.length), icon: NEW_ICON }],
        iconSet,
      )
      agreed.current = saved
      setList(saved)
      onSaved(saved)
      setNaming(null)
      setProblem('')
      setOpen(saved[saved.length - 1]?.id ?? null)
    } catch (err) {
      setProblem(err.message)
    }
  }

  async function picture(id, file) {
    if (!file) return
    setUploading(id)
    try {
      await setTagPicture(id, await readFile(file), iconSet)
      setProblem('')
      onPictureChanged()
    } catch (err) {
      setProblem(err.message)
    } finally {
      setUploading(null)
    }
  }

  function remove(id) {
    if (deleting !== id) {
      setDeleting(id)
      return
    }
    setDeleting(null)
    setOpen(null)
    save(list.filter((tag) => tag.id !== id), { now: true })
  }

  return (
    <div className="tageditor">
      <p className="settingsnote">
        Drag to reorder. Renaming or recolouring a tag changes it everywhere, and no day loses it.
        A hidden tag leaves the row under each day but stays on the days that already have it.
      </p>

      {problem && <p className="settingsproblem" role="alert">{problem}</p>}

      <ul className="taglist">
        {list.map((tag, i) => {
          const isOpen = open === tag.id
          return (
            <li
              key={tag.id}
              className={`tagrow${tag.hidden ? ' hidden' : ''}${dragging === i ? ' dragging' : ''}`}
              draggable
              onDragStart={(e) => {
                setDragging(i)
                e.dataTransfer.effectAllowed = 'move'
                // Firefox refuses to start a drag that carries nothing.
                e.dataTransfer.setData('text/plain', tag.id)
              }}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
              onDrop={(e) => { e.preventDefault(); move(dragging, i); setDragging(null) }}
              onDragEnd={() => setDragging(null)}
            >
              <div className="tagrowhead">
                <span className="grip" aria-hidden="true" title="Drag to move">⠿</span>
                <span className="tagswatch" style={{ '--chip': tag.colour }}>
                  <TagIcon tag={tag} />
                </span>
                <button
                  type="button"
                  className="tagrowname"
                  onClick={() => { setOpen(isOpen ? null : tag.id); setDeleting(null) }}
                  aria-expanded={isOpen}
                >
                  {tag.name}
                </button>
                <button
                  type="button"
                  className={`tagtoggle${tag.hidden ? '' : ' on'}`}
                  onClick={() => change(tag.id, { hidden: !tag.hidden }, { now: true })}
                  aria-label={tag.hidden ? `Show ${tag.name} under each day` : `Hide ${tag.name} from under each day`}
                  title={tag.hidden ? 'Hidden — click to show' : 'Shown — click to hide'}
                >
                  <EyeIcon shut={tag.hidden} />
                </button>
              </div>

              {isOpen && (
                <div className="tagrowbody">
                  <label className="tagfield">
                    <span>Name</span>
                    <input
                      type="text"
                      value={tag.name}
                      maxLength={40}
                      onChange={(e) => change(tag.id, { name: e.target.value })}
                    />
                  </label>

                  <label className="tagfield">
                    <span>Colour</span>
                    <span className="colourpick">
                      <input
                        type="color"
                        value={hexOf(tag.colour)}
                        onChange={(e) => change(tag.id, { colour: e.target.value })}
                      />
                      <span className="colourvalue">{tag.colour}</span>
                    </span>
                  </label>

                  <label className="tagfield">
                    <span>Emoji</span>
                    <input
                      type="text"
                      className="emojiinput"
                      value={tag.icon ?? ''}
                      maxLength={16}
                      onChange={(e) => change(tag.id, { icon: e.target.value })}
                    />
                  </label>

                  <div className="tagfield">
                    <span>Picture</span>
                    <span className="picturepick">
                      <label className="settingsbutton">
                        {uploading === tag.id ? 'Saving…' : 'Choose a picture…'}
                        <input
                          type="file"
                          accept="image/svg+xml,image/png,image/webp,image/gif,image/jpeg"
                          onChange={(e) => { picture(tag.id, e.target.files?.[0]); e.target.value = '' }}
                          hidden
                        />
                      </label>
                      <span className="settingsnote small">
                        Goes into {iconSet ? `the ${iconSet} set` : 'Current icons'}, and shows instead of the emoji.
                      </span>
                    </span>
                  </div>

                  <button
                    type="button"
                    className={`tagdelete${deleting === tag.id ? ' confirming' : ''}`}
                    onClick={() => remove(tag.id)}
                  >
                    {deleting === tag.id ? 'Click again to delete' : 'Delete tag'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      {naming === null ? (
        <button type="button" className="settingsbutton add" onClick={() => setNaming('')}>
          + Add a tag
        </button>
      ) : (
        <form className="tagadd" onSubmit={(e) => { e.preventDefault(); add() }}>
          <input
            type="text"
            autoFocus
            placeholder="Name of the new tag"
            maxLength={40}
            value={naming}
            onChange={(e) => setNaming(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setNaming(null) } }}
          />
          <button type="submit" className="settingsbutton" disabled={!naming.trim()}>Add</button>
        </form>
      )}
    </div>
  )
}

function EyeIcon({ shut }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M1.8 10S5 4.5 10 4.5 18.2 10 18.2 10 15 15.5 10 15.5 1.8 10 1.8 10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
      {shut && <path d="M3 17L17 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />}
    </svg>
  )
}
