/* =======================================================================
   vision.ts — small helper to describe an image via the configured vision
   model. Reuses the same provider routing + keys as the kernel so Ollama
   (local or cloud) and other providers work without extra wiring.
   ======================================================================= */
import fs from 'node:fs';
import type { AgentMessage } from '../../../shared/agent';
import { selectProvider, stripModel } from '../provider';
import type { ToolContext } from '../types';

export interface VisionModelRouting {
    model: string;
    ollamaCloud: boolean;
    ollamaLocal: boolean;
}

/** Auto-detect an Ollama vision model from common local/cloud names. */
export function pickVisionModel(ctx: ToolContext): VisionModelRouting | null {
    const pref = ctx.visionModel;
    if (pref?.model) return pref;
    const candidates = [
        'llava', 'llava:7b', 'llava:13b', 'llava:34b', 'bakllava', 'moondream',
        'gemma3', 'gemma3:4b', 'gemma3:12b', 'gemma3:27b', 'minicpm-v',
        'qwen2-vl', 'qwen2.5-vl', 'phi4-mini:3.8b',
    ];
    // ctx.apiKeys is not a roster; we can't enumerate installed models here.
    // If the user has configured nothing, fall back to a well-known default so
    // at least the tool returns a meaningful routing object. The actual model
    // availability is validated at inference time.
    return { model: 'llava', ollamaCloud: false, ollamaLocal: true };
}

export async function parseVisionDescription(
    pngPath: string,
    prompt: string,
    vision: VisionModelRouting,
    ctx: ToolContext,
    signal?: AbortSignal,
): Promise<string> {
    const buf = fs.readFileSync(pngPath);
    const mime = 'image/png';
    const b64 = buf.toString('base64');
    const messages: AgentMessage[] = [
        { role: 'system', parts: [{ type: 'text', text: 'You are a precise UI/UX assistant. Describe the attached screenshot in complete, faithful detail: layout, visible UI elements, and ALL text transcribed verbatim. Do not summarize or omit.' }] },
        { role: 'user', parts: [{ type: 'image', mimeType: mime, dataBase64: b64 }, { type: 'text', text: prompt }] },
    ];
    const provider = selectProvider(vision.model, ctx.apiKeys, { ollamaCloud: vision.ollamaCloud, ollamaLocal: vision.ollamaLocal });
    let out = '';
    for await (const ev of provider.stream({
        model: stripModel(vision.model),
        messages,
        tools: [],
        think: null,
        numCtx: 32768,
        signal: signal ?? ctx.signal,
        apiKeys: ctx.apiKeys,
        ollamaApiKey: ctx.ollamaApiKey,
        ollamaCloud: vision.ollamaCloud,
        ollamaLocal: vision.ollamaLocal,
    })) {
        if (ev.t === 'text') out += ev.v;
    }
    return out.trim();
}

/** Describe a screenshot and return both the file path and the caption. */
export async function describeScreenshot(
    pngPath: string | undefined,
    prompt: string,
    ctx: ToolContext,
    signal?: AbortSignal,
): Promise<{ description: string; path?: string }> {
    if (!pngPath || !fs.existsSync(pngPath)) return { description: '(no screenshot available)' };
    const vision = pickVisionModel(ctx);
    if (!vision) return { description: '(no vision model configured)', path: pngPath };
    const desc = await parseVisionDescription(pngPath, prompt, vision, ctx, signal).catch((e: any) => `(vision model failed: ${e?.message || String(e)})`);
    return { description: desc, path: pngPath };
}
