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
  barWidth: BAR_WIDTH.usual,
  iconSet: '',
  chipLook: 'classic',
  labels: 'auto',
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
    barWidth: Number.isFinite(width)
      ? Math.min(BAR_WIDTH.max, Math.max(BAR_WIDTH.min, width))
      : DEFAULTS.barWidth,
    iconSet: typeof got.iconSet === 'string' ? got.iconSet : DEFAULTS.iconSet,
    chipLook: CHIP_LOOKS.some((look) => look.id === got.chipLook) ? got.chipLook : DEFAULTS.chipLook,
    labels: LABEL_STYLES.some((style) => style.id === got.labels) ? got.labels : DEFAULTS.labels,
  }
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
