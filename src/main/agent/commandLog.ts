/* =======================================================================
   commandLog.ts — durable markdown log of every bash command the agent runs.

   Writes a human-readable `.vibe/commands.md` inside the project root so users
   can audit, copy, or rerun what the agent did.
   ======================================================================= */
import fs from 'node:fs';
import path from 'node:path';

export interface CommandRecord {
    command: string;
    output: string;
    status: 'ok' | 'error' | 'cancelled' | 'timeout' | 'background';
    cwd: string;
    at: string;
    surface?: string;
    runId?: string;
}

const now = () => new Date().toISOString();

function logDir(root: string | null | undefined): string {
    const base = root && root.trim() ? root : process.cwd();
    return path.join(base, '.vibe');
}

function logPath(root: string | null | undefined): string {
    return path.join(logDir(root), 'commands.md');
}

function ensureDir(root: string | null | undefined): void {
    fs.mkdirSync(logDir(root), { recursive: true });
}

function formatEntry(rec: CommandRecord): string {
    const ts = rec.at.replace('T', ' ').replace(/\.\d+Z$/, ' UTC');
    const lines = [
        `## ${ts} — ${rec.surface || 'agent'} — ${rec.status}`,
        '',
        '```bash',
        `# cwd: ${rec.cwd}`,
        rec.command,
        '```',
        '',
        '```text',
        (rec.output || '(no output)').slice(0, 32_000),
        rec.output.length > 32_000 ? `\n… (${rec.output.length - 32_000} more chars)` : '',
        '```',
        '',
        '---',
        '',
    ];
    return lines.join('\n');
}

/** Append a command record to the project markdown log. Safe to call from any
 *  surface; no-op if there is no writable root. */
export function appendCommandLog(root: string | null | undefined, rec: CommandRecord): void {
    try {
        ensureDir(root);
        const file = logPath(root);
        const exists = fs.existsSync(file);
        if (!exists) {
            const header = `# Command history\n\nAuto-generated log of every shell command run by the agent in this project/engagement.\n\n`;
            fs.writeFileSync(file, header, 'utf-8');
        }
        const entry = formatEntry(rec);
        fs.appendFileSync(file, entry, 'utf-8');
    } catch (e) {
        // Logging must never break the agent run. Warn silently in main console.
        console.warn('[commandLog] failed to write log:', e);
    }
}

/** Convenience used by the bash tool: writes the markdown command log. */
export function logCommand(root: string | null | undefined, rec: CommandRecord): void {
    appendCommandLog(root, rec);
}
