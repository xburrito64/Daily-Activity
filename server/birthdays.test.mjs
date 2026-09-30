import assert from 'node:assert'
import { cleanBirthdays, birthdaysText } from './birthdays.js'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

// Made-up people: the real list lives only on the machine it belongs to.

t('a birthday keeps its fields, and nothing else', () => {
  const [b] = cleanBirthdays([{ id: 'b-ada', name: '  Ada  ', day: 5, month: 3, year: 2001, colour: 'red', image: 'x' }])
  assert.deepStrictEqual(b, { id: 'b-ada', name: 'Ada', day: 5, month: 3, year: 2001 })
})

t('the year may be left out', () => {
  const [b] = cleanBirthdays([{ name: 'Nan', day: 14, month: 10 }])
  assert.strictEqual(b.year, null)
  assert.match(b.id, /^b-[a-z0-9]+$/, 'a new one is given an id')
})

t('only one can be your own', () => {
  const out = cleanBirthdays([
    { name: 'Me', day: 12, month: 6, year: 2003, self: true },
    { name: 'Also me?', day: 1, month: 1, self: true },
  ])
  assert.strictEqual(out[0].self, true)
  assert.strictEqual(out[1].self, undefined)
})

t('two with the same id are told apart', () => {
  const out = cleanBirthdays([{ id: 'b-x', name: 'A', day: 1, month: 1 }, { id: 'b-x', name: 'B', day: 2, month: 1 }])
  assert.notStrictEqual(out[0].id, out[1].id)
  assert.strictEqual(out[0].id, 'b-x')
})

t('anything that is not a birthday is refused, saying whose', () => {
  assert.throws(() => cleanBirthdays('nope'), /not a list/)
  assert.throws(() => cleanBirthdays([{ name: '', day: 1, month: 1 }]), /no name/)
  assert.throws(() => cleanBirthdays([{ name: 'Ada', day: 31, month: 4 }]), /Ada's birthday is not a day of the year/)
  assert.throws(() => cleanBirthdays([{ name: 'Ada', day: 0, month: 4 }]), /not a day of the year/)
  assert.throws(() => cleanBirthdays([{ name: 'Ada', day: 29, month: 2, year: 2003 }]), /not a date there has been/)
  assert.throws(() => cleanBirthdays([{ name: 'Ada', day: 1, month: 1, year: 1700 }]), /not a date there has been/)
  assert.throws(() => cleanBirthdays([{ name: 'x'.repeat(41), day: 1, month: 1 }]), /longer than 40/)
  assert.doesNotThrow(() => cleanBirthdays([{ name: 'Leap', day: 29, month: 2 }]))
  assert.doesNotThrow(() => cleanBirthdays([]))
})

t('the file reads by hand, and back', () => {
  const list = cleanBirthdays([{ id: 'b-a', name: 'Ada', day: 5, month: 3, year: 2001 }, { id: 'b-b', name: 'Nan', day: 14, month: 10 }])
  const text = birthdaysText(list)
  assert.strictEqual(text.split('\n').length, 5)
  assert.deepStrictEqual(JSON.parse(text), list)
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
