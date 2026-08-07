import { Overlay } from './Modal';
import React, { useEffect, useMemo, useState } from 'react';
import type { CloudModelInfo } from '../../../shared/agent';
import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { fetchCapabilities } from '../../utils/capabilities';

interface Row { id: string; label: string; meta?: string; group: string; tag?: { text: string; color: string; bg: string } }

export function ModelPicker({ onClose }: { onClose: () => void }) {
    const localModels = useOllamaStore((s) => s.models);
    const selected = useOllamaStore((s) => s.selectedModel);
    const apiKeys = useSettingsStore((s) => s.apiKeys);
    const [query, setQuery] = useState('');
    const [cloud, setCloud] = useState<CloudModelInfo[]>([]);
    const [openrouter, setOpenrouter] = useState<{ id: string; label: string }[]>([]);
    const [hf, setHf] = useState<{ id: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const [c, or] = await Promise.all([
                window.vibe.kernel.cloudModels(apiKeys.ollama || undefined).catch(() => []),
                apiKeys.openrouter ? window.vibe.listOpenRouterModels(apiKeys).catch(() => []) : Promise.resolve([]),
            ]);
            setCloud(c);
            useOllamaStore.getState().setCloudModelNames((c as any[]).map((m) => m.name));
            setOpenrouter((or as any[]).map((m) => ({ id: m.id, label: m.label })));
            setLoading(false);
        })();
    }, []);

    // HF search on demand
    useEffect(() => {
        if (query.length < 3) { setHf([]); return; }
        const t = setTimeout(async () => {
            const r = await window.vibe.searchHuggingFaceModels(query, apiKeys).catch(() => []);
            setHf((r as any[]).map((m) => ({ id: m.id })));
        }, 350);
        return () => clearTimeout(t);
    }, [query]);

    const rows = useMemo(() => {
        const out: Row[] = [];
        for (const m of localModels) out.push({ id: m, label: m, group: 'Local (installed)', tag: { text: 'LOCAL', color: '#2f7d47', bg: 'rgba(60,160,90,0.14)' } });
        for (const m of cloud) out.push({ id: m.name, label: m.name, meta: sizeStr(m.size), group: 'Ollama Cloud', tag: { text: 'CLOUD', color: '#c96442', bg: 'rgba(201,100,66,0.12)' } });
        for (const m of openrouter) out.push({ id: `openrouter:${m.id}`, label: m.label || m.id, group: 'OpenRouter', tag: { text: 'OR', color: '#7850dc', bg: 'rgba(120,80,220,0.12)' } });
        for (const m of hf) out.push({ id: `hf:${m.id}`, label: m.id, group: 'Hugging Face', tag: { text: 'HF', color: '#b5731a', bg: 'rgba(230,150,30,0.14)' } });
        const q = query.toLowerCase();
        return q ? out.filter((r) => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : out;
    }, [localModels, cloud, openrouter, hf, query]);

    const grouped = useMemo(() => {
        const g: Record<string, Row[]> = {};
        for (const r of rows) (g[r.group] ||= []).push(r);
        return g;
    }, [rows]);

    const pick = async (id: string) => {
        useOllamaStore.getState().setSelectedModel(id);
        try { useOllamaStore.getState().setModelCapability(id, await fetchCapabilities(id)); } catch { /* ignore */ }
        onClose();
    };

    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal cl-mp" onClick={(e) => e.stopPropagation()}>
                <div className="cl-modal__head">
                    <span className="cl-modal__title">Select a model</span>
                    <button className="cl-x" onClick={onClose}>×</button>
                </div>
                <div className="cl-mp__search">
                    <input autoFocus className="cl-input" placeholder="Search local, cloud, OpenRouter, Hugging Face…" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="cl-mp__list">
                    {loading && <div className="cl-empty">Loading catalogs…</div>}
                    {!loading && rows.length === 0 && <div className="cl-empty">No models. Is Ollama running? Add provider keys in Settings.</div>}
                    {Object.entries(grouped).map(([group, gr]) => (
                        <div key={group}>
                            <div className="cl-mp__group">{group} <span style={{ color: 'var(--cl-muted)', fontWeight: 400 }}>({gr.length})</span></div>
                            {gr.slice(0, 60).map((r) => (
                                <div key={r.id} className={`cl-mp__row ${r.id === selected ? 'cl-mp__row--active' : ''}`} onClick={() => pick(r.id)}>
                                    {r.tag && <span className="cl-tagpill" style={{ color: r.tag.color, background: r.tag.bg }}>{r.tag.text}</span>}
                                    <span className="cl-mp__name">{r.label}</span>
                                    {r.meta && <span className="cl-mp__meta">{r.meta}</span>}
                                    {r.id === selected && <span style={{ color: 'var(--cl-accent)', fontSize: 12 }}>✓</span>}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </Overlay>
    );
}

function sizeStr(bytes: number): string {
    if (!bytes) return '';
    const gb = bytes / 1e9;
    return gb >= 1 ? `${gb.toFixed(0)}GB` : `${(bytes / 1e6).toFixed(0)}MB`;
}
