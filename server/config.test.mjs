import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { readJson } from './config.js'

let pass = 0, fail = 0
const t = (name, fn) => {
  try { fn(); pass++; console.log('  ok   ' + name) }
  catch (e) { fail++; console.log('  FAIL ' + name + '\n       ' + e.message) }
}

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-doc-cfg-'))
const write = (name, bytes) => {
  const file = path.join(dir, name)
  fs.writeFileSync(file, bytes)
  return file
}

const SETTINGS = '{\n  "vaultDailyDir": "C:/Vaults/Vault/Daily",\n  "rawgKey": "abc"\n}\n'

t('plain settings read', () => {
  assert.equal(readJson(write('plain.json', SETTINGS)).rawgKey, 'abc')
})

t('settings saved by Notepad read too', () => {
  // Notepad writes a byte-order mark in front of a UTF-8 file. It is
  // invisible, it is not JSON, and these files exist to be edited by hand —
  // so the first edit anybody makes must not stop the app from starting.
  const bom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(SETTINGS, 'utf8')])
  const config = readJson(write('bom.json', bom))
  assert.equal(config.rawgKey, 'abc')
  assert.equal(config.vaultDailyDir, 'C:/Vaults/Vault/Daily')
})

t('a mark on its own is still not settings', () => {
  assert.throws(() => readJson(write('only-bom.json', Buffer.from([0xef, 0xbb, 0xbf]))),
    new RegExp('not valid JSON'))
})

t('backslashes still get the hint they always did', () => {
  assert.throws(
    () => readJson(write('slashes.json', '{ "vaultDailyDir": "C:\\Vaults\\Vault" }')),
    new RegExp('forward slashes'),
  )
})

fs.rmSync(dir, { recursive: true, force: true })
console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
