import { ipcMain, BrowserWindow } from 'electron';
import type { ChatMessage } from '../../shared/types';
import { buildChatRoute } from './modelRouter';
import { execSync, spawn } from 'node:child_process';

const OLLAMA_API_BASE = 'http://localhost:11434/api';
let abortController: AbortController | null = null;
let isBootingOllama = false;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pingOllama(): Promise<boolean> {
    try {
        const res = await fetch(`${OLLAMA_API_BASE}/tags`);
        return !!res.ok;
    } catch {
        return false;
    }
}

async function ensureOllamaRunning(): Promise<boolean> {
    if (await pingOllama()) return true;

    if (!isBootingOllama) {
        isBootingOllama = true;
        try {
            const child = spawn('ollama', ['serve'], {
                detached: true,
                stdio: 'ignore',
                windowsHide: true,
            });
            child.unref();
        } catch {
            // Non-fatal: ping loop below will simply fail.
        } finally {
            isBootingOllama = false;
        }
    }

    // Wait briefly for service start-up.
    for (let i = 0; i < 12; i++) {
        await sleep(500);
        if (await pingOllama()) return true;
    }

    return false;
}

function listModelsFromCli(): string[] {
    try {
        const out = execSync('ollama list', {
            windowsHide: true,
            encoding: 'utf8',
        }).trim();

        if (!out) return [];
        const lines = out.split('\n').map(l => l.trim()).filter(Boolean);
        if (lines.length <= 1) return [];

        return lines
            .slice(1) // Skip header row
            .map((line) => line.split(/\s{2,}/)[0]?.trim())
            .filter((name): name is string => !!name);
    } catch {
        return [];
    }
}

export function registerOllamaHandlers(mainWindow: BrowserWindow) {
    ipcMain.handle('ollama:detect', async () => {
        const detected = await ensureOllamaRunning();
        return detected ? { detected: true, version: 'Local' } : { detected: false };
    });

    ipcMain.handle('ollama:status', async () => {
        return ensureOllamaRunning();
    });

    ipcMain.handle('ollama:listModels', async () => {
        try {
            await ensureOllamaRunning();

            // Merge installed models (/tags) with currently loaded models (/ps)
            // so UI detection works even when a model is loaded but not present in tags.
            const [tagsRes, psRes] = await Promise.all([
                fetch(`${OLLAMA_API_BASE}/tags`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                }).catch(() => null),
                fetch(`${OLLAMA_API_BASE}/ps`, {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                }).catch(() => null)
            ]);

            const names: string[] = [];

            if (tagsRes?.ok) {
                const tagsData = await tagsRes.json();
                names.push(...(tagsData.models || []).map((m: any) => String(m.name || '')));
            }

            if (psRes?.ok) {
                const psData = await psRes.json();
                names.push(...(psData.models || []).map((m: any) => String(m.name || '')));
            }

            const deduped = Array.from(new Set(
                names.map(n => n.trim()).filter(Boolean)
            )).sort((a, b) => a.localeCompare(b));

            if (deduped.length > 0) {
                return deduped;
            }

            // Fallback: ask local CLI directly (useful when API endpoints are up
            // but return empty or when tags/ps are desynced on certain setups).
            const cliModels = listModelsFromCli();
            return Array.from(new Set(cliModels)).sort((a, b) => a.localeCompare(b));
        } catch {
            return listModelsFromCli();
        }
    });

    ipcMain.handle('ollama:getLoadedModels', async () => {
        try {
            await ensureOllamaRunning();
            const res = await fetch(`${OLLAMA_API_BASE}/ps`);
            if (!res.ok) return [];
            const data = await res.json();
            return (data.models || []).map((m: any) => m.name as string);
        } catch {
            return [];
        }
    });

    ipcMain.handle('openrouter:listModels', async (_event, apiKeys?: Record<string, string>) => {
        try {
            const key = apiKeys?.openrouter || '';
            if (!key) return [];

            const res = await fetch('https://openrouter.ai/api/v1/models', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    'Content-Type': 'application/json',
                }
            });

            if (!res.ok) return [];
            const data = await res.json() as any;
            const rows = Array.isArray(data?.data) ? data.data : [];

            return rows.map((m: any) => {
                const pricingPrompt = Number(m?.pricing?.prompt || 0);
                const pricingCompletion = Number(m?.pricing?.completion || 0);
                return {
                    id: `openrouter:${m.id}`,
                    provider: 'openrouter',
                    label: m.name || m.id,
                    contextWindow: m.context_length || null,
                    inputPer1M: Number.isFinite(pricingPrompt) ? pricingPrompt * 1_000_000 : null,
                    outputPer1M: Number.isFinite(pricingCompletion) ? pricingCompletion * 1_000_000 : null,
                    supportsTools: !!m.supported_parameters?.includes?.('tools'),
                    supportsVision: !!m.architecture?.input_modalities?.includes?.('image'),
                };
            });
        } catch {
            return [];
        }
    });

    ipcMain.handle('hf:searchModels', async (_event, query: string, apiKeys?: Record<string, string>) => {
        try {
            const params = new URLSearchParams({
                search: (query || 'instruct').trim(),
                filter: 'text-generation',
                sort: 'likes',
                direction: '-1',
                limit: '20',
                full: 'false',
                config: 'false',
            });
            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            if (apiKeys?.hf) headers.Authorization = `Bearer ${apiKeys.hf}`;

            const res = await fetch(`https://huggingface.co/api/models?${params.toString()}`, {
                method: 'GET',
                headers,
            });
            if (!res.ok) return [];

            const rows = await res.json() as any[];
            return (rows || []).map((m: any) => ({
                id: m.id,
                likes: m.likes || 0,
                downloads: m.downloads || 0,
                pipeline_tag: m.pipeline_tag || '',
                tags: m.tags || [],
            }));
        } catch {
            return [];
        }
    });

    ipcMain.handle('ollama:getCapabilities', async (_event, modelName: string) => {
        try {
            await ensureOllamaRunning();
            const res = await fetch(`${OLLAMA_API_BASE}/show`, {
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
            const route = buildChatRoute(model, messages as ChatMessage[], apiKeys, { stream: true, thinkOptions });
            if (route.mode === 'ollama') {
                const ok = await ensureOllamaRunning();
                if (!ok) {
                    throw new Error('Ollama is not running. Start it with `ollama serve`.');
                }
            }
            const res = await fetch(route.endpoint, {
                method: 'POST',
                headers: route.headers,
                body: JSON.stringify(route.body),
                signal: abortController.signal,
            });
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
                        if (route.mode === 'gemini' && tLine.startsWith('data: ')) {
                            contentChunk = JSON.parse(tLine.slice(6)).candidates?.[0]?.content?.parts?.[0]?.text || '';
                        } 
                        else if (route.mode === 'anthropic' && tLine.startsWith('data: ')) {
                            const j = JSON.parse(tLine.slice(6));
                            if (j.type === 'content_block_delta') contentChunk = j.delta?.text || '';
                        }
                        else if (route.mode === 'openai' && tLine.startsWith('data: ')) {
                            const parsed = JSON.parse(tLine.slice(6));
                            contentChunk = parsed.choices?.[0]?.delta?.content || '';
                        }
                        else if (route.mode === 'ollama') {
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
            if (error.name === 'AbortError') {
                if (!mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('ollama:stream', { content: '', done: true });
                }
            } else if (!mainWindow.isDestroyed()) {
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
