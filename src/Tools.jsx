/**
 * The three ways of working the bar, side by side above the list.
 *
 *   Move    press a block for its note, drag it to move it, drag an edge to
 *           stretch it — the way the bar has always worked.
 *   Snip    click a block to cut it in two where the line is.
 *   Select  drag a box over blocks, on as many days as it reaches, then
 *           move, delete or copy them all at once.
 *
 * Each has a letter, and a number for its place in the row, so switching is
 * one key without looking — see TOOL_KEYS.
 */

export const TOOLS = ['move', 'snip', 'select']

/** The keys that pick each tool: its letter, then its place in the row. */
export const TOOL_KEYS = {
  move: ['v', '1'],
  snip: ['s', '2'],
  select: ['m', '3'],
}

const NAMES = { move: 'Move', snip: 'Snip', select: 'Select' }

function ToolIcon({ tool }) {
  if (tool === 'move') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M4 1.8v11.4l2.9-2.7 2.1 4.3 1.9-.9-2.1-4.3 4-.3z" fill="currentColor" strokeLinejoin="round" />
      </svg>
    )
  }
  if (tool === 'snip') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
        <circle cx="4" cy="4.4" r="2.2" />
        <circle cx="4" cy="11.6" r="2.2" />
        <path d="M5.9 5.6 14.2 12.2M5.9 10.4 14.2 3.8" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2.2" y="3.2" width="11.6" height="9.6" rx="1" strokeDasharray="2.4 1.8" />
    </svg>
  )
}

export default function Tools({ tool, onTool }) {
  return (
    <div className="tools" role="radiogroup" aria-label="Tool">
      {TOOLS.map((t) => (
        <button
          key={t}
          type="button"
          role="radio"
          aria-checked={tool === t}
          className={tool === t ? 'on' : ''}
          onClick={() => onTool(t)}
          title={`${NAMES[t]} — ${TOOL_KEYS[t][0].toUpperCase()} or ${TOOL_KEYS[t][1]}`}
        >
          <ToolIcon tool={t} />
          <kbd>{TOOL_KEYS[t][0].toUpperCase()}</kbd>
        </button>
      ))}
    </div>
  )
}
