const { contextBridge, ipcRenderer } = require('electron');

console.log('main preload loaded');

contextBridge.exposeInMainWorld('electronAPI', {
  printReceipt: (payload) => ipcRenderer.invoke('print-receipt', payload),
  previewReceipt: (payload) => ipcRenderer.invoke('preview-receipt', payload),

  zoomIn: () => ipcRenderer.invoke('zoom-in'),
  zoomOut: () => ipcRenderer.invoke('zoom-out'),
  zoomReset: () => ipcRenderer.invoke('zoom-reset'),
  getZoomLevel: () => ipcRenderer.invoke('get-zoom-level'),

  openExternalLink: (url) => ipcRenderer.invoke('open-external-link', url)
});