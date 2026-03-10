import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';
import { useOllamaStore } from '../../store/ollama';
import { FileTree } from '../filetree/FileTree';
import { SettingsModal } from './SettingsModal';

const toolbarBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 4px',
    borderRadius: 4,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

export function Sidebar() {
    const sidebarWidth = useUIStore(state => state.sidebarWidth);
    // Use the UI‑level flag that is updated every 5 s (see App.tsx)
    const ollamaConnected = useUIStore(state => state.ollamaConnected);
    const [showSettings, setShowSettings] = useState(false);
    const projectPath = useUIStore(state => state.projectPath);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleNewFile = async () => {
        if (!projectPath) return;
        const name = prompt('Enter file name:');
        if (name) {
            await window.vibe.writeFile(`${projectPath}/${name}`, '');
            setRefreshKey(k => k + 1);
        }
    };

    const handleNewFolder = async () => {
        if (!projectPath) return;
        const name = prompt('Enter folder name:');
        if (name) {
            // writeFile with a dummy file inside creates the folder
            await window.vibe.writeFile(`${projectPath}/${name}/.gitkeep`, '');
            setRefreshKey(k => k + 1);
        }
    };

    const handleRefresh = () => {
        setRefreshKey(k => k + 1);
    };

    const handleCollapseAll = () => {
        setRefreshKey(k => k + 1); // FileTree re-renders with all folders collapsed
    };

    return (
        <GlassPanel style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 600 }}>Explorer</span>
                <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => handleNewFile()} title="New File" style={toolbarBtnStyle}>📄</button>
                    <button onClick={() => handleNewFolder()} title="New Folder" style={toolbarBtnStyle}>📁</button>
                    <button onClick={() => handleRefresh()} title="Refresh Explorer" style={toolbarBtnStyle}>🔄</button>
                    <button onClick={() => handleCollapseAll()} title="Collapse All" style={toolbarBtnStyle}>⊟</button>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <FileTree key={refreshKey} />
            </div>
            <div style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ollamaConnected ? 'var(--green)' : 'var(--error)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Ollama {ollamaConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }} title="IDE Settings">⚙</button>
            </div>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </GlassPanel>
    );
}
