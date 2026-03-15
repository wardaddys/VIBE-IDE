import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import type { ModelCapability } from '../../../shared/types';

export const ModelCapabilities = () => {
    const selected = useOllamaStore(s => s.selectedModel);
    const caps: ModelCapability = useOllamaStore(
        s => s.modelCapabilities[selected] ?? {}
    );
    const thinkEnabled = useOllamaStore(s => s.thinkEnabled);
    const thinkLevel = useOllamaStore(s => s.thinkLevel);
    const setThinkEnabled = useOllamaStore(s => s.setThinkEnabled);
    const setThinkLevel = useOllamaStore(s => s.setThinkLevel);
    const [showLevels, setShowLevels] = useState(false);

    // Don't render anything if no capabilities
    if (!caps.think && !caps.vision && !caps.tools) return null;

    const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
    const levelBudgets = { low: 2048, medium: 8192, high: 16000 };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

            {/* THINK BUTTON */}
            {caps.think && (
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => {
                            if (caps.thinkBudget === 'tiered') {
                                setShowLevels(s => !s);
                                if (!thinkEnabled) setThinkEnabled(true);
                            } else {
                                setThinkEnabled(!thinkEnabled);
                                setShowLevels(false);
                            }
                        }}
                        title={thinkEnabled ? 'Thinking ON' : 'Enable thinking'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: `1px solid ${thinkEnabled
                                ? 'var(--accent)' : 'var(--border)'}`,
                            background: thinkEnabled
                                ? 'var(--accent-light)' : 'transparent',
                            color: thinkEnabled
                                ? 'var(--accent)' : 'var(--text-muted)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        💡
                        {caps.thinkBudget === 'tiered' && thinkEnabled && (
                            <span style={{
                                textTransform: 'uppercase',
                                letterSpacing: 0.5
                            }}>
                                {thinkLevel}
                            </span>
                        )}
                        {caps.thinkBudget !== 'tiered' && (
                            <span>{thinkEnabled ? 'ON' : 'Think'}</span>
                        )}
                    </button>

                    {/* Level picker — tiered models only */}
                    {caps.thinkBudget === 'tiered' && showLevels && (
                        <>
                            <div
                                onClick={() => setShowLevels(false)}
                                style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                            />
                            <div style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 8px)',
                                left: 0,
                                zIndex: 99,
                                background: '#fff',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                overflow: 'hidden',
                                minWidth: 140,
                            }}>
                                <div style={{
                                    padding: '8px 12px 4px',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1
                                }}>
                                    Thinking Budget
                                </div>
                                {levels.map(level => (
                                    <button
                                        key={level}
                                        onClick={() => {
                                            setThinkLevel(level);
                                            setThinkEnabled(true);
                                            setShowLevels(false);
                                        }}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            width: '100%',
                                            padding: '7px 12px',
                                            background: thinkLevel === level
                                                ? 'var(--accent-light)' : 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            fontWeight: thinkLevel === level ? 700 : 500,
                                            color: thinkLevel === level
                                                ? 'var(--accent)' : 'var(--text)',
                                            textAlign: 'left',
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        <span>{level}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                            {(levelBudgets[level] / 1000).toFixed(0)}k tokens
                                        </span>
                                    </button>
                                ))}
                                <div style={{
                                    borderTop: '1px solid var(--border-light)',
                                    padding: '6px 12px'
                                }}>
                                    <button
                                        onClick={() => {
                                            setThinkEnabled(false);
                                            setShowLevels(false);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            color: 'var(--error)',
                                            fontWeight: 600,
                                            padding: 0
                                        }}
                                    >
                                        Turn off
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* VISION BADGE — shows when model supports images */}
            {caps.vision && (
                <div
                    title="This model can see images"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '4px 7px',
                        borderRadius: 6,
                        border: '1px solid rgba(0,168,112,0.3)',
                        background: 'rgba(0,168,112,0.06)',
                        color: 'var(--green)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'default',
                    }}
                >
                    👁 Vision
                </div>
            )}

            {/* TOOLS BADGE — shows when model supports function calling */}
            {caps.tools && (
                <div
                    title="This model supports tool calling"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '4px 7px',
                        borderRadius: 6,
                        border: '1px solid rgba(230,138,0,0.3)',
                        background: 'rgba(230,138,0,0.06)',
                        color: 'var(--warn)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'default',
                    }}
                >
                    🔧 Tools
                </div>
            )}

        </div>
    );
};
