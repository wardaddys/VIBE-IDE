import React from 'react';
import { useEditorStore } from '../../store/editor';

export function EditorTabs() {
    const openFiles = useEditorStore(state => state.openFiles);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const setActiveFile = useEditorStore(state => state.setActiveFile);
    const closeFile = useEditorStore(state => state.closeFile);

    return (
        <div style={{
            display: 'flex',
            height: 36,
            background: 'rgba(0,0,0,0.02)',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
            flexShrink: 0
        }}>
            {openFiles.length === 0 && (
                <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    No files open
                </div>
            )}
            {openFiles.map(path => {
                const isActive = activeFileId === path;
                const name = path.split(/[/\\]/).pop() || path;

                return (
                    <div
                        key={path}
                        onClick={() => setActiveFile(path)}
                        style={{
                            padding: '0 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            fontFamily: 'var(--font-sans)',
                            color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                            background: isActive ? 'var(--accent-light)' : 'transparent',
                            borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                            borderRight: '1px solid var(--border-light)',
                            cursor: 'pointer',
                            minWidth: 100,
                            userSelect: 'none'
                        }}
                    >
                        <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: getExtColor(name)
                        }} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); closeFile(path); }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'inherit',
                                cursor: 'pointer',
                                opacity: 0.5,
                                fontSize: 14,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            ×
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

function getExtColor(name: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts': case 'tsx': case 'js': case 'jsx': return 'var(--accent)';
        case 'json': return 'var(--warn)';
        case 'css': case 'scss': return '#6b40bf';
        case 'py': return 'var(--green)';
        case 'html': return 'var(--error)';
        default: return 'var(--text-muted)';
    }
}
