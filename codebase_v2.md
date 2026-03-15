 # Project Codebase V2

## electron-builder.yml

`$lang
appId: com.vibe.ide
productName: VIBE IDE
directories:
  output: release/${version}
files:
  - dist
  - dist-electron
nodeGypRebuild: false
npmRebuild: true
mac:
  target: dmg
  artifactName: ${name}-${version}-mac.${ext}
win:
  target:
    - target: nsis
      arch:
        - x64
  artifactName: ${name}-${version}-setup.${ext}
linux:
  target: AppImage
  artifactName: ${name}-${version}-linux.${ext}

``n
## index.html

`$lang
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>VIBE IDE</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>

``n
## INFO.md

`$lang
# VIBE IDE

**Agent-first integrated development environment.**

Your AI writes the code, runs the terminal, fixes errors. You make the decisions.

---

## What Is VIBE?

VIBE is a standalone Electron desktop application that combines a world-class code editor (Monaco), an integrated terminal, and an autonomous AI agent layer. It is NOT a VS Code fork — it embeds Monaco Editor independently with a custom UI built from scratch.

## Core Differentiators

- **Model Agnostic:** Local models via Ollama (free, offline) + cloud models (Claude, GPT, Gemini) via integrated token proxy. Users never copy API keys.
- **Multi-Domain:** Not just for web devs. Cybersecurity (VM viewer), embedded systems (serial monitor), and general development are first-class citizens.
- **Offline-First:** Full functionality with local models. Cloud is an upgrade, not a requirement.
- **Premium UI:** Glass-morphism design language with mesh gradient backgrounds. Light theme by default. Looks like a product built by a 50-person design team.

## Target Users

1. General software developers (all languages)
2. Cybersecurity professionals (red team, pentesting)
3. Embedded systems engineers (ECU, IoT, firmware)
4. Web developers (full-stack)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron |
| UI Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Code Editor | Monaco Editor |
| Terminal | xterm.js + node-pty |
| State Management | Zustand |
| AI Communication | Ollama API (local) + custom proxy (cloud) |
| Agent Protocol | MCP (Model Context Protocol) |
| Packaging | electron-builder |

## Design System

- **Style:** Glass-morphism panels on mesh gradient background
- **Theme:** Light by default, dark available
- **Fonts:** DM Sans (UI), JetBrains Mono (code)
- **Accent:** Blue gradient (#0055ff → #0088ff → #00aaff)
- **Panels:** Frosted glass with backdrop blur, 14px border radius, soft shadows
- **Background:** Multi-layer radial gradients (blue + cyan + warm orange undertone)

## Session Types

| Type | Special Panes | Use Case |
|------|--------------|----------|
| General | Editor + Terminal + Mission Control | Any language, any project |
| Security | + VM Viewer (noVNC/RDP) | Pentesting, exploit dev |
| Embedded | + Serial Monitor | ECU tuning, IoT, firmware |
| Web | + Browser Preview | Frontend, full-stack |

## Model Strategy

### Free Tier (Local via Ollama)

| Model | VRAM | Best For |
|-------|------|----------|
| Qwen 2.5 Coder 1.5B | ~2GB | Low VRAM, basic coding |
| DeepSeek Coder 1.3B | ~2GB | Code completion |
| Phi-3 Mini 3.8B | ~3GB | General tasks |
| Qwen 2.5 Coder 7B | ~6GB | Good quality coding |
| Qwen 2.5 Coder 32B | ~20GB | Best open-source coding |
| DeepSeek V3 | ~16GB+ | Complex reasoning |

### Paid Tier (Cloud via Token Proxy)

| Provider | Models | Strength |
|----------|--------|----------|
| Anthropic | Claude Sonnet 4, Opus 4 | Best tool use, coding |
| OpenAI | GPT-4o, GPT-4.1 | Fast, vision |
| Google | Gemini 2.5 Pro/Flash | Massive context, cheap |

Revenue model: Buy API tokens wholesale, sell to users at ~20% margin via Paddle (Merchant of Record, pays out to Payoneer).

## Agent Architecture

```
USER PROMPT → PLAN → EXECUTE → OBSERVE → DECIDE
                                            ↓
                                    SUCCESS → report
                                    ERROR → CORRECT → loop back to EXECUTE
```

The agent communicates with the system through MCP tools:

| Tool | Description |
|------|-------------|
| read_file | Read file contents |
| write_file | Create/overwrite file |
| edit_file | Targeted search/replace |
| list_directory | List files and folders |
| run_command | Execute shell command |
| search_codebase | Regex/semantic search |
| git_operation | Commit, branch, diff |
| browser_screenshot | Capture browser preview |
| vm_screenshot | Capture VM viewer |
| serial_send / serial_read | Hardware communication |
| ask_user | Request user approval |

## UI Layout

```
┌──────────────────────────────────────────────────────┐
│ TitleBar [VIBE logo] [Session Tabs] [User]            │
├──────┬───────────────────────────────┬───────────────┤
│      │  Editor Tabs + Monaco Editor  │  Mission      │
│ File │  (glass panel)               │  Control      │
│ Tree │                               │  (glass panel)│
│      │                               │  280px        │
│ 210px├───────────────────────────────┴───────────────┤
│      │  Terminal (dark bg inside glass panel) 140px   │
├──────┴───────────────────────────────────────────────┤
│ ChatBar [Model Selector] [Input] [/plan /edit] [Send] │
└──────────────────────────────────────────────────────┘

Background: mesh gradient. All panels: glass-morphism with 6px gap.
```

## Development Phases

| Phase | Weeks | Goal |
|-------|-------|------|
| 0 — Foundation | 1-3 | Electron + Monaco + Terminal + File Tree + Ollama chat |
| 1 — Agent Core | 4-7 | MCP tools, agent loop, Mission Control, plan/execute/observe |
| 2 — Model Router | 8-11 | Multi-model support, token proxy, credit system, Paddle |
| 3 — Workstation | 12-16 | Session types, VM viewer, browser preview, serial monitor |
| 4 — Polish | 17-22 | Cybersecurity features, embedded tools, settings, keybindings |
| 5 — Launch | 23-26 | Website, docs, code signing, auto-update, launch strategy |

## Project Structure

```
vibe-ide/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
├── INFO.md                    ← this file
├── src/
│   ├── main/                  # Electron Main Process
│   │   ├── index.ts           # Window creation, IPC setup
│   │   ├── preload.ts         # contextBridge (secure IPC)
│   │   └── ipc/
│   │       ├── filesystem.ts  # File read/write/watch
│   │       ├── terminal.ts    # node-pty shell management
│   │       └── ollama.ts      # Ollama detect/list/chat
│   ├── renderer/              # React UI
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── styles/globals.css
│   │   ├── store/             # Zustand stores
│   │   ├── components/        # React components
│   │   └── hooks/             # Custom hooks
│   └── shared/
│       └── types.ts           # Shared TypeScript types
├── server/                    # Token proxy (Phase 2)
└── resources/                 # Icons, themes, templates
```

## Key Decisions

- **Standalone Electron, NOT a VS Code fork.** Full control over UI. No upstream merge hell.
- **Paddle for payments.** Merchant of Record. Handles global tax. Pays to Payoneer.
- **Light theme default.** Professional, distinctive. Dark theme available.
- **Syncthing for multi-machine dev.** Laptop (coding) ↔ Desktop (Ollama + testing).
- **Open-source planned.** Build reputation, attract contributors, potential acquisition interest.

## Author

Muhammad Saeed — Software engineer and digital creator based in Pakistan.

``n
## package.json

`$lang
{
  "name": "vibe-ide",
  "version": "1.0.0",
  "description": "Agent-first integrated development environment",
  "main": "dist-electron/index.js",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build && electron-builder",
    "postinstall": "electron-builder install-app-deps"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^7.3.9",
    "@mui/material": "^7.3.9",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0",
    "@xterm/xterm": "^5.5.0",
    "monaco-editor": "^0.50.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "zustand": "^4.5.0"
  },
  "devDependencies": {
    "@types/node": "^25.3.5",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^4.3.0",
    "electron": "^31.0.0",
    "electron-builder": "^24.13.0",
    "node-pty": "^1.0.0",
    "typescript": "^5.5.0",
    "vite": "^5.4.0",
    "vite-plugin-electron": "^0.28.0",
    "vite-plugin-electron-renderer": "^0.14.0"
  }
}

``n
## README.md

