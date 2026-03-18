import { describe, expect, it } from 'vitest';
import { buildSwarmRepairArtifact } from './repair';

describe('swarm repair service', () => {
    it('builds partial repair artifact with tester role when verification hints mention tests', () => {
        const artifact = buildSwarmRepairArtifact({
            runId: 'plan-123',
            mission: 'Fix flaky tests in auth flow',
            criteria: 'All tests should pass',
            status: 'partial',
            verification: {
                criteriaMet: 'partial',
                score: '6',
                remaining: 'Tests still fail intermittently in CI',
                evidence: 'Unit tests failed: auth/session timeout',
            },
            previousResults: [
                'Step 2: implementation completed',
                'Step 3: test command failed',
            ],
            planSteps: [
                { id: '1', type: 'analyze', description: 'Inspect auth flow', dependsOn: [] },
                { id: '2', type: 'write_file', description: 'Patch auth handler', dependsOn: ['1'] },
            ],
        });

        expect(artifact.status).toBe('partial');
        expect(artifact.suggestedSwarmPreset.name).toContain('Repair Preset');
        expect(artifact.suggestedSwarmPreset.agents.some(a => a.role === 'Tester')).toBe(true);
        expect(artifact.suggestedChanges.some(c => c.type === 'add_role')).toBe(true);
    });

    it('includes debugger role when failure context indicates hard errors', () => {
        const artifact = buildSwarmRepairArtifact({
            runId: 'plan-456',
            mission: 'Fix startup crash',
            criteria: 'App starts without crashing',
            status: 'failed',
            verification: {
                criteriaMet: 'no',
                score: '2',
                remaining: 'Still crashes with exception after retries',
                evidence: 'Unhandled exception in bootstrap',
            },
            previousResults: [
                'Step failed after retries',
            ],
            planSteps: [
                { id: '1', type: 'execute', description: 'Run app', dependsOn: [] },
            ],
        });

        expect(artifact.status).toBe('failed');
        expect(artifact.suggestedSwarmPreset.agents.some(a => a.role === 'Debugger')).toBe(true);
        expect(artifact.diagnosis.confidence).toBeGreaterThanOrEqual(0.55);
        expect(artifact.executionContext.planSteps).toHaveLength(1);
    });
});
