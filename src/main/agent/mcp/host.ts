/* =======================================================================
   McpHost - Model Context Protocol client. Two transports:
     - stdio  : local child process, newline-delimited JSON-RPC
     - http   : streamable HTTP (POST JSON-RPC; JSON or SSE responses),
                with Mcp-Session-Id handling per the 2025 spec.
   Tools register as "mcp__<server>__<tool>" at the network permission tier.
   ======================================================================= */
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import type { McpConfig, McpServerConfig } from '../../../shared/agent';
import type { Tool, ToolContext, ToolResult } from '../types';
import type { ToolRegistry } from '../registry';

const PROTOCOL_VERSION = '2025-06-18';
const CALL_TIMEOUT = 60_000;

/** OS-essential env for MCP child processes - never the full host env (which
    may contain API keys/tokens that a third-party server should not inherit). */
function safeChildEnv(): Record<string, string> {
    const allow = [
        'PATH', 'Path', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH',
        'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR',
        'SystemRoot', 'windir', 'ComSpec', 'PATHEXT',
        'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'SHELL', 'TZ',
        // Interpreter/venv resolution — WITHOUT these a python/node MCP server
        // can't find its installed packages and dies on import, silently taking
        // all its tools with it. These are paths, not secrets.
        'PYTHONPATH', 'PYTHONHOME', 'VIRTUAL_ENV', 'PYENV_ROOT', 'PYENV_VERSION',
        'CONDA_PREFIX', 'CONDA_DEFAULT_ENV', 'NODE_PATH', 'NVM_DIR', 'NVM_BIN',
    ];
    const out: Record<string, string> = {};
    for (const k of allow) { const v = process.env[k]; if (v != null) out[k] = v; }
    return out;
}

/** fetch with a hard timeout on the request/headers phase. */
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try { return await fetch(url, { ...init, signal: ctrl.signal }); }
    finally { clearTimeout(timer); }
}

interface McpClient {
    serverName: string;
    tools: Array<{ name: string; description: string; inputSchema: any }>;
    start(): Promise<void>;
    callTool(name: string, args: unknown): Promise<{ text: string; isError: boolean }>;
    stop(): void;
}

interface Pending { resolve: (v: any) => void; reject: (e: any) => void; timer: NodeJS.Timeout; }

/* ---------------- stdio ---------------- */
class McpStdioClient implements McpClient {
    private proc: ChildProcessWithoutNullStreams | null = null;
    private nextId = 1;
    private pending = new Map<number, Pending>();
    private stdoutBuf = '';
    private stopped = false;
    private starting: Promise<void> | null = null;
    private restarts = 0;
    tools: Array<{ name: string; description: string; inputSchema: any }> = [];

    constructor(public serverName: string, private cfg: McpServerConfig) {}

    async start(): Promise<void> {
        // De-dupe concurrent (re)starts — a crash + an on-demand call could both
        // trigger one.
        if (this.starting) return this.starting;
        this.starting = this._spawnAndInit();
        try { await this.starting; } finally { this.starting = null; }
    }

    private async _spawnAndInit(): Promise<void> {
        // shell:true on Windows - "npx"/"uvx" are .cmd shims there and a bare
        // spawn() ENOENTs, which silently killed every stdio MCP server.
        this.proc = spawn(this.cfg.command!, this.cfg.args ?? [], {
            // Do NOT hand the full host environment (which may hold API keys /
            // tokens) to a third-party MCP server. Pass an OS-essentials
            // allowlist plus the server's own declared env.
            env: { ...safeChildEnv(), ...(this.cfg.env ?? {}) }, stdio: ['pipe', 'pipe', 'pipe'],
            shell: process.platform === 'win32',
        }) as ChildProcessWithoutNullStreams;
        this.proc.stdout.setEncoding('utf-8');
        this.proc.stdout.on('data', (c: string) => this.onStdout(c));
        this.proc.stderr.on('data', () => {});
        this.proc.on('exit', () => { this.proc = null; this.failAll(new Error('MCP server exited')); this.scheduleRestart(); });
        this.proc.on('error', (e) => { this.failAll(e); this.scheduleRestart(); });
        await this.request('initialize', { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, clientInfo: { name: 'vibe-ide', version: '1.0.0' } });
        this.notify('notifications/initialized', {});
        const list = await this.request('tools/list', {}).catch(() => ({ tools: [] }));
        this.tools = Array.isArray(list?.tools) ? list.tools : [];
        this.restarts = 0;
    }