`$lang
# VIBE IDE

**Agent-first integrated development environment.**

VIBE is a standalone Electron desktop application that combines a world-class code editor (Monaco), an integrated terminal, and an autonomous AI agent layer. It is built from the ground up to empower developers with AI-driven automation while maintaining full control over the development process.

![VIBE IDE Logo](https://raw.githubusercontent.com/wardaddys/VIBE-IDE/main/index.html) *[Replace with real logo URL when available]*

## 🚀 Key Features

- **Model Agnostic:** Seamlessly switch between local models via Ollama (free, offline) and cloud models (Claude, GPT, Gemini).
- **Autonomous Agent Loop:** A sophisticated `PLAN → EXECUTE → OBSERVE → DECIDE` loop that handles complex tasks like code refactoring, terminal operations, and error correction.
- **Wave-based Swarm Execution:** Orchestrate multiple specialist agents (Architect, Coder, etc.) in parallel waves based on their dependencies.
- **Reasoning Token Parsing:** Built-in support for models like DeepSeek-R1, displaying structured thought processes in collapsible UI blocks.
- **Tiered Thinking Budget:** Custom controls for thinking-enabled models, allowing you to balance reasoning depth with response speed.
- **Project Memory:** Persistent session context stored in `.vibe/memory.json`, allowing agents to pick up exactly where they left off.
- **Premium UI:** A stunning glass-morphism interface with mesh gradient backgrounds, designed for maximum focus and visual appeal.

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Core** | Electron, Node.js |
| **Frontend** | React 18, TypeScript, Vite |
| **Editor** | Monaco Editor |
| **Terminal** | xterm.js, node-pty |
| **State** | Zustand |
| **AI** | Ollama API, Cloud Proxy |

## 📐 Design Philosophy

VIBE is built with a "Premium Product" mindset:
- **Glassmorphism:** Frosted glass panels with backdrop blur and soft shadows.
- **Dynamic Backgrounds:** Multi-layer radial gradients (blue + cyan + warm orange).
- **Modern Typography:** DM Sans for UI and JetBrains Mono for code.
- **Micro-animations:** Subtle transitions and interactive elements for a premium feel.

## 📦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Ollama](https://ollama.com/) (for local models)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/wardaddys/VIBE-IDE.git
   cd VIBE-IDE
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🏗 Project Roadmap

- [x] **Phase 0:** Foundation (Electron + Monaco + Terminal)
- [x] **Phase 1:** Agent Core (MCP tools, loop, Mission Control)
- [ ] **Phase 2:** Model Router (Token proxy, credit system)
- [ ] **Phase 3:** Workstation (VM viewer, browser preview, serial monitor)

## 📄 License & Credits

Author: **Muhammad Saeed**  
Digital creator and software engineer based in Pakistan.

*VIBE IDE — Empowering the next generation of autonomous development.*

``n
## tsconfig.json

`$lang
{
    "compilerOptions": {
        "target": "ES2020",
        "useDefineForClassFields": true,
        "lib": [
            "ES2020",
            "DOM",
            "DOM.Iterable"
        ],
        "module": "ESNext",
        "skipLibCheck": true,
        /* Bundler mode */
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        "jsx": "react-jsx",
        /* Linting */
        "strict": true,
        "noUnusedLocals": false,
        "noUnusedParameters": false,
        "noFallthroughCasesInSwitch": false
    },
    "include": [
        "src"
    ]
}
``n
## tsconfig.node.json

`$lang
{
    "compilerOptions": {
        "target": "ES2022",
        "lib": [
            "ES2023"
        ],
        "module": "ESNext",
        "skipLibCheck": true,
        /* Bundler mode */
        "moduleResolution": "bundler",
        "allowImportingTsExtensions": true,
        "resolveJsonModule": true,
        "isolatedModules": true,
        "noEmit": true,
        /* Linting */
        "strict": true,
        "noUnusedLocals": true,
        "noUnusedParameters": true,
        "noFallthroughCasesInSwitch": true
    },
    "include": [
        "vite.config.ts",
        "src/main/**/*"
    ]
}
``n
## vite.config.ts

`$lang
import { defineConfig } from 'vite'
import path from 'node:path'
import electron from 'vite-plugin-electron/simple'
import react from '@vitejs/plugin-react'

delete process.env.ELECTRON_RUN_AS_NODE;

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        electron({
            main: {
                // Shortcut of `build.lib.entry`.
                entry: 'src/main/index.ts',
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['electron', 'node-pty', 'node:path', 'node:url', 'node:fs', 'node:fs/promises', 'node:os', 'node:child_process']
                        }
                    }
                }
            },
            preload: {
                // Shortcut of `build.rollupOptions.input`.
                // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
                input: path.join(__dirname, 'src/main/preload.ts'),
                vite: {
                    build: {
                        rollupOptions: {
                            external: ['electron']
                        }
                    }
                }
            },
            // Ployfill the Electron and Node.js built-in modules for Renderer process.
            // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
            renderer: {},
        }),
    ],
})

``n
## src\vite-env.d.ts

`$lang
/// <reference types="vite/client" />

``n
## src\main\index.ts

`$lang
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// IPC Handlers
import { registerFileSystemHandlers } from './ipc/filesystem';
import { registerTerminalHandlers } from './ipc/terminal';
import { registerOllamaHandlers } from './ipc/ollama';

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

``n
## src\main\preload.ts

`$lang
import { contextBridge, ipcRenderer } from 'electron';
import type { ChatMessage, FileEntry } from '../shared/types';

contextBridge.exposeInMainWorld('vibe', {
    // FILESYSTEM
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    readDir: (dirPath: string): Promise<FileEntry[]> => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string): Promise<boolean> => ipcRenderer.invoke('fs:writeFile', filePath, content),
    watchFolder: (dirPath: string) => ipcRenderer.invoke('fs:watchFolder', dirPath),
    onFolderChanged: (callback: () => void) => {
        ipcRenderer.removeAllListeners('fs:changed');
        ipcRenderer.on('fs:changed', () => callback());
    },
    readMemory: (projectPath: string): Promise<string | null> => ipcRenderer.invoke('fs:readMemory', projectPath),
    writeMemory: (projectPath: string, memory: object): Promise<boolean> => ipcRenderer.invoke('fs:writeMemory', projectPath, memory),

    // TERMINAL
    createTerminal: (cwd?: string): Promise<string> => ipcRenderer.invoke('terminal:create', cwd),
    sendTerminalInput: (id: string, data: string) => ipcRenderer.invoke('terminal:input', id, data),
    resizeTerminal: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    onTerminalData: (callback: (id: string, data: string) => void) => {
        ipcRenderer.on('terminal:data', (_event, id, data) => callback(id, data));
    },
    killTerminal: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    getTerminalOutput: (id: string): Promise<string> => ipcRenderer.invoke('terminal:getOutput', id),
    clearTerminalOutput: (id: string): Promise<void> => ipcRenderer.invoke('terminal:clearOutput', id),

    // OLLAMA
    detectOllama: () => ipcRenderer.invoke('ollama:detect'),
    statusOllama: () => ipcRenderer.invoke('ollama:status'),
    listModels: () => ipcRenderer.invoke('ollama:listModels'),
    chat: (model: string, messages: ChatMessage[], apiKeys?: Record<string, string>, thinkOptions?: any) => ipcRenderer.invoke('ollama:chat', model, messages, apiKeys, thinkOptions),
    onChatStream: (callback: (chunk: { content: string, done: boolean }) => void) => {
        ipcRenderer.removeAllListeners('ollama:stream');
        ipcRenderer.on('ollama:stream', (_event, chunk) => callback(chunk));
    },
    log: (msg: string) => ipcRenderer.invoke('log:renderer', msg),
    stopGeneration: () => ipcRenderer.invoke('ollama:stop'),

    // WINDOW CONTROLS
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
});

``n
## src\main\ipc\filesystem.ts

`$lang
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

            // Sort: directories first, then alphabetically
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

    ipcMain.handle('fs:readMemory', async (_event, projectPath: string): Promise<string | null> => {
        try {
            const memPath = path.join(projectPath, '.vibe', 'memory.json');
            const content = await fs.readFile(memPath, 'utf-8');
            return content;
        } catch {
            return null;
        }
    });

    ipcMain.handle('fs:writeMemory', async (_event, projectPath: string, memory: object): Promise<boolean> => {
        try {
            const vibeDir = path.join(projectPath, '.vibe');
            await fs.mkdir(vibeDir, { recursive: true });
            const memPath = path.join(vibeDir, 'memory.json');
            await fs.writeFile(memPath, JSON.stringify(memory, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('Failed to write memory:', error);
            return false;
        }
    });
}

``n
## src\main\ipc\ollama.ts

`$lang
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

    ipcMain.handle('ollama:chat', async (_event, model, messages, apiKeys, thinkOptions) => {
        if (abortController) abortController.abort();
        abortController = new AbortController();

        try {
            let endpoint = '';
            let headers: any = { 'Content-Type': 'application/json' };
            let body: any = {};
            let isAnthropic = false;
            let isGemini = false;

            const sysMsg = messages.find((m: ChatMessage) => m.role === 'system')?.content || '';
            const userMsgs = messages.filter((m: ChatMessage) => m.role !== 'system');

            const thinkBudgets = { low: 2048, medium: 8192, high: 16000 };
            const thinkTokenBudget = thinkOptions?.enabled && thinkOptions?.level
                ? (thinkBudgets as any)[thinkOptions.level]
                : null;

            // 1. ABSOLUTE PRIORITY: Route -cloud and local models to Ollama immediately.
            if (model.includes('-cloud') || OLLAMA_ONLY_MODELS.has(model)) {
                endpoint = `${OLLAMA_BASE}/api/chat`;
                body = { 
                    model, 
                    messages, 
                    stream: true, 
                    options: { 
                        num_ctx: 16384,
                        ...(thinkTokenBudget ? { num_predict: thinkTokenBudget } : {})
                    } 
                };
            }
            // 2. CLOUD APIS
            else if (model.includes('claude')) {
                if (!apiKeys?.claude) throw new Error('Claude API key missing.');
                endpoint = 'https://api.anthropic.com/v1/messages';
                headers['x-api-key'] = apiKeys.claude;
                headers['anthropic-version'] = '2023-06-01';
                headers['anthropic-dangerous-direct-browser-access'] = 'true';
                isAnthropic = true;
                body = { 
                    model, 
                    max_tokens: thinkTokenBudget ? thinkTokenBudget + 4096 : 4096, 
                    system: sysMsg, 
                    messages: userMsgs, 
                    stream: true,
                    ...(thinkTokenBudget ? { thinking: { type: 'enabled', budget_tokens: thinkTokenBudget } } : {})
                };
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
                body = { contents: userMsgs.map((m: ChatMessage) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) };
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
                // Fallback for standard local models (e.g. llama3.2:latest)
                endpoint = `${OLLAMA_BASE}/api/chat`;
                body = { 
                    model, 
                    messages, 
                    stream: true, 
                    options: { 
                        num_ctx: 16384,
                        ...(thinkTokenBudget ? { num_predict: thinkTokenBudget } : {})
                    } 
                };
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

``n
## src\main\ipc\terminal.ts

`$lang
import { ipcMain, BrowserWindow } from 'electron';
import * as pty from 'node-pty';

const terminals = new Map<string, pty.IPty>();
const terminalOutputBuffers = new Map<string, string>();

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
            terminalOutputBuffers.set(id, '');

            ptyProcess.onData((data) => {
                if (!mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('terminal:data', id, data);
                }
                
                // Maintain a rolling buffer of the last 4000 characters
                let currentBuffer = terminalOutputBuffers.get(id) || '';
                currentBuffer += data;
                if (currentBuffer.length > 4000) {
                    currentBuffer = currentBuffer.slice(-4000);
                }
                terminalOutputBuffers.set(id, currentBuffer);
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
            terminalOutputBuffers.delete(id);
        }
    });

    ipcMain.handle('terminal:getOutput', (_event, id: string) => {
        return terminalOutputBuffers.get(id) || '';
    });
    ipcMain.handle('terminal:clearOutput', (_event, id: string) => {
        terminalOutputBuffers.set(id, '');
    });
}

