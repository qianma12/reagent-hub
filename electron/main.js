const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');

// 保持窗口对象全局引用，防止被垃圾回收
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 850,
    minWidth: 900,
    minHeight: 600,
    center: true,
    autoHideMenuBar: true,
    title: 'Reagent Hub v1.2.0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  });

  // 加载本地 HTML 文件
  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));

  // DevTools 已关闭（生产环境）
  // mainWindow.webContents.openDevTools();

  // Forward renderer console logs to main process
  const logFile = path.join(os.tmpdir(), 'reagent_renderer.log');
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    const levels = ['debug', 'log', 'warn', 'error'];
    const entry = `[RENDERER ${levels[level] || level}] ${message}\n`;
    fs.appendFile(logFile, entry).catch(() => {});
    console.log(`[RENDERER ${levels[level] || level}] ${message}`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// ==================== IPC: 文件系统 API ====================

ipcMain.handle('fs:exists', async (event, filepath) => {
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
});

ipcMain.handle('fs:mkdir', async (event, dirpath, options = {}) => {
  await fs.mkdir(dirpath, { recursive: options.recursive || false });
});

ipcMain.handle('fs:writeFile', async (event, filepath, data) => {
  await fs.writeFile(filepath, data, 'utf-8');
});

ipcMain.handle('fs:readFile', async (event, filepath) => {
  return await fs.readFile(filepath, 'utf-8');
});

ipcMain.handle('fs:readdir', async (event, dirpath) => {
  const entries = await fs.readdir(dirpath, { withFileTypes: true });
  return entries.map(e => ({ name: e.name }));
});

ipcMain.handle('fs:rm', async (event, dirpath, options = {}) => {
  await fs.rm(dirpath, { recursive: options.recursive || false, force: true });
});

ipcMain.handle('path:join', async (event, ...args) => {
  return path.join(...args);
});

ipcMain.handle('path:homedir', async (event) => {
  return os.homedir();
});

ipcMain.handle('system:hostname', async (event) => {
  return os.hostname();
});
