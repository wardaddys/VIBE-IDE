import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { ModelSelector } from '../ai/ModelSelector';
import { useSettingsStore } from '../../store/settings';
import { useWorkspaceStore } from '../../store/workspaces';
import { useSwarmStore, SwarmConfig } from '../../store/swarms';
import { useUIStore } from '../../store/ui';
import { streamBus } from '../../utils/streamBus';
import { ModelCapabilities } from '../ai/ModelCapabilities';
import type { ChatMessage } from '../../../shared/types';
import { getModelTags } from '../../utils/tags';
import { shouldUseAgenticMode } from '../../services/agent/intent';
import { waitForStreamDone as waitForStreamDoneWithCancellation } from '../../services/agent/stream';
import { runAgentLoop as runAgentLoopOrchestrator } from '../../services/agent/orchestrator';
import { runSwarm as runSwarmOrchestrator } from '../../services/agent/swarm';
import { runDirectChat as runDirectChatService } from '../../services/agent/direct';
import {
    getBriefingContext,
    getProjectSnapshot,
    getThinkOptions,
    pollTerminalOutput,
} from '../../services/agent/runtime';

const STREAM_TIMEOUT_MS = 120000;

export function ChatBar() {
    const [input, setInput] = useState('');
    const [showModelSelector, setShowModelSelector] = useState(false);
    const stopRequestedRef = React.useRef(false);
    const selectedModel = useOllamaStore(state => state.selectedModel);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const connected = useOllamaStore(state => state.connected);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const { activeWorkspacePath, activeThreadId, saveMessagesToThread, workspaces } = useWorkspaceStore();
    const swarms = useSwarmStore(state => state.swarms);
    const ollamaConnected = useUIStore(state => state.ollamaConnected);
    const setOllamaConnected = useUIStore(state => state.setOllamaConnected);
    const vibeInstructions = useUIStore(state => state.vibeInstructions);
    const chatMode = useUIStore(state => state.chatMode);

    React.useEffect(() => {
        let cancelled = false;
        const ping = async () => {
            try {
                const alive = await window.vibe.statusOllama();
                if (!cancelled) setOllamaConnected(!!alive);
            } catch {
                if (!cancelled) setOllamaConnected(false);
            }
        };
        ping();
        const interval = setInterval(ping, 5000);
        return () => { cancelled = true; clearInterval(interval); };
    }, []);

    const getThreadMessages = () => {
        const w = workspaces.find(w => w.path === activeWorkspacePath);
        return w?.threads.find(t => t.id === activeThreadId)?.messages || [];
    };

    const handleStop = () => {
        stopRequestedRef.current = true;
        window.vibe.stopGeneration();
        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    };

    const handleSend = async () => {
        if (!input.trim() || isGenerating || !selectedModel) return;
        stopRequestedRef.current = false;

        let currentWorkspacePath = activeWorkspacePath;
        let currentThreadId = activeThreadId;
        const projectPath = useUIStore.getState().projectPath;

        if (!currentWorkspacePath && projectPath) {
            useWorkspaceStore.getState().addWorkspace(projectPath);
            useWorkspaceStore.getState().setActiveWorkspace(projectPath);
            currentWorkspacePath = projectPath;
        }
        if (currentWorkspacePath && !currentThreadId) {
            currentThreadId = useWorkspaceStore.getState().createThread(currentWorkspacePath, 'Chat');
        }

        const currentMessages = getThreadMessages();
        const userMsg: ChatMessage = { role: 'user', content: input.trim() };
        const msgsWithUser = [...currentMessages, userMsg];

        if (currentWorkspacePath && currentThreadId) {
            saveMessagesToThread(currentWorkspacePath, currentThreadId, msgsWithUser);
        }

        setInput('');
        useOllamaStore.getState().addMessage({ role: 'user', content: userMsg.content });
        useOllamaStore.getState().resetThinking();

        const isSwarm = selectedModel?.startsWith('swarm-');
        if (isSwarm) {
            const swarm = swarms.find(s => s.id === selectedModel);
            if (swarm) {
                await runSwarm(swarm, userMsg.content);
                return;
            }
        }

        const shouldAgentRun =
            chatMode === 'agent' ||
            (chatMode === 'auto' && shouldUseAgenticMode(userMsg.content));

        if (!shouldAgentRun) {
            await runDirectChat(msgsWithUser);
            return;
        }

        await runAgentLoop(userMsg.content);
    };

    const waitForStreamDone = (timeoutMs: number = STREAM_TIMEOUT_MS): Promise<string> => {
        return waitForStreamDoneWithCancellation({
            subscribe: (handler) => streamBus.subscribe(handler),
            shouldStop: () => stopRequestedRef.current,
            timeoutMs,
            onTimeout: () => window.vibe.log('[STREAM] waitForStreamDone timeout reached'),
            onResolved: () => window.vibe.log('[STREAM] waitForStreamDone resolved'),
        });
    };

    const runDirectChat = async (baseMessages: ChatMessage[]) => {
        await runDirectChatService({
            selectedModel,
            apiKeys,
            vibeInstructions,
            baseMessages,
            getBriefingContext,
            getThinkOptions,
            waitForStreamDone,
            shouldStop: () => stopRequestedRef.current,
        });
    };

    const runAgentLoop = async (userMission: string) => {
        await runAgentLoopOrchestrator(userMission, {
            selectedModel,
            apiKeys,
            vibeInstructions,
            shouldStop: () => stopRequestedRef.current,
            getThinkOptions,
            waitForStreamDone,
            getProjectSnapshot: (projectPath) =>
                getProjectSnapshot(projectPath, {
                    shouldStop: () => stopRequestedRef.current,
                }),
            getBriefingContext,
            pollTerminalOutput: (termId) =>
                pollTerminalOutput(termId, {
                    shouldStop: () => stopRequestedRef.current,
                }),
        });
    };

    const runSwarm = async (swarm: SwarmConfig, userInput: string) => {
        await runSwarmOrchestrator(swarm, userInput, {
            apiKeys,
            shouldStop: () => stopRequestedRef.current,
            waitForStreamDone,
        });
    };

    return (
        <div style={{ position: 'relative', padding: '12px 16px', borderTop: '1px solid var(--border-light)', background: 'rgba(0,0,0,0.02)', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {showModelSelector && <ModelSelector onClose={() => setShowModelSelector(false)} />}
            <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (isGenerating) handleStop();
                        else handleSend();
                    }
                }}
                placeholder={isGenerating
                    ? 'Agent is working… (press Enter or ■ to stop)'
                    : chatMode === 'chat'
                        ? 'Chat mode: ask anything...'
                        : chatMode === 'agent'
                            ? 'Agent mode: describe the task...'
                            : 'Auto mode: chat or task execution...'}
                rows={2}
                style={{
                    width: '100%',
                    background: '#fff',
                    border: `1px solid ${isGenerating ? 'var(--warn)' : 'var(--border)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 12px',
                    fontSize: '13px',
                    color: 'var(--text)',
                    outline: 'none',
                    fontFamily: 'var(--font-sans)',
                    resize: 'none',
                    transition: 'border-color 0.2s',
                }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                    onClick={() => setShowModelSelector(!showModelSelector)}
                    style={{ background: 'rgba(0,0,0,0.05)', border: 'none', padding: '6px 10px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}
                >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--error)' }} />
                    {(() => {
                        if (selectedModel?.startsWith('swarm-')) {
                            const swarm = swarms.find(s => s.id === selectedModel);
                            return (
                                <>
                                    <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--accent)' }}>{swarm?.name || 'Swarm'}</span>
                                    <span style={{ fontSize: 8, padding: '2px 4px', borderRadius: 3, background: 'var(--accent-light)', color: 'var(--accent)' }}>SWARM</span>
                                </>
                            );
                        }
                        if (selectedModel?.startsWith('hf:')) {
                            return (
                                <>
                                    <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#ff6e00' }}>{selectedModel.replace('hf:', '')}</span>
                                    <span style={{ fontSize: 8, padding: '2px 4px', borderRadius: 3, background: 'rgba(255,110,0,0.1)', color: '#ff6e00' }}>HF</span>
                                </>
                            );
                        }
                        return (
                            <>
                                <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedModel || 'Select Model'}</span>
                                {selectedModel && getModelTags(selectedModel).slice(0, 1).map(tag => (
                                    <span key={tag.label} style={{ fontSize: 8, padding: '2px 4px', borderRadius: 3, background: tag.bg, color: tag.color }}>{tag.label}</span>
                                ))}
                            </>
                        );
                    })()}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <ModelCapabilities />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: ollamaConnected ? 'var(--green)' : '#ccc', display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{ollamaConnected ? 'Ollama' : 'No Ollama'}</span>
                    </div>

                    <button
                        onClick={isGenerating ? handleStop : handleSend}
                        disabled={!isGenerating && (!input.trim() || !selectedModel)}
                        title={isGenerating ? 'Stop (Enter)' : 'Send (Enter)'}
                        style={{
                            background: isGenerating ? 'transparent' : 'var(--accent-gradient)',
                            border: isGenerating ? '2px solid var(--error)' : 'none',
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            color: isGenerating ? 'var(--error)' : '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: (!isGenerating && (!input.trim() || !selectedModel)) ? 'not-allowed' : 'pointer',
                            opacity: (!isGenerating && (!input.trim() || !selectedModel)) ? 0.4 : 1,
                            fontSize: isGenerating ? 13 : 16,
                            transition: 'all 0.15s',
                            flexShrink: 0,
                        }}
                    >
                        {isGenerating ? '■' : '↑'}
                    </button>
                </div>
            </div>
        </div>
    );
}
