import assert from 'node:assert'
import { slugify, steamCover, coverSource, cleanGenres } from './games.js'

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

t("a cover is Steam's upright library picture", () => {
  // The one size Steam serves that is a cover rather than a banner. Every
  // other one is wide, and a wide picture is key art, which is the thing
  // this replaced.
  assert.equal(
    steamCover(1245620),
    'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1245620/library_600x900.jpg',
  )
  assert.equal(coverSource(steamCover(1245620)).hostname, 'shared.cloudflare.steamstatic.com')
})

t('covers come from Steam or they do not come at all', () => {
  // Whatever is in the note eventually turns into a download. The host it
  // names is not something to take on trust.
  for (const url of [
    'https://example.com/store_item_assets/steam/apps/1/library_600x900.jpg',
    'http://shared.cloudflare.steamstatic.com.evil.test/x/library_600x900.jpg',
    'file:///C:/Windows/System32/library_600x900.jpg',
  ]) {
    assert.throws(() => coverSource(url), new RegExp('not a Steam cover'), url)
  }
})

t('and only the cover, not anything else that host serves', () => {
  const host = 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/620'
  for (const file of ['header.jpg', 'capsule_231x87.jpg', 'movie480.webm', '']) {
    assert.throws(() => coverSource(`${host}/${file}`), new RegExp('not a Steam cover'), file)
  }
})

t('genres are tidied on the way in', () => {
  // They are typed by hand, so they arrive however they were typed.
  assert.deepStrictEqual(cleanGenres(['  Turn-Based  Strategy ', '', null, 'Indie']),
    ['Turn-Based Strategy', 'Indie'])
})

t('the same genre twice is one genre', () => {
  // "FPS" and "fps" are the same filing, and the spelling already on screen
  // is the one that stays.
  assert.deepStrictEqual(cleanGenres(['FPS', 'fps', 'Fps']), ['FPS'])
})

t('a card cannot be flooded with genres', () => {
  assert.equal(cleanGenres(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).length, 6)
  assert.equal(cleanGenres(['x'.repeat(200)])[0].length, 40)
})

t('nothing at all is a perfectly good answer', () => {
  for (const bad of [null, undefined, 'Action', 42, {}]) {
    assert.deepStrictEqual(cleanGenres(bad), [], String(bad))
  }
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