``n
## src\renderer\App.tsx

`$lang
import React, { useEffect, useRef } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { MenuBar } from './components/layout/MenuBar';
import { Sidebar } from './components/layout/Sidebar';
import { MainArea } from './components/layout/MainArea';
import { useOllamaStore } from './store/ollama';
import { useUIStore } from './store/ui';
import { useWorkspaceStore } from './store/workspaces';
import { LoginScreen } from './components/auth/LoginScreen';
import { useBackgroundTerminal } from './hooks/useBackgroundTerminal';
import { streamBus } from './utils/streamBus';

export default function App() {
    const setConnectionState = useOllamaStore(state => state.setConnectionState);
    const setModels = useOllamaStore(state => state.setModels);
    const setOllamaConnected = useUIStore(state => state.setOllamaConnected);
    const isLoggedIn = useUIStore(state => state.isLoggedIn);
    const setIsLoggedIn = useUIStore(state => state.setIsLoggedIn);

    const thinkBufferRef = useRef('');
    const inThinkBlockRef = useRef(false);

    useBackgroundTerminal();

    /* -----------------------------------------------------------------
       1️⃣  On start‑up we *detect* Ollama (fast HTTP ping).  This sets the
       “connected” flag used by the Sidebar and also updates the UI store
       that drives the green/red dot in the ChatBar.
       ----------------------------------------------------------------- */
    useEffect(() => {
        const checkOllama = async () => {
            try {
                const { detected, version } = await window.vibe.detectOllama();
                setConnectionState(detected, version ?? null);
                setOllamaConnected(detected);
                if (detected) {
                    const models = await window.vibe.listModels();
                    setModels(models);
                }
            } catch (err) {
                console.error('Ollama check failed:', err);
                setConnectionState(false, null);
                setOllamaConnected(false);
            }
        };
        checkOllama();
        const interval = setInterval(checkOllama, 30000);
        return () => clearInterval(interval);
    }, [setConnectionState, setModels, setOllamaConnected]);

    useEffect(() => {
        window.vibe.onChatStream((chunk: { content: string, done: boolean }) => {
            const store = useOllamaStore.getState();

            if (chunk.content) {
                thinkBufferRef.current += chunk.content;
                let buf = thinkBufferRef.current;
                let normalContent = '';

                while (buf.length > 0) {
                    if (inThinkBlockRef.current) {
                        const closeIdx = buf.indexOf('</think>');
                        if (closeIdx !== -1) {
                            store.appendThinkContent(buf.slice(0, closeIdx));
                            store.finalizeThinking();
                            inThinkBlockRef.current = false;
                            buf = buf.slice(closeIdx + '</think>'.length);
                        } else {
                            const safeLen = Math.max(0, buf.length - 8);
                            if (safeLen > 0) { store.appendThinkContent(buf.slice(0, safeLen)); buf = buf.slice(safeLen); }
                            break;
                        }
                    } else {
                        const openIdx = buf.indexOf('<think>');
                        if (openIdx !== -1) {
                            normalContent += buf.slice(0, openIdx);
                            store.startThinking();
                            inThinkBlockRef.current = true;
                            buf = buf.slice(openIdx + '<think>'.length);
                        } else {
                            const safeLen = Math.max(0, buf.length - 7);
                            normalContent += buf.slice(0, safeLen);
                            buf = buf.slice(safeLen);
                            break;
                        }
                    }
                }

                thinkBufferRef.current = buf;

                if (normalContent) {
                    store.updateLastMessage(normalContent);
                    const ws = useWorkspaceStore.getState();
                    if (ws.activeWorkspacePath && ws.activeThreadId) {
                        const workspace = ws.workspaces.find(w => w.path === ws.activeWorkspacePath);
                        const thread = workspace?.threads.find(t => t.id === ws.activeThreadId);
                        if (thread) {
                            const msgs = [...thread.messages];
                            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + normalContent };
                                ws.saveMessagesToThread(ws.activeWorkspacePath!, ws.activeThreadId!, msgs);
                            }
                        }
                    }
                }
            }

            if (chunk.done) {
                const remaining = thinkBufferRef.current;
                if (remaining) {
                    if (inThinkBlockRef.current) {
                        store.appendThinkContent(remaining);
                        store.finalizeThinking();
                    } else {
                        store.updateLastMessage(remaining);
                    }
                    thinkBufferRef.current = '';
                    inThinkBlockRef.current = false;
                }
                store.setIsGenerating(false);
                const ws = useWorkspaceStore.getState();
                if (ws.activeWorkspacePath && ws.activeThreadId) {
                    const workspace = ws.workspaces.find(w => w.path === ws.activeWorkspacePath);
                    const thread = workspace?.threads.find(t => t.id === ws.activeThreadId);
                    if (thread) ws.saveMessagesToThread(ws.activeWorkspacePath!, ws.activeThreadId!, thread.messages);
                }
            }
        });
    }, []); // Empty deps — register ONCE, never again

    const projectPath = useUIStore(state => state.projectPath);
    const setVibeInstructions = useUIStore(state => state.setVibeInstructions);

    useEffect(() => {
        if (projectPath) {
            window.vibe.readFile(`${projectPath}/VIBE.md`)
                .then((content: string) => setVibeInstructions(content))
                .catch(() => setVibeInstructions(null));
        } else {
            setVibeInstructions(null);
        }
    }, [projectPath]);

    if (!isLoggedIn) {
        return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
    }

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TitleBar />
            <MenuBar />
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '0 var(--gap) var(--gap)', gap: 'var(--gap)' }}>
                <Sidebar />
                <MainArea />
            </div>
        </div>
    );
}

``n
## src\renderer\main.tsx

`$lang
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

