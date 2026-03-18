import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { useTerminalStore } from '../../store/terminal';
import { useUIStore } from '../../store/ui';
import { buildExecutionWaves, parsePlanSteps, type PlanStep } from './plan';
import { buildCriticPrompt, buildExecutorPrompt, buildPlannerPrompt, buildVerifierPrompt } from './prompts';
import { extractTag } from './xml';
import { sanitizeForPowerShell } from '../../utils/commandSanitizer';
import { buildSwarmRepairArtifact, persistSwarmRepairArtifact } from './repair';

const MAX_STEP_RETRIES = 3;
const MAX_STEPS = 12;
const REFLECTION_THRESHOLD = 7;

interface VerificationSnapshot {
    criteriaMet?: string | null;
    score?: string | null;
    remaining?: string | null;
}

export interface RunAgentLoopDeps {
    selectedModel: string;
    apiKeys: Record<string, string>;
    vibeInstructions: string | null;
    shouldStop: () => boolean;
    getThinkOptions: () => { enabled: boolean; level: 'low' | 'medium' | 'high' } | null;
    waitForStreamDone: (timeoutMs?: number) => Promise<string>;
    getProjectSnapshot: (projectPath: string) => Promise<string>;
    getBriefingContext: () => Promise<string>;
    pollTerminalOutput: (termId: string) => Promise<string>;
}

