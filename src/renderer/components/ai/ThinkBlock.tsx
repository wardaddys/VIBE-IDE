import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';

export function ThinkBlock() {
    const thinkingContent = useOllamaStore(state => state.thinkingContent);
    const isThinking = useOllamaStore(state => state.isThinking);
    const thinkingElapsed = useOllamaStore(state => state.thinkingElapsed);
    const [expanded, setExpanded] = useState(false);

    if (!thinkingContent && !isThinking) return null;

    const label = isThinking
        ? 'Thinking…'
        : `Thought for ${thinkingElapsed ?? 0}s`;

    return (
        <div style={{
            alignSelf: 'flex-start',
            maxWidth: '92%',
            marginBottom: 4,
            border: '1px solid var(--border-light)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            background: 'rgba(0,0,0,0.02)',
        }}>
            <button
                onClick={() => setExpanded(e => !e)}
                style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 12px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                {isThinking && (
                    <div style={{
                        width: 8, height: 8,
                        border: '2px solid var(--accent)',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite',
                        flexShrink: 0,
                    }} />
                )}
                {!isThinking && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {expanded ? '▾' : '▸'}
                    </span>
                )}
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {label}
                </span>
            </button>
            {expanded && thinkingContent && (
                <div style={{
                    padding: '8px 12px 12px',
                    borderTop: '1px solid var(--border-light)',
                    fontSize: 12,
                    color: 'var(--text-secondary)',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'var(--font-mono)',
                    maxHeight: 300,
                    overflowY: 'auto',
                }}>
                    {thinkingContent}
                </div>
            )}
        </div>
    );
}
