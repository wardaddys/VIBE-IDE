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
import { sanitizeForPowerShell } from '../../utils/commandSanitizer';
import { ModelCapabilities } from '../ai/ModelCapabilities';
import type { ChatMessage } from '../../../shared/types';
import { getModelTags } from '../../utils/tags';

const estimateTokens = (msgs: ChatMessage[]) => msgs.reduce((acc, m) => acc + m.content.length / 4, 0);
const CONTEXT_WARN_THRESHOLD = 12000;

// ─── Bulletproof Loop Constants ──────────────────────────────────
const MAX_STEP_RETRIES = 3;
const MAX_STEPS = 12;
const REFLECTION_THRESHOLD = 7;

// ─── XML Tag Extraction Helper ───────────────────────────────────
const extractTag = (text: string, tag: string): string | null => {
    try {
        const match = text.match(
            new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
        );
        return match ? match[1].trim() : null;
    } catch {
        return null;
    }
};

// ─── Prompt Builders ─────────────────────────────────────────────
const buildPlannerPrompt = (
    mission: string,
    projectPath: string | null,
    projectStructure: string,
    memory: any,
    vibeInstructions: string | null
): string => `You are VIBE Planner — an expert software architect.

Your job is to create a precise, executable plan for this mission:
"${mission}"

PROJECT: ${projectPath || 'unknown'}
PROJECT STRUCTURE (actual files that exist):
\`\`\`
${projectStructure}
\`\`\`
${memory ? `MEMORY: ${JSON.stringify(memory).slice(0, 500)}` : ''}
${vibeInstructions ? `PROJECT RULES:\n${vibeInstructions}` : ''}

Output ONLY this XML structure, nothing else:

<plan>
  <mission>${mission}</mission>
  <steps>
    <step id="1" type="read_file|execute|write_file|analyze">
      Description of exactly what to do
    </step>
    <step id="2" depends="1" type="execute">
      Next step description
    </step>
  </steps>
  <criteria>What "done" looks like — specific and testable</criteria>
  <risks>Any risks or things that might go wrong</risks>
</plan>

RULES:
- Maximum 8 steps
- Each step must be atomic — one action only
- type must be: read_file, execute, write_file, or analyze
- depends attribute lists step ids this step waits for
- Be specific — name exact files and commands where known
- Do NOT include code yet — planning only`;

const buildExecutorPrompt = (
    mission: string,
    plan: string,
    currentStep: string,
    stepId: string,
    previousResults: string,
    projectPath: string | null
): string => `You are VIBE Executor — an expert developer running on Windows with PowerShell.

MISSION: ${mission}
CURRENT STEP: ${currentStep}
PROJECT: ${projectPath || 'unknown'}

FULL PLAN FOR CONTEXT:
${plan}

RESULTS SO FAR:
${previousResults || 'No previous results yet.'}

Execute ONLY the current step using exactly ONE of these tools:

To read a file:
<read_file path="relative/path/to/file.ext"/>

To run a terminal command (PowerShell on Windows):
<execute>your powershell command here</execute>

To write a file (complete content only, never partial):
<write_file path="relative/path/to/file.ext">
complete file content here
</write_file>

To analyze/reason without a tool:
<analyze>
your analysis here
</analyze>

After using your tool, output your reflection:
<reflection>
  <score>X</score>
  <notes>What happened, what you found, any issues</notes>
  <proceed>yes|no</proceed>
  <critique>If score < 8, what went wrong and how to fix it</critique>
</reflection>

RULES:
- Use ONLY ONE tool per response
- Always read a file before editing it
- PowerShell syntax only — use semicolons not &&
- Write COMPLETE files — never partial, never placeholder
- Be honest in reflection — low score = retry with fix
- If this is the final step and mission is complete, add:
  <done>
    <summary>What was accomplished</summary>
    <files_changed>list of files</files_changed>
    <criteria_met>yes|no</criteria_met>
  </done>`;

