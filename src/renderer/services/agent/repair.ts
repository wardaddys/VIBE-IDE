import type { PlanStep } from './plan';
import type { AgentNode, SwarmConfig } from '../../store/swarms';

export interface RepairVerificationSnapshot {
    criteriaMet?: string | null;
    score?: string | null;
    remaining?: string | null;
    evidence?: string | null;
}

export interface SwarmRepairArtifact {
    id: string;
    generatedAt: string;
    runId: string;
    status: 'failed' | 'partial';
    mission: string;
    criteria: string;
    verification: RepairVerificationSnapshot;
    diagnosis: {
        summary: string;
        likelyCauses: string[];
        confidence: number;
    };
    suggestedChanges: Array<{
        type: 'prompt_patch' | 'add_role' | 'dependency_patch' | 'model_shift';
        message: string;
    }>;
    suggestedSwarmPreset: Omit<SwarmConfig, 'id'>;
    executionContext: {
        recentResults: string[];
        planSteps: Array<{ id: string; type: string; description: string; dependsOn: string[] }>;
    };
}

interface BuildRepairArtifactInput {
    runId: string;
    mission: string;
    criteria: string;
    status: 'failed' | 'partial';
    verification: RepairVerificationSnapshot;
    previousResults: string[];
    planSteps: PlanStep[];
}

const makeAgent = (id: number, role: string, model: string, dependsOn?: number[]): AgentNode => ({
    id,
    role,
    model,
    ...(dependsOn && dependsOn.length > 0 ? { dependsOn } : {}),
});

const detectNeedsTester = (text: string): boolean => {
    return /(test|regression|verify|typecheck|lint|failing|failure|assert)/i.test(text);
};

const detectNeedsDebugger = (text: string): boolean => {
    return /(error|exception|stack|crash|bug|retry|timeout|failed after)/i.test(text);
};

export function buildSwarmRepairArtifact(input: BuildRepairArtifactInput): SwarmRepairArtifact {
    const {
        runId,
        mission,
        criteria,
        status,
        verification,
        previousResults,
        planSteps,
    } = input;

    const combinedFailureText = [
        verification.remaining || '',
        verification.evidence || '',
        ...previousResults.slice(-4),
    ].join('\n');

    const needsTester = detectNeedsTester(combinedFailureText);
    const needsDebugger = detectNeedsDebugger(combinedFailureText);

    const likelyCauses: string[] = [];
    likelyCauses.push('Execution path likely lacked a strict failure-isolation role before final verification.');
    if (needsTester) {
        likelyCauses.push('Verification/test intent appeared late; adding a dedicated tester role should catch regressions earlier.');
    }
    if (needsDebugger) {
        likelyCauses.push('Error-heavy output suggests dedicated debugging and tighter dependency ordering are needed.');
    }

    const suggestedChanges: SwarmRepairArtifact['suggestedChanges'] = [
        {
            type: 'dependency_patch',
            message: 'Force implementation outputs through a verification gate before completion.',
        },
        {
            type: 'prompt_patch',
            message: 'Require explicit evidence summaries after each role execution.',
        },
    ];

    if (needsDebugger) {
        suggestedChanges.push({
            type: 'add_role',
            message: 'Add Debugger role between implementation and test/review stages.',
        });
    }
    if (needsTester) {
        suggestedChanges.push({
            type: 'add_role',
            message: 'Add Tester role to run validation commands before done criteria.',
        });
    }

    const baseModel = 'gemini-1.5-flash';
    const agents: AgentNode[] = [
        makeAgent(1, 'Architect', baseModel),
        makeAgent(2, 'Coder', baseModel, [1]),
    ];

    if (needsDebugger) {
        agents.push(makeAgent(3, 'Debugger', baseModel, [2]));
    }

    const testerDependsOn = agents[agents.length - 1]?.id ?? 2;
    if (needsTester || status === 'partial') {
        agents.push(makeAgent(agents.length + 1, 'Tester', baseModel, [testerDependsOn]));
    }

    const finalDependsOn = agents[agents.length - 1]?.id ?? 2;
    agents.push(makeAgent(agents.length + 1, 'Reviewer', baseModel, [finalDependsOn]));

    const confidence = Math.min(0.95, Math.max(0.55, 0.6 + (needsTester ? 0.1 : 0) + (needsDebugger ? 0.1 : 0)));

    return {
        id: `repair-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        runId,
        status,
        mission,
        criteria,
        verification,
        diagnosis: {
            summary: status === 'partial'
                ? 'Run was partially successful but lacked a robust verification/closure structure.'
                : 'Run failed verification and needs a stronger role graph and stricter sequencing.',
            likelyCauses,
            confidence,
        },
        suggestedChanges,
        suggestedSwarmPreset: {
            name: `Repair Preset: ${mission.slice(0, 36)}`,
            agents,
        },
        executionContext: {
            recentResults: previousResults.slice(-8),
            planSteps: planSteps.map(step => ({
                id: step.id,
                type: step.type,
                description: step.description,
                dependsOn: step.dependsOn,
            })),
        },
    };
}

export async function persistSwarmRepairArtifact(projectPath: string | null, artifact: SwarmRepairArtifact): Promise<void> {
    if (!projectPath) return;

    const dir = `${projectPath}/.vibe/swarm-repairs`;
    const artifactPath = `${dir}/${artifact.id}.json`;
    const latestPath = `${dir}/latest.json`;

    await window.vibe.writeFile(artifactPath, JSON.stringify(artifact, null, 2));
    await window.vibe.writeFile(latestPath, JSON.stringify(artifact, null, 2));
}
