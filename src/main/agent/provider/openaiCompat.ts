/* =======================================================================
   OpenAI-compatible adapter - OpenRouter, HuggingFace router, OpenAI,
   DeepSeek, Groq, and any /v1/chat/completions endpoint.

   Unlike Ollama native, this transport DOES stream tool-call argument
   fragments (delta.tool_calls[].function.arguments). We accumulate per
   index and emit a single complete tool_call at finish.
   ======================================================================= */
import type { AgentMessage } from '../../../shared/agent';
import type { ProviderAdapter, ProviderEvent, ProviderRequest } from '../types';
import { isOmniModel, omniBaseUrl, omniHeaders, omniModelName } from './omni';
import { isOfoxModel, ofoxBaseUrl, ofoxHeaders, ofoxModelName } from './ofox';

interface Endpoint {
    url: string;
    apiKey: string;
    model: string;
    /** Fully-formed headers. When set, they are used verbatim and `apiKey` is
        ignored for auth (OmniRoute carries an optional bearer key here). */
    headers?: Record<string, string>;
}

function resolveEndpoint(req: ProviderRequest): Endpoint {
    const { model, apiKeys } = req;
    // OfoxAI: a unified OpenAI-compatible API gateway.
    if (isOfoxModel(model)) {
        return {
            url: `${ofoxBaseUrl(apiKeys)}/chat/completions`,
            apiKey: apiKeys.ofox || '',
            model: ofoxModelName(model),
            headers: ofoxHeaders(apiKeys),
        };
    }
    // OmniRoute: a local OpenAI-compatible gateway at a configurable base URL.
    if (isOmniModel(model)) {
        return {
            url: `${omniBaseUrl(apiKeys)}/chat/completions`,
            apiKey: '',
            model: omniModelName(model),
            headers: omniHeaders(apiKeys),
        };
    }
    if (model.startsWith('openrouter:')) {
        return {
            url: 'https://openrouter.ai/api/v1/chat/completions',
            apiKey: apiKeys.openrouter || '',
            model: model.slice('openrouter:'.length),
        };
    }
    if (model.startsWith('hf:')) {
        const name = model.slice('hf:'.length);
        return {
            url: `https://router.huggingface.co/hf-inference/models/${name}/v1/chat/completions`,
            apiKey: apiKeys.hf || '',
            model: name,
        };
    }
    if (model.includes('deepseek')) {
        return { url: 'https://api.deepseek.com/chat/completions', apiKey: apiKeys.deepseek || '', model };
    }
    if (model.includes('gemini')) {
        // Google's OpenAI-compatibility endpoint; auth is a Bearer API key.
        return {
            url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
            apiKey: apiKeys.gemini || '',
            model: model.replace(/^gemini:/, ''),
        };
    }
    if (model.includes('llama3') && apiKeys.groq) {
        return { url: 'https://api.groq.com/openai/v1/chat/completions', apiKey: apiKeys.groq || '', model };
    }
    // default OpenAI
    return { url: 'https://api.openai.com/v1/chat/completions', apiKey: apiKeys.openai || '', model };
}