const buildCriticPrompt = (
    plan: string,
    mission: string
): string => `You are VIBE Critic. Review this plan critically.

MISSION: ${mission}

PLAN TO REVIEW:
${plan}

Score the plan and output ONLY this XML:
<critique>
  <score>X</score>
  <issues>List any problems, missing steps, or risks</issues>
  <revised_plan>
    If score < 7, output a corrected plan in the same XML 
    format as the original. If score >= 7, write "APPROVED".
  </revised_plan>
</critique>

Score criteria:
9-10: Perfect, proceed immediately
7-8: Good, minor issues noted
5-6: Needs revision before proceeding
< 5: Major problems, replan required`;

const buildVerifierPrompt = (
    mission: string,
    criteria: string,
    results: string
): string => `You are VIBE Verifier. Check if the mission was accomplished.

MISSION: ${mission}
ACCEPTANCE CRITERIA: ${criteria}

EXECUTION RESULTS:
${results}

Output ONLY this XML:
<verification>
  <criteria_met>yes|no|partial</criteria_met>
  <score>X</score>
  <evidence>What evidence shows criteria was/wasn't met</evidence>
  <remaining>If partial/no: what still needs to be done</remaining>
</verification>`;

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

        const isSwarm = selectedModel?.startsWith('swarm-');
        if (isSwarm) {
            const swarm = swarms.find(s => s.id === selectedModel);
            if (swarm) {
                await runSwarm(swarm, userMsg.content);
                return;
            }
        }

        await runAgentLoop(userMsg.content, msgsWithUser);
    };

    const waitForStreamDone = (): Promise<string> => {
        return new Promise((resolve) => {
            let fullContent = '';
            const unsub = streamBus.subscribe((chunk) => {
                if (chunk.content) fullContent += chunk.content;
                if (chunk.done) {
                    unsub();
                    window.vibe.log('[STREAM] waitForStreamDone resolved');
                    resolve(fullContent);
                }
            });
        });
    };

    // ─── Helper: get think options for LLM call ──────────────────
    const getThinkOptions = () => {
        const store = useOllamaStore.getState();
        const caps = store.modelCapabilities[store.selectedModel] ?? {};
        if (!caps.think || !store.thinkEnabled) return null;
        return { enabled: true, level: store.thinkLevel };
    };

    // ─── Helper: poll terminal for command completion ────────────
    const pollTerminalOutput = async (termId: string): Promise<string> => {
        let rawOutput = '';
        let pollAttempts = 0;
        const MAX_POLL = 60; // 30 seconds max

        while (pollAttempts < MAX_POLL) {
            await new Promise(r => setTimeout(r, 500));
            rawOutput = await window.vibe.getTerminalOutput(termId);

            if (rawOutput.length > 3) {
                const lines = rawOutput.split('\n').filter(l => l.trim());
                const lastLine = lines[lines.length - 1]?.trim() || '';
                // PowerShell prompt signals command completed
                if (/^PS [A-Za-z]:\\/.test(lastLine)) break;
                // Also break if we have substantial output after 3 seconds
                if (rawOutput.length > 100 && pollAttempts >= 6) break;
            }
            pollAttempts++;
        }

        await window.vibe.clearTerminalOutput(termId);
        return cleanTerminalOutput(rawOutput);
    };

    // ─── Helper: scan project file tree ──────────────────────
    const getProjectSnapshot = async (projPath: string): Promise<string> => {
        try {
            const tId = useTerminalStore.getState().activeTerminalId;
            if (!tId) return 'Project structure unavailable';

            await window.vibe.clearTerminalOutput(tId);
            window.vibe.sendTerminalInput(
                tId,
                `cd "${projPath}"; ` +
                `Get-ChildItem -Recurse -Depth 3 ` +
                `-Exclude @('node_modules','build','dist','.git',` +
                `'__pycache__','.vibe') ` +
                `| Select-Object FullName | Format-Table -HideTableHeaders` +
                `\r`
            );

            await new Promise(r => setTimeout(r, 3000));
            const raw = await window.vibe.getTerminalOutput(tId);
            await window.vibe.clearTerminalOutput(tId);

            const lines = raw
                .split('\n')
                .map(l => l.trim())
                .filter(l => l && !l.startsWith('PS '))
                .map(l => l.replace(projPath, '').replace(/^\\/, ''))
                .filter(l => l.length > 0)
                .slice(0, 150);

            return lines.join('\n') || 'Empty project';
        } catch {
            return 'Could not scan project';
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // THE BULLETPROOF AGENTIC LOOP
    // Plan → Critic → Execute (per-step reflect+retry) → Verify
    // ═══════════════════════════════════════════════════════════════
    const runAgentLoop = async (
        userMission: string,
        baseMessages: ChatMessage[]
    ) => {
        const projectPath = useUIStore.getState().projectPath;
        const projectMemory = useUIStore.getState().projectMemory;
        const termId = useTerminalStore.getState().activeTerminalId;

        // ─── PROJECT SCAN (once at start) ──────────────────────
        useOllamaStore.getState().setAgentStatus('Scanning project...');
        useOllamaStore.getState().setIsGenerating(true);
        const projectStructure = projectPath
            ? await getProjectSnapshot(projectPath)
            : 'No project open';
        window.vibe.log(`[SCAN] Found structure:\n${projectStructure.slice(0, 500)}`);

        // ─── Obsidian: update project note ──────────────────────
        const obsidianKey = useSettingsStore.getState().apiKeys.obsidian;
        const projectName = projectPath?.split(/[/\\]/).pop() || 'Unknown';
        if (obsidianKey && projectPath) {
            window.vibe.obsidianUpdateProject(
                obsidianKey, projectName, projectStructure, projectPath
            ).catch(() => {});
        }

        // ─── PHASE 1: PLANNING ─────────────────────────────────
        useOllamaStore.getState().setAgentStatus('Planning...');
        useOllamaStore.getState().setAgentStep(0, 4);
        window.vibe.log(`[AGENT START] Mission: ${userMission.slice(0, 100)}`);
        window.vibe.log(`[PROJECT] ${projectStructure.split('\n').length} files found`);

        const plannerMessages: ChatMessage[] = [
            {
                role: 'system',
                content: buildPlannerPrompt(
                    userMission, projectPath, projectStructure, projectMemory, vibeInstructions
                )
            },
            { role: 'user', content: userMission }
        ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, plannerMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[PLAN] Failed: ${e}`);
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }

        const planResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        let planXml = extractTag(planResponse, 'plan');
        if (!planXml) {
            // Model didn't follow structure — treat whole response as plan
            planXml = planResponse;
        }

        const criteria = extractTag(planResponse, 'criteria') ||
            'Task completed successfully';

        // ─── PHASE 2: CRITIC ───────────────────────────────────
        useOllamaStore.getState().setAgentStatus('Reviewing plan...');
        useOllamaStore.getState().setAgentStep(1, 4);
        window.vibe.log(`[Agent] Phase: CRITIC`);

        const criticMessages: ChatMessage[] = [
            {
                role: 'system',
                content: buildCriticPrompt(planXml, userMission)
            },
            { role: 'user', content: 'Review this plan.' }
        ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, criticMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[CRITIC] Failed (non-blocking): ${e}`);
            // Critic failed — skip and proceed with original plan
        }

        const criticResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        const critiqueScore = parseInt(
            extractTag(criticResponse, 'score') || '8'
        );
        const revisedPlan = extractTag(criticResponse, 'revised_plan');

        window.vibe.log(`[CRITIC] Score: ${critiqueScore} | Revised: ${!!revisedPlan}`);

        if (critiqueScore < 7 && revisedPlan && revisedPlan !== 'APPROVED') {
            planXml = revisedPlan;
        }

        // Extract steps from plan
        const stepMatches = planXml.match(
            /<step[^>]*id="(\d+)"[^>]*>([\s\S]*?)<\/step>/g
        ) || [];

        const steps = stepMatches.map(stepStr => {
            const idMatch = stepStr.match(/id="(\d+)"/);
            const typeMatch = stepStr.match(/type="([^"]+)"/);
            const contentMatch = stepStr.match(/<step[^>]*>([\s\S]*?)<\/step>/);
            return {
                id: idMatch ? idMatch[1] : '1',
                type: typeMatch ? typeMatch[1] : 'execute',
                description: contentMatch ? contentMatch[1].trim() : stepStr
            };
        });

        // If no steps parsed, create a single step from the whole plan
        const executionSteps = steps.length > 0
            ? steps
            : [{ id: '1', type: 'execute', description: userMission }];

        window.vibe.log(`[PLAN] Steps: ${executionSteps.length} | Criteria: ${criteria.slice(0, 100)}`);

        // ─── PHASE 3: EXECUTE EACH STEP ────────────────────────
        useOllamaStore.getState().setAgentStep(2, 4);

        const previousResults: string[] = [];

        // Auto-cd to project at start
        if (projectPath && termId) {
            await window.vibe.clearTerminalOutput(termId);
            window.vibe.sendTerminalInput(termId, `cd "${projectPath}"\r`);
            await new Promise(r => setTimeout(r, 800));
            await window.vibe.clearTerminalOutput(termId);
        }

        for (const step of executionSteps.slice(0, MAX_STEPS)) {
            useOllamaStore.getState().setAgentStatus(
                `Step ${step.id}: ${step.description.slice(0, 50)}...`
            );
            window.vibe.log(`[STEP ${step.id}] Starting: ${step.description.slice(0, 80)}`);

            let stepSuccess = false;
            let retryCount = 0;
            let lastCritique = '';

            while (!stepSuccess && retryCount < MAX_STEP_RETRIES) {
                const executorMessages: ChatMessage[] = [
                    {
                        role: 'system',
                        content: buildExecutorPrompt(
                            userMission,
                            planXml,
                            step.description + (lastCritique
                                ? `\n\nPREVIOUS ATTEMPT FAILED: ${lastCritique}`
                                : ''),
                            step.id,
                            previousResults.slice(-3).join('\n\n'),
                            projectPath
                        )
                    },
                    {
                        role: 'user',
                        content: `Execute step ${step.id}: ${step.description}`
                    }
                ];

                useOllamaStore.getState().addMessage({
                    role: 'assistant', content: ''
                });

                try {
                    await window.vibe.chat(
                        selectedModel, executorMessages, apiKeys, getThinkOptions()
                    );
                    await waitForStreamDone();
                } catch (e) {
                    window.vibe.log(`[STEP ${step.id}] LLM call failed, retrying`);
                    retryCount++;
                    continue;
                }

                const stepResponse = useOllamaStore.getState()
                    .messages[useOllamaStore.getState().messages.length - 1]
                    ?.content || '';

                // ── Handle tool calls ─────────────────────────
                let toolResult = '';
                let toolType = 'none';

                // READ FILE
                const readMatch = stepResponse.match(
                    /<read_file\s+path=['"]([^'"]+)['"]\s*\/?>/
                );
                if (readMatch) {
                    toolType = 'read_file';
                    const filePath = readMatch[1];
                    useOllamaStore.getState().setAgentStatus(
                        `Reading: ${filePath}`
                    );
                    try {
                        const content = await window.vibe.readFile(
                            projectPath ? `${projectPath}/${filePath}` : filePath
                        );
                        toolResult = `FILE: ${filePath}\n${content}`;
                        useOllamaStore.getState().addMessage({
                            role: 'user',
                            content: `__FILE_CONTENTS__ ${filePath}\n${content}`
                        });
                    } catch {
                        toolResult = `ERROR: Could not read ${filePath}`;
                        useOllamaStore.getState().addMessage({
                            role: 'user',
                            content: `__FILE_CONTENTS__ ${filePath}\nERROR: File not found`
                        });
                    }
                }

                // WRITE FILE — handled by ChatMessages component
                const writeMatch = stepResponse.match(
                    /<write_file\s+path=['"]([^'"]+)['"]/
                );
                if (writeMatch) {
                    toolType = 'write_file';
                    toolResult = `WROTE: ${writeMatch[1]}`;
                    await new Promise(r => setTimeout(r, 500));
                }

                // EXECUTE COMMAND
                const executeMatch = stepResponse.match(
                    /<execute>([\s\S]*?)<\/execute>/
                );
                if (executeMatch && termId) {
                    toolType = 'execute';
                    const command = executeMatch[1].trim();
                    const safeCommand = sanitizeForPowerShell(command);

                    if (safeCommand !== command) {
                        window.vibe.log(
                            `[SANITIZE] Unix→PowerShell: "${command}" → "${safeCommand}"`
                        );
                    }

                    useOllamaStore.getState().setAgentStatus(
                        `Running: ${safeCommand.slice(0, 50)}`
                    );

                    await window.vibe.clearTerminalOutput(termId);
                    window.vibe.sendTerminalInput(termId, safeCommand + '\r');

                    const cleaned = await pollTerminalOutput(termId);
                    toolResult = cleaned || 'Command ran with no output';

                    window.vibe.log(`[OUTPUT] Length: ${toolResult.length} chars`);
                    window.vibe.log(`[OUTPUT] Preview: ${toolResult.slice(0, 150)}`);

                    useOllamaStore.getState().addMessage({
                        role: 'user',
                        content: `__TERMINAL_OUTPUT__\n${cleaned}`
                    });
                }

                // ANALYZE — no tool call needed
                const analyzeMatch = extractTag(stepResponse, 'analyze');
                if (analyzeMatch) {
                    toolType = 'analyze';
                    toolResult = analyzeMatch;
                }

                window.vibe.log(`[TOOL] ${toolType} | Result length: ${toolResult.length}`);

                // ── Check reflection score ─────────────────────
                const reflectionScore = parseInt(
                    extractTag(stepResponse, 'score') || '8'
                );
                const reflectionNotes = extractTag(stepResponse, 'notes') || '';
                const critique = extractTag(stepResponse, 'critique') || '';
                const shouldProceed = extractTag(stepResponse, 'proceed') !== 'no';

                window.vibe.log(`[REFLECT] Score: ${reflectionScore}/10 | Retry: ${retryCount}/${MAX_STEP_RETRIES}`);

                previousResults.push(
                    `Step ${step.id} (${step.description.slice(0, 50)}): ` +
                    `Score ${reflectionScore}/10. ${reflectionNotes}. ` +
                    `Tool result: ${toolResult.slice(0, 200)}`
                );

                // Check if mission is done
                const hasDone = /<done>[\s\S]*?<\/done>/.test(stepResponse);

                if (hasDone) {
                    const doneSummary = extractTag(stepResponse, 'summary') ||
                        'Task completed';
                    const doneFiles = extractTag(stepResponse, 'files_changed') || '';

                    // Save memory
                    if (projectPath) {
                        const newMemory = {
                            lastSession: doneSummary,
                            keyFiles: [] as string[],
                            architecturalDecisions: [] as string[],
                            currentPhase: 'development',
                            updatedAt: new Date().toISOString(),
                        };
                        window.vibe.writeMemory(projectPath, newMemory).then(() => {
                            useUIStore.getState().setProjectMemory(newMemory);
                        });
                    }

                    // Obsidian: log decision
                    if (obsidianKey && projectPath) {
                        window.vibe.obsidianLogDecision(
                            obsidianKey, projectName, doneSummary, doneFiles
                        ).catch(() => {});
                    }

                    window.vibe.log(`[Loop] Mission complete | Steps done: ${step.id}`);
                    useOllamaStore.getState().setIsGenerating(false);
                    useOllamaStore.getState().setAgentStep(0, 0);
                    useOllamaStore.getState().setAgentStatus('');
                    return;
                }

                if (reflectionScore >= REFLECTION_THRESHOLD && shouldProceed) {
                    stepSuccess = true;
                } else {
                    // Retry with critique
                    lastCritique = critique ||
                        `Score was ${reflectionScore}/10. ${reflectionNotes}`;
                    retryCount++;
                    useOllamaStore.getState().setAgentStatus(
                        `Retrying step ${step.id} (attempt ${retryCount + 1})...`
                    );
                }
            }

            if (!stepSuccess) {
                // Step failed after all retries — tell user and stop
                useOllamaStore.getState().addMessage({
                    role: 'assistant',
                    content: `⚠ Step ${step.id} failed after ${MAX_STEP_RETRIES} attempts. ` +
                        `Last issue: ${previousResults[previousResults.length - 1]}. ` +
                        `Please review and try a more specific instruction.`
                });
                window.vibe.log(`[STEP ${step.id}] FAILED after ${MAX_STEP_RETRIES} retries`);
                useOllamaStore.getState().setIsGenerating(false);
                useOllamaStore.getState().setAgentStep(0, 0);
                useOllamaStore.getState().setAgentStatus('');
                return;
            }
        }

        // ─── PHASE 4: VERIFIER ─────────────────────────────────
        useOllamaStore.getState().setAgentStatus('Verifying results...');
        useOllamaStore.getState().setAgentStep(3, 4);
        window.vibe.log(`[Agent] Phase: VERIFY`);

        const verifierMessages: ChatMessage[] = [
            {
                role: 'system',
                content: buildVerifierPrompt(
                    userMission,
                    criteria,
                    previousResults.join('\n\n')
                )
            },
            { role: 'user', content: 'Verify the mission results.' }
        ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, verifierMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[VERIFY] Failed (non-blocking): ${e}`);
        }

        const verifierResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]
            ?.content || '';

        const criteriaMet = extractTag(verifierResponse, 'criteria_met');
        const verifyScore = extractTag(verifierResponse, 'score') || '?';
        const remaining = extractTag(verifierResponse, 'remaining');

        window.vibe.log(`[VERIFY] Criteria met: ${criteriaMet} | Score: ${verifyScore}`);

        if (criteriaMet === 'no' && remaining) {
            useOllamaStore.getState().setAgentStatus(
                'Mission incomplete — informing user...'
            );
            useOllamaStore.getState().addMessage({
                role: 'assistant',
                content: `⚠ Mission partially complete. Still needed:\n${remaining}\n\n` +
                    `Reply to continue or adjust the approach.`
            });
        }

        // Save final memory
        if (projectPath) {
            const finalSummary = previousResults.slice(-2).join(' | ');
            const newMemory = {
                lastSession: finalSummary.slice(0, 500),
                keyFiles: [] as string[],
                architecturalDecisions: [] as string[],
                currentPhase: 'development',
                updatedAt: new Date().toISOString(),
            };
            window.vibe.writeMemory(projectPath, newMemory).then(() => {
                useUIStore.getState().setProjectMemory(newMemory);
            });
        }

        // Obsidian: log agent run
        const stepDescriptions = executionSteps.map(s => s.description);
        if (obsidianKey && projectPath) {
            window.vibe.obsidianLogRun(
                obsidianKey,
                projectName,
                userMission,
                selectedModel,
                stepDescriptions,
                previousResults.slice(-1)[0] || 'No result',
                criteriaMet || 'unknown'
            ).catch(() => {});
        }

        window.vibe.log(`[AGENT END] Mission: ${userMission.slice(0, 50)} | Steps completed: ${executionSteps.length}`);
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
