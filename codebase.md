================================================================
File: src\main\index.ts
================================================================
`ts
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// IPC Handlers
import { registerFileSystemHandlers } from './ipc/filesystem';
import { registerTerminalHandlers } from './ipc/terminal';
import { registerOllamaHandlers } from './ipc/ollama';
import { registerObsidianHandlers } from './ipc/obsidian';
import { backgroundManager } from './ipc/agent/backgroundManager';

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
    registerObsidianHandlers();

    ipcMain.handle('agent:startForProject', async (_event, projectPath: string, obsidianKey?: string) => {
        backgroundManager.startForProject(projectPath);
        if (obsidianKey) backgroundManager.setObsidianKey(obsidianKey);
        return { success: true };
    });

    ipcMain.handle('agent:getBriefing', async () => {
        return backgroundManager.getBriefing();
    });

    ipcMain.handle('agent:logAction', async (_event, description: string) => {
        backgroundManager.logAgentAction(description);
    });

    ipcMain.handle('agent:generateExport', async (_event, outputPath: string) => {
        return backgroundManager.generateExport(outputPath);
    });

    ipcMain.handle('agent:setObsidianKey', async (_event, key: string) => {
        backgroundManager.setObsidianKey(key);
    });

    // Neural widget status polling
    ipcMain.handle('agent:getStatus', async () => {
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

`

================================================================
File: src\main\ipc\agent\backgroundManager.ts
================================================================
`ts
import { CollectorAgent, CollectorStatus } from './collector'
import { ReviewerAgent, ReviewerStatus } from './reviewer'

export interface AgentStatusSnapshot {
  collector: CollectorStatus
  reviewer: ReviewerStatus
}

export class BackgroundManager {
  collector: CollectorAgent = new CollectorAgent()
  reviewer: ReviewerAgent = new ReviewerAgent()
  currentProjectPath: string | null = null

  startForProject(projectPath: string) {
    if (this.currentProjectPath === projectPath) return
    this.collector.stop()
    this.reviewer.stop()
    this.collector.onBriefingNeeded = () => this.reviewer.triggerBriefing()
    this.collector.start(projectPath)
    this.reviewer.start(projectPath)
    this.currentProjectPath = projectPath
    console.log('[BackgroundManager] Agents started for:', projectPath)
  }

  stop() {
    this.collector.stop()
    this.reviewer.stop()
    this.currentProjectPath = null
  }

  getBriefing(): string {
    return this.reviewer.getBriefing()
  }

  logAgentAction(description: string) {
    this.collector.logAgentAction(description)
  }

  generateExport(outputPath: string): boolean {
    return this.collector.generateNotebookLMExport(outputPath)
  }

  setObsidianKey(key: string) {
    this.collector.setObsidianKey(key)
    this.reviewer.setObsidianKey(key)
  }

  // For neural widget — returns live status of both agents
  getAgentStatus(): AgentStatusSnapshot {
    return {
      collector: this.collector.getStatus(),
      reviewer: this.reviewer.getStatus()
    }
  }
}

export const backgroundManager = new BackgroundManager()

`

================================================================
File: src\main\ipc\agent\collector.ts
================================================================
`ts
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

const OLLAMA_BASE = 'http://localhost:11434'
const COLLECTOR_MODEL = 'glm-5:cloud'
const MAX_EVENTS = 200
const DISTILL_INTERVAL_MS = 3 * 60 * 60 * 1000
const HEALTH_UPDATE_INTERVAL_MS = 60 * 1000

interface CollectorEvent {
  ts: number
  type: 'file_changed' | 'file_created' | 'file_deleted' |
        'build_failed' | 'build_succeeded' | 'git_changed' |
        'agent_action' | 'test_result'
  path?: string
  detail?: string
}

interface HealthState {
  updatedAt: string
  projectPath: string
  projectName: string
  git: { branch: string; uncommittedChanges: number; lastCommit: string }
  recentChanges: string[]
  openTodos: string[]
  projectLanguage: string
  framework: string
  eventCount: number
}

// Status broadcast — renderer reads this for the neural widget
export interface CollectorStatus {
  isRunning: boolean
  eventCount: number
  lastEventTime: number | null
  isDistilling: boolean
  lastDistillTime: number | null
}

export class CollectorAgent {
  projectPath: string | null = null
  vibeDir: string | null = null
  events: CollectorEvent[] = []
  watcher: any = null
  healthInterval: any = null
  distillInterval: any = null
  isRunning: boolean = false
  isDistilling: boolean = false
  onBriefingNeeded: (() => void) | null = null
  newEventsSinceBriefing: number = 0
  obsidianApiKey: string | null = null
  lastEventTime: number | null = null
  lastDistillTime: number | null = null

  // Status snapshot for neural widget
  getStatus(): CollectorStatus {
    return {
      isRunning: this.isRunning,
      eventCount: this.events.length,
      lastEventTime: this.lastEventTime,
      isDistilling: this.isDistilling,
      lastDistillTime: this.lastDistillTime
    }
  }

  setObsidianKey(key: string) { this.obsidianApiKey = key }

  start(projectPath: string) {
    this.projectPath = projectPath
    this.vibeDir = path.join(projectPath, '.vibe')
    try { fs.mkdirSync(this.vibeDir, { recursive: true }) } catch {}
    const eventsLog = path.join(this.vibeDir, 'events.log')
    if (!fs.existsSync(eventsLog)) {
      try { fs.writeFileSync(eventsLog, '') } catch {}
    }
    this.startFileWatcher()
    this.startHealthLoop()
    this.startDistillLoop()
    this.isRunning = true
    console.log('[Collector] Started for:', projectPath)
  }

  stop() {
    if (this.watcher) { try { this.watcher.close() } catch {} }
    if (this.healthInterval) clearInterval(this.healthInterval)
    if (this.distillInterval) clearInterval(this.distillInterval)
    this.isRunning = false
  }

  startFileWatcher() {
    if (!this.projectPath) return
    const IGNORE = ['node_modules','.git','dist','build','out',
                    '.vibe','__pycache__','.next','target']
    try {
      this.watcher = fs.watch(
        this.projectPath,
        { recursive: true },
        (_eventType: string, filename: string | null) => {
          if (!filename) return
          const norm = filename.replace(/\\/g, '/')
          if (IGNORE.some(ig => norm.includes(ig))) return
          this.addEvent({ ts: Date.now(), type: 'file_changed', path: filename })
        }
      )
    } catch (e) {
      console.log('[Collector] Watcher error (non-fatal):', e)
    }
  }

  addEvent(event: CollectorEvent) {
    this.events.push(event)
    if (this.events.length > MAX_EVENTS) this.events.shift()
    this.lastEventTime = Date.now()
    if (this.vibeDir) {
      try {
        fs.appendFileSync(
          path.join(this.vibeDir, 'events.log'),
          JSON.stringify(event) + '\n'
        )
      } catch {}
    }
    this.newEventsSinceBriefing++
    if (this.newEventsSinceBriefing >= 5 && this.onBriefingNeeded) {
      this.onBriefingNeeded()
      this.newEventsSinceBriefing = 0
    }
  }

  logAgentAction(description: string) {
    this.addEvent({ ts: Date.now(), type: 'agent_action', detail: description })
  }

  startHealthLoop() {
    this.updateHealth()
    this.healthInterval = setInterval(
      () => this.updateHealth(),
      HEALTH_UPDATE_INTERVAL_MS
    )
  }

  updateHealth() {
    if (!this.projectPath || !this.vibeDir) return
    try {
      let branch = 'unknown', uncommittedChanges = 0, lastCommit = 'none'
      try {
        branch = execSync('git branch --show-current',
          { cwd: this.projectPath, windowsHide: true, encoding: 'utf8' }
        ).trim()
      } catch {}
      try {
        const status = execSync('git status --short',
          { cwd: this.projectPath, windowsHide: true, encoding: 'utf8' }
        ).trim()
        uncommittedChanges = status ? status.split('\n').filter(l => l.trim()).length : 0
      } catch {}
      try {
        lastCommit = execSync('git log -1 --format="%s"',
          { cwd: this.projectPath, windowsHide: true, encoding: 'utf8' }
        ).trim()
      } catch {}

      const recentChanged = this.events
        .filter(e => e.type === 'file_changed' && e.path)
        .slice(-10)
        .map(e => e.path!)

      const openTodos: string[] = []
      for (const fp of recentChanged.slice(0, 5)) {
        try {
          const full = path.join(this.projectPath!, fp)
          const content = fs.readFileSync(full, 'utf8')
          const lines = content.split('\n')
          for (const line of lines) {
            if ((line.includes('TODO') || line.includes('FIXME')) && openTodos.length < 5) {
              openTodos.push(`${fp}: ${line.trim().slice(0, 80)}`)
            }
          }
        } catch {}
      }

      const extCounts: Record<string, number> = {}
      for (const e of this.events) {
        if (e.path) {
          const ext = path.extname(e.path).toLowerCase()
          extCounts[ext] = (extCounts[ext] || 0) + 1
        }
      }
      const topExt = Object.entries(extCounts).sort((a,b) => b[1]-a[1])[0]?.[0] || ''
      const langMap: Record<string,string> = {
        '.cpp':'C++','.h':'C++','.hpp':'C++',
        '.ts':'TypeScript','.tsx':'TypeScript',
        '.py':'Python','.rs':'Rust','.go':'Go'
      }
      const projectLanguage = langMap[topExt] || 'Unknown'

      let framework = 'Unknown'
      try {
        if (fs.existsSync(path.join(this.projectPath!, 'CMakeLists.txt'))) framework = 'Qt/CMake'
        else if (fs.existsSync(path.join(this.projectPath!, 'package.json'))) framework = 'Node.js'
        else if (fs.existsSync(path.join(this.projectPath!, 'Cargo.toml'))) framework = 'Rust'
      } catch {}

      const health: HealthState = {
        updatedAt: new Date().toISOString(),
        projectPath: this.projectPath!,
        projectName: path.basename(this.projectPath!),
        git: { branch, uncommittedChanges, lastCommit },
        recentChanges: recentChanged.slice(-5),
        openTodos,
        projectLanguage,
        framework,
        eventCount: this.events.length
      }

      fs.writeFileSync(
        path.join(this.vibeDir, 'health.json'),
        JSON.stringify(health, null, 2)
      )

      if (this.obsidianApiKey) {
        this.syncToObsidian(this.obsidianApiKey, health).catch(() => {})
      }
    } catch (e) {
      console.log('[Collector] updateHealth error (non-fatal):', e)
    }
  }

  async syncToObsidian(apiKey: string, health: HealthState) {
    try {
      const { obsidianUpsert } = await import('../obsidian')
      const projectName = path.basename(this.projectPath || '')
      const overview = `# ${projectName} — Project Overview
Updated: ${new Date().toLocaleString()}

## Health
- Branch: ${health.git.branch}
- Uncommitted changes: ${health.git.uncommittedChanges}
- Last commit: ${health.git.lastCommit}
- Language: ${health.projectLanguage}
- Framework: ${health.framework}

## Recent Changes
${health.recentChanges.map(c => '- ' + c).join('\n') || '- No recent changes'}

## Open TODOs
${health.openTodos.map(t => '- ' + t).join('\n') || '- None found'}
`
      await obsidianUpsert(apiKey, `VIBE/${projectName}/Project Overview.md`, overview)
    } catch {}
  }

  startDistillLoop() {
    this.distillInterval = setInterval(
      () => this.distillEvents(),
      DISTILL_INTERVAL_MS
    )
  }

  async distillEvents() {
    if (this.events.length === 0) return
    this.isDistilling = true
    try {
      const recentEvents = this.events.slice(-20)
      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: COLLECTOR_MODEL,
          messages: [
            {
              role: 'system',
              content: 'You are a project intelligence agent. Summarize these recent project events into 3-5 concise facts. Each fact on its own line. Facts should be durable observations about the project state, not one-time events. Format: FACT: [observation]'
            },
            {
              role: 'user',
              content: 'Recent events:\n' + recentEvents.map(e =>
                `${new Date(e.ts).toISOString()} [${e.type}] ${e.path || ''} ${e.detail || ''}`
              ).join('\n')
            }
          ],
          stream: false
        })
      })
      const data = await res.json() as any
      const content: string = data.message?.content || ''
      const newFacts = content.split('\n')
        .filter((l: string) => l.startsWith('FACT:'))
        .map((l: string) => l.replace('FACT:', '').trim())

      if (newFacts.length > 0 && this.vibeDir) {
        const factsPath = path.join(this.vibeDir, 'facts.json')
        let existing: string[] = []
        try {
          const raw = JSON.parse(fs.readFileSync(factsPath, 'utf8'))
          existing = raw.facts || []
        } catch {}
        const combined = [...existing, ...newFacts].slice(-30)
        fs.writeFileSync(factsPath, JSON.stringify({
          updatedAt: new Date().toISOString(),
          facts: combined
        }, null, 2))
        this.lastDistillTime = Date.now()
      }
    } catch {}
    this.isDistilling = false
  }

  generateNotebookLMExport(outputPath: string): boolean {
    try {
      if (!this.vibeDir) return false
      let healthData: any = {}
      let factsData: any = {}
      let recentEvents: string[] = []
      try { healthData = JSON.parse(fs.readFileSync(path.join(this.vibeDir,'health.json'),'utf8')) } catch {}
      try { factsData = JSON.parse(fs.readFileSync(path.join(this.vibeDir,'facts.json'),'utf8')) } catch {}
      try {
        const raw = fs.readFileSync(path.join(this.vibeDir,'events.log'),'utf8')
        recentEvents = raw.trim().split('\n').filter(Boolean).slice(-20)
          .map(l => { try { const e = JSON.parse(l); return `- [${e.type}] ${e.path || e.detail || ''}`; } catch { return '' } })
          .filter(Boolean)
      } catch {}
      const md = `# VIBE Project Knowledge Export
