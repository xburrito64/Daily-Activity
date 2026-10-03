// Changing the tag list from inside the app.
//
// The list is a file you used to edit by hand, and a day refers to a tag by
// its id — "sleep", "walk-dog" — never by its name. That one fact is what
// makes all of this safe: a tag can be renamed, recoloured, given a new icon
// or moved without any note being touched, because none of those change the
// id, and the id is all a note holds. So the id is fixed when a tag is made
// and never changes after.
//
// The only change that could reach into the vault is taking a tag away, and
// that is refused for any tag a day still uses. Hiding it is the way to get
// it out of the row without losing what it names.

const refused = (message) => Object.assign(new Error(message), { status: 400 })

export const TAG_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MAX_TAGS = 60
const NAME_CHARS = 40
const ICON_CHARS = 16

// Any colour a person is likely to have written into the file: hex, or one of
// the CSS colour functions. Nothing that could close the declaration it is
// dropped into.
const COLOUR_RE = /^(#[0-9a-f]{3}(?:[0-9a-f]{3})?|(?:oklch|oklab|rgb|rgba|hsl|hsla)\([0-9a-z.,%\s/+-]{1,60}\))$/i

/**
 * An id for a new tag, from its name: "Walking the dog" -> "walking-the-dog".
 * One already taken gets a number on the end rather than being refused —
 * two tags may share a name, and they still need ids of their own.
 */
export function idFor(name, taken) {
  const base = String(name ?? '')
    .normalize('NFKD')
    .replace(/\p{Mark}+/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 30)
    .replace(/-+$/, '') || 'tag'
  const used = new Set(taken)
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`
}

/**
 * A tag list fit to write, from one sent by the app.
 *
 * Only the fields a tag is made of are kept, in the order the file has always
 * listed them, so the file stays readable. Anything the app adds on the way
 * out — the address of each tag's picture — is left behind. A tag with no id
 * is a new one and is given one here; a tag with an id must be one that
 * already exists, since an id is never changed and never invented by the app.
 */
export function cleanTags(next, previous) {
  if (!Array.isArray(next)) throw refused('the tag list is not a list')
  if (next.length === 0) throw refused('there has to be at least one tag')
  if (next.length > MAX_TAGS) throw refused(`at most ${MAX_TAGS} tags`)

  const existing = new Map((previous ?? []).map((tag) => [tag.id, tag]))
  const taken = next.map((tag) => String(tag?.id ?? '')).filter(Boolean)
  const seen = new Set()

  return next.map((raw) => {
    const name = String(raw?.name ?? '').replace(/\s+/g, ' ').trim()
    if (!name) throw refused('every tag needs a name')
    if (name.length > NAME_CHARS) throw refused(`"${name.slice(0, 20)}…" is longer than ${NAME_CHARS} letters`)

    let id = String(raw?.id ?? '').trim()
    if (id) {
      if (!existing.has(id)) throw refused(`there is no tag "${id}" to change`)
    } else {
      id = idFor(name, [...taken, ...seen, ...existing.keys()])
    }
    if (!TAG_ID_RE.test(id)) throw refused(`"${id}" is not a tag id`)
    if (seen.has(id)) throw refused(`"${id}" is in the list twice`)
    seen.add(id)

    const colour = String(raw?.colour ?? '').trim()
    if (!COLOUR_RE.test(colour)) throw refused(`${name}: that is not a colour`)

    const icon = String(raw?.icon ?? '').trim()
    if ([...icon].length > ICON_CHARS) throw refused(`${name}: the emoji is too long`)

    const tag = { id, name, colour, icon }
    // Kept only where it means something, as the file has always had it.
    const scale = Number(raw?.iconScale ?? existing.get(id)?.iconScale)
    if (Number.isFinite(scale) && scale !== 1) tag.iconScale = Math.min(2, Math.max(0.5, scale))
    if (raw?.hidden === true) tag.hidden = true
    return tag
  })
}

/** The ids the old list had and the new one doesn't. */
export const removedIds = (previous, next) => {
  const kept = new Set(next.map((tag) => tag.id))
  return (previous ?? []).map((tag) => tag.id).filter((id) => !kept.has(id))
}

/**
 * The file as it is written: one tag a line, the way it has always read by
 * eye, rather than JSON's default of one field a line.
 */
export const tagsText = (tags) => `[\n${tags.map((tag) => `  ${JSON.stringify(tag)}`).join(',\n')}\n]\n`

// What a tag's own picture may be, by the name a browser gives it.
export const PICTURE_TYPES = {
  'image/svg+xml': 'svg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
}
export const MAX_PICTURE_BYTES = 3 * 1024 * 1024

const DATA_URL_RE = /^data:([a-z+/]+);base64,([a-z0-9+/=\s]+)$/i

/** A picture sent as a data: address, as bytes and the extension it is saved with. */
export function readPicture(dataUrl) {
  const found = String(dataUrl ?? '').match(DATA_URL_RE)
  if (!found) throw refused('that is not a picture')
  const ext = PICTURE_TYPES[found[1].toLowerCase()]
  if (!ext) throw refused('pictures can be svg, png, webp, gif or jpg')
  const bytes = Buffer.from(found[2], 'base64')
  if (bytes.length === 0) throw refused('that picture is empty')
  if (bytes.length > MAX_PICTURE_BYTES) throw refused('that picture is bigger than 3 MB')
  return { bytes, ext }
}
