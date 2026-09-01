import assert from 'node:assert'
import { slugify, steamCover, coverSource, cleanGenres, pickGrid } from './games.js'

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

t('covers come from a host we know or they do not come at all', () => {
  // Whatever is in the note eventually turns into a download. The host it
  // names is not something to take on trust — and a second source being
  // allowed is a second host, not an open door.
  for (const url of [
    'https://example.com/store_item_assets/steam/apps/1/library_600x900.jpg',
    'http://shared.cloudflare.steamstatic.com.evil.test/x/library_600x900.jpg',
    'file:///C:/Windows/System32/library_600x900.jpg',
  ]) {
    assert.throws(() => coverSource(url), new RegExp('not a'), url)
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

// --- the second place a cover can come from --------------------------------

t("SteamGridDB's covers are allowed through as well", () => {
  // Steam cannot dress every game: it never sold Minecraft, and a game it
  // does sell can have no library art up yet.
  const url = 'https://cdn2.steamgriddb.com/grid/9f2c6b1e.png'
  assert.equal(coverSource(url).href, url)
  assert.ok(coverSource('https://cdn.steamgriddb.com/grid/a1.jpg'))
  assert.ok(coverSource('https://cdn2.steamgriddb.com/grid/a1.webp'))
})

t('but nothing else pretending to be one is', () => {
  const no = [
    'https://steamgriddb.com.evil.example.com/grid/x.png',
    'https://cdn2.steamgriddb.com/grid/x.svg',
    'https://cdn2.steamgriddb.com/grid/x.exe',
    'http://cdn2.steamgriddb.com/grid/x.png',
    'https://example.com/grid/x.png',
  ]
  for (const url of no) assert.throws(() => coverSource(url), /not a/, url)
})

t('the cover picked is the right shape and the best liked', () => {
  // People upload these, so a game can have fifty and they are not all the
  // box. Only the ones the size Steam's own covers are.
  const body = { data: [
    { url: 'https://cdn2.steamgriddb.com/grid/wide.png', width: 920, height: 430, score: 999 },
    { url: 'https://cdn2.steamgriddb.com/grid/ok.png', width: 600, height: 900, score: 3 },
    { url: 'https://cdn2.steamgriddb.com/grid/best.png', width: 600, height: 900, score: 40 },
  ] }
  assert.equal(pickGrid(body), 'https://cdn2.steamgriddb.com/grid/best.png')
})

t('and nothing is picked when there is nothing of that shape', () => {
  assert.equal(pickGrid({ data: [{ url: 'https://cdn2.steamgriddb.com/grid/w.png', width: 460, height: 215, score: 9 }] }), '')
  assert.equal(pickGrid({ data: [] }), '')
  assert.equal(pickGrid(null), '')
  // An entry with no address is not an answer, however well liked.
  assert.equal(pickGrid({ data: [{ width: 600, height: 900, score: 99 }] }), '')
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
