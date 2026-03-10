import React, { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useHFStore } from '../../store/huggingface';
import { useSettingsStore } from '../../store/settings';

interface HFModel {
    id: string;
    likes: number;
    downloads: number;
    pipeline_tag: string;
    tags: string[];
}

interface Props { onClose: () => void; }

export function HuggingFacePicker({ onClose }: Props) {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<HFModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { pinnedModels, pinModel, unpinModel } = useHFStore();
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const searchRef = useRef<any>(null);

    const searchModels = async (query: string) => {
        setLoading(true);
        setError('');
        try {
            const params = new URLSearchParams({
                search: query || 'instruct',
                filter: 'text-generation',
                sort: 'likes',
                direction: '-1',
                limit: '20',
                full: 'false',
                config: 'false',
            });
            const headers: any = {};
            if (apiKeys?.hf) headers['Authorization'] = `Bearer ${apiKeys.hf}`;
            const res = await fetch(`https://huggingface.co/api/models?${params}`, { headers });
            if (!res.ok) throw new Error(`HF API error ${res.status}`);
            const data = await res.json();
            setResults(data);
        } catch (e: any) {
            setError(e.message || 'Search failed');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    // Search on mount with empty query to show popular models
    useEffect(() => {
        searchModels('');
    }, []);

    // Debounced search on input
    useEffect(() => {
        if (searchRef.current) clearTimeout(searchRef.current);
        searchRef.current = setTimeout(() => {
            searchModels(search);
        }, 500);
        return () => clearTimeout(searchRef.current);
    }, [search]);

    const isPinned = (id: string) => pinnedModels.some(m => m.id === id);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <GlassPanel variant="strong" style={{ width: 580, maxHeight: '82vh', display: 'flex', flexDirection: 'column', zIndex: 1000 }}>
                {/* Header */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                                🤗 HuggingFace Models
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Live search — add models to your selector
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}>✕</button>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search models (e.g. mistral, llama, coder…)"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '9px 36px 9px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.9)',
                                fontSize: 13,
                                color: 'var(--text)',
                                outline: 'none',
                            }}
                        />
                        {loading && (
                            <div style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent',
                                borderRadius: '50%', animation: 'spin 1s linear infinite'
                            }} />
                        )}
                    </div>
                    {error && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--error)' }}>⚠ {error}</div>}
                </div>

                {/* Results */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {results.length === 0 && !loading && (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            {error ? 'Search failed — check your connection' : 'No models found'}
                        </div>
                    )}
                    {results.map(model => {
                        const pinned = isPinned(model.id);
                        return (
                            <div key={model.id} style={{
                                padding: '12px 24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--border-light)',
                                background: pinned ? 'rgba(0,102,255,0.03)' : 'transparent',
                                gap: 12,
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {model.id}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            ❤ {(model.likes || 0).toLocaleString()}
                                        </span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            ↓ {(model.downloads || 0).toLocaleString()}
                                        </span>
                                        {model.pipeline_tag && (
                                            <span style={{
                                                fontSize: 9, padding: '1px 6px', borderRadius: 4,
                                                background: 'var(--accent-light)', color: 'var(--accent)',
                                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5
                                            }}>
                                                {model.pipeline_tag}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => pinned
                                        ? unpinModel(model.id)
                                        : pinModel({ id: model.id, name: model.id.split('/').pop() || model.id })
                                    }
                                    style={{
                                        padding: '5px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        border: pinned ? '1px solid var(--error)' : '1px solid var(--accent)',
                                        background: pinned ? 'rgba(224,48,80,0.06)' : 'var(--accent-light)',
                                        color: pinned ? 'var(--error)' : 'var(--accent)',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        transition: 'all 0.15s',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {pinned ? 'Remove' : '+ Add'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid var(--border-light)',
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {pinnedModels.length} model{pinnedModels.length !== 1 ? 's' : ''} added
                        {!apiKeys?.hf && ' · Add HF token in Settings for more results'}
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '7px 20px',
                            background: 'var(--accent-gradient)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13
                        }}
                    >
                        Done
                    </button>
                </div>
            </GlassPanel>
        </div>
    );
}
