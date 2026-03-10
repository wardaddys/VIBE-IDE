import React from 'react';
import { useOllamaStore } from '../../store/ollama';
import type { ModelCapability } from '../../../shared/types';

interface Props {
    onAction?: (action: string) => void;
}

export const ModelCapabilities = ({ onAction }: Props) => {
    const selected = useOllamaStore(s => s.selectedModel);
    const caps: ModelCapability = useOllamaStore(s => s.modelCapabilities[selected] ?? {});

    const handleClick = (text: string) => {
        if (onAction) onAction(text);
    };

    return (
        <div style={{ display: 'flex', gap: 4, padding: '0', color: 'var(--text-muted)' }}>
            {caps.think && (
                <button title="Enable Deep Reasoning" onClick={() => handleClick('/think ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                    💡
                </button>
            )}
            {caps.web && (
                <button title="Web Search Enabled" onClick={() => handleClick('/search ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                    🔍
                </button>
            )}
            {caps.image && (
                <button title="Analyze Image" onClick={() => handleClick('/image ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                    🖼️
                </button>
            )}
            {caps.canExecute && (
                <button title="Terminal Execution Enabled" onClick={() => handleClick('Write a script to: ')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
                    ⌨️
                </button>
            )}
        </div>
    );
};
