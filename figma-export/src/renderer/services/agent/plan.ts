export interface PlanStep {
    id: string;
    type: string;
    description: string;
    dependsOn: string[];
}

export function parsePlanSteps(planXml: string, userMission: string): PlanStep[] {
    const stepMatches = planXml.match(/<step[^>]*id="(\d+)"[^>]*>[\s\S]*?<\/step>/g) || [];
    const parsed = stepMatches.map(stepStr => {
        const idMatch = stepStr.match(/id="(\d+)"/);
        const typeMatch = stepStr.match(/type="([^"]+)"/);
        const dependsMatch = stepStr.match(/depends="([^"]+)"/);
        const contentMatch = stepStr.match(/<step[^>]*>([\s\S]*?)<\/step>/);
        const dependsOn = dependsMatch
            ? dependsMatch[1].split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
            : [];

        return {
            id: idMatch ? idMatch[1] : '1',
            type: typeMatch ? typeMatch[1] : 'execute',
            description: contentMatch ? contentMatch[1].trim() : stepStr,
            dependsOn,
        };
    });

    if (parsed.length > 0) return parsed;
    return [{ id: '1', type: 'execute', description: userMission, dependsOn: [] }];
}

export function buildExecutionWaves(steps: PlanStep[]): PlanStep[][] {
    const byId = new Map(steps.map(s => [s.id, s]));
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const step of steps) {
        const validDeps = step.dependsOn.filter(dep => byId.has(dep));
        indegree.set(step.id, validDeps.length);
        for (const dep of validDeps) {
            const list = outgoing.get(dep) || [];
            list.push(step.id);
            outgoing.set(dep, list);
        }
    }

    const waves: PlanStep[][] = [];
    let queue = steps.filter(s => (indegree.get(s.id) || 0) === 0).map(s => s.id);
    const visited = new Set<string>();

    while (queue.length > 0) {
        const currentWaveIds = [...queue];
        queue = [];
        const waveSteps: PlanStep[] = [];

        for (const id of currentWaveIds) {
            if (visited.has(id)) continue;
            visited.add(id);
            const step = byId.get(id);
            if (!step) continue;
            waveSteps.push(step);

            for (const nextId of outgoing.get(id) || []) {
                const nextIn = (indegree.get(nextId) || 0) - 1;
                indegree.set(nextId, nextIn);
                if (nextIn === 0) queue.push(nextId);
            }
        }

        if (waveSteps.length > 0) waves.push(waveSteps);
    }

    if (visited.size !== steps.length) {
        return [steps];
    }

    return waves;
}
