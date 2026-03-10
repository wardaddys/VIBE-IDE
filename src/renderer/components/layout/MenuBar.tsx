import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';
import { useOllamaStore } from '../../store/ollama';

interface MenuItem {
    label: string;
    shortcut?: string;
    action?: () => void;
    divider?: boolean;
    disabled?: boolean;
}

interface Menu {
    label: string;
    items: MenuItem[];
}

export function MenuBar() {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const projectPath = useUIStore(state => state.projectPath);
    const setProjectPath = useUIStore(state => state.setProjectPath);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const fileContents = useEditorStore(state => state.fileContents);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleOpenFolder = async () => {
        const p = await window.vibe.openFolder();
        if (p) setProjectPath(p);
        setOpenMenu(null);
    };

    const handleSaveFile = async () => {
        if (activeFileId && fileContents[activeFileId] !== undefined) {
            await window.vibe.writeFile(activeFileId, fileContents[activeFileId]);
        }
        setOpenMenu(null);
    };

    const handleNewFile = async () => {
        if (!projectPath) return;
        const name = prompt('Enter file name:');
        if (name) {
            await window.vibe.writeFile(`${projectPath}/${name}`, '');
            const content = '';
            useEditorStore.getState().openFile(`${projectPath}/${name}`, content);
        }
        setOpenMenu(null);
    };

    const menus: Menu[] = [
        {
            label: 'File',
            items: [
                { label: 'New File', shortcut: 'Ctrl+N', action: handleNewFile },
                { label: 'Open Folder', shortcut: 'Ctrl+O', action: handleOpenFolder },
                { divider: true, label: '' },
                { label: 'Save', shortcut: 'Ctrl+S', action: handleSaveFile, disabled: !activeFileId },
                { divider: true, label: '' },
                { label: 'Exit', shortcut: 'Alt+F4', action: () => window.vibe.closeWindow() },
            ]
        },
        {
            label: 'Edit',
            items: [
                { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
                { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
                { divider: true, label: '' },
                { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
                { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
                { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
                { divider: true, label: '' },
                { label: 'Find', shortcut: 'Ctrl+F', action: () => { /* Monaco handles this */ setOpenMenu(null); } },
            ]
        },
        {
            label: 'View',
            items: [
                { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => {
                    const store = useUIStore.getState();
                    store.setSidebarWidth(store.sidebarWidth === 0 ? 210 : 0);
                    setOpenMenu(null);
                }},
                { label: 'Clear Chat', shortcut: 'Ctrl+L', action: () => { useOllamaStore.getState().clearMessages(); setOpenMenu(null); }},
                { divider: true, label: '' },
                { label: 'Zoom In', shortcut: 'Ctrl++', action: () => { document.body.style.zoom = String(parseFloat(document.body.style.zoom || '1') + 0.1); setOpenMenu(null); }},
                { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => { document.body.style.zoom = String(parseFloat(document.body.style.zoom || '1') - 0.1); setOpenMenu(null); }},
                { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => { document.body.style.zoom = '1'; setOpenMenu(null); }},
            ]
        },
        {
            label: 'Terminal',
            items: [
                { label: 'New Terminal', action: () => {
                    window.vibe.createTerminal(projectPath || undefined);
                    setOpenMenu(null);
                }},
                { label: 'Clear Terminal', action: () => {
                    // Send clear command to active terminal
                    const termId = (window as any).__activeTermId;
                    if (termId) window.vibe.sendTerminalInput(termId, 'cls\r');
                    setOpenMenu(null);
                }},
            ]
        },
        {
            label: 'Help',
            items: [
                { label: 'About VIBE', action: () => { alert('VIBE IDE v0.1.0\nAgent-first IDE by Muhammad Saeed'); setOpenMenu(null); }},
                { label: 'Clear Chat History', action: () => { useOllamaStore.getState().clearMessages(); setOpenMenu(null); }},
            ]
        },
    ];

    return (
        <div ref={menuRef} data-clickable style={{
            display: 'flex',
            alignItems: 'center',
            height: 28,
            padding: '0 8px',
            gap: 0,
            fontSize: 12,
            color: 'var(--text-secondary)',
            background: 'rgba(0,0,0,0.02)',
            borderBottom: '1px solid var(--border-light)',
            flexShrink: 0,
            fontFamily: 'var(--font-sans)',
            position: 'relative',
            zIndex: 50,
        }}>
            {menus.map(menu => (
                <div key={menu.label} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
                        onMouseEnter={() => { if (openMenu) setOpenMenu(menu.label); }}
                        style={{
                            background: openMenu === menu.label ? 'var(--accent-light)' : 'transparent',
                            border: 'none',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: openMenu === menu.label ? 'var(--accent)' : 'var(--text-secondary)',
                            borderRadius: 4,
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 500,
                        }}
                    >
                        {menu.label}
                    </button>
                    {openMenu === menu.label && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            minWidth: 220,
                            background: '#fff',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            padding: '4px 0',
                            zIndex: 100,
                        }}>
                            {menu.items.map((item, i) => {
                                if (item.divider) return <div key={i} style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => { if (!item.disabled && item.action) item.action(); }}
                                        disabled={item.disabled}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            width: '100%',
                                            padding: '6px 16px',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: item.disabled ? 'default' : 'pointer',
                                            fontSize: 12,
                                            color: item.disabled ? 'var(--text-faint)' : 'var(--text)',
                                            textAlign: 'left',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                        onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--accent-light)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span>{item.label}</span>
                                        {item.shortcut && <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{item.shortcut}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
