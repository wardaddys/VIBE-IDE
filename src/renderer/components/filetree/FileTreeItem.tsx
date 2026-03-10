import React, { useState } from 'react';
import type { FileEntry } from '../../../shared/types';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useEditorStore } from '../../store/editor';

interface Props {
    entry: FileEntry;
    level: number;
}

export function FileTreeItem({ entry, level }: Props) {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<FileEntry[]>([]);
    const { readDir, readFile } = useFileSystem();
    const openFile = useEditorStore(state => state.openFile);
    const activeFileId = useEditorStore(state => state.activeFileId);

    const isActive = activeFileId === entry.path;

    const handleClick = async () => {
        if (entry.isDirectory) {
            if (!expanded) {
                const _children = await readDir(entry.path);
                setChildren(_children);
            }
            setExpanded(!expanded);
        } else {
            const content = await readFile(entry.path);
            openFile(entry.path, content);
        }
    };

    const getExtColor = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts': case 'tsx': case 'js': case 'jsx': return 'var(--accent)';
            case 'json': return 'var(--warn)';
            case 'css': case 'scss': return '#6b40bf';
            case 'py': return 'var(--green)';
            case 'html': return 'var(--error)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div>
            <div
                onClick={handleClick}
                style={{
                    padding: `4px 16px 4px ${16 + level * 12}px`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    background: isActive ? 'var(--accent-light)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    fontWeight: entry.isDirectory ? 500 : 400,
                    userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                }}
                onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
            >
                {entry.isDirectory ? (
                    <span style={{ fontSize: 10, opacity: 0.6, width: 12 }}>{expanded ? '▾' : '▸'}</span>
                ) : (
                    <div style={{ width: 12, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: getExtColor(entry.name) }} />
                    </div>
                )}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
            </div>

            {expanded && entry.isDirectory && (
                <div>
                    {children.map(child => (
                        <FileTreeItem key={child.path} entry={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}
