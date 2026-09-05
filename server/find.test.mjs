import assert from 'node:assert'
import { findIn } from './find.js'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

const TAGS = [
  { id: 'anime', name: 'Anime' },
  { id: 'game', name: 'Game' },
  { id: 'food', name: 'Food' },
  { id: 'walk-coco', name: 'Walking w/ Coco' },
]

const days = [
  {
    date: '2026-08-24',
    entries: [
      { tag: 'anime', start: '20:00', end: '21:00', show: 'ONE PIECE', episodes: [1175] },
      { tag: 'food', start: '18:00', end: '18:30', note: 'ordered fries from oregano' },
    ],
  },
  {
    date: '2026-08-26',
    entries: [
      { tag: 'game', start: '12:30', end: '13:20', game: 'Bodycam', note: 'Tried it out, refunded' },
      { tag: 'anime', start: '19:00', end: '19:50', show: "JoJo's Bizarre Adventure (TV)" },
      { tag: 'walk-coco', start: '07:50', end: '08:20' },
    ],
  },
  {
    date: '2026-08-29',
    entries: [
      { tag: 'anime', start: '03:50', end: '05:50', show: 'ONE PIECE', note: 'rewatching: Enies Lobby' },
    ],
  },
]

const shape = (hits) => hits.map((h) => `${h.date} ${h.start}-${h.end} ${h.what}`)

t('a show is found wherever it was watched', () => {
  assert.deepStrictEqual(shape(findIn(days, 'one piece', TAGS)), [
    '2026-08-24 20:00-21:00 ONE PIECE',
    '2026-08-29 03:50-05:50 ONE PIECE',
  ])
})

t('and a game, by its own name', () => {
  assert.deepStrictEqual(shape(findIn(days, 'bodycam', TAGS)), ['2026-08-26 12:30-13:20 Bodycam'])
})

t('a whole category is a search too', () => {
  // "Anime" is not written on any of these blocks — it is what their tag is
  // called — and it should still find all three evenings.
  assert.strictEqual(findIn(days, 'Anime', TAGS).length, 3)
  assert.strictEqual(findIn(days, 'game', TAGS).length, 1)
})

t('a tag answers to what the vault calls it as well as to its name', () => {
  assert.strictEqual(findIn(days, 'walk-coco', TAGS).length, 1)
  assert.strictEqual(findIn(days, 'Walking w/ Coco', TAGS).length, 1)
  assert.strictEqual(findIn(days, 'coco', TAGS).length, 1, 'and to a piece of either')
})

t('what was written down is searched with everything else', () => {
  assert.deepStrictEqual(shape(findIn(days, 'fries', TAGS)), ['2026-08-24 18:00-18:30 Food'])
  assert.deepStrictEqual(shape(findIn(days, 'refunded', TAGS)), ['2026-08-26 12:30-13:20 Bodycam'])
})

t('case never matters', () => {
  assert.strictEqual(findIn(days, 'JOJO', TAGS).length, 1)
  assert.strictEqual(findIn(days, 'jojo', TAGS).length, 1)
})

t('results come back in the order the days are drawn in', () => {
  const hits = findIn(days, 'e', TAGS) // in nearly everything
  const keys = hits.map((h) => h.date + h.start)
  assert.deepStrictEqual(keys, [...keys].sort(), 'oldest first, earliest first within a day')
})

t('an empty search finds nothing rather than everything', () => {
  assert.deepStrictEqual(findIn(days, '', TAGS), [])
  assert.deepStrictEqual(findIn(days, '   ', TAGS), [])
})

t('a day that cannot be read contributes nothing', () => {
  const broken = [{ date: '2026-08-24', malformed: true, entries: [] }, ...days.slice(1)]
  assert.strictEqual(findIn(broken, 'one piece', TAGS).length, 1)
})

t('episode numbers are not searched', () => {
  // A search for "1175" should not turn up every show whose episode list
  // happens to contain it — the numbers are not what anyone is looking for.
  assert.deepStrictEqual(findIn(days, '1175', TAGS), [])
})

t('a hit carries enough to find the block it came from', () => {
  const [hit] = findIn(days, 'bodycam', TAGS)
  assert.deepStrictEqual(
    { date: hit.date, start: hit.start, end: hit.end, tag: hit.tag, game: hit.game, show: hit.show },
    { date: '2026-08-26', start: '12:30', end: '13:20', tag: 'game', game: 'Bodycam', show: '' },
  )
})

t('without a tag list, tags answer to their id alone', () => {
  assert.strictEqual(findIn(days, 'walk-coco').length, 1)
  assert.strictEqual(findIn(days, 'Walking w/ Coco').length, 0)
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
