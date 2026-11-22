const { app, BrowserWindow, ipcMain, Menu, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// Look like plain Chrome: drop the Electron and app tokens from the UA.
const CLEAN_UA = app.userAgentFallback
  .replace(/\s?Electron\/\S+/i, '')
  .replace(/\s?chrometabs\/\S+/i, '');
app.userAgentFallback = CLEAN_UA;

// Panes get no camera/mic/location/notification prompts; only harmless ones pass.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write']);
function lockDownSession(s) {
  s.setPermissionRequestHandler((_wc, permission, cb) => cb(ALLOWED_PERMISSIONS.has(permission)));
  s.setPermissionCheckHandler((_wc, permission) => ALLOWED_PERMISSIONS.has(permission));
}
app.on('session-created', lockDownSession);

const WEB_URL = /^(https?:|about:blank)/i;
const PANE_PRELOAD = path.join(__dirname, 'pane-preload.js');
let win = null;

function paneHotkey(input) {
  if (input.type !== 'keyDown') return null;
  const k = input.key;
  if (input.control && !input.alt && /^[1-9]$/.test(k)) return 'ctrl+' + k;
  if (input.control && k === 'Tab') return input.shift ? 'ctrl+shift+tab' : 'ctrl+tab';
  if (k === 'F2') return 'f2';
  return null;
}

function createWindow() {
  win = new BrowserWindow({
    width: 1500,
    height: 950,
    title: `ChromeTabs v${app.getVersion()}`,
    backgroundColor: '#15171c',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });
  // The app page itself never navigates or opens windows (e.g. a link dropped on the top bar).
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.on('page-title-updated', (e) => e.preventDefault());
  win.on('focus', () => win.flashFrame(false));
  win.webContents.on('will-attach-webview', (_e, prefs, params) => {
    // Panes get only our preload, no Node, and keep running when hidden.
    prefs.preload = PANE_PRELOAD;
    prefs.nodeIntegration = false;
    prefs.contextIsolation = true;
    prefs.backgroundThrottling = false;
    if (String(params.partition || '').startsWith('persist:')) params.partition = 'pane-fallback-' + Date.now();
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

app.on('web-contents-created', (_e, contents) => {
  if (contents.getType() !== 'webview') return;
  // New windows / target=_blank load in the same pane instead.
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) contents.loadURL(url);
    return { action: 'deny' };
  });
  // Only web pages: no mailto:/ms-settings:/custom-scheme launches into desktop apps.
  const blockNonWeb = (e) => { if (!WEB_URL.test(e.url)) e.preventDefault(); };
  contents.on('will-navigate', blockNonWeb);
  contents.on('will-frame-navigate', blockNonWeb);
  contents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r'))) {
      event.preventDefault();
      contents.reload();
      return;
    }
    const key = paneHotkey(input);
    if (key && win) {
      event.preventDefault();
      win.webContents.send('hotkey', key);
    }
  });
});

ipcMain.on('get-info', (e) => {
  e.returnValue = {
    version: app.getVersion(),
    userAgent: CLEAN_UA,
    panePreload: pathToFileURL(PANE_PRELOAD).href,
  };
});
ipcMain.on('flash-frame', () => {
  if (win && !win.isFocused()) win.flashFrame(true);
});
ipcMain.on('drop-partition', (_e, partition) => {
  if (typeof partition === 'string' && !partition.startsWith('persist:')) {
    session.fromPartition(partition).clearStorageData().catch(() => {});
  }
});

app.whenReady().then(() => {
  // No default menu: its Ctrl+R / Ctrl+W would reload or close the whole app.
  Menu.setApplicationMenu(null);
  lockDownSession(session.defaultSession);
  createWindow();
});
app.on('window-all-closed', () => app.quit());
