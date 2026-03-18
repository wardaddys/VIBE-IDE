import fs from 'node:fs'
import path from 'node:path'
import { executeNonStreamingChat } from '../modelRouter'
import type { ChatMessage } from '../../../shared/types'

const REVIEW_INTERVAL_MS = 60 * 1000
const BRIEFING_TRIGGER_COOLDOWN_MS = 30 * 1000

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
  apiKeys: Record<string, string> = {}
  model: string = ''

  getStatus(): ReviewerStatus {
    return {
      isRunning: this.isRunning,
      isSynthesizing: this.isSynthesizing,
      lastBriefingTime: this.lastBriefingTime,
      briefingCount: this.briefingCount
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

  forceBriefing() {
    this.generateBriefing()
  }

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
    if (now - this.lastBriefingTime < BRIEFING_TRIGGER_COOLDOWN_MS) return
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

      const responseContent = await this.runModelChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ])

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
