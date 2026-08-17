/* =======================================================================
   Ollama native adapter - /api/chat with native `tools`.
   Primary transport for both local and cloud models.

   Hidden quirk handled here: Ollama's native stream delivers assistant TEXT
   incrementally, but tool calls arrive as a COMPLETE object in a chunk's
   `message.tool_calls` (not token-streamed arg deltas). We emit each
   tool_call once, with fully-formed input. Downstream never assumes partial.
   ======================================================================= */
import type {
    AgentMessage,
    MessagePart,
} from '../../../shared/agent';
import type { ProviderAdapter, ProviderEvent, ProviderRequest } from '../types';

const DEFAULT_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';

interface OllamaChatMessage {
    role: string;
    content: string;
    images?: string[];
    tool_calls?: Array<{ function: { name: string; arguments: unknown } }>;
    tool_name?: string;
    thinking?: string;
}

/** Flatten our multimodal parts into Ollama's message shape. */
function toOllamaMessages(messages: AgentMessage[]): OllamaChatMessage[] {
    const out: OllamaChatMessage[] = [];
    for (const m of messages) {
        if (m.role === 'tool') {
            for (const p of m.parts) {
                if (p.type === 'tool_result') {
                    out.push({ role: 'tool', content: p.content, tool_name: p.name });
                }
            }
            continue;
        }
        const text: string[] = [];
        const images: string[] = [];
        const toolCalls: OllamaChatMessage['tool_calls'] = [];
        for (const p of m.parts) {
            if (p.type === 'text') text.push(p.text);
            else if (p.type === 'thinking') { /* not resent */ }
            else if (p.type === 'image') images.push(p.dataBase64);
            else if (p.type === 'tool_use') {
                toolCalls.push({ function: { name: p.name, arguments: p.input } });
            }
        }
        const msg: OllamaChatMessage = { role: m.role, content: text.join('') };
        if (images.length) msg.images = images;
        if (toolCalls.length) msg.tool_calls = toolCalls;
        out.push(msg);
    }
    return out;
}

function parseArgs(raw: unknown): unknown {
    if (raw == null) return {};
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return { _raw: raw }; }
    }
    return raw;
}

export const ollamaAdapter: ProviderAdapter = {
    async *stream(req: ProviderRequest): AsyncGenerator<ProviderEvent> {
        const body: Record<string, unknown> = {
            model: req.model,
            messages: toOllamaMessages(req.messages),
            stream: true,
            options: { num_ctx: req.numCtx ?? 32768 },
        };
        if (req.tools.length) {
            body.tools = req.tools.map((t) => ({
                type: 'function',
                function: { name: t.name, description: t.description, parameters: t.parameters },
            }));
        }
        if (req.think?.enabled) {
            // Accepts boolean OR a level string ("low"|"medium"|"high") depending on model.
            body.think = req.think.level ?? true;
        }

        const host = (req.ollamaCloud && req.ollamaApiKey) ? 'https://ollama.com' : DEFAULT_HOST;
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (req.ollamaApiKey) headers.Authorization = `Bearer ${req.ollamaApiKey}`;

        const res = await fetch(`${host}/api/chat`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: req.signal,
        });

        if (!res.ok) {
            const errText = await res.text().catch(() => res.statusText);
            yield { t: 'done', stopReason: 'error', error: `Ollama ${res.status}: ${errText}` };
            return;
        }
        const reader = res.body?.getReader();
        if (!reader) { yield { t: 'done', stopReason: 'error', error: 'No stream' }; return; }

        const decoder = new TextDecoder();
        let buffer = '';
        let emittedToolCall = false;
        let toolIdx = 0;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const t = line.trim();
                if (!t) continue;
                let json: any;
                try { json = JSON.parse(t); } catch { continue; }

                const msg = json.message;
                if (msg) {
                    if (typeof msg.thinking === 'string' && msg.thinking) {
                        yield { t: 'thinking', v: msg.thinking };
                    }
                    if (typeof msg.content === 'string' && msg.content) {
                        yield { t: 'text', v: msg.content };
                    }
                    if (Array.isArray(msg.tool_calls)) {
                        for (const tc of msg.tool_calls) {
                            const name = tc?.function?.name;
                            if (!name) continue;
                            emittedToolCall = true;
                            yield {
                                t: 'tool_call',
                                id: `call_${Date.now()}_${toolIdx++}`,
                                name,
                                input: parseArgs(tc.function.arguments),
                            };
                        }
                    }
                }

                if (json.prompt_eval_count != null || json.eval_count != null) {
                    yield { t: 'usage', inputTokens: json.prompt_eval_count, outputTokens: json.eval_count };
                }

                if (json.done) {
                    const reason = json.stop_reason === 'length' || json.stop_reason === 'max_tokens'
                        ? 'max_tokens'
                        : emittedToolCall
                            ? 'tool_use'
                            : 'end_turn';
                    yield { t: 'done', stopReason: reason };
                    return;
                }
            }
        }
        // Stream ended without an explicit done flag.
        yield { t: 'done', stopReason: emittedToolCall ? 'tool_use' : 'end_turn' };
    },
};

/** Detect whether a model id should route to Ollama (local or cloud). */
export function isOllamaModel(model: string): boolean {
    if (model.startsWith('ollama:')) return true;
    if (model.startsWith('openrouter:') || model.startsWith('hf:')) return false;
    // Cloud suffix, or a bare local tag (no provider prefix, not a known cloud vendor slug).
    if (model.includes(':cloud') || model.includes('-cloud')) return true;
    if (model.includes('claude') || model.includes('gpt-') || model.includes('gemini')) return false;
    return true; // default: assume a locally pulled / cloud-proxied Ollama tag
}

/** Extract model name without our provider prefix. */
export function stripPrefix(model: string): string {
    if (model.startsWith('ollama:')) return model.slice('ollama:'.length);
    return model;
}