    /** Auto-respawn after an unexpected exit so a long agent run doesn't lose an
        MCP server partway through. Backs off on a crash loop. */
    private scheduleRestart(): void {
        if (this.stopped || this.starting || this.proc) return;
        this.restarts++;
        const delay = Math.min(30_000, 1000 * Math.min(this.restarts, 15));
        setTimeout(() => {
            if (this.stopped || this.proc) return;
            this.start().catch(() => { /* will reschedule from its own exit/error */ });
        }, delay);
    }

    /** Ensure a live process before a tool call, restarting on demand if the
        server had crashed — so the call succeeds instead of erroring. */
    private async ensureAlive(): Promise<void> {
        if (this.proc && !this.proc.killed) return;
        if (this.stopped) throw new Error(`MCP server ${this.serverName} is stopped`);
        await this.start();
    }
    private onStdout(chunk: string) {
        this.stdoutBuf += chunk;
        let idx: number;
        while ((idx = this.stdoutBuf.indexOf('\n')) !== -1) {
            const line = this.stdoutBuf.slice(0, idx).trim();
            this.stdoutBuf = this.stdoutBuf.slice(idx + 1);
            if (!line) continue;
            let msg: any; try { msg = JSON.parse(line); } catch { continue; }
            if (!msg || msg.jsonrpc !== '2.0') continue;
            if (msg.id != null && (msg.result !== undefined || msg.error !== undefined)) {
                const p = this.pending.get(msg.id);
                if (p) { this.pending.delete(msg.id); clearTimeout(p.timer); msg.error ? p.reject(new Error(msg.error.message || 'MCP error')) : p.resolve(msg.result); }
            }
        }
    }
    private send(obj: unknown) { this.proc?.stdin.write(JSON.stringify(obj) + '\n'); }
    private notify(method: string, params: unknown) { this.send({ jsonrpc: '2.0', method, params }); }
    request(method: string, params: unknown): Promise<any> {
        const id = this.nextId++;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`MCP ${method} timed out`)); }, CALL_TIMEOUT);
            this.pending.set(id, { resolve, reject, timer });
            this.send({ jsonrpc: '2.0', id, method, params });
        });
    }
    async callTool(name: string, args: unknown) { await this.ensureAlive(); return normalizeToolResult(await this.request('tools/call', { name, arguments: args ?? {} })); }
    private failAll(err: Error) { for (const [, p] of this.pending) { clearTimeout(p.timer); p.reject(err); } this.pending.clear(); }
    stop() { this.stopped = true; try { this.proc?.kill(); } catch {} }
}

/* ---------------- streamable HTTP ---------------- */
class McpHttpClient implements McpClient {
    private nextId = 1;
    private sessionId: string | null = null;
    tools: Array<{ name: string; description: string; inputSchema: any }> = [];

    constructor(public serverName: string, private url: string, private headers: Record<string, string> = {}) {}

    async start(): Promise<void> {
        const initRes = await this.rpc('initialize', {
            protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, clientInfo: { name: 'vibe-ide', version: '1.0.0' },
        }, true);
        void initRes;
        await this.rpcNotify('notifications/initialized', {});
        const list = await this.rpc('tools/list', {}).catch(() => ({ tools: [] }));
        this.tools = Array.isArray(list?.tools) ? list.tools : [];
    }

