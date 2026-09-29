// Which picture each tag wears.
//
// A tag uses a custom image when a file named after its id sits in the icon
// folder, and falls back to its emoji otherwise. Nothing to configure — the
// file being there is the whole switch.
//
// A folder inside the icon folder is a set: another look for the same tags,
// named after the folder. Picking one in the settings swaps every tag it has
// a picture for, and a tag it has no picture for keeps the one it had — a set
// half drawn is still worth trying, and a tag going back to an emoji because
// one picture was missing would make the set look broken rather than
// unfinished.

import fs from 'node:fs'
import path from 'node:path'

// Best first: a vector scales to any zoom level without going fuzzy.
export const ICON_EXTENSIONS = ['.svg', '.png', '.webp', '.gif', '.jpg', '.jpeg']

// How many pictures a set shows of itself in the settings, so two sets can be
// told apart without switching to each in turn.
const PREVIEW = 6

/** The sets there are to pick from: every folder in the icon folder, by name. */
export function iconSets(dir) {
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

/**
 * The files in one folder, by lower-cased name.
 *
 * Windows doesn't care about capitals anywhere else, so neither does this:
 * Anime.gif and anime.gif both count. Two files that differ only in case
 * can't sit in one folder there, so there is nothing to disambiguate.
 */
function filesIn(dir) {
  try {
    return new Map(
      fs.readdirSync(dir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => [entry.name.toLowerCase(), entry.name]),
    )
  } catch {
    return new Map()
  }
}

/** The file a tag's picture is in, if the folder has one for it. */
function pictureFor(tag, files) {
  const wanted = ICON_EXTENSIONS
    .map((ext) => String(tag.id).toLowerCase() + ext)
    .find((name) => files.has(name))
  return wanted ? files.get(wanted) : null
}

/**
 * Where a picture is served from, stamped with when the file last changed.
 * A picture replaced from the settings keeps its name, and the page would go
 * on showing the one it already had under that name; the stamp is what tells
 * it the file is a different one now.
 */
function address(dir, ...parts) {
  let stamp = 0
  try { stamp = Math.round(fs.statSync(path.join(dir, ...parts)).mtimeMs) } catch { /* then no stamp */ }
  return `/tag-icons/${parts.map(encodeURIComponent).join('/')}${stamp ? `?v=${stamp}` : ''}`
}

/**
 * The tags, each wearing its picture from `set` where the set has one and its
 * own otherwise.
 *
 * `set` is only ever looked up among the folders that are really there, never
 * joined onto a path as it arrived — a name from a request is not something to
 * walk the disk with. One that is not there is the same as asking for none.
 */
export function withIcons(tags, dir, set = '') {
  const loose = filesIn(dir)
  const chosen = set && iconSets(dir).includes(set) ? set : ''
  const inSet = chosen ? filesIn(path.join(dir, chosen)) : new Map()

  return tags.map((tag) => {
    const fromSet = chosen && pictureFor(tag, inSet)
    if (fromSet) return { ...tag, image: address(dir, chosen, fromSet) }
    const own = pictureFor(tag, loose)
    return own ? { ...tag, image: address(dir, own) } : tag
  })
}

/**
 * Every set, with a few of its pictures to recognise it by and how many of
 * the tags it has a picture for. The loose files come first as the set with
 * no name — the icons the app had before sets existed.
 */
export function describeSets(tags, dir) {
  const describe = (name) => {
    const dressed = withIcons(tags, dir, name)
    const inSet = name ? filesIn(path.join(dir, name)) : filesIn(dir)
    const own = tags.filter((tag) => pictureFor(tag, inSet))
    return {
      name,
      covers: own.length,
      of: tags.length,
      preview: dressed
        .filter((tag) => own.includes(tags.find((t) => t.id === tag.id)))
        .slice(0, PREVIEW)
        .map((tag) => ({ id: tag.id, name: tag.name, image: tag.image })),
    }
  }
  return [describe(''), ...iconSets(dir).map(describe)]
}
