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
    repairCandidates: Array<{
        rank: number;
        score: number;
        rationale: string;
        preset: Omit<SwarmConfig, 'id'>;
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
    preferredModel?: string;
    modelPool?: string[];
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

const buildCandidateAgents = (
    mode: 'balanced' | 'verification-heavy' | 'debug-first' | 'fast-patch',
    modelAt: (idx: number) => string,
): AgentNode[] => {
    if (mode === 'verification-heavy') {
        return [
            makeAgent(1, 'Architect', modelAt(0)),
            makeAgent(2, 'Coder', modelAt(1), [1]),
            makeAgent(3, 'Tester', modelAt(2), [2]),
            makeAgent(4, 'Reviewer', modelAt(3), [3]),
        ];
    }

    if (mode === 'debug-first') {
        return [
            makeAgent(1, 'Architect', modelAt(0)),
            makeAgent(2, 'Coder', modelAt(1), [1]),
            makeAgent(3, 'Debugger', modelAt(2), [2]),
            makeAgent(4, 'Reviewer', modelAt(3), [3]),
        ];
    }

    if (mode === 'fast-patch') {
        return [
            makeAgent(1, 'Architect', modelAt(0)),
            makeAgent(2, 'Coder', modelAt(1), [1]),
            makeAgent(3, 'Reviewer', modelAt(2), [2]),
        ];
    }

    return [
        makeAgent(1, 'Architect', modelAt(0)),
        makeAgent(2, 'Coder', modelAt(1), [1]),
        makeAgent(3, 'Debugger', modelAt(2), [2]),
        makeAgent(4, 'Tester', modelAt(3), [3]),
        makeAgent(5, 'Reviewer', modelAt(4), [4]),
    ];
};

const scoreCandidate = (
    agents: AgentNode[],
    needsTester: boolean,
    needsDebugger: boolean,
    status: 'failed' | 'partial',
): number => {
    let score = 0.6;
    const roles = new Set(agents.map(a => a.role));

    if (roles.has('Reviewer')) score += 0.06;
    if (needsTester && roles.has('Tester')) score += 0.18;
    if (needsDebugger && roles.has('Debugger')) score += 0.18;
    if (status === 'partial' && roles.has('Tester')) score += 0.03;

    const extraAgents = Math.max(0, agents.length - 4);
    score -= extraAgents * 0.05;

    return Math.max(0.05, Math.min(0.99, Number(score.toFixed(3))));
};

const rationaleForMode = (mode: 'balanced' | 'verification-heavy' | 'debug-first' | 'fast-patch'): string => {
    switch (mode) {
        case 'verification-heavy':
            return 'Prioritizes validation confidence by introducing a dedicated Tester gate before final review.';
        case 'debug-first':
            return 'Prioritizes error isolation by inserting a Debugger before final review.';
        case 'fast-patch':
            return 'Minimizes latency with a compact pipeline focused on rapid patch and review.';
        default:
            return 'Balanced candidate combining debugging, testing, and final review with stronger dependency ordering.';
    }
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
        preferredModel,
        modelPool,
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

    const normalizedPool = Array.from(new Set([
        preferredModel || '',
        ...(modelPool || []),
    ].map(m => String(m || '').trim()).filter(Boolean)));
    const fallbackModel = preferredModel?.trim() || normalizedPool[0] || 'model:auto';
    const resolvedModelPool = normalizedPool.length > 0 ? normalizedPool : [fallbackModel];

    const candidateModes: Array<'balanced' | 'verification-heavy' | 'debug-first' | 'fast-patch'> = [
        'balanced',
        'verification-heavy',
        'debug-first',
        'fast-patch',
    ];

    const repairCandidates = candidateModes.map((mode, modeIdx) => {
        const modelAt = (idx: number) => resolvedModelPool[(modeIdx + idx) % resolvedModelPool.length] || fallbackModel;
        const agents = buildCandidateAgents(mode, modelAt);
        const score = scoreCandidate(agents, needsTester || status === 'partial', needsDebugger, status);
        return {
            rank: 0,
            score,
            rationale: rationaleForMode(mode),
            preset: {
                name: `Repair Preset (${mode}): ${mission.slice(0, 28)}`,
                agents,
            },
        };
    }).sort((a, b) => b.score - a.score || a.preset.agents.length - b.preset.agents.length)
      .map((candidate, idx) => ({ ...candidate, rank: idx + 1 }));

    const suggestedSwarmPreset = repairCandidates[0]?.preset || {
        name: `Repair Preset: ${mission.slice(0, 36)}`,
        agents: buildCandidateAgents('balanced', () => fallbackModel),
    };

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
        repairCandidates,
        suggestedSwarmPreset,
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