``n
## src\renderer\components\ai\ChatMessages.tsx

`$lang
import React, { useEffect, useRef } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';
import { ThinkBlock } from './ThinkBlock';
import { ThinkingIndicator } from './ThinkingIndicator';

function CommandBlock({ command }: { command: string }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(command);
    };
    return (
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 8, margin: '8px 0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Terminal Command</span>
                <button onClick={handleCopy} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>Copy</button>
            </div>
            <div style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#cdd6f4', whiteSpace: 'pre-wrap' }}>
                <span style={{ color: 'var(--accent)', marginRight: 8, opacity: 0.7 }}>$</span>{command}
            </div>
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
            window.vibe.writeFile(fullPath, content).then(() => {
                setWritten(true);
                openFile(fullPath, content);
            }).catch(console.error);
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

export function ChatMessages() {
    const messages = useOllamaStore(state => state.messages);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { 
        if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; 
    }, [messages, isGenerating]);

    const renderContent = (content: string) => {
        if (!content) return <span style={{ opacity: 0.5 }}>…</span>;

        if (content.startsWith('__TERMINAL_OUTPUT__\n')) {
            const output = content.replace('__TERMINAL_OUTPUT__\n', '');
            return (
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e6edf3', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
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
                <div style={{ background: 'rgba(0,102,255,0.04)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
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
                        {isLastAssistant && <ThinkBlock />}
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
                        {isStreaming && <ThinkingIndicator />}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

``n
## src\renderer\components\ai\HuggingFacePicker.tsx

`$lang
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

    // Search on mount with empty query to show popular models
    useEffect(() => {
        searchModels('');
    }, []);

    // Debounced search on input
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
                {/* Header */}
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
                            style={{
                                width: '100%',
                                padding: '9px 36px 9px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.9)',
                                fontSize: 13,
                                color: 'var(--text)',
                                outline: 'none',
                            }}
                        />
                        {loading && (
                            <div style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent',
                                borderRadius: '50%', animation: 'spin 1s linear infinite'
                            }} />
                        )}
                    </div>
                    {error && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--error)' }}>⚠ {error}</div>}
                </div>

                {/* Results */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {results.length === 0 && !loading && (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            {error ? 'Search failed — check your connection' : 'No models found'}
                        </div>
                    )}
                    {results.map(model => {
                        const pinned = isPinned(model.id);
                        return (
                            <div key={model.id} style={{
                                padding: '12px 24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--border-light)',
                                background: pinned ? 'rgba(0,102,255,0.03)' : 'transparent',
                                gap: 12,
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {model.id}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            ❤ {(model.likes || 0).toLocaleString()}
                                        </span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            ↓ {(model.downloads || 0).toLocaleString()}
                                        </span>
                                        {model.pipeline_tag && (
                                            <span style={{
                                                fontSize: 9, padding: '1px 6px', borderRadius: 4,
                                                background: 'var(--accent-light)', color: 'var(--accent)',
                                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5
                                            }}>
                                                {model.pipeline_tag}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => pinned
                                        ? unpinModel(model.id)
                                        : pinModel({ id: model.id, name: model.id.split('/').pop() || model.id })
                                    }
                                    style={{
                                        padding: '5px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        border: pinned ? '1px solid var(--error)' : '1px solid var(--accent)',
                                        background: pinned ? 'rgba(224,48,80,0.06)' : 'var(--accent-light)',
                                        color: pinned ? 'var(--error)' : 'var(--accent)',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        transition: 'all 0.15s',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {pinned ? 'Remove' : '+ Add'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid var(--border-light)',
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {pinnedModels.length} model{pinnedModels.length !== 1 ? 's' : ''} added
                        {!apiKeys?.hf && ' · Add HF token in Settings for more results'}
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '7px 20px',
                            background: 'var(--accent-gradient)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13
                        }}
                    >
                        Done
                    </button>
                </div>
            </GlassPanel>
        </div>
    );
}

``n
## src\renderer\components\ai\ModelCapabilities.tsx

`$lang
import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import type { ModelCapability } from '../../../shared/types';

export const ModelCapabilities = () => {
    const selected = useOllamaStore(s => s.selectedModel);
    const caps: ModelCapability = useOllamaStore(s => s.modelCapabilities[selected] ?? {});
    const thinkEnabled = useOllamaStore(s => s.thinkEnabled);
    const thinkLevel = useOllamaStore(s => s.thinkLevel);
    const setThinkEnabled = useOllamaStore(s => s.setThinkEnabled);
    const setThinkLevel = useOllamaStore(s => s.setThinkLevel);
    const [showLevels, setShowLevels] = useState(false);

    if (!caps.think) return null;

    const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];

    const levelBudgets = {
        low: 2048,
        medium: 8192,
        high: 16000,
    };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
            {/* Think toggle button */}
            <button
                onClick={() => {
                    if (caps.thinkBudget === 'tiered') {
                        setShowLevels(s => !s);
                        if (!thinkEnabled) setThinkEnabled(true);
                    } else {
                        setThinkEnabled(!thinkEnabled);
                        setShowLevels(false);
                    }
                }}
                title={thinkEnabled ? 'Thinking ON' : 'Enable thinking'}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: `1px solid ${thinkEnabled ? 'var(--accent)' : 'var(--border)'}`,
                    background: thinkEnabled ? 'var(--accent-light)' : 'transparent',
                    color: thinkEnabled ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                }}
            >
                💡
                {caps.thinkBudget === 'tiered' && thinkEnabled && (
                    <span style={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>{thinkLevel}</span>
                )}
                {caps.thinkBudget === 'toggle' && (
                    <span>{thinkEnabled ? 'ON' : 'OFF'}</span>
                )}
            </button>

            {/* Level picker dropdown — tiered models only */}
            {caps.thinkBudget === 'tiered' && showLevels && (
                <>
                    <div
                        onClick={() => setShowLevels(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                    />
                    <div style={{
                        position: 'absolute',
                        bottom: 'calc(100% + 8px)',
                        left: 0,
                        zIndex: 99,
                        background: '#fff',
                        border: '1px solid var(--border)',
                        borderRadius: 8,
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                        minWidth: 140,
                    }}>
                        <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
                            Thinking Budget
                        </div>
                        {levels.map(level => (
                            <button
                                key={level}
                                onClick={() => {
                                    setThinkLevel(level);
                                    setThinkEnabled(true);
                                    setShowLevels(false);
                                }}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    width: '100%',
                                    padding: '7px 12px',
                                    background: thinkLevel === level ? 'var(--accent-light)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: thinkLevel === level ? 700 : 500,
                                    color: thinkLevel === level ? 'var(--accent)' : 'var(--text)',
                                    textAlign: 'left',
                                    textTransform: 'capitalize',
                                }}
                            >
                                <span>{level}</span>
                                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                    {(levelBudgets[level] / 1000).toFixed(0)}k tokens
                                </span>
                            </button>
                        ))}
                        <div style={{ borderTop: '1px solid var(--border-light)', padding: '6px 12px' }}>
                            <button
                                onClick={() => { setThinkEnabled(false); setShowLevels(false); }}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--error)', fontWeight: 600, padding: 0 }}
                            >
                                Turn off thinking
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

``n
## src\renderer\components\ai\ModelSelector.tsx

`$lang
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

    // -----------------------------------------------------------------
    // Two buckets – local‑only models and Ollama‑cloud models.
    // -----------------------------------------------------------------
    const localModels = models.filter(m => !OLLAMA_ONLY_MODELS.has(m));
    const cloudModels = models.filter(m => OLLAMA_ONLY_MODELS.has(m));

    // -----------------------------------------------------------------
    // Pull the list on mount and then refresh every 30 s (so newly
    // pulled models appear without a restart).
    // -----------------------------------------------------------------
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
                    <span style={{ fontSize: 13, fontWeight: isSelected ? (isSwarm ? 700 : 600) : 500, color: isSwarm ? 'var(--accent)' : 'var(--text)' }}>
                        {displayName}
                    </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {!isSwarm && getModelTags(id).map(tag => (
                        <span key={tag.label} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: tag.color, background: tag.bg }}>{tag.label}</span>
                    ))}
                    {isSwarm && <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: 'var(--accent)', background: 'var(--accent-light)' }}>SWARM</span>}
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
                    <button onClick={() => { setShowAgentManager(true); onClose(); }} style={{ width: '100%', padding: '10px', background: 'var(--accent-light)', color: 'var(--accent)', border: '1px dashed var(--accent)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.2s' }}>
                        + Create Custom Swarm
                    </button>
                </div>

                <div style={{ margin: '4px 0 8px', borderTop: '1px solid var(--border-light)' }} />

                {swarms.length > 0 && (
                    <>
                        <div style={{ padding: '0 16px 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)', fontWeight: 700 }}>Custom Swarms</div>
                        <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {swarms.map(swarm => renderModelItem({ id: swarm.id, label: swarm.name }, true))}
                        </div>
                        <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                    </>
                )}

                <div style={{ padding: '0 16px 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Local Models (Free)</div>
                {localModels.length === 0 ? (
                    <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        No local models found. Install one via `ollama pull …`.
                    </div>
                ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {localModels.map(m => renderModelItem({ id: m, label: m }))}
                    </div>
                )}

                {/* ---------- Ollama‑cloud models (free) ---------- */}
                {cloudModels.length > 0 && (
                    <>
                        <div style={{ padding: '8px 16px 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)', fontWeight: 700, marginTop: 8 }}>
                            Ollama Cloud (Free)
                        </div>
                        <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {cloudModels.map(m => renderModelItem({ id: m, label: `${m} (Ollama Cloud)` }))}
                        </div>
                    </>
                )}
                
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '8px 16px 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Cloud Models (API)</div>
                <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {availableCloudModels.length === 0 ? (
                        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>No API keys found. Add them in Settings.</div>
                    ) : (
                        availableCloudModels.map(m => renderModelItem({ id: m.id, label: m.name }))
                    )}
                </div>

                {/* HuggingFace section */}
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#ff6e00', fontWeight: 700 }}>HuggingFace (Free)</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowHFPicker(true); }}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #ff6e00', background: 'rgba(255,110,0,0.06)', color: '#ff6e00', cursor: 'pointer', fontWeight: 600 }}
                    >
                        + Browse
                    </button>
                </div>
                {pinnedModels.length === 0 ? (
                    <div style={{ padding: '6px 16px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                        No HF models added. Click Browse →
                    </div>
                ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {pinnedModels.map(m => renderModelItem({ id: `hf:${m.id}`, label: m.name }))}
                    </div>
                )}
            </GlassPanel>
        </>
    );
}

``n
## src\renderer\components\ai\ThinkBlock.tsx

`$lang
import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';

export function ThinkBlock() {
    const isThinking = useOllamaStore(state => state.isThinking);
    const thinkingContent = useOllamaStore(state => state.thinkingContent);
    const thinkingElapsed = useOllamaStore(state => state.thinkingElapsed);
    const [expanded, setExpanded] = useState(false);

    if (!isThinking && !thinkingContent) return null;

    return (
        <div style={{ alignSelf: 'flex-start', maxWidth: '92%', marginBottom: 2 }}>
            <button
                onClick={() => !isThinking && setExpanded(e => !e)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'transparent', border: 'none',
                    cursor: isThinking ? 'default' : 'pointer',
                    padding: '4px 0', color: 'var(--text-muted)',
                    fontSize: 12, fontFamily: 'var(--font-sans)',
                }}
            >
                {isThinking ? (
                    <div style={{
                        width: 10, height: 10,
                        border: '2px solid var(--accent)', borderTopColor: 'transparent',
                        borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0,
                    }} />
                ) : (
                    <span style={{ fontSize: 11, opacity: 0.6 }}>{expanded ? '▾' : '▸'}</span>
                )}
                <span style={{ fontStyle: 'italic', color: isThinking ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {isThinking ? 'Thinking…' : `Thought for ${thinkingElapsed}s`}
                </span>
            </button>

            {!isThinking && expanded && thinkingContent && (
                <div style={{
                    marginTop: 4, padding: '10px 14px',
                    background: 'rgba(0,102,255,0.03)', border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)',
                    lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)',
                    maxHeight: 300, overflowY: 'auto',
                }}>
                    {thinkingContent}
                </div>
            )}
        </div>
    );
}

``n
## src\renderer\components\ai\ThinkingIndicator.tsx

`$lang
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
                        : 'Agent is thinking…'}
            </span>
        </div>
    );
}


``n
## src\renderer\components\auth\LoginScreen.tsx

`$lang
import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';

interface Props {
    onLogin: () => void;
}

export function LoginScreen({ onLogin }: Props) {
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        // TODO: implement real Google OAuth flow with backend
        setTimeout(() => {
            setLoading(false);
            onLogin();
        }, 1500);
    };

    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-mesh)' }}>
            <GlassPanel variant="strong" style={{ width: 400, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
                <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 32, letterSpacing: 6, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center', marginBottom: 8 }}>VIBE</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Agent-first IDE</div>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{ width: '100%', padding: '12px 20px', background: loading ? 'rgba(0,0,0,0.05)' : '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}
                    >
                        {loading ? (
                            <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18">
                                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
                                <path fill="#FBBC05" d="M4.5 10.51a4.8 4.8 0 010-3.02V5.42H1.83a8 8 0 000 7.16l2.67-2.07z"/>
                                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.42L4.5 7.49a4.77 4.77 0 014.48-3.31z"/>
                            </svg>
                        )}
                        {loading ? 'Signing in…' : 'Continue with Google'}
                    </button>

                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
                        By continuing you agree to the Terms of Service
                    </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 16, width: '100%' }}>
                    VIBE v0.1.0 · Made by Muhammad Saeed
                </div>
            </GlassPanel>
        </div>
    );
}

``n
## src\renderer\components\common\GlassPanel.tsx

`$lang
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

``n
## src\renderer\components\editor\EditorTabs.tsx

`$lang
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

``n
## src\renderer\components\editor\MonacoEditor.tsx

`$lang
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
            minimap: { enabled: true, scale: 1, maxColumn: 60, renderCharacters: false, showSlider: 'mouseover' },
            scrollbar: { verticalScrollbarSize: 3, horizontalScrollbarSize: 3, useShadows: false },
            overviewRulerLanes: 0,
            overviewRulerBorder: false,
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
            // Find which file is active
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

``n
## src\renderer\components\filetree\FileTree.tsx

`$lang
import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../store/ui';
import { useFileSystem } from '../../hooks/useFileSystem';
import { FileTreeItem } from './FileTreeItem';
import type { FileEntry } from '../../../shared/types';

export function FileTree() {
    const projectPath = useUIStore(state => state.projectPath);
    const setProjectPath = useUIStore(state => state.setProjectPath);
    const setVibeInstructions = useUIStore(state => state.setVibeInstructions);
    const { openFolder, readDir, readFile } = useFileSystem();
    const [entries, setEntries] = useState<FileEntry[]>([]);

    useEffect(() => {
        if (!projectPath) return;
        
        // Read immediately on mount / projectPath change
        readDir(projectPath).then(setEntries).catch(console.error);

        // Load project memory
        window.vibe.readMemory(projectPath).then((raw: string | null) => {
            if (raw) {
                try {
                    const memory = JSON.parse(raw);
                    useUIStore.getState().setProjectMemory(memory);
                } catch {
                    useUIStore.getState().setProjectMemory(null);
                }
            } else {
                useUIStore.getState().setProjectMemory(null);
            }
        });
        
        window.vibe.watchFolder(projectPath);
        window.vibe.onFolderChanged(() => {
            readDir(projectPath).then(setEntries).catch(console.error);
        });
    }, [projectPath]);

    const handleOpenFolder = async () => {
        const p = await openFolder();
        if (p) {
            setProjectPath(p);
            try {
                const vibemd = await window.vibe.readFile(`${p}/VIBE.md`);
                useUIStore.getState().setVibeInstructions(vibemd);
            } catch {
                useUIStore.getState().setVibeInstructions(null);
            }
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

``n
## src\renderer\components\filetree\FileTreeItem.tsx

`$lang
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

``n
## src\renderer\components\layout\AgentManager.tsx

`$lang
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

``n
## src\renderer\components\layout\ChatBar.tsx

`$lang
import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { ModelSelector } from '../ai/ModelSelector';
import { useSettingsStore } from '../../store/settings';
import { useWorkspaceStore } from '../../store/workspaces';
import { useSwarmStore, AgentNode, SwarmConfig, SwarmHandoff } from '../../store/swarms';
import { useUIStore, ProjectMemory } from '../../store/ui';
import { useTerminalStore } from '../../store/terminal';
import { streamBus } from '../../utils/streamBus';
import { cleanTerminalOutput } from '../../utils/terminal';
import { ModelCapabilities } from '../ai/ModelCapabilities';
import type { ChatMessage } from '../../../shared/types';
import { getModelTags } from '../../utils/tags';

const estimateTokens = (msgs: ChatMessage[]) => msgs.reduce((acc, m) => acc + m.content.length / 4, 0);
const CONTEXT_WARN_THRESHOLD = 12000;

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
        useOllamaStore.getState().resetThinking();

        const projectMemory = useUIStore.getState().projectMemory;
        const memorySection = projectMemory ? `

PROJECT MEMORY (from last session — ${projectMemory.updatedAt}):
Summary: ${projectMemory.lastSession}
Current phase: ${projectMemory.currentPhase}
Key files: ${projectMemory.keyFiles.join(', ')}
Architectural decisions:
${projectMemory.architecturalDecisions.map(d => `- ${d}`).join('\n')}

Use this context to orient yourself. Do NOT run exploratory commands to rediscover things already known.` : '';

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
1. Always <read_file path="..."/> before editing an existing file. Never guess file contents.
2. CRITICAL: When the user asks you to "study", "read", "look at", or "tell me about" a specific named file, ALWAYS use <read_file path="..."/> FIRST. Never run dir, ls, Get-ChildItem, or any exploratory command to find a file the user has already named. If the user gives you a filename, use read_file on it directly without running any terminal commands first.
3. PowerShell syntax ONLY. Use semicolons not &&. Use Remove-Item not rm. Use New-Item -ItemType Directory -Force not mkdir -p.
4. Write COMPLETE files — never partial code, never "// rest of file here".
5. When your task is fully complete, respond with <done>summary</done>.
6. If a command fails, read the error and try a different approach.
7. NEVER use <done> before you have received and read the terminal output from your command. After every <execute>, you will receive the output — wait for it and use it in your response.
8. After running an exploratory command (like dir or Get-ChildItem), always summarize what you found in plain text for the user BEFORE using <done>.
9. Use 'dir' for simple directory listings. Only use Get-ChildItem if you need specific filtering.
10. Never run the same command twice in a row.
11. Always cd to the project directory before running any file-related commands.
12. Never run commands from the home directory or unknown working directory.${vibeInstructions ? `\n\nPROJECT INSTRUCTIONS (from VIBE.md):\n${vibeInstructions}` : ''}${memorySection}`;

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

        const tokenEstimate = estimateTokens(messages);
        if (tokenEstimate > CONTEXT_WARN_THRESHOLD) {
            useOllamaStore.getState().setAgentStatus('⚠ Context large — consider starting a new chat for best results');
            await new Promise(r => setTimeout(r, 2000));
        }

        useOllamaStore.getState().setIsGenerating(true);
        useOllamaStore.getState().setAgentStep(iteration, MAX_LOOP);
        useOllamaStore.getState().setAgentStatus(
            iteration === 0 ? 'Thinking…' : `Working on step ${iteration}/${MAX_LOOP}…`
        );

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            const thinkOptions = (() => {
                const store = useOllamaStore.getState();
                const caps = store.modelCapabilities[store.selectedModel] ?? {};
                if (!caps.think || !store.thinkEnabled) return null;
                return { enabled: true, level: store.thinkLevel };
            })();

            await window.vibe.chat(selectedModel, messages, apiKeys, thinkOptions);
            await waitForStreamDone();
        } catch (e) {
            console.error('Chat error:', e);
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        const lastContent = useOllamaStore.getState().messages[useOllamaStore.getState().messages.length - 1]?.content || '';

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
            // Write updated memory after session
            const projectPath = useUIStore.getState().projectPath;
            if (projectPath) {
                const doneMatch = lastContent.match(/<done>([\s\S]*?)<\/done>/);
                const sessionSummary = doneMatch ? doneMatch[1].trim() : 'Session completed.';
                const existingMemory = useUIStore.getState().projectMemory;
                
                const newMemory = {
                    lastSession: sessionSummary,
                    keyFiles: existingMemory?.keyFiles || [],
                    architecturalDecisions: existingMemory?.architecturalDecisions || [],
                    currentPhase: existingMemory?.currentPhase || 'development',
                    updatedAt: new Date().toISOString(),
                };
                
                window.vibe.writeMemory(projectPath, newMemory).then(() => {
                    useUIStore.getState().setProjectMemory(newMemory);
                });
            }

            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        const hasExecute = /<execute>[\s\S]*?<\/execute>/.test(lastContent);
        if (hasExecute) {
            if (iteration === 0) {
                // First execute — check if it includes a cd, if not, inject one
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

    const runSwarm = async (swarm: SwarmConfig, userInput: string) => {
        useOllamaStore.getState().setIsGenerating(true);
        const projectPath = useUIStore.getState().projectPath;

        const sharedContext: Record<string, string> = {};

        const getWave = (agent: AgentNode, allAgents: AgentNode[]): number => {
            if (!agent.dependsOn || agent.dependsOn.length === 0) return 0;
            const depWaves = agent.dependsOn.map(depId => {
                const dep = allAgents.find(a => a.id === depId);
                return dep ? getWave(dep, allAgents) + 1 : 0;
            });
            return Math.max(...depWaves);
        };

        const agentsWithWaves = swarm.agents.map(agent => ({
            ...agent,
            wave: getWave(agent, swarm.agents)
        }));

        const maxWave = Math.max(...agentsWithWaves.map(a => a.wave));

        for (let wave = 0; wave <= maxWave; wave++) {
            const waveAgents = agentsWithWaves.filter(a => a.wave === wave);

            useOllamaStore.getState().addMessage({
                role: 'user',
                content: `__SWARM_LABEL__Wave ${wave + 1} — ${waveAgents.map(a => a.role).join(', ')}`
            });

            useOllamaStore.getState().setAgentStatus(
                `Wave ${wave + 1}/${maxWave + 1}: Running ${waveAgents.map(a => a.role).join(' + ')} in parallel…`
            );

            await Promise.all(waveAgents.map(async (agent) => {
                const depContext = agent.dependsOn
                    ? agent.dependsOn.map(depId => {
                        const depAgent = swarm.agents.find(a => a.id === depId);
                        const role = depAgent?.role || String(depId);
                        return sharedContext[role] ? `\n\n[${role} output]:\n${sharedContext[role]}` : '';
                    }).join('')
                    : '';

                const handoff: SwarmHandoff = {
                    originalRequest: userInput,
                    previousAgentRole: Object.keys(sharedContext)[Object.keys(sharedContext).length - 1] || 'none',
                    previousAgentOutput: Object.values(sharedContext)[Object.values(sharedContext).length - 1] || '',
                    sharedContext,
                };

                const sysPrompt = agent.role === 'Architect'
                    ? `You are the Architect agent in a multi-agent swarm. Your job is analysis and planning only.

Original request: ${userInput}

Produce a detailed, numbered execution plan. Be specific about file names, commands, logic, and edge cases. Output only the plan — no code, no implementation.`
                    : `You are the ${agent.role} agent in a multi-agent swarm.

Original request: ${handoff.originalRequest}
${depContext}

Full shared context from previous agents:
${Object.entries(handoff.sharedContext).map(([role, output]) => `[${role}]:\n${output}`).join('\n\n')}

Execute your part of the work using VIBE tools:
- <read_file path="file"/> before editing any existing file
- <write_file path="file">complete content</write_file> for creating/editing files
- <execute>powershell command</execute> for terminal commands
- Windows PowerShell only. Complete files only, no placeholders.
- <done>summary</done> when your part is complete.${projectPath ? `\nProject path: ${projectPath}` : ''}`;

                const msgs: ChatMessage[] = [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: agent.role === 'Architect' ? userInput : `Execute your role. Context is in your system prompt.` }
                ];

                useOllamaStore.getState().addMessage({ role: 'user', content: `__SWARM_LABEL__  ↳ ${agent.role} (${agent.model})` });
                useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

                await window.vibe.chat(agent.model, msgs, apiKeys);
                const output = await waitForStreamDone();

                sharedContext[agent.role] = output;
            }));
        }

        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
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
                    <ModelCapabilities />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: ollamaConnected ? 'var(--green)' : '#ccc', display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ollamaConnected ? 'Ollama' : 'No Ollama'}</span>
                    </div>

                    <button
                        onClick={isGenerating ? handleStop : handleSend}
                        disabled={!isGenerating && (!input.trim() || !selectedModel)}
                        title={isGenerating ? 'Stop (Enter)' : 'Send (Enter)'}
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

``n
## src\renderer\components\layout\MainArea.tsx

`$lang
import React from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { EditorTabs } from '../editor/EditorTabs';
import { MonacoEditor } from '../editor/MonacoEditor';
import { ChatMessages } from '../ai/ChatMessages';
import { ChatBar } from './ChatBar';

export function MainArea() {
    return (
        <div style={{ flex: 1, display: 'flex', gap: 'var(--gap)', overflow: 'hidden' }}>
            {/* Left: File Viewer / Editor — 50% */}
            <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <EditorTabs />
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <MonacoEditor />
                </div>
            </GlassPanel>

            {/* Right: Agent Chat — 50% */}
            <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <div style={{
                    padding: '10px 16px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    borderBottom: '1px solid var(--border-light)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>Agent Chat</span>
                </div>
                <ChatMessages />
                <ChatBar />
            </GlassPanel>
        </div>
    );
}

``n
## src\renderer\components\layout\MenuBar.tsx

`$lang
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
                { label: 'Find', shortcut: 'Ctrl+F', action: () => { /* Monaco handles this */ setOpenMenu(null); } },
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
                { label: 'Clear Chat', shortcut: 'Ctrl+L', action: () => { useOllamaStore.getState().clearMessages(); setOpenMenu(null); }},
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
                    // Send clear command to active terminal
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

``n
## src\renderer\components\layout\SettingsModal.tsx

`$lang
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

``n
## src\renderer\components\layout\Sidebar.tsx

`$lang
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
    // Use the UI‑level flag that is updated every 5 s (see App.tsx)
    const ollamaConnected = useUIStore(state => state.ollamaConnected);
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
            // writeFile with a dummy file inside creates the folder
            await window.vibe.writeFile(`${projectPath}/${name}/.gitkeep`, '');
            setRefreshKey(k => k + 1);
        }
    };

    const handleRefresh = () => {
        setRefreshKey(k => k + 1);
    };

    const handleCollapseAll = () => {
        setRefreshKey(k => k + 1); // FileTree re-renders with all folders collapsed
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
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ollamaConnected ? 'var(--green)' : 'var(--error)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Ollama {ollamaConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }} title="IDE Settings">⚙</button>
            </div>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </GlassPanel>
    );
}

``n
## src\renderer\components\layout\TitleBar.tsx

`$lang
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

``n
## src\renderer\components\terminal\TerminalPane.tsx

`$lang
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
            useTerminalStore.getState().addSession({ id, title: 'Bash' }); // CRITICAL FIX
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

``n
## src\renderer\hooks\useBackgroundTerminal.ts

`$lang
import { useEffect } from 'react';
import { useTerminalStore } from '../store/terminal';
import { useUIStore } from '../store/ui';

export function useBackgroundTerminal() {
    useEffect(() => {
        const projectPath = useUIStore.getState().projectPath;
        window.vibe.createTerminal(projectPath || undefined).then((id: string) => {
            useTerminalStore.getState().addSession({ id, title: 'Background' });
            // Listen for data but don't render it — agent loop reads it via getTerminalOutput
            window.vibe.onTerminalData((_id: string, _data: string) => {
                // Silently buffer — terminal.ts handles buffering
            });
        }).catch(console.error);
    }, []);
}

``n
## src\renderer\hooks\useFileSystem.ts

`$lang
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

``n
## src\renderer\hooks\useOllama.ts

`$lang
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

``n
## src\renderer\hooks\useTerminal.ts

`$lang
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

``n
## src\renderer\store\editor.ts

`$lang
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

``n
## src\renderer\store\huggingface.ts

`$lang
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HFModel {
    id: string;
    name: string;
}

interface HFState {
    pinnedModels: HFModel[];
    hfApiKey: string;
    pinModel: (model: HFModel) => void;
    unpinModel: (id: string) => void;
    setHFApiKey: (key: string) => void;
}

export const useHFStore = create<HFState>()(
    persist(
        (set) => ({
            pinnedModels: [],
            hfApiKey: '',
            pinModel: (model) => set(state => ({
                pinnedModels: state.pinnedModels.find(m => m.id === model.id)
                    ? state.pinnedModels
                    : [...state.pinnedModels, model]
            })),
            unpinModel: (id) => set(state => ({
                pinnedModels: state.pinnedModels.filter(m => m.id !== id)
            })),
            setHFApiKey: (hfApiKey) => set({ hfApiKey }),
        }),
        { name: 'vibe-hf-storage' }
    )
);

``n
## src\renderer\store\ollama.ts

`$lang
import { create } from 'zustand';
import type { ChatMessage, ModelCapability } from '../../shared/types';
import { getCapabilities } from '../utils/capabilities';

interface OllamaState {
    connected: boolean;
    version: string | null;
    models: string[];
    /** key = model name → capability flags */
    modelCapabilities: Record<string, ModelCapability>;
    selectedModel: string;
    messages: ChatMessage[];
    isGenerating: boolean;
    agentStep: number;
    agentMaxSteps: number;
    agentStatus: string;
    
    // Thinking / Reasoning state
    isThinking: boolean;
    thinkingContent: string;
    thinkingStartTime: number | null;
    thinkingElapsed: number | null;
    thinkEnabled: boolean;
    thinkLevel: 'low' | 'medium' | 'high';

    setConnectionState: (connected: boolean, version: string | null) => void;
    setModels: (models: string[]) => void;
    /** Update capability flags for a single model (used when a user selects a custom model) */
    setModelCapability: (modelId: string, caps: ModelCapability) => void;
    setSelectedModel: (modelName: string) => void;
    addMessage: (msg: ChatMessage) => void;
    updateLastMessage: (content: string) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    setAgentStatus: (status: string) => void;
    setAgentStep: (step: number, max: number) => void;
    clearMessages: () => void;

    // Thinking methods
    startThinking: () => void;
    appendThinkContent: (content: string) => void;
    finalizeThinking: () => void;
    resetThinking: () => void;
    setThinkEnabled: (enabled: boolean) => void;
    setThinkLevel: (level: 'low' | 'medium' | 'high') => void;
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
    
    // Initial thinking state
    isThinking: false,
    thinkingContent: '',
    thinkingStartTime: null,
    thinkingElapsed: null,
    thinkEnabled: false,
    thinkLevel: 'medium',

    setConnectionState: (connected: boolean, version: string | null) => set({ connected, version }),
    setModels: (models: string[]) => set((state) => {
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
    setModelCapability: (modelId: string, caps: ModelCapability) => set(state => ({
        modelCapabilities: { ...state.modelCapabilities, [modelId]: caps }
    })),
    setSelectedModel: (selectedModel: string) => set({ selectedModel }),
    addMessage: (msg: ChatMessage) => set((state) => ({ messages: [...state.messages, msg] })),
    updateLastMessage: (content: string) => set((state) => {
        if (!content) return state;
        const newMessages = [...state.messages];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content: newMessages[newMessages.length - 1].content + content
            };
        }
        return { messages: newMessages };
    }),
    setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),
    setAgentStatus: (agentStatus: string) => set({ agentStatus }),
    setAgentStep: (agentStep: number, agentMaxSteps: number) => set({ agentStep, agentMaxSteps }),
    clearMessages: () => set({ messages: [], thinkingContent: '', isThinking: false, thinkingElapsed: null }),

    startThinking: () => set({ isThinking: true, thinkingContent: '', thinkingStartTime: Date.now(), thinkingElapsed: null }),
    appendThinkContent: (content) => set((state) => ({ thinkingContent: state.thinkingContent + content })),
    finalizeThinking: () => set((state) => ({
        isThinking: false,
        thinkingElapsed: state.thinkingStartTime ? Math.round((Date.now() - state.thinkingStartTime) / 1000) : null,
    })),
    resetThinking: () => set({ thinkingContent: '', isThinking: false, thinkingStartTime: null, thinkingElapsed: null }),

    setThinkEnabled: (thinkEnabled) => set({ thinkEnabled }),
    setThinkLevel: (thinkLevel) => set({ thinkLevel }),
}));


``n
## src\renderer\store\settings.ts

`$lang
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    apiKeys: {
        gemini: string;
        claude: string;
        openai: string;
        deepseek: string;
        groq: string;
        hf: string;
    };
    setApiKey: (provider: string, key: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKeys: {
                gemini: '',
                claude: '',
                openai: '',
                deepseek: '',
                groq: '',
                hf: ''
            },
            setApiKey: (provider, key) =>
                set((state) => ({
                    apiKeys: {
                        ...state.apiKeys,
                        [provider]: key
                    }
                }))
        }),
        { name: 'vibe-settings-storage' }
    )
);
``n
## src\renderer\store\swarms.ts

`$lang
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AgentNode {
    id: number;
    role: string;
    model: string;
    dependsOn?: number[]; // ids of agents this one waits for
}

export interface SwarmConfig {
    id: string;
    name: string;
    agents: AgentNode[];
}

export interface SwarmHandoff {
    originalRequest: string;
    previousAgentRole: string;
    previousAgentOutput: string;
    sharedContext: Record<string, string>; // agentRole -> output, accumulates
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

``n
## src\renderer\store\terminal.ts

`$lang
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

``n
## src\renderer\store\ui.ts

`$lang
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProjectMemory {
    lastSession: string;
    keyFiles: string[];
    architecturalDecisions: string[];
    currentPhase: string;
    updatedAt: string;
}

interface UIState {
    sidebarWidth: number;
    terminalHeight: number;
    showModelPicker: boolean;
    projectPath: string | null;
    ollamaConnected: boolean;
    vibeInstructions: string | null;
    projectMemory: ProjectMemory | null;
    setSidebarWidth: (width: number) => void;
    setTerminalHeight: (height: number) => void;
    setShowModelPicker: (show: boolean) => void;
    setProjectPath: (path: string | null) => void;
    setVibeInstructions: (instructions: string | null) => void;
    setOllamaConnected: (connected: boolean) => void;
    setProjectMemory: (memory: ProjectMemory | null) => void;
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
            projectMemory: null,
            ollamaConnected: false,
            setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
            setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
            setShowModelPicker: (showModelPicker) => set({ showModelPicker }),
            setProjectPath: (projectPath) => set({ projectPath }),
            setVibeInstructions: (vibeInstructions) => set({ vibeInstructions }),
            setOllamaConnected: (ollamaConnected) => set({ ollamaConnected }),
            setProjectMemory: (projectMemory) => set({ projectMemory }),
            isLoggedIn: false,
            setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn })
        }),
        { 
            name: 'vibe-ui-storage', 
            partialize: (state) => {
                const { vibeInstructions, projectMemory, ...rest } = state;
                return rest;
            }
        }
    )
);

