import assert from 'node:assert'
import { slugify, coverSource, cleanGenres, plainText, titleOf, airedCount } from './anime.js'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

t('a show name becomes a filename you can still read', () => {
  assert.equal(slugify('Sousou no Frieren'), 'sousou-no-frieren')
  assert.equal(slugify('Re:ZERO -Starting Life in Another World-'), 're-zero-starting-life-in-another-world')
  assert.equal(slugify('Ōkami-san'), 'okami-san')
})

t('a name with nothing left in it still names a file', () => {
  // A cover is written to disk under this. Coming back empty would mean a
  // filename that is only an extension.
  assert.equal(slugify('！！！'), 'anime')
  assert.equal(slugify(''), 'anime')
})

t('a slug cannot walk out of the covers folder', () => {
  assert.equal(slugify('../../etc/passwd'), 'etc-passwd')
  assert.equal(slugify('..'), 'anime')
})

t('a cover has to come from AniList itself', () => {
  const ok = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587-x.jpg'
  assert.equal(coverSource(ok).href, ok)
  // Any numbered host of theirs, since the number is not ours to predict.
  assert.ok(coverSource(ok.replace('s4.', 's99.')))
})

t('anything else is refused before it is downloaded', () => {
  const no = [
    'https://evil.example.com/file/anilistcdn/media/anime/cover/large/x.jpg',
    'https://s4.anilist.co.evil.example.com/file/anilistcdn/media/x.jpg',
    'https://s4.anilist.co/somewhere/else/x.jpg',
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/x.svg',
    'http://s4.anilist.co/file/anilistcdn/media/anime/cover/large/x.jpg',
  ]
  for (const url of no) assert.throws(() => coverSource(url), /not an AniList cover/, url)
})

t('the English title is the one a note gets, when there is one', () => {
  assert.equal(titleOf({ title: { english: 'Frieren', romaji: 'Sousou no Frieren' } }), 'Frieren')
  assert.equal(titleOf({ title: { english: null, romaji: 'Sousou no Frieren' } }), 'Sousou no Frieren')
  assert.equal(titleOf({ title: {} }), '')
})

t('only the episodes that have aired can be picked', () => {
  // Finished: all of them.
  assert.equal(airedCount({ episodes: 28, nextAiringEpisode: null }), 28)
  // Part way through: the one due next has not happened, so it is the edge.
  assert.equal(airedCount({ episodes: 12, nextAiringEpisode: { episode: 9 } }), 8)
  // A show that runs on with no announced total still knows where it is.
  assert.equal(airedCount({ episodes: null, nextAiringEpisode: { episode: 1176 } }), 1175)
  // Nothing out yet is nothing to offer.
  assert.equal(airedCount({ episodes: 12, nextAiringEpisode: null, }), 12)
  assert.equal(airedCount({ episodes: null, nextAiringEpisode: null }), 0)
  assert.equal(airedCount({}), 0)
})

t("a description comes out as something you can read in two lines", () => {
  assert.equal(
    plainText('A <b>tale</b> of<br>two &amp; a half <i>things</i>. &quot;Quoted&quot;'),
    'A tale of two & a half things. "Quoted"',
  )
  assert.equal(plainText(null), '')
  // An entity nobody listed is left alone rather than eaten.
  assert.equal(plainText('100&deg; out'), '100&deg; out')
})

t('genres are trimmed, deduped and capped, however they arrive', () => {
  assert.deepStrictEqual(cleanGenres(['  Action ', 'action', 'Drama']), ['Action', 'Drama'])
  assert.deepStrictEqual(cleanGenres(null), [])
  assert.equal(cleanGenres(['a', 'b', 'c', 'd', 'e', 'f', 'g']).length, 6)
  assert.equal(cleanGenres(['x'.repeat(90)])[0].length, 40)
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
