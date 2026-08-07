import { Overlay } from './Modal';
import React, { useEffect, useMemo, useState } from 'react';
import type { SessionRecord, Surface } from '../../../shared/agent';
import { useAgentRunStore } from '../../store/agentRun';
import { newChatInCurrentProject, switchSurface, loadSession } from '../../services/agentClient';
import { uiBus } from '../../utils/uiBus';

interface Cmd { id: string; label: string; hint?: string; run: () => void; }

export function CommandPalette({ onClose }: { onClose: () => void }) {
    const surface = useAgentRunStore((s) => s.surface);
    const [query, setQuery] = useState('');
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [active, setActive] = useState(0);

    useEffect(() => { window.vibe.kernel.listSessions(surface).then(setSessions).catch(() => setSessions([])); }, [surface]);

    const base: Cmd[] = useMemo(() => [
        { id: 'new', label: 'New chat', hint: 'Ctrl N', run: () => { newChatInCurrentProject(); onClose(); } },
        { id: 'chat', label: 'Switch to Chat', run: () => { switchSurface('chat' as Surface); onClose(); } },
        { id: 'cowork', label: 'Switch to Cowork', run: () => { switchSurface('cowork' as Surface); onClose(); } },
        { id: 'code', label: 'Switch to Code', run: () => { switchSurface('code' as Surface); onClose(); } },
        { id: 'model', label: 'Browse models', run: () => { uiBus.emit({ t: 'openModel' }); onClose(); } },
        { id: 'skills', label: 'Manage skills', run: () => { uiBus.emit({ t: 'openSettings', section: 'skills' }); onClose(); } },
        { id: 'connectors', label: 'Manage connectors (MCP)', run: () => { uiBus.emit({ t: 'openSettings', section: 'connectors' }); onClose(); } },
        { id: 'schedule', label: 'Scheduled tasks', run: () => { uiBus.emit({ t: 'openSchedule' }); onClose(); } },
        { id: 'projects', label: 'Project settings', run: () => { uiBus.emit({ t: 'openProjects' }); onClose(); } },
        { id: 'settings', label: 'Settings', hint: 'Ctrl ,', run: () => { uiBus.emit({ t: 'openSettings' }); onClose(); } },
    ], [onClose]);

    const sessionCmds: Cmd[] = sessions.map((s) => ({ id: 's:' + s.id, label: s.title || 'Untitled', hint: 'chat', run: () => { loadSession(surface, s.id); onClose(); } }));
    const all = [...base, ...sessionCmds];
    const q = query.toLowerCase();
    const filtered = q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;

    useEffect(() => { setActive(0); }, [query]);

    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal" style={{ width: 560, maxWidth: '92vw', maxHeight: '70vh' }} onClick={(e) => e.stopPropagation()}>
                <div className="cl-mp__search" style={{ borderBottom: '0.5px solid var(--cl-border-soft)' }}>
                    <input autoFocus className="cl-input" placeholder="Type a command or search chats…" value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                            else if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.run(); }
                            else if (e.key === 'Escape') onClose();
                        }} />
                </div>
                <div className="cl-mp__list">
                    {filtered.map((c, i) => (
                        <div key={c.id} className={`cl-mp__row ${i === active ? 'cl-mp__row--active' : ''}`} onMouseEnter={() => setActive(i)} onClick={c.run}>
                            <span className="cl-mp__name">{c.label}</span>
                            {c.hint && <span className="cl-mp__meta">{c.hint}</span>}
                        </div>
                    ))}
                    {filtered.length === 0 && <div className="cl-empty">No matches</div>}
                </div>
            </div>
        </Overlay>
    );
}