``n
## src\renderer\store\workspaces.ts

`$lang
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

``n
## src\renderer\styles\globals.css

`$lang
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  /* Mesh gradient background */
  --bg-mesh: 
    radial-gradient(ellipse at 20% 0%, rgba(0,100,255,0.06) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(0,170,255,0.05) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(255,140,50,0.03) 0%, transparent 60%),
    linear-gradient(180deg, #f8f9fc 0%, #f0f1f6 100%);

  /* Glass - strong variant (title bar, chat bar) */
  --glass-bg: rgba(255, 255, 255, 0.72);
  --glass-blur: blur(24px);
  --glass-border: 1px solid rgba(255, 255, 255, 0.45);
  --glass-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.8);

  /* Glass - panel variant (sidebar, editor, terminal, right pane) */
  --panel-bg: rgba(255, 255, 255, 0.55);
  --panel-blur: blur(16px);
  --panel-border: 1px solid rgba(255, 255, 255, 0.5);
  --panel-shadow: 0 2px 12px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.9);

  /* Text */
  --text: #1a1a2e;
  --text-secondary: #4a4a68;
  --text-muted: #8888a0;
  --text-faint: #aab0c0;

  /* Accent */
  --accent: #0066ff;
  --accent-gradient: linear-gradient(135deg, #0055ff, #0088ff, #00aaff);
  --accent-light: rgba(0, 102, 255, 0.06);
  --accent-medium: rgba(0, 102, 255, 0.12);

  /* Semantic */
  --green: #00a870;
  --green-light: rgba(0, 168, 112, 0.08);
  --warn: #e68a00;
  --warn-light: rgba(230, 138, 0, 0.08);
  --error: #e03050;

  /* Borders */
  --border: rgba(0, 0, 0, 0.08);
  --border-light: rgba(0, 0, 0, 0.04);

  /* Typography */
  --font-sans: 'DM Sans', 'SF Pro Display', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  /* Layout */
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

/* Custom scrollbars */
*::-webkit-scrollbar { width: 5px; height: 5px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 3px; }
*::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.18); }

