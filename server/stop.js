// "npm run stop" — free the app's ports when a copy has been left running.
import { execFileSync } from 'node:child_process'
import { loadJson } from './config.js'

const ports = new Set([5273, loadJson('config.json').port].map(String))
const pids = new Set()

let out = ''
try {
  out = execFileSync('netstat', ['-ano'], { encoding: 'utf8' })
} catch {
  console.log('\n  Could not check what is running. Restart your PC if the app will not start.\n')
  process.exit(0)
}

for (const line of out.split('\n')) {
  if (!line.includes('LISTENING')) continue

  // "  TCP    127.0.0.1:5274   0.0.0.0:0   LISTENING   54288"
  const parts = line.trim().split(' ').filter(Boolean)
  if (parts.length < 5) continue

  const address = parts[1] // "127.0.0.1:5274" or "[::1]:5273"
  const pid = parts[parts.length - 1]
  const port = address.slice(address.lastIndexOf(':') + 1)

  // Only ever kill a plain numeric pid we read out of netstat.
  if (ports.has(port) && /^[1-9][0-9]*$/.test(pid)) pids.add(pid)
}

if (pids.size === 0) {
  console.log('\n  Nothing was running. You can start the app now.\n')
} else {
  for (const pid of pids) {
    try {
      execFileSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' })
    } catch {
      /* already gone */
    }
  }
  console.log(`\n  Stopped ${pids.size === 1 ? 'the app' : `${pids.size} leftover copies`}. You can start it again now.\n`)
}
