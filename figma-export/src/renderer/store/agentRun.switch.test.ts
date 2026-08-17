/* Regression tests for the "response gets cut when you switch chats mid-stream"
   bug: deltas must keep accumulating into their own conversation while another
   one is on screen, and the full transcript must come back on restore. */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentRunStore } from './agentRun';

const reset = () => {
    useAgentRunStore.setState({
        surface: 'cowork', model: 'm', sessions: {},
        items: [], runId: null, running: false,
        currentAssistantId: null, currentThinkingId: null, currentModel: '',
        pendingPermissions: [], composerDraft: '', stash: {}, runSessions: {},
    });
};

describe('agentRun store - mid-stream chat switching', () => {
    beforeEach(reset);

    it('keeps streaming into a stashed conversation and restores the full transcript', () => {
        const st = () => useAgentRunStore.getState();

        // Conversation A starts a run and streams some text.
        st().setSession('cowork', 'sessA');
        st().pushUser('do the thing');
        st().beginRun();
        st().apply({ t: 'run_start', runId: 'r1', surface: 'cowork', model: 'm', sessionId: 'sessA' });
        st().apply({ t: 'text', runId: 'r1', v: 'Hello ' });
        expect(st().items.some((i) => i.kind === 'assistant' && i.text === 'Hello ')).toBe(true);

        // User switches to conversation B mid-stream.
        st().stashActive();
        st().setSession('cowork', 'sessB');
        st().clear();
        expect(st().items.length).toBe(0);

        // A's deltas keep arriving - they must land in the stash, not on screen.
        st().apply({ t: 'text', runId: 'r1', v: 'world' });
        st().apply({ t: 'tool_call', runId: 'r1', id: 'tc1', name: 'bash', input: {}, render: 'Run: ls' });
        st().apply({ t: 'tool_result', runId: 'r1', id: 'tc1', name: 'bash', ok: true, content: 'ok' });
        st().apply({ t: 'text', runId: 'r1', v: '!' });
        expect(st().items.length).toBe(0); // nothing leaked into B

        // Switch back: full transcript is there, still marked running.
        st().setSession('cowork', 'sessA');
        expect(st().restoreStash('sessA')).toBe(true);
        const asst = st().items.filter((i) => i.kind === 'assistant') as any[];
        expect(asst.map((a) => a.text)).toContain('Hello world');
        expect(asst.map((a) => a.text)).toContain('!'); // new bubble after the tool call
        expect(st().items.some((i) => i.kind === 'tool')).toBe(true);
        expect(st().running).toBe(true);

        // Run finishes on screen.
        st().apply({ t: 'done', runId: 'r1', stopReason: 'end_turn' });
        expect(st().running).toBe(false);
        expect(st().runSessions['r1']).toBeUndefined();
    });

    it('finishes a run that ended while its conversation was stashed', () => {
        const st = () => useAgentRunStore.getState();
        st().setSession('cowork', 'sessA');
        st().pushUser('x');
        st().beginRun();
        st().apply({ t: 'run_start', runId: 'r1', surface: 'cowork', model: 'm', sessionId: 'sessA' });
        st().stashActive();
        st().setSession('cowork', 'sessB');
        st().clear();

        st().apply({ t: 'text', runId: 'r1', v: 'done elsewhere' });
        st().apply({ t: 'done', runId: 'r1', stopReason: 'end_turn' });

        st().setSession('cowork', 'sessA');
        expect(st().restoreStash('sessA')).toBe(true);
        expect(st().running).toBe(false);
        expect(st().items.some((i) => i.kind === 'assistant' && (i as any).text === 'done elsewhere')).toBe(true);
    });

    it('ignores runs for unknown sessions (scheduled/background)', () => {
        const st = () => useAgentRunStore.getState();
        st().setSession('cowork', 'sessA');
        st().apply({ t: 'run_start', runId: 'bg1', surface: 'cowork', model: 'm', sessionId: 'ghost' });
        st().apply({ t: 'text', runId: 'bg1', v: 'leak?' });
        expect(st().items.length).toBe(0);
        expect(st().runSessions['bg1']).toBeUndefined();
    });

    it('routes permission prompts to the right conversation and resolves off-screen', () => {
        const st = () => useAgentRunStore.getState();
        st().setSession('cowork', 'sessA');
        st().pushUser('x');
        st().beginRun();
        st().apply({ t: 'run_start', runId: 'r1', surface: 'cowork', model: 'm', sessionId: 'sessA' });

        st().stashActive();
        st().setSession('cowork', 'sessB');
        st().clear();

        const req = { id: 'p1', runId: 'r1', toolName: 'bash', tier: 'exec' as const, render: 'Run: ls', target: 'ls', input: {} };
        st().apply({ t: 'permission_req', runId: 'r1', req });
        expect(st().pendingPermissions.length).toBe(0);          // not on screen
        expect(st().stash['sessA'].pendingPermissions.length).toBe(1);

        st().apply({ t: 'permission_resolved', runId: 'r1', reqId: 'p1', decision: 'allow' });
        expect(st().stash['sessA'].pendingPermissions.length).toBe(0);
    });
});
