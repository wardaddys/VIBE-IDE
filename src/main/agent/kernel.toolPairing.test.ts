import { describe, it, expect } from 'vitest';
import { repairToolPairing, trimHistory } from './kernel';
import { toOpenAiMessages } from './provider/openaiCompat';
import type { AgentMessage, MessagePart } from '../../shared/agent';

/* Regression tests for the Kimi K3 400:
   "tool messages need a resolvable tool name: carry `tool`/`name`, or match a
   preceding assistant tool_call by order."
   Three guarantees now hold: serialized tool messages always carry a name,
   dangling tool_calls get explicit interruption results, and trimming never
   separates a tool result from its originating tool_calls. */

const text = (s: string): MessagePart => ({ type: 'text', text: s });
const toolUse = (id: string, name: string): MessagePart => ({ type: 'tool_use', id, name, input: {} });
const toolResult = (id: string, name: string | undefined, content = 'ok'): MessagePart =>
    ({ type: 'tool_result', toolUseId: id, name, content });

describe('toOpenAiMessages tool serialization', () => {
    it('tool messages carry the tool name', () => {
        const msgs: AgentMessage[] = [
            { role: 'user', parts: [text('hi')] },
            { role: 'assistant', parts: [toolUse('call_1', 'fs_read')] },
            { role: 'tool', parts: [toolResult('call_1', 'fs_read', 'file contents')] },
        ];
        const out = toOpenAiMessages(msgs) as any[];
        const toolMsg = out.find((m) => m.role === 'tool');
        expect(toolMsg).toBeTruthy();
        expect(toolMsg.tool_call_id).toBe('call_1');
        expect(toolMsg.name).toBe('fs_read');
        expect(toolMsg.content).toBe('file contents');
    });

    it('name is resolved from the preceding assistant tool_call when the part lacks one', () => {
        const msgs: AgentMessage[] = [
            { role: 'user', parts: [text('hi')] },
            { role: 'assistant', parts: [toolUse('call_9', 'bash')] },
            { role: 'tool', parts: [toolResult('call_9', undefined, 'output')] },
        ];
        const out = toOpenAiMessages(msgs) as any[];
        const toolMsg = out.find((m) => m.role === 'tool');
        expect(toolMsg.name).toBe('bash');
    });
});

describe('repairToolPairing', () => {
    it('inserts interruption results for dangling tool_calls (aborted run)', () => {
        const msgs: AgentMessage[] = [
            { role: 'user', parts: [text('do it')] },
            { role: 'assistant', parts: [toolUse('a', 'fs_read'), toolUse('b', 'bash')] },
        ];
        repairToolPairing(msgs);
        expect(msgs.length).toBe(3);
        expect(msgs[2].role).toBe('tool');
        const results = msgs[2].parts.filter((p) => p.type === 'tool_result');
        expect(results.map((r: any) => r.toolUseId)).toEqual(['a', 'b']);
        expect(results.every((r: any) => r.isError)).toBe(true);
        expect(results.map((r: any) => r.name)).toEqual(['fs_read', 'bash']);
    });

    it('merges missing results into an existing partial tool message', () => {
        const msgs: AgentMessage[] = [
            { role: 'assistant', parts: [toolUse('a', 'fs_read'), toolUse('b', 'bash')] },
            { role: 'tool', parts: [toolResult('a', 'fs_read')] },
        ];
        repairToolPairing(msgs);
        expect(msgs.length).toBe(2);
        const ids = msgs[1].parts.filter((p) => p.type === 'tool_result').map((p: any) => p.toolUseId);
        expect(ids).toEqual(['a', 'b']);
    });

    it('leaves complete pairings untouched', () => {
        const msgs: AgentMessage[] = [
            { role: 'assistant', parts: [toolUse('a', 'fs_read')] },
            { role: 'tool', parts: [toolResult('a', 'fs_read')] },
            { role: 'assistant', parts: [text('done')] },
        ];
        repairToolPairing(msgs);
        expect(msgs.length).toBe(3);
    });
});

describe('trimHistory tool-block safety', () => {
    const pairingInvariant = (msgs: AgentMessage[]) => {
        // Every kept tool_result must resolve to a tool_use in some earlier kept assistant message.
        const known = new Set<string>();
        for (const m of msgs) {
            if (m.role === 'assistant') {
                for (const p of m.parts) if (p.type === 'tool_use') known.add(p.id);
            }
            if (m.role === 'tool') {
                for (const p of m.parts) {
                    if (p.type === 'tool_result') expect(known.has(p.toolUseId)).toBe(true);
                }
            }
        }
    };

    it('never orphans a tool result from its tool_calls, even on a tiny budget', () => {
        const big = 'x'.repeat(4000); // ~1000 tokens per tool result
        const msgs: AgentMessage[] = [
            { role: 'system', parts: [text('system prompt')] },
            { role: 'user', parts: [text('the mission')] },
        ];
        for (let i = 0; i < 6; i++) {
            msgs.push({ role: 'assistant', parts: [toolUse(`c${i}`, 'bash'), text(`step ${i}`)] });
            msgs.push({ role: 'tool', parts: [toolResult(`c${i}`, 'bash', big)] });
        }
        msgs.push({ role: 'assistant', parts: [text('final answer')] });

        trimHistory(msgs, 200); // inputBudget = 130 tokens — forces heavy dropping
        pairingInvariant(msgs);
        expect(msgs[0].role).toBe('system');
        expect(msgs.some((m) => m.role === 'user')).toBe(true);
    });

    it('keeps assistant+tool blocks atomic on moderate budgets', () => {
        const msgs: AgentMessage[] = [
            { role: 'user', parts: [text('mission')] },
            { role: 'assistant', parts: [toolUse('a', 'fs_read')] },
            { role: 'tool', parts: [toolResult('a', 'fs_read', 'y'.repeat(800))] },
            { role: 'assistant', parts: [text('wrap up')] },
        ];
        trimHistory(msgs, 65536); // everything fits
        expect(msgs.length).toBe(4);
        pairingInvariant(msgs);
        trimHistory(msgs, 300); // inputBudget 195 tokens: the block (~200+) must drop TOGETHER
        pairingInvariant(msgs);
    });
});
