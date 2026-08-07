import React, { useEffect, useState } from 'react';

/* First-run prompt: choose WHERE VIBE keeps projects.
   Shown once per machine (until the data home is chosen). The choice is stored
   in the app's userData (update-proof); the data itself lives where the user
   picks (default ~/Documents/VIBE). Movable later from Settings. */
export function DataHomeSetup({ onDone }: { onDone: () => void }): React.ReactElement {
    const [defaultPath, setDefaultPath] = useState('');
    const [chosen, setChosen] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        window.vibe.dataHome.get().then((d) => setDefaultPath(d.default)).catch(() => {});
    }, []);

    const target = chosen || defaultPath;

    const choose = async (): Promise<void> => {
        try { const p = await window.vibe.dataHome.pick(); if (p) setChosen(p); } catch { /* keep default */ }
    };
    const confirm = async (): Promise<void> => {
        setBusy(true); setErr(null);
        const res = await window.vibe.dataHome.set(target, false);
        setBusy(false);
        if (res.ok) onDone(); else setErr(res.error || 'Could not set the data location.');
    };

    return (
        <div style={overlay}>
            <div style={card}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.3 }}>Welcome to VIBE</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 14 }}>Where should VIBE keep your work?</div>
                <p style={{ color: 'var(--cl-text-2, #9aa)', fontSize: 13, lineHeight: 1.55, margin: '8px 0 2px' }}>
                    Your projects live in this folder. It stays in a place you can see and
                    is never wiped by app updates. You can move it any time from Settings.
                </p>
                <div style={pathBox} title={target}>{target || '…'}</div>
                {err && <div style={{ color: '#c96442', fontSize: 12, marginTop: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
                    <button style={btnGhost} onClick={choose} disabled={busy}>Choose folder…</button>
                    <button style={btnPrimary} onClick={confirm} disabled={busy || !target}>{busy ? 'Setting up…' : 'Use this location'}</button>
                </div>
            </div>
        </div>
    );
}

const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
};
const card: React.CSSProperties = {
    width: 'min(560px, 92vw)', background: 'var(--cl-bg, #16181d)', color: 'var(--cl-text, #e6e6e6)',
    border: '1px solid var(--cl-edge, #2a2d35)', borderRadius: 14, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
};
const pathBox: React.CSSProperties = {
    marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--cl-bg-2, #1e2128)',
    border: '1px solid var(--cl-edge, #2a2d35)', fontFamily: 'monospace', fontSize: 12.5,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--cl-text, #e6e6e6)',
};
const btnGhost: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 8, border: '1px solid var(--cl-edge, #2a2d35)',
    background: 'transparent', color: 'var(--cl-text, #e6e6e6)', cursor: 'pointer', fontSize: 13,
};
const btnPrimary: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: 'var(--cl-accent, #c96442)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
