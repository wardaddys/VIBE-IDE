import React, { useEffect, useRef, useState } from 'react';
import { useAgentRunStore, type RunItem } from '../../store/agentRun';
import { svgFitDoc } from '../claude/Markdown';

/** Pull the newest ```html / ```svg block out of assistant text - including a
    PARTIAL block that is still streaming (no closing fence yet). */
function extractBlock(text: string): string {
    const re = /```(html|svg)\s*\n/gi;
    let m: RegExpExecArray | null;
    let last: { lang: string; start: number } | null = null;
    while ((m = re.exec(text)) !== null) last = { lang: m[1].toLowerCase(), start: re.lastIndex };
    if (!last) return '';
    const rest = text.slice(last.start);
    const end = rest.indexOf('```');
    const code = (end === -1 ? rest : rest.slice(0, end)).trim();
    if (!code) return '';
    return last.lang === 'svg' ? svgFitDoc(code) : code;
}

function latestDesignDoc(items: RunItem[]): string {
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.kind !== 'assistant') continue;
        const doc = extractBlock(it.text);
        if (doc) return doc;
    }
    return '';
}

/** Live-rendering canvas for the Design surface. Sandbox: scripts only - the
    design cannot reach the app, the filesystem, or the network origin. */
export function DesignCanvas() {
    const items = useAgentRunStore((s) => s.items);
    const running = useAgentRunStore((s) => s.running);
    const [doc, setDoc] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = latestDesignDoc(items);

    useEffect(() => {
        if (!running) {
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
            setDoc(latest);
            return;
        }
        // While streaming, refresh at most ~2x/sec (each srcDoc swap is a full reload).
        if (timerRef.current) return;
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setDoc(latestDesignDoc(useAgentRunStore.getState().items));
        }, 450);
    }, [latest, running]);
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    const copy = () => { if (doc) navigator.clipboard?.writeText(doc); };

    return (
        <div className="cl-canvas">
            <div className="cl-canvas__bar">
                <span>Canvas</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {running && <span className="cl-canvas__live">● live</span>}
                    <button onClick={copy} disabled={!doc}>copy html</button>
                </div>
            </div>
            {doc ? (
                <iframe className="cl-canvas__frame" title="design-canvas" sandbox="allow-scripts" srcDoc={doc} />
            ) : (
                <div className="cl-canvas__empty">
                    <div style={{ fontSize: 42, opacity: 0.15 }}>◇</div>
                    <div>Describe what you want designed.<br />It renders here live while the agent streams.</div>
                </div>
            )}
        </div>
    );
}