export function toOpenAiMessages(messages: AgentMessage[]): unknown[] {
    const out: unknown[] = [];
    // Kimi K3 (and other strict gateways) reject a tool message whose name can't
    // be resolved: "carry `tool`/`name`, or match a preceding assistant
    // tool_call by order". We therefore ALWAYS send the tool name. The part
    // normally carries it (kernel puts it there); the map is the fallback for
    // persisted/older messages so the name still resolves.
    const toolNames = new Map<string, string>();
    for (const m of messages) {
        if (m.role !== 'assistant') continue;
        for (const p of m.parts) if (p.type === 'tool_use') toolNames.set(p.id, p.name);
    }
    for (const m of messages) {
        if (m.role === 'tool') {
            for (const p of m.parts) {
                if (p.type === 'tool_result') {
                    const msg: Record<string, unknown> = { role: 'tool', tool_call_id: p.toolUseId, content: p.content };
                    const name = p.name || toolNames.get(p.toolUseId);
                    if (name) msg.name = name;
                    out.push(msg);
                }
            }
            continue;
        }
        if (m.role === 'assistant') {
            const text: string[] = [];
            const toolCalls: unknown[] = [];
            for (const p of m.parts) {
                if (p.type === 'text') text.push(p.text);
                else if (p.type === 'tool_use') {
                    toolCalls.push({
                        id: p.id,
                        type: 'function',
                        function: { name: p.name, arguments: JSON.stringify(p.input ?? {}) },
                    });
                }
            }
            const msg: Record<string, unknown> = { role: 'assistant', content: text.join('') };
            if (toolCalls.length) msg.tool_calls = toolCalls;
            out.push(msg);
            continue;
        }
        // system / user - support text + images (data URL form)
        const content: unknown[] = [];
        for (const p of m.parts) {
            if (p.type === 'text') content.push({ type: 'text', text: p.text });
            else if (p.type === 'image') {
                content.push({ type: 'image_url', image_url: { url: `data:${p.mimeType};base64,${p.dataBase64}` } });
            }
        }
        // Collapse to a plain string when there's only text (broadest compat).
        const onlyText = content.every((c: any) => c.type === 'text');
        out.push({ role: m.role, content: onlyText ? content.map((c: any) => c.text).join('') : content });
    }
    return out;
}

export const openAiCompatAdapter: ProviderAdapter = {
    async *stream(req: ProviderRequest): AsyncGenerator<ProviderEvent> {
        const ep = resolveEndpoint(req);
        if (!ep.headers && !ep.apiKey) { yield { t: 'done', stopReason: 'error', error: `Missing API key for ${ep.url}` }; return; }

        const body: Record<string, unknown> = {
            model: ep.model,
            messages: toOpenAiMessages(req.messages),
            stream: true,
        };
        if (req.tools.length) {
            body.tools = req.tools.map((t) => ({
                type: 'function',
                function: { name: t.name, description: t.description, parameters: t.parameters },
            }));
        }

        const res = await fetch(ep.url, {
            method: 'POST',
            headers: ep.headers ?? { 'Content-Type': 'application/json', Authorization: `Bearer ${ep.apiKey}` },
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
        // Accumulate streamed tool-call fragments keyed by index.
        const pending = new Map<number, { id: string; name: string; args: string }>();
        let finishReason: string | null = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const t = line.trim();
                if (!t || !t.startsWith('data: ')) continue;
                const payload = t.slice('data: '.length);
                if (payload === '[DONE]') { finishReason = finishReason || 'stop'; continue; }
                let json: any;
                try { json = JSON.parse(payload); } catch { continue; }

                const choice = json.choices?.[0];
                if (!choice) continue;
                const delta = choice.delta || {};

                if (typeof delta.content === 'string' && delta.content) {
                    yield { t: 'text', v: delta.content };
                }
                if (Array.isArray(delta.tool_calls)) {
                    for (const tc of delta.tool_calls) {
                        const idx = tc.index ?? 0;
                        const cur = pending.get(idx) || { id: tc.id || `call_${idx}`, name: '', args: '' };
                        if (tc.id) cur.id = tc.id;
                        if (tc.function?.name) cur.name = tc.function.name;
                        if (tc.function?.arguments) cur.args += tc.function.arguments;
                        pending.set(idx, cur);
                    }
                }
                if (choice.finish_reason) finishReason = choice.finish_reason;
            }
        }

        // Flush accumulated tool calls.
        let emittedTool = false;
        for (const [, tc] of Array.from(pending.entries()).sort((a, b) => a[0] - b[0])) {
            if (!tc.name) continue;
            emittedTool = true;
            let input: unknown = {};
            try { input = tc.args ? JSON.parse(tc.args) : {}; } catch { input = { _raw: tc.args }; }
            yield { t: 'tool_call', id: tc.id, name: tc.name, input };
        }

        yield {
            t: 'done',
            stopReason: emittedTool || finishReason === 'tool_calls' ? 'tool_use'
                : finishReason === 'length' ? 'max_tokens' : 'end_turn',
        };
    },
};
