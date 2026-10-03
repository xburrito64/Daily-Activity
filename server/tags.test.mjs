// What the tag editor is allowed to write. The list is what every day's
// note is read through, so the rules are the ones that keep a note meaning
// what it meant: an id never changes, and nothing leaves that is still used.

import assert from 'node:assert/strict'
import { cleanTags, removedIds, idFor, tagsText, readPicture } from './tags.js'

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

const before = [
  { id: 'sleep', name: 'Sleep', colour: 'oklch(0.34 0.055 258)', icon: '🌙' },
  { id: 'anything-else', name: 'Anything Else?', colour: '#cb4d80', icon: '❓', iconScale: 2 },
  { id: 'walk-dog', name: 'Walking the dog', colour: 'oklch(0.46 0.07 150)', icon: '🐕' },
]

console.log('\ntags')

t('a rename, a recolour and a new emoji keep the id', () => {
  const next = cleanTags([
    { ...before[0], name: 'Sleeping', colour: '#223355', icon: '😴' },
    before[1],
    before[2],
  ], before)
  assert.deepEqual(next[0], { id: 'sleep', name: 'Sleeping', colour: '#223355', icon: '😴' })
})

t('what the app adds on the way out is left behind', () => {
  const next = cleanTags(before.map((tag) => ({ ...tag, image: '/tag-icons/x.png?v=1', aspect: 1 })), before)
  assert.deepEqual(next, before)
})

t('the order sent is the order kept', () => {
  const next = cleanTags([before[2], before[0], before[1]], before)
  assert.deepEqual(next.map((tag) => tag.id), ['walk-dog', 'sleep', 'anything-else'])
})

t('hidden is kept, and only when it is true', () => {
  const next = cleanTags([{ ...before[0], hidden: true }, { ...before[1], hidden: false }, before[2]], before)
  assert.equal(next[0].hidden, true)
  assert.equal('hidden' in next[1], false)
})

t('a tag the app asked for a bigger icon keeps it', () => {
  const next = cleanTags(before.map(({ iconScale, ...tag }) => tag), before)
  assert.equal(next[1].iconScale, 2, 'even when the app did not send it back')
})

t('a new tag gets an id made from its name', () => {
  const next = cleanTags([...before, { id: '', name: 'Guitar Practice', colour: '#445566', icon: '🎸' }], before)
  assert.equal(next[3].id, 'guitar-practice')
})

t('and one that would clash gets a number', () => {
  const next = cleanTags([...before, { name: 'Sleep', colour: '#445566', icon: '' }], before)
  assert.equal(next[3].id, 'sleep-2')
  assert.equal(idFor('Sleep', ['sleep', 'sleep-2']), 'sleep-3')
  assert.equal(idFor('Ōkami & Friends!', []), 'okami-friends')
  assert.equal(idFor('???', []), 'tag')
})

t('an id the list never had cannot be sent in', () => {
  assert.throws(() => cleanTags([{ id: 'made-up', name: 'X', colour: '#fff', icon: '' }], before), /no tag "made-up"/)
})

t('the same tag twice is refused', () => {
  assert.throws(() => cleanTags([before[0], before[0]], before), /twice/)
})

t('a tag needs a name, and not a novel', () => {
  assert.throws(() => cleanTags([{ ...before[0], name: '   ' }], before), /needs a name/)
  assert.throws(() => cleanTags([{ ...before[0], name: 'x'.repeat(41) }], before), /longer than/)
})

t('a colour has to be a colour, and nothing else', () => {
  for (const colour of ['#abc', '#A1B2C3', 'oklch(0.5 0.1 200)', 'rgb(10, 20, 30)', 'hsl(200 50% 40%)']) {
    assert.equal(cleanTags([{ ...before[0], colour }], before)[0].colour, colour)
  }
  for (const colour of ['red; background: url(x)', 'url(http://x)', '', '#12345', 'oklch(1 2 3); }']) {
    assert.throws(() => cleanTags([{ ...before[0], colour }], before), /not a colour/, colour)
  }
})

t('an empty list is never written', () => {
  assert.throws(() => cleanTags([], before), /at least one/)
  assert.throws(() => cleanTags('sleep', before), /not a list/)
})

t('what was taken away is known, so it can be checked against the days', () => {
  assert.deepEqual(removedIds(before, [before[0]]), ['anything-else', 'walk-dog'])
  assert.deepEqual(removedIds(before, before), [])
})

t('the file stays one tag a line', () => {
  const text = tagsText(before.slice(0, 2))
  assert.equal(text.split('\n').length, 5)
  assert.deepEqual(JSON.parse(text), before.slice(0, 2))
})

t('a picture is only ever a picture', () => {
  const png = `data:image/png;base64,${Buffer.from('not really').toString('base64')}`
  assert.deepEqual(readPicture(png).ext, 'png')
  assert.equal(readPicture('data:image/svg+xml;base64,PHN2Zy8+').ext, 'svg')
  assert.throws(() => readPicture('data:text/html;base64,PGgxPg=='), /svg, png/)
  assert.throws(() => readPicture('https://example.com/a.png'), /not a picture/)
  assert.throws(() => readPicture('data:image/png;base64,'), /not a picture|empty/)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
