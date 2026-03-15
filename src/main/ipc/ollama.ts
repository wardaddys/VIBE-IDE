import { ipcMain, BrowserWindow } from 'electron';
import type { ChatMessage } from '../../shared/types';

const OLLAMA_BASE = 'http://localhost:11434';
let abortController: AbortController | null = null;

export const OLLAMA_ONLY_MODELS = new Set<string>([
    'gpt-oss-120b',
]);

export function registerOllamaHandlers(mainWindow: BrowserWindow) {
    ipcMain.handle('ollama:detect', async () => {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/tags`);
            if (res.ok) return { detected: true, version: 'Local' };
            return { detected: false };
        } catch { return { detected: false }; }
    });

    ipcMain.handle('ollama:status', async () => {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/tags`);
            return !!res.ok;
        } catch { return false; }
    });

    ipcMain.handle('ollama:listModels', async () => {
        try {
            // /api/tags returns ALL installed models regardless
            // of whether they are loaded in memory or not
            const res = await fetch(`${OLLAMA_BASE}/api/tags`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            if (!res.ok) return [];
            const data = await res.json();
            // data.models is array of { name, size, digest, details }
            // Return all names sorted alphabetically
            const models: string[] = (data.models || [])
                .map((m: any) => m.name as string)
                .sort((a: string, b: string) => a.localeCompare(b));
            return models;
        } catch {
            return [];
        }
    });

    ipcMain.handle('ollama:getLoadedModels', async () => {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/ps`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.models || []).map((m: any) => m.name as string);
        } catch {
            return [];
        }
    });

    ipcMain.handle('ollama:getCapabilities', async (_event, modelName: string) => {
        try {
            const res = await fetch(`${OLLAMA_BASE}/api/show`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: modelName })
            });
            if (!res.ok) return null;
            const data = await res.json();

            const capabilities: string[] = data.capabilities || [];
            const family: string = data.details?.family?.toLowerCase() || '';
            const template: string = data.template || '';
            const parameters: string = data.parameters || '';

            // Detect think/reasoning
            const hasThink =
                capabilities.includes('thinking') ||
                capabilities.includes('reasoning') ||
                family.includes('deepseek-r1') ||
                family.includes('qwq') ||
                template.includes('<think>') ||
                template.includes('[THINKING]') ||
                modelName.toLowerCase().includes('r1') ||
                modelName.toLowerCase().includes('qwq') ||
                modelName.toLowerCase().includes('deepseek-r1');

            // Detect think budget type
            const thinkBudget =
                modelName.toLowerCase().includes('claude-3-7') ||
                modelName.toLowerCase().includes('claude-3-5')
                    ? 'tiered'
                    : hasThink ? 'toggle' : undefined;

            // Detect vision
            const hasVision =
                capabilities.includes('vision') ||
                family.includes('vision') ||
                modelName.toLowerCase().includes('vision') ||
                modelName.toLowerCase().includes('vl') ||
                modelName.toLowerCase().includes('llava') ||
                modelName.toLowerCase().includes('llama3.2-vision') ||
                modelName.toLowerCase().includes('minicpm-v') ||
                modelName.toLowerCase().includes('moondream') ||
                modelName.toLowerCase().includes('llama4');

            // Detect tool calling
            const hasTools =
                capabilities.includes('tools') ||
                capabilities.includes('tool_use') ||
                modelName.toLowerCase().includes('qwen3') ||
                modelName.toLowerCase().includes('qwen2.5') ||
                modelName.toLowerCase().includes('llama3.1') ||
                modelName.toLowerCase().includes('llama3.2') ||
                modelName.toLowerCase().includes('llama3.3') ||
                modelName.toLowerCase().includes('mistral') ||
                modelName.toLowerCase().includes('command-r') ||
                modelName.toLowerCase().includes('granite') ||
                modelName.toLowerCase().includes('phi4');

            // Extract context length
            const ctxMatch = parameters.match(/num_ctx\s+(\d+)/);
            const contextLength = ctxMatch ? parseInt(ctxMatch[1]) : 4096;

            return {
                modelName,
                think: hasThink,
                thinkBudget,
                vision: hasVision,
                tools: hasTools,
                contextLength,
                family,
                rawCapabilities: capabilities
            };
        } catch {
            return null;
        }
    });

    ipcMain.handle('ollama:chat', async (_event, model, messages, apiKeys, thinkOptions) => {
        if (abortController) abortController.abort();
        abortController = new AbortController();

        try {
            let endpoint = '';
            let headers: any = { 'Content-Type': 'application/json' };
            let body: any = {};
            let isAnthropic = false;
            let isGemini = false;

            const sysMsg = messages.find((m: ChatMessage) => m.role === 'system')?.content || '';
            const userMsgs = messages.filter((m: ChatMessage) => m.role !== 'system');

            const thinkBudgets = { low: 2048, medium: 8192, high: 16000 };
            const thinkTokenBudget = thinkOptions?.enabled && thinkOptions?.level
                ? (thinkBudgets as any)[thinkOptions.level]
                : null;

            // 1. ABSOLUTE PRIORITY: Route -cloud and local models to Ollama immediately.
            if (model.includes('-cloud') || OLLAMA_ONLY_MODELS.has(model)) {
                endpoint = `${OLLAMA_BASE}/api/chat`;
                body = { 
                    model, 
                    messages, 
                    stream: true, 
                    options: { 
                        num_ctx: 16384,
                        ...(thinkTokenBudget ? { num_predict: thinkTokenBudget } : {})
                    } 
                };
            }
            // 2. CLOUD APIS
            else if (model.includes('claude')) {
                if (!apiKeys?.claude) throw new Error('Claude API key missing.');
                endpoint = 'https://api.anthropic.com/v1/messages';
                headers['x-api-key'] = apiKeys.claude;
                headers['anthropic-version'] = '2023-06-01';
                headers['anthropic-dangerous-direct-browser-access'] = 'true';
                isAnthropic = true;
                body = { 
                    model, 
                    max_tokens: thinkTokenBudget ? thinkTokenBudget + 4096 : 4096, 
                    system: sysMsg, 
                    messages: userMsgs, 
                    stream: true,
                    ...(thinkTokenBudget ? { thinking: { type: 'enabled', budget_tokens: thinkTokenBudget } } : {})
                };
            } 
            else if (model.includes('gpt-') || model.includes('deepseek') || model.includes('llama3')) {
                let key = '';
                if (model.includes('gpt-')) { endpoint = 'https://api.openai.com/v1/chat/completions'; key = apiKeys?.openai || ''; }
                if (model.includes('deepseek')) { endpoint = 'https://api.deepseek.com/chat/completions'; key = apiKeys?.deepseek || ''; }
                if (model.includes('llama3')) { endpoint = 'https://api.groq.com/openai/v1/chat/completions'; key = apiKeys?.groq || ''; }
                
                if (!key) throw new Error(`API key missing for Cloud Model: ${model}`);
                headers['Authorization'] = `Bearer ${key}`;
                body = { model, messages, stream: true };
            } 
            else if (model.includes('gemini')) {
                if (!apiKeys?.gemini) throw new Error('Gemini API key missing.');
                isGemini = true;
                endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKeys.gemini}`;
                body = { contents: userMsgs.map((m: ChatMessage) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })) };
                if (sysMsg.trim() !== '') body.systemInstruction = { parts: [{ text: sysMsg }] };
            } 
            else if (model.startsWith('hf:')) {
                const hfModelId = model.replace('hf:', '');
                endpoint = `https://router.huggingface.co/hf-inference/models/${hfModelId}/v1/chat/completions`;
                if (apiKeys?.hf) {
                    headers['Authorization'] = `Bearer ${apiKeys.hf}`;
                }
                body = { model: hfModelId, messages, stream: true, max_tokens: 2048 };
            }
            else {
                // Fallback for standard local models (e.g. llama3.2:latest)
                endpoint = `${OLLAMA_BASE}/api/chat`;
                body = { 
                    model, 
                    messages, 
                    stream: true, 
                    options: { 
                        num_ctx: 16384,
                        ...(thinkTokenBudget ? { num_predict: thinkTokenBudget } : {})
                    } 
                };
            }

            const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: abortController.signal });
            if (!res.ok) throw new Error(`API Error ${res.status}: ${await res.text()}`);

            const reader = res.body?.getReader();
            if (!reader) throw new Error('No stream available');
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    const tLine = line.trim();
                    if (!tLine || tLine === 'data: [DONE]') continue;
                    try {
                        let contentChunk = '';
                        if (isGemini && tLine.startsWith('data: ')) {
                            contentChunk = JSON.parse(tLine.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text || '';
                        } 
                        else if (isAnthropic && tLine.startsWith('data: ')) {
                            const j = JSON.parse(tLine.slice(6));
                            if (j.type === 'content_block_delta') contentChunk = j.delta?.text || '';
                        }
                        else if ((model.includes('gpt-') || model.includes('deepseek') || model.includes('llama3') || model.startsWith('hf:')) && tLine.startsWith('data: ')) {
                            const parsed = JSON.parse(tLine.slice(6));
                            contentChunk = parsed.choices?.[0]?.delta?.content || '';
                        }
                        else if (endpoint.includes('localhost') || endpoint.includes('127.0.0.1')) {
                            contentChunk = JSON.parse(tLine).message?.content || '';
                        }

                        if (contentChunk && !mainWindow.isDestroyed()) {
                            mainWindow.webContents.send('ollama:stream', { content: contentChunk, done: false });
                        }
                    } catch (e) { }
                }
            }
            if (!mainWindow.isDestroyed()) mainWindow.webContents.send('ollama:stream', { content: '', done: true });

        } catch (error: any) {
            if (error.name !== 'AbortError' && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ollama:stream', { content: `\n\n🚨 **System Error:** ${error.message}`, done: true });
            }
        } finally { abortController = null; }
    });

    ipcMain.handle('ollama:stop', () => {
        if (abortController) {
            abortController.abort();
            abortController = null;
        }
    });
}
