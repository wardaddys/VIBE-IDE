import React, { useEffect, useRef, useState } from 'react';
import { useOllamaStore } from './store/ollama';
import { useUIStore } from './store/ui';
import { useSettingsStore } from './store/settings';
import { LoginScreen } from './components/auth/LoginScreen';
import { useBackgroundTerminal } from './hooks/useBackgroundTerminal';
import { ChatRail } from './components/claude/ChatRail';
import { AgentSurface } from './components/agent/AgentSurface';
import { DesignCanvas } from './components/agent/DesignCanvas';
import { EditorTabs } from './components/editor/EditorTabs';
import { EditorPane } from './components/editor/EditorPane';
import { RunBar } from './components/editor/RunBar';
import { TerminalPane } from './components/terminal/TerminalPane';
import { useAgentRunStore } from './store/agentRun';
import { Settings } from './components/claude/Settings';
import { ScheduledTasks } from './components/claude/ScheduledTasks';
import { Projects } from './components/claude/Projects';
import { CommandPalette } from './components/claude/CommandPalette';
import { ModelPicker } from './components/claude/ModelPicker';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { FolderPicker } from './components/common/FolderPicker';
import { DataHomeSetup } from './components/layout/DataHomeSetup';
import DebatePanel from './components/agent/DebatePanel';
import { useDebateStore } from './store/debate';
import { uiBus } from './utils/uiBus';
import { newChatInCurrentProject } from './services/agentClient';

type Modal =
    | { kind: 'settings'; section?: string }
    | { kind: 'schedule' } | { kind: 'projects' } | { kind: 'palette' } | { kind: 'model' } | null;

