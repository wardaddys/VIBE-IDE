import React, { useEffect, useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);
    const projectPath = useUIStore(state => state.projectPath);

    const projectName = projectPath ? projectPath.split(/[/\\]/).pop() : 'No Folder Opened';

    useEffect(() => {
        if (window.vibe?.onWindowMaximized) {
            window.vibe.onWindowMaximized((max: boolean) => setIsMaximized(max));
        }
    }, []);

    const handleMinimize = () => window.vibe?.minimizeWindow();
    const handleMaximize = () => window.vibe?.maximizeWindow();
    const handleClose = () => window.vibe?.closeWindow();

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    return (
        <GlassPanel variant="strong" className="titlebar-drag" style={{
            height: 'var(--titlebar-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0,
            borderRadius: 0,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            marginBottom: 'var(--gap)',
        }}>
            <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '15px',
                letterSpacing: '3px',
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginLeft: isMac ? '70px' : '0'
            }}>
                VIBE
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {projectName}
            </div>

            {!isMac ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button data-clickable onClick={handleMinimize} style={btnStyle}>_</button>
                    <button data-clickable onClick={handleMaximize} style={btnStyle}>□</button>
                    <button data-clickable onClick={handleClose} style={{ ...btnStyle, color: 'var(--error)' }}>✕</button>
                </div>
            ) : <div style={{ width: 70 }}></div>}
        </GlassPanel>
    );
}

const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '14px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
};
