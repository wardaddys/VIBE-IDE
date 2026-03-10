# Project Codebase

## src\main\index.ts
```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerFileSystemHandlers } from './ipc/filesystem';
import { registerTerminalHandlers } from './ipc/terminal';
import { registerOllamaHandlers } from './ipc/ollama';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
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
            nodeIntegration: true,
            contextIsolation: false
        }
    });
    logWindow.loadURL(`data:text/html;charset=utf-8,
        <html>
        <body style="background:#1e1e1e; color:#00d4aa; font-family:monospace; font-size:12px; padding:10px; word-wrap:break-word;">
            <div id="logs" style="padding-bottom: 20px;">=== VIBE SESSION LOGS ===<br/><br/></div>
            <script>
                const { ipcRenderer } = require('electron');
                ipcRenderer.on('log', (e, msg) => {
                    const logs = document.getElementById('logs');
                    const div = document.createElement('div');
                    div.innerHTML = msg;
                    logs.appendChild(div);
                    window.scrollTo(0, document.body.scrollHeight);
                });
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
console.log = (...args) => {
    origLog(...args);
    if (logWindow && !logWindow.isDestroyed()) {
        logWindow.webContents.send('log', `[INFO] ${args.join(' ')}`);
    }
};
console.error = (...args) => {
    origError(...args);
    if (logWindow && !logWindow.isDestroyed()) {
        logWindow.webContents.send('log', `<span style="color:#ff4466">[ERROR] ${args.join(' ')}</span>`);
    }
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
        mainWindow?.webContents.send('window:maximized', true);
    });
    mainWindow.on('unmaximize', () => {
        mainWindow?.webContents.send('window:maximized', false);
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
```

## src\main\ipc\filesystem.ts
```typescript
import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../shared/types';
const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.DS_Store', '__pycache__', '.venv', 'dist', 'build', '.next', '.cache', '.turbo'
]);
export function registerFileSystemHandlers(mainWindow: BrowserWindow) {
    ipcMain.handle('fs:openFolder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    });
    ipcMain.handle('fs:readDir', async (_event, dirPath: string): Promise<FileEntry[]> => {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            const fileEntries: FileEntry[] = entries
                .filter(entry => !IGNORED_DIRS.has(entry.name))
                .map(entry => ({
                    name: entry.name,
                    path: path.join(dirPath, entry.name),
                    isDirectory: entry.isDirectory(),
                    isFile: entry.isFile(),
                    extension: entry.isFile() ? path.extname(entry.name) : undefined,
                }));
            return fileEntries.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            console.error('Failed to read directory:', error);
            throw error;
        }
    });
    ipcMain.handle('fs:readFile', async (_event, filePath: string): Promise<string> => {
        try {
            return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error('Failed to read file:', error);
            throw error;
        }
    });
    ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string): Promise<boolean> => {
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8');
            return true;
        } catch (error) {
            console.error('Failed to write file:', error);
            throw error;
        }
    });
    let currentWatcher: any = null;
    ipcMain.handle('fs:watchFolder', (_event, dirPath: string) => {
        if (currentWatcher) currentWatcher.close();
        try {
            currentWatcher = require('node:fs').watch(dirPath, { recursive: true }, (eventType: string, filename: string) => {
                if (filename && !IGNORED_DIRS.has(filename.split(/[\/\\]/)[0])) {
                    if (!mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('fs:changed');
                    }
                }
            });
        } catch(e) {
            console.error('Failed to watch folder:', e);
        }
    });
}
```

## src\main\ipc\ollama.ts
```typescript
import { ipcMain, BrowserWindow } from 'electron';
import type { ChatMessage } from '../../shared/types';

const OLLAMA_BASE = 'http://localhost:11434';
let abortController: AbortController | null = null;

export const OLLAMA_ONLY_MODELS = new Set<string>([
    'gpt-oss-120b',
]);

export function registerOllamaHandlers(mainWindow: BrowserWindow) {
    ipcMain.handle('ollama:detect', async () => {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/tags`);
            if (res.ok) return { detected: true, version: 'Local' };
            return { detected: false };
        } catch { return { detected: false }; }
    });

    ipcMain.handle('ollama:status', async () => {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/tags`);
            return !!res.ok;
        } catch { return false; }
    });

    ipcMain.handle('ollama:listModels', async () => {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/tags`);
            if (res.ok) {
                const data = await res.json();
                return (data.models || []).map((m: any) => m.name);
            }
            return [];
        } catch { return []; }
    });

    ipcMain.handle('ollama:chat', async (_event, model, messages, apiKeys) => {
        if (abortController) abortController.abort();
        abortController = new AbortController();

        try {
            let endpoint = '';
            let headers: any = { 'Content-Type': 'application/json' };
            let body: any = {};
            let isAnthropic = false;
            let isGemini = false;

            const sysMsg = messages.find(m => m.role === 'system')?.content || '';
            const userMsgs = messages.filter(m => m.role !== 'system');

            if (model.includes('-cloud') || OLLAMA_ONLY_MODELS.has(model)) {
                endpoint = `${OLLAMA_BASE}/api/chat`;
                body = { model, messages, stream: true, options: { num_ctx: 16384 } };
            }
            else if (model.includes('claude')) {
                if (!apiKeys?.claude) throw new Error('Claude API key missing.');
                endpoint = 'https://api.anthropic.com/v1/messages';
                headers['x-api-key'] = apiKeys.claude;
                headers['anthropic-version'] = '2023-06-01';
                headers['anthropic-dangerous-direct-browser-access'] = 'true';
                isAnthropic = true;
                body = { model, max_tokens: 4096, system: sysMsg, messages: userMsgs, stream: true };
            } 
            else if (model.includes('gpt-') || model.includes('deepseek') || model.includes('llama3')) {
                let key = '';
                if (model.includes('gpt-')) { endpoint = 'https://api.openai.com/v1/chat/completions'; key = apiKeys?.openai || ''; }
                if (model.includes('deepseek')) { endpoint = 'https://api.deepseek.com/chat/completions'; key = apiKeys?.deepseek || ''; }
                if (model.includes('llama3')) { endpoint = 'https://api.groq.com/openai/v1/chat/completions'; key = apiKeys?.groq || ''; }
                
                if (!key) throw new Error(`API key missing for Cloud Model: ${model}`);
                headers['Authorization'] = `Bearer ${key}`;
                body = { model, messages, stream: true };
            } 
            else if (model.includes('gemini')) {
                if (!apiKeys?.gemini) throw new Error('Gemini API key missing.');
                isGemini = true;
                endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKeys.gemini}`;
                body = { contents: userMsgs.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) };
                if (sysMsg.trim() !== '') body.systemInstruction = { parts: [{ text: sysMsg }] };
            } 
            else if (model.startsWith('hf:')) {
                const hfModelId = model.replace('hf:', '');
                endpoint = `https://router.huggingface.co/hf-inference/models/${hfModelId}/v1/chat/completions`;
                if (apiKeys?.hf) {
                    headers['Authorization'] = `Bearer ${apiKeys.hf}`;
                }
                body = { model: hfModelId, messages, stream: true, max_tokens: 2048 };
            }
            else {
                endpoint = `${OLLAMA_BASE}/api/chat`;
                body = { model, messages, stream: true, options: { num_ctx: 16384 } };
            }

            const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: abortController.signal });
            if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`);

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No stream available');
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const tLine = line.trim();
                    if (!tLine || tLine === 'data: [DONE]') continue;
                    try {
                        let contentChunk = '';
                        if (isGemini && tLine.startsWith('data: ')) {
                            contentChunk = JSON.parse(tLine.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text || '';
                        } 
                        else if (isAnthropic && tLine.startsWith('data: ')) {
                            const j = JSON.parse(tLine.slice(6));
                            if (j.type === 'content_block_delta') contentChunk = j.delta?.text || '';
                        }
                        else if ((model.includes('gpt-') || model.includes('deepseek') || model.includes('llama3') || model.startsWith('hf:')) && tLine.startsWith('data: ')) {
                            const parsed = JSON.parse(tLine.slice(6));
                            contentChunk = parsed.choices?.[0]?.delta?.content || '';
                        }
                        else if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
                            contentChunk = JSON.parse(tLine).message?.content || '';
                        }

                        if (contentChunk && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('ollama:stream', { content: contentChunk, done: false });
                        }
                    } catch (e) { }
                }
            }
            if (!mainWindow.isDestroyed()) mainWindow.webContents.send('ollama:stream', { content: '', done: true });

        } catch (error: any) {
            if (error.name !== 'AbortError' && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ollama:stream', { content: `\n\n🚨 **System Error:** ${error.message}`, done: true });
            }
        } finally { abortController = null; }
    });

    ipcMain.handle('ollama:stop', () => {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
    });
}
```

## src\main\ipc\terminal.ts
```typescript
import { ipcMain, BrowserWindow } from 'electron';
import * as pty from 'node-pty';
const terminals = new Map<string, pty.IPty>();
export function registerTerminalHandlers(mainWindow: BrowserWindow) {
    ipcMain.handle('terminal:create', (_event, cwd?: string) => {
        let shell = '/bin/bash';
        if (process.platform === 'win32') {
            shell = 'powershell.exe';
        } else if (process.platform === 'darwin') {
            shell = process.env.SHELL || '/bin/zsh';
        } else {
            shell = process.env.SHELL || '/bin/bash';
        }
        try {
            const ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: cwd || process.env.HOME || process.env.USERPROFILE,
                env: process.env as any,
            });
            const id = Math.random().toString(36).substring(7);
            terminals.set(id, ptyProcess);
            ptyProcess.onData((data) => {
                if (!mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('terminal:data', id, data);
                }
            });
            return id;
        } catch (error) {
            console.error('Failed to create terminal:', error);
            throw error;
        }
    });
    ipcMain.handle('terminal:input', (_event, id: string, data: string) => {
        const ptyProcess = terminals.get(id);
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    });
    ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) => {
        const ptyProcess = terminals.get(id);
        if (ptyProcess) {
            try {
                ptyProcess.resize(cols, rows);
            } catch (e) {
                console.error('Resize error:', e);
            }
        }
    });
    ipcMain.handle('terminal:kill', (_event, id: string) => {
        const ptyProcess = terminals.get(id);
        if (ptyProcess) {
            ptyProcess.kill();
            terminals.delete(id);
        }
    });
}
```

## src\main\preload.ts
```typescript
import { contextBridge, ipcRenderer } from 'electron';
import type { ChatMessage, FileEntry } from '../shared/types';
contextBridge.exposeInMainWorld('vibe', {
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    readDir: (dirPath: string): Promise<FileEntry[]> => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string): Promise<boolean> => ipcRenderer.invoke('fs:writeFile', filePath, content),
    watchFolder: (dirPath: string) => ipcRenderer.invoke('fs:watchFolder', dirPath),
    onFolderChanged: (callback: () => void) => {
        ipcRenderer.removeAllListeners('fs:changed');
        ipcRenderer.on('fs:changed', () => callback());
    },
    createTerminal: (cwd?: string): Promise<string> => ipcRenderer.invoke('terminal:create', cwd),
    sendTerminalInput: (id: string, data: string) => ipcRenderer.invoke('terminal:input', id, data),
    resizeTerminal: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    onTerminalData: (callback: (id: string, data: string) => void) => {
        ipcRenderer.on('terminal:data', (_event, id, data) => callback(id, data));
    },
    killTerminal: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    detectOllama: () => ipcRenderer.invoke('ollama:detect'),
    statusOllama: () => ipcRenderer.invoke('ollama:status'),
    listModels: () => ipcRenderer.invoke('ollama:listModels'),
    chat: (model: string, messages: ChatMessage[], apiKeys?: Record<string, string>) => ipcRenderer.invoke('ollama:chat', model, messages, apiKeys),
    onChatStream: (callback: (chunk: { content: string, done: boolean }) => void) => {
        ipcRenderer.removeAllListeners('ollama:stream');
        ipcRenderer.on('ollama:stream', (_event, chunk) => callback(chunk));
    },
    log: (msg: string) => ipcRenderer.invoke('log:renderer', msg),
    stopGeneration: () => ipcRenderer.invoke('ollama:stop'),
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
});
```