/* Animations */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
@keyframes spin { to { transform: rotate(360deg); } }

/* Selection */
::selection { background: var(--accent-medium); }

/* Focus */
input:focus, textarea:focus { outline: none; border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(0,102,255,0.1) !important; }

/* Draggable region for custom title bar */
.titlebar-drag { -webkit-app-region: drag; }
.titlebar-drag button, .titlebar-drag input, .titlebar-drag [data-clickable] { -webkit-app-region: no-drag; }

``n
## src\renderer\utils\capabilities.ts

`$lang
import type { ModelCapability } from '../../shared/types';

export const OLLAMA_ONLY_MODELS = new Set<string>([
    'gpt-oss-120b',
]);

export function getCapabilities(modelId: string): ModelCapability {
    const lower = modelId.toLowerCase();
    const caps: ModelCapability = {};

    caps.canExecute = true; 
    caps.requiresApproval = true;

    if (
        lower.includes('qwq') ||
        lower.includes('deepseek-r1') ||
        lower.includes('r1') ||
        lower.includes('claude-3-7') ||
        lower.includes('claude-3-5')
    ) {
        caps.think = true;
        caps.thinkBudget = 'tiered';
    }

    if (
        lower.includes('qwen3') ||
        lower.includes('qwen2.5') ||
        lower.includes('gemma3')
    ) {
        caps.think = true;
        caps.thinkBudget = 'toggle';
    }

    if (lower.includes('vl') || lower.includes('vision') || lower.includes('llava') || lower.includes('gemini') || lower.includes('gpt-4o') || lower.includes('claude-3-5') || lower.includes('claude-3-7')) {
        caps.image = true;
    }

    if (lower.includes('reasoner') || lower.includes('r1') || lower.includes('o1') || lower.includes('o3') || lower.includes('sonnet') || lower.includes('deepseek')) {
        caps.think = true;
    }

    if (lower.includes('gemini') || lower.includes('gpt-4o') || lower.includes('claude') || lower.includes('cloud')) {
        caps.web = true;
    }

    return caps;
}

``n
## src\renderer\utils\streamBus.ts

`$lang
type StreamChunk = { content: string; done: boolean };
type StreamHandler = (chunk: StreamChunk) => void;

