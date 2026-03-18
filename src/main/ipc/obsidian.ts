const OBSIDIAN_BASE = 'https://localhost:27124'

const withKey = (apiKey?: string): string | null => {
  const key = (apiKey || '').trim()
  return key.length > 0 ? key : null
}

async function obsidianFetch(
  endpoint: string,
  method: string,
  apiKey: string,
  body?: string
): Promise<boolean> {
  try {
    const res = await fetch(`${OBSIDIAN_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'text/markdown',
      },
      body,
    })
    return res.ok
  } catch {
    return false
  }
}

export async function obsidianUpsert(
  apiKey: string,
  vaultPath: string,
  content: string
): Promise<void> {
  const key = withKey(apiKey)
  if (!key) return
  await obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'PUT', key, content)
}

export async function obsidianAppend(
  apiKey: string,
  vaultPath: string,
  content: string
): Promise<void> {
  const key = withKey(apiKey)
  if (!key) return
  await obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'POST', key, content)
}

export function registerObsidianHandlers() {
  const { ipcMain } = require('electron')

  ipcMain.handle('obsidian:ping', async (_: any, apiKey: string) => {
    const key = withKey(apiKey)
    if (!key) return false
    return obsidianFetch('/', 'GET', key)
  })

  ipcMain.handle('obsidian:upsertNote', async (
    _: any, apiKey: string, vaultPath: string, content: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return false
    return obsidianFetch(`/vault/${encodeURIComponent(vaultPath)}`, 'PUT', key, content)
  })

  ipcMain.handle('obsidian:appendNote', async (
    _: any, apiKey: string, vaultPath: string, content: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return false
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
    if (!key) return false
    const date = new Date().toISOString().split('T')[0]
    const content = `---
project: ${projectName}
path: ${projectPath}
updated: ${date}
tags: [vibe, project]
---

# ${projectName}

**Path:** \`${projectPath}\`
**Last opened:** ${date}

## Project Structure
\`\`\`
${projectStructure.slice(0, 3000)}
\`\`\`

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
    criteraMet: string
  ) => {
    const key = withKey(apiKey)
    if (!key) return false
    const timestamp = new Date().toISOString()
    const stepList = steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
    const entry = `
## ${timestamp.slice(0, 16).replace('T', ' ')} — ${mission.slice(0, 80)}

**Model:** ${model}
**Result:** ${criteraMet === 'yes' ? 'complete' : criteraMet === 'partial' ? 'partial' : 'incomplete'}

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
    if (!key) return false
    const date = new Date().toISOString().split('T')[0]
    const entry = `
## ${date} — ${summary.slice(0, 80)}

**Files changed:** ${filesChanged || 'none'}

${summary}

---
`
    return obsidianFetch(`/vault/${encodeURIComponent(`VIBE/${projectName}/Decisions.md`)}`, 'POST', key, entry)
  })
}
