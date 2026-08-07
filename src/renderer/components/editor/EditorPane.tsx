import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editor';
import { MonacoEditor } from './MonacoEditor';
import { Markdown, svgFitDoc } from '../claude/Markdown';

/** Editor + a Preview/Code toggle for renderable files (markdown, HTML, SVG).
    Markdown and docs default to the rendered view - no more reading a report as
    raw text; code files just show the editor. */
const RENDERABLE = new Set(['md', 'markdown', 'html', 'htm', 'svg']);
const extOf = (path: string | null) => (path ? (path.split('.').pop() || '').toLowerCase() : '');

export function EditorPane() {
    const activeFileId = useEditorStore((s) => s.activeFileId);
    const fileContents = useEditorStore((s) => s.fileContents);
    const e = extOf(activeFileId);
    const canRender = RENDERABLE.has(e);
    const [mode, setMode] = useState<'raw' | 'rendered'>('rendered');

    // Default renderable files to Preview; reassess on every file switch.
    useEffect(() => { setMode(canRender ? 'rendered' : 'raw'); }, [activeFileId, canRender]);

    const content = activeFileId ? (fileContents[activeFileId] ?? '') : '';
    const showRendered = canRender && mode === 'rendered';
    const name = activeFileId ? activeFileId.split(/[/\\]/).pop() : '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {canRender && (
                <div className="cl-renderbar">
                    <span className="cl-renderbar__name">{name}</span>
                    <div className="cl-renderbar__toggle">
                        <button className={mode === 'rendered' ? 'on' : ''} onClick={() => setMode('rendered')}>Preview</button>
                        <button className={mode === 'raw' ? 'on' : ''} onClick={() => setMode('raw')}>Code</button>
                    </div>
                </div>
            )}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                {showRendered ? <RenderedFile ext={e} content={content} /> : <MonacoEditor />}
            </div>
        </div>
    );
}

function RenderedFile({ ext, content }: { ext: string; content: string }) {
    if (ext === 'html' || ext === 'htm') {
        // Sandboxed: scripts run, but no access to the app or the user's data.
        return <iframe title="html-preview" sandbox="allow-scripts" srcDoc={content} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />;
    }
    if (ext === 'svg') {
        return <iframe title="svg-preview" sandbox="" srcDoc={svgFitDoc(content)} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />;
    }
    // markdown / md
    return (
        <div className="cl-md-preview" style={{ height: '100%', overflow: 'auto', padding: '20px 28px' }}>
            <Markdown text={content} />
        </div>
    );
}
