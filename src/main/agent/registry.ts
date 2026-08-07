/* =======================================================================
   ToolRegistry - holds every executable tool (builtin, MCP, skill),
   advertises schemas to the model, and executes a call through the
   permission broker with result truncation.
   ======================================================================= */
import type { ProviderToolDef, Tool, ToolContext, ToolResult } from './types';
import { toolToSchema } from './types';
import { resolveWithinRoot } from './fsGuard';
import type { ToolSchema } from '../../shared/agent';

const RESULT_CHAR_CAP = 12000;

function truncate(s: string): string {
    if (s.length <= RESULT_CHAR_CAP) return s;
    return s.slice(0, RESULT_CHAR_CAP) + `\n... [truncated ${s.length - RESULT_CHAR_CAP} chars]`;
}

/** Which resolved target + outside-root flag does this call touch? */
function targetFor(tool: Tool, input: any, ctx: ToolContext): { target: string | null; outsideRoot: boolean } {
    if (input && typeof input.path === 'string') {
        try {
            // resolveWithinRoot does a path.relative containment check. The old
            // startsWith(root) compare had a prefix hole ("C:\proj-evil" passed
            // as inside "C:\proj") and broke on Windows drive-letter casing.
            const { resolved, outsideRoot } = resolveWithinRoot(input.path, ctx.projectRoot);
            return { target: resolved, outsideRoot };
        } catch { return { target: input.path, outsideRoot: true }; }
    }
    if (tool.name === 'bash' && input && typeof input.command === 'string') {
        return { target: input.command.slice(0, 120), outsideRoot: false };
    }
    return { target: null, outsideRoot: false };
}

export class ToolRegistry {
    private tools = new Map<string, Tool>();

    register(tool: Tool) { this.tools.set(tool.name, tool); }
    registerAll(tools: Tool[]) { for (const t of tools) this.register(t); }
    unregisterBySource(source: Tool['source']) {
        for (const [name, t] of this.tools) if (t.source === source) this.tools.delete(name);
    }
    has(name: string) { return this.tools.has(name); }
    get(name: string) { return this.tools.get(name); }
    all(): Tool[] { return [...this.tools.values()]; }

    /** Check if a tool name is enabled, supporting 'mcp__*' wildcard. */
    private isEnabled(name: string, source: string, enabled?: string[]): boolean {
        if (!enabled) return true;
        if (enabled.includes(name)) return true;
        // Wildcard: 'mcp__*' enables all MCP tools
        if (source === 'mcp' && enabled.includes('mcp__*')) return true;
        return false;
    }

    schemas(enabled?: string[]): ToolSchema[] {
        return this.all()
            .filter((t) => this.isEnabled(t.name, t.source, enabled))
            .map(toolToSchema);
    }

    providerDefs(enabled?: string[]): ProviderToolDef[] {
        return this.all()
            .filter((t) => this.isEnabled(t.name, t.source, enabled))
            .map((t) => ({ name: t.name, description: t.description, parameters: t.inputSchema }));
    }

    /**
     * Execute one tool call: validate -> permission gate -> run -> truncate.
     * Never throws; failures come back as an error ToolResult so the model
     * can react instead of the loop dying.
     */
    async execute(call: { id: string; name: string; input: unknown }, ctx: ToolContext): Promise<ToolResult> {
        const tool = this.tools.get(call.name);
        if (!tool) {
            return { ok: false, isError: true, content: `Unknown tool "${call.name}". Available: ${[...this.tools.keys()].join(', ')}` };
        }
        const input: any = call.input ?? {};
        const { target, outsideRoot } = targetFor(tool, input, ctx);
        const render = tool.render ? safeRender(tool, input) : tool.name;

        const decision = await ctx.permissions.check({
            runId: ctx.runId,
            tool: tool.name,
            tier: tool.tier,
            render,
            target,
            outsideRoot,
            input,
        });
        if (decision === 'deny') {
            return { ok: false, isError: true, content: `Denied by user: ${tool.name}` };
        }

        if (ctx.signal.aborted) return { ok: false, isError: true, content: 'Cancelled.' };

        try {
            const res = await tool.execute(input, ctx);
            return { ...res, content: truncate(res.content) };
        } catch (e: any) {
            return { ok: false, isError: true, content: `Tool "${tool.name}" threw: ${e?.message || String(e)}` };
        }
    }
}

function safeRender(tool: Tool, input: unknown): string {
    try { return tool.render!(input); } catch { return tool.name; }
}
