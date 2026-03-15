import { ipcMain } from 'electron'

const OBSIDIAN_BASE = 'https://localhost:27124'

// All Obsidian calls are fire-and-forget
// If they fail, we log and move on — never block the app

async function obsidianFetch(
    path: string,
    method: string,
    apiKey: string,
    body?: string,
    _contentType = 'text/markdown'
): Promise<boolean> {
    try {
        const res = await fetch(`${OBSIDIAN_BASE}${path}`, {
            method,
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': _contentType,
            },
            body,
        })
        return res.ok
    } catch {
        return false  // Obsidian not running or plugin not installed
    }
}

export function registerObsidianHandlers() {

    // Check if Obsidian Local REST API is running
    ipcMain.handle('obsidian:ping', async (_event, apiKey: string) => {
        try {
            const res = await fetch(`${OBSIDIAN_BASE}/`, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            })
            return res.ok
        } catch {
            return false
        }
    })

    // Create or update the project overview note
    ipcMain.handle('obsidian:updateProjectNote', async (
        _event,
        apiKey: string,
        projectName: string,
        projectStructure: string,
        projectPath: string
    ) => {
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
- [[Agent Log - ${projectName}]]
- [[Decisions - ${projectName}]]
`
        return await obsidianFetch(
            `/vault/VIBE/${projectName}/Project Overview.md`,
            'PUT',
            apiKey,
            content
        )
    })

    // Append an agent run to the agent log note
    ipcMain.handle('obsidian:logAgentRun', async (
        _event,
        apiKey: string,
        projectName: string,
        mission: string,
        model: string,
        steps: string[],
        result: string,
        criteraMet: string
    ) => {
        const timestamp = new Date().toISOString()
        const stepList = steps.map((s, i) => `${i + 1}. ${s}`).join('\n')

        const entry = `
## ${timestamp.slice(0, 16).replace('T', ' ')} — ${mission.slice(0, 80)}

**Model:** ${model}
**Result:** ${criteraMet === 'yes' ? '✅ Complete' : criteraMet === 'partial' ? '🔄 Partial' : '⚠ Incomplete'}

### Steps Executed
${stepList}

### Outcome
${result}

---
`
        return await obsidianFetch(
            `/vault/VIBE/${projectName}/Agent Log.md`,
            'POST',
            apiKey,
            entry
        )
    })

    // Append a decision to decisions note
    ipcMain.handle('obsidian:logDecision', async (
        _event,
        apiKey: string,
        projectName: string,
        summary: string,
        filesChanged: string
    ) => {
        const date = new Date().toISOString().split('T')[0]
        const entry = `
## ${date} — ${summary.slice(0, 80)}

**Files changed:** ${filesChanged || 'none'}

${summary}

---
`
        return await obsidianFetch(
            `/vault/VIBE/${projectName}/Decisions.md`,
            'POST',
            apiKey,
            entry
        )
    })
}
