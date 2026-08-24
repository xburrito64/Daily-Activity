// The last step of "npm run update": open the installer that was just built,
// so updating the installed app is one command rather than two and a trip
// through the file manager.
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = path.join(root, 'release')

let names = []
try {
  names = fs.readdirSync(releaseDir)
} catch {
  console.log('\n  Nothing was built. Try "npm run package" on its own to see why.\n')
  process.exit(1)
}

// Newest first, in case an older version's installer is still lying around.
const installer = names
  .filter((name) => name.endsWith('.exe') && name.includes('Setup'))
  .map((name) => ({ name, at: fs.statSync(path.join(releaseDir, name)).mtimeMs }))
  .sort((a, b) => b.at - a.at)[0]

if (!installer) {
  console.log('\n  Built, but no installer turned up in the release folder.\n')
  process.exit(1)
}

console.log(`
  Opening ${installer.name}

  Close Daily Documentation first if it is open, then install to the same
  folder it offers. It replaces the version you have — your settings, your
  icons and everything you have logged are left alone.
`)

spawn(path.join(releaseDir, installer.name), { detached: true, stdio: 'ignore' }).unref()
