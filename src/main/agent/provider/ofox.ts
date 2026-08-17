/* =======================================================================
   OfoxAI — unified AI gateway (https://api.ofox.ai/v1)
   OpenAI-compatible endpoint fronting multiple LLM providers.

   From VIBE's side it's an OpenAI-compatible base URL + bearer API key.
   Models are tagged with an 'ofox:' prefix so the router sends them here.
   ======================================================================= */
import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export const OFOX_DEFAULT_BASE = 'https://api.ofox.ai/v1';

/** Curated popular models available on OfoxAI if /models endpoint is unreachable.
    Includes the full Kimi line (K3, K2.6, K2.5), GLM-5 and Claude Fable 5 — the
    gateway's website catalog often lists models before the /v1/models API does. */
export const OFOX_CURATED_MODELS = [
    { id: 'ofox:anthropic/claude-fable-5', label: 'Claude Fable 5 (OfoxAI)' },
    { id: 'ofox:moonshotai/kimi-k3', label: 'Kimi K3 (OfoxAI)' },
    { id: 'ofox:moonshotai/kimi-k2.7-code', label: 'Kimi K2.7 Code (OfoxAI)' },
    { id: 'ofox:moonshotai/kimi-k2.7-code-highspeed', label: 'Kimi K2.7 Code Highspeed (OfoxAI)' },
    { id: 'ofox:moonshotai/kimi-k2.6', label: 'Kimi K2.6 (OfoxAI)' },
    { id: 'ofox:moonshotai/kimi-k2.5', label: 'Kimi K2.5 (OfoxAI)' },
    { id: 'ofox:z-ai/glm-5', label: 'GLM-5 (OfoxAI)' },
    { id: 'ofox:z-ai/glm-5.1', label: 'GLM-5.1 (OfoxAI)' },
    { id: 'ofox:z-ai/glm-5.2', label: 'GLM-5.2 (OfoxAI)' },
    { id: 'ofox:z-ai/glm-5-turbo', label: 'GLM-5 Turbo (OfoxAI)' },
    { id: 'ofox:openai/gpt-5', label: 'GPT-5 (OfoxAI)' },
    { id: 'ofox:openai/gpt-5.1', label: 'GPT-5.1 (OfoxAI)' },
    { id: 'ofox:anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5 (OfoxAI)' },
    { id: 'ofox:anthropic/claude-opus-4.5', label: 'Claude Opus 4.5 (OfoxAI)' },
    { id: 'ofox:google/gemini-3.5-flash', label: 'Gemini 3.5 Flash (OfoxAI)' },
    { id: 'ofox:google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (OfoxAI)' },
    { id: 'ofox:bailian/qwen3.5-flash', label: 'Qwen3.5 Flash (OfoxAI)' },
    { id: 'ofox:deepseek/deepseek-chat', label: 'DeepSeek V3 (OfoxAI)' },
];

/** Disk cache of the last successful /models fetch, so the full catalog still
    shows when the gateway is temporarily unreachable. */
function cachePath(): string {
    try { return path.join(app.getPath('userData'), 'ofox-models-cache.json'); }
    catch { return ''; }
}

function readCache(): Array<{ id: string; label: string }> {
    try {
        const p = cachePath();
        if (!p) return [];
        const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
        return Array.isArray(data) ? data : [];
    } catch { return []; }
}

function writeCache(models: Array<{ id: string; label: string }>): void {
    try {
        const p = cachePath();
        if (!p) return;
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(models, null, 2));
    } catch { /* non-fatal */ }
}

/** True for any model id routed through OfoxAI. */
export function isOfoxModel(model: string): boolean {
    return model.startsWith('ofox:');
}

/** Strip the 'ofox:' prefix to get the model name expected by OfoxAI. */
export function ofoxModelName(model: string): string {
    return model.replace(/^ofox:/, '');
}

/** Resolve the configured OfoxAI base URL (.../v1), trailing slash trimmed. */
export function ofoxBaseUrl(apiKeys: Record<string, string> | undefined): string {
    const raw = (apiKeys?.ofoxBase || '').trim() || OFOX_DEFAULT_BASE;
    return raw.replace(/\/+$/, '');
}

/** Request headers for OfoxAI requests. */
export function ofoxHeaders(apiKeys: Record<string, string> | undefined): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const key = apiKeys?.ofox || '';
    if (key) headers.Authorization = `Bearer ${key}`;
    return headers;
}

/** List models available from OfoxAI gateway (GET /v1/models).
    Retries transient failures, and merges fetched + disk-cache + curated so the
    catalog never shrinks (Kimi K3, GLM-5, … always present). */
export async function listOfoxModels(
    apiKeys: Record<string, string> | undefined,
    signal?: AbortSignal,
): Promise<Array<{ id: string; label: string }>> {
    const base = ofoxBaseUrl(apiKeys);
    const key = apiKeys?.ofox || '';
    if (!key) return OFOX_CURATED_MODELS;

    let rows: any[] = [];
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const res = await fetch(`${base}/models`, {
                method: 'GET',
                headers: ofoxHeaders(apiKeys),
                signal,
            });
            if (!res.ok) {
                console.error(`[ofox] GET ${base}/models -> ${res.status}: ${await res.text().catch(() => res.statusText)}`);
                break;
            }
            const data = (await res.json()) as { data?: any[] };
            rows = Array.isArray(data?.data) ? data.data : Array.isArray(data as any) ? (data as any) : [];
            if (rows.length > 0) break;
        } catch (e) {
            console.error(`[ofox] GET ${base}/models attempt ${attempt + 1} error:`, (e as Error).message);
            if (attempt < 2) await new Promise((r) => setTimeout(r, 800));
        }
    }

    const seen = new Set<string>();
    const out: Array<{ id: string; label: string }> = [];
    const push = (id: string, label: string) => {
        const prefixed = id.startsWith('ofox:') ? id : `ofox:${id}`;
        if (seen.has(prefixed)) return;
        seen.add(prefixed);
        out.push({ id: prefixed, label });
    };

    for (const m of rows) {
        const id = typeof m === 'string' ? m : m?.id;
        if (!id) continue;
        push(id, `${id} (OfoxAI)`);
    }
    for (const m of readCache()) push(m.id, m.label);
    for (const m of OFOX_CURATED_MODELS) push(m.id, m.label);

    if (out.length > 0 && rows.length > 0) writeCache(out);
    console.log(`[ofox] ${out.length} model(s) available from ${base}`);
    return out;
}
