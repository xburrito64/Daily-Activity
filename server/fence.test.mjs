import { readBlock, writeBlock, formatEntries, locateBlock } from './fence.js'
import assert from 'node:assert'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

const BODY = formatEntries([{ tag: 'sleep', start: '00:00', end: '08:15' }])

t('roundtrip: fence in the middle of prose, everything else preserved', () => {
  const src = '# Tuesday\n\nSlept badly.\n\n```daily-log\n[]\n```\n\n## Later\n\nMore text.\n'
  const out = writeBlock(src, BODY)
  assert.strictEqual(out, '# Tuesday\n\nSlept badly.\n\n```daily-log\n' + BODY + '\n```\n\n## Later\n\nMore text.\n')
  assert.strictEqual(readBlock(out).trim(), BODY)
})

t('no fence: appended, prose untouched', () => {
  const src = '# Tuesday\n\nSome writing.\n'
  const out = writeBlock(src, BODY)
  assert.ok(out.startsWith(src), 'original prefix must survive')
  assert.strictEqual(out, src + '\n```daily-log\n' + BODY + '\n```\n')
})

t('no fence and no trailing newline', () => {
  const out = writeBlock('no newline at eof', BODY)
  assert.strictEqual(out, 'no newline at eof\n\n```daily-log\n' + BODY + '\n```\n')
})

t('empty file', () => {
  assert.strictEqual(writeBlock('', BODY), '```daily-log\n' + BODY + '\n```\n')
})

t('CRLF file keeps CRLF', () => {
  const src = '# T\r\n\r\n```daily-log\r\n[]\r\n```\r\n\r\ntail\r\n'
  const out = writeBlock(src, BODY)
  assert.strictEqual(out, '# T\r\n\r\n```daily-log\r\n' + BODY + '\r\n```\r\n\r\ntail\r\n')
})

t('BOM and frontmatter survive', () => {
  const src = '\uFEFF---\ntags: [daily]\n---\n\n```daily-log\n[]\n```\n'
  const out = writeBlock(src, BODY)
  assert.ok(out.startsWith('\uFEFF---\ntags: [daily]\n---\n'))
})

t('other code fences are not mistaken for ours', () => {
  const src = '```js\nconst x = 1\n```\n\n```daily-log\n[]\n```\n\n```python\nprint(1)\n```\n'
  const out = writeBlock(src, BODY)
  assert.ok(out.includes('const x = 1'), 'js fence survives')
  assert.ok(out.includes('print(1)'), 'python fence survives')
  assert.strictEqual(out.match(/```daily-log/g).length, 1)
  assert.strictEqual(readBlock(out).trim(), BODY)
})

t('a js fence BEFORE ours does not swallow the close', () => {
  const src = '```js\nx\n```\n```daily-log\n[]\n```\ntail\n'
  assert.strictEqual(writeBlock(src, BODY), '```js\nx\n```\n```daily-log\n' + BODY + '\n```\ntail\n')
})

t('empty fence body', () => {
  const src = '```daily-log\n```\n'
  assert.strictEqual(writeBlock(src, BODY), '```daily-log\n' + BODY + '\n```\n')
})

t('unterminated fence is repaired, not duplicated', () => {
  const out = writeBlock('# T\n\n```daily-log\n[]\n', BODY)
  assert.strictEqual(out.match(/```daily-log/g).length, 1)
  assert.strictEqual(out, '# T\n\n```daily-log\n' + BODY + '\n```\n')
})

t('multiline hand-edited body is replaced wholesale', () => {
  const src = '```daily-log\n[{"tag":"a","start":"00:00","end":"01:00"},\n {"tag":"b","start":"01:00","end":"02:00"}]\n```\n'
  assert.strictEqual(writeBlock(src, BODY), '```daily-log\n' + BODY + '\n```\n')
})

t('repeated writes are stable', () => {
  const src = '# T\n\ntext\n'
  const once = writeBlock(src, BODY)
  assert.strictEqual(writeBlock(once, BODY), once)
  assert.strictEqual(writeBlock(writeBlock(once, BODY), BODY), once)
})

t('no fence present reads as null', () => {
  assert.strictEqual(readBlock('# just prose\n'), null)
  assert.strictEqual(locateBlock('# just prose\n'), null)
})

t('formatEntries matches the hand-written layout', () => {
  assert.strictEqual(
    formatEntries([
      { tag: 'sleep', start: '00:00', end: '08:15' },
      { tag: 'game', start: '09:20', end: '16:30', note: 'HZD, finished the frozen wilds' },
    ]),
    '[{"tag":"sleep","start":"00:00","end":"08:15"},\n {"tag":"game","start":"09:20","end":"16:30","note":"HZD, finished the frozen wilds"}]'
  )
  assert.strictEqual(formatEntries([]), '[]')
})

t('a note containing newlines stays on one line', () => {
  const body = formatEntries([{ tag: 'game', start: '00:00', end: '01:00', note: 'line one\nline two' }])
  assert.strictEqual(body.split('\n').length, 1)
  assert.strictEqual(JSON.parse(body)[0].note, 'line one\nline two')
})

t('a note containing a fence cannot break out of the block', () => {
  const body = formatEntries([{ tag: 'game', start: '00:00', end: '01:00', note: '```\nnot a real fence' }])
  const out = writeBlock('', body)
  assert.strictEqual(readBlock(out).trim(), body)
  assert.strictEqual(JSON.parse(readBlock(out))[0].note, '```\nnot a real fence')
})

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
