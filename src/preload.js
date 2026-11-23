const { contextBridge, ipcRenderer } = require('electron');

const info = ipcRenderer.sendSync('get-info');

contextBridge.exposeInMainWorld('app', {
  version: info.version,
  userAgent: info.userAgent,
  panePreload: info.panePreload,
  flash: () => ipcRenderer.send('flash-frame'),
  setAssisting: (on) => ipcRenderer.send('assist-state', Boolean(on)),
  dropPartition: (p) => ipcRenderer.send('drop-partition', p),
  onHotkey: (cb) => ipcRenderer.on('hotkey', (_e, key) => cb(key)),
});
