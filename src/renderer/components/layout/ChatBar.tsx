import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { ModelSelector } from '../ai/ModelSelector';
import { useSettingsStore } from '../../store/settings';
import { useWorkspaceStore } from '../../store/workspaces';
import { useSwarmStore, AgentNode, SwarmConfig, SwarmHandoff } from '../../store/swarms';
import { useUIStore, ProjectMemory } from '../../store/ui';
import { useTerminalStore } from '../../store/terminal';
import { streamBus } from '../../utils/streamBus';
import { cleanTerminalOutput } from '../../utils/terminal';
import { ModelCapabilities } from '../ai/ModelCapabilities';
import type { ChatMessage } from '../../../shared/types';
import { getModelTags } from '../../utils/tags';

const estimateTokens = (msgs: ChatMessage[]) => msgs.reduce((acc, m) => acc + m.content.length / 4, 0);
const CONTEXT_WARN_THRESHOLD = 12000;

export function ChatBar() {
    const [input, setInput] = useState('');
    const [showModelSelector, setShowModelSelector] = useState(false);
    const selectedModel = useOllamaStore(state => state.selectedModel);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const connected = useOllamaStore(state => state.connected);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const { activeWorkspacePath, activeThreadId, saveMessagesToThread, workspaces } = useWorkspaceStore();
    const swarms = useSwarmStore(state => state.swarms);
    const ollamaConnected = useUIStore(state => state.ollamaConnected);
    const setOllamaConnected = useUIStore(state => state.setOllamaConnected);
    const vibeInstructions = useUIStore(state => state.vibeInstructions);

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
        window.vibe.stopGeneration();
        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    };

    const handleSend = async () => {
        if (!input.trim() || isGenerating || !selectedModel) return;

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

        const projectMemory = useUIStore.getState().projectMemory;
        const memorySection = projectMemory ? `

PROJECT MEMORY (from last session — ${projectMemory.updatedAt}):
Summary: ${projectMemory.lastSession}
Current phase: ${projectMemory.currentPhase}
Key files: ${projectMemory.keyFiles.join(', ')}
Architectural decisions:
${projectMemory.architecturalDecisions.map(d => `- ${d}`).join('\n')}

Use this context to orient yourself. Do NOT run exploratory commands to rediscover things already known.` : '';

        const projectPathEscaped = projectPath ? projectPath.replace(/\\/g, '\\\\') : null;
        const agentSystemPrompt = `You are VIBE, an autonomous Agentic IDE assistant running on Windows with PowerShell.

TOOLS — use these XML tags exactly, never wrap them in markdown code blocks:

1. Read a file (ALWAYS do this before editing an existing file):
<read_file path="relative/path/to/file.ext"/>

2. Write or create a file:
<write_file path="relative/path/to/file.ext">
complete file contents here — never use placeholders
</write_file>

3. Run a terminal command:
<execute>powershell command here</execute>

4. Signal task complete:
<done>Brief summary of what was accomplished</done>

RULES:${projectPathEscaped ? `\nPROJECT PATH: ${projectPath}\nALWAYS start your first command by cd-ing to the project: cd "${projectPath}"` : ''}
1. Always <read_file> before editing an existing file. Never guess file contents.
2. Only use tools when the task requires it. NEVER run exploratory commands like dir, ls, tree, Get-ChildItem unless the user explicitly asks.
3. PowerShell syntax ONLY. Use semicolons not &&. Use Remove-Item not rm. Use New-Item -ItemType Directory -Force not mkdir -p.
4. Write COMPLETE files — never partial code, never "// rest of file here".
5. When your task is fully complete, respond with <done>summary</done>.
6. If a command fails, read the error and try a different approach.
7. NEVER use <done> before you have received and read the terminal output from your command. After every <execute>, you will receive the output — wait for it and use it in your response.
8. After running an exploratory command (like dir or Get-ChildItem), always summarize what you found in plain text for the user BEFORE using <done>.
9. Use 'dir' for simple directory listings. Only use Get-ChildItem if you need specific filtering.
10. Never run the same command twice in a row.
11. Always cd to the project directory before running any file-related commands.
12. Never run commands from the home directory or unknown working directory.${vibeInstructions ? `\n\nPROJECT INSTRUCTIONS (from VIBE.md):\n${vibeInstructions}` : ''}${memorySection}`;

        const msgsForApi: ChatMessage[] = [
            { role: 'system', content: agentSystemPrompt },
            ...msgsWithUser
        ];

        const isSwarm = selectedModel?.startsWith('swarm-');
        if (isSwarm) {
            const swarm = swarms.find(s => s.id === selectedModel);
            if (swarm) {
                await runSwarm(swarm, userMsg.content);
                return;
            }
        }

        await runAgentLoop(msgsForApi, 0);
    };

    const waitForStreamDone = (): Promise<string> => {
        return new Promise((resolve) => {
            let fullContent = '';
            const unsub = streamBus.subscribe((chunk) => {
                if (chunk.content) fullContent += chunk.content;
                if (chunk.done) {
                    unsub();
                    resolve(fullContent);
                }
            });
        });
    };

    const MAX_LOOP = 6;

    const runAgentLoop = async (messages: ChatMessage[], iteration: number) => {
        if (iteration >= MAX_LOOP) {
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        const tokenEstimate = estimateTokens(messages);
        if (tokenEstimate > CONTEXT_WARN_THRESHOLD) {
            useOllamaStore.getState().setAgentStatus('⚠ Context large — consider starting a new chat for best results');
            await new Promise(r => setTimeout(r, 2000));
        }

        useOllamaStore.getState().setIsGenerating(true);
        useOllamaStore.getState().setAgentStep(iteration, MAX_LOOP);
        useOllamaStore.getState().setAgentStatus(
            iteration === 0 ? 'Thinking…' : `Working on step ${iteration}/${MAX_LOOP}…`
        );

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            const thinkOptions = (() => {
                const store = useOllamaStore.getState();
                const caps = store.modelCapabilities[store.selectedModel] ?? {};
                if (!caps.think || !store.thinkEnabled) return null;
                return { enabled: true, level: store.thinkLevel };
            })();

            await window.vibe.chat(selectedModel, messages, apiKeys, thinkOptions);
            await waitForStreamDone();
        } catch (e) {
            console.error('Chat error:', e);
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        const lastContent = useOllamaStore.getState().messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        // read_file handling
        const readFileMatch = lastContent.match(/<read_file\s+path=['"]([^'"]+)['"]\s*\/?>/);
        if (readFileMatch) {
            const filePath = readFileMatch[1];
            useOllamaStore.getState().setAgentStatus(`Reading file: ${filePath}`);
            const projectPath = useUIStore.getState().projectPath;
            let fileResult = '';
            try {
                const contents = await window.vibe.readFile(projectPath ? `${projectPath}/${filePath}` : filePath);
                fileResult = `__FILE_CONTENTS__ ${filePath}\n${contents}`;
            } catch {
                fileResult = `__FILE_CONTENTS__ ${filePath}\nERROR: File not found.`;
            }
            useOllamaStore.getState().addMessage({ role: 'user', content: fileResult });
            await runAgentLoop([
                ...messages,
                { role: 'assistant', content: lastContent },
                { role: 'user', content: fileResult }
            ], iteration + 1);
            return;
        }

        const hasDone = /<done>[\s\S]*?<\/done>/.test(lastContent);
        if (hasDone) {
            // Write updated memory after session
            const projectPath = useUIStore.getState().projectPath;
            if (projectPath) {
                const doneMatch = lastContent.match(/<done>([\s\S]*?)<\/done>/);
                const sessionSummary = doneMatch ? doneMatch[1].trim() : 'Session completed.';
                const existingMemory = useUIStore.getState().projectMemory;
                
                const newMemory = {
                    lastSession: sessionSummary,
                    keyFiles: existingMemory?.keyFiles || [],
                    architecturalDecisions: existingMemory?.architecturalDecisions || [],
                    currentPhase: existingMemory?.currentPhase || 'development',
                    updatedAt: new Date().toISOString(),
                };
                
                window.vibe.writeMemory(projectPath, newMemory).then(() => {
                    useUIStore.getState().setProjectMemory(newMemory);
                });
            }

            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        const hasExecute = /<execute>[\s\S]*?<\/execute>/.test(lastContent);
        if (hasExecute) {
            if (iteration === 0) {
                // First execute — check if it includes a cd, if not, inject one
                const projectPath = useUIStore.getState().projectPath;
                if (projectPath && !lastContent.includes('cd ')) {
                    const termId = useTerminalStore.getState().activeTerminalId;
                    if (termId) {
                        window.vibe.sendTerminalInput(termId, `cd "${projectPath}"\r`);
                        await new Promise(r => setTimeout(r, 1000));
                    }
                }
            }

            useOllamaStore.getState().setAgentStatus('Waiting for terminal output…');
            await new Promise(r => setTimeout(r, 4000));

            const termId = useTerminalStore.getState().activeTerminalId;
            if (termId) {
                let rawOutput = await window.vibe.getTerminalOutput(termId);
                if (!rawOutput || rawOutput.trim().length < 5) {
                    await new Promise(r => setTimeout(r, 3000));
                    rawOutput = await window.vibe.getTerminalOutput(termId);
                }
                await window.vibe.clearTerminalOutput(termId);
                const cleaned = cleanTerminalOutput(rawOutput);

                if (cleaned && cleaned.length > 2) {
                    useOllamaStore.getState().setAgentStatus('Analyzing output…');
                    const terminalMsg = `__TERMINAL_OUTPUT__\n${cleaned}`;
                    useOllamaStore.getState().addMessage({ role: 'user', content: terminalMsg });
                    const feedbackMsg: ChatMessage = {
                        role: 'user',
                        content: `Terminal output:\n\`\`\`\n${cleaned.slice(-2000)}\n\`\`\`\n\nAnalyze this output and respond to the user's original request. Summarize what you found in plain language. Do NOT run the same command again. If complete, write your summary then end with <done>summary</done>.`
                    };
                    await runAgentLoop([
                        ...messages,
                        { role: 'assistant', content: lastContent },
                        feedbackMsg
                    ], iteration + 1);
                    return;
                } else {
                    useOllamaStore.getState().setAgentStatus('Command produced no output, retrying…');
                    const emptyMsg: ChatMessage = {
                        role: 'user',
                        content: `The command ran but produced no output. Try a simpler command (e.g. use 'dir' instead of 'Get-ChildItem -Recurse') or respond with what you know.`
                    };
                    await runAgentLoop([
                        ...messages,
                        { role: 'assistant', content: lastContent },
                        emptyMsg
                    ], iteration + 1);
                    return;
                }
            }
        }

        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    };

    const runSwarm = async (swarm: SwarmConfig, userInput: string) => {
        useOllamaStore.getState().setIsGenerating(true);
        const projectPath = useUIStore.getState().projectPath;

        const sharedContext: Record<string, string> = {};

        const getWave = (agent: AgentNode, allAgents: AgentNode[]): number => {
            if (!agent.dependsOn || agent.dependsOn.length === 0) return 0;
            const depWaves = agent.dependsOn.map(depId => {
                const dep = allAgents.find(a => a.id === depId);
                return dep ? getWave(dep, allAgents) + 1 : 0;
            });
            return Math.max(...depWaves);
        };

        const agentsWithWaves = swarm.agents.map(agent => ({
            ...agent,
            wave: getWave(agent, swarm.agents)
        }));

        const maxWave = Math.max(...agentsWithWaves.map(a => a.wave));

        for (let wave = 0; wave <= maxWave; wave++) {
            const waveAgents = agentsWithWaves.filter(a => a.wave === wave);

            useOllamaStore.getState().addMessage({
                role: 'user',
                content: `__SWARM_LABEL__Wave ${wave + 1} — ${waveAgents.map(a => a.role).join(', ')}`
            });

            useOllamaStore.getState().setAgentStatus(
                `Wave ${wave + 1}/${maxWave + 1}: Running ${waveAgents.map(a => a.role).join(' + ')} in parallel…`
            );

            await Promise.all(waveAgents.map(async (agent) => {
                const depContext = agent.dependsOn
                    ? agent.dependsOn.map(depId => {
                        const depAgent = swarm.agents.find(a => a.id === depId);
                        const role = depAgent?.role || String(depId);
                        return sharedContext[role] ? `\n\n[${role} output]:\n${sharedContext[role]}` : '';
                    }).join('')
                    : '';

                const handoff: SwarmHandoff = {
                    originalRequest: userInput,
                    previousAgentRole: Object.keys(sharedContext)[Object.keys(sharedContext).length - 1] || 'none',
                    previousAgentOutput: Object.values(sharedContext)[Object.values(sharedContext).length - 1] || '',
                    sharedContext,
                };

                const sysPrompt = agent.role === 'Architect'
                    ? `You are the Architect agent in a multi-agent swarm. Your job is analysis and planning only.

Original request: ${userInput}

Produce a detailed, numbered execution plan. Be specific about file names, commands, logic, and edge cases. Output only the plan — no code, no implementation.`
                    : `You are the ${agent.role} agent in a multi-agent swarm.

Original request: ${handoff.originalRequest}
${depContext}

Full shared context from previous agents:
${Object.entries(handoff.sharedContext).map(([role, output]) => `[${role}]:\n${output}`).join('\n\n')}

Execute your part of the work using VIBE tools:
- <read_file path="file"/> before editing any existing file
- <write_file path="file">complete content</write_file> for creating/editing files
- <execute>powershell command</execute> for terminal commands
- Windows PowerShell only. Complete files only, no placeholders.
- <done>summary</done> when your part is complete.${projectPath ? `\nProject path: ${projectPath}` : ''}`;

                const msgs: ChatMessage[] = [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: agent.role === 'Architect' ? userInput : `Execute your role. Context is in your system prompt.` }
                ];

                useOllamaStore.getState().addMessage({ role: 'user', content: `__SWARM_LABEL__  ↳ ${agent.role} (${agent.model})` });
                useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

                await window.vibe.chat(agent.model, msgs, apiKeys);
                const output = await waitForStreamDone();

                sharedContext[agent.role] = output;
            }));
        }

        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
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
                placeholder={isGenerating ? 'Agent is working… (press Enter or ■ to stop)' : 'Ask the agent to build…'}
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
