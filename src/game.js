import { coverUrl } from './api.js'

/**
 * Covers are key art — a wide picture, not a square icon. Drawn square it
 * would either letterbox into a strip with bars either side of it, or crop
 * down to whatever happened to be in the middle. Wide, at the height of the
 * lane, it reads as the game.
 */
export const COVER_ASPECT = 16 / 9

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
