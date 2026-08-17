const OBSIDIAN_BASE = 'https://localhost:27124'

/* A stalled localhost HTTPS request used to hang the handler indefinitely.
   Every call now fails fast and SAYS why (visible in the runtime log). */
const FETCH_TIMEOUT_MS = 8000
const STRUCTURE_MAX_CHARS = 3000

const withKey = (apiKey?: string): string | null => {
  const key = (apiKey || '').trim()
  return key.length > 0 ? key : null
}

/** YAML-safe scalar for frontmatter values (JSON string is a valid YAML
    double-quoted scalar — quotes, colons, and backslashes are escaped). */
const yaml = (v: string): string => JSON.stringify(String(v))

interface ObsidianResult {
  ok: boolean
  status?: number
  error?: string
}

async function obsidianFetch(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: string
): Promise<ObsidianResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(`${OBSIDIAN_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'text/markdown',
      },
      body,
      signal: controller.signal,
    })
    if (!res.ok) {
      console.warn(`[Obsidian] ${method} ${endpoint} failed: HTTP ${res.status}`)
      return { ok: false, status: res.status }
    }
    return { ok: true }
  } catch (e: any) {
    const reason = e?.name === 'AbortError'
      ? `timed out after ${FETCH_TIMEOUT_MS}ms`
      : (e?.message || String(e))
    console.warn(`[Obsidian] ${method} ${endpoint} failed: ${reason}`)
    return { ok: false, error: reason }
  } finally {
    clearTimeout(timer)
  }
}

/** Truncate with a visible marker — a snapshot that silently drops content
    looks authoritative while being wrong. */
function truncateVisible(text: string, max: number): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n… (truncated — ${text.length} chars total)`
}

export async function obsidianUpsert(
  apiKey: string,
  vaultPath: string,
  content: string
): Promise<boolean> {
  const key = withKey(apiKey)
  if (!key) return false
  return (await obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'PUT', key, content)).ok
}

export async function obsidianAppend(
  apiKey: string,
  vaultPath: string,
  content: string
): Promise<boolean> {
  const key = withKey(apiKey)
  if (!key) return false
  return (await obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'POST', key, content)).ok
}

export function registerObsidianHandlers() {
  const { ipcMain } = require('electron')

  ipcMain.handle('obsidian:ping', async (_: any, apiKey: string) => {
    const key = withKey(apiKey)
    if (!key) return false
    return (await obsidianFetch('/', 'GET', key)).ok
  })

  ipcMain.handle('obsidian:upsertNote', async (
    _: any, apiKey: string, vaultPath: string, content: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return false
    return (await obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'PUT', key, content)).ok
  })

  ipcMain.handle('obsidian:appendNote', async (
    _: any, apiKey: string, vaultPath: string, content: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return false
    return (await obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'POST', key, content)).ok
  })

  ipcMain.handle('obsidian:updateProjectNote', async (
    _: any,
    apiKey: string,
    projectName: string,
    projectStructure: string,
    projectPath: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return false
    const date = new Date().toISOString().split('T')[0]
    const content = `---
project: ${yaml(projectName)}
path: ${yaml(projectPath)}
updated: ${date}
tags: [vibe, project]
---

# ${projectName}

**Path:** \`${projectPath}\`
**Last opened:** ${date}

## Project Structure
\`\`\`
${truncateVisible(projectStructure, STRUCTURE_MAX_CHARS)}
\`\`\`

## Quick Links
- [[Agent Log]]
- [[Decisions]]
`
    return (await obsidianFetch(`/vault/${encodeURIComponent(`VIBE/${projectName}/Project Overview.md`)}`, 'PUT', key, content)).ok
  })

  ipcMain.handle('obsidian:logAgentRun', async (
    _: any,
    apiKey: string,
    projectName: string,
    mission: string,
    model: string,
    steps: string[],
    result: string,
    criteriaMet: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return false
    const timestamp = new Date().toISOString()
    const stepList = steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    const entry = `
## ${timestamp.slice(0, 16).replace('T', ' ')} - ${mission.slice(0, 80)}

**Model:** ${model}
**Result:** ${criteriaMet === 'yes' ? 'complete' : criteriaMet === 'partial' ? 'partial' : 'incomplete'}

### Steps Executed
${stepList}

### Outcome
${result}

---
`
    return (await obsidianFetch(`/vault/${encodeURIComponent(`VIBE/${projectName}/Agent Log.md`)}`, 'POST', key, entry)).ok
  })

  ipcMain.handle('obsidian:logDecision', async (
    _: any,
    apiKey: string,
    projectName: string,
    summary: string,
    filesChanged: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return false
    const date = new Date().toISOString().split('T')[0]
    const entry = `
## ${date} - ${summary.slice(0, 80)}

**Files changed:** ${filesChanged || 'none'}

${summary}

---
`
    return (await obsidianFetch(`/vault/${encodeURIComponent(`VIBE/${projectName}/Decisions.md`)}`, 'POST', key, entry)).ok
  })
}
