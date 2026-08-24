import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * JSON has no room for raw Windows backslashes, which is the obvious thing to
 * paste into this file. Say so plainly instead of dying on a parser message.
 */
export function loadJson(name) {
  const file = path.join(root, name)
  const text = fs.readFileSync(file, 'utf8')
  try {
    return JSON.parse(text)
  } catch (err) {
    const hint = text.includes('\\')
      ? `\n\nLooks like a Windows path with backslashes. Write it with forward slashes instead, like "C:/Vaults/Vault 420/Daily".`
      : ''
    throw new Error(`${name} is not valid JSON: ${err.message}${hint}`)
  }
}
