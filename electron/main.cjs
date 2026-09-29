const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path = require('node:path')
const { Engine } = require('./engine.cjs')

const isDev = process.argv.includes('--dev')
let engine
let mainWindow

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload)
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1100,
    minHeight: 700,
    title: 'GhostShell',
    backgroundColor: '#09090b',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Open target=_blank links from spawned browsers in the system browser, not new Electron windows.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5199')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Startup diagnostics: confirm the renderer actually painted, not a blank window.
  mainWindow.webContents.on('did-finish-load', () => {
    setTimeout(async () => {
      try {
        const len = await mainWindow.webContents.executeJavaScript(
          'document.body ? document.body.innerText.length : -1',
        )
        console.log(`[ghostshell] renderer ready — body text length: ${len}`)
      } catch (e) {
        console.log('[ghostshell] renderer check failed:', e.message)
      }
    }, 1200)
  })
  mainWindow.webContents.on('console-message', (_e, _level, message) => {
    if (/error|failed|uncaught/i.test(message)) console.log('[renderer:error]', message)
  })
}

app.whenReady().then(() => {
  engine = new Engine(app.getPath('userData'), (event, payload) => send(`gh:engine:${event}`, payload))

  ipcMain.handle('gh:launch', async (_e, profile) => {
    try {
      return { ok: true, ...(await engine.launch(profile)) }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('gh:stop', async (_e, profileId) => {
    await engine.stop(profileId)
    return { ok: true }
  })

  ipcMain.handle('gh:test-proxy', async (_e, cfg) => {
    try {
      return { ok: true, ...(await engine.testProxy(cfg)) }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('gh:state', () => ({
    platform: process.platform,
    chromium: 'playwright-bundled',
  }))

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  if (engine) await engine.stopAll()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', async () => {
  if (engine) await engine.stopAll()
})
