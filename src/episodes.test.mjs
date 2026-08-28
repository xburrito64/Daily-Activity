import assert from 'node:assert'
import { formatEpisodes, episodeLabel, furthest } from './episodes.js'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

t('one episode is just the number', () => {
  assert.equal(formatEpisodes([7]), '7')
  assert.equal(episodeLabel([7]), 'Episode 7')
})

t('a run of three or more collapses to a range', () => {
  assert.equal(formatEpisodes([5, 6, 7]), '5–7')
  assert.equal(episodeLabel([5, 6, 7]), 'Episodes 5–7')
})

t('two in a row are listed, not ranged', () => {
  // "5–6" is a range you have to work out to learn it holds two numbers.
  assert.equal(formatEpisodes([5, 6]), '5, 6')
})

t('gaps stay gaps', () => {
  assert.equal(formatEpisodes([1, 2, 3, 7, 9, 10, 11]), '1–3, 7, 9–11')
})

t('clicked in any order, it reads in one', () => {
  assert.equal(formatEpisodes([7, 5, 6]), '5–7')
  assert.equal(formatEpisodes([3, 1, 2, 3]), '1–3')
})

t('nothing picked says nothing', () => {
  assert.equal(formatEpisodes([]), '')
  assert.equal(formatEpisodes(null), '')
  assert.equal(episodeLabel([]), '')
  assert.equal(episodeLabel(undefined), '')
})

t('the furthest one is what AniList calls progress', () => {
  assert.equal(furthest([5, 6, 7]), 7)
  assert.equal(furthest([12, 3]), 12)
  assert.equal(furthest([]), 0)
  assert.equal(furthest(undefined), 0)
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
