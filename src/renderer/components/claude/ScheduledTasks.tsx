import { Overlay } from './Modal';
import React, { useEffect, useState } from 'react';
import type { ScheduledTask, Surface } from '../../../shared/agent';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';

const PRESETS: { label: string; cron: string }[] = [
    { label: 'Every morning (8am)', cron: '0 8 * * *' },
    { label: 'Hourly', cron: '0 * * * *' },
    { label: 'Every 15 min', cron: '*/' + '15 * * * *' },
    { label: 'Weekdays 9am', cron: '0 9 * * 1-5' },
    { label: 'Weekly (Mon 9am)', cron: '0 9 * * 1' },
];

export function ScheduledTasks({ onClose }: { onClose: () => void }) {
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [cron, setCron] = useState(PRESETS[0].cron);
    const [surface, setSurface] = useState<Surface>('cowork');
    const model = useOllamaStore((s) => s.selectedModel);
    const projectRoot = useUIStore((s) => s.projectPath);

    const load = async () => setTasks(await window.vibe.kernel.scheduleList().catch(() => []));
    useEffect(() => { load(); }, []);

    const add = async () => {
        if (!prompt.trim() || !model) return;
        await window.vibe.kernel.scheduleAdd({ title: title || prompt.slice(0, 40), prompt, cron, surface, model, projectRoot, enabled: true });
        setTitle(''); setPrompt(''); load();
    };
    const toggle = async (t: ScheduledTask) => { await window.vibe.kernel.scheduleUpdate(t.id, { enabled: !t.enabled }); load(); };
    const remove = async (t: ScheduledTask) => { await window.vibe.kernel.scheduleRemove(t.id); load(); };

    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal cl-set" style={{ width: 720, height: '80vh', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                <div className="cl-modal__head"><span className="cl-modal__title">Scheduled tasks</span><button className="cl-x" onClick={onClose}>×</button></div>
                <div className="cl-set__body">
                    <div className="cl-set__sub">Run a prompt automatically on a schedule. Results appear as a new conversation.</div>
                    <div className="cl-field"><label className="cl-field__label">Title</label><input className="cl-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning briefing" /></div>
                    <div className="cl-field"><label className="cl-field__label">Prompt</label><textarea className="cl-input" style={{ height: 70, padding: 10 }} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Summarize my open PRs and today's calendar" /></div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div className="cl-field" style={{ flex: 1 }}><label className="cl-field__label">When</label>
                            <select className="cl-input" value={cron} onChange={(e) => setCron(e.target.value)}>{PRESETS.map((p) => <option key={p.cron} value={p.cron}>{p.label}</option>)}</select>
                        </div>
                        <div className="cl-field" style={{ width: 150 }}><label className="cl-field__label">Mode</label>
                            <select className="cl-input" value={surface} onChange={(e) => setSurface(e.target.value as Surface)}><option value="chat">Chat</option><option value="cowork">Cowork</option><option value="code">Code</option><option value="design">Design</option></select>
                        </div>
                    </div>
                    <button className="cl-pill-btn cl-pill-btn--on" onClick={add} style={{ marginBottom: 20 }}>Add task</button>

                    {tasks.length === 0 && <div className="cl-empty">No scheduled tasks yet.</div>}
                    {tasks.map((t) => (
                        <div className="cl-catalog-row" key={t.id}>
                            <div className="cl-catalog-row__main">
                                <div className="cl-catalog-row__name">{t.title} <span className="cl-transport" style={{ color: '#7850dc', background: 'rgba(120,80,220,0.12)' }}>{t.cron || t.fireAt}</span></div>
                                <div className="cl-catalog-row__desc">{t.prompt}</div>
                            </div>
                            <button className="cl-pill-btn" onClick={() => toggle(t)}>{t.enabled ? 'Pause' : 'Resume'}</button>
                            <button className="cl-pill-btn cl-pill-btn--danger" onClick={() => remove(t)} style={{ marginLeft: 6 }}>Delete</button>
                        </div>
                    ))}
                </div>
            </div>
        </Overlay>
    );
}
