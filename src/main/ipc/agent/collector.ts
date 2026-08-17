import fs from 'node:fs'
import path from 'node:path'
import { exec } from 'node:child_process'
import { executeNonStreamingChat } from '../modelRouter'
import type { ChatMessage } from '../../../shared/types'

const MAX_EVENTS = 200
const DISTILL_INTERVAL_MS = 10 * 60 * 1000
const HEALTH_UPDATE_INTERVAL_MS = 20 * 1000
const BRIEFING_EVENT_THRESHOLD = 3
/** Bounded recursive watcher depth (see startFileWatcher). */
const WATCH_MAX_DEPTH = 6
/** Bump when a .vibe artifact's shape changes; readers must tolerate missing. */
const VIBE_SCHEMA_VERSION = 1

/** execSync blocks the whole main process; run git probes async with a bound. */
function runGit(cmd: string, cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd, windowsHide: true, timeout: 5000, encoding: 'utf8' },
      (err, stdout) => err ? reject(err) : resolve(stdout))
  })
}

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

// Status broadcast - renderer reads this for the neural widget
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
  /** Serializes events.log appends — async, ordered, never blocking the watcher. */
  writeChain: Promise<unknown> = Promise.resolve()

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
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 3000)
      const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal })
      clearTimeout(timer)
      if (res.ok) {
        const data = await res.json() as any
        const first = (data.models || [])[0]?.name
        if (first) return `ollama:${first}`
      }
    } catch { /* Ollama not reachable — fall through to the default */ }

    return 'ollama:llama3.2'
  }

  private async runModelChat(messages: ChatMessage[]): Promise<string> {
    const model = await this.resolveModel()
    return executeNonStreamingChat(model, messages, this.apiKeys)
  }

  /**
   * Idempotent: starting again for the same project is a no-op; starting for a
   * different project fully stops the previous session first. Callers should
   * never have to reason about leftover watchers or timers.
   */
  start(projectPath: string) {
    if (this.isRunning && this.projectPath === projectPath) return
    if (this.isRunning || this.projectPath) this.stop()

    this.projectPath = projectPath
    this.vibeDir = path.join(projectPath, '.vibe')
    try { fs.mkdirSync(this.vibeDir, { recursive: true }) }
    catch (e) { console.warn('[Collector] could not create .vibe dir:', e) }
    const eventsLog = path.join(this.vibeDir, 'events.log')
    if (!fs.existsSync(eventsLog)) {
      try { fs.writeFileSync(eventsLog, '') }
      catch (e) { console.warn('[Collector] could not create events.log:', e) }
    }
    this.startFileWatcher()
    this.startHealthLoop()
    this.startDistillLoop()
    this.isRunning = true
    console.log('[Collector] Started for:', projectPath)
  }

  /** Full stop AND state reset — a new session must not inherit events,
      counters, or timestamps from the previous project. */
  stop() {
    for (const w of this.watchers) { try { w.close() } catch { /* already closed */ } }
    this.watchers = []
    if (this.healthInterval) { clearInterval(this.healthInterval); this.healthInterval = null }
    if (this.distillInterval) { clearInterval(this.distillInterval); this.distillInterval = null }
    this.events = []
    this.newEventsSinceBriefing = 0
    this.lastEventTime = null
    this.lastDistillTime = null
    this.isDistilling = false
    this.onBriefingNeeded = null
    this.projectPath = null
    this.vibeDir = null
    this.writeChain = Promise.resolve()
    this.isRunning = false
  }

  /**
   * Bounded recursive watcher.
   *
   * fs.watch({ recursive: true }) on Linux uses one inotify watch PER DIRECTORY
   * and exhausts the system limit on large trees; it also behaves differently
   * per OS. Strategy mirrors ipc/filesystem.ts: native recursive watchers on
   * macOS/Windows (where they're efficient), a bounded per-directory walk on
   * Linux. Any single-directory failure is skipped, not fatal.
   */
  watchers: fs.FSWatcher[] = []

  startFileWatcher() {
    if (!this.projectPath) return
    const root = this.projectPath
    const IGNORE = new Set(['node_modules','.git','dist','build','out',
                            '.vibe','__pycache__','.next','target'])

    const onChange = (filename: string | null) => {
      if (!filename) return
      const norm = filename.replace(/\\/g, '/')
      if ([...IGNORE].some(ig => norm.split('/').includes(ig))) return
      this.addEvent({ ts: Date.now(), type: 'file_changed', path: norm })
    }

    if (process.platform === 'win32' || process.platform === 'darwin') {
      try {
        this.watchers.push(fs.watch(root, { recursive: true }, (_e, f) => onChange(f)))
      } catch (e) {
        console.warn('[Collector] Watcher setup failed (non-fatal):', e)
      }
      return
    }

    const addWatcher = (dir: string) => {
      try {
        this.watchers.push(fs.watch(dir, (_e, f) => onChange(f ? path.relative(root, path.join(dir, f)) : f)))
      } catch (e) {
        console.warn('[Collector] skipping unwatchable dir:', dir, e)
      }
    }
    const walk = (dir: string, depth: number) => {
      if (depth <= 0) return
      addWatcher(dir)
      let entries: fs.Dirent[] = []
      try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { return }
      for (const entry of entries) {
        if (!entry.isDirectory() || IGNORE.has(entry.name)) continue
        walk(path.join(dir, entry.name), depth - 1)
      }
    }
    walk(root, WATCH_MAX_DEPTH)
  }

  addEvent(event: CollectorEvent) {
    this.events.push(event)
    if (this.events.length > MAX_EVENTS) this.events.shift()
    this.lastEventTime = Date.now()
    if (this.vibeDir) {
      // Async + serialized: a burst of file events must not block the main
      // process with appendFileSync in the hot path.
      const file = path.join(this.vibeDir, 'events.log')
      const line = JSON.stringify(event) + '\n'
      this.writeChain = this.writeChain
        .then(() => fs.promises.appendFile(file, line))
        .catch((e) => console.warn('[Collector] events.log append failed:', e))
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

  /** Prevents overlapping health runs if a git probe is slow. */
  private healthInFlight = false

  async updateHealth() {
    // Capture locals: a stop() mid-run must not crash on nulled fields; the
    // in-flight write simply lands in the previous project's .vibe dir.
    const projectPath = this.projectPath
    const vibeDir = this.vibeDir
    if (!projectPath || !vibeDir) return
    if (this.healthInFlight) return
    this.healthInFlight = true
    try {
      const cwd = projectPath
      let branch = 'unknown', uncommittedChanges = 0, lastCommit = 'none'
      try {
        branch = (await runGit('git branch --show-current', cwd)).trim()
      } catch { /* not a git repo or git unavailable */ }
      try {
        const status = (await runGit('git status --short', cwd)).trim()
        uncommittedChanges = status ? status.split('\n').filter(l => l.trim()).length : 0
      } catch { /* ignore */ }
      try {
        lastCommit = (await runGit('git log -1 --format="%s"', cwd)).trim()
      } catch { /* ignore */ }

      const recentChanged = this.events
        .filter(e => e.type === 'file_changed' && e.path)
        .slice(-10)
        .map(e => e.path!)

      const openTodos: string[] = []
      for (const fp of recentChanged.slice(0, 5)) {
        try {
          const full = path.join(projectPath, fp)
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
        if (fs.existsSync(path.join(projectPath, 'CMakeLists.txt'))) framework = 'Qt/CMake'
        else if (fs.existsSync(path.join(projectPath, 'package.json'))) framework = 'Node.js'
        else if (fs.existsSync(path.join(projectPath, 'Cargo.toml'))) framework = 'Rust'
      } catch { /* unreadable dir — framework stays Unknown */ }

      const health: HealthState & { version: number } = {
        version: VIBE_SCHEMA_VERSION,
        updatedAt: new Date().toISOString(),
        projectPath,
        projectName: path.basename(projectPath),
        git: { branch, uncommittedChanges, lastCommit },
        recentChanges: recentChanged.slice(-5),
        openTodos,
        projectLanguage,
        framework,
        eventCount: this.events.length
      }

      fs.writeFileSync(
        path.join(vibeDir, 'health.json'),
        JSON.stringify(health, null, 2)
      )

      if (this.obsidianApiKey) {
        this.syncToObsidian(this.obsidianApiKey, health)
          .catch((e) => console.warn('[Collector] Obsidian sync failed:', e))
      }
    } catch (e) {
      console.warn('[Collector] updateHealth error (non-fatal):', e)
    } finally {
      this.healthInFlight = false
    }
  }

  async syncToObsidian(apiKey: string, health: HealthState) {
    try {
      const { obsidianUpsert } = await import('../obsidian')
      const projectName = path.basename(this.projectPath || health.projectPath || '')
      const overview = `# ${projectName} - Project Overview
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
      const ok = await obsidianUpsert(apiKey, `VIBE/${projectName}/Project Overview.md`, overview)
      if (!ok) console.warn('[Collector] Obsidian project-overview sync failed (see [Obsidian] line above)')
    } catch (e) {
      console.warn('[Collector] Obsidian sync error:', e)
    }
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
          existing = Array.isArray(raw?.facts) ? raw.facts : []
        } catch { /* no usable facts file yet — start fresh */ }

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
          version: VIBE_SCHEMA_VERSION,
          updatedAt: new Date().toISOString(),
          facts: combined
        }, null, 2))
        this.lastDistillTime = Date.now()
      }
    } catch (e) {
      console.warn('[Collector] distillEvents failed (non-fatal):', e)
    }
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
