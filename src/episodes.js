/**
 * Which episodes an evening was, said the way you would say it.
 *
 * Clicking five boxes in a grid is a list of five numbers; reading "5, 6, 7,
 * 8, 9" back is not how anybody says that. Runs collapse to a dash and the
 * gaps stay gaps, so three in a row and three scattered look as different on
 * the card as they were on the night.
 */
export function formatEpisodes(list) {
  const sorted = [...new Set(list ?? [])].sort((a, b) => a - b)
  if (sorted.length === 0) return ''

  const runs = []
  for (const n of sorted) {
    const last = runs[runs.length - 1]
    if (last && n === last[1] + 1) last[1] = n
    else runs.push([n, n])
  }
  // An en dash, which is what a range is written with, and a comma between
  // runs. Two in a row is "5, 6" rather than "5–6" — a dash for two numbers
  // that could just be listed reads as a range you have to work out.
  return runs
    .map(([from, to]) => (
      to === from ? `${from}` : to === from + 1 ? `${from}, ${to}` : `${from}–${to}`
    ))
    .join(', ')
}

/** "Episode 7" or "Episodes 5–7", which is the same sentence either way. */
export function episodeLabel(list) {
  const many = new Set(list ?? []).size
  if (many === 0) return ''
  return `${many === 1 ? 'Episode' : 'Episodes'} ${formatEpisodes(list)}`
}

/** The furthest one watched — what AniList calls progress. */
export function furthest(list) {
  return (list ?? []).reduce((a, b) => Math.max(a, b), 0)
}
