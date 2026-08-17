import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// IPC Handlers
import { registerFileSystemHandlers } from './ipc/filesystem';
import { registerTerminalHandlers } from './ipc/terminal';
import { registerOllamaHandlers } from './ipc/ollama';
import { registerObsidianHandlers } from './ipc/obsidian';
import { registerAgentHandlers } from './agent';
import { backgroundManager } from './ipc/agent/backgroundManager';
import { registerDataHomeHandlers } from './dataHome';
import { registerDebateHandlers } from './debate';
import { killAllShells } from './agent/tools/bash';
import { registerRuntimeLogHandlers, writeRuntimeLog } from './runtimeLog';
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

// Dev shares %APPDATA%/Electron with every other unpackaged Electron app, and a
// corrupted disk cache there produces the block_files/entry_impl error spam and
// can leave the window white. Skip the HTTP cache entirely in dev.
if (!app.isPackaged) app.commandLine.appendSwitch('disable-http-cache');

// Electron's Chromium sandbox relies on a root-owned SUID helper. When VIBE runs
// as root — the default on some Linux installs and VMs — that check aborts launch
// with a fatal "running as root without --no-sandbox is not supported" error.
// Drop the sandbox only in that exact case so the app starts; it's a local,
// single-user tool so the trade-off is acceptable. Must run before app is ready.
if (process.platform === 'linux' && typeof process.getuid === 'function' && process.getuid() === 0) {
    // --no-sandbox lets Chromium start as root (renderer). --disable-gpu-sandbox
    // keeps the GPU process alive too, so the renderer and any agent-driven
    // subprocesses run fine in the same root session. Only the sandbox is
    // dropped, not any functionality.
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-gpu-sandbox');
}

