import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import fsn from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { canonicalize, isWithin } from '../agent/fsGuard';
import type { FileEntry } from '../../shared/types';

const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.DS_Store', '__pycache__', '.venv', 'dist', 'build', '.next', '.cache', '.turbo',
    'resources', '.claude'
]);

/** Maximum watch depth for the bounded recursive watcher. */
const WATCH_MAX_DEPTH = 3;

let currentProjectRoot: string | null = null;

const ensureProjectRoot = () => {
    if (!currentProjectRoot) {
        throw new Error('No active project root. Open a folder first.');
    }
    return currentProjectRoot;
};

/**
 * Canonicalize (expand ~, resolve .., and realpath symlinks) then confine to the
 * project root. Routing through the shared fsGuard closes the symlink-escape the
 * old lexical path.relative check allowed (a symlink inside root pointing at
 * /etc/passwd passed containment and fs would follow it).
 */
const resolveAllowedPath = (inputPath: string): string => {
    const root = ensureProjectRoot();
    const resolved = canonicalize(inputPath, root);
    if (!isWithin(resolved, canonicalize(root, null))) {
        throw new Error(`Access denied outside project root: ${inputPath}`);
    }
    return resolved;
};

export function registerFileSystemHandlers(mainWindow: BrowserWindow) {
    const isRoot = process.platform === 'linux' && typeof process.getuid === 'function' && process.getuid() === 0;

    // ── Native folder dialog ───────────────────────────────────────────────
    // Tries the OS file picker first when running as a normal user. When the
    // app is launched with sudo the dialog opens as root and starts in /root,
    // which makes it hard/impossible to select user project folders. In that
    // case return null so the renderer falls back to the in-app picker, which
    // starts in the real user's home and navigates via fs.readdir.
    ipcMain.handle('fs:openFolder', async () => {
        if (isRoot) {
            return null;
        }
        try {
            const result = await dialog.showOpenDialog(mainWindow, {
                properties: ['openDirectory']
            });
            if (result.canceled || result.filePaths.length === 0) {
                return null;
            }
            currentProjectRoot = canonicalize(result.filePaths[0], null);
            return currentProjectRoot;
        } catch (e) {
            console.error('Native folder dialog failed:', e);
            return null;
        }
    });

    // ── In-app folder picker (no OS dialog) ─────────────────────────────
    // Fallback for sudo / headless / broken portal situations. Pure fs.readdir
    // in the main process; works as root or user, no DBus/portal needed.
    const pickerHome = (): string => {
        const u = process.env.SUDO_USER;
        return u && u !== 'root' ? `/home/${u}` : os.homedir();
    };
    ipcMain.handle('fs:listDirs', async (_e, dirPath?: string): Promise<{ path: string; parent: string | null; dirs: { name: string; path: string }[] }> => {
        let target = dirPath && String(dirPath).trim() ? String(dirPath) : pickerHome();
        try { target = canonicalize(target, null); } catch { target = pickerHome(); }
        let entries: any[] = [];
        try { entries = await fs.readdir(target, { withFileTypes: true }); }
        catch { target = pickerHome(); try { entries = await fs.readdir(target, { withFileTypes: true }); } catch { entries = []; } }
        const dirs = entries
            .filter((e) => { try { return e.isDirectory() && e.name !== 'node_modules'; } catch { return false; } })
            .map((e) => ({ name: e.name, path: path.join(target, e.name) }))
            .sort((a, b) => a.name.localeCompare(b.name));
        const parent = path.dirname(target);
        return { path: target, parent: parent === target ? null : parent, dirs };
    });
    ipcMain.handle('fs:makeDir', async (_e, parent: string, name: string): Promise<string> => {
        const safeName = String(name || '').replace(/[/\\]/g, '').trim();
        if (!safeName) throw new Error('Invalid folder name.');
        const target = path.join(canonicalize(parent, null), safeName);
        await fs.mkdir(target, { recursive: true });
        return target;
    });
    ipcMain.handle('fs:setProjectFolder', async (_e, dirPath: string): Promise<string> => {
        const resolved = canonicalize(dirPath, null);
        const st = await fs.stat(resolved).catch(() => null);
        if (!st || !st.isDirectory()) throw new Error(`Not a directory: ${dirPath}`);
        currentProjectRoot = resolved;
        return currentProjectRoot;
    });

    ipcMain.handle('fs:readDir', async (_event, dirPath: string): Promise<FileEntry[]> => {
        try {
            // SECURITY: Never auto-adopt an arbitrary path as the project root.
            // Only fs:openFolder (which uses the native dialog) may set the root.
            if (!currentProjectRoot) {
                return [];
            }
            const safeDirPath = resolveAllowedPath(dirPath);
            const entries = await fs.readdir(safeDirPath, { withFileTypes: true });

            const fileEntries: FileEntry[] = entries
                .filter(entry => !IGNORED_DIRS.has(entry.name))
                .map(entry => ({
                    name: entry.name,
                    path: path.join(safeDirPath, entry.name),
                    isDirectory: entry.isDirectory(),
                    isFile: entry.isFile(),
                    extension: entry.isFile() ? path.extname(entry.name) : undefined,
                }));

            // Sort: directories first, then alphabetically
            return fileEntries.sort((a, b) => {
                if (a.isDirectory && !b.isDirectory) return -1;
                if (!a.isDirectory && b.isDirectory) return 1;
                return a.name.localeCompare(b.name);
            });
        } catch (error) {
            console.error('Failed to read directory:', error);
            throw error;
        }
    });

    ipcMain.handle('fs:readFile', async (_event, filePath: string): Promise<string> => {
        try {
            if (!currentProjectRoot) return '';
            const safePath = resolveAllowedPath(filePath);
            return await fs.readFile(safePath, 'utf-8');
        } catch (error) {
            console.error('Failed to read file:', error);
            return '';
        }
    });

    ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string): Promise<boolean> => {
        try {
            const safePath = resolveAllowedPath(filePath);
            await fs.mkdir(path.dirname(safePath), { recursive: true });
            await fs.writeFile(safePath, content, 'utf-8');
            return true;
        } catch (error) {
            console.error('Failed to write file:', error);
            throw error;
        }
    });

    /**
     * Bounded recursive file watcher.
     *
     * Node's fs.watch({ recursive: true }) on Linux uses inotify and exhausts the
     * system watcher limit on large project trees (tens of thousands of files).
     * We instead create non-recursive watchers only for
     * directories within WATCH_MAX_DEPTH levels of the project root, skipping
     * ignored directories. If setting up any watcher fails (ENOSPC etc.) we
     * swallow the error and continue - the file tree still refreshes manually.
     */
    let currentWatchers: fsn.FSWatcher[] = [];
    const clearWatchers = () => {
        for (const w of currentWatchers) { try { w.close(); } catch {} }
        currentWatchers = [];
    };
    const notifyChange = () => {
        if (!mainWindow.isDestroyed()) mainWindow.webContents.send('fs:changed');
    };
    const shouldWatchDir = (name: string) => !IGNORED_DIRS.has(name);

    ipcMain.handle('fs:watchFolder', async (_event, dirPath: string) => {
        clearWatchers();
        if (!currentProjectRoot) return;
        try {
            const safeDirPath = resolveAllowedPath(dirPath);

            // macOS/Windows support efficient native recursive watchers with far
            // higher limits; keep the native behaviour there for instant updates.
            if (process.platform === 'win32' || process.platform === 'darwin') {
                currentWatchers.push(fsn.watch(safeDirPath, { recursive: true }, () => notifyChange()));
                return;
            }

            const addWatcher = (target: string) => {
                try {
                    const w = fsn.watch(target, () => notifyChange());
                    currentWatchers.push(w);
                } catch (e) {
                    // ENOSPC or permission denied on a single directory - keep
                    // going so the rest of the tree is still watched.
                    console.warn(`[watch] skipping ${target}:`, e);
                }
            };

            addWatcher(safeDirPath);

            const walk = async (dir: string, depth: number) => {
                if (depth <= 0) return;
                let entries: any[] = [];
                try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
                for (const entry of entries) {
                    if (!entry.isDirectory() || !shouldWatchDir(entry.name)) continue;
                    const child = path.join(dir, entry.name);
                    addWatcher(child);
                    await walk(child, depth - 1);
                }
            };

            await walk(safeDirPath, WATCH_MAX_DEPTH);
        } catch (e) {
            console.error('Failed to watch folder:', e);
        }
    });

    ipcMain.handle('fs:readMemory', async (_event, projectPath: string): Promise<string | null> => {
        try {
            const safeProjectPath = resolveAllowedPath(projectPath);
            const memPath = path.join(safeProjectPath, '.vibe', 'memory.json');
            const content = await fs.readFile(memPath, 'utf-8');
            return content;
        } catch {
            return null;
        }
    });

    ipcMain.handle('fs:writeMemory', async (_event, projectPath: string, memory: object): Promise<boolean> => {
        try {
            const safeProjectPath = resolveAllowedPath(projectPath);
            const vibeDir = path.join(safeProjectPath, '.vibe');
            await fs.mkdir(vibeDir, { recursive: true });
            const memPath = path.join(vibeDir, 'memory.json');
            await fs.writeFile(memPath, JSON.stringify(memory, null, 2), 'utf-8');
            return true;
        } catch (error) {
            console.error('Failed to write memory:', error);
            return false;
        }
    });
}
