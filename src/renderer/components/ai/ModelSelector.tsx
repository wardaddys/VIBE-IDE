import React, { useEffect, useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { useSwarmStore } from '../../store/swarms';
import { getModelTags } from '../../utils/tags';
import { AgentManager } from '../layout/AgentManager';
import { OLLAMA_ONLY_MODELS } from '../../../shared/constants';
import { useHFStore } from '../../store/huggingface';
import { HuggingFacePicker } from './HuggingFacePicker';

interface Props { onClose: () => void; }

export function ModelSelector({ onClose }: Props) {
    const models = useOllamaStore(state => state.models);
    const selectedModel = useOllamaStore(state => state.selectedModel);
    const setSelectedModel = useOllamaStore(state => state.setSelectedModel);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const swarms = useSwarmStore(state => state.swarms);
    const [showAgentManager, setShowAgentManager] = useState(false);
    const [showHFPicker, setShowHFPicker] = useState(false);
    const { pinnedModels } = useHFStore();
    const [loadedModels, setLoadedModels] = useState<string[]>([]);

    // Fetch which models are currently loaded in VRAM
    useEffect(() => {
        const fetchLoaded = async () => {
            try {
                const loaded = await window.vibe.getLoadedModels();
                setLoadedModels(loaded);
            } catch { }
        };
        fetchLoaded();
        const interval = setInterval(fetchLoaded, 10000);
        return () => clearInterval(interval);
    }, []);

    // -----------------------------------------------------------------
    // Two buckets – local‑only models and Ollama‑cloud models.
    // -----------------------------------------------------------------
    const localModels = models.filter(m => !OLLAMA_ONLY_MODELS.has(m));
    const cloudModels = models.filter(m => OLLAMA_ONLY_MODELS.has(m));

    // -----------------------------------------------------------------
    // Pull the list on mount and then refresh every 30 s (so newly
    // pulled models appear without a restart).
    // -----------------------------------------------------------------
    useEffect(() => {
        const load = () => {
            window.vibe.listModels().then((m: any) => useOllamaStore.getState().setModels(m));
        };
        load();
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, []);

    const cloudRoster = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'claude' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq' }
    ];

    const availableCloudModels = cloudRoster.filter(m => !!apiKeys[m.provider as keyof typeof apiKeys]);

    const renderModelItem = (m: { name?: string, id?: string, label?: string }, isSwarm = false) => {
        const id = m.id || m.name || '';
        const displayName = m.label || m.name || m.id;
        const isSelected = selectedModel === id;
        const isLoaded = loadedModels.some(lm =>
            lm.toLowerCase().includes(id.toLowerCase()) ||
            id.toLowerCase().includes(lm.toLowerCase())
        );
        return (
            <div key={id} onClick={() => { setSelectedModel(id); onClose(); }} style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isSelected ? 'var(--accent-light)' : 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? 'var(--accent)' : 'transparent', border: isSelected ? 'none' : '1px solid var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: isSelected ? (isSwarm ? 700 : 600) : 500, color: isSwarm ? 'var(--accent)' : 'var(--text)' }}>
                        {displayName}
                    </span>
                    {isLoaded && (
                        <span
                            title="Loaded in memory"
                            style={{
                                width: 6, height: 6,
                                borderRadius: '50%',
                                background: 'var(--green)',
                                display: 'inline-block',
                                marginLeft: 4,
                                boxShadow: '0 0 4px var(--green)',
                            }}
                        />
                    )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {!isSwarm && getModelTags(id).map(tag => (
                        <span key={tag.label} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: tag.color, background: tag.bg }}>{tag.label}</span>
                    ))}
                    {isSwarm && <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: 'var(--accent)', background: 'var(--accent-light)' }}>SWARM</span>}
                </div>
            </div>
        );
    };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
            
            {showAgentManager && <AgentManager onClose={() => setShowAgentManager(false)} />}
            {showHFPicker && <HuggingFacePicker onClose={() => setShowHFPicker(false)} />}

            <GlassPanel variant="strong" style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: 0, right: 0, zIndex: 10, padding: '12px 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
                
                <div style={{ padding: '4px 16px 12px' }}>
                    <button onClick={() => { setShowAgentManager(true); onClose(); }} style={{ width: '100%', padding: '10px', background: 'var(--accent-light)', color: 'var(--accent)', border: '1px dashed var(--accent)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.2s' }}>
                        + Create Custom Swarm
                    </button>
                </div>

                <div style={{ margin: '4px 0 8px', borderTop: '1px solid var(--border-light)' }} />

                {swarms.length > 0 && (
                    <>
                        <div style={{ padding: '0 16px 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)', fontWeight: 700 }}>Custom Swarms</div>
                        <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {swarms.map(swarm => renderModelItem({ id: swarm.id, label: swarm.name }, true))}
                        </div>
                        <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                    </>
                )}

                <div style={{ padding: '0 16px 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Local Models (Free)</div>
                {localModels.length === 0 ? (
                    <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        No local models found. Install one via `ollama pull …`.
                    </div>
                ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {localModels.map(m => renderModelItem({ id: m, label: m }))}
                    </div>
                )}

                {/* ---------- Ollama‑cloud models (free) ---------- */}
                {cloudModels.length > 0 && (
                    <>
                        <div style={{ padding: '8px 16px 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)', fontWeight: 700, marginTop: 8 }}>
                            Ollama Cloud (Free)
                        </div>
                        <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {cloudModels.map(m => renderModelItem({ id: m, label: `${m} (Ollama Cloud)` }))}
                        </div>
                    </>
                )}
                
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '8px 16px 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Cloud Models (API)</div>
                <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {availableCloudModels.length === 0 ? (
                        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>No API keys found. Add them in Settings.</div>
                    ) : (
                        availableCloudModels.map(m => renderModelItem({ id: m.id, label: m.name }))
                    )}
                </div>

                {/* HuggingFace section */}
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#ff6e00', fontWeight: 700 }}>HuggingFace (Free)</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowHFPicker(true); }}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #ff6e00', background: 'rgba(255,110,0,0.06)', color: '#ff6e00', cursor: 'pointer', fontWeight: 600 }}
                    >
                        + Browse
                    </button>
                </div>
                {pinnedModels.length === 0 ? (
                    <div style={{ padding: '6px 16px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                        No HF models added. Click Browse →
                    </div>
                ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {pinnedModels.map(m => renderModelItem({ id: `hf:${m.id}`, label: m.name }))}
                    </div>
                )}
            </GlassPanel>
        </>
    );
}
