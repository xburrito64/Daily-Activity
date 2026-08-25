import { app, BrowserWindow, Menu, shell, dialog, screen } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createApp } from '../server/app.js'
import { readJson } from '../server/config.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(here, '..')

/**
 * Settings live in the user's app-data folder rather than inside the
 * installed program, so they can still be edited after installation. On
 * first run they are copied from the versions in the project.
 */
const settingsDir = app.getPath('userData')
const configFile = path.join(settingsDir, 'config.json')
const tagsFile = path.join(settingsDir, 'tags.json')
const tagIconsDir = path.join(settingsDir, 'tag-icons')

function seedSettings() {
  fs.mkdirSync(settingsDir, { recursive: true })

  if (!fs.existsSync(configFile)) {
    // config.json is kept out of git, so fall back to the example.
    const source = ['config.json', 'config.example.json']
      .map((name) => path.join(projectRoot, name))
      .find((file) => fs.existsSync(file))
    if (source) fs.copyFileSync(source, configFile)
  }

  if (!fs.existsSync(tagsFile)) {
    const source = path.join(projectRoot, 'tags.json')
    if (fs.existsSync(source)) fs.copyFileSync(source, tagsFile)
  }

  // Somewhere to drop tag images, with the instructions alongside them.
  fs.mkdirSync(tagIconsDir, { recursive: true })
  const readme = path.join(tagIconsDir, 'README.md')
  const readmeSource = path.join(projectRoot, 'tag-icons', 'README.md')
  if (!fs.existsSync(readme) && fs.existsSync(readmeSource)) {
    fs.copyFileSync(readmeSource, readme)
  }
}

function startServer() {
  const config = readJson(configFile)
  const server = createApp({
    vaultDailyDir: config.vaultDailyDir,
    tagsFile,
    tagIconsDir,
    staticDir: path.join(projectRoot, 'dist'),
  })
  return new Promise((resolve, reject) => {
    // Port 0: let the OS pick a free one, so this never collides with a dev
    // server or a second copy of anything.
    const listener = server.listen(0, '127.0.0.1', () => resolve(listener))
    listener.on('error', reject)
  })
}

function buildMenu(reload) {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {
      label: 'Daily Documentation',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: reload },
        {
          label: 'Open settings folder',
          click: () => shell.openPath(settingsDir),
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
  ]))
}

/** A window of this size, or as much of it as the screen actually has. */
function fitToScreen(width, height) {
  const { workAreaSize } = screen.getPrimaryDisplay()
  return {
    width: Math.min(width, workAreaSize.width - 40),
    height: Math.min(height, workAreaSize.height - 40),
  }
}

async function main() {
  let listener
  try {
    seedSettings()
    listener = await startServer()
  } catch (err) {
    dialog.showErrorBox(
      'Daily Documentation could not start',
      `${err.message}\n\nSettings folder:\n${settingsDir}`,
    )
    app.quit()
    return
  }

  const { port } = listener.address()

  // build/icon.ico if it has been added; Electron's default until then.
  const iconFile = path.join(projectRoot, 'build', 'icon.ico')

  const window = new BrowserWindow({
    // Wide by default: the bar is the app, and an hour is easier to aim at
    // when the day has room. Clamped to the screen so a smaller one still
    // gets a window it can move.
    ...fitToScreen(2000, 1150),
    minWidth: 900,
    minHeight: 600,
    ...(fs.existsSync(iconFile) ? { icon: iconFile } : {}),
    backgroundColor: '#17130f', // matches the page, so no white flash on open
    show: false,
    autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })

  buildMenu(() => window.reload())
  window.once('ready-to-show', () => window.show())
  window.loadURL(`http://127.0.0.1:${port}`)

  // Links to anywhere else open in the real browser, not in this window.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Closing the window stops the server with it — the whole point of this
  // wrapper is that there is nothing left running afterwards.
  app.on('window-all-closed', () => {
    listener.close()
    app.quit()
  })
}

// One copy at a time; a second launch focuses the window that already exists.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [window] = BrowserWindow.getAllWindows()
    if (window) {
      if (window.isMinimized()) window.restore()
      window.focus()
    }
  })
  app.whenReady().then(main)
}