    private baseHeaders(): Record<string, string> {
        const h: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            ...this.headers,
        };
        if (this.sessionId) h['Mcp-Session-Id'] = this.sessionId;
        return h;
    }

    private async rpcNotify(method: string, params: unknown): Promise<void> {
        await fetchWithTimeout(this.url, { method: 'POST', headers: this.baseHeaders(), body: JSON.stringify({ jsonrpc: '2.0', method, params }) }, CALL_TIMEOUT).catch(() => {});
    }

    private async rpc(method: string, params: unknown, captureSession = false): Promise<any> {
        const id = this.nextId++;
        // Bound the request phase so one hung endpoint can't stall load()/mcpReload
        // forever. The SSE body has its own deadline in readSse().
        const res = await fetchWithTimeout(this.url, { method: 'POST', headers: this.baseHeaders(), body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) }, CALL_TIMEOUT);
        if (captureSession) { const sid = res.headers.get('mcp-session-id'); if (sid) this.sessionId = sid; }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('text/event-stream')) return await this.readSse(res, id);
        const data = await res.json().catch(() => null);
        if (!data) return {};
        if (data.error) throw new Error(data.error.message || 'MCP error');
        return data.result;
    }

    private async readSse(res: Response, wantId: number): Promise<any> {
        const reader = res.body?.getReader();
        if (!reader) return {};
        const decoder = new TextDecoder();
        let buf = '';
        const deadline = Date.now() + CALL_TIMEOUT;
        while (Date.now() < deadline) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let sep: number;
            while ((sep = buf.indexOf('\n\n')) !== -1) {
                const evt = buf.slice(0, sep); buf = buf.slice(sep + 2);
                const dataLine = evt.split('\n').find((l) => l.startsWith('data:'));
                if (!dataLine) continue;
                let msg: any; try { msg = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
                if (msg.id === wantId) {
                    try { reader.cancel(); } catch {}
                    if (msg.error) throw new Error(msg.error.message || 'MCP error');
                    return msg.result;
                }
            }
        }
        throw new Error('MCP SSE timed out');
    }

    async callTool(name: string, args: unknown) { return normalizeToolResult(await this.rpc('tools/call', { name, arguments: args ?? {} })); }
    stop() { if (this.sessionId) fetch(this.url, { method: 'DELETE', headers: this.baseHeaders() }).catch(() => {}); }
}

function normalizeToolResult(res: any): { text: string; isError: boolean } {
    const content = Array.isArray(res?.content) ? res.content : [];
    const text = content.map((c: any) => (c?.type === 'text' ? c.text : c?.type ? `[${c.type}]` : '')).join('\n');
    return { text: text || '(no content)', isError: !!res?.isError };
}

export class McpHost {
    private clients = new Map<string, McpClient>();
    constructor(private registry: ToolRegistry) {}

    async load(config: McpConfig): Promise<{ server: string; tools: number; error?: string }[]> {
        await this.stopAll();
        this.registry.unregisterBySource('mcp');
        const report: { server: string; tools: number; error?: string }[] = [];
        const entries = Object.entries(config.mcpServers || {});
        await Promise.all(entries.map(async ([name, cfg]) => {
            if (cfg.disabled) { report.push({ server: name, tools: 0, error: 'disabled' }); return; }
            let client: McpClient;
            if (cfg.url) client = new McpHttpClient(name, cfg.url, cfg.headers ?? {});
            else if (cfg.command) client = new McpStdioClient(name, cfg);
            else { report.push({ server: name, tools: 0, error: 'no command or url' }); return; }
            try {
                await client.start();
                this.clients.set(name, client);
                for (const t of client.tools) this.registry.register(this.wrap(name, client, t));
                report.push({ server: name, tools: client.tools.length });
            } catch (e: any) {
                report.push({ server: name, tools: 0, error: e?.message || String(e) });
                client.stop();
            }
        }));
        return report;
    }

    private wrap(server: string, client: McpClient, def: { name: string; description: string; inputSchema: any }): Tool {
        return {
            name: `mcp__${server}__${def.name}`,
            description: def.description || `${def.name} (via ${server})`,
            inputSchema: def.inputSchema || { type: 'object', properties: {} },
            tier: 'network', source: 'mcp',
            render: () => `${server}: ${def.name}`,
            async execute(input: unknown, _ctx: ToolContext): Promise<ToolResult> {
                try { const { text, isError } = await client.callTool(def.name, input); return { ok: !isError, isError, content: text }; }
                catch (e: any) { return { ok: false, isError: true, content: `MCP call failed: ${e?.message || String(e)}` }; }
            },
        };
    }

    listServers(): string[] { return [...this.clients.keys()]; }
    async stopAll() { for (const [, c] of this.clients) c.stop(); this.clients.clear(); }
}
