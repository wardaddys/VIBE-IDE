const OBSIDIAN_BASE = 'https://localhost:27124'
const OBSIDIAN_TIMEOUT_MS = 10_000

interface ObsidianResult {
  ok: boolean
  status?: number
  error?: string
}

const withKey = (apiKey?: string): string | null => {
  const key = (apiKey || '').trim()
  return key.length > 0 ? key : null
}

/**
 * Escape a string for safe inclusion in Obsidian YAML frontmatter.
 * Wraps in double quotes and escapes backslashes, double quotes, and newlines.
 */
function escapeYaml(value: string): string {
  const safe = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '')
  return `"${safe}"`
}

/** Escape inline markdown so user-controlled strings cannot break note formatting. */
function escapeMarkdownInline(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+\-.!|]/g, '\\$&')
}

async function obsidianFetch(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: string
): Promise<ObsidianResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), OBSIDIAN_TIMEOUT_MS)
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
    return { ok: res.ok, status: res.status }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  } finally {
    clearTimeout(timeout)
  }
}

export async function obsidianUpsert(
  apiKey: string,
  vaultPath: string,
  content: string
): Promise<ObsidianResult> {
  const key = withKey(apiKey)
  if (!key) return { ok: false, error: 'Missing API key' }
  return obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'PUT', key, content)
}

export async function obsidianAppend(
  apiKey: string,
  vaultPath: string,
  content: string
): Promise<ObsidianResult> {
  const key = withKey(apiKey)
  if (!key) return { ok: false, error: 'Missing API key' }
  return obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'POST', key, content)
}

export function registerObsidianHandlers() {
  const { ipcMain } = require('electron')

  ipcMain.handle('obsidian:ping', async (_: any, apiKey: string) => {
    const key = withKey(apiKey)
    if (!key) return { ok: false, error: 'Missing API key' }
    return obsidianFetch('/', 'GET', key)
  })

  ipcMain.handle('obsidian:upsertNote', async (
    _: any, apiKey: string, vaultPath: string, content: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return { ok: false, error: 'Missing API key' }
    return obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'PUT', key, content)
  })

  ipcMain.handle('obsidian:appendNote', async (
    _: any, apiKey: string, vaultPath: string, content: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return { ok: false, error: 'Missing API key' }
    return obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'POST', key, content)
  })

  ipcMain.handle('obsidian:updateProjectNote', async (
    _: any,
    apiKey: string,
    projectName: string,
    projectStructure: string,
    projectPath: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return { ok: false, error: 'Missing API key' }
    const date = new Date().toISOString().split('T')[0]
    const truncated = projectStructure.slice(0, 3000)
    const truncatedNotice = projectStructure.length > 3000
      ? '\n\n> Project structure truncated to 3000 characters.'
      : ''
    const content = `---
project: ${escapeYaml(projectName)}
path: ${escapeYaml(projectPath)}
updated: ${date}
tags: [vibe, project]
---

# ${escapeMarkdownInline(projectName)}

**Path:** \`${projectPath}\`
**Last opened:** ${date}

## Project Structure
\`\`\`
${truncated}
\`\`\`${truncatedNotice}

## Quick Links
- [[Agent Log]]
- [[Decisions]]
`
    return obsidianFetch(`/vault/${encodeURIComponent(`VIBE/${projectName}/Project Overview.md`)}`, 'PUT', key, content)
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
    if (!key) return { ok: false, error: 'Missing API key' }
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
    return obsidianFetch(`/vault/${encodeURIComponent(`VIBE/${projectName}/Agent Log.md`)}`, 'POST', key, entry)
  })

  ipcMain.handle('obsidian:logDecision', async (
    _: any,
    apiKey: string,
    projectName: string,
    summary: string,
    filesChanged: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return { ok: false, error: 'Missing API key' }
    const date = new Date().toISOString().split('T')[0]
    const entry = `
## ${date} - ${summary.slice(0, 80)}

**Files changed:** ${filesChanged || 'none'}

${summary}

---
`
    return obsidianFetch(`/vault/${encodeURIComponent(`VIBE/${projectName}/Decisions.md`)}`, 'POST', key, entry)
  })
}
