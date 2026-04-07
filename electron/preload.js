const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),

    openFile: () => ipcRenderer.invoke('dialog:openFile'),
    openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

    runSlicer: (args) => ipcRenderer.invoke('slicer:run', args),
    onProgress: (callback) => {
        ipcRenderer.on('slicer:progress', (_, data) => callback(data));
    },
    removeProgressListeners: () => ipcRenderer.removeAllListeners('slicer:progress'),

    openInExplorer: (folderPath) => ipcRenderer.send('shell:openFolder', folderPath),
});
