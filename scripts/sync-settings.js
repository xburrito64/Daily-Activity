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
const settingsDir = path.join(process.env.APPDATA ?? '', 'The Chronicle')

if (!fs.existsSync(path.join(settingsDir, 'tags.json'))) {
  // Never installed, or installed somewhere else. The app copies both in
  // itself the first time it runs, and those copies are already up to date.
  console.log('\n  No installed copy to update — it will start from this one.\n')
  process.exit(0)
}

const changed = []

// --- the tag list -------------------------------------------------------
// The installed list is edited from inside the app now, so it is the one
// that counts: a tag renamed or recoloured there must not be put back by an
// update. Only a tag the installed list has never had is carried across.
const tagsSource = path.join(root, 'tags.json')
const tagsTarget = path.join(settingsDir, 'tags.json')
const parse = (file) => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
let installed = null
try { installed = parse(tagsTarget) } catch { /* not ours to repair */ }
if (installed) {
  const have = new Set(installed.map((tag) => tag.id))
  const missing = parse(tagsSource).filter((tag) => !have.has(tag.id))
  if (missing.length > 0) {
    fs.copyFileSync(tagsTarget, path.join(settingsDir, 'tags.previous.json'))
    const lines = [...installed, ...missing].map((tag) => `  ${JSON.stringify(tag)}`)
    fs.writeFileSync(tagsTarget, `[\n${lines.join(',\n')}\n]\n`)
    changed.push(`new tags: ${missing.map((tag) => tag.name).join(', ')}`)
  }
}

// --- the icons ----------------------------------------------------------
const iconsSource = path.join(root, 'tag-icons')
const iconsTarget = path.join(settingsDir, 'tag-icons')
fs.mkdirSync(iconsTarget, { recursive: true })

// Windows filenames don't care about case and neither does the icon lookup,
// so match that here: Anime.png must replace anime.png rather than joining it.
/** Copy the pictures in one folder across, and any set folders inside it. */
function copyIcons(fromDir, toDir, label) {
  fs.mkdirSync(toDir, { recursive: true })
  const there = new Map(fs.readdirSync(toDir).map((name) => [name.toLowerCase(), name]))
  for (const entry of fs.readdirSync(fromDir, { withFileTypes: true })) {
    const name = entry.name
    if (name.endsWith('.md')) continue // the instructions, already there
    const from = path.join(fromDir, name)
    const to = path.join(toDir, there.get(name.toLowerCase()) ?? name)
    // A folder is a set of icons. One level only: a set is a folder of
    // pictures, not a folder of sets. Hidden folders — pictures put aside
    // when a new one was chosen — stay where they are.
    if (entry.isDirectory()) {
      if (name.startsWith('.')) continue
      if (!label) copyIcons(from, to, name)
      continue
    }
    if (fs.existsSync(to) && fs.readFileSync(to).equals(fs.readFileSync(from))) continue
    fs.copyFileSync(from, to)
    changed.push(`icon: ${label ? `${label}/` : ''}${name}`)
  }
}

copyIcons(iconsSource, iconsTarget, '')

if (changed.length === 0) {
  console.log('\n  The installed app already has this tag list and these icons.\n')
} else {
  console.log(`\n  ${changed.join('\n  ')}\n`)
}