export default function App() {
    const setConnectionState = useOllamaStore((s) => s.setConnectionState);
    const setModels = useOllamaStore((s) => s.setModels);
    const setOllamaConnected = useUIStore((s) => s.setOllamaConnected);
    const isLoggedIn = useUIStore((s) => s.isLoggedIn);
    const setIsLoggedIn = useUIStore((s) => s.setIsLoggedIn);
    const projectPath = useUIStore((s) => s.projectPath);
    const setVibeInstructions = useUIStore((s) => s.setVibeInstructions);
    const layoutMode = useUIStore((s) => s.layoutMode);
    const setLayoutMode = useUIStore((s) => s.setLayoutMode);
    const surface = useAgentRunStore((s) => s.surface);
    const workspaceOpen = useUIStore((s) => s.workspaceOpen);
    const setWorkspaceOpen = useUIStore((s) => s.setWorkspaceOpen);
    const toggleWorkspaceOpen = useUIStore((s) => s.toggleWorkspaceOpen);
    const terminalHeight = useUIStore((s) => s.terminalHeight);
    const setTerminalHeight = useUIStore((s) => s.setTerminalHeight);
    const debateMode = useUIStore((s) => s.debateMode);
    const toggleDebateMode = useUIStore((s) => s.toggleDebateMode);
    const theme = useSettingsStore((s) => s.theme);

    // Keep <html data-theme> in sync so every CSS variable flips at once.
    useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

    // Resizable terminal splitter
    const resizeRef = useRef<{ startY: number; startHeight: number; onMove: (h: number) => void } | null>(null);
    const startTerminalResize = (e: React.MouseEvent, onMove: (height: number) => void) => {
        e.preventDefault();
        resizeRef.current = { startY: e.clientY, startHeight: terminalHeight, onMove };
        document.body.style.cursor = 'ns-resize';
        document.body.style.userSelect = 'none';
        const onMouseMove = (ev: MouseEvent) => {
            const r = resizeRef.current;
            if (!r) return;
            const minH = 120;
            const maxH = 600;
            const delta = r.startY - ev.clientY;
            const next = Math.max(minH, Math.min(maxH, r.startHeight + delta));
            r.onMove(next);
        };
        const onMouseUp = () => {
            resizeRef.current = null;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const terminalPanel = (height: number, onResize: (h: number) => void) => (
        <>
            <div
                onMouseDown={(e) => startTerminalResize(e, onResize)}
                style={{ height: 6, cursor: 'ns-resize', background: 'var(--cl-border-soft)', flexShrink: 0 }}
                title="Drag to resize terminal"
            />
            <div style={{ height, overflow: 'hidden', flexShrink: 0 }}><TerminalPane /></div>
        </>
    );

    const [isMax, setIsMax] = useState(false);
    const [modal, setModal] = useState<Modal>(null);
    // First-run: ask where to keep projects & engagements (once per machine).
    const [firstRun, setFirstRun] = useState(false);
    useEffect(() => { window.vibe.dataHome?.isFirstRun?.().then(setFirstRun).catch(() => {}); }, []);
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    useBackgroundTerminal();

    useEffect(() => {
        const check = async () => {
            try {
                const { detected, version } = await window.vibe.detectOllama();
                setConnectionState(detected, version ?? null); setOllamaConnected(detected);
                if (detected) setModels(await window.vibe.listModels());
                const okey = (useSettingsStore.getState().apiKeys as any).ollama;
                if (okey) window.vibe.kernel.cloudModels(okey).then((c) => useOllamaStore.getState().setCloudModelNames(c.map((m) => m.name))).catch(() => {});
            } catch { setConnectionState(false, null); setOllamaConnected(false); }
        };
        check(); const t = setInterval(check, 30000); return () => clearInterval(t);
    }, [setConnectionState, setModels, setOllamaConnected]);

    useEffect(() => { if (window.vibe?.onWindowMaximized) window.vibe.onWindowMaximized((m: boolean) => setIsMax(m)); }, []);

    useEffect(() => {
        if (projectPath) window.vibe.readFile(`${projectPath}/VIBE.md`).then(setVibeInstructions).catch(() => setVibeInstructions(null));
        else setVibeInstructions(null);
    }, [projectPath]);

    // UI event bus → modals
    useEffect(() => uiBus.on((e) => {
        if (e.t === 'openSettings') setModal({ kind: 'settings', section: e.section });
        else if (e.t === 'openSchedule') setModal({ kind: 'schedule' });
        else if (e.t === 'openProjects') setModal({ kind: 'projects' });
        else if (e.t === 'openPalette') setModal({ kind: 'palette' });
        else if (e.t === 'openModel') setModal({ kind: 'model' });
        else if (e.t === 'toggleWorkspace') useUIStore.getState().toggleWorkspaceOpen();
        else if (e.t === 'newChat') newChatInCurrentProject();
    }), []);

    // keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setModal({ kind: 'palette' }); }
            else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); newChatInCurrentProject(); }
            else if (mod && e.key === ',') { e.preventDefault(); setModal({ kind: 'settings' }); }
            else if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); useUIStore.getState().toggleWorkspaceOpen(); }
            else if (e.key === 'Escape') { setModal(null); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (!isLoggedIn) return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
    if (firstRun) return <DataHomeSetup onDone={() => setFirstRun(false)} />;

    const projectName = projectPath ? projectPath.split(/[/\\]/).pop() : 'VIBE';
    const close = () => setModal(null);

    return (
        <div className="cl-app">
            <div className="cl-topbar titlebar-drag">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: isMac ? 68 : 0 }}>
                    <span
                        className="cl-topbar__brand"
                        style={{ userSelect: 'none' }}
                    >VIBE</span>
                </div>
                <span className="cl-topbar__title">{projectName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button data-clickable className="cl-winbtn" onClick={() => uiBus.emit({ t: 'openPalette' })} title="Command palette (Ctrl K)" style={{ width: 'auto', padding: '0 8px', fontSize: 13 }}>⌘K</button>
                    {surface !== 'design' && (
                        <button data-clickable className="cl-winbtn" onClick={() => toggleDebateMode()}
                            title="Toggle dual-model debate mode"
                            style={{ width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600, color: debateMode ? 'var(--cl-accent)' : 'var(--cl-text-2)' }}>⚖️</button>
                    )}
                    {surface !== 'design' && (
                        <button data-clickable className="cl-winbtn" onClick={() => setLayoutMode(layoutMode === 'ide' ? 'chat' : 'ide')}
                            title={layoutMode === 'ide' ? 'Back to chat-first layout' : 'Code-first layout: editor center, chat docked right'}
                            style={{ width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600, color: layoutMode === 'ide' ? 'var(--cl-accent)' : 'var(--cl-text-2)' }}>IDE</button>
                    )}
                    {surface !== 'design' && layoutMode !== 'ide' && (
                        <button data-clickable className="cl-winbtn" onClick={() => toggleWorkspaceOpen()} title="Toggle editor & terminal (Ctrl B)" style={{ width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600, color: workspaceOpen ? 'var(--cl-accent)' : 'var(--cl-text-2)' }}>Workspace</button>
                    )}
                    {!isMac && (
                        <>
                            <button data-clickable className="cl-winbtn" onClick={() => window.vibe.minimizeWindow()}>_</button>
                            <button data-clickable className="cl-winbtn" onClick={() => window.vibe.maximizeWindow()}>{isMax ? '❐' : '□'}</button>
                            <button data-clickable className="cl-winbtn" onClick={() => window.vibe.closeWindow()} style={{ color: '#c0392b' }}>✕</button>
                        </>
                    )}
                </div>
            </div>

            <div className="cl-body">
                <ErrorBoundary label="Workbench">
                <ChatRail />
                {surface === 'design' ? (
                    /* Design: chat left, live canvas center-right. */
                    <div className="cl-split">
                        <div className="cl-split__chat cl-split__chat--design"><AgentSurface /></div>
                        <DesignCanvas />
                    </div>
                ) : layoutMode === 'ide' ? (
                    /* Code-first: editor + terminal center stage, chat docked right.
                       The editor follows whatever file the agent touches. */
                    <div className="cl-split">
                        <div className="cl-idecenter">
                            <EditorTabs />
                            <RunBar />
                            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}><EditorPane /></div>
                            {terminalPanel(terminalHeight, (h) => setTerminalHeight(h))}
                        </div>
                        <div className="cl-split__chat cl-split__chat--dock"><AgentSurface /></div>
                    </div>
                ) : (
                    <>
                        {debateMode ? <DebatePanel /> : <AgentSurface />}
                        {workspaceOpen && (
                            <div className="cl-workspace">
                                <div className="cl-ws__head"><span>Workspace</span><button className="cl-winbtn" style={{ width: 22, height: 22 }} onClick={() => setWorkspaceOpen(false)}>✕</button></div>
                                <EditorTabs />
                                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}><EditorPane /></div>
                                {terminalPanel(terminalHeight, (h) => setTerminalHeight(h))}
                            </div>
                        )}
                    </>
                )}
                </ErrorBoundary>
            </div>

            {modal?.kind === 'settings' && <Settings onClose={close} initialSection={modal.section as any} />}
            {modal?.kind === 'schedule' && <ScheduledTasks onClose={close} />}
            {modal?.kind === 'projects' && <Projects onClose={close} />}
            {modal?.kind === 'palette' && <CommandPalette onClose={close} />}
            {modal?.kind === 'model' && <ModelPicker onClose={close} />}
            <FolderPicker />
        </div>
    );
}
