import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';

export function ThinkBlock() {
    const isThinking = useOllamaStore(state => state.isThinking);
    const thinkingContent = useOllamaStore(state => state.thinkingContent);
    const thinkingElapsed = useOllamaStore(state => state.thinkingElapsed);
    const [expanded, setExpanded] = useState(false);

    if (!isThinking && !thinkingContent) return null;

    return (
        <div style={{ alignSelf: 'flex-start', maxWidth: '92%', marginBottom: 2 }}>
            <button
                onClick={() => !isThinking && setExpanded(e => !e)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'transparent', border: 'none',
                    cursor: isThinking ? 'default' : 'pointer',
                    padding: '4px 0', color: 'var(--text-muted)',
                    fontSize: 12, fontFamily: 'var(--font-sans)',
                }}
            >
                {isThinking ? (
                    <div style={{
                        width: 10, height: 10,
                        border: '2px solid var(--accent)', borderTopColor: 'transparent',
                        borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0,
                    }} />
                ) : (
                    <span style={{ fontSize: 11, opacity: 0.6 }}>{expanded ? '▾' : '▸'}</span>
                )}
                <span style={{ fontStyle: 'italic', color: isThinking ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {isThinking ? 'Thinking…' : `Thought for ${thinkingElapsed}s`}
                </span>
            </button>

            {!isThinking && expanded && thinkingContent && (
                <div style={{
                    marginTop: 4, padding: '10px 14px',
                    background: 'rgba(0,102,255,0.03)', border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)',
                    lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)',
                    maxHeight: 300, overflowY: 'auto',
                }}>
                    {thinkingContent}
                </div>
            )}
        </div>
    );
}
