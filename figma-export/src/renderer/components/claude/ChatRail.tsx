import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectRecord, Surface, SessionRecord } from '../../../shared/agent';
import { useAgentRunStore } from '../../store/agentRun';
import { useUIStore } from '../../store/ui';
import { switchSurface, newChat, newChatForProject, newChatInCurrentProject, loadSession } from '../../services/agentClient';
import { pickFolder } from '../../store/folderPicker';
import { uiBus } from '../../utils/uiBus';

// The four IDE surfaces. Same kernel, different tool set + posture + layout.
const SURFACES: { id: Surface; label: string }[] = [
    { id: 'chat', label: 'Chat' }, { id: 'cowork', label: 'Cowork' }, { id: 'code', label: 'Code' }, { id: 'design', label: 'Design' },
];

function timeAgo(iso: string): string {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(s) || s < 0) return '';
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
}

export function ChatRail() {
    const surface = useAgentRunStore((s) => s.surface);
    const activeSession = useAgentRunStore((s) => s.sessions[surface]);
    const items = useAgentRunStore((s) => s.items);
    const projectPath = useUIStore((s) => s.projectPath);
    const ollamaConnected = useUIStore((s) => s.ollamaConnected);
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [query, setQuery] = useState('');

    const refresh = async () => {
        try { setProjects(await window.vibe.kernel.listProjects(surface)); } catch { setProjects([]); }
    };
    useEffect(() => { refresh(); }, [surface, items.length, activeSession]);

    // Expand the current project and the project of the active session so the
    // user always sees where they are.
    useEffect(() => {
        const next: Record<string, boolean> = { ...expanded };
        let changed = false;
        const ensureExpanded = (root: string | null) => {
            const key = root ?? '__none__';
            if (!next[key]) { next[key] = true; changed = true; }
        };
        if (projectPath) ensureExpanded(projectPath);
        const activeProject = projects.find((p) => p.sessions.some((s) => s.id === activeSession));
        if (activeProject) ensureExpanded(activeProject.root);
        if (changed) setExpanded(next);
    }, [activeSession, projects, projectPath]);

    const openFolder = async () => {
        const p = await pickFolder();
        if (p) { await newChatForProject(p); refresh(); }
    };
    const folderName = (p: string | null | undefined) => (p ? p.split(/[/\\]/).filter(Boolean).pop() : null);
    const rename = async (s: SessionRecord) => {
        const t = prompt('Rename conversation', s.title); if (t != null) { await window.vibe.kernel.renameSession(s.id, t); refresh(); }
    };
    const del = async (s: SessionRecord) => {
        await window.vibe.kernel.deleteSession(s.id);
        if (s.id === activeSession) newChatInCurrentProject();
        refresh();
    };

    const filtered = useMemo(() => {
        if (!query) return projects;
        const q = query.toLowerCase();
        return projects
            .map((p) => ({ ...p, sessions: p.sessions.filter((s) => (s.title || '').toLowerCase().includes(q)) }))
            .filter((p) => p.sessions.length > 0 || (p.name || '').toLowerCase().includes(q));
    }, [projects, query]);

    const projectName = projectPath ? projectPath.split(/[/\\]/).pop() : null;

    return (
        <div className="cl-rail">
            <div className="cl-rail__top">
                <button className="cl-newchat" onClick={() => { newChatInCurrentProject(); refresh(); }} title={projectPath ? `New chat in ${folderName(projectPath)}` : 'New chat'}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New chat
                </button>
                <div className="cl-seg">
                    {SURFACES.map((s) => (
                        <button key={s.id} className={`cl-seg__btn ${surface === s.id ? 'cl-seg__btn--active' : ''}`} onClick={() => switchSurface(s.id)}>{s.label}</button>
                    ))}
                </div>
                <input className="cl-input" style={{ height: 32, fontSize: 12.5 }} placeholder="Search projects & chats…" value={query} onChange={(e) => setQuery(e.target.value)} />
                {!projectPath && (
                    <div className="cl-rail__hint">
                        <button className="cl-rail__hint-link" onClick={openFolder}>Open a project folder</button> to keep chats attached.
                    </div>
                )}
            </div>

            <div className="cl-rail__label">Projects</div>
            <div className="cl-rail__list">
                {filtered.length === 0 && (
                    <div style={{ padding: '6px 14px', fontSize: 12, color: 'var(--cl-muted)' }}>{query ? 'No matches' : 'No projects yet'}</div>
                )}
                {filtered.map((project) => (
                    <ProjectNode
                        key={projectKey(project)}
                        project={project}
                        isExpanded={!!expanded[projectKey(project)]}
                        activeSession={activeSession}
                        currentProjectPath={projectPath}
                        onToggle={() => setExpanded((prev) => ({ ...prev, [projectKey(project)]: !prev[projectKey(project)] }))}
                        onActivate={() => { newChatForProject(project.root); refresh(); }}
                        onNewChat={() => { newChatForProject(project.root); refresh(); }}
                        onLoad={(sess) => loadSession(surface, sess.id)}
                        onRename={rename}
                        onDelete={del}
                    />
                ))}
            </div>

            <div className="cl-rail__foot">
                <button onClick={openFolder} title="Open project folder" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{projectName ? `📁 ${projectName}` : '📁 Open folder'}</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => uiBus.emit({ t: 'openSchedule' })} title="Scheduled tasks">⏱</button>
                    <button onClick={() => uiBus.emit({ t: 'openProjects' })} title="Project settings">◇</button>
                    <span title={ollamaConnected ? 'Ollama connected' : 'Ollama offline'} style={{ width: 7, height: 7, borderRadius: '50%', background: ollamaConnected ? '#4a9d6b' : '#c96442' }} />
                    <button onClick={() => uiBus.emit({ t: 'openSettings' })} title="Settings">⚙</button>
                </div>
            </div>
        </div>
    );
}

