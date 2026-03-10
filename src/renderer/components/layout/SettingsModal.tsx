import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useSettingsStore } from '../../store/settings';

export function SettingsModal({ onClose }: { onClose: () => void }) {
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const setApiKey = useSettingsStore(state => state.setApiKey);
    const [saved, setSaved] = useState(false);

    const handleSaveAndClose = () => {
        setSaved(true);
        setTimeout(() => onClose(), 400); // Visual delay
    };

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <GlassPanel variant="strong" style={{ width: 500, maxHeight: '80vh', overflowY: 'auto', padding: 24, zIndex: 1000, display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: 12 }}>
                    <h2 style={{ fontSize: 18, margin: 0, color: 'var(--text)' }}>IDE Settings</h2>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}>✕</button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <h3 style={{ fontSize: 14, color: 'var(--text)', margin: 0, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>Cloud API Keys</h3>
                    {['gemini', 'claude', 'openai', 'deepseek', 'groq', 'hf'].map(provider => (
                        <div key={provider}>
                            <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>
                                {provider === 'hf' ? 'HuggingFace' : provider} API Key
                            </label>
                            <input
                                type="password"
                                value={apiKeys[provider as keyof typeof apiKeys] || ''}
                                onChange={(e) => setApiKey(provider, e.target.value)}
                                placeholder={provider === 'hf' ? 'Enter HuggingFace token (hf_...)' : `Enter ${provider} key (autosaves)...`}
                                style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.05)', color: 'var(--text)', outline: 'none' }}
                            />
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 10, alignItems: 'center' }}>
                    {saved && <span style={{ color: 'var(--green)', fontSize: 13, fontWeight: 600 }}>Keys Saved! ✓</span>}
                    <button onClick={handleSaveAndClose} style={{ padding: '8px 24px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600 }}>Save & Close</button>
                </div>
            </GlassPanel>
        </div>
    );
}