Generated: ${new Date().toISOString()}
Project: ${healthData.projectName || 'Unknown'}

## Current Project Health
- Branch: ${healthData.git?.branch || 'unknown'}
- Uncommitted changes: ${healthData.git?.uncommittedChanges ?? 0}
- Last commit: ${healthData.git?.lastCommit || 'none'}
- Language: ${healthData.projectLanguage || 'unknown'}
- Framework: ${healthData.framework || 'unknown'}

## Key Facts
${(factsData.facts || []).map((f: string) => `- ${f}`).join('\n') || '- None yet'}

## Recent Activity
${recentEvents.join('\n') || '- No activity yet'}
`
      fs.writeFileSync(outputPath, md)
      return true
    } catch { return false }
  }
}

`

================================================================
File: src\main\ipc\agent\reviewer.ts
================================================================
`ts
import fs from 'node:fs'
import path from 'node:path'

const OLLAMA_BASE = 'http://localhost:11434'
const REVIEWER_MODEL = 'glm-5:cloud'
const REVIEW_INTERVAL_MS = 10 * 60 * 1000

export interface ReviewerStatus {
  isRunning: boolean
  isSynthesizing: boolean
  lastBriefingTime: number
  briefingCount: number
}

export class ReviewerAgent {
  projectPath: string | null = null
  vibeDir: string | null = null
  reviewInterval: any = null
  isRunning: boolean = false
  isSynthesizing: boolean = false
  lastBriefingTime: number = 0
  briefingCount: number = 0
  obsidianApiKey: string | null = null

  getStatus(): ReviewerStatus {
    return {
      isRunning: this.isRunning,
      isSynthesizing: this.isSynthesizing,
      lastBriefingTime: this.lastBriefingTime,
      briefingCount: this.briefingCount
    }
  }

  setObsidianKey(key: string) { this.obsidianApiKey = key }

  start(projectPath: string) {
    this.projectPath = projectPath
    this.vibeDir = path.join(projectPath, '.vibe')
    this.generateBriefing()
    this.reviewInterval = setInterval(
      () => this.generateBriefing(),
      REVIEW_INTERVAL_MS
    )
    this.isRunning = true
    console.log('[Reviewer] Started, generating initial briefing...')
  }

  stop() {
    if (this.reviewInterval) clearInterval(this.reviewInterval)
    this.isRunning = false
  }

  triggerBriefing() {
    const now = Date.now()
    if (now - this.lastBriefingTime < 2 * 60 * 1000) return
    this.generateBriefing()
  }

  async generateBriefing() {
    if (!this.projectPath || !this.vibeDir) return
    if (this.isSynthesizing) return
    this.isSynthesizing = true
    try {
      let healthData: any = {}
      let factsData: any = {}
      try { healthData = JSON.parse(fs.readFileSync(path.join(this.vibeDir,'health.json'),'utf8')) } catch {}
      try { factsData = JSON.parse(fs.readFileSync(path.join(this.vibeDir,'facts.json'),'utf8')) } catch {}

      let recentAgentLog = ''
      try {
        const projectName = path.basename(this.projectPath)
        const logPath = path.join(this.vibeDir,'vault',projectName,'Agent Log.md')
        const raw = fs.readFileSync(logPath,'utf8')
        recentAgentLog = raw.slice(-500)
      } catch {}

      const systemPrompt = `You are VIBE's project intelligence synthesizer.
Your job is to create a concise, accurate briefing about this project
that will be given to an AI coding assistant before it responds to the user.
The briefing must be factual, specific, and actionable.
Maximum 300 words. Focus on: what the project is, current state,
what's broken or incomplete, what was recently worked on.
Never make up information. If uncertain, omit it.`

      const userPrompt = `Create a project briefing from this information:

HEALTH STATE:
${JSON.stringify(healthData, null, 2)}

KNOWN FACTS:
${factsData.facts ? factsData.facts.join('\n') : 'None yet'}

RECENT AGENT ACTIVITY:
${recentAgentLog || 'No activity yet'}

Output the briefing as plain text. No headers. No XML.
Just a clear paragraph or two that tells an AI what it needs to know
about this project right now.`

      const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: REVIEWER_MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          stream: false
        })
      })
      const data = await res.json() as any
      const responseContent: string = data.message?.content || ''

      if (!responseContent) { this.isSynthesizing = false; return }

      const briefing = {
        generatedAt: new Date().toISOString(),
        projectPath: this.projectPath,
        projectName: path.basename(this.projectPath),
        content: responseContent,
        healthSnapshot: {
          branch: healthData.git?.branch || 'unknown',
          uncommittedChanges: healthData.git?.uncommittedChanges || 0,
          recentChanges: healthData.recentChanges || [],
          openTodos: healthData.openTodos || []
        }
      }

      fs.writeFileSync(
        path.join(this.vibeDir, 'briefing.json'),
        JSON.stringify(briefing, null, 2)
      )

      this.lastBriefingTime = Date.now()
      this.briefingCount++
      console.log('[Reviewer] Briefing updated at', new Date().toISOString())

      if (this.obsidianApiKey) {
        try {
          const { obsidianUpsert } = await import('../obsidian')
          const projectName = path.basename(this.projectPath)
          await obsidianUpsert(
            this.obsidianApiKey,
            `VIBE/${projectName}/Context Briefing.md`,
            `# Context Briefing\nUpdated: ${new Date().toLocaleString()}\n\n${responseContent}`
          )
        } catch {}
      }
    } catch (e) {
      console.log('[Reviewer] generateBriefing error (non-fatal):', e)
    }
    this.isSynthesizing = false
  }

  getBriefing(): string {
    try {
      if (!this.vibeDir) return 'No project briefing available yet.'
      const raw = fs.readFileSync(path.join(this.vibeDir,'briefing.json'),'utf8')
      const briefing = JSON.parse(raw)
      const age = Date.now() - new Date(briefing.generatedAt).getTime()
      if (age > 30 * 60 * 1000) return 'No project briefing available yet.'
      return briefing.content || 'No project briefing available yet.'
    } catch {
      return 'No project briefing available yet.'
    }
  }
}

`

================================================================
File: src\main\ipc\filesystem.ts
================================================================
`ts
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

`

================================================================
File: src\main\ipc\obsidian.ts
================================================================
`ts
import https from 'https'

const OBSIDIAN_BASE = 'https://localhost:27124'

// Default key — user should update via Settings
// FIND THIS LINE AND REPLACE WITH YOUR KEY:
const DEFAULT_OBSIDIAN_KEY = '27c5482a10686cb5e7de52ad24c554a4ddad4e96f4155e20f5f2813e3152df6e'

async function obsidianRequest(
  endpoint: string,
  apiKey: string,
  method: string,
  body?: string
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const url = new URL(`${OBSIDIAN_BASE}${endpoint}`)
      const options: any = {
        hostname: url.hostname,
        port: parseInt(url.port) || 27124,
        path: url.pathname + (url.search || ''),
        method,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'text/markdown',
        },
        rejectUnauthorized: false
      }
      if (body) {
        options.headers['Content-Length'] = Buffer.byteLength(body)
      }
      const req = https.request(options, (res) => {
        resolve(!!res.statusCode && res.statusCode < 400)
        res.resume()
      })
      req.on('error', () => resolve(false))
      req.setTimeout(3000, () => { req.destroy(); resolve(false) })
      if (body) req.write(body)
      req.end()
    } catch {
      resolve(false)
    }
  })
}

export async function obsidianUpsert(
  apiKey: string,
  vaultPath: string,
  content: string
): Promise<void> {
  await obsidianRequest(
    `/vault/${encodeURIComponent(vaultPath)}`,
    apiKey || DEFAULT_OBSIDIAN_KEY,
    'PUT',
    content
  )
}

export async function obsidianAppend(
  apiKey: string,
  vaultPath: string,
  content: string
): Promise<void> {
  await obsidianRequest(
    `/vault/${encodeURIComponent(vaultPath)}`,
    apiKey || DEFAULT_OBSIDIAN_KEY,
    'POST',
    content
  )
}

export function registerObsidianHandlers() {
  const { ipcMain } = require('electron')

  ipcMain.handle('obsidian:ping', async (_: any, apiKey: string) => {
    return obsidianRequest('/', apiKey || DEFAULT_OBSIDIAN_KEY, 'GET')
  })

  ipcMain.handle('obsidian:upsertNote', async (
    _: any, apiKey: string, vaultPath: string, content: string
  ) => {
    return obsidianRequest(
      `/vault/${encodeURIComponent(vaultPath)}`,
      apiKey || DEFAULT_OBSIDIAN_KEY,
      'PUT', content
    )
  })

  ipcMain.handle('obsidian:appendNote', async (
    _: any, apiKey: string, vaultPath: string, content: string
  ) => {
    return obsidianRequest(
      `/vault/${encodeURIComponent(vaultPath)}`,
      apiKey || DEFAULT_OBSIDIAN_KEY,
      'POST', content
    )
  })
}

