import React, { useEffect, useRef } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { MenuBar } from './components/layout/MenuBar';
import { Sidebar } from './components/layout/Sidebar';
import { MainArea } from './components/layout/MainArea';
import { useOllamaStore } from './store/ollama';
import { useUIStore } from './store/ui';
import { useWorkspaceStore } from './store/workspaces';
import { LoginScreen } from './components/auth/LoginScreen';
import { useBackgroundTerminal } from './hooks/useBackgroundTerminal';
import { streamBus } from './utils/streamBus';

export default function App() {
    const setConnectionState = useOllamaStore(state => state.setConnectionState);
    const setModels = useOllamaStore(state => state.setModels);
    const setOllamaConnected = useUIStore(state => state.setOllamaConnected);
    const isLoggedIn = useUIStore(state => state.isLoggedIn);
    const setIsLoggedIn = useUIStore(state => state.setIsLoggedIn);

    const thinkBufferRef = useRef('');
    const inThinkBlockRef = useRef(false);

    useBackgroundTerminal();

    /* -----------------------------------------------------------------
       1️⃣  On start‑up we *detect* Ollama (fast HTTP ping).  This sets the
       “connected” flag used by the Sidebar and also updates the UI store
       that drives the green/red dot in the ChatBar.
       ----------------------------------------------------------------- */
    useEffect(() => {
        const checkOllama = async () => {
            try {
                const { detected, version } = await window.vibe.detectOllama();
                setConnectionState(detected, version ?? null);
                setOllamaConnected(detected);
                if (detected) {
                    const models = await window.vibe.listModels();
                    setModels(models);
                }
            } catch (err) {
                console.error('Ollama check failed:', err);
                setConnectionState(false, null);
                setOllamaConnected(false);
            }
        };
        checkOllama();
        const interval = setInterval(checkOllama, 30000);
        return () => clearInterval(interval);
    }, [setConnectionState, setModels, setOllamaConnected]);

    useEffect(() => {
        window.vibe.onChatStream((chunk: { content: string, done: boolean }) => {
            const store = useOllamaStore.getState();

            if (chunk.content) {
                streamBus.emit({ content: chunk.content, done: false });
                thinkBufferRef.current += chunk.content;
                let buf = thinkBufferRef.current;
                let normalContent = '';

                while (buf.length > 0) {
                    if (inThinkBlockRef.current) {
                        const closeIdx = buf.indexOf('</think>');
                        if (closeIdx !== -1) {
                            store.appendThinkContent(buf.slice(0, closeIdx));
                            store.finalizeThinking();
                            inThinkBlockRef.current = false;
                            buf = buf.slice(closeIdx + '</think>'.length);
                        } else {
                            const safeLen = Math.max(0, buf.length - 8);
                            if (safeLen > 0) { store.appendThinkContent(buf.slice(0, safeLen)); buf = buf.slice(safeLen); }
                            break;
                        }
                    } else {
                        const openIdx = buf.indexOf('<think>');
                        if (openIdx !== -1) {
                            normalContent += buf.slice(0, openIdx);
                            store.startThinking();
                            inThinkBlockRef.current = true;
                            buf = buf.slice(openIdx + '<think>'.length);
                        } else {
                            const safeLen = Math.max(0, buf.length - 7);
                            normalContent += buf.slice(0, safeLen);
                            buf = buf.slice(safeLen);
                            break;
                        }
                    }
                }

                thinkBufferRef.current = buf;

                if (normalContent) {
                    store.updateLastMessage(normalContent);
                    const ws = useWorkspaceStore.getState();
                    if (ws.activeWorkspacePath && ws.activeThreadId) {
                        const workspace = ws.workspaces.find(w => w.path === ws.activeWorkspacePath);
                        const thread = workspace?.threads.find(t => t.id === ws.activeThreadId);
                        if (thread) {
                            const msgs = [...thread.messages];
                            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                                msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content: msgs[msgs.length - 1].content + normalContent };
                                ws.saveMessagesToThread(ws.activeWorkspacePath!, ws.activeThreadId!, msgs);
                            }
                        }
                    }
                }
            }

            if (chunk.done) {
                const remaining = thinkBufferRef.current;
                if (remaining) {
                    if (inThinkBlockRef.current) {
                        store.appendThinkContent(remaining);
                        store.finalizeThinking();
                    } else {
                        store.updateLastMessage(remaining);
                    }
                    thinkBufferRef.current = '';
                    inThinkBlockRef.current = false;
                }
                store.setIsGenerating(false);
                streamBus.emit({ content: '', done: true });
                const ws = useWorkspaceStore.getState();
                if (ws.activeWorkspacePath && ws.activeThreadId) {
                    const workspace = ws.workspaces.find(w => w.path === ws.activeWorkspacePath);
                    const thread = workspace?.threads.find(t => t.id === ws.activeThreadId);
                    if (thread) ws.saveMessagesToThread(ws.activeWorkspacePath!, ws.activeThreadId!, thread.messages);
                }
            }
        });
    }, []); // Empty deps — register ONCE, never again

    const projectPath = useUIStore(state => state.projectPath);
    const setVibeInstructions = useUIStore(state => state.setVibeInstructions);

    useEffect(() => {
        if (projectPath) {
            window.vibe.readFile(`${projectPath}/VIBE.md`)
                .then((content: string) => setVibeInstructions(content))
                .catch(() => setVibeInstructions(null));
        } else {
            setVibeInstructions(null);
        }
    }, [projectPath]);

    if (!isLoggedIn) {
        return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
    }

    return (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <TitleBar />
            <MenuBar />
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '0 var(--gap) var(--gap)', gap: 'var(--gap)' }}>
                <Sidebar />
                <MainArea />
            </div>
        </div>
    );
}
