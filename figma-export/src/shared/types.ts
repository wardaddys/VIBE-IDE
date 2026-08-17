import type {
    AgentDelta, McpConfig, PermissionResolution, RunRequest, ScheduledTask,
    SessionRecord, Surface, ToolSchema, AgentMessage, SkillMeta, StopReason,
    McpServerConfig, CloudModelInfo, McpRegistryEntry, SkillCatalogEntry,
    DebateStartRequest, ProjectRecord,
} from './agent';

export interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
    extension?: string;
}
export interface TerminalSession {
    id: string;
    title: string;
}
export interface OllamaModel {
    name: string;
    size: number;
    modifiedAt: string;
    details: any;
}
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface ModelCapability {
    image?: boolean;
    vision?: boolean;
    tools?: boolean;
    contextLength?: number;
    web?: boolean;
    diff?: boolean;
    canExecute?: boolean;
    requiresApproval?: boolean;
    think?: boolean;
    thinkBudget?: 'toggle' | 'tiered';
}

export interface BackgroundAgentConfig {
    obsidianKey?: string;
    apiKeys?: Record<string, string>;
    collectorModel?: string;
    reviewerModel?: string;
}

export interface KernelAPI {
    run: (req: RunRequest) => Promise<{ stopReason: StopReason }>;
    cancel: (runId: string) => Promise<{ ok: boolean }>;
    approve: (runId: string, res: PermissionResolution) => Promise<{ ok: boolean }>;
    answer: (reqId: string, answers: Record<string, string[]>) => Promise<{ ok: boolean }>;
    listTools: (surface?: Surface) => Promise<ToolSchema[]>;
    onDelta: (cb: (d: AgentDelta) => void) => void;
    onScheduledFired: (cb: (info: { taskId: string; sessionId: string }) => void) => void;
    createSession: (opts: { surface: Surface; title?: string; projectRoot: string | null; model: string }) => Promise<SessionRecord>;
    listSessions: (surface?: Surface) => Promise<SessionRecord[]>;
    listProjects: (surface?: Surface) => Promise<ProjectRecord[]>;
    getMessages: (id: string) => Promise<AgentMessage[]>;
    getSession: (id: string) => Promise<SessionRecord | null>;
    renameSession: (id: string, title: string) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    sessionRewind: (id: string) => Promise<{ text: string }>;
    mcpGetConfig: () => Promise<McpConfig>;
    mcpSaveConfig: (config: McpConfig) => Promise<Array<{ server: string; tools: number; error?: string }>>;
    mcpReload: () => Promise<Array<{ server: string; tools: number; error?: string }>>;
    skillsList: () => Promise<SkillMeta[]>;
    scheduleList: () => Promise<ScheduledTask[]>;
    scheduleAdd: (t: Partial<ScheduledTask>) => Promise<ScheduledTask>;
    scheduleUpdate: (id: string, patch: Partial<ScheduledTask>) => Promise<boolean>;
    scheduleRemove: (id: string) => Promise<boolean>;
    cloudModels: (ollamaKey?: string) => Promise<CloudModelInfo[]>;
    mcpSearch: (query?: string) => Promise<McpRegistryEntry[]>;
    mcpAdd: (key: string, config: McpServerConfig) => Promise<Array<{ server: string; tools: number; error?: string }>>;
    mcpRemove: (key: string) => Promise<Array<{ server: string; tools: number; error?: string }>>;
    skillsCatalog: () => Promise<SkillCatalogEntry[]>;
    skillsInstall: (name: string) => Promise<{ ok: boolean; files?: number; error?: string }>;
    skillsRemove: (name: string) => Promise<{ ok: boolean; error?: string }>;
}

export interface VibeAPI {
    /** Host OS of the Electron main process, so the renderer can pick shell syntax
     *  (bash vs PowerShell) instead of assuming Windows. */
    platform: NodeJS.Platform;

    createTerminal: (cwd?: string) => Promise<string>;
    sendTerminalInput: (id: string, data: string) => Promise<void>;
    getTerminalOutput: (id: string) => Promise<string>;
    clearTerminalOutput: (id: string) => Promise<void>;
    onTerminalData: (callback: (id: string, data: string) => void) => void;
    killTerminal: (id: string) => Promise<void>;
    resizeTerminal: (id: string, cols: number, rows: number) => Promise<void>;

