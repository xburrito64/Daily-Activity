// Part of "npm run update-app": give the installed app the project's tag list
// and tag icons.
//
// The installed app keeps its own copy of both in the settings folder, so that
// they can be edited after installation. That also means a tag or an icon
// added here never reaches it — installing a new version leaves the old ones
// in place. Updating the app should bring them along.
//
// Only ever copies. Anything in the settings folder that isn't in the project
// is left where it is, so an icon dropped straight in there survives.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const settingsDir = path.join(process.env.APPDATA ?? '', 'Daily Documentation')

if (!fs.existsSync(path.join(settingsDir, 'tags.json'))) {
  // Never installed, or installed somewhere else. The app copies both in
  // itself the first time it runs, and those copies are already up to date.
  console.log('\n  No installed copy to update — it will start from this one.\n')
  process.exit(0)
}

const changed = []

// --- the tag list -------------------------------------------------------
const tagsSource = path.join(root, 'tags.json')
const tagsTarget = path.join(settingsDir, 'tags.json')
const wanted = fs.readFileSync(tagsSource, 'utf8')
const current = fs.readFileSync(tagsTarget, 'utf8')

if (wanted !== current) {
  const count = (text) => { try { return JSON.parse(text).length } catch { return '?' } }
  fs.copyFileSync(tagsTarget, path.join(settingsDir, 'tags.previous.json'))
  fs.writeFileSync(tagsTarget, wanted)
  changed.push(`tag list: ${count(current)} tags -> ${count(wanted)} (old one kept as tags.previous.json)`)
}

// --- the icons ----------------------------------------------------------
const iconsSource = path.join(root, 'tag-icons')
const iconsTarget = path.join(settingsDir, 'tag-icons')
fs.mkdirSync(iconsTarget, { recursive: true })

// Windows filenames don't care about case and neither does the icon lookup,
// so match that here: Anime.png must replace anime.png rather than joining it.
const existing = new Map(
  fs.readdirSync(iconsTarget).map((name) => [name.toLowerCase(), name]),
)

for (const name of fs.readdirSync(iconsSource)) {
  if (name.endsWith('.md')) continue // the instructions, already there
  const from = path.join(iconsSource, name)
  const to = path.join(iconsTarget, existing.get(name.toLowerCase()) ?? name)
  if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) continue
  fs.copyFileSync(from, to)
  changed.push(`icon: ${name}`)
}

if (changed.length === 0) {
  console.log('\n  The installed app already has this tag list and these icons.\n')
} else {
  console.log(`\n  ${changed.join('\n  ')}\n`)
}
