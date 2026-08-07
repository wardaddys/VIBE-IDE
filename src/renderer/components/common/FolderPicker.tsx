import React, { useEffect, useState } from 'react';
import { useFolderPicker } from '../../store/folderPicker';

/* In-app folder picker — replaces the native OS dialog (which fails under sudo,
   where root has no DBus session bus / xdg-desktop-portal). Navigates directories
   via fs.readdir in the main process, can create a folder, and returns the chosen
   absolute path. Works whether the app runs as root or the desktop user. */

const btn: React.CSSProperties = {
    background: 'var(--cl-bg-2, #23232c)', color: 'var(--cl-text, #e6e6ea)',
    border: '1px solid var(--cl-border-soft, #33333f)', borderRadius: 8,
    padding: '6px 10px', fontSize: 12, cursor: 'pointer',
};

export function FolderPicker(): React.ReactElement | null {
    const open = useFolderPicker((s) => s.open);
    const done = useFolderPicker((s) => s.done);
    const [cur, setCur] = useState('');
    const [parent, setParent] = useState<string | null>(null);
    const [dirs, setDirs] = useState<{ name: string; path: string }[]>([]);
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const load = async (p?: string): Promise<void> => {
        setErr('');
        try {
            const r = await window.vibe.listDirs(p);
            setCur(r.path); setParent(r.parent); setDirs(r.dirs);
        } catch (e: any) { setErr(e?.message || 'Failed to list directory'); }
    };

    useEffect(() => { if (open) { setNewName(''); setBusy(false); load(); } }, [open]);
    if (!open) return null;

    const choosePath = async (target: string): Promise<void> => {
        setBusy(true); setErr('');
        try { const p = await window.vibe.setProjectFolder(target); done(p); }
        catch (e: any) { setErr(e?.message || 'Could not open folder'); setBusy(false); }
    };
    const choose = async (): Promise<void> => choosePath(cur);
    const mkdir = async (): Promise<void> => {
        const name = newName.trim(); if (!name) return;
        setBusy(true); setErr('');
        try { const np = await window.vibe.makeDir(cur, name); setNewName(''); await load(np); }
        catch (e: any) { setErr(e?.message || 'Could not create folder'); }
        setBusy(false);
    };

    const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
    const panel: React.CSSProperties = { width: 580, maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: 'var(--cl-bg, #1a1a22)', color: 'var(--cl-text, #e6e6ea)', border: '1px solid var(--cl-border-soft, #33333f)', borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,.5)', overflow: 'hidden' };
    const rowStyle: React.CSSProperties = { padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid var(--cl-border-soft, #2a2a33)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 };
    const inputStyle: React.CSSProperties = { background: 'var(--cl-bg-2, #23232c)', color: 'var(--cl-text, #e6e6ea)', border: '1px solid var(--cl-border-soft, #33333f)', borderRadius: 8, padding: '6px 9px', fontSize: 12 };
    const selectBtn: React.CSSProperties = { ...btn, marginLeft: 'auto', opacity: 0.85, fontSize: 11, padding: '4px 8px' };

    return (
        <div style={overlay} onClick={() => done(null)}>
            <div style={panel} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--cl-border-soft, #2a2a33)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>Select a project / engagement folder</strong>
                    <button onClick={() => done(null)} style={{ marginLeft: 'auto', background: 'transparent', color: 'var(--cl-text-2, #9a9aa5)', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
                    <input value={cur} onChange={(e) => setCur(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(cur); }}
                        spellCheck={false} style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} />
                    <button onClick={() => load(cur)} style={btn}>Go</button>
                    {parent && <button onClick={() => load(parent)} title="Up one level" style={btn}>↑ Up</button>}
                </div>
                <div style={{ flex: 1, overflow: 'auto', minHeight: 140, borderTop: '1px solid var(--cl-border-soft, #2a2a33)' }}>
                    {dirs.length === 0 && <div style={{ padding: 16, color: 'var(--cl-text-2, #9a9aa5)', fontSize: 12 }}>No subfolders here. Use “Open this folder” to pick the current path, or create one below.</div>}
                    {dirs.map((d) => (
                        <div key={d.path} style={rowStyle}>
                            <span onClick={() => load(d.path)} style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, overflow: 'hidden' }} title={`Open ${d.path}`}>
                                <span>📁</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); choosePath(d.path); }}
                                style={selectBtn}
                                title={`Select ${d.path}`}
                            >Select</button>
                        </div>
                    ))}
                </div>
                {err && <div style={{ padding: '6px 12px', color: 'var(--cl-bad, #e06c75)', fontSize: 12 }}>{err}</div>}
                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--cl-border-soft, #2a2a33)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') mkdir(); }}
                        placeholder="New folder name…" spellCheck={false} style={{ ...inputStyle, width: 170 }} />
                    <button onClick={mkdir} disabled={!newName.trim() || busy} style={btn}>+ Create</button>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button onClick={() => done(null)} style={btn}>Cancel</button>
                        <button onClick={choose} disabled={busy} style={{ ...btn, background: 'var(--cl-accent, #6c8cff)', color: '#fff', borderColor: 'transparent', fontWeight: 600 }}>Open this folder</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
