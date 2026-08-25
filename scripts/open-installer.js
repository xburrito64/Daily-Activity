// The last step of "npm run update-app": open the installer that was just
// built, so updating the installed app is one command rather than two and a
// trip through the file manager.
//
// With --silent it installs without a wizard instead, closing the app first if
// it is open, and then checks that the installed copy really did change. That
// is the form Claude runs, since nobody is there to click Next.
import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync, execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const releaseDir = path.join(root, 'release')
const silent = process.argv.includes('--silent')

const EXE = 'Daily Documentation.exe'
const installedApp = path.join(
  process.env.LOCALAPPDATA ?? '', 'Programs', 'Daily Documentation', 'resources', 'app',
)

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

const installerPath = path.join(releaseDir, installer.name)

if (!silent) {
  console.log(`
  Opening ${installer.name}

  Close Daily Documentation first if it is open, then install to the same
  folder it offers. It replaces the version you have — your settings, your
  icons and everything you have logged are left alone.
`)
  spawn(installerPath, { detached: true, stdio: 'ignore' }).unref()
  process.exit(0)
}

// --- silent -------------------------------------------------------------

/** What the new build produced, to compare the installed copy against. */
const built = path.join(root, 'dist', 'index.html')
const before = read(path.join(installedApp, 'dist', 'index.html'))

function read(file) {
  try { return fs.readFileSync(file, 'utf8') } catch { return null }
}

function running() {
  try {
    return execFileSync('tasklist', ['/FI', `IMAGENAME eq ${EXE}`], { encoding: 'utf8' })
      .includes(EXE)
  } catch {
    return false
  }
}

function pause(ms) {
  execFileSync('powershell', ['-NoProfile', '-Command', `Start-Sleep -Milliseconds ${ms}`])
}

if (running()) {
  // Ask it to close properly first: a day saves a moment after you stop
  // typing, and a forced kill could land inside that gap.
  console.log(`\n  Closing ${EXE} so it can be replaced.`)
  try { execFileSync('taskkill', ['/IM', EXE], { stdio: 'ignore' }) } catch { /* already gone */ }
  for (let i = 0; i < 10 && running(); i++) pause(500)
  if (running()) {
    try { execFileSync('taskkill', ['/IM', EXE, '/F'], { stdio: 'ignore' }) } catch { /* already gone */ }
    pause(500)
  }
}

console.log(`  Installing ${installer.name} quietly. This takes a moment.`)
const result = spawnSync(installerPath, ['/S'], { stdio: 'ignore' })

if (result.error) {
  console.log(`\n  Could not run the installer: ${result.error.message}\n`)
  process.exit(1)
}

// The installer returns before it has finished writing, so wait for the
// installed copy to actually match what was just built rather than trusting
// the exit code.
const wanted = read(built)
let matched = false
for (let i = 0; i < 60 && !matched; i++) {
  matched = read(path.join(installedApp, 'dist', 'index.html')) === wanted
  if (!matched) pause(500)
}

if (!matched) {
  console.log(`
  The installer ran but the installed copy still doesn't match this build.
  Run "npm run update-app" without --silent and watch what it says.
`)
  process.exit(1)
}

console.log(`
  Installed. The app now matches this build${before === wanted ? ' (it already did)' : ''}.
`)
