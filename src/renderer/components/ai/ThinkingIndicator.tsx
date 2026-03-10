import React from 'react';
import { useOllamaStore } from '../../store/ollama';

export function ThinkingIndicator() {
    const agentStep = useOllamaStore(state => state.agentStep);
    const agentMaxSteps = useOllamaStore(state => state.agentMaxSteps);
    const agentStatus = useOllamaStore(state => state.agentStatus);
    const isLooping = agentStep > 0;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: isLooping ? 'rgba(230,138,0,0.06)' : 'var(--accent-light)',
            borderRadius: 6,
            color: isLooping ? 'var(--warn)' : 'var(--accent)',
            fontSize: 12,
            border: `1px solid ${isLooping ? 'rgba(230,138,0,0.15)' : 'transparent'}`,
        }}>
            <div style={{
                width: 10,
                height: 10,
                border: `2px solid ${isLooping ? 'var(--warn)' : 'var(--accent)'}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                flexShrink: 0,
            }} />
            <span>
                {agentStatus
                    ? agentStatus
                    : isLooping
                        ? `Agent working… (step ${agentStep}/${agentMaxSteps})`
                        : 'Assistant is thinking…'}
            </span>
        </div>
    );
}
