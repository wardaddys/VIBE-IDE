/* =======================================================================
   OmniRoute — a local AI gateway (https://github.com/diegosouzapw/OmniRoute)
   that fronts many providers behind ONE OpenAI-compatible endpoint (default
   http://localhost:20128/v1) with its own fallback/routing.

   From VIBE's side it's just an OpenAI-compatible base URL + optional key,
   so there's no token exchange here — this module only resolves the
   configured base URL, headers, and model catalog. Models are tagged with
   an 'omni:' prefix so the router sends them here.
   ======================================================================= */

export const OMNI_DEFAULT_BASE = 'http://localhost:20128/v1';

/** True for any model id routed through OmniRoute. */
export function isOmniModel(model: string): boolean {
    return model.startsWith('omni:');
}

/** Strip the 'omni:' prefix to the bare model name the gateway expects. */
export function omniModelName(model: string): string {
    return model.replace(/^omni:/, '');
}

/** Resolve the configured gateway base URL (…/v1), trailing slash trimmed.
    Falls back to the local default when the user hasn't set one. */
export function omniBaseUrl(apiKeys: Record<string, string> | undefined): string {
    const raw = (apiKeys?.omniBase || '').trim() || OMNI_DEFAULT_BASE;
    return raw.replace(/\/+$/, '');
}

/** Request headers for the gateway. The key is optional — a local, keyless
    OmniRoute install accepts requests without Authorization. */
export function omniHeaders(apiKeys: Record<string, string> | undefined): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const key = apiKeys?.omni || '';
    if (key) headers.Authorization = `Bearer ${key}`;
    return headers;
}

/** List the models the gateway currently serves (GET /v1/models). Best-effort:
    returns [] if the gateway isn't running so the picker degrades gracefully. */
export async function listOmniModels(
    apiKeys: Record<string, string> | undefined,
    signal?: AbortSignal,
): Promise<Array<{ id: string; label: string }>> {
    const base = omniBaseUrl(apiKeys);
    try {
        const res = await fetch(`${base}/models`, { method: 'GET', headers: omniHeaders(apiKeys), signal });
        if (!res.ok) {
            console.error(`[omni] GET ${base}/models -> ${res.status}: ${await res.text().catch(() => res.statusText)}`);
            return [];
        }
        const data = (await res.json()) as { data?: any[] };
        const rows = Array.isArray(data?.data) ? data.data : [];
        const seen = new Set<string>();
        const out: Array<{ id: string; label: string }> = [];
        for (const m of rows) {
            const id = m?.id;
            if (!id || seen.has(id)) continue;
            seen.add(id);
            out.push({ id: `omni:${id}`, label: id });
        }
        console.log(`[omni] ${out.length} model(s) available from ${base}`);
        return out;
    } catch (e) {
        console.error(`[omni] GET ${base}/models error:`, (e as Error).message);
        return [];
    }
}
