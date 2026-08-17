import { buildExecutionWaves, parsePlanSteps } from './plan';
import { describe, expect, it } from 'vitest';

describe('plan service', () => {
    it('parses xml steps with dependencies', () => {
        const planXml = `
<plan>
  <steps>
    <step id="1" type="read_file">read a</step>
    <step id="2" depends="1" type="execute">run b</step>
    <step id="3" depends="1,2" type="write_file">write c</step>
  </steps>
</plan>`;

        const steps = parsePlanSteps(planXml, 'fallback');
        expect(steps).toHaveLength(3);
        expect(steps[2].dependsOn).toEqual(['1', '2']);
    });

    it('builds dependency waves in topological order', () => {
        const steps = [
            { id: '1', type: 'analyze', description: 'A', dependsOn: [] },
            { id: '2', type: 'analyze', description: 'B', dependsOn: ['1'] },
            { id: '3', type: 'analyze', description: 'C', dependsOn: ['1'] },
            { id: '4', type: 'analyze', description: 'D', dependsOn: ['2', '3'] },
        ];

        const waves = buildExecutionWaves(steps);
        expect(waves.map(w => w.map(s => s.id))).toEqual([
            ['1'],
            ['2', '3'],
            ['4'],
        ]);
    });

    it('falls back to single mission step when parsing fails', () => {
        const steps = parsePlanSteps('not xml', 'do mission');
        expect(steps).toEqual([
            { id: '1', type: 'execute', description: 'do mission', dependsOn: [] },
        ]);
    });

    it('falls back to single wave when dependency graph is cyclic', () => {
        const cyclic = [
            { id: '1', type: 'execute', description: 'A', dependsOn: ['2'] },
            { id: '2', type: 'execute', description: 'B', dependsOn: ['1'] },
        ];
        const waves = buildExecutionWaves(cyclic);
        expect(waves).toEqual([cyclic]);
    });
});
