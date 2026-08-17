import { describe, expect, it } from 'vitest';
import { computeAgentWaves } from './swarm';

describe('swarm service', () => {
    it('computes dependency waves', () => {
        const agents = [
            { id: 1, role: 'Architect', model: 'a' },
            { id: 2, role: 'Coder', model: 'b', dependsOn: [1] },
            { id: 3, role: 'Reviewer', model: 'c', dependsOn: [1] },
            { id: 4, role: 'Integrator', model: 'd', dependsOn: [2, 3] },
        ];

        const withWaves = computeAgentWaves(agents);
        const wavesById = Object.fromEntries(withWaves.map(a => [a.id, a.wave]));

        expect(wavesById[1]).toBe(0);
        expect(wavesById[2]).toBe(1);
        expect(wavesById[3]).toBe(1);
        expect(wavesById[4]).toBe(2);
    });

    it('handles missing dependency ids as zero-wave deps', () => {
        const agents = [
            { id: 1, role: 'A', model: 'm', dependsOn: [99] },
        ];

        const withWaves = computeAgentWaves(agents);
        expect(withWaves[0].wave).toBe(0);
    });
});
