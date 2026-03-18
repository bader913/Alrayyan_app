const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const isDev = !app.isPackaged;

// تقليل مشاكل الرسم في Electron
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-compositing');
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-direct-composition');
app.commandLine.appendSwitch('use-angle', 'swiftshader');

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

let mainWindow;

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

async function startServer() {
  if (!app.isPackaged) {
    console.log('Dev mode: server started externally');
    return;
  }

  try {
    process.env.NODE_ENV = 'production';

const userDataPath = app.getPath('userData');
const securityPath = path.join(userDataPath, 'security');

if (!fs.existsSync(securityPath)) {
  fs.mkdirSync(securityPath, { recursive: true });
}

process.env.DB_PATH = userDataPath;
process.env.LICENSE_PATH = path.join(securityPath, 'license.dat');
process.env.AUTH_DB_PATH = path.join(securityPath, 'auth.db');
process.env.APP_INSTANCE_NAME = app.getName();
process.env.PORT = '3131';

    const serverPath = path.join(__dirname, 'dist-server', 'server.js');
    console.log('Starting server from:', serverPath);

    const mod = await import(`file://${serverPath}`);
    await mod.startServer();

    console.log('Server started successfully');
  } catch (err) {
    console.error('Failed to start server:', err);
  }
}
// window


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#ffffff',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
      devTools: isDev,
      preload: path.join(__dirname, 'preload.cjs')
    },
    title: 'SuperMarket_Idleb',
    autoHideMenuBar: true
  });

  const loadURL = () => {
    const url = 'http://localhost:3131';
    console.log('Attempting to load URL:', url);

    mainWindow.loadURL(url).catch((err) => {
      console.log('Failed to load URL, retrying in 1s...', err.message);
      setTimeout(loadURL, 1000);
    });
  };

  loadURL();

  if (isDev) {
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.webContents.on('before-input-event', (event, input) => {
      const key = input.key?.toLowerCase();

      if (
        key === 'f12' ||
        (input.control && input.shift && key === 'i') ||
        (input.control && input.shift && key === 'j') ||
        (input.control && key === 'u')
      ) {
        event.preventDefault();
      }
    });

    mainWindow.webContents.on('context-menu', (event) => {
      event.preventDefault();
    });

    mainWindow.webContents.on('devtools-opened', () => {
      mainWindow.webContents.closeDevTools();
    });
  }

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startServer();
  createWindow();
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});

ipcMain.handle('zoom-in', () => {
  if (!mainWindow) {
    return { success: false, zoomLevel: 1 };
  }

  const currentZoom = mainWindow.webContents.getZoomFactor();
  const nextZoom = Math.min(Number((currentZoom + 0.1).toFixed(2)), 1.8);

  mainWindow.webContents.setZoomFactor(nextZoom);

  return {
    success: true,
    zoomLevel: nextZoom
  };
});

ipcMain.handle('zoom-out', () => {
  if (!mainWindow) {
    return { success: false, zoomLevel: 1 };
  }

  const currentZoom = mainWindow.webContents.getZoomFactor();
  const nextZoom = Math.max(Number((currentZoom - 0.1).toFixed(2)), 0.4);

  mainWindow.webContents.setZoomFactor(nextZoom);

  return {
    success: true,
    zoomLevel: nextZoom
  };
});

ipcMain.handle('zoom-reset', () => {
  if (!mainWindow) {
    return { success: false, zoomLevel: 1 };
  }

  const defaultZoom = 1;
  mainWindow.webContents.setZoomFactor(defaultZoom);

  return {
    success: true,
    zoomLevel: defaultZoom
  };
});

ipcMain.handle('get-zoom-level', () => {
  if (!mainWindow) return 1.0;
  return mainWindow.webContents.getZoomFactor();
});

ipcMain.handle('print-receipt', async (_event, payload) => {
  const { html, printerName } = payload || {};

  if (!html) {
    return { success: false, message: 'لا يوجد محتوى للطباعة' };
  }

  const printWin = new BrowserWindow({
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: false
    }
  });

  try {
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

    await new Promise((resolve) => {
      printWin.webContents.once('did-finish-load', () => setTimeout(resolve, 500));
    });

    const result = await new Promise((resolve) => {
      printWin.webContents.print(
        {
          silent: false,
          printBackground: true,
          deviceName: printerName || '',
          margins: {
            marginType: 'none'
          },
          pageSize: {
            width: 55000,
            height: 200000
          },
          scaleFactor: 100
        },
        (success, failureReason) => {
          resolve({ success, failureReason });
        }
      );
    });

    printWin.close();

    if (!result.success) {
      return {
        success: false,
        message: result.failureReason || 'فشل أمر الطباعة'
      };
    }

    return { success: true };
  } catch (error) {
    try {
      printWin.close();
    } catch {}

    return {
      success: false,
      message: error?.message || 'حدث خطأ أثناء الطباعة'
    };
  }
});

ipcMain.handle('preview-receipt', async (_event, payload) => {
  const { html } = payload || {};

  if (!html) {
    return { success: false, message: 'لا يوجد محتوى للمعاينة' };
  }

  const previewWin = new BrowserWindow({
    width: 900,
    height: 700,
    autoHideMenuBar: true,
    webPreferences: {
      sandbox: false
    }
  });

  try {
    await previewWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return { success: true };
  } catch (error) {
    try {
      previewWin.close();
    } catch {}

    return {
      success: false,
      message: error?.message || 'حدث خطأ أثناء المعاينة'
    };
  }
});