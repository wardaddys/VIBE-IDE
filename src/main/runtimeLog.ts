/* ===========================================================================
   runtimeLog — durable, user-visible runtime log.

   WHY: when something breaks (a failed render, a crashed renderer, a hung
   provider), the evidence used to vanish into a throwaway debug window or a
   devtools console the user never opens. Now every log line is also appended
   to <dataHome>/logs/runtime.log — a plain file the user can open, tail, or
   attach to a bug report. Settings → Appearance shows the exact path.

   Design:
   - Writes are serialized through a promise queue (no interleaved appends)
     and NEVER throw — logging must not break the thing being logged.
   - Rotates at 2 MB to runtime.old.log (one generation, bounded disk use).
   =========================================================================== */
import { app, ipcMain, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { getDataHome } from './dataHome';

const MAX_BYTES = 2 * 1024 * 1024;

let approxSize = -1; // -1 = not yet measured
let queue: Promise<unknown> = Promise.resolve();

/** Path of the active log file, ensuring the directory exists. */
export function getRuntimeLogPath(): string {
    let base: string;
    try { base = getDataHome(); } catch { base = app.getPath('userData'); }
    const dir = path.join(base, 'logs');
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    return path.join(dir, 'runtime.log');
}

/** Append one timestamped line. Safe to call from anywhere, any time. */
export function writeRuntimeLog(level: string, line: string): void {
    const text = `${new Date().toISOString()} [${level}] ${line}\n`;
    queue = queue.then(async () => {
        try {
            const file = getRuntimeLogPath();
            if (approxSize < 0) {
                try { approxSize = fs.statSync(file).size; } catch { approxSize = 0; }
            }
            if (approxSize > MAX_BYTES) {
                try { fs.renameSync(file, path.join(path.dirname(file), 'runtime.old.log')); } catch { /* ignore */ }
                approxSize = 0;
            }
            await fs.promises.appendFile(file, text);
            approxSize += text.length;
        } catch { /* logging must never throw */ }
    }).catch(() => { /* logging must never throw */ });
}

export function registerRuntimeLogHandlers(): void {
    ipcMain.handle('app:getRuntimeLogPath', async () => getRuntimeLogPath());
    ipcMain.handle('app:openRuntimeLog', async () => {
        const file = getRuntimeLogPath();
        try { if (!fs.existsSync(file)) fs.writeFileSync(file, ''); } catch { /* ignore */ }
        shell.showItemInFolder(file);
    });
}
