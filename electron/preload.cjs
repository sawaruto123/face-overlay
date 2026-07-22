const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('faceOverlay', {
  isElectron: true,
  getWindowState: () => ipcRenderer.invoke('window:get-state'),
  chooseImage: () => ipcRenderer.invoke('dialog:choose-image'),
  setAlwaysOnTop: (value) => ipcRenderer.send('window:set-always-on-top', value),
  setClickThrough: (value) => ipcRenderer.send('window:set-click-through', value),
  hideWindow: () => ipcRenderer.send('window:hide'),
  quit: () => ipcRenderer.send('window:quit'),
  resetWindow: () => ipcRenderer.send('window:drag-resize-reset'),
  onWindowState: (callback) => {
    const listener = (_event, data) => callback(data);
    ipcRenderer.on('window-state', listener);
    return () => ipcRenderer.removeListener('window-state', listener);
  },
});
