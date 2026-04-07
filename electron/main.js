const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const { sliceImage } = require('../src/figma_slicer');

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;
const RENDERER_PORT = 5173;

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 860,
        height: 640,
        minWidth: 720,
        minHeight: 560,
        frame: false,
        backgroundColor: '#09090b',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    if (isDev) {
        mainWindow.loadURL(`http://localhost:${RENDERER_PORT}`);
        // mainWindow.webContents.openDevTools({ mode: 'detach' });
    } else {
        mainWindow.loadFile(
            path.join(__dirname, '..', 'renderer', 'corte-print-ui', 'dist', 'index.html')
        );
    }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

// ── Janela ────────────────────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
    } else {
        mainWindow.maximize();
    }
});
ipcMain.on('window:close', () => mainWindow.close());

// ── Diálogos ──────────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Selecionar imagens ou PDF',
        filters: [{ name: 'Imagens / PDF', extensions: ['png', 'jpg', 'jpeg', 'webp', 'pdf'] }],
        properties: ['openFile', 'multiSelections'],
    });
    return canceled ? null : filePaths;
});

ipcMain.handle('dialog:openFolder', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
        title: 'Selecionar pasta de saída',
        properties: ['openDirectory', 'createDirectory'],
    });
    return canceled ? null : filePaths[0];
});

// ── Fatiamento ────────────────────────────────────────────────────────────────
ipcMain.handle('slicer:run', async (event, { inputPath, outputDir, maxHeight }) => {
    try {
        await sliceImage(inputPath, outputDir, maxHeight, (progress) => {
            mainWindow.webContents.send('slicer:progress', progress);
        });
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// ── Shell ─────────────────────────────────────────────────────────────────────
ipcMain.on('shell:openFolder', (_, folderPath) => shell.openPath(folderPath));
