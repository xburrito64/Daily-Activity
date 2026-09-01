import assert from 'node:assert'
import fs from 'node:fs/promises'
import os from 'node:os'
import nodePath from 'node:path'
import { slugify, steamCover, coverSource, cleanGenres, pickGrid, createGames } from './games.js'

let pass = 0, fail = 0
const t = async (name, fn) => {
  try { await fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

await t('a game name becomes a filename you can still read', () => {
  assert.equal(slugify('Grand Theft Auto V'), 'grand-theft-auto-v')
  assert.equal(slugify('NieR:Automata'), 'nier-automata')
  assert.equal(slugify('Ōkami HD'), 'okami-hd')
  assert.equal(slugify('  Hades  '), 'hades')
})

await t('a name with nothing in it still names a file', () => {
  // A cover is written to disk under this. Coming back empty would mean a
  // filename that is only an extension.
  assert.equal(slugify('???'), 'game')
  assert.equal(slugify(''), 'game')
})

await t('a slug cannot walk out of the covers folder', () => {
  assert.equal(slugify('../../etc/passwd'), 'etc-passwd')
  assert.equal(slugify('..'), 'game')
})

await t("a cover is Steam's upright library picture", () => {
  // The one size Steam serves that is a cover rather than a banner. Every
  // other one is wide, and a wide picture is key art, which is the thing
  // this replaced.
  assert.equal(
    steamCover(1245620),
    'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1245620/library_600x900.jpg',
  )
  assert.equal(coverSource(steamCover(1245620)).hostname, 'shared.cloudflare.steamstatic.com')
})

await t('covers come from a host we know or they do not come at all', () => {
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

await t('and only the cover, not anything else that host serves', () => {
  const host = 'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/620'
  for (const file of ['header.jpg', 'capsule_231x87.jpg', 'movie480.webm', '']) {
    assert.throws(() => coverSource(`${host}/${file}`), new RegExp('not a Steam cover'), file)
  }
})

await t('genres are tidied on the way in', () => {
  // They are typed by hand, so they arrive however they were typed.
  assert.deepStrictEqual(cleanGenres(['  Turn-Based  Strategy ', '', null, 'Indie']),
    ['Turn-Based Strategy', 'Indie'])
})

await t('the same genre twice is one genre', () => {
  // "FPS" and "fps" are the same filing, and the spelling already on screen
  // is the one that stays.
  assert.deepStrictEqual(cleanGenres(['FPS', 'fps', 'Fps']), ['FPS'])
})

await t('a card cannot be flooded with genres', () => {
  assert.equal(cleanGenres(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']).length, 6)
  assert.equal(cleanGenres(['x'.repeat(200)])[0].length, 40)
})

await t('nothing at all is a perfectly good answer', () => {
  for (const bad of [null, undefined, 'Action', 42, {}]) {
    assert.deepStrictEqual(cleanGenres(bad), [], String(bad))
  }
})

// --- the second place a cover can come from --------------------------------

await t("SteamGridDB's covers are allowed through as well", () => {
  // Steam cannot dress every game: it never sold Minecraft, and a game it
  // does sell can have no library art up yet.
  const url = 'https://cdn2.steamgriddb.com/grid/9f2c6b1e.png'
  assert.equal(coverSource(url).href, url)
  assert.ok(coverSource('https://cdn.steamgriddb.com/grid/a1.jpg'))
  assert.ok(coverSource('https://cdn2.steamgriddb.com/grid/a1.webp'))
})

await t('but nothing else pretending to be one is', () => {
  const no = [
    'https://steamgriddb.com.evil.example.com/grid/x.png',
    'https://cdn2.steamgriddb.com/grid/x.svg',
    'https://cdn2.steamgriddb.com/grid/x.exe',
    'http://cdn2.steamgriddb.com/grid/x.png',
    'https://example.com/grid/x.png',
  ]
  for (const url of no) assert.throws(() => coverSource(url), /not a/, url)
})

await t('the cover picked is the right shape and the best liked', () => {
  // People upload these, so a game can have fifty and they are not all the
  // box. Only the ones the size Steam's own covers are.
  const body = { data: [
    { url: 'https://cdn2.steamgriddb.com/grid/wide.png', width: 920, height: 430, score: 999 },
    { url: 'https://cdn2.steamgriddb.com/grid/ok.png', width: 600, height: 900, score: 3 },
    { url: 'https://cdn2.steamgriddb.com/grid/best.png', width: 600, height: 900, score: 40 },
  ] }
  assert.equal(pickGrid(body), 'https://cdn2.steamgriddb.com/grid/best.png')
})

await t('and nothing is picked when there is nothing of that shape', () => {
  assert.equal(pickGrid({ data: [{ url: 'https://cdn2.steamgriddb.com/grid/w.png', width: 460, height: 215, score: 9 }] }), '')
  assert.equal(pickGrid({ data: [] }), '')
  assert.equal(pickGrid(null), '')
  // An entry with no address is not an answer, however well liked.
  assert.equal(pickGrid({ data: [{ width: 600, height: 900, score: 99 }] }), '')
})

// --- not losing a cover we already have -----------------------------------
//
// The way this broke in the wild: Steam had the cover on the day the game was
// first logged, stopped serving it a day later, and the next entry for the
// same game came back empty. The empty answer then overwrote the good record,
// so a picture sitting in the vault the whole time stopped being used.

const tmp = await fs.mkdtemp(nodePath.join(os.tmpdir(), 'covers-'))
const games = createGames({ apiKey: '', coversDir: tmp })

await t('a lookup that comes back empty uses the cover already in the vault', async () => {
  await fs.writeFile(nodePath.join(tmp, 'a-game-about-chopping-trees-1019471.jpg'), 'not really a jpeg')
  const kept = await games.keep({ id: 1019471, name: 'A Game About Chopping Trees', image: '' })
  assert.equal(kept.cover, 'a-game-about-chopping-trees-1019471.jpg')
})

await t('whatever the picture was saved as', async () => {
  await fs.writeFile(nodePath.join(tmp, 'minecraft-22509.png'), 'not really a png')
  assert.equal((await games.keep({ id: 22509, name: 'Minecraft', image: '' })).cover, 'minecraft-22509.png')
})

await t('and answers with nothing when there really is nothing', async () => {
  assert.equal((await games.keep({ id: 999999, name: 'Never Logged', image: '' })).cover, '')
})

await t('an empty cover never rubs out the one already written down', async () => {
  const game = { name: 'A Game About Chopping Trees', platforms: ['PC'], genres: ['Indie'] }
  await games.remember({ ...game, cover: 'a-game-about-chopping-trees-1019471.jpg' })
  // The same game picked again on a day the lookup failed.
  await games.remember({ ...game, cover: '' })
  assert.equal((await games.known())[game.name].cover, 'a-game-about-chopping-trees-1019471.jpg')
})

await t('but a new cover does replace an old one', async () => {
  const game = { name: 'A Game About Chopping Trees', platforms: ['PC'], genres: ['Indie'] }
  await games.remember({ ...game, cover: 'a-game-about-chopping-trees-1019471.png' })
  assert.equal((await games.known())[game.name].cover, 'a-game-about-chopping-trees-1019471.png')
})

await fs.rm(tmp, { recursive: true, force: true })

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