## src\renderer\App.tsx
```typescript
import React, { useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { MenuBar } from './components/layout/MenuBar';
import { Sidebar } from './components/layout/Sidebar';
import { MainArea } from './components/layout/MainArea';
import { TerminalPane } from './components/terminal/TerminalPane';
import { useOllamaStore } from './store/ollama';
import { useWorkspaceStore } from './store/workspaces';
export default function App() {
    const setConnectionState = useOllamaStore(state => state.setConnectionState);
    const setModels = useOllamaStore(state => state.setModels);
    useEffect(() => {
        const checkOllama = async () => {
            try {
                const status = await window.vibe.detectOllama();
                setConnectionState(status.detected, status.version || null);
                if (status.detected) {
                    const models = await window.vibe.listModels();
                    setModels(models);
                }
            } catch (err) {
                console.error('Ollama check failed:', err);
                setConnectionState(false, null);
            }
        };
        checkOllama();
        const interval = setInterval(checkOllama, 30000);
        return () => clearInterval(interval);
    }, [setConnectionState, setModels]);
    useEffect(() => {
        window.vibe.onChatStream((chunk: { content: string, done: boolean }) => {
            if (chunk.content) {
                useOllamaStore.getState().updateLastMessage(chunk.content);
                const ws = useWorkspaceStore.getState();
                if (ws.activeWorkspacePath && ws.activeThreadId) {
                    const workspace = ws.workspaces.find(w => w.path === ws.activeWorkspacePath);
                    const thread = workspace?.threads.find(t => t.id === ws.activeThreadId);
                    if (thread) {
                        const msgs = [...thread.messages];
                        if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                            msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + chunk.content };
                            ws.saveMessagesToThread(ws.activeWorkspacePath!, ws.activeThreadId!, msgs);
                        }
                    }
                }
            }
            if (chunk.done) {
                useOllamaStore.getState().setIsGenerating(false);
                const ws = useWorkspaceStore.getState();
                if (ws.activeWorkspacePath && ws.activeThreadId) {
                    const workspace = ws.workspaces.find(w => w.path === ws.activeWorkspacePath);
                    const thread = workspace?.threads.find(t => t.id === ws.activeThreadId);
                    if (thread) {
                        ws.saveMessagesToThread(ws.activeWorkspacePath!, ws.activeThreadId!, thread.messages);
                    }
                }
            }
        });
    }, []);
    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TitleBar />
            <MenuBar />
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '0 var(--gap) var(--gap)', gap: 'var(--gap)' }}>
                <Sidebar />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--gap)', overflow: 'hidden' }}>
                    <MainArea />
                    <TerminalPane />
                </div>
            </div>
        </div>
    );
}
```

## src\renderer\components\ai\ChatMessages.tsx
```typescript
import React, { useEffect, useRef } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { useTerminalStore } from '../../store/terminal';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';

function CommandBlock({ command }: { command: string }) {
    const activeTerminalId = useTerminalStore(state => state.activeTerminalId);
    const [status, setStatus] = React.useState<'pending' | 'running' | 'done'>('pending');

    React.useEffect(() => {
        if (activeTerminalId && status === 'pending') {
            setStatus('running');
            setTimeout(() => {
                window.vibe.sendTerminalInput(activeTerminalId, command + '\r');
                setStatus('done');
            }, 300);
        }
    }, [activeTerminalId]);

    return (
        <div style={{ background: '#0d1117', border: `1px solid ${status === 'done' ? '#238636' : '#30363d'}`, borderRadius: 6, padding: '8px 12px', margin: '4px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#7c8fa6', textTransform: 'uppercase', letterSpacing: 1 }}>Terminal</span>
                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: status === 'done' ? 'rgba(35,134,54,0.15)' : 'rgba(230,138,0,0.15)', color: status === 'done' ? '#3fb950' : '#e68a00' }}>{status === 'done' ? 'DONE' : 'RUNNING'}</span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={command}>{command}</div>
        </div>
    );
}

function FileWriteBlock({ path, content }: { path: string, content: string }) {
    const projectPath = useUIStore(state => state.projectPath);
    const openFile = useEditorStore(state => state.openFile);
    const [written, setWritten] = React.useState(false);
    useEffect(() => {
        if (projectPath && !written) {
            const fullPath = `${projectPath}/${path}`;
            window.vibe.writeFile(fullPath, content).then(() => { setWritten(true); openFile(fullPath, content); }).catch(console.error);
        }
    }, [projectPath, path, content, written]);
    return (
        <div style={{ background: 'rgba(0, 168, 112, 0.05)', border: '1px solid rgba(0, 168, 112, 0.2)', padding: '6px 12px', borderRadius: 6, margin: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: written ? 'var(--green)' : 'var(--warn)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {path} <span style={{ fontSize: 9, color: written ? 'var(--green)' : 'var(--text-muted)', fontWeight: 700, marginLeft: 4 }}>{written ? 'SAVED' : 'SAVING…'}</span>
                </div>
            </div>
        </div>
    );
}

function PlanBlock({ plan }: { plan: string }) {
    return (
        <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', padding: '10px 14px', borderRadius: 8, margin: '6px 0' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 800, marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>🎯 Execution Plan</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>{plan}</div>
        </div>
    );
}

function ThinkingBlock({ startTime }: { startTime: number }) {
    const [elapsed, setElapsed] = React.useState(0);
    const agentStatus = useOllamaStore(state => state.agentStatus);
    React.useEffect(() => {
        const interval = setInterval(() => { setElapsed(Math.floor((Date.now() - startTime) / 1000)); }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', color: 'var(--text-muted)', fontSize: 11 }}>
            <div style={{ width: 10, height: 10, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{agentStatus || `Processing (${elapsed}s)…`}</span>
        </div>
    );
}

export function ChatMessages() {
    const messages = useOllamaStore(state => state.messages);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const containerRef = useRef<HTMLDivElement>(null);
    const [thinkingStartTime] = React.useState(() => Date.now());
    useEffect(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, [messages]);
    const renderContent = (content: string) => {
        if (!content) return <span style={{ opacity: 0.5 }}>…</span>;
        if (content.startsWith('__TERMINAL_OUTPUT__\n')) {
            const output = content.replace('__TERMINAL_OUTPUT__\n', '');
            return (
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#e6edf3', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <div style={{ color: '#7c8fa6', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Terminal Output</div>
                    {output}
                </div>
            );
        }
        if (content.startsWith('__FILE_CONTENTS__')) {
            const firstNewline = content.indexOf('\n');
            const header = content.slice('__FILE_CONTENTS__ '.length, firstNewline);
            const body = content.slice(firstNewline + 1);
            return (
                <div style={{ background: 'rgba(0,102,255,0.04)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                    <div style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>📄 Reading: {header}</div>
                    {body.slice(0, 600)}{body.length > 600 ? '\n… (truncated for display)' : ''}
                </div>
            );
        }
        if (content.startsWith('__SWARM_LABEL__')) {
            const label = content.replace('__SWARM_LABEL__', '');
            return <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, padding: '2px 0' }}>{label}</div>;
        }
        const parts = content.split(/(<execute>[\s\S]*?<\/execute>|<write_file[\s\S]*?<\/write_file>|<plan>[\s\S]*?<\/plan>)/g);
        return parts.map((part, index) => {
            if (part.startsWith('<execute>')) return <CommandBlock key={index} command={part.replace(/<\/?execute>/g, '').trim()} />;
            if (part.startsWith('<write_file')) {
                const pathMatch = part.match(/path=['"]([^'"]+)['"]/);
                const path = pathMatch ? pathMatch[1] : 'unknown.txt';
                return <FileWriteBlock key={index} path={path} content={part.replace(/<write_file[^>]*>/, '').replace(/<\/write_file>/, '').trim()} />;
            }
            if (part.startsWith('<plan>')) return <PlanBlock key={index} plan={part.replace(/<\/?plan>/g, '').trim()} />;
            return <span key={index}>{part}</span>;
        });
    };
    return (
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, i) => {
                const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant';
                const isStreaming = isLastAssistant && isGenerating && msg.content === '';
                const isSpecialBlock = msg.content.startsWith('__TERMINAL_OUTPUT__') || msg.content.startsWith('__FILE_CONTENTS__') || msg.content.startsWith('__SWARM_LABEL__');
                return (
                    <React.Fragment key={i}>
                        {isStreaming && <ThinkingBlock startTime={thinkingStartTime} />}
                        {(!isStreaming || msg.content !== '') && (
                            <div style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: isSpecialBlock ? '100%' : '92%', background: isSpecialBlock ? 'transparent' : msg.role === 'user' ? 'var(--accent-light)' : '#fff', color: 'var(--text)', padding: isSpecialBlock ? '0' : '12px 16px', borderRadius: 'var(--radius-md)', border: isSpecialBlock ? 'none' : msg.role === 'user' ? 'none' : '1px solid var(--border-light)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)' }}>
                                {renderContent(msg.content)}
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
```

