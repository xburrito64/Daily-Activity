import assert from 'node:assert'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createStore, validateEntries } from './store.js'

let pass = 0, fail = 0
const t = async (name, fn) => {
  try { await fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'daily-doc-'))
const store = createStore(dir)

await t('entry order survives the round trip', async () => {
  // Order is the stacking order, so it must come back exactly as written even
  // though these are not in time order.
  const entries = [
    { tag: 'sleep', start: '00:00', end: '04:00' },
    { tag: 'dgg', start: '11:00', end: '14:00' },
    { tag: 'music', start: '06:00', end: '12:30' },
  ]
  await store.writeDay('2027-06-15', entries)
  const back = await store.readDay('2027-06-15')
  assert.deepStrictEqual(back.entries.map((e) => e.tag), ['sleep', 'dgg', 'music'])
})

await t('validateEntries does not reorder', () => {
  const out = validateEntries([
    { tag: 'b', start: '10:00', end: '11:00' },
    { tag: 'a', start: '01:00', end: '02:00' },
  ])
  assert.deepStrictEqual(out.map((e) => e.tag), ['b', 'a'])
})

await t('overlapping entries are accepted', () => {
  const out = validateEntries([
    { tag: 'game', start: '14:00', end: '18:00' },
    { tag: 'dgg', start: '15:00', end: '16:00' },
  ])
  assert.strictEqual(out.length, 2)
})

await t('a day written on the old 15-minute grid still opens', async () => {
  // Days logged before a slot became ten minutes are records, not damage:
  // they must read back normally rather than being called malformed.
  const file = store.fileFor('2027-06-20')
  await fs.writeFile(file, '```daily-log\n[{"tag":"sleep","start":"23:45","end":"24:00"}]\n```\n', 'utf8')
  const back = await store.readDay('2027-06-20')
  assert.strictEqual(back.malformed, false, 'must not be called malformed')
  assert.deepStrictEqual(back.entries, [{ tag: 'sleep', start: '23:45', end: '24:00' }])
})

await t('but writing off the grid is still refused', async () => {
  assert.throws(
    () => validateEntries([{ tag: 'x', start: '09:45', end: '10:00' }]),
    /10-minute marks/,
  )
})

await t('bad shapes are still rejected', () => {
  const bad = [
    [{ tag: 'x', start: '09:07', end: '10:00' }],   // off the grid entirely
    [{ tag: 'x', start: '10:00', end: '09:00' }],   // ends before it starts
    [{ start: '00:00', end: '01:00' }],             // no tag
    [{ tag: 'x', start: '25:00', end: '26:00' }],   // not a time
  ]
  for (const entries of bad) {
    assert.throws(() => validateEntries(entries), new RegExp('entry 0'))
  }
})

await t('notes survive, stray fields do not', async () => {
  await store.writeDay('2027-06-16', [
    { tag: 'game', start: '01:00', end: '02:00', note: 'kept', bogus: 'dropped' },
  ])
  const back = await store.readDay('2027-06-16')
  assert.deepStrictEqual(back.entries, [{ tag: 'game', start: '01:00', end: '02:00', note: 'kept' }])
})

await t('a game and its cover are kept, and go in readable', async () => {
  await store.writeDay('2027-06-17', [
    { tag: 'game', start: '14:00', end: '16:00', game: 'Elden Ring', cover: 'elden-ring-326243.jpg' },
  ])
  const text = await fs.readFile(path.join(dir, '2027-06-17.md'), 'utf8')
  // The name is the record: it has to read as a name in the note itself, not
  // as an id that means something only to this app.
  assert.ok(text.includes('"game":"Elden Ring"'), text)
  const back = await store.readDay('2027-06-17')
  assert.deepStrictEqual(back.entries[0].game, 'Elden Ring')
  assert.deepStrictEqual(back.entries[0].cover, 'elden-ring-326243.jpg')
})

await t('a cover is a filename and nothing else', () => {
  for (const cover of ['../../secrets.jpg', 'covers/x.jpg', 'x.exe', '.hidden.jpg', 'C:/x.jpg']) {
    assert.throws(
      () => validateEntries([{ tag: 'game', start: '01:00', end: '02:00', game: 'X', cover }]),
      new RegExp('bad cover'),
      cover,
    )
  }
})

await t('a cover without a game is dropped', () => {
  assert.deepStrictEqual(
    validateEntries([{ tag: 'game', start: '01:00', end: '02:00', cover: 'x.jpg' }]),
    [{ tag: 'game', start: '01:00', end: '02:00' }],
  )
})

await fs.rm(dir, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
