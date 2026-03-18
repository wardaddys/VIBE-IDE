import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { useOllamaStore } from '../../store/ollama';

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
    const backgroundModels = useSettingsStore(state => state.backgroundModels);
    const setBackgroundModel = useSettingsStore(state => state.setBackgroundModel);
    const projectPath = useUIStore(state => state.projectPath);
    // Same source as ModelSelector — populated by App.tsx on startup
    const ollamaModels = useOllamaStore(state => state.models);
    const [saved, setSaved] = useState(false);

    const handleSaveAndClose = () => {
        if (apiKeys.obsidian) {
            window.vibe.setObsidianKey(apiKeys.obsidian).catch(() => {});
        }
        if (projectPath) {
            window.vibe.startBackgroundAgents(projectPath, {
                obsidianKey: apiKeys.obsidian || undefined,
                apiKeys,
                collectorModel: backgroundModels.collector || undefined,
                reviewerModel: backgroundModels.reviewer || undefined,
            }).catch(() => {});
        }
        setSaved(true);
        setTimeout(() => onClose(), 400);
    };

    return (
        <div className="settings-overlay">
            <div onClick={onClose} className="settings-backdrop" />
            <GlassPanel variant="strong" className="settings-panel" style={{ overflowY: 'auto', maxHeight: '80vh' }}>
                <div className="settings-header">
                    <h2 className="settings-header__title">IDE Settings</h2>
                    <button onClick={onClose} className="settings-header__close">✕</button>
                </div>

                <div className="settings-section">
                    <h3 className="settings-section__title">Cloud API Keys</h3>
                    {['gemini', 'claude', 'openai', 'deepseek', 'groq', 'openrouter', 'hf'].map(provider => (
                        <div key={provider} className="settings-field">
                            <label className="settings-field__label">
                                {(provider === 'hf' ? 'HuggingFace' : provider === 'openrouter' ? 'OpenRouter' : provider)} API Key
                            </label>
                            <input
                                type="password"
                                value={apiKeys[provider as keyof typeof apiKeys] || ''}
                                onChange={(e) => setApiKey(provider, e.target.value)}
                                placeholder={
                                    provider === 'hf'
                                        ? 'Enter HuggingFace token (hf_...)'
                                        : provider === 'openrouter'
                                            ? 'Enter OpenRouter key (sk-or-...)'
                                            : `Enter ${provider} key (autosaves)...`
                                }
                                className="settings-field__input"
                            />
                        </div>
                    ))}
                </div>

                <div className="settings-section">
                    <h3 className="settings-section__title">Background Agent Models</h3>
                    <div className="settings-info-box">
                        Type any Ollama model name (e.g. <code>llama3.2</code>, <code>glm-5:cloud</code>).
                        Detected local models appear as suggestions.
                    </div>

                    {/* datalist shares the same detected models as the ModelSelector */}
                    <datalist id="ollama-models-list">
                        {ollamaModels.map((m) => (
                            <option key={m} value={m} />
                        ))}
                    </datalist>

                    <div className="settings-field">
                        <label className="settings-field__label">Collector Model</label>
                        <input
                            type="text"
                            list="ollama-models-list"
                            value={backgroundModels.collector}
                            onChange={(e) => setBackgroundModel('collector', e.target.value)}
                            placeholder="e.g. llama3.2 or glm-5:cloud"
                            className="settings-field__input"
                        />
                    </div>

                    <div className="settings-field">
                        <label className="settings-field__label">Reviewer Model</label>
                        <input
                            type="text"
                            list="ollama-models-list"
                            value={backgroundModels.reviewer}
                            onChange={(e) => setBackgroundModel('reviewer', e.target.value)}
                            placeholder="e.g. llama3.2 or glm-5:cloud"
                            className="settings-field__input"
                        />
                    </div>

                    {ollamaModels.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            {ollamaModels.length} local model{ollamaModels.length !== 1 ? 's' : ''} detected: {ollamaModels.join(', ')}
                        </div>
                    )}
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
