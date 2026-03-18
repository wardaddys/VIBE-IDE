import type { ChatMessage } from '../../shared/types';

const OLLAMA_API_BASE = 'http://localhost:11434/api';

export const OLLAMA_ONLY_MODELS = new Set<string>([
    'gpt-oss-120b',
]);

const THINK_BUDGETS: Record<string, number> = {
    low: 2048,
    medium: 8192,
    high: 16000,
};

export type ChatRouteMode = 'ollama' | 'openai' | 'anthropic' | 'gemini';

export interface ChatRouteResult {
    endpoint: string;
    headers: Record<string, string>;
    body: any;
    mode: ChatRouteMode;
    modelName: string;
}

export const normalizeModelId = (model: string): string => {
    if (model.startsWith('openrouter:') || model.startsWith('hf:') || model.startsWith('ollama:')) {
        return model.split(':').slice(1).join(':');
    }
    return model;
};

export function buildChatRoute(
    model: string,
    messages: ChatMessage[],
    apiKeys: Record<string, string> | undefined,
    options?: { stream?: boolean; thinkOptions?: { enabled?: boolean; level?: 'low' | 'medium' | 'high' } | null }
): ChatRouteResult {
    const stream = options?.stream ?? true;
    const rawModel = model;
    const modelName = normalizeModelId(rawModel);
    const thinkLevel = options?.thinkOptions?.enabled ? options?.thinkOptions?.level : null;
    const thinkTokenBudget = thinkLevel ? THINK_BUDGETS[thinkLevel] : null;

    const sysMsg = messages.find((m) => m.role === 'system')?.content || '';
    const userMsgs = messages.filter((m) => m.role !== 'system');

    // Prefer local/Ollama for explicit local prefixes and known local-only models.
    if (rawModel.startsWith('ollama:') || modelName.includes('-cloud') || OLLAMA_ONLY_MODELS.has(modelName)) {
        return {
            endpoint: `${OLLAMA_API_BASE}/chat`,
            headers: { 'Content-Type': 'application/json' },
            body: {
                model: modelName,
                messages,
                stream,
                options: {
                    num_ctx: 16384,
                    ...(thinkTokenBudget ? { num_predict: thinkTokenBudget } : {}),
                },
            },
            mode: 'ollama',
            modelName,
        };
    }

    if (rawModel.startsWith('openrouter:')) {
        if (!apiKeys?.openrouter) throw new Error('OpenRouter API key missing.');
        return {
            endpoint: 'https://openrouter.ai/api/v1/chat/completions',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKeys.openrouter}`,
            },
            body: { model: modelName, messages, stream },
            mode: 'openai',
            modelName,
        };
    }

    if (modelName.includes('claude')) {
        if (!apiKeys?.claude) throw new Error('Claude API key missing.');
        return {
            endpoint: 'https://api.anthropic.com/v1/messages',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKeys.claude,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: {
                model: modelName,
                max_tokens: thinkTokenBudget ? thinkTokenBudget + 4096 : 4096,
                system: sysMsg,
                messages: userMsgs,
                stream,
                ...(thinkTokenBudget ? { thinking: { type: 'enabled', budget_tokens: thinkTokenBudget } } : {}),
            },
            mode: 'anthropic',
            modelName,
        };
    }

    if (modelName.includes('gpt-') || modelName.includes('deepseek') || modelName.includes('llama3')) {
        let endpoint = '';
        let key = '';
        if (modelName.includes('gpt-')) {
            endpoint = 'https://api.openai.com/v1/chat/completions';
            key = apiKeys?.openai || '';
        }
        if (modelName.includes('deepseek')) {
            endpoint = 'https://api.deepseek.com/chat/completions';
            key = apiKeys?.deepseek || '';
        }
        if (modelName.includes('llama3')) {
            endpoint = 'https://api.groq.com/openai/v1/chat/completions';
            key = apiKeys?.groq || '';
        }
        if (!key) throw new Error(`API key missing for Cloud Model: ${modelName}`);
        return {
            endpoint,
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: { model: modelName, messages, stream },
            mode: 'openai',
            modelName,
        };
    }

    if (modelName.includes('gemini')) {
        if (!apiKeys?.gemini) throw new Error('Gemini API key missing.');
        return {
            endpoint: stream
                ? `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:streamGenerateContent?alt=sse`
                : `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`,
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKeys.gemini,
            },
            body: {
                contents: userMsgs.map((m) => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }],
                })),
                ...(sysMsg.trim() !== '' ? { systemInstruction: { parts: [{ text: sysMsg }] } } : {}),
            },
            mode: 'gemini',
            modelName,
        };
    }

    if (rawModel.startsWith('hf:')) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (apiKeys?.hf) headers.Authorization = `Bearer ${apiKeys.hf}`;
        return {
            endpoint: `https://router.huggingface.co/hf-inference/models/${modelName}/v1/chat/completions`,
            headers,
            body: { model: modelName, messages, stream, max_tokens: 2048 },
            mode: 'openai',
            modelName,
        };
    }

    return {
        endpoint: `${OLLAMA_API_BASE}/chat`,
        headers: { 'Content-Type': 'application/json' },
        body: {
            model: modelName,
            messages,
            stream,
            options: {
                num_ctx: 16384,
                ...(thinkTokenBudget ? { num_predict: thinkTokenBudget } : {}),
            },
        },
        mode: 'ollama',
        modelName,
    };
}

export async function executeNonStreamingChat(
    model: string,
    messages: ChatMessage[],
    apiKeys?: Record<string, string>
): Promise<string> {
    const route = buildChatRoute(model, messages, apiKeys, { stream: false });
    const res = await fetch(route.endpoint, {
        method: 'POST',
        headers: route.headers,
        body: JSON.stringify(route.body),
    });

    if (!res.ok) {
        return '';
    }

    const data = await res.json() as any;

    if (route.mode === 'ollama') {
        return data.message?.content || '';
    }
    if (route.mode === 'openai') {
        return data.choices?.[0]?.message?.content || '';
    }
    if (route.mode === 'anthropic') {
        const textBlock = (data.content || []).find((c: any) => c?.type === 'text');
        return textBlock?.text || '';
    }
    if (route.mode === 'gemini') {
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    return '';
}