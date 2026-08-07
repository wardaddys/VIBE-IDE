/* =======================================================================
   Anthropic Messages adapter - /v1/messages.
   Used for real Claude API keys and for the Claude-Code drop-in path.
   (Ollama's own models go through the native adapter, which is primary.)

   This transport DOES stream tool-arg JSON via input_json_delta; we still
   normalize down to "tool_call emitted once, complete" for the kernel.
   ======================================================================= */
import type { AgentMessage } from '../../../shared/agent';
import type { ProviderAdapter, ProviderEvent, ProviderRequest } from '../types';

const THINK_BUDGET = { low: 2048, medium: 8192, high: 16000 } as const;

function toAnthropic(messages: AgentMessage[]): { system: string; msgs: unknown[] } {
    let system = '';
    const msgs: unknown[] = [];
    for (const m of messages) {
        if (m.role === 'system') {
            system += m.parts.filter((p) => p.type === 'text').map((p: any) => p.text).join('\n');
            continue;
        }
        if (m.role === 'tool') {
            const blocks = m.parts
                .filter((p) => p.type === 'tool_result')
                .map((p: any) => ({ type: 'tool_result', tool_use_id: p.toolUseId, content: p.content, is_error: !!p.isError }));
            msgs.push({ role: 'user', content: blocks });
            continue;
        }
        const content: unknown[] = [];
        for (const p of m.parts) {
            if (p.type === 'text') content.push({ type: 'text', text: p.text });
            // thinking parts are NOT replayed: the API requires the original
            // SIGNED block, and an unsigned {type:'thinking'} in history is a 400
            // the moment thinking mode + tool use are combined.
            else if (p.type === 'thinking') { /* skip */ }
            else if (p.type === 'image') content.push({ type: 'image', source: { type: 'base64', media_type: p.mimeType, data: p.dataBase64 } });
            else if (p.type === 'tool_use') content.push({ type: 'tool_use', id: p.id, name: p.name, input: p.input ?? {} });
        }
        msgs.push({ role: m.role, content });
    }
    return { system, msgs };
}

export const anthropicAdapter: ProviderAdapter = {
    async *stream(req: ProviderRequest): AsyncGenerator<ProviderEvent> {
        const key = req.apiKeys.claude;
        if (!key) { yield { t: 'done', stopReason: 'error', error: 'Missing Claude API key' }; return; }
        const { system, msgs } = toAnthropic(req.messages);
        const budget = req.think?.enabled ? THINK_BUDGET[req.think.level] : null;

        const body: Record<string, unknown> = {
            model: req.model.replace(/^anthropic:/, ''),
            // 4096 silently truncated long agentic turns (a max_tokens stop
            // mid-tool-JSON never flushes the tool call). 8192 is safe on every
            // tool-capable Claude model.
            max_tokens: budget ? budget + 8192 : 8192,
            system,
            messages: msgs,
            stream: true,
        };
        if (req.tools.length) {
            body.tools = req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters }));
        }
        if (budget) body.thinking = { type: 'enabled', budget_tokens: budget };

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': key,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify(body),
            signal: req.signal,
        });
        if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            yield { t: 'done', stopReason: 'error', error: `${res.status}: ${errText}` };
            return;
        }
        const reader = res.body?.getReader();
        if (!reader) { yield { t: 'done', stopReason: 'error', error: 'No stream' }; return; }

        const decoder = new TextDecoder();
        let buffer = '';
        const blocks = new Map<number, { type: string; id?: string; name?: string; json: string }>();
        let stopReason: ProviderEvent extends { stopReason: infer S } ? S : any = 'end_turn';

        const flushTool = function* (idx: number): Generator<ProviderEvent> {
            const b = blocks.get(idx);
            if (b && b.type === 'tool_use' && b.name) {
                let input: unknown = {};
                try { input = b.json ? JSON.parse(b.json) : {}; } catch { input = { _raw: b.json }; }
                yield { t: 'tool_call', id: b.id || `call_${idx}`, name: b.name, input };
            }
        };

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
                const t = line.trim();
                if (!t.startsWith('data: ')) continue;
                let ev: any;
                try { ev = JSON.parse(t.slice('data: '.length)); } catch { continue; }

                switch (ev.type) {
                    case 'content_block_start': {
                        const cb = ev.content_block || {};
                        blocks.set(ev.index, { type: cb.type, id: cb.id, name: cb.name, json: '' });
                        break;
                    }
                    case 'content_block_delta': {
                        const d = ev.delta || {};
                        if (d.type === 'text_delta' && d.text) yield { t: 'text', v: d.text };
                        else if (d.type === 'thinking_delta' && d.thinking) yield { t: 'thinking', v: d.thinking };
                        else if (d.type === 'input_json_delta') {
                            const b = blocks.get(ev.index);
                            if (b) b.json += d.partial_json || '';
                        }
                        break;
                    }
                    case 'content_block_stop': {
                        yield* flushTool(ev.index);
                        break;
                    }
                    case 'message_delta': {
                        if (ev.delta?.stop_reason) stopReason = ev.delta.stop_reason;
                        if (ev.usage) yield { t: 'usage', outputTokens: ev.usage.output_tokens };
                        break;
                    }
                    case 'message_stop': {
                        const norm = stopReason === 'tool_use' ? 'tool_use'
                            : stopReason === 'max_tokens' ? 'max_tokens' : 'end_turn';
                        yield { t: 'done', stopReason: norm };
                        return;
                    }
                }
            }
        }
        yield { t: 'done', stopReason: 'end_turn' };
    },
};