class StreamBus {
    private handlers = new Set<StreamHandler>();

    subscribe(fn: StreamHandler): () => void {
        this.handlers.add(fn);
        return () => this.handlers.delete(fn);
    }

    emit(chunk: StreamChunk) {
        this.handlers.forEach(fn => fn(chunk));
    }
}

export const streamBus = new StreamBus();

``n
## src\renderer\utils\tags.ts

`$lang
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

``n
## src\renderer\utils\terminal.ts

`$lang
export function cleanTerminalOutput(raw: string): string {
    return raw
        .replace(/\x1b\[[0-9;]*[mGKHFABCDJsu]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter(line => {
            const l = line.trim();
            if (l.length === 0) return false;
            // Remove PowerShell banner lines only
            if (l.startsWith('Windows PowerShell')) return false;
            if (l.includes('Microsoft Corporation') && l.includes('rights reserved')) return false;
            if (l.includes('aka.ms/pscore6')) return false;
            if (l.startsWith('Try the new cross-platform')) return false;
            // Remove bare PS prompt lines like "PS C:\Users\foo>"
            if (/^PS [A-Za-z]:\\[^>]*>\s*$/.test(l)) return false;
            return true;
        })
        .join('\n')
        .trim();
}

``n
## src\shared\constants.ts

`$lang
export const OLLAMA_ONLY_MODELS = new Set<string>([
  'gpt-oss-120b',
]);

``n
## src\shared\types.ts

`$lang
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
    thinkBudget?: 'toggle' | 'tiered'; // toggle = on/off only, tiered = low/med/high
}
export interface VibeAPI {
    // Terminal
    createTerminal: (cwd?: string) => Promise<string>;
    sendTerminalInput: (id: string, data: string) => Promise<void>;
    getTerminalOutput: (id: string) => Promise<string>;
    clearTerminalOutput: (id: string) => Promise<void>;
    onTerminalData: (callback: (id: string, data: string) => void) => void;
    killTerminal: (id: string) => Promise<void>;
    resizeTerminal: (id: string, cols: number, rows: number) => Promise<void>;

    // Filesystem
    openFolder: () => Promise<string | null>;
    readDir: (dirPath: string) => Promise<FileEntry[]>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    watchFolder: (dirPath: string) => Promise<void>;
    onFolderChanged: (callback: () => void) => void;
    readMemory: (projectPath: string) => Promise<string | null>;
    writeMemory: (projectPath: string, memory: any) => Promise<boolean>;

    // Ollama / AI
    detectOllama: () => Promise<{ detected: boolean, version?: string }>;
    statusOllama: () => Promise<boolean>;
    listModels: () => Promise<string[]>;
    chat: (model: string, messages: ChatMessage[], apiKeys?: Record<string, string>, thinkOptions?: any) => Promise<void>;
    onChatStream: (callback: (chunk: { content: string, done: boolean }) => void) => void;
    stopGeneration: () => Promise<void>;
    log: (msg: string) => Promise<void>;

    // Window
    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
}

declare global {
    interface Window {
        vibe: VibeAPI;
    }
}

``n
