const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow () {
  const win = new BrowserWindow({
    width: 1280,
    height: 850,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // 为安全起见启用上下文隔离并且禁用集成 Node
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(() => {
  // 注册 IPC，响应渲染进程（网页）要求的“原生另存为”对话框
  ipcMain.handle('dialog:saveImage', async (event, dataUrl) => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '保存水印照片',
      defaultPath: 'watermarked_image.png',
      filters: [
        { name: 'Images', extensions: ['png'] }
      ]
    });

    if (!canceled && filePath) {
      // dataUrl 结构类似于 "data:image/png;base64,iVBORw0KGgo..."
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const dataBuffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, dataBuffer);
      return { success: true, filePath };
    }
    return { canceled: true };
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // macOS 通常在没有窗口时依在后台存活，除非 Cmd+Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
