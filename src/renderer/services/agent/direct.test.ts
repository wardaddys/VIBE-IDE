import { describe, expect, it } from 'vitest';
import { buildDirectSystemPrompt } from './direct';

describe('direct service', () => {
    it('builds grounded direct-chat prompt with project rules and briefing', () => {
        const prompt = buildDirectSystemPrompt(
            'Always run tests before final response.',
            '\nPROJECT BRIEFING (from background intelligence):\nCore flow is in ChatBar\n',
        );

        expect(prompt).toContain('You are VIBE Chat Assistant running inside the VIBE IDE desktop app.');
        expect(prompt).toContain('Never claim you are outside the IDE');
        expect(prompt).toContain('PROJECT RULES:\nAlways run tests before final response.\n');
        expect(prompt).toContain('PROJECT BRIEFING (from background intelligence):');
    });

    it('omits project rules block when instructions are absent', () => {
        const prompt = buildDirectSystemPrompt(null, '');
        expect(prompt).not.toContain('PROJECT RULES:');
        expect(prompt).toContain('Respond naturally and helpfully.');
    });
});
