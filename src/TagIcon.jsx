/**
 * A tag's custom image if one has been dropped into the tag-icons folder,
 * otherwise its emoji. Both are drawn at the same size so swapping one over
 * never shifts the layout around it.
 */
export default function TagIcon({ tag, className = '' }) {
  if (!tag) return null
  return tag.image
    ? <img className={`tagicon ${className}`} src={tag.image} alt="" aria-hidden="true" />
    : <span className={`tagicon emoji ${className}`} aria-hidden="true">{tag.icon}</span>
}