    openFolder: () => Promise<string | null>;
    listDirs: (dir?: string) => Promise<{ path: string; parent: string | null; dirs: { name: string; path: string }[] }>;
    makeDir: (parent: string, name: string) => Promise<string>;
    setProjectFolder: (dir: string) => Promise<string>;
    dataHome: {
        get: () => Promise<{ path: string; chosen: boolean; default: string }>;
        isFirstRun: () => Promise<boolean>;
        default: () => Promise<string>;
        pick: () => Promise<string | null>;
        set: (path: string, move?: boolean) => Promise<{ ok: boolean; path?: string; error?: string }>;
    };
    readDir: (dirPath: string) => Promise<FileEntry[]>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    watchFolder: (dirPath: string) => Promise<void>;
    onFolderChanged: (callback: () => void) => void;
    readMemory: (projectPath: string) => Promise<string | null>;
    writeMemory: (projectPath: string, memory: any) => Promise<boolean>;

    detectOllama: () => Promise<{ detected: boolean, version?: string }>;
    statusOllama: () => Promise<boolean>;
    listModels: () => Promise<string[]>;
    chat: (model: string, messages: ChatMessage[], apiKeys?: Record<string, string>, thinkOptions?: any) => Promise<void>;
    onChatStream: (callback: (chunk: { content: string, done: boolean }) => void) => void;
    stopGeneration: () => Promise<void>;
    getModelCapabilities: (modelName: string, opts?: { cloud?: boolean; ollamaKey?: string }) => Promise<{
        modelName: string;
        think: boolean;
        thinkBudget?: 'toggle' | 'tiered';
        vision: boolean;
        tools: boolean;
        contextLength: number;
        family: string;
        rawCapabilities: string[];
    } | null>;
    getLoadedModels: () => Promise<string[]>;
    listOpenRouterModels: (apiKeys?: Record<string, string>) => Promise<Array<{
        id: string;
        provider: 'openrouter';
        label: string;
        contextWindow: number | null;
        inputPer1M: number | null;
        outputPer1M: number | null;
        supportsTools: boolean;
        supportsVision: boolean;
    }>>;
    searchHuggingFaceModels: (query: string, apiKeys?: Record<string, string>) => Promise<Array<{
        id: string;
        likes: number;
        downloads: number;
        pipeline_tag: string;
        tags: string[];
    }>>;
    listOmniModels: (apiKeys?: Record<string, string>) => Promise<Array<{ id: string; label: string }>>;
    listOfoxModels: (apiKeys?: Record<string, string>) => Promise<Array<{ id: string; label: string }>>;
    log: (msg: string) => Promise<void>;

    startBackgroundAgents: (projectPath: string, config?: BackgroundAgentConfig) => Promise<{ success: boolean }>;
    getBriefing: () => Promise<string>;
    logAgentAction: (description: string) => Promise<void>;
    generateNotebookExport: (outputPath: string) => Promise<boolean>;
    setObsidianKey: (key: string) => Promise<void>;
    triggerBriefing: () => Promise<{ success: boolean }>;
    getAgentStatus: () => Promise<{
        collector: {
            isRunning: boolean;
            eventCount: number;
            lastEventTime: number | null;
            isDistilling: boolean;
            lastDistillTime: number | null;
        };
        reviewer: {
            isRunning: boolean;
            isSynthesizing: boolean;
            lastBriefingTime: number;
            briefingCount: number;
        };
    }>;

    obsidianPing: (apiKey: string) => Promise<boolean>;
    obsidianUpsertNote: (apiKey: string, vaultPath: string, content: string) => Promise<boolean>;
    obsidianAppendNote: (apiKey: string, vaultPath: string, content: string) => Promise<boolean>;
    obsidianUpdateProject: (apiKey: string, projectName: string, projectStructure: string, projectPath: string) => Promise<boolean>;
    obsidianLogRun: (apiKey: string, projectName: string, mission: string, model: string, steps: string[], result: string, criteraMet: string) => Promise<boolean>;
    obsidianLogDecision: (apiKey: string, projectName: string, summary: string, filesChanged: string) => Promise<boolean>;

    kernel: KernelAPI;

    /** Dual-model debate: two models argue in real-time, user can interject. */
    debate: {
        start: (req: DebateStartRequest) => Promise<{ ok: boolean; runId: string }>;
        cancel: (runId: string) => Promise<{ ok: boolean }>;
        interject: (runId: string, message: string) => Promise<{ ok: boolean; error?: string }>;
        onDelta: (cb: (d: { runId: string; type: string; round?: number; content?: string; message?: string }) => void) => void;
        listModels: (apiKeys?: Record<string, string>) => Promise<{ ok: boolean; models: string[] }>;
    };

    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onWindowMaximized: (callback: (maximized: boolean) => void) => void;
}

declare global {
    interface Window {
        vibe: VibeAPI;
    }
}
