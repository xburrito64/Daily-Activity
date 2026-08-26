import { coverUrl } from './api.js'

/**
 * A cover is upright, two by three, the shape a game's box has always been —
 * Steam's library picture, which is where these come from and the only thing
 * either database has that is actually a cover.
 *
 * Not square, so it is given the width that shape wants rather than being
 * fitted into an icon's box, where it would sit as a narrow panel with empty
 * space either side of it.
 */
export const COVER_ASPECT = 2 / 3

/**
 * A named game block, dressed as its own tag.
 *
 * Everything that draws a block — its label on the bar, its chip in the note,
 * its row in the ledger — takes a tag and asks it for a name and a picture.
 * A game has both, better ones, so this hands them over in the shape those
 * already understand rather than teaching each of them about games.
 *
 * A block with nothing attached is just a Game block, and gets the tag back
 * untouched.
 */
export function gameFace(tag, block) {
  if (!tag || !block?.game) return tag
  return {
    ...tag,
    name: block.game,
    image: block.cover ? coverUrl(block.cover) : tag.image,
    aspect: block.cover ? COVER_ASPECT : undefined,
  }
}
