import { ipcMain, BrowserWindow } from 'electron';
import * as pty from 'node-pty';

const terminals = new Map<string, pty.IPty>();
const terminalOutputBuffers = new Map<string, string>();

export function registerTerminalHandlers(mainWindow: BrowserWindow) {
    ipcMain.handle('terminal:create', (_event, cwd?: string) => {
        let shell = '/bin/bash';
        if (process.platform === 'win32') {
            shell = 'powershell.exe';
        } else if (process.platform === 'darwin') {
            shell = process.env.SHELL || '/bin/zsh';
        } else {
            shell = process.env.SHELL || '/bin/bash';
        }

        try {
            const ptyProcess = pty.spawn(shell, [], {
                name: 'xterm-256color',
                cols: 80,
                rows: 24,
                cwd: cwd || process.env.HOME || process.env.USERPROFILE,
                env: process.env as any,
            });

            const id = Math.random().toString(36).substring(7);
            terminals.set(id, ptyProcess);
            terminalOutputBuffers.set(id, '');

            ptyProcess.onData((data) => {
                if (!mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('terminal:data', id, data);
                }
                
                // Maintain a rolling buffer of the last 4000 characters
                let currentBuffer = terminalOutputBuffers.get(id) || '';
                currentBuffer += data;
                if (currentBuffer.length > 4000) {
                    currentBuffer = currentBuffer.slice(-4000);
                }
                terminalOutputBuffers.set(id, currentBuffer);
            });

            return id;
        } catch (error) {
            console.error('Failed to create terminal:', error);
            throw error;
        }
    });

    ipcMain.handle('terminal:input', (_event, id: string, data: string) => {
        const ptyProcess = terminals.get(id);
        if (ptyProcess) {
            ptyProcess.write(data);
        }
    });

    ipcMain.handle('terminal:resize', (_event, id: string, cols: number, rows: number) => {
        const ptyProcess = terminals.get(id);
        if (ptyProcess) {
            try {
                ptyProcess.resize(cols, rows);
            } catch (e) {
                console.error('Resize error:', e);
            }
        }
    });

    ipcMain.handle('terminal:kill', (_event, id: string) => {
        const ptyProcess = terminals.get(id);
        if (ptyProcess) {
            ptyProcess.kill();
            terminals.delete(id);
            terminalOutputBuffers.delete(id);
        }
    });

    ipcMain.handle('terminal:getOutput', (_event, id: string) => {
        return terminalOutputBuffers.get(id) || '';
    });
    ipcMain.handle('terminal:clearOutput', (_event, id: string) => {
        terminalOutputBuffers.set(id, '');
    });
}
