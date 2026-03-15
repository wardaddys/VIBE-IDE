import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useSettingsStore } from '../../store/settings';

function ObsidianStatusIndicator({ apiKey }: { apiKey: string }) {
    const [status, setStatus] = React.useState<'unknown' | 'connected' | 'disconnected'>('unknown');

    React.useEffect(() => {
        if (!apiKey) { setStatus('unknown'); return; }
        window.vibe.obsidianPing(apiKey).then(ok => {
            setStatus(ok ? 'connected' : 'disconnected');
        }).catch(() => setStatus('disconnected'));
    }, [apiKey]);

    if (status === 'unknown') return null;

    return (
        <div className="obsidian-status">
            <div className={`obsidian-status__dot obsidian-status__dot--${status}`} />
            {status === 'connected'
                ? 'Obsidian connected — vault ready'
                : 'Obsidian not detected — is the plugin running?'
            }
        </div>
    );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const setApiKey = useSettingsStore(state => state.setApiKey);
    const [saved, setSaved] = useState(false);

    const handleSaveAndClose = () => {
        setSaved(true);
        setTimeout(() => onClose(), 400);
    };

    return (
        <div className="settings-overlay">
            <div onClick={onClose} className="settings-backdrop" />
            <GlassPanel variant="strong" className="settings-panel">
                <div className="settings-header">
                    <h2 className="settings-header__title">IDE Settings</h2>
                    <button onClick={onClose} className="settings-header__close">✕</button>
                </div>

                <div className="settings-section">
                    <h3 className="settings-section__title">Cloud API Keys</h3>
                    {['gemini', 'claude', 'openai', 'deepseek', 'groq', 'hf'].map(provider => (
                        <div key={provider} className="settings-field">
                            <label className="settings-field__label">
                                {provider === 'hf' ? 'HuggingFace' : provider} API Key
                            </label>
                            <input
                                type="password"
                                value={apiKeys[provider as keyof typeof apiKeys] || ''}
                                onChange={(e) => setApiKey(provider, e.target.value)}
                                placeholder={provider === 'hf' ? 'Enter HuggingFace token (hf_...)' : `Enter ${provider} key (autosaves)...`}
                                className="settings-field__input"
                            />
                        </div>
                    ))}
                </div>

                {/* ─── Obsidian Integration Section ─── */}
                <div className="settings-section settings-section--obsidian">
                    <h3 className="settings-section__title">Obsidian Integration</h3>

                    <div className="settings-info-box">
                        Install the <strong>Local REST API</strong> plugin in
                        Obsidian, then paste your API key below. VIBE will
                        automatically create project notes and log all agent
                        activity to your vault.
                    </div>

                    <div className="settings-field">
                        <label className="settings-field__label">
                            Obsidian Local REST API Key
                        </label>
                        <input
                            type="password"
                            value={apiKeys.obsidian || ''}
                            onChange={e => setApiKey('obsidian', e.target.value)}
                            placeholder="Paste API key from Obsidian plugin settings..."
                            className="settings-field__input"
                        />
                    </div>

                    <ObsidianStatusIndicator apiKey={apiKeys.obsidian || ''} />
                </div>

                <div className="settings-footer">
                    {saved && <span className="settings-footer__saved">Keys Saved! ✓</span>}
                    <button onClick={handleSaveAndClose} className="settings-footer__save-btn">Save & Close</button>
                </div>
            </GlassPanel>
        </div>
    );
}
