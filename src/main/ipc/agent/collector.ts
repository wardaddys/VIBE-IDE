import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { executeNonStreamingChat } from '../modelRouter'
import type { ChatMessage } from '../../../shared/types'

const MAX_EVENTS = 200
const DISTILL_INTERVAL_MS = 10 * 60 * 1000
const HEALTH_UPDATE_INTERVAL_MS = 20 * 1000
const BRIEFING_EVENT_THRESHOLD = 3

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
  apiKeys: Record<string, string> = {}
  model: string = ''
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
  setApiKeys(keys: Record<string, string>) { this.apiKeys = keys || {} }
  setModel(model: string) { this.model = (model || '').trim() }

  private async resolveModel(): Promise<string> {
    if (this.model?.trim()) return this.model.trim()
    if (this.apiKeys?.openrouter) return 'openrouter:openai/gpt-4o-mini'
    if (this.apiKeys?.hf) return 'hf:Qwen/Qwen2.5-Coder-32B-Instruct'

    try {
      const res = await fetch('http://localhost:11434/api/tags')
      if (res.ok) {
        const data = await res.json() as any
        const first = (data.models || [])[0]?.name
        if (first) return `ollama:${first}`
      }
    } catch {}

    return 'ollama:llama3.2'
  }

  private async runModelChat(messages: ChatMessage[]): Promise<string> {
    const model = await this.resolveModel()
    return executeNonStreamingChat(model, messages, this.apiKeys)
  }

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
    if (this.newEventsSinceBriefing >= BRIEFING_EVENT_THRESHOLD && this.onBriefingNeeded) {
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
      const content = await this.runModelChat([
        {
          role: 'system',
          content: 'You are a project intelligence agent. Summarize these recent project events into 3-5 concise facts. Each fact on its own line. Facts should be durable observations about the project state, not one-time events. Replace stale facts with newer truth when conflict exists. Format: FACT: [observation]'
        },
        {
          role: 'user',
          content: 'Recent events:\n' + recentEvents.map(e =>
            `${new Date(e.ts).toISOString()} [${e.type}] ${e.path || ''} ${e.detail || ''}`
          ).join('\n')
        }
      ])

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

        // Replace duplicate/stale facts by fuzzy subject prefix and preserve newest.
        const merged = [...existing]
        for (const nf of newFacts) {
          const key = nf.toLowerCase().split(':')[0].slice(0, 60)
          const idx = merged.findIndex(f => f.toLowerCase().startsWith(key))
          if (idx >= 0) merged[idx] = nf
          else merged.push(nf)
        }
        const deduped = Array.from(new Set(merged.map(f => f.trim()).filter(Boolean)))
        const combined = deduped.slice(-30)
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
