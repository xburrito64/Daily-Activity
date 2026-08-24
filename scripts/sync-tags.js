// Part of "npm run update-app": give the installed app the project's tag list.
//
// The installed app keeps its own copy of tags.json in the settings folder, so
// that it can be edited after installation. That also means a new tag added
// here never reaches it — installing a new version leaves the old list in
// place. Updating the app should update its tags too, so this copies them
// across, keeping the previous list next to it in case it was hand-edited.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(root, 'tags.json')

const settingsDir = path.join(process.env.APPDATA ?? '', 'Daily Documentation')
const target = path.join(settingsDir, 'tags.json')

if (!fs.existsSync(target)) {
  // Never installed, or installed somewhere else. The app copies the tag list
  // in itself the first time it runs, and that copy is already up to date.
  console.log('\n  No installed copy to update — it will start from this one.\n')
  process.exit(0)
}

const wanted = fs.readFileSync(source, 'utf8')
const current = fs.readFileSync(target, 'utf8')

if (wanted === current) {
  console.log('\n  The installed app already has this tag list.\n')
  process.exit(0)
}

const count = (text) => {
  try { return JSON.parse(text).length } catch { return '?' }
}

fs.copyFileSync(target, path.join(settingsDir, 'tags.previous.json'))
fs.writeFileSync(target, wanted)

console.log(`
  Tag list updated: ${count(current)} tags -> ${count(wanted)}.
  The old one is kept beside it as tags.previous.json.
`)
