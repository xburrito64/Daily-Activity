import fs from 'node:fs/promises'
import path from 'node:path'
import { readBlock, writeBlock, formatEntries } from './fence.js'

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]|24):([0-5]\d)$/

const toMinutes = (t) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

/** Throws on anything we refuse to write to disk. */
export function validateEntries(entries) {
  if (!Array.isArray(entries)) throw new Error('entries must be an array')

  const checked = entries.map((e, i) => {
    const where = `entry ${i}`
    if (!e || typeof e !== 'object') throw new Error(`${where}: not an object`)
    if (typeof e.tag !== 'string' || !e.tag) throw new Error(`${where}: missing tag`)
    if (!TIME_RE.test(e.start ?? '')) throw new Error(`${where}: bad start "${e.start}"`)
    if (!TIME_RE.test(e.end ?? '')) throw new Error(`${where}: bad end "${e.end}"`)

    const start = toMinutes(e.start)
    const end = toMinutes(e.end)
    if (start % 15 || end % 15) throw new Error(`${where}: times must sit on 15-minute marks`)
    if (end <= start) throw new Error(`${where}: end must come after start`)
    if (e.note != null && typeof e.note !== 'string') throw new Error(`${where}: note must be text`)

    // Rebuild rather than pass through, so stray keys never reach the note.
    const clean = { tag: e.tag, start: e.start, end: e.end }
    if (e.note) clean.note = e.note
    return { clean, start, end }
  })

  // Overlaps are allowed: two things really can happen at once, and the app
  // draws them stacked. Only the shape of each entry is enforced here.
  checked.sort((a, b) => a.start - b.start || a.end - b.end)
  return checked.map((c) => c.clean)
}

export function createStore(dailyDir) {
  const fileFor = (date) => {
    if (!DATE_RE.test(date)) throw new Error(`bad date "${date}"`)
    return path.join(dailyDir, `${date}.md`)
  }

  async function readRaw(date) {
    try {
      return await fs.readFile(fileFor(date), 'utf8')
    } catch (err) {
      if (err.code === 'ENOENT') return null
      throw err
    }
  }

  return {
    fileFor,

    /**
     * { entries, exists, hasBlock, malformed, raw }
     * `malformed` means the fence holds something we couldn't parse — the
     * caller must refuse to overwrite it rather than discard hand edits.
     */
    async readDay(date) {
      const text = await readRaw(date)
      if (text === null) return { entries: [], exists: false, hasBlock: false, malformed: false }

      const body = readBlock(text)
      if (body === null) return { entries: [], exists: true, hasBlock: false, malformed: false }

      const trimmed = body.trim()
      if (trimmed === '') return { entries: [], exists: true, hasBlock: true, malformed: false }

      try {
        const parsed = JSON.parse(trimmed)
        return { entries: validateEntries(parsed), exists: true, hasBlock: true, malformed: false }
      } catch (err) {
        return { entries: [], exists: true, hasBlock: true, malformed: true, raw: trimmed, reason: err.message }
      }
    },

    async writeDay(date, entries) {
      const clean = validateEntries(entries)
      const file = fileFor(date)
      const existing = await readRaw(date)

      // Never discard a block we failed to understand.
      if (existing !== null) {
        const body = readBlock(existing)
        if (body !== null && body.trim() !== '') {
          try { JSON.parse(body.trim()) } catch {
            throw Object.assign(new Error('the daily-log block in this note is not valid JSON; fix it in Obsidian first'), { status: 409 })
          }
        }
      }

      const next = writeBlock(existing ?? '', formatEntries(clean))
      if (next === existing) return { entries: clean, unchanged: true }

      await fs.mkdir(path.dirname(file), { recursive: true })
      // Write beside the target then swap, so a crash can't truncate the note.
      const tmp = `${file}.tmp-${process.pid}`
      await fs.writeFile(tmp, next, 'utf8')
      await fs.rename(tmp, file)
      return { entries: clean, unchanged: false }
    },

    /** Dates that already have a note file, for the review view. */
    async listDates() {
      try {
        const names = await fs.readdir(dailyDir)
        return names
          .filter((n) => n.endsWith('.md') && DATE_RE.test(n.slice(0, -3)))
          .map((n) => n.slice(0, -3))
          .sort()
      } catch (err) {
        if (err.code === 'ENOENT') return []
        throw err
      }
    },
  }
}
