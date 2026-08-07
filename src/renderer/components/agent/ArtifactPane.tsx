import React, { useMemo, useState } from 'react';
import { svgFitDoc } from '../claude/Markdown';

/**
 * Detects fenced ```html / ```svg blocks in assistant text and offers a
 * sandboxed live preview. The iframe is sandboxed (allow-scripts only, no
 * same-origin) so artifact code cannot touch the app or the user's data.
 */
interface Artifact { lang: 'html' | 'svg'; code: string; }

function extractArtifacts(text: string): Artifact[] {
    const out: Artifact[] = [];
    const re = /```(html|svg)\s*\n([\s\S]*?)```/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push({ lang: m[1].toLowerCase() as 'html' | 'svg', code: m[2].trim() });
    }
    return out;
}

export function ArtifactBadges({ text }: { text: string }) {
    const artifacts = useMemo(() => extractArtifacts(text), [text]);
    const [open, setOpen] = useState<Artifact | null>(null);
    if (artifacts.length === 0) return null;

    return (
        <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
                {artifacts.map((a, i) => (
                    <button key={i} onClick={() => setOpen(a)}
                        style={{ border: '1px solid var(--border)', background: 'rgba(0,102,255,0.06)', color: 'var(--accent, #0066ff)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Preview {a.lang.toUpperCase()} artifact
                    </button>
                ))}
            </div>
            {open && <ArtifactModal artifact={open} onClose={() => setOpen(null)} />}
        </>
    );
}

function ArtifactModal({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
    // Same scale-to-fit document as the inline chat renderer, so the preview
    // can never show a different framing than the chat did.
    const srcDoc = artifact.lang === 'svg' ? svgFitDoc(artifact.code) : artifact.code;
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '80vw', height: '80vh', background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Artifact preview ({artifact.lang})</span>
                    <button onClick={onClose} style={{ border: 'none', background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Close</button>
                </div>
                <iframe title="artifact" sandbox="allow-scripts" srcDoc={srcDoc} style={{ flex: 1, border: 'none', width: '100%' }} />
            </div>
        </div>
    );
}
