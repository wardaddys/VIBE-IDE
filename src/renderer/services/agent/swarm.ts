import type { ChatMessage } from '../../../shared/types';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';
import type { AgentNode, SwarmConfig, SwarmHandoff } from '../../store/swarms';

interface AgentNodeWithWave extends AgentNode {
    wave: number;
}

export function computeAgentWaves(agents: AgentNode[]): AgentNodeWithWave[] {
    const getWave = (agent: AgentNode, allAgents: AgentNode[]): number => {
        if (!agent.dependsOn || agent.dependsOn.length === 0) return 0;
        const depWaves = agent.dependsOn.map(depId => {
            const dep = allAgents.find(a => a.id === depId);
            return dep ? getWave(dep, allAgents) + 1 : 0;
        });
        return Math.max(...depWaves);
    };

    return agents.map(agent => ({
        ...agent,
        wave: getWave(agent, agents),
    }));
}

export interface RunSwarmDeps {
    apiKeys: Record<string, string>;
    shouldStop: () => boolean;
    waitForStreamDone: (timeoutMs?: number) => Promise<string>;
}

export async function runSwarm(swarm: SwarmConfig, userInput: string, deps: RunSwarmDeps): Promise<void> {
    const { apiKeys, shouldStop, waitForStreamDone } = deps;

    useOllamaStore.getState().setIsGenerating(true);
    const projectPath = useUIStore.getState().projectPath;

    try {
        const sharedContext: Record<string, string> = {};
        const agentsWithWaves = computeAgentWaves(swarm.agents);
        const maxWave = Math.max(...agentsWithWaves.map(a => a.wave));

        for (let wave = 0; wave <= maxWave; wave++) {
            if (shouldStop()) return;
            const waveAgents = agentsWithWaves.filter(a => a.wave === wave);

            useOllamaStore.getState().addMessage({
                role: 'user',
                content: `__SWARM_LABEL__Wave ${wave + 1} — ${waveAgents.map(a => a.role).join(', ')}`,
            });

            useOllamaStore.getState().setAgentStatus(
                `Wave ${wave + 1}/${maxWave + 1}: Running ${waveAgents.map(a => a.role).join(' -> ')} safely...`,
            );

            for (const agent of waveAgents) {
                if (shouldStop()) return;
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
                    { role: 'user', content: agent.role === 'Architect' ? userInput : 'Execute your role. Context is in your system prompt.' },
                ];

                useOllamaStore.getState().addMessage({ role: 'user', content: `__SWARM_LABEL__  ↳ ${agent.role} (${agent.model})` });
                useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

                await window.vibe.chat(agent.model, msgs, apiKeys);
                const output = await waitForStreamDone();
                if (shouldStop()) return;

                sharedContext[agent.role] = output;
            }
        }
    } finally {
        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    }
}
