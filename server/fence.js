// Reading and writing the ```daily-log fence inside an Obsidian note.
// Everything outside the fence must survive byte-for-byte.

export const FENCE_INFO = 'daily-log'

const OPEN_RE = /(^|\r?\n)```[ \t]*daily-log[ \t]*(?=\r?\n|$)/
const CLOSE_RE = /(^|\r?\n)```[ \t]*(?=\r?\n|$)/

export const detectEol = (text) => (text.includes('\r\n') ? '\r\n' : '\n')

/**
 * Locate the daily-log fence.
 * Returns null if there isn't one, otherwise character offsets:
 *   contentStart..contentEnd  the lines between the fences (what we rewrite)
 *   blockEnd                  end of the closing ``` line
 */
export function locateBlock(text) {
  const open = OPEN_RE.exec(text)
  if (!open) return null

  const afterOpenFence = open.index + open[0].length
  const nl = /\r?\n/.exec(text.slice(afterOpenFence))
  if (!nl) {
    // Fence opened on the last line, never closed.
    return { contentStart: text.length, contentEnd: text.length, blockEnd: text.length, unterminated: true }
  }

  const contentStart = afterOpenFence + nl.index + nl[0].length
  const close = CLOSE_RE.exec(text.slice(contentStart))
  if (!close) {
    return { contentStart, contentEnd: text.length, blockEnd: text.length, unterminated: true }
  }

  return {
    contentStart,
    contentEnd: contentStart + close.index + close[1].length, // start of the closing fence line
    blockEnd: contentStart + close.index + close[0].length,
    unterminated: false,
  }
}

/** Raw text inside the fence, or null if there is no fence. */
export function readBlock(text) {
  const at = locateBlock(text)
  return at ? text.slice(at.contentStart, at.contentEnd) : null
}

/**
 * Return `text` with the fence body replaced by `body`, appending a fence if
 * the note doesn't have one. Nothing outside the fence is touched.
 */
export function writeBlock(text, body) {
  const eol = detectEol(text)
  const at = locateBlock(text)

  if (at && !at.unterminated) {
    return text.slice(0, at.contentStart) + body + eol + text.slice(at.contentEnd)
  }
  if (at && at.unterminated) {
    // Repair by closing the fence we found rather than adding a second one.
    return text.slice(0, at.contentStart) + body + eol + '```' + eol
  }

  let out = text
  if (out.length > 0) {
    if (!/\r?\n$/.test(out)) out += eol
    out += eol // one blank line between existing prose and the block
  }
  return out + '```' + FENCE_INFO + eol + body + eol + '```' + eol
}

/** One entry per line, matching the hand-written style in the note. */
export function formatEntries(entries) {
  if (entries.length === 0) return '[]'
  return '[' + entries.map((e) => JSON.stringify(e)).join(',\n ') + ']'
}
