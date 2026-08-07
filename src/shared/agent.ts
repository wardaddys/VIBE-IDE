/* =======================================================================
   VIBE Agent - shared type contract (main  renderer)

   These types cross the IPC boundary. Keep them serializable (no functions,
   no class instances). The kernel in main emits `AgentDelta` events; the
   renderer subscribes and renders them.
   ======================================================================= */

/** JSON Schema subset we send to models as tool parameter definitions. */
export interface JSONSchema {
    type?: string;
    description?: string;
    properties?: Record<string, JSONSchema>;
    items?: JSONSchema;
    required?: string[];
    enum?: unknown[];
    default?: unknown;
    [k: string]: unknown;
}

/** Multimodal message parts - one model for text, images, tool traffic, thinking. */
export type MessagePart =
    | { type: 'text'; text: string }
    | { type: 'image'; mimeType: string; dataBase64: string }
    | { type: 'thinking'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
    | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean; name?: string };

export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMessage {
    role: AgentRole;
    parts: MessagePart[];
}

/** Surface presets - same kernel, different tool set + posture + layout. */
export type Surface = 'chat' | 'cowork' | 'code' | 'design';

/** Permission tiers derived from a tool's read/mutate flags. */
export type PermissionTier = 'safe' | 'mutating' | 'exec' | 'network';

export type PermissionDecision = 'allow' | 'deny' | 'ask';
export type PermissionScope = 'once' | 'session' | 'always';

/** A tool schema as advertised to the renderer / model (no executor). */
export interface ToolSchema {
    name: string;
    description: string;
    inputSchema: JSONSchema;
    tier: PermissionTier;
    source: 'builtin' | 'mcp' | 'skill';
}

/** Normalized streaming delta - every provider adapter emits this shape. */
export type AgentDelta =
    | { t: 'run_start'; runId: string; surface: Surface; model: string; sessionId?: string }
    | { t: 'text'; runId: string; v: string }
    | { t: 'thinking'; runId: string; v: string }
    | { t: 'tool_call'; runId: string; id: string; name: string; input: unknown; render: string }
    | { t: 'tool_result'; runId: string; id: string; name: string; ok: boolean; content: string; data?: unknown }
    | { t: 'status'; runId: string; v: string }
    | { t: 'permission_req'; runId: string; req: PermissionRequest }
    | { t: 'permission_resolved'; runId: string; reqId: string; decision: PermissionDecision }
    | { t: 'usage'; runId: string; inputTokens?: number; outputTokens?: number }
    | { t: 'ask_user'; runId: string; req: UserQuestionRequest }
    | { t: 'ask_user_resolved'; runId: string; reqId: string; answers: Record<string, string[]> }
    | { t: 'error'; runId: string; message: string }
    | { t: 'done'; runId: string; stopReason: StopReason };

export type StopReason = 'end_turn' | 'max_tokens' | 'tool_use' | 'stopped' | 'budget' | 'error';

/** Multiple-choice question(s) the model can pose mid-run via the ask_user tool. */
export interface UserQuestionOption { label: string; description?: string }
export interface UserQuestion { question: string; options: UserQuestionOption[]; multi?: boolean }
export interface UserQuestionRequest { id: string; runId: string; questions: UserQuestion[] }

export interface PermissionRequest {
    id: string;
    runId: string;
    toolName: string;
    tier: PermissionTier;
    render: string;           // one-line human summary ("Edit src/app.ts")
    target: string | null;    // resolved path or command, for the UI
    input: unknown;
}

export interface PermissionResolution {
    reqId: string;
    decision: Exclude<PermissionDecision, 'ask'>;
    scope: PermissionScope;
}

/** Persisted permission rule. */
export interface PermissionRule {
    tool: string;             // glob: "bash", "mcp__*", "write_file"
    target?: string;          // glob on resolved target; optional
    decision: Exclude<PermissionDecision, 'ask'>;
    scope: PermissionScope;
    createdAt: string;
}

