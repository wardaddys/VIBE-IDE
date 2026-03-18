import { CollectorAgent, CollectorStatus } from './collector'
import { ReviewerAgent, ReviewerStatus } from './reviewer'
import type { BackgroundAgentConfig } from '../../../shared/types'

export interface AgentStatusSnapshot {
  collector: CollectorStatus
  reviewer: ReviewerStatus
}

export class BackgroundManager {
  collector: CollectorAgent = new CollectorAgent()
  reviewer: ReviewerAgent = new ReviewerAgent()
  currentProjectPath: string | null = null

  private applyConfig(config?: BackgroundAgentConfig) {
    if (!config) return

    if (config.apiKeys) {
      this.collector.setApiKeys(config.apiKeys)
      this.reviewer.setApiKeys(config.apiKeys)
    }

    if ('collectorModel' in config) {
      this.collector.setModel(config.collectorModel || '')
    }

    if ('reviewerModel' in config) {
      this.reviewer.setModel(config.reviewerModel || '')
    }

    if ('obsidianKey' in config && config.obsidianKey) {
      this.setObsidianKey(config.obsidianKey)
    }
  }

  startForProject(projectPath: string, config?: BackgroundAgentConfig) {
    if (this.currentProjectPath === projectPath) {
      this.applyConfig(config)
      return
    }
    this.collector.stop()
    this.reviewer.stop()
    this.applyConfig(config)
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

  triggerBriefing() {
    this.reviewer.forceBriefing()
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
