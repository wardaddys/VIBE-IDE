/* =======================================================================
   Web tools - wrap Ollama's hosted web_search / web_fetch APIs.
   Uses the user's OLLAMA_API_KEY (free Ollama account). Results are large,
   so each is capped before returning (quirk #7: context blow-up).
   ======================================================================= */
import type { Tool, ToolContext, ToolResult } from '../types';

const OLLAMA_BASE = 'https://ollama.com/api';
const PER_RESULT_CAP = 1600;

function key(ctx: ToolContext): string | null {
    return ctx.ollamaApiKey || ctx.apiKeys.ollama || process.env.OLLAMA_API_KEY || null;
}

export const webSearchTool: Tool<{ query: string; max_results?: number }> = {
    name: 'web_search',
    description: 'Search the web for current information. Returns titles, URLs, and content snippets.',
    tier: 'network',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: {
            query: { type: 'string', description: 'Search query.' },
            max_results: { type: 'number', description: 'Max results (1-10, default 5).' },
        },
        required: ['query'],
    },
    render: (i) => `Search: ${i.query}`,
    async execute(input, ctx): Promise<ToolResult> {
        const k = key(ctx);
        if (!k) return { ok: false, isError: true, content: 'No Ollama API key set. Add OLLAMA_API_KEY in Settings to enable web search.' };
        const res = await fetch(`${OLLAMA_BASE}/web_search`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
            body: JSON.stringify({ query: input.query, max_results: Math.min(input.max_results ?? 5, 10) }),
            signal: ctx.signal,
        }).catch((e) => { throw new Error(`web_search failed: ${e.message}`); });
        if (!res.ok) return { ok: false, isError: true, content: `web_search ${res.status}: ${await res.text().catch(() => '')}` };
        const data = await res.json() as any;
        const results = Array.isArray(data?.results) ? data.results : [];
        const rendered = results.map((r: any, i: number) =>
            `#${i + 1} ${r.title}\n${r.url}\n${String(r.content || '').slice(0, PER_RESULT_CAP)}`).join('\n\n');
        return { ok: true, content: rendered || '(no results)', data: { count: results.length } };
    },
};

export const webFetchTool: Tool<{ url: string }> = {
    name: 'web_fetch',
    description: 'Fetch the main content of a single web page by URL.',
    tier: 'network',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: { url: { type: 'string', description: 'The URL to fetch.' } },
        required: ['url'],
    },
    render: (i) => `Fetch: ${i.url}`,
    async execute(input, ctx): Promise<ToolResult> {
        const k = key(ctx);
        if (!k) return { ok: false, isError: true, content: 'No Ollama API key set. Add OLLAMA_API_KEY in Settings to enable web fetch.' };
        const res = await fetch(`${OLLAMA_BASE}/web_fetch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${k}` },
            body: JSON.stringify({ url: input.url }),
            signal: ctx.signal,
        }).catch((e) => { throw new Error(`web_fetch failed: ${e.message}`); });
        if (!res.ok) return { ok: false, isError: true, content: `web_fetch ${res.status}: ${await res.text().catch(() => '')}` };
        const data = await res.json() as any;
        const body = `${data?.title || ''}\n\n${String(data?.content || '').slice(0, PER_RESULT_CAP * 4)}`;
        return { ok: true, content: body.trim() || '(empty page)', data: { links: data?.links?.slice(0, 20) } };
    },
};

export const webTools: Tool[] = [webSearchTool, webFetchTool];
