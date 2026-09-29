// Which picture each tag wears, with and without a set picked. Built on a
// folder made for the purpose, so the answers depend on nothing but this file.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { withIcons, iconSets, describeSets } from './icons.js'

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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-icons-'))
const touch = (...parts) => {
  fs.mkdirSync(path.dirname(path.join(dir, ...parts)), { recursive: true })
  fs.writeFileSync(path.join(dir, ...parts), 'x')
}
touch('Sleep.png')
touch('game.svg')
touch('Fantasy - Simple', 'Sleep.png')
touch('Fantasy - Simple', 'Walk-Coco.png')
touch('Fantasy - Simple', 'Fantasy Tag Icon Set Simple.png')
touch('Empty Set', 'README.md')
fs.mkdirSync(path.join(dir, '.hidden'))

const tags = [
  { id: 'sleep', name: 'Sleep', icon: '🌙' },
  { id: 'game', name: 'Game', icon: '🎮' },
  { id: 'walk-coco', name: 'Walking w/ Coco', icon: '🐕' },
  { id: 'food', name: 'Food', icon: '🍜' },
]
// Where each tag's picture is, without the stamp that says when it was made.
const unstamped = (url) => String(url).replace(/\?v=\d+$/, '')
const images = (list) => Object.fromEntries(list.map((tag) => [tag.id, tag.image ? unstamped(tag.image) : tag.icon]))

console.log('\nicons')

t('with no set, a tag wears the loose file named after it', () => {
  assert.deepEqual(images(withIcons(tags, dir)), {
    sleep: '/tag-icons/Sleep.png',
    game: '/tag-icons/game.svg',
    'walk-coco': '🐕',
    food: '🍜',
  })
})

t('a set dresses every tag it has a picture for', () => {
  assert.deepEqual(images(withIcons(tags, dir, 'Fantasy - Simple')), {
    sleep: '/tag-icons/Fantasy%20-%20Simple/Sleep.png',
    game: '/tag-icons/game.svg',
    'walk-coco': '/tag-icons/Fantasy%20-%20Simple/Walk-Coco.png',
    food: '🍜',
  }, 'and one it has none for keeps what it had')
})

t('a picture is stamped with when it last changed', () => {
  const [sleep] = withIcons(tags, dir)
  assert.match(sleep.image, /^\/tag-icons\/Sleep\.png\?v=\d+$/)
})

t('a set that is not there is the same as none', () => {
  assert.deepEqual(withIcons(tags, dir, 'No Such Set'), withIcons(tags, dir))
})

t('a set name is never a way out of the icon folder', () => {
  for (const sneaky of ['..', '../..', '.', 'Fantasy - Simple/..', '/etc', 'C:\\Windows']) {
    assert.deepEqual(withIcons(tags, dir, sneaky), withIcons(tags, dir), sneaky)
  }
})

t('the sets are the folders, and only the folders', () => {
  assert.deepEqual(iconSets(dir), ['Empty Set', 'Fantasy - Simple'])
  assert.deepEqual(iconSets(path.join(dir, 'nowhere')), [])
})

t('each set says how many tags it covers, and shows a few', () => {
  const [usual, empty, fantasy] = describeSets(tags, dir)
  assert.equal(usual.name, '')
  assert.deepEqual([usual.covers, usual.of], [2, 4])
  assert.deepEqual([empty.name, empty.covers], ['Empty Set', 0])
  assert.deepEqual(empty.preview, [])
  assert.deepEqual([fantasy.name, fantasy.covers], ['Fantasy - Simple', 2])
  assert.deepEqual(fantasy.preview.map((tag) => unstamped(tag.image)), [
    '/tag-icons/Fantasy%20-%20Simple/Sleep.png',
    '/tag-icons/Fantasy%20-%20Simple/Walk-Coco.png',
  ], 'its own pictures only, never the ones it borrows')
})

fs.rmSync(dir, { recursive: true, force: true })

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
