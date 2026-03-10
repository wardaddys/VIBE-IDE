import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../store/ui';
import { useFileSystem } from '../../hooks/useFileSystem';
import { FileTreeItem } from './FileTreeItem';
import type { FileEntry } from '../../../shared/types';

export function FileTree() {
    const projectPath = useUIStore(state => state.projectPath);
    const setProjectPath = useUIStore(state => state.setProjectPath);
    const setVibeInstructions = useUIStore(state => state.setVibeInstructions);
    const { openFolder, readDir, readFile } = useFileSystem();
    const [entries, setEntries] = useState<FileEntry[]>([]);

    useEffect(() => {
        if (!projectPath) return;
        
        // Read immediately on mount / projectPath change
        readDir(projectPath).then(setEntries).catch(console.error);

        // Load project memory
        window.vibe.readMemory(projectPath).then((raw: string | null) => {
            if (raw) {
                try {
                    const memory = JSON.parse(raw);
                    useUIStore.getState().setProjectMemory(memory);
                } catch {
                    useUIStore.getState().setProjectMemory(null);
                }
            } else {
                useUIStore.getState().setProjectMemory(null);
            }
        });
        
        window.vibe.watchFolder(projectPath);
        window.vibe.onFolderChanged(() => {
            readDir(projectPath).then(setEntries).catch(console.error);
        });
    }, [projectPath]);

    const handleOpenFolder = async () => {
        const p = await openFolder();
        if (p) {
            setProjectPath(p);
            try {
                const vibemd = await window.vibe.readFile(`${p}/VIBE.md`);
                useUIStore.getState().setVibeInstructions(vibemd);
            } catch {
                useUIStore.getState().setVibeInstructions(null);
            }
        }
    };

    if (!projectPath) {
        return (
            <div style={{ padding: 20, textAlign: 'center' }}>
                <button
                    onClick={handleOpenFolder}
                    style={{
                        background: 'var(--accent-gradient)',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        boxShadow: '0 2px 8px rgba(0,100,255,0.2)'
                    }}
                >
                    Open Folder
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '4px 0' }}>
            {entries.map(entry => (
                <FileTreeItem key={entry.path} entry={entry} level={0} />
            ))}
        </div>
    );
}
