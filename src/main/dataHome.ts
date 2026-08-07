/* ===========================================================================
   dataHome — the user-chosen home for VIBE projects.

   WHY this exists:
   - On first run, the user should choose WHERE their work lives (not have it
     buried in an opaque app dir).
   - It must live in a stable, user-visible place (default: ~/Documents/VIBE) so
     app UPDATES / re-installs NEVER wipe it.
   - The user must be able to MOVE it later.

   Design: the *pointer* to the data home is stored in Electron's userData — the
   most update-stable location an installer won't touch — as data-home.json. The
   *data itself* lives wherever the user chose, one coherent, movable data root.
   =========================================================================== */
import { app, ipcMain, dialog, type BrowserWindow } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { DATA_CHANNELS } from '../shared/ipcContracts';

interface DataHomeConfig { path: string }

function configPath(): string {
    return path.join(app.getPath('userData'), 'data-home.json');
}

/** Default data home: ~/Documents/VIBE (visible, update-proof, per-user). */
export function defaultDataHome(): string {
    let docs: string;
    try { docs = app.getPath('documents'); } catch { docs = path.join(app.getPath('home'), 'Documents'); }
    return path.join(docs, 'VIBE');
}

/** True until the user has explicitly chosen (or confirmed) a data home. Used to
    drive the first-run prompt. */
export function hasChosenDataHome(): boolean {
    try { return fs.existsSync(configPath()); } catch { return false; }
}

function readConfig(): DataHomeConfig | null {
    try {
        const cfg = JSON.parse(fs.readFileSync(configPath(), 'utf-8'));
        if (cfg && typeof cfg.path === 'string' && cfg.path.trim()) return cfg;
    } catch { /* none */ }
    return null;
}

/** The effective data home (configured or default), guaranteed to exist. */
export function getDataHome(): string {
    const dir = readConfig()?.path || defaultDataHome();
    try { fs.mkdirSync(dir, { recursive: true }); } catch { /* */ }
    return dir;
}

/** Persist the chosen data home. When `move` is set and a previous, different
    home exists, relocate its contents into the new location (best-effort — a
    rename per top-level entry, falling back to a recursive copy). */
export function setDataHome(newPath: string, move = false): { ok: boolean; path?: string; error?: string } {
    try {
        const target = newPath && newPath.trim() ? path.resolve(newPath.trim()) : defaultDataHome();
        const prev = readConfig()?.path;
        fs.mkdirSync(target, { recursive: true });
        if (move && prev && path.resolve(prev) !== target && fs.existsSync(prev)) {
            for (const ent of fs.readdirSync(prev)) {
                const from = path.join(prev, ent);
                const to = path.join(target, ent);
                if (fs.existsSync(to)) continue; // never overwrite existing at the destination
                try { fs.renameSync(from, to); }
                catch { try { fs.cpSync(from, to, { recursive: true }); } catch { /* skip this entry */ } }
            }
        }
        fs.writeFileSync(configPath(), JSON.stringify({ path: target }, null, 2));
        return { ok: true, path: target };
    } catch (e: any) {
        return { ok: false, error: e?.message || String(e) };
    }
}

/** Registered at app startup so the first-run data-home prompt works. */
export function registerDataHomeHandlers(mainWindow: BrowserWindow): void {
    ipcMain.handle(DATA_CHANNELS.get, async () => ({ path: getDataHome(), chosen: hasChosenDataHome(), default: defaultDataHome() }));
    ipcMain.handle(DATA_CHANNELS.isFirstRun, async () => !hasChosenDataHome());
    ipcMain.handle(DATA_CHANNELS.default, async () => defaultDataHome());
    ipcMain.handle(DATA_CHANNELS.set, async (_e, newPath: string, move?: boolean) => setDataHome(newPath, !!move));
    // A native folder picker scoped to choosing the data home (renderer falls back
    // to its in-app picker if this returns null — same pattern as fs:openFolder).
    ipcMain.handle(DATA_CHANNELS.pick, async () => {
        try {
            const res = await dialog.showOpenDialog(mainWindow, {
                title: 'Choose where VIBE keeps your projects',
                properties: ['openDirectory', 'createDirectory'],
                defaultPath: getDataHome(),
            });
            if (res.canceled || !res.filePaths?.[0]) return null;
            return res.filePaths[0];
        } catch { return null; }
    });
}
