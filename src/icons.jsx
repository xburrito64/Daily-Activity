/**
 * The small marks on a card. Line drawings at one weight, sized by the rule
 * that draws them rather than by themselves, so a row of facts reads as a row
 * rather than as a collection of pictures.
 *
 * Shared because a game and a show are the same kind of card: the clock means
 * the same thing on both, and drawing it twice is how the two slowly stop
 * looking alike.
 */

export function ScreenIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="9" rx="1.2" />
      <path d="M6 14h4M8 11.5V14" strokeLinecap="round" />
    </svg>
  )
}

export function PenIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M11.2 2.3a1.4 1.4 0 0 1 2 2L6 11.5l-2.7.8.8-2.7Z" strokeLinejoin="round" />
      <path d="M10 3.5 12.5 6" />
    </svg>
  )
}

export function TagsIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M8.4 1.9H2.4a.6.6 0 0 0-.6.6v6a.6.6 0 0 0 .18.42l5.6 5.6a.6.6 0 0 0 .84 0l5.6-5.6a.6.6 0 0 0 0-.84l-5.6-5.6a.6.6 0 0 0-.42-.18Z" strokeLinejoin="round" />
      <circle cx="5" cy="5" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

export function ClockIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <circle cx="8" cy="8" r="6" />
      <path d="M8 4.6V8l2.4 1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Going round again: an arrow that comes back to where it started. */
export function RewatchIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <path d="M13.4 7.1a5.5 5.5 0 1 1-1.7-3.6" strokeLinecap="round" />
      <path d="M13.9 1.9v3.4h-3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Episodes: one frame of film with the play mark on it. */
export function EpisodeIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true">
      <rect x="1.5" y="3" width="13" height="10" rx="1.2" />
      <path d="M6.6 6.2 10 8l-3.4 1.8Z" strokeLinejoin="round" />
    </svg>
  )
}