export function ChatMessages() {
    const messages = useOllamaStore(state => state.messages);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const containerRef = useRef<HTMLDivElement>(null);
    const [thinkingStartTime] = React.useState(() => Date.now());

    useEffect(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, [messages]);

    const renderContent = (content: string) => {
        if (!content) return <span style={{ opacity: 0.5 }}>…</span>;

        if (content.startsWith('__TERMINAL_OUTPUT__\n')) {
            const output = content.replace('__TERMINAL_OUTPUT__\n', '');
            return (
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#e6edf3', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <div style={{ color: '#7c8fa6', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Terminal Output</div>
                    {output}
                </div>
            );
        }

        if (content.startsWith('__FILE_CONTENTS__')) {
            const firstNewline = content.indexOf('\n');
            const header = content.slice('__FILE_CONTENTS__ '.length, firstNewline);
            const body = content.slice(firstNewline + 1);
            return (
                <div style={{ background: 'rgba(0,102,255,0.04)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                    <div style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>📄 Reading: {header}</div>
                    {body.slice(0, 600)}{body.length > 600 ? '\n… (truncated for display)' : ''}
                </div>
            );
        }

        if (content.startsWith('__SWARM_LABEL__')) {
            const label = content.replace('__SWARM_LABEL__', '');
            return (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, padding: '2px 0' }}>{label}</div>
            );
        }

        const parts = content.split(/(<execute>[\s\S]*?<\/execute>|<write_file[\s\S]*?<\/write_file>|<plan>[\s\S]*?<\/plan>)/g);
        return parts.map((part, index) => {
            if (part.startsWith('<execute>')) {
                const cmd = part.replace(/<\/?execute>/g, '').trim();
                return <CommandBlock key={index} command={cmd} />;
            }
            if (part.startsWith('<write_file')) {
                const pathMatch = part.match(/path=['"]([^'"]+)['"]/);
                const path = pathMatch ? pathMatch[1] : 'unknown.txt';
                let fileContent = part.replace(/<write_file[^>]*>/, '').replace(/<\/write_file>/, '').trim();
                return <FileWriteBlock key={index} path={path} content={fileContent} />;
            }
            if (part.startsWith('<plan>')) return <PlanBlock key={index} plan={part.replace(/<\/?plan>/g, '').trim()} />;
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, i) => {
                const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant';
                const isStreaming = isLastAssistant && isGenerating && msg.content === '';
                const isSpecialBlock = msg.content.startsWith('__TERMINAL_OUTPUT__')
                    || msg.content.startsWith('__FILE_CONTENTS__')
                    || msg.content.startsWith('__SWARM_LABEL__');

                return (
                    <React.Fragment key={i}>
                        {isStreaming && <ThinkingBlock startTime={thinkingStartTime} />}
                        {(!isStreaming || msg.content !== '') && (
                            <div style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: isSpecialBlock ? '100%' : '92%',
                                background: isSpecialBlock ? 'transparent' : msg.role === 'user' ? 'var(--accent-light)' : '#fff',
                                color: 'var(--text)',
                                padding: isSpecialBlock ? '0' : '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: isSpecialBlock ? 'none' : msg.role === 'user' ? 'none' : '1px solid var(--border-light)',
                                fontSize: 13,
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'var(--font-sans)',
                            }}>
                                {renderContent(msg.content)}
                            </div>
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
```

## src\renderer\components\ai\ModelCapabilities.tsx
```typescript
import React from 'react';
import { useOllamaStore } from '../../store/ollama';
import type { ModelCapability } from '../../../shared/types';
import { Tooltip, IconButton } from '@mui/material';
import LightbulbIcon from '@mui/icons-material/EmojiObjects';
import SearchIcon from '@mui/icons-material/Search';
import ImageIcon from '@mui/icons-material/Image';
import TerminalIcon from '@mui/icons-material/Terminal';
export const ModelCapabilities = () => {
    const selected = useOllamaStore(s => s.selectedModel);
    const caps: ModelCapability = useOllamaStore(s => s.modelCapabilities[selected] ?? {});
    const handleThink = () => window.vibe.log('chat:think');
    const handleWebSearch = () => window.vibe.log('chat:websearch');
    const handleImage = () => window.vibe.log('chat:image');
    const handleExecute = () => window.vibe.log('chat:execute');
    return (
        <div style={{ display: 'flex', gap: 4, padding: '0' }}>
            {caps.think && (
                <Tooltip title="Think (Chain‑of‑thought)">
                    <IconButton size="small" onClick={handleThink}>
                        <LightbulbIcon fontSize="inherit" />
                    </IconButton>
                </Tooltip>
            )}
            {caps.web && (
                <Tooltip title="Web search">
                    <IconButton size="small" onClick={handleWebSearch}>
                        <SearchIcon fontSize="inherit" />
                    </IconButton>
                </Tooltip>
            )}
            {caps.image && (
                <Tooltip title="Generate image">
                    <IconButton size="small" onClick={handleImage}>
                        <ImageIcon fontSize="inherit" />
                    </IconButton>
                </Tooltip>
            )}
            {caps.canExecute && (
                <Tooltip title="Run <execute> command">
                    <IconButton size="small" onClick={handleExecute}>
                        <TerminalIcon fontSize="inherit" />
                    </IconButton>
                </Tooltip>
            )}
        </div>
    );
};
```

## src\renderer\components\ai\HuggingFacePicker.tsx
```typescript
import React, { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useHFStore } from '../../store/huggingface';
import { useSettingsStore } from '../../store/settings';

interface HFModel {
    id: string;
    likes: number;
    downloads: number;
    pipeline_tag: string;
    tags: string[];
}

interface Props { onClose: () => void; }

export function HuggingFacePicker({ onClose }: Props) {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<HFModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { pinnedModels, pinModel, unpinModel } = useHFStore();
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const searchRef = useRef<any>(null);

    const searchModels = async (query: string) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                search: query || 'instruct',
                filter: 'text-generation',
                sort: 'likes',
                direction: '-1',
                limit: '20',
                full: 'false',
                config: 'false',
            });
            const headers: any = {};
            if (apiKeys?.hf) headers['Authorization'] = `Bearer ${apiKeys.hf}`;
            const res = await fetch(`https://huggingface.co/api/models?${params}`, { headers });
            if (!res.ok) throw new Error(`HF API error ${res.status}`);
            const data = await res.json();
            setResults(data);
        } catch (e: any) {
            setError(e.message || 'Search failed');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { searchModels(''); }, []);

    useEffect(() => {
        if (searchRef.current) clearTimeout(searchRef.current);
        searchRef.current = setTimeout(() => {
            searchModels(search);
        }, 500);
        return () => clearTimeout(searchRef.current);
    }, [search]);

    const isPinned = (id: string) => pinnedModels.some(m => m.id === id);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <GlassPanel variant="strong" style={{ width: 580, maxHeight: '82vh', display: 'flex', flexDirection: 'column', zIndex: 1000 }}>
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                                🤗 HuggingFace Models
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Live search — add models to your selector
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search models (e.g. mistral, llama, coder…)"
                            autoFocus
                            style={{ width: '100%', padding: '9px 36px 9px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.9)', fontSize: 13, color: 'var(--text)', outline: 'none' }}
                        />
                        {loading && <div style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />}
                    </div>
                    {error && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--error)' }}>⚠ {error}</div>}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {results.map(model => {
                        const pinned = isPinned(model.id);
                        return (
                            <div key={model.id} style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)', background: pinned ? 'rgba(0,102,255,0.03)' : 'transparent', gap: 12 }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{model.id}</div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>❤ {(model.likes || 0).toLocaleString()}</span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>↓ {(model.downloads || 0).toLocaleString()}</span>
                                        {model.pipeline_tag && <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>{model.pipeline_tag}</span>}
                                    </div>
                                </div>
                                <button onClick={() => pinned ? unpinModel(model.id) : pinModel({ id: model.id, name: model.id.split('/').pop() || model.id })} style={{ padding: '5px 14px', borderRadius: 'var(--radius-md)', border: pinned ? '1px solid var(--error)' : '1px solid var(--accent)', background: pinned ? 'rgba(224,48,80,0.06)' : 'var(--accent-light)', color: pinned ? 'var(--error)' : 'var(--accent)', fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>{pinned ? 'Remove' : '+ Add'}</button>
                            </div>
                        );
                    })}
                </div>
                <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-light)', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pinnedModels.length} models added {!apiKeys?.hf && '· Add token in Settings'}</span>
                    <button onClick={onClose} style={{ padding: '7px 20px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Done</button>
                </div>
            </GlassPanel>
        </div>
    );
}
```

## src\renderer\components\ai\ModelSelector.tsx
```typescript
import React, { useEffect, useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { useSwarmStore } from '../../store/swarms';
import { getModelTags } from '../../utils/tags';
import { AgentManager } from '../layout/AgentManager';
import { OLLAMA_ONLY_MODELS } from '../../../shared/constants';
import { useHFStore } from '../../store/huggingface';
import { HuggingFacePicker } from './HuggingFacePicker';

interface Props { onClose: () => void; }

export function ModelSelector({ onClose }: Props) {
    const models = useOllamaStore(state => state.models);
    const selectedModel = useOllamaStore(state => state.selectedModel);
    const setSelectedModel = useOllamaStore(state => state.setSelectedModel);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const swarms = useSwarmStore(state => state.swarms);
    const [showAgentManager, setShowAgentManager] = useState(false);
    const [showHFPicker, setShowHFPicker] = useState(false);
    const { pinnedModels } = useHFStore();

    const localModels = models.filter(m => !OLLAMA_ONLY_MODELS.has(m));
    const cloudModels = models.filter(m => OLLAMA_ONLY_MODELS.has(m));

    useEffect(() => {
        const load = () => {
            window.vibe.listModels().then((m: any) => useOllamaStore.getState().setModels(m));
        };
        load();
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, []);

    const cloudRoster = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'claude' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq' }
    ];

    const availableCloudModels = cloudRoster.filter(m => !!apiKeys[m.provider as keyof typeof apiKeys]);

    const renderModelItem = (m: { name?: string, id?: string, label?: string }, isSwarm = false) => {
        const id = m.id || m.name || '';
        const displayName = m.label || m.name || m.id;
        const isSelected = selectedModel === id;
        return (
            <div key={id} onClick={() => { setSelectedModel(id); onClose(); }} style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isSelected ? 'var(--accent-light)' : 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? 'var(--accent)' : 'transparent', border: isSelected ? 'none' : '1px solid var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: isSelected ? (isSwarm ? 700 : 600) : 500, color: isSwarm ? 'var(--accent)' : 'var(--text)' }}>{displayName}</span>
                </div>
            </div>
        );
    };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
            {showAgentManager && <AgentManager onClose={() => setShowAgentManager(false)} />}
            {showHFPicker && <HuggingFacePicker onClose={() => setShowHFPicker(false)} />}
            <GlassPanel variant="strong" style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: 0, right: 0, zIndex: 10, padding: '12px 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
                <div style={{ padding: '4px 16px 12px' }}>
                    <button onClick={() => { setShowAgentManager(true); onClose(); }} style={{ width: '100%', padding: '10px', background: 'var(--accent-light)', color: 'var(--accent)', border: '1px dashed var(--accent)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12 }}>+ Create Custom Swarm</button>
                </div>
                <div style={{ margin: '4px 0 8px', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '0 16px 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Local Models (Free)</div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>{localModels.map(m => renderModelItem({ id: m, label: m }))}</div>
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '8px 16px 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Cloud Models (API)</div>
                <div style={{ maxHeight: 250, overflowY: 'auto' }}>{availableCloudModels.map(m => renderModelItem({ id: m.id, label: m.name }))}</div>
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#ff6e00', fontWeight: 700 }}>HuggingFace (Free)</span>
                    <button onClick={(e) => { e.stopPropagation(); setShowHFPicker(true); }} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #ff6e00', background: 'rgba(255,110,0,0.06)', color: '#ff6e00', cursor: 'pointer', fontWeight: 600 }}>+ Browse</button>
                </div>
                <div style={{ maxHeight: 200, overflowY: 'auto' }}>{pinnedModels.map(m => renderModelItem({ id: `hf:${m.id}`, label: m.name }))}</div>
            </GlassPanel>
        </>
    );
}
```

## src\renderer\components\ai\ThinkingIndicator.tsx
```typescript
import React from 'react';
import { useOllamaStore } from '../../store/ollama';

export function ThinkingIndicator() {
    const agentStep = useOllamaStore(state => state.agentStep);
    const agentMaxSteps = useOllamaStore(state => state.agentMaxSteps);
    const agentStatus = useOllamaStore(state => state.agentStatus);
    const isLooping = agentStep > 0;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: isLooping ? 'rgba(230,138,0,0.06)' : 'var(--accent-light)',
            borderRadius: 6,
            color: isLooping ? 'var(--warn)' : 'var(--accent)',
            fontSize: 12,
            border: `1px solid ${isLooping ? 'rgba(230,138,0,0.15)' : 'transparent'}`,
        }}>
            <div style={{
                width: 10,
                height: 10,
                border: `2px solid ${isLooping ? 'var(--warn)' : 'var(--accent)'}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                flexShrink: 0,
            }} />
            <span>
                {agentStatus
                    ? agentStatus
                    : isLooping
                        ? `Agent working… (step ${agentStep}/${agentMaxSteps})`
                        : 'Assistant is thinking…'}
            </span>
        </div>
    );
}
```

## src\renderer\components\common\GlassPanel.tsx
```typescript
import React from 'react';
interface Props {
    children: React.ReactNode;
    variant?: 'default' | 'strong';
    className?: string;
    style?: React.CSSProperties;
}
export function GlassPanel({ children, variant = 'default', className, style }: Props) {
    const isStrong = variant === 'strong';
    return (
        <div className={className} style={{
            background: isStrong ? 'var(--glass-bg)' : 'var(--panel-bg)',
            backdropFilter: isStrong ? 'var(--glass-blur)' : 'var(--panel-blur)',
            WebkitBackdropFilter: isStrong ? 'var(--glass-blur)' : 'var(--panel-blur)',
            border: isStrong ? 'var(--glass-border)' : 'var(--panel-border)',
            boxShadow: isStrong ? 'var(--glass-shadow)' : 'var(--panel-shadow)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            ...style,
        }}>
            {children}
        </div>
    );
}
```

## src\renderer\components\editor\EditorTabs.tsx
```typescript
import React from 'react';
import { useEditorStore } from '../../store/editor';
export function EditorTabs() {
    const openFiles = useEditorStore(state => state.openFiles);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const setActiveFile = useEditorStore(state => state.setActiveFile);
    const closeFile = useEditorStore(state => state.closeFile);
    return (
        <div style={{
            display: 'flex',
            height: 36,
            background: 'rgba(0,0,0,0.02)',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
            flexShrink: 0
        }}>
            {openFiles.length === 0 && (
                <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    No files open
                </div>
            )}
            {openFiles.map(path => {
                const isActive = activeFileId === path;
                const name = path.split(/[/\\]/).pop() || path;
                return (
                    <div
                        key={path}
                        onClick={() => setActiveFile(path)}
                        style={{
                            padding: '0 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            fontFamily: 'var(--font-sans)',
                            color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                            background: isActive ? 'var(--accent-light)' : 'transparent',
                            borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                            borderRight: '1px solid var(--border-light)',
                            cursor: 'pointer',
                            minWidth: 100,
                            userSelect: 'none'
                        }}
                    >
                        <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: getExtColor(name)
                        }} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); closeFile(path); }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'inherit',
                                cursor: 'pointer',
                                opacity: 0.5,
                                fontSize: 14,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ×
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
function getExtColor(name: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts': case 'tsx': case 'js': case 'jsx': return 'var(--accent)';
        case 'json': return 'var(--warn)';
        case 'css': case 'scss': return '#6b40bf';
        case 'py': return 'var(--green)';
        case 'html': return 'var(--error)';
        default: return 'var(--text-muted)';
    }
}
```

## src\renderer\components\editor\MonacoEditor.tsx
```typescript
import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import { useEditorStore } from '../../store/editor';
import { useFileSystem } from '../../hooks/useFileSystem';
self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'typescript' || label === 'javascript') return new tsWorker();
        if (label === 'json') return new jsonWorker();
        if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
        return new editorWorker();
    }
};
monaco.editor.defineTheme('vibe-light', {
    base: 'vs',
    inherit: true,
    rules: [
        { token: 'comment', foreground: '8888a0', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0055cc' },
        { token: 'string', foreground: '00875a' },
        { token: 'number', foreground: 'e68a00' },
        { token: 'type', foreground: '0066ff' },
        { token: 'function', foreground: '6b40bf' },
        { token: 'variable', foreground: '1a1a2e' },
        { token: 'operator', foreground: '4a4a68' },
    ],
    colors: {
        'editor.background': '#00000000',
        'editor.foreground': '#1a1a2e',
        'editor.lineHighlightBackground': '#0066ff08',
        'editor.selectionBackground': '#0066ff18',
        'editorCursor.foreground': '#0066ff',
        'editorLineNumber.foreground': '#aab0c0',
        'editorLineNumber.activeForeground': '#0066ff',
        'editorIndentGuide.background': '#00000008',
        'editorIndentGuide.activeBackground': '#00000015',
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#e4e5ea',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#e4e5ea',
        'editorSuggestWidget.selectedBackground': '#0066ff10',
        'scrollbarSlider.background': '#00000012',
        'scrollbarSlider.hoverBackground': '#00000020',
    }
});
function getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
        ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
        json: 'json', md: 'markdown', css: 'css', scss: 'scss', html: 'html',
        py: 'python', rs: 'rust', go: 'go', cpp: 'cpp', c: 'c', h: 'cpp',
        java: 'java', rb: 'ruby', php: 'php', sh: 'shell', bash: 'shell',
        yml: 'yaml', yaml: 'yaml', toml: 'toml', xml: 'xml', sql: 'sql',
        dockerfile: 'dockerfile', makefile: 'makefile',
    };
    return map[ext || ''] || 'plaintext';
}
const models = new Map<string, monaco.editor.ITextModel>();
export function MonacoEditor() {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const fileContents = useEditorStore(state => state.fileContents);
    const updateContent = useEditorStore(state => state.updateContent);
    const { writeFile } = useFileSystem();
    const timeoutRef = useRef<any>(null);
    useEffect(() => {
        if (!containerRef.current) return;
        const editor = monaco.editor.create(containerRef.current, {
            theme: 'vibe-light',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 24,
            letterSpacing: 0.3,
            minimap: { enabled: true, scale: 1, showSlider: 'mouseover' },
            scrollbar: { verticalScrollbarSize: 5, horizontalScrollbarSize: 5 },
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            automaticLayout: true,
            wordWrap: 'off',
            tabSize: 2,
            formatOnPaste: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            guides: { indentation: true, bracketPairs: true },
        });
        editorRef.current = editor;
        const changeDisposable = editor.onDidChangeModelContent(() => {
            const currentModel = editor.getModel();
            if (!currentModel) return;
            const val = editor.getValue();
            const activeId = useEditorStore.getState().activeFileId;
            if (activeId && models.get(activeId) === currentModel) {
                updateContent(activeId, val);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    writeFile(activeId, val).catch(console.error);
                }, 1000);
            }
        });
        return () => {
            changeDisposable.dispose();
            editor.dispose();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [writeFile, updateContent]);
    useEffect(() => {
        if (!editorRef.current) return;
        if (!activeFileId) {
            editorRef.current.setModel(null);
            return;
        }
        let model = models.get(activeFileId);
        if (!model) {
            const content = fileContents[activeFileId] || '';
            const language = getLanguageFromPath(activeFileId);
            model = monaco.editor.createModel(content, language);
            models.set(activeFileId, model);
        }
        if (editorRef.current.getModel() !== model) {
            editorRef.current.setModel(model);
        }
    }, [activeFileId, fileContents]);
    return (
        <div style={{ width: '100%', height: '100%' }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: activeFileId ? 'block' : 'none'
                }}
            />
            {!activeFileId && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 48, opacity: 0.1, marginBottom: 16 }}>V</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Select a file to start coding</div>
                    </div>
                </div>
            )}
        </div>
    );
}
```

## src\renderer\components\filetree\FileTree.tsx
```typescript
import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../store/ui';
import { useFileSystem } from '../../hooks/useFileSystem';
import { FileTreeItem } from './FileTreeItem';
import type { FileEntry } from '../../../shared/types';
export function FileTree() {
    const projectPath = useUIStore(state => state.projectPath);
    const setProjectPath = useUIStore(state => state.setProjectPath);
    const { openFolder, readDir } = useFileSystem();
    const [entries, setEntries] = useState<FileEntry[]>([]);
    const refresh = () => {
        if (projectPath) {
            readDir(projectPath).then(setEntries).catch(console.error);
        }
    };
    useEffect(() => {
        refresh();
        if (projectPath) {
            window.vibe.watchFolder(projectPath);
            window.vibe.onFolderChanged(() => refresh());
        }
    }, [projectPath, readDir]);
    const handleOpenFolder = async () => {
        const p = await openFolder();
        if (p) {
            setProjectPath(p);
        }
    };
    if (!projectPath) {
        return (
            <div style={{ padding: 20, textAlign: 'center' }}>
                <button
                    onClick={handleOpenFolder}
                    style={{
                        background: 'var(--accent-gradient)',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        boxShadow: '0 2px 8px rgba(0,100,255,0.2)'
                    }}
                >
                    Open Folder
                </button>
            </div>
        );
    }
    return (
        <div style={{ padding: '4px 0' }}>
            {entries.map(entry => (
                <FileTreeItem key={entry.path} entry={entry} level={0} />
            ))}
        </div>
    );
}
```

## src\renderer\components\filetree\FileTreeItem.tsx
```typescript
import React, { useState } from 'react';
import type { FileEntry } from '../../../shared/types';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useEditorStore } from '../../store/editor';
interface Props {
    entry: FileEntry;
    level: number;
}
export function FileTreeItem({ entry, level }: Props) {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<FileEntry[]>([]);
    const { readDir, readFile } = useFileSystem();
    const openFile = useEditorStore(state => state.openFile);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const isActive = activeFileId === entry.path;
    const handleClick = async () => {
        if (entry.isDirectory) {
            if (!expanded) {
                const _children = await readDir(entry.path);
                setChildren(_children);
            }
            setExpanded(!expanded);
        } else {
            const content = await readFile(entry.path);
            openFile(entry.path, content);
        }
    };
    const getExtColor = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts': case 'tsx': case 'js': case 'jsx': return 'var(--accent)';
            case 'json': return 'var(--warn)';
            case 'css': case 'scss': return '#6b40bf';
            case 'py': return 'var(--green)';
            case 'html': return 'var(--error)';
            default: return 'var(--text-muted)';
        }
    };
    return (
        <div>
            <div
                onClick={handleClick}
                style={{
                    padding: `4px 16px 4px ${16 + level * 12}px`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    background: isActive ? 'var(--accent-light)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    fontWeight: entry.isDirectory ? 500 : 400,
                    userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                }}
                onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
            >
                {entry.isDirectory ? (
                    <span style={{ fontSize: 10, opacity: 0.6, width: 12 }}>{expanded ? '▾' : '▸'}</span>
                ) : (
                    <div style={{ width: 12, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: getExtColor(entry.name) }} />
                    </div>
                )}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
            </div>
            {expanded && entry.isDirectory && (
                <div>
                    {children.map(child => (
                        <FileTreeItem key={child.path} entry={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}
```

## src\renderer\components\layout\AgentManager.tsx
```typescript
import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { useSwarmStore, AgentNode } from '../../store/swarms';
import { getModelTags } from '../../utils/tags';
export function AgentManager({ onClose }: { onClose: () => void }) {
    const localModels = useOllamaStore(state => state.models);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const addSwarm = useSwarmStore(state => state.addSwarm);
    const [swarmName, setSwarmName] = useState('My Custom Swarm');
    const [agents, setAgents] = useState<AgentNode[]>([
        { id: 1, role: 'Architect', model: 'gemini-1.5-flash' }
    ]);
    const cloudRoster = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'claude' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq' }
    ];
    const availableCloudModels = cloudRoster.filter(m => !!apiKeys[m.provider as keyof typeof apiKeys]);
    const addAgent = () => {
        setAgents([...agents, { id: Date.now(), role: 'Coder', model: localModels.length > 0 ? localModels[0] : 'gemini-1.5-flash' }]);
    };
    const handleSave = () => {
        const swarmId = `swarm-${Date.now()}`;
        addSwarm({ id: swarmId, name: swarmName, agents });
        useOllamaStore.getState().setSelectedModel(swarmId);
        onClose();
    };
    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <GlassPanel variant="strong" style={{ width: 800, maxHeight: '90vh', overflowY: 'auto', padding: 32, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: 16, marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 20, margin: '0 0 8px 0', color: 'var(--text)' }}>Swarm Canvas</h2>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Design a multi-agent pipeline and save it as a custom model.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
                </div>
                <input value={swarmName} onChange={e => setSwarmName(e.target.value)} style={{ fontSize: 16, padding: '12px 16px', borderRadius: 6, border: '1px solid var(--accent)', background: 'rgba(255,255,255,0.5)', outline: 'none', fontWeight: 600, color: 'var(--accent)', marginBottom: 24 }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
                    {agents.map((agent, index) => (
                        <React.Fragment key={agent.id}>
                            <div style={{ minWidth: 260, background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'relative' }}>
                                {index > 0 && <button onClick={() => setAgents(agents.filter(a => a.id !== agent.id))} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>✕</button>}
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>NODE {index + 1}</div>
                                <select value={agent.role} onChange={(e) => setAgents(agents.map(a => a.id === agent.id ? { ...a, role: e.target.value } : a))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 12 }}>
                                    <option value="Architect">Architect (Planning)</option>
                                    <option value="Coder">Coder (Execution)</option>
                                </select>
                                <select value={agent.model} onChange={(e) => setAgents(agents.map(a => a.id === agent.id ? { ...a, model: e.target.value } : a))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                    <optgroup label="Local Models">{localModels.map(m => <option key={m} value={m}>{m}</option>)}</optgroup>
                                    {availableCloudModels.length > 0 && <optgroup label="Cloud API Models">{availableCloudModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>}
                                </select>
                            </div>
                            {index < agents.length - 1 && <div style={{ color: 'var(--accent)', fontSize: 24 }}>→</div>}
                        </React.Fragment>
                    ))}
                    <button onClick={addAgent} style={{ minWidth: 150, height: 120, border: '2px dashed var(--border)', borderRadius: 12, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>+ Add Node</button>
                </div>
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Save Swarm Pipeline</button>
                </div>
            </GlassPanel>
        </div>
    );
}
```

## src\renderer\components\layout\ChatBar.tsx
```typescript
import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { ModelSelector } from '../ai/ModelSelector';
import { useSettingsStore } from '../../store/settings';
import { useWorkspaceStore } from '../../store/workspaces';
import { useSwarmStore } from '../../store/swarms';
import { useUIStore } from '../../store/ui';
import { useTerminalStore } from '../../store/terminal';
import { streamBus } from '../../utils/streamBus';
import { cleanTerminalOutput } from '../../utils/terminal';
import type { ChatMessage } from '../../../shared/types';
import { getModelTags } from '../../utils/tags';

export function ChatBar() {
    const [input, setInput] = useState('');
    const [showModelSelector, setShowModelSelector] = useState(false);
    const selectedModel = useOllamaStore(state => state.selectedModel);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const connected = useOllamaStore(state => state.connected);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const { activeWorkspacePath, activeThreadId, saveMessagesToThread, workspaces } = useWorkspaceStore();
    const swarms = useSwarmStore(state => state.swarms);
    const ollamaConnected = useUIStore(state => state.ollamaConnected);
    const setOllamaConnected = useUIStore(state => state.setOllamaConnected);
    const vibeInstructions = useUIStore(state => state.vibeInstructions);

    React.useEffect(() => {
        let cancelled = false;
        const ping = async () => {
            try {
                const alive = await window.vibe.statusOllama();
                if (!cancelled) setOllamaConnected(!!alive);
            } catch {
                if (!cancelled) setOllamaConnected(false);
            }
        };
        ping();
        const interval = setInterval(ping, 5000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    const getThreadMessages = () => {
        const w = workspaces.find(w => w.path === activeWorkspacePath);
        return w?.threads.find(t => t.id === activeThreadId)?.messages || [];
    };

    const handleStop = () => {
        window.vibe.stopGeneration();
        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    };

    const handleSend = async () => {
        if (!input.trim() || isGenerating || !selectedModel) return;

        let currentWorkspacePath = activeWorkspacePath;
        let currentThreadId = activeThreadId;
        const projectPath = useUIStore.getState().projectPath;

        if (!currentWorkspacePath && projectPath) {
            useWorkspaceStore.getState().addWorkspace(projectPath);
            useWorkspaceStore.getState().setActiveWorkspace(projectPath);
            currentWorkspacePath = projectPath;
        }
        if (currentWorkspacePath && !currentThreadId) {
            currentThreadId = useWorkspaceStore.getState().createThread(currentWorkspacePath, 'Chat');
        }

        const currentMessages = getThreadMessages();
        const userMsg: ChatMessage = { role: 'user', content: input.trim() };
        const msgsWithUser = [...currentMessages, userMsg];

        if (currentWorkspacePath && currentThreadId) {
            saveMessagesToThread(currentWorkspacePath, currentThreadId, msgsWithUser);
        }

        setInput('');
        useOllamaStore.getState().addMessage({ role: 'user', content: userMsg.content });

        const projectPathEscaped = projectPath ? projectPath.replace(/\\/g, '\\\\') : null;
        const agentSystemPrompt = `You are VIBE, an autonomous Agentic IDE assistant running on Windows with PowerShell.

TOOLS — use these XML tags exactly, never wrap them in markdown code blocks:

1. Read a file (ALWAYS do this before editing an existing file):
<read_file path="relative/path/to/file.ext"/>

2. Write or create a file:
<write_file path="relative/path/to/file.ext">
complete file contents here — never use placeholders
</write_file>

3. Run a terminal command:
<execute>powershell command here</execute>

4. Signal task complete:
<done>Brief summary of what was accomplished</done>

RULES:${projectPathEscaped ? `\nPROJECT PATH: ${projectPath}\nALWAYS start your first command by cd-ing to the project: cd "${projectPath}"` : ''}
1. Always <read_file> before editing an existing file. Never guess file contents.
2. Only use tools when the task requires it. NEVER run exploratory commands like dir, ls, tree, Get-ChildItem unless the user explicitly asks.
3. PowerShell syntax ONLY. Use semicolons not &&. Use Remove-Item not rm. Use New-Item -ItemType Directory -Force not mkdir -p.
4. Write COMPLETE files — never partial code, never "// rest of file here".
5. When your task is fully complete, respond with <done>summary</done>.
6. If a command fails, read the error and try a different approach.
7. NEVER use <done> before you have received and read the terminal output from your command. After every <execute>, you will receive the output — wait for it and use it in your response.
8. After running an exploratory command (like dir or Get-ChildItem), always summarize what you found in plain text for the user BEFORE using <done>.
9. Use 'dir' for simple directory listings. Only use Get-ChildItem if you need specific filtering.
10. Never run the same command twice in a row.
11. Always cd to the project directory before running any file-related commands.
12. Never run commands from the home directory or unknown working directory.${vibeInstructions ? `\n\nPROJECT INSTRUCTIONS (from VIBE.md):\n${vibeInstructions}` : ''}`;

        const msgsForApi: ChatMessage[] = [
            { role: 'system', content: agentSystemPrompt },
            ...msgsWithUser
        ];

        const isSwarm = selectedModel?.startsWith('swarm-');
        if (isSwarm) {
            const swarm = swarms.find(s => s.id === selectedModel);
            if (swarm) {
                await runSwarm(swarm, userMsg.content);
                return;
            }
        }

        await runAgentLoop(msgsForApi, 0);
    };

    const waitForStreamDone = (): Promise<string> => {
        return new Promise((resolve) => {
            let fullContent = '';
            const unsub = streamBus.subscribe((chunk) => {
                if (chunk.content) fullContent += chunk.content;
                if (chunk.done) {
                    unsub();
                    resolve(fullContent);
                }
            });
        });
    };

    const MAX_LOOP = 6;

    const runAgentLoop = async (messages: ChatMessage[], iteration: number) => {
        if (iteration >= MAX_LOOP) {
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        useOllamaStore.getState().setIsGenerating(true);
        useOllamaStore.getState().setAgentStep(iteration, MAX_LOOP);
        useOllamaStore.getState().setAgentStatus(
            iteration === 0 ? 'Thinking…' : `Working on step ${iteration}/${MAX_LOOP}…`
        );

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, messages, apiKeys);
            await waitForStreamDone();
        } catch (e) {
            console.error('Chat error:', e);
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        const lastContent = useOllamaStore.getState().messages.at(-1)?.content || '';

        // read_file handling
        const readFileMatch = lastContent.match(/<read_file\s+path=['"]([^'"]+)['"]\s*\/?>/);
        if (readFileMatch) {
            const filePath = readFileMatch[1];
            useOllamaStore.getState().setAgentStatus(`Reading file: ${filePath}`);
            const projectPath = useUIStore.getState().projectPath;
            let fileResult = '';
            try {
                const contents = await window.vibe.readFile(projectPath ? `${projectPath}/${filePath}` : filePath);
                fileResult = `__FILE_CONTENTS__ ${filePath}\n${contents}`;
            } catch {
                fileResult = `__FILE_CONTENTS__ ${filePath}\nERROR: File not found.`;
            }
            useOllamaStore.getState().addMessage({ role: 'user', content: fileResult });
            await runAgentLoop([
                ...messages,
                { role: 'assistant', content: lastContent },
                { role: 'user', content: fileResult }
            ], iteration + 1);
            return;
        }

        const hasDone = /<done>[\s\S]*?<\/done>/.test(lastContent);
        if (hasDone) {
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        const hasExecute = /<execute>[\s\S]*?<\/execute>/.test(lastContent);
        if (hasExecute) {
            if (iteration === 0) {
                const projectPath = useUIStore.getState().projectPath;
                if (projectPath && !lastContent.includes('cd ')) {
                    const termId = useTerminalStore.getState().activeTerminalId;
                    if (termId) {
                        window.vibe.sendTerminalInput(termId, `cd "${projectPath}"\r`);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }

            useOllamaStore.getState().setAgentStatus('Waiting for terminal output…');
            await new Promise(r => setTimeout(r, 4000));

            const termId = useTerminalStore.getState().activeTerminalId;
            if (termId) {
                let rawOutput = await window.vibe.getTerminalOutput(termId);
                if (!rawOutput || rawOutput.trim().length < 5) {
                    await new Promise(r => setTimeout(r, 3000));
                    rawOutput = await window.vibe.getTerminalOutput(termId);
                }
                await window.vibe.clearTerminalOutput(termId);
                const cleaned = cleanTerminalOutput(rawOutput);

                if (cleaned && cleaned.length > 2) {
                    useOllamaStore.getState().setAgentStatus('Analyzing output…');
                    const terminalMsg = `__TERMINAL_OUTPUT__\n${cleaned}`;
                    useOllamaStore.getState().addMessage({ role: 'user', content: terminalMsg });
                    const feedbackMsg: ChatMessage = {
                        role: 'user',
                        content: `Terminal output:\n\`\`\`\n${cleaned.slice(-2000)}\n\`\`\`\n\nAnalyze this output and respond to the user's original request. Summarize what you found in plain language. Do NOT run the same command again. If complete, write your summary then end with <done>summary</done>.`
                    };
                    await runAgentLoop([
                        ...messages,
                        { role: 'assistant', content: lastContent },
                        feedbackMsg
                    ], iteration + 1);
                    return;
                } else {
                    useOllamaStore.getState().setAgentStatus('Command produced no output, retrying…');
                    const emptyMsg: ChatMessage = {
                        role: 'user',
                        content: `The command ran but produced no output. Try a simpler command (e.g. use 'dir' instead of 'Get-ChildItem -Recurse') or respond with what you know.`
                    };
                    await runAgentLoop([
                        ...messages,
                        { role: 'assistant', content: lastContent },
                        emptyMsg
                    ], iteration + 1);
                    return;
                }
            }
        }

        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    };

    const runSwarm = async (swarm, userInput) => {
        useOllamaStore.getState().setIsGenerating(true);
        let context = userInput;

        for (const agent of swarm.agents) {
            const label = `[${agent.role} — ${agent.model}]`;
            useOllamaStore.getState().addMessage({ role: 'user', content: `__SWARM_LABEL__${label}` });

            const sysPrompt = agent.role === 'Architect'
                ? `You are the Architect agent. Analyze the request and produce a detailed numbered execution plan. Be specific about file names, commands, and logic. Output only the plan.`
                : `You are the Coder agent. Execute this plan using VIBE tools:\n<read_file path="file"/> to read files before editing, <write_file path="file">content</write_file> to write complete files, <execute>powershell command</execute> to run commands. Windows PowerShell only. Write complete files, no placeholders. Use <done>summary</done> when finished.`;

            const msgs: ChatMessage[] = [
                { role: 'system', content: sysPrompt },
                { role: 'user', content: context }
            ];

            useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });
            await window.vibe.chat(agent.model, msgs, apiKeys);
            await waitForStreamDone();
            const lastMsg = useOllamaStore.getState().messages[useOllamaStore.getState().messages.length - 1];
            context = lastMsg?.content || context;
        }

        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
    };

    return (
        <div style={{ position: 'relative', padding: '12px 16px', borderTop: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.02)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {showModelSelector && <ModelSelector onClose={() => setShowModelSelector(false)} />}
            <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (isGenerating) handleStop();
                        else handleSend();
                    }
                }}
                placeholder={isGenerating ? 'Agent is working… (press Enter or ■ to stop)' : 'Ask the agent to build…'}
                rows={2}
                style={{
                    width: '100%',
                    background: '#fff',
                    border: `1px solid ${isGenerating ? 'var(--warn)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: 'var(--text)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    resize: 'none',
                    transition: 'border-color 0.2s',
                }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: '6px 10px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--error)' }} />
                    {(() => {
                        if (selectedModel?.startsWith('swarm-')) {
                            const swarm = swarms.find(s => s.id === selectedModel);
                            return (
                                <>
                                    <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent)' }}>{swarm?.name || 'Swarm'}</span>
                                    <span style={{ fontSize: 8, padding: '2px 4px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)' }}>SWARM</span>
                                </>
                            );
                        }
                        if (selectedModel?.startsWith('hf:')) {
                            return (
                                <>
                                    <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ff6e00' }}>{selectedModel.replace('hf:', '')}</span>
                                    <span style={{ fontSize: 8, padding: '2px 4px', borderRadius: 3, background: 'rgba(255,110,0,0.1)', color: '#ff6e00' }}>HF</span>
                                </>
                            );
                        }
                        return (
                            <>
                                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedModel || 'Select Model'}</span>
                                {selectedModel && getModelTags(selectedModel).slice(0, 1).map(tag => (
                                    <span key={tag.label} style={{ fontSize: 8, padding: '2px 4px', borderRadius: 3, background: tag.bg, color: tag.color }}>{tag.label}</span>
                                ))}
                            </>
                        );
                    })()}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: ollamaConnected ? 'var(--green)' : '#ccc', display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ollamaConnected ? 'Ollama' : 'No Ollama'}</span>
                    </div>

                    <button
                        onClick={isGenerating ? handleStop : handleSend}
                        disabled={!isGenerating && (!input.trim() || !selectedModel)}
                        style={{
                            background: isGenerating ? 'transparent' : 'var(--accent-gradient)',
                            border: isGenerating ? '2px solid var(--error)' : 'none',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            color: isGenerating ? 'var(--error)' : '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: (!isGenerating && (!input.trim() || !selectedModel)) ? 'not-allowed' : 'pointer',
                            opacity: (!isGenerating && (!input.trim() || !selectedModel)) ? 0.4 : 1,
                            fontSize: isGenerating ? 13 : 16,
                            transition: 'all 0.15s',
                            flexShrink: 0,
                        }}
                    >
                        {isGenerating ? '■' : '↑'}
                    </button>
                </div>
            </div>
        </div>
    );
}
```

## src\renderer\components\layout\MainArea.tsx
```typescript
import React from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { EditorTabs } from '../editor/EditorTabs';
import { MonacoEditor } from '../editor/MonacoEditor';
import { ChatMessages } from '../ai/ChatMessages';
import { ChatBar } from './ChatBar';
export function MainArea() {
    return (
        <div style={{ flex: 1, display: 'flex', gap: 'var(--gap)', overflow: 'hidden' }}>
            <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <EditorTabs />
                <div style={{ flex: 1, position: 'relative' }}>
                    <MonacoEditor />
                </div>
            </GlassPanel>
            <GlassPanel style={{ width: 'var(--right-pane-width)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
                    Agent Chat
                </div>
                <ChatMessages />
                <ChatBar /> {}
            </GlassPanel>
        </div>
    );
}
```

## src\renderer\components\layout\MenuBar.tsx
```typescript
import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';
import { useOllamaStore } from '../../store/ollama';
interface MenuItem {
    label: string;
    shortcut?: string;
    action?: () => void;
    divider?: boolean;
    disabled?: boolean;
}
interface Menu {
    label: string;
    items: MenuItem[];
}
export function MenuBar() {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const projectPath = useUIStore(state => state.projectPath);
    const setProjectPath = useUIStore(state => state.setProjectPath);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const fileContents = useEditorStore(state => state.fileContents);
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);
    const handleOpenFolder = async () => {
        const p = await window.vibe.openFolder();
        if (p) setProjectPath(p);
        setOpenMenu(null);
    };
    const handleSaveFile = async () => {
        if (activeFileId && fileContents[activeFileId] !== undefined) {
            await window.vibe.writeFile(activeFileId, fileContents[activeFileId]);
        }
        setOpenMenu(null);
    };
    const handleNewFile = async () => {
        if (!projectPath) return;
        const name = prompt('Enter file name:');
        if (name) {
            await window.vibe.writeFile(`${projectPath}/${name}`, '');
            const content = '';
            useEditorStore.getState().openFile(`${projectPath}/${name}`, content);
        }
        setOpenMenu(null);
    };
    const menus: Menu[] = [
        {
            label: 'File',
            items: [
                { label: 'New File', shortcut: 'Ctrl+N', action: handleNewFile },
                { label: 'Open Folder', shortcut: 'Ctrl+O', action: handleOpenFolder },
                { divider: true, label: '' },
                { label: 'Save', shortcut: 'Ctrl+S', action: handleSaveFile, disabled: !activeFileId },
                { divider: true, label: '' },
                { label: 'Exit', shortcut: 'Alt+F4', action: () => window.vibe.closeWindow() },
            ]
        },
        {
            label: 'Edit',
            items: [
                { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
                { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
                { divider: true, label: '' },
                { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
                { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
                { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
                { divider: true, label: '' },
                { label: 'Find', shortcut: 'Ctrl+F', action: () => {  setOpenMenu(null); } },
            ]
        },
        {
            label: 'View',
            items: [
                { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => {
                    const store = useUIStore.getState();
                    store.setSidebarWidth(store.sidebarWidth === 0 ? 210 : 0);
                    setOpenMenu(null);
                }},
                { label: 'Toggle Terminal', shortcut: 'Ctrl+`', action: () => {
                    const store = useUIStore.getState();
                    store.setTerminalHeight(store.terminalHeight === 0 ? 140 : 0);
                    setOpenMenu(null);
                }},
                { divider: true, label: '' },
                { label: 'Zoom In', shortcut: 'Ctrl++', action: () => { document.body.style.zoom = String(parseFloat(document.body.style.zoom || '1') + 0.1); setOpenMenu(null); }},
                { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => { document.body.style.zoom = String(parseFloat(document.body.style.zoom || '1') - 0.1); setOpenMenu(null); }},
                { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => { document.body.style.zoom = '1'; setOpenMenu(null); }},
            ]
        },
        {
            label: 'Terminal',
            items: [
                { label: 'New Terminal', action: () => {
                    window.vibe.createTerminal(projectPath || undefined);
                    setOpenMenu(null);
                }},
                { label: 'Clear Terminal', action: () => {
                    const termId = (window as any).__activeTermId;
                    if (termId) window.vibe.sendTerminalInput(termId, 'cls\r');
                    setOpenMenu(null);
                }},
            ]
        },
        {
            label: 'Help',
            items: [
                { label: 'About VIBE', action: () => { alert('VIBE IDE v0.1.0\nAgent-first IDE by Muhammad Saeed'); setOpenMenu(null); }},
                { label: 'Clear Chat History', action: () => { useOllamaStore.getState().clearMessages(); setOpenMenu(null); }},
            ]
        },
    ];
    return (
        <div ref={menuRef} data-clickable style={{
            display: 'flex',
            alignItems: 'center',
            height: 28,
            padding: '0 8px',
            gap: 0,
            fontSize: 12,
            color: 'var(--text-secondary)',
            background: 'rgba(0,0,0,0.02)',
            borderBottom: '1px solid var(--border-light)',
            flexShrink: 0,
            fontFamily: 'var(--font-sans)',
            position: 'relative',
            zIndex: 50,
        }}>
            {menus.map(menu => (
                <div key={menu.label} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
                        onMouseEnter={() => { if (openMenu) setOpenMenu(menu.label); }}
                        style={{
                            background: openMenu === menu.label ? 'var(--accent-light)' : 'transparent',
                            border: 'none',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: openMenu === menu.label ? 'var(--accent)' : 'var(--text-secondary)',
                            borderRadius: 4,
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 500,
                        }}
                    >
                        {menu.label}
                    </button>
                    {openMenu === menu.label && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            minWidth: 220,
                            background: '#fff',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            padding: '4px 0',
                            zIndex: 100,
                        }}>
                            {menu.items.map((item, i) => {
                                if (item.divider) return <div key={i} style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => { if (!item.disabled && item.action) item.action(); }}
                                        disabled={item.disabled}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            width: '100%',
                                            padding: '6px 16px',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: item.disabled ? 'default' : 'pointer',
                                            fontSize: 12,
                                            color: item.disabled ? 'var(--text-faint)' : 'var(--text)',
                                            textAlign: 'left',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                        onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--accent-light)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span>{item.label}</span>
                                        {item.shortcut && <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{item.shortcut}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

## src\renderer\components\layout\SettingsModal.tsx
```typescript
import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useSettingsStore } from '../../store/settings';

export function SettingsModal({ onClose }: { onClose: () => void }) {
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const setApiKey = useSettingsStore(state => state.setApiKey);
    const [saved, setSaved] = useState(false);

    const handleSaveAndClose = () => {
        setSaved(true);
        setTimeout(() => onClose(), 400); // Visual delay
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <GlassPanel variant="strong" style={{ width: 500, maxHeight: '80vh', overflowY: 'auto', padding: 24, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
                    <h2 style={{ fontSize: 18, margin: 0, color: 'var(--text)' }}>IDE Settings</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h3 style={{ fontSize: 14, color: 'var(--text)', margin: 0, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>Cloud API Keys</h3>
                    {['gemini', 'claude', 'openai', 'deepseek', 'groq', 'hf'].map(provider => (
                        <div key={provider}>
                            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>
                                {provider === 'hf' ? 'HuggingFace' : provider} API Key
                            </label>
                            <input
                                type="password"
                                value={apiKeys[provider as keyof typeof apiKeys] || ''}
                                onChange={(e) => setApiKey(provider, e.target.value)}
                                placeholder={provider === 'hf' ? 'Enter HuggingFace token (hf_...)' : `Enter ${provider} key (autosaves)...`}
                                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', outline: 'none' }}
                            />
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10, alignItems: 'center' }}>
                    {saved && <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>Keys Saved! ✓</span>}
                    <button onClick={handleSaveAndClose} style={{ padding: '8px 24px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}>Save & Close</button>
                </div>
            </GlassPanel>
        </div>
    );
}
```

## src\renderer\components\layout\Sidebar.tsx
```typescript
import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';
import { useOllamaStore } from '../../store/ollama';
import { FileTree } from '../filetree/FileTree';
import { SettingsModal } from './SettingsModal';
const toolbarBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 4px',
    borderRadius: 4,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};
export function Sidebar() {
    const sidebarWidth = useUIStore(state => state.sidebarWidth);
    const connected = useOllamaStore(state => state.connected);
    const [showSettings, setShowSettings] = useState(false);
    const projectPath = useUIStore(state => state.projectPath);
    const [refreshKey, setRefreshKey] = useState(0);
    const handleNewFile = async () => {
        if (!projectPath) return;
        const name = prompt('Enter file name:');
        if (name) {
            await window.vibe.writeFile(`${projectPath}/${name}`, '');
            setRefreshKey(k => k + 1);
        }
    };
    const handleNewFolder = async () => {
        if (!projectPath) return;
        const name = prompt('Enter folder name:');
        if (name) {
            await window.vibe.writeFile(`${projectPath}/${name}/.gitkeep`, '');
            setRefreshKey(k => k + 1);
        }
    };
    const handleRefresh = () => {
        setRefreshKey(k => k + 1);
    };
    const handleCollapseAll = () => {
        setRefreshKey(k => k + 1);
    };
    return (
        <GlassPanel style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 600 }}>Explorer</span>
                <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => handleNewFile()} title="New File" style={toolbarBtnStyle}>📄</button>
                    <button onClick={() => handleNewFolder()} title="New Folder" style={toolbarBtnStyle}>📁</button>
                    <button onClick={() => handleRefresh()} title="Refresh Explorer" style={toolbarBtnStyle}>🔄</button>
                    <button onClick={() => handleCollapseAll()} title="Collapse All" style={toolbarBtnStyle}>⊟</button>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <FileTree key={refreshKey} />
            </div>
            <div style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--error)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Ollama {connected ? 'Connected' : 'Disconnected'}</span>
                </div>
                <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }} title="IDE Settings">⚙</button>
            </div>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </GlassPanel>
    );
}
```

## src\renderer\components\layout\TitleBar.tsx
```typescript
import React, { useEffect, useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';
export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);
    const projectPath = useUIStore(state => state.projectPath);
    const projectName = projectPath ? projectPath.split(/[/\\]/).pop() : 'No Folder Opened';
    useEffect(() => {
        if (window.vibe?.onWindowMaximized) {
            window.vibe.onWindowMaximized((max: boolean) => setIsMaximized(max));
        }
    }, []);
    const handleMinimize = () => window.vibe?.minimizeWindow();
    const handleMaximize = () => window.vibe?.maximizeWindow();
    const handleClose = () => window.vibe?.closeWindow();
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    return (
        <GlassPanel variant="strong" className="titlebar-drag" style={{
            height: 'var(--titlebar-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0,
            borderRadius: 0,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            marginBottom: 'var(--gap)',
        }}>
            <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '15px',
                letterSpacing: '3px',
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginLeft: isMac ? '70px' : '0'
            }}>
                VIBE
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {projectName}
            </div>
            {!isMac ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button data-clickable onClick={handleMinimize} style={btnStyle}>_</button>
                    <button data-clickable onClick={handleMaximize} style={btnStyle}>□</button>
                    <button data-clickable onClick={handleClose} style={{ ...btnStyle, color: 'var(--error)' }}>✕</button>
                </div>
            ) : <div style={{ width: 70 }}></div>}
        </GlassPanel>
    );
}
const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '14px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
};
```

## src\renderer\components\terminal\TerminalPane.tsx
```typescript
import React, { useEffect, useRef } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore } from '../../store/terminal';
export function TerminalPane() {
    const terminalHeight = useUIStore(state => state.terminalHeight);
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const termIdRef = useRef<string | null>(null);
    useEffect(() => {
        if (!containerRef.current) return;
        const terminal = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.4,
            theme: {
                background: '#1a1a2e',
                foreground: '#e2e2ef',
                cursor: '#00d4aa',
                cursorAccent: '#1a1a2e',
                selectionBackground: 'rgba(0, 212, 170, 0.2)',
                selectionForeground: '#ffffff',
                black: '#1a1a2e',
                red: '#ff4466',
                green: '#00d4aa',
                yellow: '#ffaa33',
                blue: '#4488ff',
                magenta: '#aa66ff',
                cyan: '#00aaff',
                white: '#e2e2ef',
                brightBlack: '#4a4a68',
                brightRed: '#ff6688',
                brightGreen: '#33e0bb',
                brightYellow: '#ffcc66',
                brightBlue: '#66aaff',
                brightMagenta: '#cc88ff',
                brightCyan: '#33ccff',
                brightWhite: '#ffffff',
            }
        });
        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);
        terminal.open(containerRef.current);
        fitAddon.fit();
        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;
        let mounted = true;
        window.vibe.createTerminal(useUIStore.getState().projectPath || undefined).then((id: string) => {
            if (!mounted) return;
            termIdRef.current = id;
            useTerminalStore.getState().addSession({ id, title: 'Bash' });
            window.vibe.onTerminalData((incomingId: string, data: string) => {
                if (incomingId === id) terminal.write(data);
            });
            terminal.onData((data) => window.vibe.sendTerminalInput(id, data));
            fitAddon.fit();
            window.vibe.resizeTerminal(id, terminal.cols, terminal.rows);
        });
        const resizeObserver = new ResizeObserver(() => {
            if (fitAddonRef.current && terminalRef.current && termIdRef.current) {
                fitAddonRef.current.fit();
                window.vibe.resizeTerminal(termIdRef.current, terminalRef.current.cols, terminalRef.current.rows);
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => {
            mounted = false;
            resizeObserver.disconnect();
            if (termIdRef.current) {
                window.vibe.killTerminal(termIdRef.current);
            }
            terminal.dispose();
        };
    }, []);
    return (
        <GlassPanel style={{ height: terminalHeight, padding: 8, overflow: 'hidden', flexShrink: 0 }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: '#1a1a2e'
                }}
            />
        </GlassPanel>
    );
}
```

## src\renderer\hooks\useFileSystem.ts
```typescript
import { useCallback } from 'react';
import type { FileEntry } from '../../shared/types';
export function useFileSystem() {
    const openFolder = useCallback(async (): Promise<string | null> => {
        return window.vibe.openFolder();
    }, []);
    const readDir = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
        return window.vibe.readDir(dirPath);
    }, []);
    const readFile = useCallback(async (filePath: string): Promise<string> => {
        return window.vibe.readFile(filePath);
    }, []);
    const writeFile = useCallback(async (filePath: string, content: string): Promise<boolean> => {
        return window.vibe.writeFile(filePath, content);
    }, []);
    return { openFolder, readDir, readFile, writeFile };
}
```

## src\renderer\hooks\useOllama.ts
```typescript
import { useCallback } from 'react';
import type { OllamaModel, ChatMessage } from '../../shared/types';
export function useOllama() {
    const detectOllama = useCallback(async (): Promise<{ detected: boolean; version?: string }> => {
        return window.vibe.detectOllama();
    }, []);
    const listModels = useCallback(async (): Promise<OllamaModel[]> => {
        return window.vibe.listModels();
    }, []);
    const chat = useCallback(async (model: string, messages: ChatMessage[]) => {
        return window.vibe.chat(model, messages);
    }, []);
    const onStream = useCallback((callback: (chunk: { content: string; done: boolean }) => void) => {
        window.vibe.onChatStream(callback);
    }, []);
    const stopGeneration = useCallback(() => {
        window.vibe.stopGeneration();
    }, []);
    return { detectOllama, listModels, chat, onStream, stopGeneration };
}
```

## src\renderer\hooks\useTerminal.ts
```typescript
import { useCallback } from 'react';
export function useTerminal() {
    const createTerminal = useCallback(async (cwd?: string): Promise<string> => {
        return window.vibe.createTerminal(cwd);
    }, []);
    const sendInput = useCallback((id: string, data: string) => {
        window.vibe.sendTerminalInput(id, data);
    }, []);
    const resizeTerminal = useCallback((id: string, cols: number, rows: number) => {
        window.vibe.resizeTerminal(id, cols, rows);
    }, []);
    const onData = useCallback((callback: (id: string, data: string) => void) => {
        window.vibe.onTerminalData(callback);
    }, []);
    const killTerminal = useCallback((id: string) => {
        window.vibe.killTerminal(id);
    }, []);
    return { createTerminal, sendInput, resizeTerminal, onData, killTerminal };
}
```

## src\renderer\main.tsx
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
```

## src\renderer\store\editor.ts
```typescript
import { create } from 'zustand';
interface EditorState {
    openFiles: string[];
    activeFileId: string | null;
    fileContents: Record<string, string>;
    openFile: (path: string, content: string) => void;
    closeFile: (path: string) => void;
    setActiveFile: (path: string) => void;
    updateContent: (path: string, content: string) => void;
}
export const useEditorStore = create<EditorState>((set) => ({
    openFiles: [],
    activeFileId: null,
    fileContents: {},
    openFile: (path, content) => set((state) => {
        if (state.openFiles.includes(path)) {
            return { activeFileId: path };
        }
        return {
            openFiles: [...state.openFiles, path],
            activeFileId: path,
            fileContents: { ...state.fileContents, [path]: content }
        };
    }),
    closeFile: (path) => set((state) => {
        const newOpenFiles = state.openFiles.filter(p => p !== path);
        const newContents = { ...state.fileContents };
        delete newContents[path];
        let newActive = state.activeFileId;
        if (newActive === path) {
            newActive = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
        }
        return {
            openFiles: newOpenFiles,
            activeFileId: newActive,
            fileContents: newContents
        };
    }),
    setActiveFile: (path) => set({ activeFileId: path }),
    updateContent: (path, content) => set((state) => ({
        fileContents: { ...state.fileContents, [path]: content }
    }))
}));
```

## src\renderer\store\ollama.ts
```typescript
import { create } from 'zustand';
import type { ChatMessage, ModelCapability } from '../../shared/types';
import { getCapabilities } from '../utils/capabilities';

interface OllamaState {
    connected: boolean;
    version: string | null;
    models: string[];
    modelCapabilities: Record<string, ModelCapability>;
    selectedModel: string;
    messages: ChatMessage[];
    isGenerating: boolean;
    agentStep: number;
    agentMaxSteps: number;
    agentStatus: string;
    setConnectionState: (connected: boolean, version: string | null) => void;
    setModels: (models: string[]) => void;
    setModelCapability: (modelId: string, caps: ModelCapability) => void;
    setSelectedModel: (modelName: string) => void;
    addMessage: (msg: ChatMessage) => void;
    updateLastMessage: (content: string) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    setAgentStatus: (status: string) => void;
    setAgentStep: (step: number, max: number) => void;
    clearMessages: () => void;
}

export const useOllamaStore = create<OllamaState>((set) => ({
    connected: false,
    version: null,
    models: [],
    modelCapabilities: {},
    selectedModel: '',
    messages: [],
    isGenerating: false,
    agentStep: 0,
    agentMaxSteps: 0,
    agentStatus: '',
    setConnectionState: (connected, version) => set({ connected, version }),
    setModels: (models) => set((state) => {
        const capsMap: Record<string, ModelCapability> = {};
        models.forEach(m => {
            capsMap[m] = getCapabilities(m);
        });
        return {
            models,
            modelCapabilities: { ...state.modelCapabilities, ...capsMap },
            connected: models.length > 0 ? true : state.connected,
            selectedModel: state.selectedModel || (models.length > 0 ? models[0] : '')
        };
    }),
    setModelCapability: (modelId, caps) => set(state => ({
        modelCapabilities: { ...state.modelCapabilities, [modelId]: caps }
    })),
    setSelectedModel: (selectedModel) => set({ selectedModel }),
    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),
    updateLastMessage: (content) => set((state) => {
        const newMessages = [...state.messages];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1].content += content;
        }
        return { messages: newMessages };
    }),
    setIsGenerating: (isGenerating) => set({ isGenerating }),
    setAgentStatus: (agentStatus) => set({ agentStatus }),
    setAgentStep: (agentStep, agentMaxSteps) => set({ agentStep, agentMaxSteps }),
    clearMessages: () => set({ messages: [] })
}));
```

## src\renderer\store\settings.ts
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
interface SettingsState {
    apiKeys: Record<string, string>;
    setApiKey: (provider: string, key: string) => void;
}
export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKeys: { gemini: '', claude: '', openai: '', deepseek: '', groq: '' },
            setApiKey: (provider, key) => set((state) => ({ apiKeys: { ...state.apiKeys, [provider]: key } })),
        }),
        { name: 'vibe-settings' }
    )
);
```

## src\renderer\store\swarms.ts
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export interface AgentNode {
    id: number;
    role: string;
    model: string;
}
export interface SwarmConfig {
    id: string;
    name: string;
    agents: AgentNode[];
}
interface SwarmState {
    swarms: SwarmConfig[];
    addSwarm: (swarm: SwarmConfig) => void;
    removeSwarm: (id: string) => void;
}
export const useSwarmStore = create<SwarmState>()(
    persist(
        (set) => ({
            swarms: [],
            addSwarm: (swarm) => set((state) => ({ swarms: [...state.swarms, swarm] })),
            removeSwarm: (id) => set((state) => ({ swarms: state.swarms.filter(s => s.id !== id) }))
        }),
        { name: 'vibe-swarms-storage' }
    )
);
```

## src\renderer\store\terminal.ts
```typescript
import { create } from 'zustand';
import type { TerminalSession } from '../../shared/types';
interface TerminalState {
    sessions: TerminalSession[];
    activeTerminalId: string | null;
    addSession: (session: TerminalSession) => void;
    removeSession: (id: string) => void;
    setActiveSession: (id: string) => void;
}
export const useTerminalStore = create<TerminalState>((set) => ({
    sessions: [],
    activeTerminalId: null,
    addSession: (session) => set((state) => ({
        sessions: [...state.sessions, session],
        activeTerminalId: session.id
    })),
    removeSession: (id) => set((state) => {
        const newSessions = state.sessions.filter(s => s.id !== id);
        let newActive = state.activeTerminalId;
        if (newActive === id) {
            newActive = newSessions.length > 0 ? newSessions[newSessions.length - 1].id : null;
        }
        return { sessions: newSessions, activeTerminalId: newActive };
    }),
    setActiveSession: (id) => set({ activeTerminalId: id })
}));
```

## src\renderer\store\ui.ts
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UIState {
    sidebarWidth: number;
    terminalHeight: number;
    showModelPicker: boolean;
    projectPath: string | null;
    ollamaConnected: boolean;
    vibeInstructions: string | null;
    setSidebarWidth: (width: number) => void;
    setTerminalHeight: (height: number) => void;
    setShowModelPicker: (show: boolean) => void;
    setProjectPath: (path: string | null) => void;
    setVibeInstructions: (instructions: string | null) => void;
    setOllamaConnected: (connected: boolean) => void;
    isLoggedIn: boolean;
    setIsLoggedIn: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            sidebarWidth: 210,
            terminalHeight: 140,
            showModelPicker: false,
            projectPath: null,
            vibeInstructions: null,
            ollamaConnected: false,
            setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
            setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
            setShowModelPicker: (showModelPicker) => set({ showModelPicker }),
            setProjectPath: (projectPath) => set({ projectPath }),
            setVibeInstructions: (vibeInstructions) => set({ vibeInstructions }),
            setOllamaConnected: (ollamaConnected) => set({ ollamaConnected }),
            isLoggedIn: false,
            setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn })
        }),
        { 
            name: 'vibe-ui-storage',
            partialize: (state) => {
                const { vibeInstructions, ...rest } = state;
                return rest;
            }
        }
    )
);
```

## src\renderer\store\workspaces.ts
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../../shared/types';
export interface ChatThread { id: string; title: string; messages: ChatMessage[]; updatedAt: number; }
export interface Workspace { path: string; name: string; threads: ChatThread[]; }
interface WorkspaceState {
    workspaces: Workspace[];
    activeWorkspacePath: string | null;
    activeThreadId: string | null;
    addWorkspace: (path: string) => void;
    setActiveWorkspace: (path: string | null) => void;
    createThread: (workspacePath: string, title?: string) => string;
    setActiveThread: (threadId: string | null) => void;
    saveMessagesToThread: (workspacePath: string, threadId: string, messages: ChatMessage[]) => void;
}
export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set) => ({
            workspaces: [],
            activeWorkspacePath: null,
            activeThreadId: null,
            addWorkspace: (path) => set((state) => {
                if (state.workspaces.find(w => w.path === path)) return state;
                const name = path.split(/[/\\]/).pop() || path;
                return { workspaces: [{ path, name, threads: [] }, ...state.workspaces] };
            }),
            setActiveWorkspace: (path) => set({ activeWorkspacePath: path }),
            createThread: (workspacePath, title = 'New conversation') => {
                const id = Math.random().toString(36).substring(7);
                set((state) => ({
                    workspaces: state.workspaces.map(w => w.path === workspacePath
                        ? { ...w, threads: [{ id, title, messages: [], updatedAt: Date.now() }, ...w.threads] }
                        : w
                    ),
                    activeThreadId: id
                }));
                return id;
            },
            setActiveThread: (id) => set({ activeThreadId: id }),
            saveMessagesToThread: (path, id, messages) => set((state) => ({
                workspaces: state.workspaces.map(w => w.path === path
                    ? { ...w, threads: w.threads.map(t => t.id === id ? { ...t, messages, updatedAt: Date.now() } : t) }
                    : w
                )
            }))
        }),
        { name: 'vibe-workspaces' }
    )
);
```

## src\renderer\styles\globals.css
```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
*, *::before, *::after {
margin: 0;
padding: 0;
box-sizing: border-box;
}
:root {
--bg-mesh:
radial-gradient(ellipse at 20% 0%, rgba(0,100,255,0.06) 0%, transparent 50%),
radial-gradient(ellipse at 80% 100%, rgba(0,170,255,0.05) 0%, transparent 50%),
radial-gradient(ellipse at 50% 50%, rgba(255,140,50,0.03) 0%, transparent 60%),
linear-gradient(180deg, #f8f9fc 0%, #f0f1f6 100%);
--glass-bg: rgba(255, 255, 255, 0.72);
--glass-blur: blur(24px);
--glass-border: 1px solid rgba(255, 255, 255, 0.45);
--glass-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8);
--panel-bg: rgba(255, 255, 255, 0.55);
--panel-blur: blur(16px);
--panel-border: 1px solid rgba(255, 255, 255, 0.5);
--panel-shadow: 0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9);
--text: #1a1a2e;
--text-secondary: #4a4a68;
--text-muted: #8888a0;
--text-faint: #aab0c0;
--accent: #0066ff;
--accent-gradient: linear-gradient(135deg, #0055ff, #0088ff, #00aaff);
--accent-light: rgba(0, 102, 255, 0.06);
--accent-medium: rgba(0, 102, 255, 0.12);
--green: #00a870;
--green-light: rgba(0, 168, 112, 0.08);
--warn: #e68a00;
--warn-light: rgba(230, 138, 0, 0.08);
--error: #e03050;
--border: rgba(0, 0, 0, 0.08);
--border-light: rgba(0, 0, 0, 0.04);
--font-sans: 'DM Sans', 'SF Pro Display', system-ui, -apple-system, sans-serif;
--font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--gap: 6px;
--sidebar-width: 210px;
--right-pane-width: 340px;
--terminal-height: 140px;
--titlebar-height: 44px;
--chatbar-height: 56px;
}
body {
font-family: var(--font-sans);
color: var(--text);
background: var(--bg-mesh);
overflow: hidden;
height: 100vh;
-webkit-font-smoothing: antialiased;
}
*::-webkit-scrollbar { width: 5px; height: 5px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }
*::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.18); }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
@keyframes spin { to { transform: rotate(360deg); } }
::selection { background: var(--accent-medium); }
input:focus, textarea:focus { outline: none; border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(0,102,255,0.1) !important; }
.titlebar-drag { -webkit-app-region: drag; }
.titlebar-drag button, .titlebar-drag input, .titlebar-drag [data-clickable] { -webkit-app-region: no-drag; }
```

## src\renderer\utils\capabilities.ts
```typescript
import type { ModelCapability } from '../../shared/types';
export const OLLAMA_ONLY_MODELS = new Set<string>([
    'gpt-oss-120b',
]);
export function getCapabilities(modelId: string): ModelCapability {
 const lower = modelId.toLowerCase();
 const caps: ModelCapability = {};
 if (OLLAMA_ONLY_MODELS.has(lower)) {
 caps.image = true;
 caps.web = true;
 caps.diff = true;
 caps.canExecute = true;
 caps.requiresApproval = false;
 caps.think = true;
 return caps;
 }
 if (lower.includes('gemini')) {
 caps.image = true;
 caps.web = true;
 caps.diff = true;
 caps.canExecute = true;
 caps.requiresApproval = true;
 }
 if (lower.includes('claude')) {
 caps.web = true;
 caps.diff = true;
 caps.canExecute = true;
 caps.requiresApproval = true;
 caps.think = lower.includes('sonnet') || lower.includes('haiku');
 }
 if (lower.includes('gpt-4') || lower.includes('gpt-4o')) {
 caps.image = true;
 caps.web = true;
 caps.diff = true;
 caps.canExecute = true;
 caps.requiresApproval = true;
 }
 if (lower.includes('deepseek')) {
 caps.web = true;
 caps.diff = true;
 caps.canExecute = true;
 caps.requiresApproval = true;
 }
 if (lower.includes('llava') || lower.includes('vision') || lower.includes('llama3.2-vision')) {
 caps.image = true;
 }
 if (lower.includes('coder') || lower.includes('qwen') || lower.includes('deepseek-coder')) {
 caps.canExecute = true;
 }
 if (lower.includes('llama3') || lower.includes('llama-3')) {
 caps.canExecute = true;
 }
 if (Object.keys(caps).length === 0) {
 caps.canExecute = true;
 caps.requiresApproval = true;
 }
 return caps;
}
```

## src\renderer\utils\tags.ts
```typescript
export function getModelTags(modelName: string) {
    const tags: { label: string, color: string, bg: string }[] = [];
    const lower = modelName.toLowerCase();
    if (lower.includes('coder') || lower.includes('code')) {
        tags.push({ label: 'Coding', color: 'var(--accent)', bg: 'var(--accent-light)' });
    }
    if (lower.includes('reasoner') || lower.includes('o1') || lower.includes('r1')) {
        tags.push({ label: 'Thinking', color: 'var(--warn)', bg: 'var(--warn-light)' });
    }
    if (lower.includes('pro') || lower.includes('sonnet') || lower.includes('gpt-4') || lower.includes('v3')) {
        tags.push({ label: 'Research', color: 'var(--green)', bg: 'var(--green-light)' });
    }
    if (tags.length === 0) {
        tags.push({ label: 'General', color: 'var(--text-secondary)', bg: 'rgba(0,0,0,0.05)' });
    }
    return tags;
}
```

## src\shared\types.ts
```typescript
export interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
    extension?: string;
}
export interface TerminalSession {
    id: string;
    title: string;
}
export interface OllamaModel {
    name: string;
    size: number;
    modifiedAt: string;
    details: any;
}
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface ModelCapability {
    image?: boolean;
    web?: boolean;
    diff?: boolean;
    canExecute?: boolean;
    requiresApproval?: boolean;
    think?: boolean;
}
declare global {
    interface Window {
        vibe: any;
    }
}
```

## src\vite-env.d.ts
```typescript

```

