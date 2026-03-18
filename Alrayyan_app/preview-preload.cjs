const { contextBridge, ipcRenderer } = require('electron');

console.log('preview-preload loaded');

contextBridge.exposeInMainWorld('receiptPreviewAPI', {
  print: (payload) => {
    console.log('receiptPreviewAPI.print called');
    return ipcRenderer.invoke('print-receipt', payload);
  },
  close: () => {
    console.log('receiptPreviewAPI.close called');
    ipcRenderer.send('close-preview-window');
  }
});
