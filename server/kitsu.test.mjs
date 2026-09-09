// What the backup list is allowed to turn into, and what it must never be
// mistaken for. Nothing here goes near the network: every one of these is a
// decision made about a reply, and the replies are written out by hand.

import assert from 'node:assert/strict'
import {
  shape, airedCount, kitsuNumber, wireId, PREFIX, CHAIN_ROLES, SERIES_FORMATS,
} from './kitsu.js'
import { showId, coverSource } from './anime.js'

let passed = 0
let failed = 0
const t = (name, fn) => {
  try {
    fn()
    passed++
    console.log(`  ok   ${name}`)
  } catch (err) {
    failed++
    console.log(`  FAIL ${name}\n       ${err.message}`)
  }
}

const record = (attributes, id = '46474') => ({ id, type: 'anime', attributes })

const frieren = {
  titles: { en: 'Frieren: Beyond Journey’s End', en_jp: 'Sousou no Frieren' },
  canonicalTitle: 'Sousou no Frieren',
  subtype: 'TV',
  status: 'finished',
  episodeCount: 28,
  episodeLength: 24,
  startDate: '2023-09-29',
  averageRating: '88.81',
  posterImage: { large: 'https://media.kitsu.app/anime/46474/poster_image/large-ec9.jpeg' },
  synopsis: 'After the party of heroes defeated the Demon King, they went home.',
}

console.log('\nkitsu')

// --- the two lists never wear each other's numbers -------------------------

t('a backup id is never a number', () => {
  assert.strictEqual(wireId(46474), 'kitsu-46474')
  assert.ok(Number.isNaN(Number(wireId(46474))), 'so nothing can quietly send it to AniList')
})

t('and a number is never read as a backup id', () => {
  assert.strictEqual(kitsuNumber(21), null)
  assert.strictEqual(kitsuNumber('21'), null)
  assert.strictEqual(kitsuNumber(`${PREFIX}21`), 21)
})

t('nothing malformed gets through as either', () => {
  for (const bad of ['kitsu-', 'kitsu-0', 'kitsu--3', 'kitsu-1.5', 'kitsu-abc', '', null]) {
    assert.strictEqual(kitsuNumber(bad), null, `${bad} is not an id`)
  }
})

t('an id says which list it came off', () => {
  assert.deepStrictEqual(showId(52991), {
    from: 'anilist', number: 52991, id: 52991, stamp: '52991',
  })
  assert.deepStrictEqual(showId('kitsu-46474'), {
    from: 'kitsu', number: 46474, id: 'kitsu-46474', stamp: 'kitsu-46474',
  })
  assert.strictEqual(showId('nonsense'), null)
  assert.strictEqual(showId(-3), null)
})

t('the same show off both lists is filed under two names', () => {
  // Which is the point of the stamp: one picture per record, never one
  // record quietly wearing the other one's picture.
  assert.notStrictEqual(showId(21).stamp, showId('kitsu-21').stamp)
})

// --- covers ----------------------------------------------------------------

t('a cover may come from either list and nowhere else', () => {
  const fine = [
    'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1-abc.jpg',
    'https://media.kitsu.app/anime/46474/poster_image/large-ec9.jpeg',
    'https://media.kitsu.io/anime/46474/poster_image/large-ec9.png',
  ]
  for (const url of fine) assert.ok(coverSource(url), url)

  const not = [
    'http://media.kitsu.app/anime/1/poster_image/large.jpg',   // not https
    'https://media.kitsu.example.com/anime/1/large.jpg',       // not the host
    'https://media.kitsu.app/uploads/anything/large.jpg',      // not the folder
    'https://media.kitsu.app/anime/1/poster_image/large.svg',  // not a picture
  ]
  for (const url of not) assert.throws(() => coverSource(url), url)
})

// --- how many episodes there are to tick -----------------------------------

t('a finished show offers what it has', () => {
  assert.strictEqual(airedCount({ status: 'finished', episodeCount: 28 }), 28)
})

t('a show with no count offers what is on record', () => {
  // One Piece: running since 1999, and no total anybody could write down.
  assert.strictEqual(airedCount({ status: 'current', episodeCount: null }, 1401), 1401)
})

t('and nothing at all when there is neither', () => {
  assert.strictEqual(airedCount({ status: 'current' }), 0)
})

t('a season announced for next year offers nothing', () => {
  // The one place erring long would be a lie rather than a nuisance: you
  // cannot have watched an episode of something that has not started.
  assert.strictEqual(airedCount({ status: 'unreleased', episodeCount: 14 }), 0)
  assert.strictEqual(airedCount({ status: 'upcoming', episodeCount: 12 }, 12), 0)
  assert.strictEqual(airedCount({ status: 'tba', episodeCount: 6 }), 0)
})

// --- the shape everything downstream reads ---------------------------------

t('a show comes back in the same words AniList uses', () => {
  const show = shape(record(frieren), { genres: ['Fantasy', 'Adventure'] })
  assert.deepStrictEqual(show, {
    id: 'kitsu-46474',
    name: 'Frieren: Beyond Journey’s End',
    original: 'Sousou no Frieren',
    format: 'TV',
    status: 'FINISHED',
    year: 2023,
    episodes: 28,
    aired: 28,
    duration: 24,
    genres: ['Fantasy', 'Adventure'],
    score: 89,
    cover: 'https://media.kitsu.app/anime/46474/poster_image/large-ec9.jpeg',
    description: 'After the party of heroes defeated the Demon King, they went home.',
    from: 'kitsu',
  })
})

t('the English name is the one the note will read as', () => {
  const only = { ...frieren, titles: { en_jp: 'Sousou no Frieren' } }
  assert.strictEqual(shape(record(only)).name, 'Sousou no Frieren')
  assert.strictEqual(shape(record(only)).original, '', 'and is not also given as the other one')
})

t('a description is cut by whatever rule it was handed', () => {
  const long = { ...frieren, synopsis: 'x'.repeat(400) }
  const show = shape(record(long), { shorten: (text) => text.slice(0, 10) })
  assert.strictEqual(show.description, 'xxxxxxxxxx')
})

t('missing numbers stay missing rather than becoming zero', () => {
  const thin = { titles: { en: 'Something' }, subtype: 'ONA', status: 'current' }
  const show = shape(record(thin, '9'))
  assert.deepStrictEqual(
    { year: show.year, episodes: show.episodes, duration: show.duration, score: show.score },
    { year: null, episodes: null, duration: null, score: null },
  )
})

t('a format it has never heard of is blank, not guessed', () => {
  assert.strictEqual(shape(record({ ...frieren, subtype: 'radio' })).format, '')
  assert.strictEqual(shape(record({ ...frieren, status: 'whatever' })).status, '')
})

// --- what counts as another season -----------------------------------------

t('only what carried on is another season', () => {
  assert.ok(CHAIN_ROLES.has('sequel') && CHAIN_ROLES.has('prequel'))
  for (const role of ['side_story', 'adaptation', 'other', 'summary', 'spinoff']) {
    assert.ok(!CHAIN_ROLES.has(role), `${role} is related, not a season`)
  }
  assert.ok(SERIES_FORMATS.has('TV') && SERIES_FORMATS.has('ONA'))
  for (const format of ['MOVIE', 'SPECIAL', 'OVA', 'MUSIC']) {
    assert.ok(!SERIES_FORMATS.has(format), `a ${format} is not season four of anything`)
  }
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
