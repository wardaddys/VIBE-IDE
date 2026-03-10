import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../shared/types';

const IGNORED_DIRS = new Set([
    'node_modules', '.git', '.DS_Store', '__pycache__', '.venv', 'dist', 'build', '.next', '.cache', '.turbo'
]);

export function registerFileSystemHandlers(mainWindow: BrowserWindow) {
    ipcMain.handle('fs:openFolder', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        if (result.canceled || result.filePaths.length === 0) {
            return null;
        }
        return result.filePaths[0];
    });

    ipcMain.handle('fs:readDir', async (_event, dirPath: string): Promise<FileEntry[]> => {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });

            const fileEntries: FileEntry[] = entries
                .filter(entry => !IGNORED_DIRS.has(entry.name))
                .map(entry => ({
                    name: entry.name,
                    path: path.join(dirPath, entry.name),
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
            return await fs.readFile(filePath, 'utf-8');
        } catch (error) {
            console.error('Failed to read file:', error);
            throw error;
        }
    });

    ipcMain.handle('fs:writeFile', async (_event, filePath: string, content: string): Promise<boolean> => {
        try {
            await fs.mkdir(path.dirname(filePath), { recursive: true });
            await fs.writeFile(filePath, content, 'utf-8');
            return true;
        } catch (error) {
            console.error('Failed to write file:', error);
            throw error;
        }
    });

    let currentWatcher: any = null;
    ipcMain.handle('fs:watchFolder', (_event, dirPath: string) => {
        if (currentWatcher) currentWatcher.close();
        try {
            currentWatcher = require('node:fs').watch(dirPath, { recursive: true }, (eventType: string, filename: string) => {
                if (filename && !IGNORED_DIRS.has(filename.split(/[\/\\]/)[0])) {
                    if (!mainWindow.isDestroyed()) {
                        mainWindow.webContents.send('fs:changed');
                    }
                }
            });
        } catch(e) {
            console.error('Failed to watch folder:', e);
        }
    });

    ipcMain.handle('fs:readMemory', async (_event, projectPath: string): Promise<string | null> => {
        try {
            const memPath = path.join(projectPath, '.vibe', 'memory.json');
            const content = await fs.readFile(memPath, 'utf-8');
            return content;
        } catch {
            return null;
        }
    });

    ipcMain.handle('fs:writeMemory', async (_event, projectPath: string, memory: object): Promise<boolean> => {
        try {
            const vibeDir = path.join(projectPath, '.vibe');
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