`

================================================================
File: src\main\ipc\ollama.ts
================================================================
`ts
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
            // /api/tags returns ALL installed models regardless
            // of whether they are loaded in memory or not
            const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) return [];
            const data = await res.json();
            // data.models is array of { name, size, digest, details }
            // Return all names sorted alphabetically
            const models: string[] = (data.models || [])
                .map((m: any) => m.name as string)
                .sort((a: string, b: string) => a.localeCompare(b));
            return models;
        } catch {
            return [];
        }
    });

    ipcMain.handle('ollama:getLoadedModels', async () => {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/ps`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.models || []).map((m: any) => m.name as string);
        } catch {
            return [];
        }
    });

    ipcMain.handle('ollama:getCapabilities', async (_event, modelName: string) => {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelName })
            });
            if (!res.ok) return null;
            const data = await res.json();

            const capabilities: string[] = data.capabilities || [];
            const family: string = data.details?.family?.toLowerCase() || '';
            const template: string = data.template || '';
            const parameters: string = data.parameters || '';

            // Detect think/reasoning
            const hasThink =
                capabilities.includes('thinking') ||
                capabilities.includes('reasoning') ||
                family.includes('deepseek-r1') ||
                family.includes('qwq') ||
                template.includes('<think>') ||
                template.includes('[THINKING]') ||
                modelName.toLowerCase().includes('r1') ||
                modelName.toLowerCase().includes('qwq') ||
                modelName.toLowerCase().includes('deepseek-r1');

            // Detect think budget type
            const thinkBudget =
                modelName.toLowerCase().includes('claude-3-7') ||
                modelName.toLowerCase().includes('claude-3-5')
                    ? 'tiered'
                    : hasThink ? 'toggle' : undefined;

            // Detect vision
            const hasVision =
                capabilities.includes('vision') ||
                family.includes('vision') ||
                modelName.toLowerCase().includes('vision') ||
                modelName.toLowerCase().includes('vl') ||
                modelName.toLowerCase().includes('llava') ||
                modelName.toLowerCase().includes('llama3.2-vision') ||
                modelName.toLowerCase().includes('minicpm-v') ||
                modelName.toLowerCase().includes('moondream') ||
                modelName.toLowerCase().includes('llama4');

            // Detect tool calling
            const hasTools =
                capabilities.includes('tools') ||
                capabilities.includes('tool_use') ||
                modelName.toLowerCase().includes('qwen3') ||
                modelName.toLowerCase().includes('qwen2.5') ||
                modelName.toLowerCase().includes('llama3.1') ||
                modelName.toLowerCase().includes('llama3.2') ||
                modelName.toLowerCase().includes('llama3.3') ||
                modelName.toLowerCase().includes('mistral') ||
                modelName.toLowerCase().includes('command-r') ||
                modelName.toLowerCase().includes('granite') ||
                modelName.toLowerCase().includes('phi4');

            // Extract context length
            const ctxMatch = parameters.match(/num_ctx\s+(\d+)/);
            const contextLength = ctxMatch ? parseInt(ctxMatch[1]) : 4096;

            return {
                modelName,
                think: hasThink,
                thinkBudget,
                vision: hasVision,
                tools: hasTools,
                contextLength,
                family,
                rawCapabilities: capabilities
            };
        } catch {
            return null;
        }
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

`

================================================================
File: src\main\ipc\terminal.ts
================================================================
`ts
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

`

================================================================
File: src\main\preload.ts
================================================================
`ts
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
    getModelCapabilities: (modelName: string) => ipcRenderer.invoke('ollama:getCapabilities', modelName),
    getLoadedModels: () => ipcRenderer.invoke('ollama:getLoadedModels'),

    // BACKGROUND AGENTS
    startBackgroundAgents: (projectPath: string, obsidianKey?: string) =>
        ipcRenderer.invoke('agent:startForProject', projectPath, obsidianKey),
    getBriefing: () =>
        ipcRenderer.invoke('agent:getBriefing'),
    logAgentAction: (description: string) =>
        ipcRenderer.invoke('agent:logAction', description),
    generateNotebookExport: (outputPath: string) =>
        ipcRenderer.invoke('agent:generateExport', outputPath),
    setObsidianKey: (key: string) =>
        ipcRenderer.invoke('agent:setObsidianKey', key),
    getAgentStatus: () =>
        ipcRenderer.invoke('agent:getStatus'),

    // OBSIDIAN INTEGRATION
    obsidianPing: (apiKey: string) =>
        ipcRenderer.invoke('obsidian:ping', apiKey),
    obsidianUpsertNote: (apiKey: string, vaultPath: string, content: string) =>
        ipcRenderer.invoke('obsidian:upsertNote', apiKey, vaultPath, content),
    obsidianAppendNote: (apiKey: string, vaultPath: string, content: string) =>
        ipcRenderer.invoke('obsidian:appendNote', apiKey, vaultPath, content),
    obsidianUpdateProject: (
        apiKey: string,
        projectName: string,
        projectStructure: string,
        projectPath: string
    ) => ipcRenderer.invoke(
        'obsidian:updateProjectNote',
        apiKey, projectName, projectStructure, projectPath
    ),
    obsidianLogRun: (
        apiKey: string,
        projectName: string,
        mission: string,
        model: string,
        steps: string[],
        result: string,
        criteraMet: string
    ) => ipcRenderer.invoke(
        'obsidian:logAgentRun',
        apiKey, projectName, mission, model, steps, result, criteraMet
    ),
    obsidianLogDecision: (
        apiKey: string,
        projectName: string,
        summary: string,
        filesChanged: string
    ) => ipcRenderer.invoke(
        'obsidian:logDecision',
        apiKey, projectName, summary, filesChanged
    ),

    // WINDOW CONTROLS
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
});

`

================================================================
File: src\renderer\App.tsx
================================================================
`ts
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
import { NeuralWidget } from './components/agent/NeuralWidget';

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
                streamBus.emit({ content: chunk.content, done: false });
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
                streamBus.emit({ content: '', done: true });
                window.vibe.log('[STREAM] Stream completed and resolved');
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
            <NeuralWidget />
        </div>
    );
}

`

================================================================
File: src\renderer\components\agent\NeuralWidget.tsx
================================================================
`ts
import React, { useEffect, useRef, useState, useCallback } from 'react'

interface AgentStatus {
  collector: {
    isRunning: boolean
    eventCount: number
    lastEventTime: number | null
    isDistilling: boolean
    lastDistillTime: number | null
  }
  reviewer: {
    isRunning: boolean
    isSynthesizing: boolean
    lastBriefingTime: number
    briefingCount: number
  }
}

export function NeuralWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tRef = useRef(0)
  const statusRef = useRef<AgentStatus | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<AgentStatus | null>(null)

  // Poll agent status every 2 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const s = await window.vibe.getAgentStatus()
        setStatus(s)
        statusRef.current = s
      } catch {}
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  // Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width = 200
    const H = canvas.height = 90

    // Internal simulation state
    let sparks: Array<{
      t: number; speed: number; arc: number
      size: number; trail: Array<{x:number;y:number}>; hue: number
    }> = []
    let shockwaves: Array<{x:number;y:number;r:number;maxR:number;t:number;hue:number}> = []
    let lastEventCount = 0
    let lastSynthesizing = false
    let reviewerGlow = 0
    let collectorFlare = 0
    let synapseFlow = 0

    const N1 = { x: 45, y: H / 2 }
    const N2 = { x: W - 45, y: H / 2 }
    const NR = 18

    function spawnSparks() {
      for (let i = 0; i < 4; i++) {
        sparks.push({
          t: 0,
          speed: 0.012 + Math.random() * 0.015,
          arc: (Math.random() - 0.5) * 1.0,
          size: 1.5 + Math.random() * 2,
          trail: [],
          hue: 195 + Math.random() * 30
        })
      }
    }

    function spawnShockwave(x: number, y: number, hue: number) {
      shockwaves.push({ x, y, r: NR, maxR: NR + 35, t: 0, hue })
    }

    function lerp(a: number, b: number, t: number) { return a + (b-a)*t }
    function ease(t: number) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }

    function draw() {
      tRef.current += 0.018
      const T = tRef.current
      const s = statusRef.current

      // Check for new events
      if (s) {
        if (s.collector.eventCount > lastEventCount) {
          lastEventCount = s.collector.eventCount
          collectorFlare = 1
          synapseFlow = Math.min(1, synapseFlow + 0.5)
          spawnSparks()
          spawnShockwave(N1.x, N1.y, 210)
        }
        if (s.reviewer.isSynthesizing && !lastSynthesizing) {
          reviewerGlow = 1
          synapseFlow = 1
          spawnShockwave(N2.x, N2.y, 165)
        }
        lastSynthesizing = s.reviewer.isSynthesizing
      }

      // Decay
      collectorFlare = Math.max(0, collectorFlare - 0.03)
      reviewerGlow = Math.max(0, reviewerGlow - 0.012)
      synapseFlow = Math.max(0, synapseFlow - 0.01)

      // Clear with deep space bg
      ctx.fillStyle = '#070a14'
      ctx.fillRect(0, 0, W, H)

      // Subtle nebula
      const ng = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 80)
      ng.addColorStop(0, 'rgba(40,80,180,0.06)')
      ng.addColorStop(1, 'transparent')
      ctx.fillStyle = ng
      ctx.fillRect(0, 0, W, H)

      // Neural bridge
      const x1 = N1.x + NR, x2 = N2.x - NR
      ctx.beginPath()
      ctx.moveTo(x1, H/2)
      ctx.lineTo(x2, H/2)
      ctx.strokeStyle = 'rgba(60,120,255,0.15)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      if (synapseFlow > 0.1) {
        for (let strand = 0; strand < 2; strand++) {
          ctx.beginPath()
          for (let i = 0; i <= 40; i++) {
            const f = i/40
            const x = lerp(x1, x2, f)
            const wave = Math.sin(f * Math.PI * 5 - T * 7 + strand * 1.5) * 7 * synapseFlow
            if (i===0) ctx.moveTo(x, H/2+wave)
            else ctx.lineTo(x, H/2+wave)
          }
          ctx.strokeStyle = `hsla(${185+strand*20},100%,70%,${0.45*synapseFlow})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Shockwaves
      shockwaves = shockwaves.filter(sw => sw.t < 1)
      for (const sw of shockwaves) {
        sw.t += 0.025
        const r = lerp(sw.r, sw.maxR, ease(sw.t))
        const alpha = (1 - sw.t) * 0.55
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, r, 0, Math.PI*2)
        ctx.strokeStyle = `hsla(${sw.hue},100%,70%,${alpha})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      // Sparks
      sparks = sparks.filter(sp => sp.t < 1)
      for (const sp of sparks) {
        sp.t += sp.speed
        const f = ease(sp.t)
        const x = lerp(x1, x2, f)
        const y = H/2 + Math.sin(sp.t * Math.PI) * 25 * sp.arc
        sp.trail.push({x,y})
        if (sp.trail.length > 6) sp.trail.shift()
        const alpha = Math.sin(sp.t * Math.PI)
        for (let i = 0; i < sp.trail.length; i++) {
          const tp = sp.trail[i]
          ctx.beginPath()
          ctx.arc(tp.x, tp.y, sp.size * (i/sp.trail.length) * 0.8, 0, Math.PI*2)
          ctx.fillStyle = `hsla(${sp.hue},100%,80%,${(i/sp.trail.length)*alpha*0.7})`
          ctx.fill()
        }
        ctx.beginPath()
        ctx.arc(x, y, sp.size, 0, Math.PI*2)
        ctx.fillStyle = `hsla(${sp.hue},100%,95%,${alpha})`
        ctx.fill()
      }

      // Draw node function
      const drawNode = (
        nx: number, ny: number,
        phase: number, flare: number,
        hue1: number, hue2: number
      ) => {
        const breathe = 1 + 0.07 * Math.sin(phase)
        const r = NR * breathe
        const glow = 0.25 + flare * 0.75

        // Outer glow
        for (let i = 3; i >= 1; i--) {
          const gr = ctx.createRadialGradient(nx,ny,0,nx,ny,r*(1+i*0.55))
          gr.addColorStop(0, `hsla(${hue1},100%,65%,${0.05*glow*i*0.25})`)
          gr.addColorStop(1,'transparent')
          ctx.beginPath()
          ctx.arc(nx, ny, r*(1+i*0.55), 0, Math.PI*2)
          ctx.fillStyle = gr
          ctx.fill()
        }

        // Orbital ring
        ctx.save()
        ctx.translate(nx, ny)
        ctx.rotate(phase * 0.35)
        ctx.beginPath()
        ctx.ellipse(0, 0, r*1.55, r*0.35, 0, 0, Math.PI*2)
        ctx.strokeStyle = `hsla(${hue2},100%,75%,${0.18*glow})`
        ctx.lineWidth = 0.5
        ctx.stroke()
        ctx.restore()

        // Core
        const cg = ctx.createRadialGradient(nx-r*0.3,ny-r*0.3,r*0.05,nx,ny,r)
        cg.addColorStop(0, `hsla(${hue1},50%,96%,1)`)
        cg.addColorStop(0.35, `hsla(${hue1},90%,68%,1)`)
        cg.addColorStop(0.75, `hsla(${hue2},100%,42%,1)`)
        cg.addColorStop(1, `hsla(${hue2},100%,18%,1)`)
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI*2)
        ctx.fillStyle = cg
        ctx.fill()

        // Specular
        const sg = ctx.createRadialGradient(nx-r*0.3,ny-r*0.32,0,nx-r*0.2,ny-r*0.2,r*0.55)
        sg.addColorStop(0,'rgba(255,255,255,0.45)')
        sg.addColorStop(1,'transparent')
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI*2)
        ctx.fillStyle = sg
        ctx.fill()

        // Flare rays
        if (flare > 0.25) {
          for (let i = 0; i < 10; i++) {
            const angle = (i/10)*Math.PI*2 + phase
            const len = r*(0.6+0.4*Math.sin(angle*3+T*3))*flare
            ctx.beginPath()
            ctx.moveTo(nx+Math.cos(angle)*r, ny+Math.sin(angle)*r)
            ctx.lineTo(nx+Math.cos(angle)*(r+len), ny+Math.sin(angle)*(r+len))
            ctx.strokeStyle = `hsla(${hue1},100%,88%,${0.4*flare})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      drawNode(N1.x, N1.y, T*1.1, collectorFlare, 210, 235)
      drawNode(N2.x, N2.y, T*0.65+1.8, reviewerGlow, 162, 190)

      // Labels
      ctx.font = '8px SF Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(150,180,255,${0.45 + collectorFlare*0.4})`
      ctx.fillText('collector', N1.x, H - 8)
      ctx.fillStyle = `rgba(100,220,175,${0.45 + reviewerGlow*0.4})`
      ctx.fillText('reviewer', N2.x, H - 8)

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const formatTime = (ms: number | null) => {
    if (!ms) return '—'
    const s = Math.floor((Date.now() - ms) / 1000)
    if (s < 60) return `${s}s ago`
    return `${Math.floor(s/60)}m ago`
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      right: 16,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: 8,
      pointerEvents: 'auto'
    }}>
      {expanded && status && (
        <div style={{
          background: 'rgba(7,10,20,0.95)',
          border: '1px solid rgba(60,120,255,0.25)',
          borderRadius: 12,
          padding: '14px 16px',
          minWidth: 220,
          backdropFilter: 'blur(16px)',
          fontFamily: 'SF Mono, monospace',
          fontSize: 11,
          color: 'rgba(180,210,255,0.85)',
          lineHeight: 1.9
        }}>
          <div style={{ color: 'rgba(100,160,255,0.6)', fontSize: 9, letterSpacing: '0.2em', marginBottom: 8 }}>
            VIBE NEURAL AGENTS
          </div>
          <div style={{ borderBottom: '1px solid rgba(60,120,255,0.15)', paddingBottom: 8, marginBottom: 8 }}>
            <div style={{ color: 'rgba(100,180,255,0.9)', fontWeight: 600, marginBottom: 2 }}>
              ◆ Collector
            </div>
            <div>events: {status.collector.eventCount}</div>
            <div>last event: {formatTime(status.collector.lastEventTime)}</div>
            <div>distilling: {status.collector.isDistilling ? '⚡ active' : 'idle'}</div>
          </div>
          <div>
            <div style={{ color: 'rgba(80,220,160,0.9)', fontWeight: 600, marginBottom: 2 }}>
              ◆ Reviewer
            </div>
            <div>briefings: {status.reviewer.briefingCount}</div>
            <div>last briefing: {formatTime(status.reviewer.lastBriefingTime || null)}</div>
            <div>synthesizing: {status.reviewer.isSynthesizing ? '⚡ active' : 'idle'}</div>
          </div>
        </div>
      )}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer', lineHeight: 0 }}
        title="VIBE Neural Agents"
      >
        <canvas
          ref={canvasRef}
          style={{
            borderRadius: 12,
            border: '1px solid rgba(60,120,255,0.2)',
            display: 'block'
          }}
        />
      </div>
    </div>
  )
}

