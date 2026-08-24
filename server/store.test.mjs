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

await t('bad shapes are still rejected', () => {
  const bad = [
    [{ tag: 'x', start: '09:07', end: '10:00' }],   // off the 15-minute grid
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

await fs.rm(dir, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
