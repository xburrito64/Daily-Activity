import assert from 'node:assert'
import { slugify, thumbnailUrl } from './games.js'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

t('a game name becomes a filename you can still read', () => {
  assert.equal(slugify('Grand Theft Auto V'), 'grand-theft-auto-v')
  assert.equal(slugify('NieR:Automata'), 'nier-automata')
  assert.equal(slugify('Ōkami HD'), 'okami-hd')
  assert.equal(slugify('  Hades  '), 'hades')
})

t('a name with nothing in it still names a file', () => {
  // A cover is written to disk under this. Coming back empty would mean a
  // filename that is only an extension.
  assert.equal(slugify('???'), 'game')
  assert.equal(slugify(''), 'game')
})

t('a slug cannot walk out of the covers folder', () => {
  assert.equal(slugify('../../etc/passwd'), 'etc-passwd')
  assert.equal(slugify('..'), 'game')
})

t('covers are fetched at a width worth keeping', () => {
  assert.equal(
    thumbnailUrl('https://media.rawg.io/media/games/b29/b294fdd8.jpg').href,
    'https://media.rawg.io/media/resize/420/-/games/b29/b294fdd8.jpg',
  )
})

t('one that is already resized is left as it is', () => {
  const already = 'https://media.rawg.io/media/resize/420/-/games/b29/b294fdd8.jpg'
  assert.equal(thumbnailUrl(already).href, already)
})

t('covers come from RAWG or they do not come at all', () => {
  // Whatever is in the note eventually turns into a download. The host it
  // names is not something to take on trust.
  for (const url of [
    'https://example.com/media/games/x.jpg',
    'http://media.rawg.io.evil.test/media/x.jpg',
    'file:///C:/Windows/System32/x.jpg',
  ]) {
    assert.throws(() => thumbnailUrl(url), new RegExp('not a RAWG image'), url)
  }
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
