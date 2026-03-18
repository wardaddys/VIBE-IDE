import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// IPC Handlers
import { registerFileSystemHandlers } from './ipc/filesystem';
import { registerTerminalHandlers } from './ipc/terminal';
import { registerOllamaHandlers } from './ipc/ollama';
import { registerObsidianHandlers } from './ipc/obsidian';
import { backgroundManager } from './ipc/agent/backgroundManager';
import type { BackgroundAgentConfig } from '../shared/types';
import { IPC_CHANNELS } from '../shared/ipcContracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The built directory structure
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST || '', '../public')

let mainWindow: BrowserWindow | null = null;
let logWindow: BrowserWindow | null = null;
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

function createLogWindow() {
    logWindow = new BrowserWindow({
        width: 500,
        height: 600,
        x: 50,
        y: 50,
        title: 'VIBE Debug Logs',
        autoHideMenuBar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        }
    });

    logWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
        <body style="background:#1e1e1e; color:#00d4aa; font-family:monospace; font-size:12px; padding:10px; word-wrap:break-word;">
            <div id="logs" style="padding-bottom: 20px;">=== VIBE SESSION LOGS ===<br/><br/></div>
            <script>
                window.appendLog = (msg) => {
                    const logs = document.getElementById('logs');
                    const div = document.createElement('div');
                    div.textContent = String(msg || '');
                    logs.appendChild(div);
                    window.scrollTo(0, document.body.scrollHeight);
                };
            </script>
        </body>
        </html>
    `);

    logWindow.on('closed', () => {
        logWindow = null;
    });
}

const origLog = console.log;
const origError = console.error;

const publishLogLine = (line: string) => {
    if (!logWindow || logWindow.isDestroyed()) return;
    const payload = JSON.stringify(line);
    logWindow.webContents.executeJavaScript(`window.appendLog && window.appendLog(${payload});`).catch(() => {});
};

console.log = (...args) => {
    origLog(...args);
    publishLogLine(`[INFO] ${args.join(' ')}`);
};

console.error = (...args) => {
    origError(...args);
    publishLogLine(`[ERROR] ${args.join(' ')}`);
};

ipcMain.handle('log:renderer', (_event, msg) => {
    console.log(`[Renderer] ${msg}`);
});

function createWindow() {
    createLogWindow();

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        titleBarStyle: 'hiddenInset',
        frame: process.platform === 'darwin',
        backgroundColor: '#f0f1f6',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });

    registerFileSystemHandlers(mainWindow);
    registerTerminalHandlers(mainWindow);
    registerOllamaHandlers(mainWindow);
    registerObsidianHandlers();

    ipcMain.handle(IPC_CHANNELS.agent.startForProject, async (_event, projectPath: string, config?: BackgroundAgentConfig) => {
        backgroundManager.startForProject(projectPath, config);
        return { success: true };
    });

    ipcMain.handle(IPC_CHANNELS.agent.getBriefing, async () => {
        return backgroundManager.getBriefing();
    });

    ipcMain.handle(IPC_CHANNELS.agent.logAction, async (_event, description: string) => {
        backgroundManager.logAgentAction(description);
    });

    ipcMain.handle(IPC_CHANNELS.agent.generateExport, async (_event, outputPath: string) => {
        return backgroundManager.generateExport(outputPath);
    });

    ipcMain.handle(IPC_CHANNELS.agent.setObsidianKey, async (_event, key: string) => {
        backgroundManager.setObsidianKey(key);
    });

    ipcMain.handle(IPC_CHANNELS.agent.triggerBriefing, async () => {
        backgroundManager.triggerBriefing();
        return { success: true };
    });

    // Neural widget status polling
    ipcMain.handle(IPC_CHANNELS.agent.getStatus, async () => {
        return backgroundManager.getAgentStatus();
    });

    ipcMain.handle('window:minimize', () => mainWindow?.minimize());
    ipcMain.handle('window:maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow?.unmaximize();
        } else {
            mainWindow?.maximize();
        }
    });
    ipcMain.handle('window:close', () => mainWindow?.close());
    ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized());

    mainWindow.on('maximize', () => {
        mainWindow?.webContents.send(IPC_CHANNELS.window.maximizeEvent, true);
    });
    mainWindow.on('unmaximize', () => {
        mainWindow?.webContents.send(IPC_CHANNELS.window.maximizeEvent, false);
    });

    if (VITE_DEV_SERVER_URL) {
        mainWindow.loadURL(VITE_DEV_SERVER_URL)
    } else {
        mainWindow.loadFile(path.join(process.env.DIST || '', 'index.html'))
    }

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (logWindow) logWindow.close();
    });
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(createWindow)
