// Which picture a block is drawn with. The rule is small and the case it is
// for is not: a game picked before its art existed, whose day's note will
// never have a cover written into it.

import assert from 'node:assert/strict'
import { coverFor, blockFace, COVER_ASPECT } from './face.js'

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

const found = new Map([
  ['game:Valorant', 'valorant-415171.png'],
  ['show:Frieren', 'frieren-52991.jpg'],
])

console.log('\nface')

t('a block with its own cover keeps it', () => {
  assert.equal(coverFor({ game: 'Valorant', cover: 'mine.jpg' }, found), 'mine.jpg')
})

t('a block without one borrows the one found since', () => {
  assert.equal(coverFor({ game: 'Valorant', cover: '' }, found), 'valorant-415171.png')
  assert.equal(coverFor({ show: 'Frieren' }, found), 'frieren-52991.jpg')
})

t('a game and a show of the same name are not each other', () => {
  assert.equal(coverFor({ show: 'Valorant' }, found), '')
  assert.equal(coverFor({ game: 'Frieren' }, found), '')
})

t('nothing found is nothing, with or without a list to look in', () => {
  assert.equal(coverFor({ game: 'ROBLOX' }, found), '')
  assert.equal(coverFor({ game: 'Valorant' }, null), '')
  assert.equal(coverFor({ tag: 'food' }, found), '')
})

t('the bar draws a borrowed cover exactly like its own', () => {
  const tag = { id: 'game', name: 'Game', image: '/tag.svg' }
  const face = blockFace(tag, { tag: 'game', game: 'Valorant' }, found)
  assert.equal(face.name, 'Valorant')
  assert.equal(face.image, '/api/covers/valorant-415171.png')
  assert.equal(face.aspect, COVER_ASPECT)
})

t('and a block with none anywhere wears the tag\'s own picture', () => {
  const tag = { id: 'game', name: 'Game', image: '/tag.svg' }
  const face = blockFace(tag, { tag: 'game', game: 'ROBLOX' }, found)
  assert.equal(face.image, '/tag.svg')
  assert.equal(face.aspect, undefined)
})

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
