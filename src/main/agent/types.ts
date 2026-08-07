/* =======================================================================
   Main-process internal agent types (NOT serialized across IPC).
   Contains functions / live handles - stays in the main process.
   ======================================================================= */
import type {
    AgentDelta,
    AgentMessage,
    JSONSchema,
    PermissionTier,
    ToolSchema,
} from '../../shared/agent';
import type { PermissionBroker } from './permissions';

export interface ToolContext {
    runId: string;
    sessionId: string;
    projectRoot: string | null;
    cwd: string;
    signal: AbortSignal;
    emit: (delta: AgentDelta) => void;
    permissions: PermissionBroker;
    /** filesystem canonicalizer/guard shared with the fs tools */
    resolvePath: (input: string, opts?: { allowOutsideRoot?: boolean }) => string;
    apiKeys: Record<string, string>;
    ollamaApiKey?: string;
    /** Optional vision model routing picked by the UI for this run. */
    visionModel?: { model: string; ollamaCloud: boolean; ollamaLocal: boolean };
    /** spawn a sub-agent; returns its final text. Provided by the kernel. */
    runSubAgent?: (opts: SubAgentSpec) => Promise<string>;
    /** invoke a skill body injection; provided by the kernel. */
    loadSkill?: (name: string) => Promise<string>;
    /** append a command record to the project markdown command log. */
    logCommand?: (rec: { command: string; output: string; status: 'ok' | 'error' | 'cancelled' | 'timeout' | 'background'; cwd: string; at: string }) => void;
    depth: number;
}

export interface SubAgentSpec {
    description: string;
    prompt: string;
    subagentType: string;
    /** worker model for this sub-task; omit to inherit the conductor's model */
    model?: string;
    parentCtx: ToolContext;
}

export interface ToolResult<O = unknown> {
    ok: boolean;
    /** model-visible text (already truncated/paginated) */
    content: string;
    /** structured payload for the UI (diff, rows, image ref) */
    data?: O;
    isError?: boolean;
}

export interface Tool<I = any, O = unknown> {
    name: string;
    description: string;
    inputSchema: JSONSchema;
    tier: PermissionTier;
    source: 'builtin' | 'mcp' | 'skill';
    /** one-line UI summary of the call, e.g. "Edit src/app.ts". */
    render?: (input: I) => string;
    execute: (input: I, ctx: ToolContext) => Promise<ToolResult<O>>;
}

export function toolToSchema(t: Tool): ToolSchema {
    return {
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        tier: t.tier,
        source: t.source,
    };
}

/* --- Provider adapter contract ------------------------------------------- */

export interface ProviderToolDef {
    name: string;
    description: string;
    parameters: JSONSchema;
}

export interface ProviderRequest {
    model: string;
    messages: AgentMessage[];
    tools: ProviderToolDef[];
    think?: { enabled: boolean; level: 'low' | 'medium' | 'high' } | null;
    numCtx?: number;
    signal: AbortSignal;
    apiKeys: Record<string, string>;
    ollamaApiKey?: string;
    ollamaCloud?: boolean;
    ollamaLocal?: boolean;
}

/** A normalized streamed event from a provider (pre-`AgentDelta`). */
export type ProviderStopReason = 'end_turn' | 'max_tokens' | 'tool_use' | 'error';

export type ProviderEvent =
    | { t: 'text'; v: string }
    | { t: 'thinking'; v: string }
    | { t: 'tool_call'; id: string; name: string; input: unknown }
    | { t: 'usage'; inputTokens?: number; outputTokens?: number }
    | { t: 'done'; stopReason: ProviderStopReason; error?: string };

export interface ProviderAdapter {
    /** stream a single assistant turn as normalized events */
    stream(req: ProviderRequest): AsyncGenerator<ProviderEvent, void, unknown>;
}
