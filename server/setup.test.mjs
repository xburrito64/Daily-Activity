// Changing the settings file from the app. It holds the vault's address and a
// password to an AniList account, so the one thing that must never happen is
// a write that loses what was already in it.

import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { writeSettings, cleanKey, checkVault } from './setup.js'

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

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'setup-'))
const file = path.join(dir, 'config.json')
const read = () => JSON.parse(fs.readFileSync(file, 'utf8'))

console.log('\nsetup')

t('a change leaves every other line as it was', () => {
  fs.writeFileSync(file, JSON.stringify({ vaultDailyDir: 'C:/Vault/Daily', anilistToken: 'secret', port: 5274 }))
  writeSettings(file, { rawgKey: 'abcdefgh1234' })
  assert.deepEqual(read(), {
    vaultDailyDir: 'C:/Vault/Daily', anilistToken: 'secret', port: 5274, rawgKey: 'abcdefgh1234',
  })
})

t('taking a key away removes its line', () => {
  writeSettings(file, { rawgKey: undefined })
  assert.equal('rawgKey' in read(), false)
  assert.equal(read().anilistToken, 'secret')
})

t('a file that cannot be read is left alone, not started again', () => {
  fs.writeFileSync(file, '{ "vaultDailyDir": "C:\\Vault", broken')
  const was = fs.readFileSync(file, 'utf8')
  assert.throws(() => writeSettings(file, { rawgKey: 'abcdefgh1234' }), /could not be read/)
  assert.equal(fs.readFileSync(file, 'utf8'), was)
})

t('the mark Notepad puts at the front is not a reason to refuse', () => {
  fs.writeFileSync(file, `\uFEFF${JSON.stringify({ vaultDailyDir: 'C:/Vault/Daily' })}`)
  writeSettings(file, { steamGridKey: 'abcdefgh1234' })
  assert.deepEqual(read(), { vaultDailyDir: 'C:/Vault/Daily', steamGridKey: 'abcdefgh1234' })
})

t('a pasted key is tidied, or turned away with a reason', () => {
  assert.equal(cleanKey('  abcd1234efgh  '), 'abcd1234efgh')
  assert.equal(cleanKey(''), '')
  assert.throws(() => cleanKey('abcd 1234 efgh'), /space/)
  assert.throws(() => cleanKey('short'), /letters and numbers/)
  assert.throws(() => cleanKey('abcd1234efgh"}'), /letters and numbers/)
})

t('a vault folder has to be a folder that is there', () => {
  const vault = path.join(dir, 'Daily')
  fs.mkdirSync(vault)
  assert.deepEqual(checkVault(vault), { dir: vault.replace(/\\/g, '/'), notes: 0 })
  fs.writeFileSync(path.join(vault, '2026-09-29.md'), '')
  fs.writeFileSync(path.join(vault, 'not a day.md'), '')
  assert.equal(checkVault(vault).notes, 1, 'only day notes are counted')
  assert.throws(() => checkVault(path.join(dir, 'nowhere')), /no folder/)
  assert.throws(() => checkVault(file), /a file, not a folder/)
  assert.throws(() => checkVault('Vault/Daily'), /whole path/)
  assert.throws(() => checkVault(''), /which folder/)
})

fs.rmSync(dir, { recursive: true, force: true })

console.log(`\n${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
