import fs from 'node:fs'
import path from 'node:path'
import { executeNonStreamingChat } from '../modelRouter'
import type { ChatMessage } from '../../../shared/types'

const REVIEW_INTERVAL_MS = 60 * 1000
const BRIEFING_TRIGGER_COOLDOWN_MS = 30 * 1000
/** How much of the agent log the synthesizer sees (head + tail when long).
    500 chars was losing everything that mattered. */
const LOG_HEAD_CHARS = 2000
const LOG_TAIL_CHARS = 4000
/** Bump when briefing.json's shape changes; readers must tolerate missing. */
const VIBE_SCHEMA_VERSION = 1

/** Keep the head (context-setting) and tail (most recent) of a long log. */
function headTail(raw: string): string {
  if (raw.length <= LOG_HEAD_CHARS + LOG_TAIL_CHARS) return raw
  return `${raw.slice(0, LOG_HEAD_CHARS)}\n… [${raw.length - LOG_HEAD_CHARS - LOG_TAIL_CHARS} chars omitted] …\n${raw.slice(-LOG_TAIL_CHARS)}`
}

export interface ReviewerStatus {
  isRunning: boolean
  isSynthesizing: boolean
  lastBriefingTime: number
  briefingCount: number
  /** Last Obsidian sync failure, so it's diagnosable instead of silent. */
  lastSyncError: string | null
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
  apiKeys: Record<string, string> = {}
  model: string = ''
  lastSyncError: string | null = null

  getStatus(): ReviewerStatus {
    return {
      isRunning: this.isRunning,
      isSynthesizing: this.isSynthesizing,
      lastBriefingTime: this.lastBriefingTime,
      briefingCount: this.briefingCount,
      lastSyncError: this.lastSyncError
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

  forceBriefing() {
    this.generateBriefing()
  }

  /** Idempotent: restarting for the same project is a no-op; a new project
      fully clears the old timer first — no duplicate intervals, ever. */
  start(projectPath: string) {
    if (this.isRunning && this.projectPath === projectPath) return
    if (this.isRunning || this.reviewInterval) this.stop()

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
    if (this.reviewInterval) { clearInterval(this.reviewInterval); this.reviewInterval = null }
    this.projectPath = null
    this.vibeDir = null
    this.isRunning = false
  }

  triggerBriefing() {
    const now = Date.now()
    if (now - this.lastBriefingTime < BRIEFING_TRIGGER_COOLDOWN_MS) return
    this.generateBriefing()
  }

  async generateBriefing() {
    // Capture locals: if stop() runs mid-flight, the in-flight write still
    // completes against the OLD project dir instead of crashing on null.
    const projectPath = this.projectPath
    const vibeDir = this.vibeDir
    if (!projectPath || !vibeDir) return
    if (this.isSynthesizing) return
    this.isSynthesizing = true
    try {
      let healthData: any = {}
      let factsData: any = {}
      try { healthData = JSON.parse(await fs.promises.readFile(path.join(vibeDir,'health.json'),'utf8')) } catch { /* no health yet */ }
      try { factsData = JSON.parse(await fs.promises.readFile(path.join(vibeDir,'facts.json'),'utf8')) } catch { /* no facts yet */ }

      let recentAgentLog = ''
      try {
        const projectName = path.basename(projectPath)
        const logPath = path.join(vibeDir,'vault',projectName,'Agent Log.md')
        recentAgentLog = headTail(await fs.promises.readFile(logPath,'utf8'))
      } catch { /* no agent log yet */ }

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

      const responseContent = await this.runModelChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ])

      if (!responseContent) { this.isSynthesizing = false; return }

      const briefing = {
        version: VIBE_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
        projectPath,
        projectName: path.basename(projectPath),
        content: responseContent,
        healthSnapshot: {
          branch: healthData.git?.branch || 'unknown',
          uncommittedChanges: healthData.git?.uncommittedChanges || 0,
          recentChanges: healthData.recentChanges || [],
          openTodos: healthData.openTodos || []
        }
      }

      fs.writeFileSync(
        path.join(vibeDir, 'briefing.json'),
        JSON.stringify(briefing, null, 2)
      )

      this.lastBriefingTime = Date.now()
      this.briefingCount++
      console.log('[Reviewer] Briefing updated at', new Date().toISOString())

      if (this.obsidianApiKey) {
        try {
          const { obsidianUpsert } = await import('../obsidian')
          const projectName = path.basename(projectPath)
          const ok = await obsidianUpsert(
            this.obsidianApiKey,
            `VIBE/${projectName}/Context Briefing.md`,
            `# Context Briefing\nUpdated: ${new Date().toLocaleString()}\n\n${responseContent}`
          )
          if (!ok) {
            this.lastSyncError = `Briefing sync failed at ${new Date().toISOString()} (see [Obsidian] line in runtime log)`
            console.warn('[Reviewer]', this.lastSyncError)
          } else {
            this.lastSyncError = null
          }
        } catch (e: any) {
          this.lastSyncError = e?.message || String(e)
          console.warn('[Reviewer] Obsidian sync error:', e)
        }
      }
    } catch (e) {
      console.warn('[Reviewer] generateBriefing error (non-fatal):', e)
    }
    this.isSynthesizing = false
  }

  getBriefing(): string {
    try {
      if (!this.vibeDir) return 'No project briefing available yet.'
      const raw = fs.readFileSync(path.join(this.vibeDir,'briefing.json'),'utf8')
      const briefing = JSON.parse(raw)
      const age = Date.now() - new Date(briefing.generatedAt).getTime()
      // Stale briefings used to vanish ("No briefing available") which felt like
      // data loss. Return the stale content, honestly labeled, instead.
      if (age > 30 * 60 * 1000) {
        return `[Briefing is stale (${Math.round(age / 60000)} min old — project may have changed since)]\n\n${briefing.content || ''}`
      }
      return briefing.content || 'No project briefing available yet.'
    } catch {
      return 'No project briefing available yet.'
    }
  }
}
