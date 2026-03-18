import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { useSwarmStore, AgentNode } from '../../store/swarms';
import { useUIStore } from '../../store/ui';

interface LatestRepairArtifact {
    id: string;
    generatedAt: string;
    diagnosis?: {
        summary?: string;
        confidence?: number;
    };
    suggestedSwarmPreset?: {
        name: string;
        agents: AgentNode[];
    };
}

export function AgentManager({ onClose }: { onClose: () => void }) {
    const localModels = useOllamaStore(state => state.models);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const addSwarm = useSwarmStore(state => state.addSwarm);
    const projectPath = useUIStore(state => state.projectPath);
    
    const [swarmName, setSwarmName] = useState('My Custom Swarm');
    const [agents, setAgents] = useState<AgentNode[]>([
        { id: 1, role: 'Architect', model: 'gemini-1.5-flash' }
    ]);
    const [latestRepair, setLatestRepair] = useState<LatestRepairArtifact | null>(null);
    const [isLoadingRepair, setIsLoadingRepair] = useState(false);

    const cloudRoster = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'claude' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq' },
        { id: 'openrouter:openai/gpt-4o-mini', name: 'OpenRouter GPT-4o Mini', provider: 'openrouter' },
        { id: 'openrouter:anthropic/claude-3.5-sonnet', name: 'OpenRouter Claude 3.5 Sonnet', provider: 'openrouter' }
    ];
    const availableCloudModels = cloudRoster.filter(m => !!apiKeys[m.provider as keyof typeof apiKeys]);

    React.useEffect(() => {
        let active = true;

        const loadLatestRepair = async () => {
            if (!projectPath) {
                if (active) setLatestRepair(null);
                return;
            }

            setIsLoadingRepair(true);
            try {
                const raw = await window.vibe.readFile(`${projectPath}/.vibe/swarm-repairs/latest.json`);
                const parsed = JSON.parse(raw) as LatestRepairArtifact;
                if (active) setLatestRepair(parsed);
            } catch {
                if (active) setLatestRepair(null);
            } finally {
                if (active) setIsLoadingRepair(false);
            }
        };

        loadLatestRepair();
        return () => {
            active = false;
        };
    }, [projectPath]);

    const addAgent = () => {
        setAgents([...agents, { id: Date.now(), role: 'Coder', model: localModels.length > 0 ? localModels[0] : 'gemini-1.5-flash' }]);
    };

    const handleSave = () => {
        const swarmId = `swarm-${Date.now()}`;
        addSwarm({ id: swarmId, name: swarmName, agents });
        useOllamaStore.getState().setSelectedModel(swarmId);
        onClose();
    };

    const handleApplyRepairAsPreset = () => {
        const preset = latestRepair?.suggestedSwarmPreset;
        if (!preset) return;

        const swarmId = `swarm-${Date.now()}`;
        const rebuiltAgents = preset.agents.map((agent, idx) => ({
            ...agent,
            id: idx + 1,
        }));

        addSwarm({
            id: swarmId,
            name: `${preset.name} (${new Date().toLocaleTimeString()})`,
            agents: rebuiltAgents,
        });
        useOllamaStore.getState().setSelectedModel(swarmId);
        onClose();
    };

    const handleLoadRepairIntoCanvas = () => {
        const preset = latestRepair?.suggestedSwarmPreset;
        if (!preset) return;
        setSwarmName(`${preset.name} (editable)`);
        setAgents(preset.agents.map((agent, idx) => ({ ...agent, id: idx + 1 })));
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <GlassPanel variant="strong" style={{ width: 800, maxHeight: '90vh', overflowY: 'auto', padding: 32, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: 16, marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 20, margin: '0 0 8px 0', color: 'var(--text)' }}>Swarm Canvas</h2>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Design a multi-agent pipeline and save it as a custom model.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
                </div>

                <input value={swarmName} onChange={e => setSwarmName(e.target.value)} style={{ fontSize: 16, padding: '12px 16px', borderRadius: 6, border: '1px solid var(--accent)', background: 'rgba(255,255,255,0.5)', outline: 'none', fontWeight: 600, color: 'var(--accent)', marginBottom: 24 }} />

                {(isLoadingRepair || latestRepair?.suggestedSwarmPreset) && (
                    <div style={{
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        background: 'rgba(0, 102, 255, 0.04)',
                        padding: 14,
                        marginBottom: 18,
                    }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>
                            Latest Swarm Repair
                        </div>
                        {isLoadingRepair && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading latest repair artifact...</div>
                        )}
                        {!isLoadingRepair && latestRepair?.suggestedSwarmPreset && (
                            <>
                                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
                                    {latestRepair.suggestedSwarmPreset.name}
                                </div>
                                {latestRepair.diagnosis?.summary && (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                        {latestRepair.diagnosis.summary}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        onClick={handleApplyRepairAsPreset}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--accent)',
                                            background: 'var(--accent-light)',
                                            color: 'var(--accent)',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            fontWeight: 700,
                                        }}
                                    >
                                        Apply as New Preset
                                    </button>
                                    <button
                                        onClick={handleLoadRepairIntoCanvas}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--border)',
                                            background: 'rgba(0,0,0,0.02)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            fontWeight: 600,
                                        }}
                                    >
                                        Load into Canvas
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
                    {agents.map((agent, index) => (
                        <React.Fragment key={agent.id}>
                            <div style={{ minWidth: 260, background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'relative' }}>
                                {index > 0 && <button onClick={() => setAgents(agents.filter(a => a.id !== agent.id))} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}>✕</button>}
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>NODE {index + 1}</div>
                                
                                <select value={agent.role} onChange={(e) => setAgents(agents.map(a => a.id === agent.id ? { ...a, role: e.target.value } : a))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 12 }}>
                                    <option value="Architect">Architect (Planning)</option>
                                    <option value="Coder">Coder (Execution)</option>
                                </select>

                                <select value={agent.model} onChange={(e) => setAgents(agents.map(a => a.id === agent.id ? { ...a, model: e.target.value } : a))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                    <optgroup label="Local Models">{localModels.map(m => <option key={m} value={m}>{m}</option>)}</optgroup>
                                    {availableCloudModels.length > 0 && <optgroup label="Cloud API Models">{availableCloudModels.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</optgroup>}
                                </select>
                            </div>
                            {index < agents.length - 1 && <div style={{ color: 'var(--accent)', fontSize: 24 }}>→</div>}
                        </React.Fragment>
                    ))}
                    <button onClick={addAgent} style={{ minWidth: 150, height: 120, border: '2px dashed var(--border)', borderRadius: 12, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>+ Add Node</button>
                </div>

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Save Swarm Pipeline</button>
                </div>
            </GlassPanel>
        </div>
    );
}