`

================================================================
File: src\renderer\components\ai\ChatMessages.tsx
================================================================
`ts
import React, { useEffect, useRef, useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';
import { ThinkBlock } from './ThinkBlock';
import { ThinkingIndicator } from './ThinkingIndicator';

/* ═══════════════════════════════════════════════════════════
   XML TAG EXTRACTION HELPER
   ═══════════════════════════════════════════════════════════ */
function extractTag(text: string, tag: string): string | null {
    try {
        const match = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return match ? match[1].trim() : null;
    } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════
   SEGMENT TYPES
   ═══════════════════════════════════════════════════════════ */
interface Segment {
    type: 'text' | 'plan' | 'critique' | 'reflection' | 'verification' | 'done' | 'analyze' | 'execute' | 'write_file';
    content: string;
}

/* ═══════════════════════════════════════════════════════════
   XML RESPONSE PARSER
   Splits response into typed segments. Strips unrecognized tags.
   ═══════════════════════════════════════════════════════════ */
function parseAgentResponse(content: string): Segment[] {
    const segments: Segment[] = [];

    // Regex for all known top-level XML blocks
    const blockPattern = /(<plan>[\s\S]*?<\/plan>|<critique>[\s\S]*?<\/critique>|<reflection>[\s\S]*?<\/reflection>|<verification>[\s\S]*?<\/verification>|<done>[\s\S]*?<\/done>|<analyze>[\s\S]*?<\/analyze>|<execute>[\s\S]*?<\/execute>|<write_file[\s\S]*?<\/write_file>|<read_file\s[^>]*\/?>)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = blockPattern.exec(content)) !== null) {
        // Text before this block
        if (match.index > lastIndex) {
            const textBefore = content.slice(lastIndex, match.index);
            const cleaned = stripUnknownTags(textBefore).trim();
            if (cleaned) segments.push({ type: 'text', content: cleaned });
        }

        const block = match[0];
        if (block.startsWith('<plan>')) {
            segments.push({ type: 'plan', content: block });
        } else if (block.startsWith('<critique>')) {
            segments.push({ type: 'critique', content: block });
        } else if (block.startsWith('<reflection>')) {
            segments.push({ type: 'reflection', content: block });
        } else if (block.startsWith('<verification>')) {
            segments.push({ type: 'verification', content: block });
        } else if (block.startsWith('<done>')) {
            segments.push({ type: 'done', content: block });
        } else if (block.startsWith('<analyze>')) {
            segments.push({ type: 'analyze', content: block });
        } else if (block.startsWith('<execute>')) {
            segments.push({ type: 'execute', content: block });
        } else if (block.startsWith('<write_file')) {
            segments.push({ type: 'write_file', content: block });
        }
        // read_file is silently stripped — no segment added

        lastIndex = match.index + match[0].length;
    }

    // Remaining text after last block
    if (lastIndex < content.length) {
        const remaining = content.slice(lastIndex);
        const cleaned = stripUnknownTags(remaining).trim();
        if (cleaned) segments.push({ type: 'text', content: cleaned });
    }

    return segments;
}

/** Strip any unrecognized XML-like tags, keeping their inner text */
function stripUnknownTags(text: string): string {
    return text
        .replace(/<\/?(?:mission|steps|step[^>]*|criteria|risks|score|notes|proceed|evidence|remaining|summary|files_changed|criteria_met|issues|revised_plan)[^>]*>/gi, '')
        .trim();
}

/* ═══════════════════════════════════════════════════════════
   BEAUTIFUL UI COMPONENTS FOR AGENT PHASES
   ═══════════════════════════════════════════════════════════ */

