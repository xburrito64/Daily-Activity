import path from 'node:path'
import { createApp } from './app.js'
import { loadJson, root } from './config.js'

// Development entry point: `npm run server`, with Vite serving the frontend
// separately and proxying /api here. The packaged app starts the same server
// itself, from electron/main.js.
const config = loadJson('config.json')

const app = createApp({
  vaultDailyDir: config.vaultDailyDir,
  tagsFile: path.join(root, 'tags.json'),
  tagIconsDir: path.join(root, 'tag-icons'),
  rawgKey: config.rawgKey,
})

const server = app.listen(config.port, '127.0.0.1', () => {
  console.log(`daily-documenter api  http://127.0.0.1:${config.port}`)
  console.log(`vault daily notes     ${config.vaultDailyDir}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`
  The app is already running somewhere else (port ${config.port} is taken).
  Close that window first, then try again.
`)
    process.exit(1)
  }
  throw err
})