// Suppress Chromium D-Bus connection errors when no session bus is available
// (common in headless / sudo / minimal desktop environments).
if (process.platform === 'linux') {
    app.commandLine.appendSwitch('disable-features', 'ChromeOSArc,MediaRouter,OptimizationHints');
    process.env.ELECTRON_ENABLE_LOGGING = '0';
}

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
                // Accepts a single line or an array of lines (batched by main).
                // DOM is capped so a noisy session can't grow it without bound.
                window.appendLog = (msgs) => {
                    const logs = document.getElementById('logs');
                    for (const msg of [].concat(msgs)) {
                        const div = document.createElement('div');
                        div.textContent = String(msg ?? '');
                        logs.appendChild(div);
                    }
                    while (logs.childElementCount > 5000) logs.removeChild(logs.firstChild);
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

// Log lines are batched and flushed a few times per second. The old version ran
// one executeJavaScript PER LINE, which made noisy logs slow and timing flaky.
const logQueue: string[] = [];
let logFlushTimer: NodeJS.Timeout | null = null;
const flushLogQueue = () => {
    logFlushTimer = null;
    if (!logWindow || logWindow.isDestroyed() || logQueue.length === 0) { logQueue.length = 0; return; }
    const batch = logQueue.splice(0, logQueue.length);
    logWindow.webContents.executeJavaScript(`window.appendLog && window.appendLog(${JSON.stringify(batch)});`).catch(() => {});
};
const publishLogLine = (line: string) => {
    logQueue.push(line);
    if (!logFlushTimer) logFlushTimer = setTimeout(flushLogQueue, 250);
};

console.log = (...args) => {
    origLog(...args);
    const line = `[INFO] ${args.join(' ')}`;
    publishLogLine(line);
    writeRuntimeLog('INFO', args.map(stringifyLogArg).join(' '));
};

console.error = (...args) => {
    origError(...args);
    const line = `[ERROR] ${args.join(' ')}`;
    publishLogLine(line);
    writeRuntimeLog('ERROR', args.map(stringifyLogArg).join(' '));
};

function stringifyLogArg(a: unknown): string {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === 'object') { try { return JSON.stringify(a); } catch { return String(a); } }
    return String(a);
}

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
        backgroundColor: '#121218',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            // The preload is a fully bundled single file whose only runtime
            // require() is 'electron' (verified in dist-electron/preload.js), so
            // the Chromium sandbox stays ON. Keep it that way: if the preload
            // ever gains a Node-only dependency, the bridge breaks under
            // sandboxing — fix the preload, don't disable the sandbox.
            sandbox: true,
        },
    });

    registerFileSystemHandlers(mainWindow);
    registerDataHomeHandlers(mainWindow);
    registerRuntimeLogHandlers();
    registerTerminalHandlers(mainWindow);
    registerOllamaHandlers(mainWindow);
    registerObsidianHandlers();

    // Native tool-calling agent kernel (Chat / Cowork / Code surfaces).
    const { kernel: agentKernel } = registerAgentHandlers(mainWindow, { getBriefing: () => backgroundManager.getBriefing() });

    // Dual-model debate: two models argue in real-time, user can interject.
    // Debate turns run through the SAME kernel as single-model chat (full tools,
    // project context, permissions, vision) - so it needs the kernel instance.
    registerDebateHandlers(mainWindow, agentKernel);

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

    // Markdown links (target=_blank) open in the system browser, never as a new
    // Electron window; and dragging a file onto the app must not navigate the
    // renderer away from the UI (which looked like the app "going blank").
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http:') || url.startsWith('https:')) shell.openExternal(url);
        return { action: 'deny' };
    });
    mainWindow.webContents.on('will-navigate', (e, url) => {
        if (!VITE_DEV_SERVER_URL || !url.startsWith(VITE_DEV_SERVER_URL)) e.preventDefault();
    });

    // A blank window in dev is almost always a silent load failure: Electron can
    // come up before the Vite dev server accepts connections, and loadURL never
    // retries on its own. Retry with backoff instead of showing white forever.
    // If it never recovers, show the reason instead of an endless white window.
    let loadRetries = 0;
    const showFatalLoadError = (detail: string) => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        console.error(`Fatal renderer load failure: ${detail}`);
        mainWindow.loadURL(`data:text/html;charset=utf-8,
            <html><body style="background:#121218;color:#e7e7f0;font-family:system-ui;padding:40px;">
                <h2 style="color:#e0506a;">VIBE couldn't load its interface</h2>
                <p style="color:#9a9aab;">${detail.replace(/</g, '&lt;')}</p>
                <p style="color:#9a9aab;">If you're developing, make sure the Vite dev server is running, then restart the app.
                The runtime log (Documents/VIBE/logs/runtime.log) has the full error trail.</p>
            </body></html>
        `).catch(() => {});
    };
    mainWindow.webContents.on('did-fail-load', (_e, code, desc, url, isMainFrame) => {
        if (!isMainFrame || !mainWindow || mainWindow.isDestroyed()) return;
        if (loadRetries >= 20) { showFatalLoadError(`Load failed after ${loadRetries} retries (${code} ${desc}).`); return; }
        loadRetries++;
        console.error(`Renderer load failed (${code} ${desc} ${url}); retry ${loadRetries}`);
        setTimeout(() => {
            if (!mainWindow || mainWindow.isDestroyed()) return;
            if (VITE_DEV_SERVER_URL) mainWindow.loadURL(VITE_DEV_SERVER_URL);
            else mainWindow.loadFile(path.join(process.env.DIST || '', 'index.html'));
        }, 500);
    });
    mainWindow.webContents.on('did-finish-load', () => { loadRetries = 0; crashReloads.length = 0; });

    // If the renderer process dies (GPU/cache corruption, OOM), relaunch it
    // instead of leaving a dead white window — but cap restarts: a deterministic
    // crash must not loop reload forever. After 3 crashes in a minute, stop and
    // show the error page so the failure is visible and diagnosable.
    const crashReloads: number[] = [];
    mainWindow.webContents.on('render-process-gone', (_e, details) => {
        console.error(`Renderer process gone: ${details.reason} (exitCode ${details.exitCode})`);
        if (details.reason === 'clean-exit' || !mainWindow || mainWindow.isDestroyed()) return;
        const now = Date.now();
        while (crashReloads.length && now - crashReloads[0] > 60_000) crashReloads.shift();
        if (crashReloads.length >= 3) {
            showFatalLoadError(`The interface crashed ${crashReloads.length} times in the last minute (last reason: ${details.reason}). Not reloading again automatically.`);
            return;
        }
        crashReloads.push(now);
        mainWindow.webContents.reload();
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

// Centralized shutdown: every long-lived resource stops through ONE path so
// exit doesn't race background work. Kill persistent agent shells (no pty
// survives the app) and stop the collector/reviewer agents (watchers, timers).
let shuttingDown = false;
function shutdown() {
    if (shuttingDown) return;
    shuttingDown = true;
    try { backgroundManager.stop(); } catch { /* ignore */ }
    try { killAllShells(); } catch { /* ignore */ }
}
app.on('before-quit', shutdown);

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

app.whenReady().then(createWindow)
