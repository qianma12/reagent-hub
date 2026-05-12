const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  fs: {
    exists: (filepath) => ipcRenderer.invoke('fs:exists', filepath),
    mkdir: (dirpath, options) => ipcRenderer.invoke('fs:mkdir', dirpath, options),
    writeFile: (filepath, data) => ipcRenderer.invoke('fs:writeFile', filepath, data),
    readFile: (filepath) => ipcRenderer.invoke('fs:readFile', filepath),
    readdir: (dirpath) => ipcRenderer.invoke('fs:readdir', dirpath),
    rm: (dirpath, options) => ipcRenderer.invoke('fs:rm', dirpath, options),
  },
  path: {
    join: (...args) => ipcRenderer.invoke('path:join', ...args),
    homedir: () => ipcRenderer.invoke('path:homedir'),
  },
});
