import { coverUrl } from './api.js'

/**
 * A cover is upright, two by three — the shape a game's box has always been,
 * and the shape of every poster ever printed for a show. Steam's library
 * picture and AniList's cover are both exactly that, which is a coincidence
 * worth taking: one number, one rule, both kinds of picture.
 *
 * Not square, so it is given the width that shape wants rather than being
 * fitted into an icon's box, where it would sit as a narrow panel with empty
 * space either side of it.
 */
export const COVER_ASPECT = 2 / 3

/**
 * A block that says what it was, dressed as its own tag.
 *
 * Everything that draws a block — its label on the bar, its chip in the note,
 * its row in the ledger — takes a tag and asks it for a name and a picture. A
 * named game or a named show has both, better ones, so this hands them over
 * in the shape those already understand rather than teaching each of them
 * about games and anime separately.
 *
 * A block with nothing attached is just a Game block or an Anime block, and
 * gets the tag back untouched.
 */
export function blockFace(tag, block) {
  const name = block?.game || block?.show
  if (!tag || !name) return tag
  return {
    ...tag,
    name,
    image: block.cover ? coverUrl(block.cover) : tag.image,
    aspect: block.cover ? COVER_ASPECT : undefined,
  }
}
