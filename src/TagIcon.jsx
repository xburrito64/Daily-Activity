/**
 * A tag's custom image if one has been dropped into the tag-icons folder,
 * otherwise its emoji. Both are drawn at the same size so swapping one over
 * never shifts the layout around it.
 *
 * A tag can ask for a larger one with "iconScale" in tags.json — mostly for
 * pictures that aren't square, which are fitted inside a square and so end up
 * drawn smaller than everything else. Twice normal is the ceiling: that is a
 * 40px box, and a chip is 40px tall, so nothing can be asked for that would
 * push its way out of the row it sits in.
 */
export default function TagIcon({ tag, className = '', scale }) {
  if (!tag) return null

  // An explicit scale is worked out from the room available, so it is trusted
  // as given — the clamp is only for whatever a person typed into tags.json.
  const size = scale ?? clampScale(tag.iconScale)
  const style = size === 1 ? undefined : { '--icon-scale': size }

  return tag.image
    ? <img className={`tagicon ${className}`} style={style} src={tag.image} alt="" aria-hidden="true" />
    : <span className={`tagicon emoji ${className}`} style={style} aria-hidden="true">{tag.icon}</span>
}

export function clampScale(value) {
  const scale = Number(value)
  if (!Number.isFinite(scale) || scale <= 0) return 1
  return Math.min(2, Math.max(0.5, scale))
}
