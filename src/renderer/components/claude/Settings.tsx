import { Overlay } from './Modal';
import React, { useEffect, useState } from 'react';
import type { McpRegistryEntry, SkillCatalogEntry } from '../../../shared/agent';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { useOllamaStore } from '../../store/ollama';
import { ModelPicker } from './ModelPicker';
import { getFallbackCapabilities } from '../../utils/capabilities';

type Section = 'account' | 'appearance' | 'providers' | 'models' | 'connectors' | 'skills';
const NAV: { id: Section; label: string; icon: string }[] = [
    { id: 'account', label: 'Account', icon: '◐' },
    { id: 'appearance', label: 'Appearance', icon: '☀' },
    { id: 'providers', label: 'API keys', icon: '⚿' },
    { id: 'models', label: 'Models', icon: '◇' },
    { id: 'connectors', label: 'Connectors', icon: '⇄' },
    { id: 'skills', label: 'Skills', icon: '✦' },
];

export function Settings({ onClose, initialSection }: { onClose: () => void; initialSection?: Section }) {
    const [section, setSection] = useState<Section>(initialSection || 'account');
    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal cl-set" onClick={(e) => e.stopPropagation()}>
                <div className="cl-set__nav">
                    <div style={{ fontSize: 15, fontWeight: 600, padding: '4px 12px 12px' }}>Settings</div>
                    {NAV.map((n) => (
                        <button key={n.id} className={`cl-set__navbtn ${section === n.id ? 'cl-set__navbtn--active' : ''}`} onClick={() => setSection(n.id)}>
                            <span style={{ width: 16, textAlign: 'center' }}>{n.icon}</span>{n.label}
                        </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <button className="cl-set__navbtn" onClick={onClose}>Close</button>
                </div>
                <div className="cl-set__body">
                    {section === 'account' && <Account />}
                    {section === 'appearance' && <Appearance />}
                    {section === 'providers' && <Providers />}
                    {section === 'models' && <Models />}
                    {section === 'connectors' && <Connectors />}
                    {section === 'skills' && <Skills />}
                </div>
            </div>
        </Overlay>
    );
}

function Account() {
    const connected = useUIStore((s) => s.ollamaConnected);
    return (
        <>
            <div className="cl-set__h">Account</div>
            <div className="cl-set__sub">VIBE runs on your local Ollama plus any cloud providers you configure.</div>
            <div className="cl-field">
                <span className="cl-field__label">Ollama</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#4a9d6b' : '#c96442' }} />
                    {connected ? 'Connected to local Ollama' : 'Ollama not detected — start it with `ollama serve`'}
                </div>
                <div className="cl-field__hint">For cloud models, sign in once with <code>ollama signin</code>, then add your API key under API keys → Ollama Cloud.</div>
            </div>
            <DataLocation />
        </>
    );
}

/* Where VIBE keeps projects — change or MOVE it. The pointer is stored
   update-proof in userData; the data lives where you choose. */
function DataLocation() {
    const [path, setPath] = useState<string>('…');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const load = () => window.vibe.dataHome.get().then((d) => setPath(d.path)).catch(() => {});
    useEffect(() => { load(); }, []);
    const change = async (move: boolean) => {
        setMsg(null);
        const p = await window.vibe.dataHome.pick().catch(() => null);
        if (!p) return;
        setBusy(true);
        const res = await window.vibe.dataHome.set(p, move);
        setBusy(false);
        if (res.ok) { setMsg(move ? 'Moved — existing projects were relocated here.' : 'Updated — new work will be created here.'); load(); }
        else setMsg(res.error || 'Could not update the location.');
    };
    return (
        <div className="cl-field">
            <span className="cl-field__label">Data location</span>
            <input className="cl-input" readOnly value={path} style={{ fontFamily: 'monospace', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="cl-btn" disabled={busy} onClick={() => change(false)}>Change…</button>
                <button className="cl-btn" disabled={busy} onClick={() => change(true)} title="Pick a new folder and MOVE existing projects into it">{busy ? 'Working…' : 'Move data…'}</button>
            </div>
            <div className="cl-field__hint">Your projects live here. It's outside the app, so updates never wipe it.</div>
            {msg && <div className="cl-field__hint" style={{ color: 'var(--cl-accent)' }}>{msg}</div>}
        </div>
    );
}

/* Light/dark theme + where the runtime log lives. The theme flips
   <html data-theme>, Monaco, and xterm; the log file is where every error,
   crash, and renderer exception lands — the first thing to check when
   something goes wrong. */
function Appearance() {
    const theme = useSettingsStore((s) => s.theme);
    const setTheme = useSettingsStore((s) => s.setTheme);
    const [logPath, setLogPath] = useState<string>('…');
    useEffect(() => { window.vibe.getRuntimeLogPath?.().then(setLogPath).catch(() => setLogPath('unavailable')); }, []);
    return (
        <>
            <div className="cl-set__h">Appearance</div>
            <div className="cl-set__sub">How VIBE looks. Applies instantly and is remembered across restarts.</div>
            <div className="cl-field">
                <span className="cl-field__label">Theme</span>
                <div className="cl-seg" style={{ maxWidth: 260 }}>
                    <button className={`cl-seg__btn ${theme === 'dark' ? 'cl-seg__btn--active' : ''}`} onClick={() => setTheme('dark')}>Dark</button>
                    <button className={`cl-seg__btn ${theme === 'light' ? 'cl-seg__btn--active' : ''}`} onClick={() => setTheme('light')}>Light</button>
                </div>
            </div>
            <div className="cl-field">
                <span className="cl-field__label">Runtime log</span>
                <input className="cl-input" readOnly value={logPath} style={{ fontFamily: 'monospace', fontSize: 12 }} />
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="cl-btn" onClick={() => window.vibe.openRuntimeLog?.()}>Open logs folder</button>
                </div>
                <div className="cl-field__hint">Every error, crash, and agent action is appended here. Open this file when something goes wrong.</div>
            </div>
        </>
    );
}

const PROVIDERS: { id: string; label: string; hint: string; link?: string }[] = [
    { id: 'ollama', label: 'Ollama Cloud', hint: 'Enables cloud models + web search. Create a key at ollama.com/settings/keys.' },
    { id: 'claude', label: 'Anthropic (Claude)', hint: 'sk-ant-…' },
    { id: 'openai', label: 'OpenAI', hint: 'sk-…' },
    { id: 'gemini', label: 'Google Gemini', hint: 'AIza…' },
    { id: 'deepseek', label: 'DeepSeek', hint: '' },
    { id: 'groq', label: 'Groq', hint: '' },
    { id: 'openrouter', label: 'OpenRouter', hint: 'sk-or-…' },
    { id: 'hf', label: 'Hugging Face', hint: 'hf_…' },
    { id: 'ofox', label: 'OfoxAI (Unified API Gateway)', hint: 'Bearer API key for OfoxAI gateway (app.ofox.ai).' },
    { id: 'omni', label: 'OmniRoute (AI gateway)', hint: 'Optional bearer key for your OmniRoute gateway. Leave blank for a keyless local install.' },
    { id: 'obsidian', label: 'Obsidian Local REST API', hint: 'From the Obsidian plugin settings.' },
];

function Providers() {
    const apiKeys = useSettingsStore((s) => s.apiKeys);
    const setApiKey = useSettingsStore((s) => s.setApiKey);
    return (
        <>
            <div className="cl-set__h">API keys</div>
            <div className="cl-set__sub">Keys are stored locally on your machine and autosave as you type.</div>
            {PROVIDERS.map((p) => (
                <div className="cl-field" key={p.id}>
                    <label className="cl-field__label">{p.label}</label>
                    <input type="password" className="cl-input"
                        value={(apiKeys as any)[p.id] || ''}
                        onChange={(e) => setApiKey(p.id, e.target.value)}
                        placeholder={`Enter ${p.label} key…`} />
                    {p.hint && <div className="cl-field__hint">{p.hint}</div>}
                    {p.id === 'ofox' && <OfoxBaseField />}
                    {p.id === 'omni' && <OmniBaseField />}
                </div>
            ))}
        </>
    );
}

function OfoxBaseField() {
    const base = useSettingsStore((s) => s.apiKeys.ofoxBase);
    const setApiKey = useSettingsStore((s) => s.setApiKey);
    return (
        <div style={{ marginTop: 8 }}>
            <label className="cl-field__label">OfoxAI Base URL</label>
            <input className="cl-input" value={base || ''}
                onChange={(e) => setApiKey('ofoxBase', e.target.value)}
                placeholder="https://api.ofox.ai/v1" />
            <div className="cl-field__hint">The OfoxAI OpenAI-compatible endpoint (include <code>/v1</code>). Default is <code>https://api.ofox.ai/v1</code> (or mirror <code>https://api.ofox.io/v1</code>).</div>
        </div>
    );
}

/* OmniRoute's endpoint is user-configurable (self-hosted gateway), so it needs
   a base-URL field alongside the optional key. Empty falls back to the local
   default the `omniroute` CLI serves on. */
function OmniBaseField() {
    const base = useSettingsStore((s) => s.apiKeys.omniBase);
    const setApiKey = useSettingsStore((s) => s.setApiKey);
    return (
        <div style={{ marginTop: 8 }}>
            <label className="cl-field__label">OmniRoute base URL</label>
            <input className="cl-input" value={base || ''}
                onChange={(e) => setApiKey('omniBase', e.target.value)}
                placeholder="http://localhost:20128/v1" />
            <div className="cl-field__hint">The gateway's OpenAI-compatible endpoint (include <code>/v1</code>). Whatever it serves shows up under “OmniRoute” in the model picker. Start it with <code>omniroute</code>.</div>
        </div>
    );
}

function Models() {
    const selected = useOllamaStore((s) => s.selectedModel);
    const models = useOllamaStore((s) => s.models);
    const cloudNames = useOllamaStore((s) => s.cloudModelNames);
    const caps = useOllamaStore((s) => s.modelCapabilities);
    const visionModel = useSettingsStore((s) => s.visionModel);
    const setVisionModel = useSettingsStore((s) => s.setVisionModel);
    const [pick, setPick] = useState(false);

    const allModels = Array.from(new Set([...models, ...cloudNames]));
    const visionModels = allModels.filter((m) => caps[m]?.vision || caps[m]?.image || getFallbackCapabilities(m).vision);

    return (
        <>
            <div className="cl-set__h">Models</div>
            <div className="cl-set__sub">Choose the default model. Local Ollama models, live Ollama Cloud, OpenRouter, and Hugging Face are all searchable.</div>
            <div className="cl-field">
                <label className="cl-field__label">Default model</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{selected || 'None selected'}</span>
                    <button className="cl-pill-btn" onClick={() => setPick(true)}>Browse models</button>
                </div>
            </div>
            <div className="cl-field">
                <label className="cl-field__label">Vision fallback model</label>
                <select className="cl-input" value={visionModel} onChange={(e) => setVisionModel(e.target.value)}>
                    <option value="">Auto — first vision-capable model detected</option>
                    {allModels.map((m) => {
                        const v = !!(caps[m]?.vision || caps[m]?.image || getFallbackCapabilities(m).vision);
                        return <option key={m} value={m}>{m}{v ? '  · vision' : ''}</option>;
                    })}
                </select>
                <div className="cl-field__hint">
                    When you attach an image and your main model can’t see, this model describes it and hands the text to your main model. Pick <em>any</em> model you know can see — auto-detection can miss newer cloud models, so override it here.{' '}
                    {visionModels.length
                        ? `Auto-detected: ${visionModels.join(', ')}.`
                        : 'None auto-detected — set one manually (a Gemma 3/4, Llava, Qwen-VL, MiniCPM-V, Pixtral, or Claude/GPT-4o model).'}
                </div>
            </div>
            {pick && <ModelPicker onClose={() => setPick(false)} />}
        </>
    );
}

function Connectors() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<McpRegistryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const search = async (q: string) => {
        setLoading(true);
        const r = await window.vibe.kernel.mcpSearch(q).catch(() => []);
        setResults(r);
        setLoading(false);
    };
    useEffect(() => { search(''); }, []);
    useEffect(() => { const t = setTimeout(() => search(query), 350); return () => clearTimeout(t); }, [query]);

    const add = async (e: McpRegistryEntry) => {
        if (!e.install) return;
        setBusy(e.name);
        const key = e.name.split('/').pop() || e.name;
        await window.vibe.kernel.mcpAdd(key, e.install as any).catch(() => {});
        await search(query);
        setBusy(null);
    };
    const remove = async (e: McpRegistryEntry) => {
        setBusy(e.name);
        await window.vibe.kernel.mcpRemove(e.name.split('/').pop() || e.name).catch(() => {});
        await search(query);
        setBusy(null);
    };

    return (
        <>
            <div className="cl-set__h">Connectors (MCP)</div>
            <div className="cl-set__sub">Live from the official Model Context Protocol registry. Add a server and its tools become available to the agent.</div>
            <input className="cl-input" style={{ marginBottom: 14 }} placeholder="Search connectors (github, filesystem, slack…)" value={query} onChange={(e) => setQuery(e.target.value)} />
            {loading && <div className="cl-empty">Loading registry…</div>}
            {!loading && results.length === 0 && <div className="cl-empty">No connectors found.</div>}
            {results.map((e) => (
                <div className="cl-catalog-row" key={e.name + e.version}>
                    <div className="cl-catalog-row__main">
                        <div className="cl-catalog-row__name">
                            {e.title}
                            <span className="cl-transport" style={{ color: e.transport === 'stdio' ? '#2f7d47' : '#7850dc', background: e.transport === 'stdio' ? 'rgba(60,160,90,0.14)' : 'rgba(120,80,220,0.12)' }}>
                                {e.transport === 'remote' ? 'remote' : 'local'}
                            </span>
                        </div>
                        <div className="cl-catalog-row__desc">{e.description}</div>
                    </div>
                    {e.installed
                        ? <button className="cl-pill-btn cl-pill-btn--danger" disabled={busy === e.name} onClick={() => remove(e)}>Remove</button>
                        : <button className="cl-pill-btn cl-pill-btn--on" disabled={!e.install || busy === e.name} onClick={() => add(e)}>{busy === e.name ? '…' : 'Add'}</button>}
                </div>
            ))}
        </>
    );
}

function Skills() {
    const [items, setItems] = useState<SkillCatalogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const load = async () => { setLoading(true); setItems(await window.vibe.kernel.skillsCatalog().catch(() => [])); setLoading(false); };
    useEffect(() => { load(); }, []);

    const install = async (name: string) => { setBusy(name); await window.vibe.kernel.skillsInstall(name).catch(() => {}); await load(); setBusy(null); };
    const remove = async (name: string) => { setBusy(name); await window.vibe.kernel.skillsRemove(name).catch(() => {}); await load(); setBusy(null); };

    return (
        <>
            <div className="cl-set__h">Skills</div>
            <div className="cl-set__sub">Live from Anthropic's public skills library. Installed skills are auto-loaded and callable by the agent.</div>
            {loading && <div className="cl-empty">Loading skills…</div>}
            {!loading && items.length === 0 && <div className="cl-empty">Couldn't reach the skills library.</div>}
            {items.map((s) => (
                <div className="cl-catalog-row" key={s.name}>
                    <div className="cl-catalog-row__main">
                        <div className="cl-catalog-row__name">{s.name}</div>
                        <div className="cl-catalog-row__desc">{s.description || 'No description'}</div>
                    </div>
                    {s.installed
                        ? <button className="cl-pill-btn cl-pill-btn--danger" disabled={busy === s.name} onClick={() => remove(s.name)}>Remove</button>
                        : <button className="cl-pill-btn cl-pill-btn--on" disabled={busy === s.name} onClick={() => install(s.name)}>{busy === s.name ? '…' : 'Install'}</button>}
                </div>
            ))}
        </>
    );
}
