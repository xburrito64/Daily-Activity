import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * JSON has no room for raw Windows backslashes, which is the obvious thing to
 * paste into these files. Say so plainly instead of dying on a parser message.
 */
export function readJson(file) {
  // A byte-order mark is invisible, is not JSON, and is what Notepad puts at
  // the front of a file when you save it as UTF-8. Settings are meant to be
  // edited by hand, so the app has to survive being edited by the editor that
  // is already on the machine — otherwise the first change anybody makes
  // stops it from starting, over a character they cannot see. Written as an
  // escape below, since it is just as invisible in this file.
  const text = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  try {
    return JSON.parse(text)
  } catch (err) {
    const hint = text.includes('\\')
      ? `\n\nLooks like a Windows path with backslashes. Write it with forward slashes instead, like "C:/Vaults/Vault 420/Daily".`
      : ''
    throw new Error(`${path.basename(file)} is not valid JSON: ${err.message}${hint}`)
  }
}

/** A file in the project folder. Used in development and by the Vite config. */
export const loadJson = (name) => readJson(path.join(root, name))