export async function runAgentLoop(userMission: string, deps: RunAgentLoopDeps): Promise<void> {
    const {
        selectedModel,
        apiKeys,
        vibeInstructions,
        shouldStop,
        getThinkOptions,
        waitForStreamDone,
        getProjectSnapshot,
        getBriefingContext,
        pollTerminalOutput,
    } = deps;

    const projectPath = useUIStore.getState().projectPath;
    const projectMemory = useUIStore.getState().projectMemory;
    const termId = useTerminalStore.getState().activeTerminalId;

    try {
        if (shouldStop()) return;

        useOllamaStore.getState().setAgentStatus('Scanning project...');
        useOllamaStore.getState().setIsGenerating(true);
        const projectStructure = projectPath
            ? await getProjectSnapshot(projectPath)
            : 'No project open';
        if (shouldStop()) return;
        window.vibe.log(`[SCAN] Found structure:\n${projectStructure.slice(0, 500)}`);

        const briefingContext = await getBriefingContext();
        if (shouldStop()) return;
        window.vibe.log(`[BRIEFING] ${briefingContext ? 'Loaded ✓' : 'Not available'}`);

        const obsidianKey = useSettingsStore.getState().apiKeys.obsidian;
        const projectName = projectPath?.split(/[/\\]/).pop() || 'Unknown';
        if (obsidianKey && projectPath) {
            window.vibe.obsidianUpdateProject(
                obsidianKey, projectName, projectStructure, projectPath
            ).catch(() => {});
        }

        useOllamaStore.getState().setAgentStatus('Planning...');
        useOllamaStore.getState().setAgentStep(0, 4);
        window.vibe.log(`[AGENT START] Mission: ${userMission.slice(0, 100)}`);
        window.vibe.log(`[PROJECT] ${projectStructure.split('\n').length} files found`);

        const plannerMessages = [
        {
            role: 'system' as const,
            content: buildPlannerPrompt(
                userMission,
                projectPath,
                projectStructure,
                projectMemory,
                vibeInstructions,
                briefingContext,
            ),
        },
        { role: 'user' as const, content: userMission },
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
        if (shouldStop()) return;

        const planResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        let planXml = extractTag(planResponse, 'plan');
        if (!planXml) {
            planXml = planResponse;
        }

        const criteria = extractTag(planResponse, 'criteria') || 'Task completed successfully';
        const planRunId = `plan-${Date.now()}`;
        const planPath = projectPath ? `${projectPath}/.vibe/plans/${planRunId}.json` : null;
        const statePath = projectPath ? `${projectPath}/.vibe/STATE.json` : null;

        const persistPlanArtifacts = async (
        planSteps: PlanStep[],
        status: 'running' | 'completed' | 'failed',
        verification?: VerificationSnapshot,
    ) => {
        if (!projectPath || !planPath || !statePath) return;

        const stepStatus = planSteps.map(s => ({
            id: s.id,
            type: s.type,
            description: s.description,
            dependsOn: s.dependsOn,
        }));

        await window.vibe.writeFile(planPath, JSON.stringify({
            id: planRunId,
            mission: userMission,
            createdAt: new Date().toISOString(),
            status,
            criteria,
            steps: stepStatus,
            verification: verification || null,
        }, null, 2));

        await window.vibe.writeFile(statePath, JSON.stringify({
            updatedAt: new Date().toISOString(),
            activePlanId: status === 'running' ? planRunId : null,
            lastPlanId: planRunId,
            mission: userMission,
            status,
            criteria,
            verification: verification || null,
        }, null, 2));
    };

        useOllamaStore.getState().setAgentStatus('Reviewing plan...');
    useOllamaStore.getState().setAgentStep(1, 4);
    window.vibe.log('[Agent] Phase: CRITIC');

        const criticMessages = [
        { role: 'system' as const, content: buildCriticPrompt(planXml, userMission) },
        { role: 'user' as const, content: 'Review this plan.' },
    ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, criticMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[CRITIC] Failed (non-blocking): ${e}`);
        }
        if (shouldStop()) return;

        const criticResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        const critiqueScore = parseInt(extractTag(criticResponse, 'score') || '8');
        const revisedPlan = extractTag(criticResponse, 'revised_plan');

        window.vibe.log(`[CRITIC] Score: ${critiqueScore} | Revised: ${!!revisedPlan}`);

        if (critiqueScore < 7 && revisedPlan && revisedPlan !== 'APPROVED') {
            planXml = revisedPlan;
        }

        const executionSteps = parsePlanSteps(planXml, userMission);
        const executionWaves = buildExecutionWaves(executionSteps);
        await persistPlanArtifacts(executionSteps, 'running');

        window.vibe.log(`[PLAN] Steps: ${executionSteps.length} | Waves: ${executionWaves.length} | Criteria: ${criteria.slice(0, 100)}`);

        useOllamaStore.getState().setAgentStep(2, 4);

        const previousResults: string[] = [];

        const persistRepairArtifact = async (
            status: 'failed' | 'partial',
            verification: VerificationSnapshot & { evidence?: string | null },
        ) => {
            const artifact = buildSwarmRepairArtifact({
                runId: planRunId,
                mission: userMission,
                criteria,
                status,
                verification: {
                    criteriaMet: verification.criteriaMet ?? null,
                    score: verification.score ?? null,
                    remaining: verification.remaining ?? null,
                    evidence: verification.evidence ?? null,
                },
                previousResults,
                planSteps: executionSteps,
            });
            await persistSwarmRepairArtifact(projectPath, artifact);
            window.vibe.log(`[REPAIR] Generated ${artifact.id}`);
        };

        if (projectPath && termId) {
            await window.vibe.clearTerminalOutput(termId);
            window.vibe.sendTerminalInput(termId, `cd "${projectPath}"\r`);
            await new Promise(r => setTimeout(r, 800));
            await window.vibe.clearTerminalOutput(termId);
        }

        for (let waveIdx = 0; waveIdx < executionWaves.length; waveIdx++) {
        if (shouldStop()) return;
        const wave = executionWaves[waveIdx].slice(0, MAX_STEPS);
        window.vibe.log(`[WAVE ${waveIdx + 1}] ${wave.map(s => s.id).join(', ')}`);

        for (const step of wave) {
            if (shouldStop()) return;
            useOllamaStore.getState().setAgentStatus(`Step ${step.id}: ${step.description.slice(0, 50)}...`);
            window.vibe.log(`[STEP ${step.id}] Starting: ${step.description.slice(0, 80)}`);

            let stepSuccess = false;
            let retryCount = 0;
            let lastCritique = '';

            while (!stepSuccess && retryCount < MAX_STEP_RETRIES) {
                if (shouldStop()) return;
                const executorMessages = [
                    {
                        role: 'system' as const,
                        content: buildExecutorPrompt(
                            userMission,
                            planXml,
                            step.description + (lastCritique ? `\n\nPREVIOUS ATTEMPT FAILED: ${lastCritique}` : ''),
                            previousResults.slice(-3).join('\n\n'),
                            projectPath,
                        ),
                    },
                    { role: 'user' as const, content: `Execute step ${step.id}: ${step.description}` },
                ];

                useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

                try {
                    await window.vibe.chat(selectedModel, executorMessages, apiKeys, getThinkOptions());
                    await waitForStreamDone();
                } catch {
                    window.vibe.log(`[STEP ${step.id}] LLM call failed, retrying`);
                    retryCount++;
                    continue;
                }
                if (shouldStop()) return;

                const stepResponse = useOllamaStore.getState().messages[useOllamaStore.getState().messages.length - 1]?.content || '';

                let toolResult = '';
                let toolType = 'none';

                const readMatch = stepResponse.match(/<read_file\s+path=['"]([^'"]+)['"]\s*\/?>/);
                if (readMatch) {
                    toolType = 'read_file';
                    const filePath = readMatch[1];
                    useOllamaStore.getState().setAgentStatus(`Reading: ${filePath}`);
                    try {
                        const content = await window.vibe.readFile(projectPath ? `${projectPath}/${filePath}` : filePath);
                        toolResult = `FILE: ${filePath}\n${content}`;
                        useOllamaStore.getState().addMessage({ role: 'user', content: `__FILE_CONTENTS__ ${filePath}\n${content}` });
                    } catch {
                        toolResult = `ERROR: Could not read ${filePath}`;
                        useOllamaStore.getState().addMessage({ role: 'user', content: `__FILE_CONTENTS__ ${filePath}\nERROR: File not found` });
                    }
                }

                const writeMatch = stepResponse.match(/<write_file\s+path=['"]([^'"]+)['"]/);
                if (writeMatch) {
                    toolType = 'write_file';
                    toolResult = `WROTE: ${writeMatch[1]}`;
                    await new Promise(r => setTimeout(r, 500));
                }

                const executeMatch = stepResponse.match(/<execute>([\s\S]*?)<\/execute>/);
                if (executeMatch && termId) {
                    toolType = 'execute';
                    const command = executeMatch[1].trim();
                    const safeCommand = sanitizeForPowerShell(command);

                    if (safeCommand !== command) {
                        window.vibe.log(`[SANITIZE] Unix→PowerShell: "${command}" → "${safeCommand}"`);
                    }

                    useOllamaStore.getState().setAgentStatus(`Running: ${safeCommand.slice(0, 50)}`);
                    await window.vibe.clearTerminalOutput(termId);
                    window.vibe.sendTerminalInput(termId, safeCommand + '\r');

                    const cleaned = await pollTerminalOutput(termId);
                    if (shouldStop()) return;
                    toolResult = cleaned || 'Command ran with no output';

                    window.vibe.log(`[OUTPUT] Length: ${toolResult.length} chars`);
                    window.vibe.log(`[OUTPUT] Preview: ${toolResult.slice(0, 150)}`);

                    useOllamaStore.getState().addMessage({ role: 'user', content: `__TERMINAL_OUTPUT__\n${cleaned}` });
                }

                const analyzeMatch = extractTag(stepResponse, 'analyze');
                if (analyzeMatch) {
                    toolType = 'analyze';
                    toolResult = analyzeMatch;
                }

                window.vibe.log(`[TOOL] ${toolType} | Result length: ${toolResult.length}`);

                const reflectionScore = parseInt(extractTag(stepResponse, 'score') || '8');
                const reflectionNotes = extractTag(stepResponse, 'notes') || '';
                const critique = extractTag(stepResponse, 'critique') || '';
                const shouldProceed = extractTag(stepResponse, 'proceed') !== 'no';

                window.vibe.log(`[REFLECT] Score: ${reflectionScore}/10 | Retry: ${retryCount}/${MAX_STEP_RETRIES}`);

                previousResults.push(
                    `Step ${step.id} (${step.description.slice(0, 50)}): ` +
                    `Score ${reflectionScore}/10. ${reflectionNotes}. ` +
                    `Tool result: ${toolResult.slice(0, 200)}`,
                );

                const hasDone = /<done>[\s\S]*?<\/done>/.test(stepResponse);

                if (hasDone) {
                    const doneSummary = extractTag(stepResponse, 'summary') || 'Task completed';
                    const doneFiles = extractTag(stepResponse, 'files_changed') || '';

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

                    if (obsidianKey && projectPath) {
                        window.vibe.obsidianLogDecision(obsidianKey, projectName, doneSummary, doneFiles).catch(() => {});
                    }

                    await persistPlanArtifacts(executionSteps, 'completed', {
                        criteriaMet: 'yes',
                        score: '10',
                        remaining: null,
                    });

                    window.vibe.log(`[Loop] Mission complete | Steps done: ${step.id}`);
                    useOllamaStore.getState().setIsGenerating(false);
                    useOllamaStore.getState().setAgentStep(0, 0);
                    useOllamaStore.getState().setAgentStatus('');
                    return;
                }

                if (reflectionScore >= REFLECTION_THRESHOLD && shouldProceed) {
                    stepSuccess = true;
                } else {
                    lastCritique = critique || `Score was ${reflectionScore}/10. ${reflectionNotes}`;
                    retryCount++;
                    useOllamaStore.getState().setAgentStatus(`Retrying step ${step.id} (attempt ${retryCount + 1})...`);
                }
            }

            window.vibe.logAgentAction(`Step ${step.id}: ${step.description.slice(0, 100)}`).catch(() => {});

            if (!stepSuccess) {
                useOllamaStore.getState().addMessage({
                    role: 'assistant',
                    content:
                        `⚠ Step ${step.id} failed after ${MAX_STEP_RETRIES} attempts. ` +
                        `Last issue: ${previousResults[previousResults.length - 1]}. ` +
                        `Please review and try a more specific instruction.`,
                });
                window.vibe.log(`[STEP ${step.id}] FAILED after ${MAX_STEP_RETRIES} retries`);
                await persistPlanArtifacts(executionSteps, 'failed', {
                    criteriaMet: 'no',
                    score: '0',
                    remaining: `Step ${step.id} failed after retries.`,
                });
                await persistRepairArtifact('failed', {
                    criteriaMet: 'no',
                    score: '0',
                    remaining: `Step ${step.id} failed after retries.`,
                    evidence: previousResults[previousResults.length - 1] || null,
                });
                useOllamaStore.getState().setIsGenerating(false);
                useOllamaStore.getState().setAgentStep(0, 0);
                useOllamaStore.getState().setAgentStatus('');
                return;
            }
        }
    }

        useOllamaStore.getState().setAgentStatus('Verifying results...');
    useOllamaStore.getState().setAgentStep(3, 4);
    window.vibe.log('[Agent] Phase: VERIFY');

        const verifierMessages = [
        {
            role: 'system' as const,
            content: buildVerifierPrompt(userMission, criteria, previousResults.join('\n\n')),
        },
        { role: 'user' as const, content: 'Verify the mission results.' },
    ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, verifierMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[VERIFY] Failed (non-blocking): ${e}`);
        }
        if (shouldStop()) return;

        const verifierResponse = useOllamaStore.getState().messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        const criteriaMet = extractTag(verifierResponse, 'criteria_met');
        const verifyScore = extractTag(verifierResponse, 'score') || '?';
        const remaining = extractTag(verifierResponse, 'remaining');

        await persistPlanArtifacts(executionSteps, criteriaMet === 'yes' ? 'completed' : 'failed', {
            criteriaMet,
            score: verifyScore,
            remaining: remaining || null,
        });

        if (projectPath) {
            await window.vibe.writeFile(`${projectPath}/.vibe/verification.latest.json`, JSON.stringify({
                mission: userMission,
                generatedAt: new Date().toISOString(),
                criteriaMet,
                score: verifyScore,
                remaining: remaining || null,
                evidence: extractTag(verifierResponse, 'evidence') || null,
            }, null, 2));
        }

        window.vibe.log(`[VERIFY] Criteria met: ${criteriaMet} | Score: ${verifyScore}`);

        if (criteriaMet === 'no' && remaining) {
            useOllamaStore.getState().setAgentStatus('Mission incomplete — informing user...');
            useOllamaStore.getState().addMessage({
                role: 'assistant',
                content:
                    `⚠ Mission partially complete. Still needed:\n${remaining}\n\n` +
                    'Reply to continue or adjust the approach.',
            });
        }

        if (criteriaMet !== 'yes') {
            await persistRepairArtifact(criteriaMet === 'partial' ? 'partial' : 'failed', {
                criteriaMet,
                score: verifyScore,
                remaining: remaining || null,
                evidence: extractTag(verifierResponse, 'evidence') || null,
            });
        }

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

        const stepDescriptions = executionSteps.map(s => s.description);
        if (obsidianKey && projectPath) {
            window.vibe.obsidianLogRun(
                obsidianKey,
                projectName,
                userMission,
                selectedModel,
                stepDescriptions,
                previousResults.slice(-1)[0] || 'No result',
                criteriaMet || 'unknown',
            ).catch(() => {});
        }

        window.vibe.log(`[AGENT END] Mission: ${userMission.slice(0, 50)} | Steps completed: ${executionSteps.length}`);
        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    } finally {
        if (shouldStop()) {
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
        }
    }
}
