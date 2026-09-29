import { createContext } from 'react'

// How the app looks, as picked in the settings panel.
//
// Kept in the app rather than in the vault: none of this is a record of
// anything, and the vault is for the days. It survives a restart and an
// update, and it belongs to this machine — two computers can look different
// and still write the same diary.

const KEY = 'daily-documenter:appearance'

// The bar can be no wider than this, and the far end of the slider takes the
// limit off altogether. 2400 is what the app was drawn at before this was a
// setting, so leaving it alone changes nothing.
export const BAR_WIDTH = { min: 800, max: 3000, step: 50, usual: 2400 }
export const NO_LIMIT = BAR_WIDTH.max

/**
 * Whole looks for the app: colours, faces, corners, the sky and what moves
 * in it. See styles/themes.css, where each one is drawn. `swatch` is four
 * colours a card can show before its preview has painted.
 */
export const THEMES = [
  { id: 'starlit', name: 'Starlit', note: 'A mage’s journal under a living night sky: logging is spellcasting, tags rise through the ranks of magic, and a finished day brings a meteor shower.' },
  { id: 'scriptorium', name: 'Scriptorium', note: 'An illuminated manuscript that writes itself: an initial for every day in its colours, a chronicle, and the light of the hour.' },
  { id: 'hearthfire', name: 'Hearthfire', note: 'A fire you keep going by logging. Leave it and it burns down; the hours you missed turn to ash.' },
  { id: 'tidewater', name: 'Tidewater', note: 'Deep water by moonlight, with light rippling slowly across the dark.' },
  { id: 'petalfall', name: 'Petalfall', note: 'Plum twilight and rose haze, sakura petals drifting down.' },
  { id: 'nightshift', name: 'Nightshift', note: 'A green-screen terminal on the night shift: a system monitor of your week, a status line, and a CRT that boots.' },
]

/**
 * Ways to draw a tag's box. `note` is what the settings say under each one —
 * what it is, in the few words a person choosing between them needs.
 */
export const CHIP_LOOKS = [
  { id: 'classic', name: 'Classic', note: 'Filled with the tag colour, as it has always been' },
  { id: 'stub', name: 'Stub', note: 'Clipped corner, hairline ring, colour on the footing' },
  { id: 'seal', name: 'Seal', note: 'The icon set in a coloured medallion, the box left dark' },
  { id: 'ink', name: 'Ink', note: 'No box at all — icon and name, underlined in colour' },
  { id: 'banner', name: 'Banner', note: 'Solid colour, like the blocks on the bar' },
]

/** What a block on the bar shows when there is room. */
export const LABEL_STYLES = [
  { id: 'auto', name: 'Icon and name', note: 'The name beside the icon where it fits, the icon alone where it doesn’t' },
  { id: 'icon', name: 'Icon only', note: 'Pictures only; the colour and the icon say which tag' },
  { id: 'name', name: 'Name only', note: 'Words only; no icons and no covers on the bar' },
]

export const DEFAULTS = {
  theme: 'starlit',
  barWidth: BAR_WIDTH.usual,
  iconSet: '',
  chipLook: 'classic',
  labels: 'auto',
  // Game and anime covers on the bar. Off, a named block wears its tag's
  // icon there instead; the cards in a note keep their covers either way.
  covers: true,
  // The line of shortcuts above the days.
  hints: true,
}

/**
 * Anything read back, made safe to use: a value that is missing, mistyped or
 * from a version that had other choices falls back to the usual one rather
 * than leaving the app drawn with a style that no longer exists.
 */
export function normalise(raw) {
  const got = raw && typeof raw === 'object' ? raw : {}
  const width = Math.round(Number(got.barWidth))
  return {
    theme: THEMES.some((theme) => theme.id === got.theme) ? got.theme : DEFAULTS.theme,
    barWidth: Number.isFinite(width)
      ? Math.min(BAR_WIDTH.max, Math.max(BAR_WIDTH.min, width))
      : DEFAULTS.barWidth,
    iconSet: typeof got.iconSet === 'string' ? got.iconSet : DEFAULTS.iconSet,
    chipLook: CHIP_LOOKS.some((look) => look.id === got.chipLook) ? got.chipLook : DEFAULTS.chipLook,
    labels: LABEL_STYLES.some((style) => style.id === got.labels) ? got.labels : DEFAULTS.labels,
    covers: typeof got.covers === 'boolean' ? got.covers : DEFAULTS.covers,
    hints: typeof got.hints === 'boolean' ? got.hints : DEFAULTS.hints,
  }
}

/**
 * Put a theme on the page. Done straight away rather than after the next
 * draw: the bar measures its labels in the theme's own face, and measuring in
 * the old one would fit names to the wrong widths until something moved.
 */
export function wearTheme(theme) {
  try {
    document.documentElement.dataset.theme = theme
  } catch { /* no page to wear it — a test, say */ }
}

/** The CSS max-width the page takes for a given setting. */
export const widthOf = (barWidth) => (barWidth >= NO_LIMIT ? 'none' : `${barWidth}px`)

export function loadAppearance() {
  try {
    return normalise(JSON.parse(localStorage.getItem(KEY) ?? 'null'))
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveAppearance(appearance) {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalise(appearance)))
  } catch { /* nowhere to keep it; it lasts until the window closes */ }
}

/** The current appearance, for anything that draws. */
export const Appearance = createContext(DEFAULTS)
