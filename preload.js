const { contextBridge, ipcRenderer } = require('electron');

// 把只受控的极简 API 暴露给网页全局 window 对象
contextBridge.exposeInMainWorld('electronAPI', {
  saveImage: (dataUrl) => ipcRenderer.invoke('dialog:saveImage', dataUrl)
});
