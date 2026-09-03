const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, nativeImage, screen, dialog, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

// Must be called before the app is ready. A plain `file://` URL can't load
// ES module scripts (Chromium blocks module scripts over file:// with a
// CORS-style restriction — this is why `npm run dev`, served over
// http://localhost, worked fine but the packaged .exe showed a blank
// window: the JS silently failed to execute at all). Registering our own
// scheme as "standard" + "secure" + "corsEnabled" makes it behave like a
// real HTTP origin as far as module loading is concerned.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// --- Persisted window state (position/size/alwaysOnTop/clickThrough) -------
// Small hand-rolled JSON store instead of a dependency — this is the only
// thing that needs to survive restarts at the OS-window level. Per-render
// settings (camera, overlay mode) live in the renderer's localStorage.
const STATE_PATH = path.join(app.getPath('userData'), 'window-state.json');

const DEFAULT_STATE = {
  width: 480,
  height: 480,
  x: undefined,
  y: undefined,
  alwaysOnTop: true,
  clickThrough: false,
};

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_PATH, 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(partial) {
  const next = { ...loadState(), ...partial };
  try {
    fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
    fs.writeFileSync(STATE_PATH, JSON.stringify(next, null, 2));
  } catch (err) {
    console.error('Failed to save window state:', err);
  }
}

let state = loadState();
let mainWindow = null;
let tray = null;

const HOTKEY_TOGGLE_VISIBILITY = 'CommandOrControl+Alt+F9';
const HOTKEY_TOGGLE_CLICKTHROUGH = 'CommandOrControl+Alt+F10';

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 200,
    minHeight: 200,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: state.alwaysOnTop,
    skipTaskbar: false,
    hasShadow: false,
    ...(fs.existsSync(iconPath) ? { icon: iconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setIgnoreMouseEvents(state.clickThrough, { forward: true });

  const startUrl = process.env.ELECTRON_START_URL || 'app://local/index.html';
  mainWindow.loadURL(startUrl);

  // Security: keep the window pinned to the app:// origin — block navigation
  // to any remote http(s) URL (e.g. if the renderer were ever compromised).
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) event.preventDefault();
  });

  mainWindow.on('moved', () => {
    const [x, y] = mainWindow.getPosition();
    saveState({ x, y });
  });
  mainWindow.on('resized', () => {
    const [width, height] = mainWindow.getSize();
    saveState({ width, height });
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  return mainWindow;
}

function broadcastWindowState() {
  if (!mainWindow) return;
  mainWindow.webContents.send('window-state', {
    alwaysOnTop: state.alwaysOnTop,
    clickThrough: state.clickThrough,
  });
  updateTrayMenu();
}

function setAlwaysOnTop(value) {
  state.alwaysOnTop = value;
  saveState({ alwaysOnTop: value });
  mainWindow?.setAlwaysOnTop(value);
  broadcastWindowState();
}

function setClickThrough(value) {
  state.clickThrough = value;
  saveState({ clickThrough: value });
  // `forward: true` still lets mousemove reach the page so hover effects
  // work, but clicks pass through to whatever is behind the window.
  mainWindow?.setIgnoreMouseEvents(value, { forward: true });
  broadcastWindowState();
}

function toggleVisibility() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    mainWindow.show();
  }
  updateTrayMenu();
}

function buildTrayIcon() {
  const iconPath = path.join(__dirname, 'icon.png');
  if (fs.existsSync(iconPath)) {
    return nativeImage.createFromPath(iconPath);
  }
  // 16x16 transparent fallback so Tray() never throws if icon.png is missing.
  return nativeImage.createEmpty();
}

function updateTrayMenu() {
  if (!tray) return;
  const visible = mainWindow?.isVisible() ?? false;
  const contextMenu = Menu.buildFromTemplate([
    {
      label: visible ? 'Hide Overlay' : 'Show Overlay',
      click: toggleVisibility,
    },
    { type: 'separator' },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: state.alwaysOnTop,
      click: (item) => setAlwaysOnTop(item.checked),
    },
    {
      label: 'Click-through',
      type: 'checkbox',
      checked: state.clickThrough,
      click: (item) => setClickThrough(item.checked),
    },
    { type: 'separator' },
    {
      label: `Toggle visibility: ${HOTKEY_TOGGLE_VISIBILITY}`,
      enabled: false,
    },
    {
      label: `Toggle click-through: ${HOTKEY_TOGGLE_CLICKTHROUGH}`,
      enabled: false,
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip(visible ? 'Face Overlay (running)' : 'Face Overlay (hidden)');
}

function createTray() {
  tray = new Tray(buildTrayIcon());
  tray.on('click', toggleVisibility);
  updateTrayMenu();
}

function registerShortcuts() {
  globalShortcut.register(HOTKEY_TOGGLE_VISIBILITY, toggleVisibility);
  globalShortcut.register(HOTKEY_TOGGLE_CLICKTHROUGH, () => setClickThrough(!state.clickThrough));
}

// --- IPC from renderer (settings panel buttons mirror the tray/hotkeys) ----
ipcMain.handle('window:get-state', () => ({
  alwaysOnTop: state.alwaysOnTop,
  clickThrough: state.clickThrough,
}));

const IMAGE_MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

ipcMain.handle('dialog:choose-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose overlay image',
    filters: [{ name: 'Images', extensions: Object.keys(IMAGE_MIME_TYPES) }],
    properties: ['openFile'],
  });

  if (result.canceled || !result.filePaths[0]) return null;

  const filePath = result.filePaths[0];
  try {
    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime = IMAGE_MIME_TYPES[ext] || 'application/octet-stream';
    return {
      dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
      fileName: path.basename(filePath),
    };
  } catch (err) {
    console.error('Failed to read chosen image:', err);
    return null;
  }
});
ipcMain.on('window:set-always-on-top', (_event, value) => setAlwaysOnTop(Boolean(value)));
ipcMain.on('window:set-click-through', (_event, value) => setClickThrough(Boolean(value)));
ipcMain.on('window:hide', () => mainWindow?.hide());
ipcMain.on('window:quit', () => app.quit());
ipcMain.on('window:drag-resize-reset', () => {
  if (!mainWindow) return;
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  mainWindow.setBounds({
    x: Math.round((width - DEFAULT_STATE.width) / 2),
    y: Math.round((height - DEFAULT_STATE.height) / 2),
    width: DEFAULT_STATE.width,
    height: DEFAULT_STATE.height,
  });
});

app.whenReady().then(() => {
  // Serve dist/ under app://local/... — only relevant in production, since
  // dev mode loads ELECTRON_START_URL (the Vite dev server) instead.
  protocol.handle('app', (request) => {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (!pathname || pathname === '/') pathname = '/index.html';
    // Security: resolve against dist/ and refuse anything that escapes it
    // (blocks path traversal like app://local/../../package.json).
    const distRoot = path.resolve(__dirname, '../dist');
    const filePath = path.resolve(distRoot, '.' + pathname);
    if (filePath !== distRoot && !filePath.startsWith(distRoot + path.sep)) {
      return new Response('Forbidden', { status: 403 });
    }
    return net.fetch(pathToFileURL(filePath).toString());
  });

  createWindow();
  createTray();
  registerShortcuts();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Tray-resident app: closing the window (there's no OS close button on a
  // frameless window anyway) doesn't quit — only the tray "Quit" item does.
  // On macOS this is the platform convention too.
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