/** Options that start a run. */
export interface RunRequest {
    sessionId: string;
    surface: Surface;
    model: string;
    projectRoot: string | null;
    input: MessagePart[];
    /** explicit tool allowlist override; if absent, surface preset decides */
    tools?: string[];
    think?: { enabled: boolean; level: 'low' | 'medium' | 'high' } | null;
    /** API keys / tokens by provider (kept in main; never persisted to renderer). */
    apiKeys?: Record<string, string>;
    ollamaApiKey?: string;
    /** true when the selected model is an Ollama Cloud model (route to ollama.com with key) */
    ollamaCloud?: boolean;
    /** true when the model is a locally-installed Ollama model */
    ollamaLocal?: boolean;
    /** auto-approve all tool permissions (used for sandboxed sub-agents) */
    autoApprove?: boolean;
    /**
     * Confine this run to projectRoot: DENY (not ask) any out-of-root target
     * even under autoApprove. Set for sandboxed sub-agents, which have no
     * interactive user to answer a force-ask and must not read outside root.
     */
    confineToRoot?: boolean;
    /**
     * Skip session persistence for this run (onPersist). Used by transient
     * runs like debate turns, which manage their own history and must not be
     * written into the chat session store.
     */
    ephemeral?: boolean;
    /** sub-agent recursion depth (0 = top level) */
    depth?: number;
    /**
     * build = execute end-to-end, never end the turn asking permission to proceed;
     * plan  = read-only run that produces a plan and waits for approval.
     */
    mode?: 'build' | 'plan';
    /** worker models the conductor may dispatch sub-tasks to (task tool `model` arg). */
    availableModels?: string[];
    /**
     * Vision fallback. When the user attaches images but `model` can't see them,
     * this vision-capable model describes the images and the description is fed
     * to the main model as text. Absent = no images, or the main model has vision.
     */
    vision?: { model: string; ollamaCloud: boolean; ollamaLocal: boolean };
}

/** Per-model routing + vision refs for a debate turn (computed in the renderer). */
export interface DebateModelRouting { ollamaCloud: boolean; ollamaLocal: boolean }
export interface DebateVisionRef { model: string; ollamaCloud: boolean; ollamaLocal: boolean }

/**
 * Payload for starting a dual-model debate. Each turn runs through the kernel,
 * so this mirrors the important RunRequest fields (message parts incl. images,
 * surface, project root, per-model routing + vision fallback).
 */
export interface DebateStartRequest {
    modelA: string;
    modelB: string;
    input: MessagePart[];
    surface?: Surface;
    projectRoot?: string | null;
    apiKeys?: Record<string, string>;
    ollamaApiKey?: string;
    maxRounds?: number;
    judgeModel?: string;
    routingA?: DebateModelRouting;
    routingB?: DebateModelRouting;
    visionA?: DebateVisionRef;
    visionB?: DebateVisionRef;
    availableModels?: string[];
    /** true = both models answer each round CONCURRENTLY (round 1 = the question,
        later rounds = each rebuts the other's PREVIOUS round), then sync.
        false (default) = sequential: A answers, then B answers seeing A. */
    simultaneous?: boolean;
    /** Optional tool allowlist override (e.g. read-only debate); omit for full surface tools. */
    tools?: string[];
}

export interface McpServerConfig {
    command?: string;         // stdio
    args?: string[];
    env?: Record<string, string>;
    url?: string;             // http/sse
    headers?: Record<string, string>;
    disabled?: boolean;
}

export interface McpConfig {
    mcpServers: Record<string, McpServerConfig>;
}

export interface SkillMeta {
    name: string;
    description: string;
    path: string;
    allowedTools?: string[];
}

export interface ScheduledTask {
    id: string;
    title: string;
    surface: Surface;
    model: string;
    projectRoot: string | null;
    prompt: string;
    /** cron expression OR ISO timestamp for one-shot */
    cron?: string;
    fireAt?: string;
    enabled: boolean;
    lastRunAt?: string;
    createdAt: string;
}

/** Session/thread record. */
export interface SessionRecord {
    id: string;
    surface: Surface;
    title: string;
    projectRoot: string | null;
    model: string;
    createdAt: string;
    updatedAt: string;
}

/** A project bucket derived from persisted sessions. */
export interface ProjectRecord {
    root: string | null;
    name: string;
    sessions: SessionRecord[];
    updatedAt: string;
}

/* ---- Live catalog types (pulled from the web) ---- */
export interface CloudModelInfo {
    name: string;
    size: number;
    modifiedAt: string;
}
export interface McpRegistryEntry {
    name: string;
    title: string;
    description: string;
    version: string;
    transport: 'stdio' | 'remote' | 'unknown';
    install: { command: string; args: string[] } | { url: string } | null;
    installed: boolean;
}
export interface SkillCatalogEntry {
    name: string;
    description: string;
    installed: boolean;
    path: string; // repo path
}
