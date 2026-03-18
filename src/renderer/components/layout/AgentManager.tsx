import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { useSwarmStore, AgentNode } from '../../store/swarms';
import { useUIStore } from '../../store/ui';
import { useHFStore } from '../../store/huggingface';

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
    repairCandidates?: Array<{
        rank: number;
        score: number;
        rationale: string;
        preset: {
            name: string;
            agents: AgentNode[];
        };
    }>;
}

export function AgentManager({ onClose }: { onClose: () => void }) {
    const localModels = useOllamaStore(state => state.models);
    const selectedModel = useOllamaStore(state => state.selectedModel);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const addSwarm = useSwarmStore(state => state.addSwarm);
    const projectPath = useUIStore(state => state.projectPath);
    const pinnedHFModels = useHFStore(state => state.pinnedModels);
    
    const [swarmName, setSwarmName] = useState('My Custom Swarm');
    const [agents, setAgents] = useState<AgentNode[]>([
        { id: 1, role: 'Architect', model: selectedModel || localModels[0] || 'model:auto' }
    ]);
    const [latestRepair, setLatestRepair] = useState<LatestRepairArtifact | null>(null);
    const [isLoadingRepair, setIsLoadingRepair] = useState(false);
    const [selectedRepairCandidateIndex, setSelectedRepairCandidateIndex] = useState(0);
    const [openRouterModels, setOpenRouterModels] = useState<Array<{ id: string; label: string }>>([]);

    const dynamicModelOptions = React.useMemo(() => {
        const options: Array<{ id: string; label: string; group: 'local' | 'openrouter' | 'hf' | 'other' }> = [];
        const seen = new Set<string>();

        const push = (id: string, label: string, group: 'local' | 'openrouter' | 'hf' | 'other') => {
            const normalized = String(id || '').trim();
            if (!normalized || seen.has(normalized)) return;
            seen.add(normalized);
            options.push({ id: normalized, label: label || normalized, group });
        };

        localModels.forEach((model) => push(model, model, 'local'));
        openRouterModels.forEach((model) => push(model.id, model.label || model.id, 'openrouter'));
        pinnedHFModels.forEach((model) => push(`hf:${model.id}`, `HF ${model.name}`, 'hf'));

        if (selectedModel) push(selectedModel, selectedModel, 'other');
        agents.forEach((agent) => push(agent.model, agent.model, 'other'));
        latestRepair?.repairCandidates?.forEach((candidate) => {
            candidate.preset.agents.forEach((agent) => push(agent.model, agent.model, 'other'));
        });
        latestRepair?.suggestedSwarmPreset?.agents?.forEach((agent) => push(agent.model, agent.model, 'other'));

        return options;
    }, [localModels, openRouterModels, pinnedHFModels, selectedModel, agents, latestRepair]);

    const modelGroups = React.useMemo(() => {
        const local = dynamicModelOptions.filter((m) => m.group === 'local');
        const openrouter = dynamicModelOptions.filter((m) => m.group === 'openrouter');
        const hf = dynamicModelOptions.filter((m) => m.group === 'hf');
        const other = dynamicModelOptions.filter((m) => m.group === 'other');
        return { local, openrouter, hf, other };
    }, [dynamicModelOptions]);

    React.useEffect(() => {
        let active = true;

        const loadOpenRouterModels = async () => {
            if (!apiKeys.openrouter) {
                if (active) setOpenRouterModels([]);
                return;
            }

            try {
                const rows = await window.vibe.listOpenRouterModels(apiKeys);
                if (active) {
                    setOpenRouterModels((rows || []).map((row) => ({ id: row.id, label: row.label || row.id })));
                }
            } catch {
                if (active) setOpenRouterModels([]);
            }
        };

        loadOpenRouterModels();
        return () => {
            active = false;
        };
    }, [apiKeys]);

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
                if (active) setSelectedRepairCandidateIndex(0);
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
        const fallback = dynamicModelOptions[0]?.id || selectedModel || 'model:auto';
        setAgents([...agents, { id: Date.now(), role: 'Coder', model: fallback }]);
    };

    const handleSave = () => {
        const swarmId = `swarm-${Date.now()}`;
        addSwarm({ id: swarmId, name: swarmName, agents });
        useOllamaStore.getState().setSelectedModel(swarmId);
        onClose();
    };

    const handleApplyRepairAsPreset = () => {
        const candidates = latestRepair?.repairCandidates || [];
        const preset = candidates[selectedRepairCandidateIndex]?.preset || latestRepair?.suggestedSwarmPreset;
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
        const candidates = latestRepair?.repairCandidates || [];
        const preset = candidates[selectedRepairCandidateIndex]?.preset || latestRepair?.suggestedSwarmPreset;
        if (!preset) return;
        setSwarmName(`${preset.name} (editable)`);
        setAgents(preset.agents.map((agent, idx) => ({ ...agent, id: idx + 1 })));
    };

    const repairCandidates = latestRepair?.repairCandidates || [];
    const activeCandidate = repairCandidates[selectedRepairCandidateIndex] || null;

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
                                {repairCandidates.length > 0 && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                            Candidate (bounded micro-search)
                                        </div>
                                        <select
                                            value={selectedRepairCandidateIndex}
                                            onChange={(e) => setSelectedRepairCandidateIndex(Number(e.target.value))}
                                            style={{
                                                width: '100%',
                                                padding: '7px 8px',
                                                borderRadius: 6,
                                                border: '1px solid var(--border)',
                                                background: '#fff',
                                                color: 'var(--text)',
                                                fontSize: 12,
                                            }}
                                        >
                                            {repairCandidates.map((candidate, idx) => (
                                                <option key={`${candidate.rank}-${idx}`} value={idx}>
                                                    #{candidate.rank} score {candidate.score.toFixed(3)} - {candidate.preset.name}
                                                </option>
                                            ))}
                                        </select>
                                        {activeCandidate?.rationale && (
                                            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                                                {activeCandidate.rationale}
                                            </div>
                                        )}
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
                                    {modelGroups.local.length > 0 && (
                                        <optgroup label="Local Models">
                                            {modelGroups.local.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </optgroup>
                                    )}
                                    {modelGroups.openrouter.length > 0 && (
                                        <optgroup label="OpenRouter Models">
                                            {modelGroups.openrouter.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </optgroup>
                                    )}
                                    {modelGroups.hf.length > 0 && (
                                        <optgroup label="HuggingFace Models">
                                            {modelGroups.hf.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </optgroup>
                                    )}
                                    {modelGroups.other.length > 0 && (
                                        <optgroup label="Other Available Models">
                                            {modelGroups.other.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </optgroup>
                                    )}
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