function projectKey(p: ProjectRecord): string {
    return p.root ?? '__none__';
}

interface ProjectNodeProps {
    project: ProjectRecord;
    isExpanded: boolean;
    activeSession?: string;
    currentProjectPath: string | null;
    onToggle: () => void;
    onActivate: () => void;
    onNewChat: () => void;
    onLoad: (s: SessionRecord) => void;
    onRename: (s: SessionRecord) => void;
    onDelete: (s: SessionRecord) => void;
}

function ProjectNode({ project, isExpanded, activeSession, currentProjectPath, onToggle, onActivate, onNewChat, onLoad, onRename, onDelete }: ProjectNodeProps) {
    const isCurrentProject = currentProjectPath === project.root;
    const activateAndToggle = () => {
        if (!isCurrentProject) onActivate();
        onToggle();
    };
    return (
        <div className={`cl-proj ${isCurrentProject ? 'cl-proj--current' : ''}`}>
            <div className="cl-proj__head">
                <button
                    className={`cl-proj__toggle ${isCurrentProject ? 'cl-proj__toggle--active' : ''}`}
                    onClick={activateAndToggle}
                    title={project.root ?? 'Chats not attached to a project'}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
                >
                    <span style={{ fontSize: 10, color: 'var(--cl-muted)', width: 10 }}>{isExpanded ? '▼' : '▶'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{project.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--cl-muted)', flexShrink: 0 }}>{project.sessions.length}</span>
                </button>
                <button className="cl-proj__act" onClick={onNewChat} title="New chat in this project">+</button>
            </div>
            {isExpanded && (
                <div className="cl-proj__chats">
                    {project.sessions.map((sess) => (
                        <div key={sess.id} className="cl-histrow cl-histrow--nested">
                            <button
                                className={`cl-histitem ${sess.id === activeSession ? 'cl-histitem--active' : ''}`}
                                onClick={() => onLoad(sess)}
                                title={`${sess.title}${sess.projectRoot ? `\n📁 ${sess.projectRoot}` : ''}`}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sess.title || 'Untitled'}</span>
                                <span style={{ flexShrink: 0, fontSize: 10.5, color: 'var(--cl-muted)' }}>{timeAgo(sess.updatedAt)}</span>
                            </button>
                            <div className="cl-histrow__acts">
                                <button onClick={() => onRename(sess)} title="Rename">✎</button>
                                <button onClick={() => onDelete(sess)} title="Delete">🗑</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