/* ─── EXECUTION PLAN ─────────────────────────────────────── */
function PlanCard({ content }: { content: string }) {
    const [collapsed, setCollapsed] = useState(false);
    const mission = extractTag(content, 'mission') || '';
    const criteria = extractTag(content, 'criteria') || '';
    const risks = extractTag(content, 'risks') || '';
    const stepsRaw = content.match(/<step[^>]*>([\s\S]*?)<\/step>/gi) || [];
    const steps = stepsRaw.map(s => {
        const inner = s.match(/<step[^>]*>([\s\S]*?)<\/step>/i);
        return inner ? inner[1].trim() : '';
    }).filter(Boolean);

    return (
        <div className="agent-card agent-card--plan">
            <div className="agent-card__header" onClick={() => setCollapsed(!collapsed)}>
                <span className="agent-card__icon">🎯</span>
                <span className="agent-card__title">Execution Plan</span>
                <span className="agent-card__toggle">{collapsed ? '▸' : '▾'}</span>
            </div>
            {!collapsed && (
                <div className="agent-card__body">
                    {mission && <div className="agent-plan__mission">{mission}</div>}
                    {steps.length > 0 && (
                        <div className="agent-plan__steps">
                            {steps.map((s, i) => (
                                <div key={i} className="agent-plan__step">
                                    <span className="agent-plan__step-num">
                                        {['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'][i] || `${i+1}.`}
                                    </span>
                                    <span>{s}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {criteria && (
                        <div className="agent-plan__criteria">
                            <span className="agent-plan__criteria-label">Criteria:</span> {criteria}
                        </div>
                    )}
                    {risks && (
                        <div className="agent-plan__risks">
                            <span className="agent-plan__risks-label">⚠ Risks:</span> {risks}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── CRITIQUE / PLAN REVIEW ─────────────────────────────── */
function CritiqueCard({ content }: { content: string }) {
    const scoreStr = extractTag(content, 'score') || '8';
    const score = parseInt(scoreStr, 10);
    const revisedPlan = extractTag(content, 'revised_plan') || '';
    const approved = score >= 7 || revisedPlan.toUpperCase().includes('APPROVED');
    const variant = approved ? 'approved' : 'revised';

    return (
        <div className={`agent-card agent-card--critique agent-card--critique-${variant}`}>
            <div className="agent-card__header">
                <span className="agent-card__icon">{approved ? '✓' : '↻'}</span>
                <span className="agent-card__title">Plan Review</span>
                <span className="agent-critique__score">Score: {score}/10</span>
            </div>
            <div className="agent-critique__status">
                {approved ? 'Approved' : 'Issues found — revising plan…'}
            </div>
        </div>
    );
}

/* ─── REFLECTION PILL ────────────────────────────────────── */
function ReflectionPill({ content }: { content: string }) {
    const scoreStr = extractTag(content, 'score') || '8';
    const score = parseInt(scoreStr, 10);
    const proceed = extractTag(content, 'proceed');
    const good = score >= 7;

    return (
        <span className={`agent-pill agent-pill--${good ? 'good' : 'retry'}`}>
            Score {score}/10 {good ? '✓' : '↻'} {proceed === 'no' ? 'Retrying' : 'Proceeding'}
        </span>
    );
}

/* ─── VERIFICATION CARD ──────────────────────────────────── */
function VerificationCard({ content }: { content: string }) {
    const criteriaMet = extractTag(content, 'criteria_met') || 'unknown';
    const remaining = extractTag(content, 'remaining') || '';
    const evidence = extractTag(content, 'evidence') || '';

    let icon = '✅'; let title = 'Mission Complete'; let variant = 'complete';
    if (criteriaMet === 'no') { icon = '⚠'; title = 'Incomplete'; variant = 'incomplete'; }
    if (criteriaMet === 'partial') { icon = '🔄'; title = 'Partially Complete'; variant = 'partial'; }

    return (
        <div className={`agent-card agent-card--verification agent-card--verification-${variant}`}>
            <div className="agent-card__header">
                <span className="agent-card__icon">{icon}</span>
                <span className="agent-card__title">{title}</span>
            </div>
            <div className="agent-card__body">
                {evidence && <div className="agent-verification__evidence">{evidence}</div>}
                {remaining && (
                    <div className="agent-verification__remaining">
                        <div className="agent-verification__remaining-title">Still needed:</div>
                        {remaining.split('\n').filter(Boolean).map((item, i) => (
                            <div key={i} className="agent-verification__remaining-item">• {item.replace(/^[-•]\s*/, '')}</div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── DONE CARD ──────────────────────────────────────────── */
function DoneCard({ content }: { content: string }) {
    const summary = extractTag(content, 'summary') || 'Task completed';
    const filesChanged = extractTag(content, 'files_changed') || '';

    return (
        <div className="agent-card agent-card--done">
            <div className="agent-card__header">
                <span className="agent-card__icon">✅</span>
                <span className="agent-card__title">Task Complete</span>
            </div>
            <div className="agent-card__body">
                <div className="agent-done__summary">{summary}</div>
                {filesChanged && (
                    <div className="agent-done__files">Files: {filesChanged}</div>
                )}
            </div>
        </div>
    );
}

/* ─── ANALYSIS CARD ──────────────────────────────────────── */
function AnalyzeCard({ content }: { content: string }) {
    const inner = extractTag(content, 'analyze') || content.replace(/<\/?analyze>/gi, '').trim();
    return (
        <div className="agent-card agent-card--analyze">
            <div className="agent-card__header">
                <span className="agent-card__icon">💭</span>
                <span className="agent-card__title">Analysis</span>
            </div>
            <div className="agent-card__body">
                <div className="agent-analyze__content">{inner}</div>
            </div>
        </div>
    );
}

/* ─── COMMAND BLOCK ──────────────────────────────────────── */
function CommandBlock({ command }: { command: string }) {
    const handleCopy = () => navigator.clipboard.writeText(command);
    return (
        <div className="agent-command">
            <div className="agent-command__header">
                <span className="agent-command__label">Terminal Command</span>
                <button onClick={handleCopy} className="agent-command__copy">Copy</button>
            </div>
            <div className="agent-command__body">
                <span className="agent-command__prompt">$</span>{command}
            </div>
        </div>
    );
}

/* ─── FILE WRITE BLOCK ───────────────────────────────────── */
function FileWriteBlock({ path, content }: { path: string, content: string }) {
    const projectPath = useUIStore(state => state.projectPath);
    const openFile = useEditorStore(state => state.openFile);
    const [written, setWritten] = useState(false);

    useEffect(() => {
        if (projectPath && !written) {
            const fullPath = `${projectPath}/${path}`;
            window.vibe.writeFile(fullPath, content).then(() => {
                setWritten(true);
                openFile(fullPath, content);
            }).catch(() => {});
        }
    }, [projectPath, path, content, written]);

    return (
        <div className={`agent-file-write ${written ? 'agent-file-write--done' : ''}`}>
            <div className={`agent-file-write__dot ${written ? 'agent-file-write__dot--done' : ''}`} />
            <div className="agent-file-write__info">
                <span className="agent-file-write__path">{path}</span>
                <span className={`agent-file-write__status ${written ? 'agent-file-write__status--done' : ''}`}>
                    {written ? 'SAVED' : 'SAVING…'}
                </span>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   MAIN CHAT MESSAGES COMPONENT
   ═══════════════════════════════════════════════════════════ */
export function ChatMessages() {
    const messages = useOllamaStore(state => state.messages);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }, [messages, isGenerating]);

    const renderContent = (content: string) => {
        if (!content) return <span className="chat-empty">…</span>;

        // ── Special prefix-based blocks (unchanged) ──
        if (content.startsWith('__TERMINAL_OUTPUT__\n')) {
            const output = content.replace('__TERMINAL_OUTPUT__\n', '');
            return (
                <div className="chat-terminal-output">
                    <div className="chat-terminal-output__label">Terminal Output</div>
                    {output}
                </div>
            );
        }

        if (content.startsWith('__FILE_CONTENTS__')) {
            const firstNewline = content.indexOf('\n');
            const header = content.slice('__FILE_CONTENTS__ '.length, firstNewline);
            const body = content.slice(firstNewline + 1);
            return (
                <div className="chat-file-contents">
                    <div className="chat-file-contents__label">📄 Reading: {header}</div>
                    {body.slice(0, 600)}{body.length > 600 ? '\n… (truncated for display)' : ''}
                </div>
            );
        }

        if (content.startsWith('__SWARM_LABEL__')) {
            const label = content.replace('__SWARM_LABEL__', '');
            return <div className="chat-swarm-label">{label}</div>;
        }

        // ── Parse agent XML blocks ──
        const segments = parseAgentResponse(content);

        // If parser found nothing special, render as plain text
        if (segments.length === 0) return <span>{content}</span>;
        if (segments.length === 1 && segments[0].type === 'text') {
            return <span>{segments[0].content}</span>;
        }

        return (
            <>
                {segments.map((seg, i) => {
                    switch (seg.type) {
                        case 'plan': return <PlanCard key={i} content={seg.content} />;
                        case 'critique': return <CritiqueCard key={i} content={seg.content} />;
                        case 'reflection': return <ReflectionPill key={i} content={seg.content} />;
                        case 'verification': return <VerificationCard key={i} content={seg.content} />;
                        case 'done': return <DoneCard key={i} content={seg.content} />;
                        case 'analyze': return <AnalyzeCard key={i} content={seg.content} />;
                        case 'execute': {
                            const cmd = seg.content.replace(/<\/?execute>/g, '').trim();
                            return <CommandBlock key={i} command={cmd} />;
                        }
                        case 'write_file': {
                            const pathMatch = seg.content.match(/path=['"]([^'"]+)['"]/);
                            const filePath = pathMatch ? pathMatch[1] : 'unknown.txt';
                            const fileContent = seg.content.replace(/<write_file[^>]*>/, '').replace(/<\/write_file>/, '').trim();
                            return <FileWriteBlock key={i} path={filePath} content={fileContent} />;
                        }
                        case 'text':
                            return <span key={i}>{seg.content}</span>;
                        default:
                            return null;
                    }
                })}
            </>
        );
    };

    return (
        <div ref={containerRef} className="chat-messages">
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
                            <div className={`chat-bubble chat-bubble--${msg.role} ${isSpecialBlock ? 'chat-bubble--special' : ''}`}>
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

`

================================================================
File: src\renderer\components\ai\HuggingFacePicker.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\ai\ModelCapabilities.sync-conflict-20260309-090852-QVLNMDJ.tsx
================================================================
`ts
import React from 'react';
import { useOllamaStore } from '../../store/ollama';
import type { ModelCapability } from '../../../shared/types';

interface Props {
    onAction?: (action: string) => void;
}

export const ModelCapabilities = ({ onAction }: Props) => {
    const selected = useOllamaStore(s => s.selectedModel);
    const caps: ModelCapability = useOllamaStore(s => s.modelCapabilities[selected] ?? {});

    const handleClick = (text: string) => {
        if (onAction) onAction(text);
    };

    return (
        <div style={{ display: 'flex', gap: 4, padding: '0', color: 'var(--text-muted)' }}>
            {caps.think && (
                <button title="Enable Deep Reasoning" onClick={() => handleClick('/think ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                    💡
                </button>
            )}
            {caps.web && (
                <button title="Web Search Enabled" onClick={() => handleClick('/search ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                    🔍
                </button>
            )}
            {caps.image && (
                <button title="Analyze Image" onClick={() => handleClick('/image ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                    🖼️
                </button>
            )}
            {caps.canExecute && (
                <button title="Terminal Execution Enabled" onClick={() => handleClick('Write a script to: ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                    ⌨️
                </button>
            )}
        </div>
    );
};

`

================================================================
File: src\renderer\components\ai\ModelCapabilities.tsx
================================================================
`ts
import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import type { ModelCapability } from '../../../shared/types';

export const ModelCapabilities = () => {
    const selected = useOllamaStore(s => s.selectedModel);
    const caps: ModelCapability = useOllamaStore(
        s => s.modelCapabilities[selected] ?? {}
    );
    const thinkEnabled = useOllamaStore(s => s.thinkEnabled);
    const thinkLevel = useOllamaStore(s => s.thinkLevel);
    const setThinkEnabled = useOllamaStore(s => s.setThinkEnabled);
    const setThinkLevel = useOllamaStore(s => s.setThinkLevel);
    const [showLevels, setShowLevels] = useState(false);

    // Don't render anything if no capabilities
    if (!caps.think && !caps.vision && !caps.tools) return null;

    const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
    const levelBudgets = { low: 2048, medium: 8192, high: 16000 };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

            {/* THINK BUTTON */}
            {caps.think && (
                <div style={{ position: 'relative' }}>
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
                            gap: 4,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: `1px solid ${thinkEnabled
                                ? 'var(--accent)' : 'var(--border)'}`,
                            background: thinkEnabled
                                ? 'var(--accent-light)' : 'transparent',
                            color: thinkEnabled
                                ? 'var(--accent)' : 'var(--text-muted)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        💡
                        {caps.thinkBudget === 'tiered' && thinkEnabled && (
                            <span style={{
                                textTransform: 'uppercase',
                                letterSpacing: 0.5
                            }}>
                                {thinkLevel}
                            </span>
                        )}
                        {caps.thinkBudget !== 'tiered' && (
                            <span>{thinkEnabled ? 'ON' : 'Think'}</span>
                        )}
                    </button>

                    {/* Level picker — tiered models only */}
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
                                <div style={{
                                    padding: '8px 12px 4px',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1
                                }}>
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
                                            background: thinkLevel === level
                                                ? 'var(--accent-light)' : 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            fontWeight: thinkLevel === level ? 700 : 500,
                                            color: thinkLevel === level
                                                ? 'var(--accent)' : 'var(--text)',
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
                                <div style={{
                                    borderTop: '1px solid var(--border-light)',
                                    padding: '6px 12px'
                                }}>
                                    <button
                                        onClick={() => {
                                            setThinkEnabled(false);
                                            setShowLevels(false);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            color: 'var(--error)',
                                            fontWeight: 600,
                                            padding: 0
                                        }}
                                    >
                                        Turn off
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* VISION BADGE — shows when model supports images */}
            {caps.vision && (
                <div
                    title="This model can see images"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '4px 7px',
                        borderRadius: 6,
                        border: '1px solid rgba(0,168,112,0.3)',
                        background: 'rgba(0,168,112,0.06)',
                        color: 'var(--green)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'default',
                    }}
                >
                    👁 Vision
                </div>
            )}

            {/* TOOLS BADGE — shows when model supports function calling */}
            {caps.tools && (
                <div
                    title="This model supports tool calling"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '4px 7px',
                        borderRadius: 6,
                        border: '1px solid rgba(230,138,0,0.3)',
                        background: 'rgba(230,138,0,0.06)',
                        color: 'var(--warn)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'default',
                    }}
                >
                    🔧 Tools
                </div>
            )}

        </div>
    );
};

`

================================================================
File: src\renderer\components\ai\ModelSelector.tsx
================================================================
`ts
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
    const [loadedModels, setLoadedModels] = useState<string[]>([]);

    // Fetch which models are currently loaded in VRAM
    useEffect(() => {
        const fetchLoaded = async () => {
            try {
                const loaded = await window.vibe.getLoadedModels();
                setLoadedModels(loaded);
            } catch { }
        };
        fetchLoaded();
        const interval = setInterval(fetchLoaded, 10000);
        return () => clearInterval(interval);
    }, []);

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
        const isLoaded = loadedModels.some(lm =>
            lm.toLowerCase().includes(id.toLowerCase()) ||
            id.toLowerCase().includes(lm.toLowerCase())
        );
        return (
            <div key={id} onClick={() => { setSelectedModel(id); onClose(); }} style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isSelected ? 'var(--accent-light)' : 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? 'var(--accent)' : 'transparent', border: isSelected ? 'none' : '1px solid var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: isSelected ? (isSwarm ? 700 : 600) : 500, color: isSwarm ? 'var(--accent)' : 'var(--text)' }}>
                        {displayName}
                    </span>
                    {isLoaded && (
                        <span
                            title="Loaded in memory"
                            style={{
                                width: 6, height: 6,
                                borderRadius: '50%',
                                background: 'var(--green)',
                                display: 'inline-block',
                                marginLeft: 4,
                                boxShadow: '0 0 4px var(--green)',
                            }}
                        />
                    )}
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

`

================================================================
File: src\renderer\components\ai\ThinkBlock.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\ai\ThinkingIndicator.tsx
================================================================
`ts
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


`

================================================================
File: src\renderer\components\auth\LoginScreen.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\common\GlassPanel.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\editor\EditorTabs.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\editor\MonacoEditor.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\filetree\FileTree.tsx
================================================================
`ts
import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../store/ui';
import { useSettingsStore } from '../../store/settings';
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

    // Auto-start background agents for existing project on mount
    useEffect(() => {
        const existingPath = useUIStore.getState().projectPath;
        if (existingPath) {
            const obsidianKey = useSettingsStore.getState().apiKeys.obsidian || undefined;
            window.vibe.startBackgroundAgents(existingPath, obsidianKey).catch(() => {});
        }
    }, []);

    const handleOpenFolder = async () => {
        const p = await openFolder();
        if (p) {
            setProjectPath(p);
            const obsidianKey = useSettingsStore.getState().apiKeys.obsidian || undefined;
            window.vibe.startBackgroundAgents(p, obsidianKey).catch(() => {});
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

`

================================================================
File: src\renderer\components\filetree\FileTreeItem.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\layout\AgentManager.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\layout\ChatBar.tsx
================================================================
`ts
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
import { sanitizeForPowerShell } from '../../utils/commandSanitizer';
import { ModelCapabilities } from '../ai/ModelCapabilities';
import type { ChatMessage } from '../../../shared/types';
import { getModelTags } from '../../utils/tags';

const estimateTokens = (msgs: ChatMessage[]) => msgs.reduce((acc, m) => acc + m.content.length / 4, 0);
const CONTEXT_WARN_THRESHOLD = 12000;

// ─── Bulletproof Loop Constants ──────────────────────────────────
const MAX_STEP_RETRIES = 3;
const MAX_STEPS = 12;
const REFLECTION_THRESHOLD = 7;

// ─── XML Tag Extraction Helper ───────────────────────────────────
const extractTag = (text: string, tag: string): string | null => {
    try {
        const match = text.match(
            new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
        );
        return match ? match[1].trim() : null;
    } catch {
        return null;
    }
};

// ─── Prompt Builders ─────────────────────────────────────────────
const buildPlannerPrompt = (
    mission: string,
    projectPath: string | null,
    projectStructure: string,
    memory: any,
    vibeInstructions: string | null,
    briefingContext: string = ''
): string => `You are VIBE Planner — an expert software architect.

Your job is to create a precise, executable plan for this mission:
"${mission}"

PROJECT: ${projectPath || 'unknown'}
PROJECT STRUCTURE (actual files that exist):
\`\`\`
${projectStructure}
\`\`\`
${memory ? `MEMORY: ${JSON.stringify(memory).slice(0, 500)}` : ''}
${vibeInstructions ? `PROJECT RULES:\n${vibeInstructions}` : ''}
${briefingContext}

Output ONLY this XML structure, nothing else:

<plan>
  <mission>${mission}</mission>
  <steps>
    <step id="1" type="read_file|execute|write_file|analyze">
      Description of exactly what to do
    </step>
    <step id="2" depends="1" type="execute">
      Next step description
    </step>
  </steps>
  <criteria>What "done" looks like — specific and testable</criteria>
  <risks>Any risks or things that might go wrong</risks>
</plan>

RULES:
- Maximum 8 steps
- Each step must be atomic — one action only
- type must be: read_file, execute, write_file, or analyze
- depends attribute lists step ids this step waits for
- Be specific — name exact files and commands where known
- Do NOT include code yet — planning only`;

const buildExecutorPrompt = (
    mission: string,
    plan: string,
    currentStep: string,
    stepId: string,
    previousResults: string,
    projectPath: string | null
): string => `You are VIBE Executor — an expert developer running on Windows with PowerShell.

MISSION: ${mission}
CURRENT STEP: ${currentStep}
PROJECT: ${projectPath || 'unknown'}

FULL PLAN FOR CONTEXT:
${plan}

RESULTS SO FAR:
${previousResults || 'No previous results yet.'}

Execute ONLY the current step using exactly ONE of these tools:

To read a file:
<read_file path="relative/path/to/file.ext"/>

To run a terminal command (PowerShell on Windows):
<execute>your powershell command here</execute>

To write a file (complete content only, never partial):
<write_file path="relative/path/to/file.ext">
complete file content here
</write_file>

To analyze/reason without a tool:
<analyze>
your analysis here
</analyze>

After using your tool, output your reflection:
<reflection>
  <score>X</score>
  <notes>What happened, what you found, any issues</notes>
  <proceed>yes|no</proceed>
  <critique>If score < 8, what went wrong and how to fix it</critique>
</reflection>

RULES:
- Use ONLY ONE tool per response
- Always read a file before editing it
- PowerShell syntax only — use semicolons not &&
- Write COMPLETE files — never partial, never placeholder
- Be honest in reflection — low score = retry with fix
- If this is the final step and mission is complete, add:
  <done>
    <summary>What was accomplished</summary>
    <files_changed>list of files</files_changed>
    <criteria_met>yes|no</criteria_met>
  </done>`;

const buildCriticPrompt = (
    plan: string,
    mission: string
): string => `You are VIBE Critic. Review this plan critically.

MISSION: ${mission}

PLAN TO REVIEW:
${plan}

Score the plan and output ONLY this XML:
<critique>
  <score>X</score>
  <issues>List any problems, missing steps, or risks</issues>
  <revised_plan>
    If score < 7, output a corrected plan in the same XML 
    format as the original. If score >= 7, write "APPROVED".
  </revised_plan>
</critique>

Score criteria:
9-10: Perfect, proceed immediately
7-8: Good, minor issues noted
5-6: Needs revision before proceeding
< 5: Major problems, replan required`;

const buildVerifierPrompt = (
    mission: string,
    criteria: string,
    results: string
): string => `You are VIBE Verifier. Check if the mission was accomplished.

MISSION: ${mission}
ACCEPTANCE CRITERIA: ${criteria}

EXECUTION RESULTS:
${results}

Output ONLY this XML:
<verification>
  <criteria_met>yes|no|partial</criteria_met>
  <score>X</score>
  <evidence>What evidence shows criteria was/wasn't met</evidence>
  <remaining>If partial/no: what still needs to be done</remaining>
</verification>`;

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

        const isSwarm = selectedModel?.startsWith('swarm-');
        if (isSwarm) {
            const swarm = swarms.find(s => s.id === selectedModel);
            if (swarm) {
                await runSwarm(swarm, userMsg.content);
                return;
            }
        }

        await runAgentLoop(userMsg.content, msgsWithUser);
    };

    const waitForStreamDone = (): Promise<string> => {
        return new Promise((resolve) => {
            let fullContent = '';
            const unsub = streamBus.subscribe((chunk) => {
                if (chunk.content) fullContent += chunk.content;
                if (chunk.done) {
                    unsub();
                    window.vibe.log('[STREAM] waitForStreamDone resolved');
                    resolve(fullContent);
                }
            });
        });
    };

    // ─── Helper: get think options for LLM call ──────────────────
    const getThinkOptions = () => {
        const store = useOllamaStore.getState();
        const caps = store.modelCapabilities[store.selectedModel] ?? {};
        if (!caps.think || !store.thinkEnabled) return null;
        return { enabled: true, level: store.thinkLevel };
    };

    // ─── Helper: poll terminal for command completion ────────────
    const pollTerminalOutput = async (termId: string): Promise<string> => {
        let rawOutput = '';
        let pollAttempts = 0;
        const MAX_POLL = 60; // 30 seconds max

        while (pollAttempts < MAX_POLL) {
            await new Promise(r => setTimeout(r, 500));
            rawOutput = await window.vibe.getTerminalOutput(termId);

            if (rawOutput.length > 3) {
                const lines = rawOutput.split('\n').filter(l => l.trim());
                const lastLine = lines[lines.length - 1]?.trim() || '';
                // PowerShell prompt signals command completed
                if (/^PS [A-Za-z]:\\/.test(lastLine)) break;
                // Also break if we have substantial output after 3 seconds
                if (rawOutput.length > 100 && pollAttempts >= 6) break;
            }
            pollAttempts++;
        }

        await window.vibe.clearTerminalOutput(termId);
        return cleanTerminalOutput(rawOutput);
    };

    // ─── Helper: scan project file tree ──────────────────────
    const getProjectSnapshot = async (projPath: string): Promise<string> => {
        try {
            const tId = useTerminalStore.getState().activeTerminalId;
            if (!tId) return 'Project structure unavailable';

            await window.vibe.clearTerminalOutput(tId);
            window.vibe.sendTerminalInput(
                tId,
                `cd "${projPath}"; ` +
                `Get-ChildItem -Recurse -Depth 3 ` +
                `-Exclude @('node_modules','build','dist','.git',` +
                `'__pycache__','.vibe') ` +
                `| Select-Object FullName | Format-Table -HideTableHeaders` +
                `\r`
            );

            await new Promise(r => setTimeout(r, 3000));
            const raw = await window.vibe.getTerminalOutput(tId);
            await window.vibe.clearTerminalOutput(tId);

            const lines = raw
                .split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('PS '))
                .map(l => l.replace(projPath, '').replace(/^\\/, ''))
                .filter(l => l.length > 0)
                .slice(0, 150);

            return lines.join('\n') || 'Empty project';
        } catch {
            return 'Could not scan project';
        }
    };

    // ─── Briefing Context Helper ──────────────────────────────
    async function getBriefingContext(): Promise<string> {
        try {
            const briefing = await window.vibe.getBriefing();
            if (briefing && briefing !== 'No project briefing available yet.') {
                return `\nPROJECT BRIEFING (from background intelligence):\n${briefing}\n`;
            }
        } catch {}
        return '';
    }

    // ═══════════════════════════════════════════════════════════════
    // THE BULLETPROOF AGENTIC LOOP
    // Plan → Critic → Execute (per-step reflect+retry) → Verify
    // ═══════════════════════════════════════════════════════════════
    const runAgentLoop = async (
        userMission: string,
        baseMessages: ChatMessage[]
    ) => {
        const projectPath = useUIStore.getState().projectPath;
        const projectMemory = useUIStore.getState().projectMemory;
        const termId = useTerminalStore.getState().activeTerminalId;

        // ─── PROJECT SCAN (once at start) ──────────────────────
        useOllamaStore.getState().setAgentStatus('Scanning project...');
        useOllamaStore.getState().setIsGenerating(true);
        const projectStructure = projectPath
            ? await getProjectSnapshot(projectPath)
            : 'No project open';
        window.vibe.log(`[SCAN] Found structure:\n${projectStructure.slice(0, 500)}`);

        // ─── Briefing from background intelligence ──────────
        const briefingContext = await getBriefingContext();
        window.vibe.log(`[BRIEFING] ${briefingContext ? 'Loaded ✓' : 'Not available'}`);

        // ─── Obsidian: update project note ──────────────────────
        const obsidianKey = useSettingsStore.getState().apiKeys.obsidian;
        const projectName = projectPath?.split(/[/\\]/).pop() || 'Unknown';
        if (obsidianKey && projectPath) {
            window.vibe.obsidianUpdateProject(
                obsidianKey, projectName, projectStructure, projectPath
            ).catch(() => {});
        }

        // ─── PHASE 1: PLANNING ─────────────────────────────────
        useOllamaStore.getState().setAgentStatus('Planning...');
        useOllamaStore.getState().setAgentStep(0, 4);
        window.vibe.log(`[AGENT START] Mission: ${userMission.slice(0, 100)}`);
        window.vibe.log(`[PROJECT] ${projectStructure.split('\n').length} files found`);

        const plannerMessages: ChatMessage[] = [
            {
                role: 'system',
                content: buildPlannerPrompt(
                    userMission, projectPath, projectStructure, projectMemory, vibeInstructions, briefingContext
                )
            },
            { role: 'user', content: userMission }
        ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, plannerMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[PLAN] Failed: ${e}`);
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        const planResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        let planXml = extractTag(planResponse, 'plan');
        if (!planXml) {
            // Model didn't follow structure — treat whole response as plan
            planXml = planResponse;
        }

        const criteria = extractTag(planResponse, 'criteria') ||
            'Task completed successfully';

        // ─── PHASE 2: CRITIC ───────────────────────────────────
        useOllamaStore.getState().setAgentStatus('Reviewing plan...');
        useOllamaStore.getState().setAgentStep(1, 4);
        window.vibe.log(`[Agent] Phase: CRITIC`);

        const criticMessages: ChatMessage[] = [
            {
                role: 'system',
                content: buildCriticPrompt(planXml, userMission)
            },
            { role: 'user', content: 'Review this plan.' }
        ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, criticMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[CRITIC] Failed (non-blocking): ${e}`);
            // Critic failed — skip and proceed with original plan
        }

        const criticResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        const critiqueScore = parseInt(
            extractTag(criticResponse, 'score') || '8'
        );
        const revisedPlan = extractTag(criticResponse, 'revised_plan');

        window.vibe.log(`[CRITIC] Score: ${critiqueScore} | Revised: ${!!revisedPlan}`);

        if (critiqueScore < 7 && revisedPlan && revisedPlan !== 'APPROVED') {
            planXml = revisedPlan;
        }

        // Extract steps from plan
        const stepMatches = planXml.match(
            /<step[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/step>/g
        ) || [];

        const steps = stepMatches.map(stepStr => {
            const idMatch = stepStr.match(/id="(\d+)"/);
            const typeMatch = stepStr.match(/type="([^"]+)"/);
            const contentMatch = stepStr.match(/<step[^>]*>([\s\S]*?)<\/step>/);
            return {
                id: idMatch ? idMatch[1] : '1',
                type: typeMatch ? typeMatch[1] : 'execute',
                description: contentMatch ? contentMatch[1].trim() : stepStr
            };
        });

        // If no steps parsed, create a single step from the whole plan
        const executionSteps = steps.length > 0
            ? steps
            : [{ id: '1', type: 'execute', description: userMission }];

        window.vibe.log(`[PLAN] Steps: ${executionSteps.length} | Criteria: ${criteria.slice(0, 100)}`);

        // ─── PHASE 3: EXECUTE EACH STEP ────────────────────────
        useOllamaStore.getState().setAgentStep(2, 4);

        const previousResults: string[] = [];

        // Auto-cd to project at start
        if (projectPath && termId) {
            await window.vibe.clearTerminalOutput(termId);
            window.vibe.sendTerminalInput(termId, `cd "${projectPath}"\r`);
            await new Promise(r => setTimeout(r, 800));
            await window.vibe.clearTerminalOutput(termId);
        }

        for (const step of executionSteps.slice(0, MAX_STEPS)) {
            useOllamaStore.getState().setAgentStatus(
                `Step ${step.id}: ${step.description.slice(0, 50)}...`
            );
            window.vibe.log(`[STEP ${step.id}] Starting: ${step.description.slice(0, 80)}`);

            let stepSuccess = false;
            let retryCount = 0;
            let lastCritique = '';

            while (!stepSuccess && retryCount < MAX_STEP_RETRIES) {
                const executorMessages: ChatMessage[] = [
                    {
                        role: 'system',
                        content: buildExecutorPrompt(
                            userMission,
                            planXml,
                            step.description + (lastCritique
                                ? `\n\nPREVIOUS ATTEMPT FAILED: ${lastCritique}`
                                : ''),
                            step.id,
                            previousResults.slice(-3).join('\n\n'),
                            projectPath
                        )
                    },
                    {
                        role: 'user',
                        content: `Execute step ${step.id}: ${step.description}`
                    }
                ];

                useOllamaStore.getState().addMessage({
                    role: 'assistant', content: ''
                });

                try {
                    await window.vibe.chat(
                        selectedModel, executorMessages, apiKeys, getThinkOptions()
                    );
                    await waitForStreamDone();
                } catch (e) {
                    window.vibe.log(`[STEP ${step.id}] LLM call failed, retrying`);
                    retryCount++;
                    continue;
                }

                const stepResponse = useOllamaStore.getState()
                    .messages[useOllamaStore.getState().messages.length - 1]
                    ?.content || '';

                // ── Handle tool calls ─────────────────────────
                let toolResult = '';
                let toolType = 'none';

                // READ FILE
                const readMatch = stepResponse.match(
                    /<read_file\s+path=['"]([^'"]+)['"]\s*\/?>/
                );
                if (readMatch) {
                    toolType = 'read_file';
                    const filePath = readMatch[1];
                    useOllamaStore.getState().setAgentStatus(
                        `Reading: ${filePath}`
                    );
                    try {
                        const content = await window.vibe.readFile(
                            projectPath ? `${projectPath}/${filePath}` : filePath
                        );
                        toolResult = `FILE: ${filePath}\n${content}`;
                        useOllamaStore.getState().addMessage({
                            role: 'user',
                            content: `__FILE_CONTENTS__ ${filePath}\n${content}`
                        });
                    } catch {
                        toolResult = `ERROR: Could not read ${filePath}`;
                        useOllamaStore.getState().addMessage({
                            role: 'user',
                            content: `__FILE_CONTENTS__ ${filePath}\nERROR: File not found`
                        });
                    }
                }

                // WRITE FILE — handled by ChatMessages component
                const writeMatch = stepResponse.match(
                    /<write_file\s+path=['"]([^'"]+)['"]/
                );
                if (writeMatch) {
                    toolType = 'write_file';
                    toolResult = `WROTE: ${writeMatch[1]}`;
                    await new Promise(r => setTimeout(r, 500));
                }

                // EXECUTE COMMAND
                const executeMatch = stepResponse.match(
                    /<execute>([\s\S]*?)<\/execute>/
                );
                if (executeMatch && termId) {
                    toolType = 'execute';
                    const command = executeMatch[1].trim();
                    const safeCommand = sanitizeForPowerShell(command);

                    if (safeCommand !== command) {
                        window.vibe.log(
                            `[SANITIZE] Unix→PowerShell: "${command}" → "${safeCommand}"`
                        );
                    }

                    useOllamaStore.getState().setAgentStatus(
                        `Running: ${safeCommand.slice(0, 50)}`
                    );

                    await window.vibe.clearTerminalOutput(termId);
                    window.vibe.sendTerminalInput(termId, safeCommand + '\r');

                    const cleaned = await pollTerminalOutput(termId);
                    toolResult = cleaned || 'Command ran with no output';

                    window.vibe.log(`[OUTPUT] Length: ${toolResult.length} chars`);
                    window.vibe.log(`[OUTPUT] Preview: ${toolResult.slice(0, 150)}`);

                    useOllamaStore.getState().addMessage({
                        role: 'user',
                        content: `__TERMINAL_OUTPUT__\n${cleaned}`
                    });
                }

                // ANALYZE — no tool call needed
                const analyzeMatch = extractTag(stepResponse, 'analyze');
                if (analyzeMatch) {
                    toolType = 'analyze';
                    toolResult = analyzeMatch;
                }

                window.vibe.log(`[TOOL] ${toolType} | Result length: ${toolResult.length}`);

                // ── Check reflection score ─────────────────────
                const reflectionScore = parseInt(
                    extractTag(stepResponse, 'score') || '8'
                );
                const reflectionNotes = extractTag(stepResponse, 'notes') || '';
                const critique = extractTag(stepResponse, 'critique') || '';
                const shouldProceed = extractTag(stepResponse, 'proceed') !== 'no';

                window.vibe.log(`[REFLECT] Score: ${reflectionScore}/10 | Retry: ${retryCount}/${MAX_STEP_RETRIES}`);

                previousResults.push(
                    `Step ${step.id} (${step.description.slice(0, 50)}): ` +
                    `Score ${reflectionScore}/10. ${reflectionNotes}. ` +
                    `Tool result: ${toolResult.slice(0, 200)}`
                );

                // Check if mission is done
                const hasDone = /<done>[\s\S]*?<\/done>/.test(stepResponse);

                if (hasDone) {
                    const doneSummary = extractTag(stepResponse, 'summary') ||
                        'Task completed';
                    const doneFiles = extractTag(stepResponse, 'files_changed') || '';

                    // Save memory
                    if (projectPath) {
                        const newMemory = {
                            lastSession: doneSummary,
                            keyFiles: [] as string[],
                            architecturalDecisions: [] as string[],
                            currentPhase: 'development',
                            updatedAt: new Date().toISOString(),
                        };
                        window.vibe.writeMemory(projectPath, newMemory).then(() => {
                            useUIStore.getState().setProjectMemory(newMemory);
                        });
                    }

                    // Obsidian: log decision
                    if (obsidianKey && projectPath) {
                        window.vibe.obsidianLogDecision(
                            obsidianKey, projectName, doneSummary, doneFiles
                        ).catch(() => {});
                    }

                    window.vibe.log(`[Loop] Mission complete | Steps done: ${step.id}`);
                    useOllamaStore.getState().setIsGenerating(false);
                    useOllamaStore.getState().setAgentStep(0, 0);
                    useOllamaStore.getState().setAgentStatus('');
                    return;
                }

                if (reflectionScore >= REFLECTION_THRESHOLD && shouldProceed) {
                    stepSuccess = true;
                } else {
                    // Retry with critique
                    lastCritique = critique ||
                        `Score was ${reflectionScore}/10. ${reflectionNotes}`;
                    retryCount++;
                    useOllamaStore.getState().setAgentStatus(
                        `Retrying step ${step.id} (attempt ${retryCount + 1})...`
                    );
                }
            }

            // Log every step completion to the collector agent
            window.vibe.logAgentAction(
                `Step ${step.id}: ${step.description.slice(0, 100)}`
            ).catch(() => {});

            if (!stepSuccess) {
                // Step failed after all retries — tell user and stop
                useOllamaStore.getState().addMessage({
                    role: 'assistant',
                    content: `⚠ Step ${step.id} failed after ${MAX_STEP_RETRIES} attempts. ` +
                        `Last issue: ${previousResults[previousResults.length - 1]}. ` +
                        `Please review and try a more specific instruction.`
                });
                window.vibe.log(`[STEP ${step.id}] FAILED after ${MAX_STEP_RETRIES} retries`);
                useOllamaStore.getState().setIsGenerating(false);
                useOllamaStore.getState().setAgentStep(0, 0);
                useOllamaStore.getState().setAgentStatus('');
                return;
            }
        }

        // ─── PHASE 4: VERIFIER ─────────────────────────────────
        useOllamaStore.getState().setAgentStatus('Verifying results...');
        useOllamaStore.getState().setAgentStep(3, 4);
        window.vibe.log(`[Agent] Phase: VERIFY`);

        const verifierMessages: ChatMessage[] = [
            {
                role: 'system',
                content: buildVerifierPrompt(
                    userMission,
                    criteria,
                    previousResults.join('\n\n')
                )
            },
            { role: 'user', content: 'Verify the mission results.' }
        ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, verifierMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[VERIFY] Failed (non-blocking): ${e}`);
        }

        const verifierResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]
            ?.content || '';

        const criteriaMet = extractTag(verifierResponse, 'criteria_met');
        const verifyScore = extractTag(verifierResponse, 'score') || '?';
        const remaining = extractTag(verifierResponse, 'remaining');

        window.vibe.log(`[VERIFY] Criteria met: ${criteriaMet} | Score: ${verifyScore}`);

        if (criteriaMet === 'no' && remaining) {
            useOllamaStore.getState().setAgentStatus(
                'Mission incomplete — informing user...'
            );
            useOllamaStore.getState().addMessage({
                role: 'assistant',
                content: `⚠ Mission partially complete. Still needed:\n${remaining}\n\n` +
                    `Reply to continue or adjust the approach.`
            });
        }

        // Save final memory
        if (projectPath) {
            const finalSummary = previousResults.slice(-2).join(' | ');
            const newMemory = {
                lastSession: finalSummary.slice(0, 500),
                keyFiles: [] as string[],
                architecturalDecisions: [] as string[],
                currentPhase: 'development',
                updatedAt: new Date().toISOString(),
            };
            window.vibe.writeMemory(projectPath, newMemory).then(() => {
                useUIStore.getState().setProjectMemory(newMemory);
            });
        }

        // Obsidian: log agent run
        const stepDescriptions = executionSteps.map(s => s.description);
        if (obsidianKey && projectPath) {
            window.vibe.obsidianLogRun(
                obsidianKey,
                projectName,
                userMission,
                selectedModel,
                stepDescriptions,
                previousResults.slice(-1)[0] || 'No result',
                criteriaMet || 'unknown'
            ).catch(() => {});
        }

        window.vibe.log(`[AGENT END] Mission: ${userMission.slice(0, 50)} | Steps completed: ${executionSteps.length}`);
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

`

================================================================
File: src\renderer\components\layout\MainArea.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\layout\MenuBar.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\layout\SettingsModal.tsx
================================================================
`ts
import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useSettingsStore } from '../../store/settings';

function ObsidianStatusIndicator({ apiKey }: { apiKey: string }) {
    const [status, setStatus] = React.useState<'unknown' | 'connected' | 'disconnected'>('unknown');

    React.useEffect(() => {
        if (!apiKey) { setStatus('unknown'); return; }
        window.vibe.obsidianPing(apiKey).then(ok => {
            setStatus(ok ? 'connected' : 'disconnected');
        }).catch(() => setStatus('disconnected'));
    }, [apiKey]);

    if (status === 'unknown') return null;

    return (
        <div className="obsidian-status">
            <div className={`obsidian-status__dot obsidian-status__dot--${status}`} />
            {status === 'connected'
                ? 'Obsidian connected — vault ready'
                : 'Obsidian not detected — is the plugin running?'
            }
        </div>
    );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const setApiKey = useSettingsStore(state => state.setApiKey);
    const [saved, setSaved] = useState(false);

    const handleSaveAndClose = () => {
        if (apiKeys.obsidian) {
            window.vibe.setObsidianKey(apiKeys.obsidian).catch(() => {});
        }
        setSaved(true);
        setTimeout(() => onClose(), 400);
    };

    return (
        <div className="settings-overlay">
            <div onClick={onClose} className="settings-backdrop" />
            <GlassPanel variant="strong" className="settings-panel" style={{ overflowY: 'auto', maxHeight: '80vh' }}>
                <div className="settings-header">
                    <h2 className="settings-header__title">IDE Settings</h2>
                    <button onClick={onClose} className="settings-header__close">✕</button>
                </div>

                <div className="settings-section">
                    <h3 className="settings-section__title">Cloud API Keys</h3>
                    {['gemini', 'claude', 'openai', 'deepseek', 'groq', 'hf'].map(provider => (
                        <div key={provider} className="settings-field">
                            <label className="settings-field__label">
                                {provider === 'hf' ? 'HuggingFace' : provider} API Key
                            </label>
                            <input
                                type="password"
                                value={apiKeys[provider as keyof typeof apiKeys] || ''}
                                onChange={(e) => setApiKey(provider, e.target.value)}
                                placeholder={provider === 'hf' ? 'Enter HuggingFace token (hf_...)' : `Enter ${provider} key (autosaves)...`}
                                className="settings-field__input"
                            />
                        </div>
                    ))}
                </div>

                {/* ─── Obsidian Integration Section ─── */}
                <div className="settings-section settings-section--obsidian">
                    <h3 className="settings-section__title">Obsidian Integration</h3>

                    <div className="settings-info-box">
                        Install the <strong>Local REST API</strong> plugin in
                        Obsidian, then paste your API key below. VIBE will
                        automatically create project notes and log all agent
                        activity to your vault.
                    </div>

                    <div className="settings-field">
                        <label className="settings-field__label">
                            Obsidian Local REST API Key
                        </label>
                        <input
                            type="password"
                            value={apiKeys.obsidian || ''}
                            onChange={e => setApiKey('obsidian', e.target.value)}
                            placeholder="Paste API key from Obsidian plugin settings..."
                            className="settings-field__input"
                        />
                    </div>

                    <ObsidianStatusIndicator apiKey={apiKeys.obsidian || ''} />
                </div>

                <div className="settings-footer">
                    {saved && <span className="settings-footer__saved">Keys Saved! ✓</span>}
                    <button onClick={handleSaveAndClose} className="settings-footer__save-btn">Save & Close</button>
                </div>
            </GlassPanel>
        </div>
    );
}

`

================================================================
File: src\renderer\components\layout\Sidebar.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\layout\TitleBar.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\components\terminal\TerminalPane.tsx
================================================================
`ts
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

`

================================================================
File: src\renderer\hooks\useBackgroundTerminal.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\hooks\useFileSystem.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\hooks\useOllama.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\hooks\useTerminal.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\main.tsx
================================================================
`ts
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Forward renderer console.log to main process debug window
const _origLog = console.log
const _origError = console.error
const _origWarn = console.warn

console.log = (...args: any[]) => {
    _origLog(...args)
    try {
        window.vibe?.log(`[LOG] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`)
    } catch { }
}

console.error = (...args: any[]) => {
    _origError(...args)
    try {
        window.vibe?.log(`[ERROR] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`)
    } catch { }
}

console.warn = (...args: any[]) => {
    _origWarn(...args)
    try {
        window.vibe?.log(`[WARN] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`)
    } catch { }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

`

================================================================
File: src\renderer\store\editor.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\store\huggingface.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\store\ollama.ts
================================================================
`ts
import { create } from 'zustand';
import type { ChatMessage, ModelCapability } from '../../shared/types';
import { getFallbackCapabilities, fetchCapabilities } from '../utils/capabilities';

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
        // Start with fallback capabilities synchronously
        const capsMap: Record<string, ModelCapability> = {};
        models.forEach(m => {
            capsMap[m] = getFallbackCapabilities(m);
        });

        // Async fetch real capabilities and update store
        models.forEach(async (modelName) => {
            try {
                const real = await fetchCapabilities(modelName);
                useOllamaStore.getState().setModelCapability(modelName, real);
            } catch { /* keep fallback */ }
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


`

================================================================
File: src\renderer\store\settings.ts
================================================================
`ts
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
        obsidian: string;
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
                hf: '',
                obsidian: ''
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
`

================================================================
File: src\renderer\store\swarms.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\store\terminal.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\store\ui.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\store\workspaces.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\styles\globals.css
================================================================
`css
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

/* ═══════════════════════════════════════════════════════════
   CHAT MESSAGES
   ═══════════════════════════════════════════════════════════ */
.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.chat-empty { opacity: 0.5; }

.chat-bubble {
    max-width: 92%;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    font-family: var(--font-sans);
    animation: fadeUp 0.2s ease-out;
}
.chat-bubble--user {
    align-self: flex-end;
    background: var(--accent-light);
    color: var(--text);
}
.chat-bubble--assistant {
    align-self: flex-start;
    background: #fff;
    color: var(--text);
    border: 1px solid var(--border-light);
}
.chat-bubble--special {
    max-width: 100%;
    background: transparent;
    padding: 0;
    border: none;
}

.chat-terminal-output {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: #e6edf3;
    white-space: pre-wrap;
    word-break: break-all;
}
.chat-terminal-output__label {
    color: #7c8fa6;
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.chat-file-contents {
    background: rgba(0,102,255,0.04);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text);
    white-space: pre-wrap;
}
.chat-file-contents__label {
    color: var(--accent);
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.chat-swarm-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 2px 0;
}

/* ═══════════════════════════════════════════════════════════
   AGENT CARDS — Shared base
   ═══════════════════════════════════════════════════════════ */
.agent-card {
    border-radius: 10px;
    margin: 8px 0;
    overflow: hidden;
    animation: fadeUp 0.25s ease-out;
}
.agent-card__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: default;
}
.agent-card__icon { font-size: 14px; }
.agent-card__title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex: 1;
}
.agent-card__toggle {
    font-size: 12px;
    cursor: pointer;
    color: var(--text-muted);
    user-select: none;
}
.agent-card__body {
    padding: 0 14px 12px;
    font-size: 12px;
    line-height: 1.6;
}

/* ─── Plan Card ──────────────────────────────────────────── */
.agent-card--plan {
    background: rgba(0,102,255,0.04);
    border: 1px solid rgba(0,102,255,0.15);
}
.agent-card--plan .agent-card__header { cursor: pointer; }
.agent-card--plan .agent-card__title { color: var(--accent); }
.agent-plan__mission {
    color: var(--text);
    font-weight: 500;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(0,102,255,0.1);
}
.agent-plan__steps { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.agent-plan__step { display: flex; gap: 8px; align-items: flex-start; color: var(--text-secondary); }
.agent-plan__step-num { color: var(--accent); font-weight: 700; flex-shrink: 0; width: 18px; }
.agent-plan__criteria {
    color: var(--text-muted);
    font-style: italic;
    font-size: 11px;
    padding-top: 8px;
    border-top: 1px solid rgba(0,102,255,0.1);
}
.agent-plan__criteria-label { font-weight: 700; font-style: normal; }
.agent-plan__risks {
    color: var(--warn);
    font-size: 11px;
    margin-top: 4px;
}
.agent-plan__risks-label { font-weight: 700; }

/* ─── Critique Card ──────────────────────────────────────── */
.agent-card--critique {
    border: 1px solid transparent;
}
.agent-card--critique-approved {
    background: rgba(0,168,112,0.04);
    border-color: rgba(0,168,112,0.2);
}
.agent-card--critique-approved .agent-card__title { color: var(--green); }
.agent-card--critique-approved .agent-card__icon { color: var(--green); }

.agent-card--critique-revised {
    background: rgba(230,138,0,0.04);
    border-color: rgba(230,138,0,0.2);
}
.agent-card--critique-revised .agent-card__title { color: var(--warn); }
.agent-card--critique-revised .agent-card__icon { color: var(--warn); }

.agent-critique__score {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    margin-left: auto;
}
.agent-critique__status {
    padding: 0 14px 10px;
    font-size: 12px;
    font-weight: 600;
}
.agent-card--critique-approved .agent-critique__status { color: var(--green); }
.agent-card--critique-revised .agent-critique__status { color: var(--warn); }

/* ─── Reflection Pill ────────────────────────────────────── */
.agent-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    margin: 4px 0;
    animation: fadeIn 0.2s ease-out;
}
.agent-pill--good {
    background: rgba(0,168,112,0.08);
    color: var(--green);
    border: 1px solid rgba(0,168,112,0.2);
}
.agent-pill--retry {
    background: rgba(230,138,0,0.08);
    color: var(--warn);
    border: 1px solid rgba(230,138,0,0.2);
}

/* ─── Verification Card ──────────────────────────────────── */
.agent-card--verification { border: 1px solid transparent; }
.agent-card--verification-complete {
    background: rgba(0,168,112,0.04);
    border-color: rgba(0,168,112,0.2);
}
.agent-card--verification-complete .agent-card__title { color: var(--green); }
.agent-card--verification-incomplete {
    background: rgba(230,138,0,0.04);
    border-color: rgba(230,138,0,0.2);
}
.agent-card--verification-incomplete .agent-card__title { color: var(--warn); }
.agent-card--verification-partial {
    background: rgba(0,102,255,0.04);
    border-color: rgba(0,102,255,0.15);
}
.agent-card--verification-partial .agent-card__title { color: var(--accent); }
.agent-verification__evidence { color: var(--text-secondary); margin-bottom: 6px; }
.agent-verification__remaining-title { font-weight: 700; color: var(--text); margin-bottom: 2px; }
.agent-verification__remaining-item { color: var(--text-secondary); padding-left: 8px; }

/* ─── Done Card ──────────────────────────────────────────── */
.agent-card--done {
    background: rgba(0,168,112,0.04);
    border: 1px solid rgba(0,168,112,0.2);
}
.agent-card--done .agent-card__title { color: var(--green); }
.agent-done__summary { color: var(--text); font-weight: 500; }
.agent-done__files {
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    margin-top: 4px;
}

/* ─── Analyze Card ───────────────────────────────────────── */
.agent-card--analyze {
    background: rgba(0,0,0,0.02);
    border: 1px solid var(--border-light);
}
.agent-card--analyze .agent-card__title { color: var(--text-muted); }
.agent-analyze__content {
    color: var(--text-secondary);
    font-style: italic;
}

/* ─── Command Block ──────────────────────────────────────── */
.agent-command {
    background: #1e1e2e;
    border: 1px solid #313244;
    border-radius: 8px;
    margin: 8px 0;
    overflow: hidden;
}
.agent-command__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.agent-command__label {
    font-size: 10px;
    color: var(--accent);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.agent-command__copy {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
}
.agent-command__copy:hover { color: var(--accent); }
.agent-command__body {
    padding: 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: #cdd6f4;
    white-space: pre-wrap;
}
.agent-command__prompt {
    color: var(--accent);
    margin-right: 8px;
    opacity: 0.7;
}

/* ─── File Write Block ───────────────────────────────────── */
.agent-file-write {
    background: rgba(0, 168, 112, 0.05);
    border: 1px solid rgba(0, 168, 112, 0.2);
    padding: 6px 12px;
    border-radius: 6px;
    margin: 4px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}
.agent-file-write__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--warn);
    flex-shrink: 0;
}
.agent-file-write__dot--done { background: var(--green); }
.agent-file-write__info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; }
.agent-file-write__path {
    font-size: 11px;
    color: var(--text);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.agent-file-write__status {
    font-size: 9px;
    color: var(--text-muted);
    font-weight: 700;
}
.agent-file-write__status--done { color: var(--green); }

/* ═══════════════════════════════════════════════════════════
   SETTINGS MODAL
   ═══════════════════════════════════════════════════════════ */
.settings-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.settings-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
}
.settings-panel {
    width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 24px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 20px;
}
.settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: 12px;
}
.settings-header__title { font-size: 18px; margin: 0; color: var(--text); }
.settings-header__close {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 20px;
    color: var(--text-muted);
}
.settings-section { display: flex; flex-direction: column; gap: 16px; }
.settings-section--obsidian {
    margin-top: 4px;
    padding-top: 16px;
    border-top: 1px solid var(--border-light);
}
.settings-section__title {
    font-size: 14px;
    color: var(--text);
    margin: 0;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: 8px;
}
.settings-field {}
.settings-field__label {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
    text-transform: capitalize;
}
.settings-field__input {
    width: 100%;
    padding: 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.05);
    color: var(--text);
    outline: none;
}
.settings-info-box {
    padding: 10px 12px;
    background: rgba(0,102,255,0.04);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
}
.settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 10px;
    align-items: center;
}
.settings-footer__saved { color: var(--green); font-size: 13px; font-weight: 600; }
.settings-footer__save-btn {
    padding: 8px 24px;
    background: var(--accent-gradient);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: 600;
}

/* ─── Obsidian Status Indicator ──────────────────────────── */
.obsidian-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
}
.obsidian-status__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}
.obsidian-status__dot--connected { background: var(--green); }
.obsidian-status__dot--disconnected { background: var(--text-muted); }

`

================================================================
File: src\renderer\utils\capabilities.ts
================================================================
`ts
import type { ModelCapability } from '../../shared/types';

export const OLLAMA_ONLY_MODELS = new Set<string>([
    'gpt-oss-120b',
]);

export async function fetchCapabilities(modelId: string): Promise<ModelCapability> {
    try {
        const result = await window.vibe.getModelCapabilities(modelId);
        if (!result) return getFallbackCapabilities(modelId);
        return {
            think: result.think,
            thinkBudget: result.thinkBudget,
            vision: result.vision,
            tools: result.tools,
            image: result.vision,
            canExecute: true,
            requiresApproval: true,
        };
    } catch {
        return getFallbackCapabilities(modelId);
    }
}

// Keep as fallback for cloud models Ollama doesn't know about
export function getFallbackCapabilities(modelId: string): ModelCapability {
    const lower = modelId.toLowerCase();
    const caps: ModelCapability = { canExecute: true, requiresApproval: true };

    if (lower.includes('qwq') || lower.includes('deepseek-r1') ||
        lower.includes('r1') || lower.includes('claude-3-7') ||
        lower.includes('claude-3-5') || lower.includes('qwen3')) {
        caps.think = true;
        caps.thinkBudget = lower.includes('claude') ? 'tiered' : 'toggle';
    }

    if (lower.includes('qwen2.5') || lower.includes('gemma3')) {
        caps.think = true;
        caps.thinkBudget = 'toggle';
    }

    if (lower.includes('vl') || lower.includes('vision') ||
        lower.includes('llava') || lower.includes('gemini') ||
        lower.includes('gpt-4o') || lower.includes('llama4')) {
        caps.vision = true;
        caps.image = true;
    }

    if (lower.includes('gemini') || lower.includes('gpt-4o') ||
        lower.includes('claude') || lower.includes('qwen') ||
        lower.includes('llama3')) {
        caps.tools = true;
    }

    if (lower.includes('reasoner') || lower.includes('o1') || lower.includes('o3') ||
        lower.includes('sonnet') || lower.includes('deepseek')) {
        caps.think = true;
    }

    if (lower.includes('gemini') || lower.includes('gpt-4o') ||
        lower.includes('claude') || lower.includes('cloud')) {
        caps.web = true;
    }

    return caps;
}

// Synchronous alias kept for backward compatibility (used in initial store hydration)
export function getCapabilities(modelId: string): ModelCapability {
    return getFallbackCapabilities(modelId);
}

`

================================================================
File: src\renderer\utils\commandSanitizer.ts
================================================================
`ts
/**
 * Translate Unix/bash commands to PowerShell equivalents.
 * Runs on every <execute> command before it hits the terminal.
 * If the command is already PowerShell-native it passes through unchanged.
 */
export function sanitizeForPowerShell(command: string): string {
    let cmd = command.trim()

    // Replace && with ; (PowerShell uses semicolons)
    cmd = cmd.replace(/\s*&&\s*/g, '; ')

    // Replace || with PowerShell equivalent
    cmd = cmd.replace(/\s*\|\|\s*/g, '; if ($LASTEXITCODE -ne 0) { ')

    // ls variants → dir
    cmd = cmd.replace(/^ls\s*-la?\b/gm, 'dir')
    cmd = cmd.replace(/^ls\s*-al?\b/gm, 'dir')
    cmd = cmd.replace(/^ls\s*$/gm, 'dir')
    cmd = cmd.replace(/^ls\s+([^\|]+)/gm, 'dir "$1"')

    // cat → Get-Content
    cmd = cmd.replace(/\bcat\s+([^\|;\n]+)/g, 'Get-Content "$1"')

    // touch → New-Item
    cmd = cmd.replace(
        /\btouch\s+([^\|;\n]+)/g,
        'New-Item -ItemType File -Force "$1"'
    )

    // mkdir -p → New-Item
    cmd = cmd.replace(
        /\bmkdir\s+-p\s+([^\|;\n]+)/g,
        'New-Item -ItemType Directory -Force "$1"'
    )
    cmd = cmd.replace(
        /\bmkdir\s+([^\|;\n]+)/g,
        'New-Item -ItemType Directory -Force "$1"'
    )

    // rm -rf → Remove-Item
    cmd = cmd.replace(
        /\brm\s+-rf?\s+([^\|;\n]+)/g,
        'Remove-Item -Recurse -Force "$1"'
    )
    cmd = cmd.replace(
        /\brm\s+([^\|;\n]+)/g,
        'Remove-Item "$1"'
    )

    // cp → Copy-Item
    cmd = cmd.replace(
        /\bcp\s+([^\s]+)\s+([^\|;\n]+)/g,
        'Copy-Item "$1" "$2"'
    )

    // mv → Move-Item
    cmd = cmd.replace(
        /\bmv\s+([^\s]+)\s+([^\|;\n]+)/g,
        'Move-Item "$1" "$2"'
    )

    // grep → Select-String
    cmd = cmd.replace(
        /\bgrep\s+([^\s]+)\s+([^\|;\n]+)/g,
        'Select-String "$1" "$2"'
    )

    // find . -name → Get-ChildItem -Recurse -Filter
    cmd = cmd.replace(
        /\bfind\s+\.\s+-name\s+([^\|;\n]+)/g,
        'Get-ChildItem -Recurse -Filter $1'
    )

    // echo with quotes
    cmd = cmd.replace(/\becho\s+"([^"]+)"/g, 'Write-Host "$1"')
    cmd = cmd.replace(/\becho\s+'([^']+)'/g, "Write-Host '$1'")
    cmd = cmd.replace(/\becho\s+([^\|;\n]+)/g, 'Write-Host $1')

    // pwd → Get-Location
    cmd = cmd.replace(/\bpwd\b/g, 'Get-Location')

    // which → Get-Command
    cmd = cmd.replace(/\bwhich\s+([^\|;\n]+)/g, 'Get-Command $1')

    // chmod / chown → no-op with note (Windows doesn't use these)
    cmd = cmd.replace(
        /\bchmod\s+[^\|;\n]+/g,
        'Write-Host "chmod not needed on Windows"'
    )
    cmd = cmd.replace(
        /\bchown\s+[^\|;\n]+/g,
        'Write-Host "chown not needed on Windows"'
    )

    // head -n → Select-Object -First
    cmd = cmd.replace(
        /\bhead\s+-(\d+)\s+([^\|;\n]+)/g,
        'Get-Content "$2" | Select-Object -First $1'
    )
    cmd = cmd.replace(
        /\bhead\s+-n\s+(\d+)\s+([^\|;\n]+)/g,
        'Get-Content "$2" | Select-Object -First $1'
    )

    // tail -n → Select-Object -Last
    cmd = cmd.replace(
        /\btail\s+-(\d+)\s+([^\|;\n]+)/g,
        'Get-Content "$2" | Select-Object -Last $1'
    )

    // wc -l → Measure-Object
    cmd = cmd.replace(
        /\bwc\s+-l\s*([^\|;\n]*)/g,
        (_, file: string) => file.trim()
            ? `(Get-Content "${file.trim()}").Count`
            : '($input | Measure-Object -Line).Lines'
    )

    // sed basic replace → not easy, just warn
    cmd = cmd.replace(
        /\bsed\s+[^\|;\n]+/g,
        'Write-Host "Use (Get-Content file) -replace pattern, replacement | Set-Content file"'
    )

    return cmd
}

`

================================================================
File: src\renderer\utils\streamBus.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\utils\tags.ts
================================================================
`ts
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

`

================================================================
File: src\renderer\utils\terminal.ts
================================================================
`ts
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

`

================================================================
File: src\shared\constants.ts
================================================================
`ts
export const OLLAMA_ONLY_MODELS = new Set<string>([
  'gpt-oss-120b',
]);

`

================================================================
File: src\shared\types.ts
================================================================
`ts
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
    vision?: boolean;
    tools?: boolean;
    contextLength?: number;
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
    getModelCapabilities: (modelName: string) => Promise<{
        modelName: string;
        think: boolean;
        thinkBudget?: 'toggle' | 'tiered';
        vision: boolean;
        tools: boolean;
        contextLength: number;
        family: string;
        rawCapabilities: string[];
    } | null>;
    getLoadedModels: () => Promise<string[]>;
    log: (msg: string) => Promise<void>;

    // Background Agents
    startBackgroundAgents: (projectPath: string, obsidianKey?: string) => Promise<{ success: boolean }>;
    getBriefing: () => Promise<string>;
    logAgentAction: (description: string) => Promise<void>;
    generateNotebookExport: (outputPath: string) => Promise<boolean>;
    setObsidianKey: (key: string) => Promise<void>;
    getAgentStatus: () => Promise<{
        collector: {
            isRunning: boolean;
            eventCount: number;
            lastEventTime: number | null;
            isDistilling: boolean;
            lastDistillTime: number | null;
        };
        reviewer: {
            isRunning: boolean;
            isSynthesizing: boolean;
            lastBriefingTime: number;
            briefingCount: number;
        };
    }>;

    // Obsidian Integration
    obsidianPing: (apiKey: string) => Promise<boolean>;
    obsidianUpsertNote: (apiKey: string, vaultPath: string, content: string) => Promise<boolean>;
    obsidianAppendNote: (apiKey: string, vaultPath: string, content: string) => Promise<boolean>;
    obsidianUpdateProject: (
        apiKey: string,
        projectName: string,
        projectStructure: string,
        projectPath: string
    ) => Promise<boolean>;
    obsidianLogRun: (
        apiKey: string,
        projectName: string,
        mission: string,
        model: string,
        steps: string[],
        result: string,
        criteraMet: string
    ) => Promise<boolean>;
    obsidianLogDecision: (
        apiKey: string,
        projectName: string,
        summary: string,
        filesChanged: string
    ) => Promise<boolean>;

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

`

================================================================
File: src\vite-env.d.ts
================================================================
`ts
/// <reference types="vite/client" />

`

================================================================
File: package.json
================================================================
`json
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

`

================================================================
File: vite.config.ts
================================================================
`ts
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

`

================================================================
File: tsconfig.json
================================================================
`json
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
`

================================================================
File: electron-builder.yml
================================================================
`text
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

`

================================================================
File: index.html
================================================================
`html
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

`

