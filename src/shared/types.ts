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
    thinkBudget?: 'toggle' | 'tiered'; // toggle = on/off only, tiered = low/med/high
}

export interface BackgroundAgentConfig {
    obsidianKey?: string;
    apiKeys?: Record<string, string>;
    collectorModel?: string;
    reviewerModel?: string;
}

export interface VibeAPI {
    // Terminal
    createTerminal: (cwd?: string) => Promise<string>;
    sendTerminalInput: (id: string, data: string) => Promise<void>;
    getTerminalOutput: (id: string) => Promise<string>;
    clearTerminalOutput: (id: string) => Promise<void>;
    onTerminalData: (callback: (id: string, data: string) => void) => void;
    killTerminal: (id: string) => Promise<void>;
    resizeTerminal: (id: string, cols: number, rows: number) => Promise<void>;

    // Filesystem
    openFolder: () => Promise<string | null>;
    readDir: (dirPath: string) => Promise<FileEntry[]>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    watchFolder: (dirPath: string) => Promise<void>;
    onFolderChanged: (callback: () => void) => void;
    readMemory: (projectPath: string) => Promise<string | null>;
    writeMemory: (projectPath: string, memory: any) => Promise<boolean>;

    // Ollama / AI
    detectOllama: () => Promise<{ detected: boolean, version?: string }>;
    statusOllama: () => Promise<boolean>;
    listModels: () => Promise<string[]>;
    chat: (model: string, messages: ChatMessage[], apiKeys?: Record<string, string>, thinkOptions?: any) => Promise<void>;
    onChatStream: (callback: (chunk: { content: string, done: boolean }) => void) => void;
    stopGeneration: () => Promise<void>;
    getModelCapabilities: (modelName: string) => Promise<{
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
    log: (msg: string) => Promise<void>;

    // Background Agents
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

    // Obsidian Integration
    obsidianPing: (apiKey: string) => Promise<boolean>;
    obsidianUpsertNote: (apiKey: string, vaultPath: string, content: string) => Promise<boolean>;
    obsidianAppendNote: (apiKey: string, vaultPath: string, content: string) => Promise<boolean>;
    obsidianUpdateProject: (
        apiKey: string,
        projectName: string,
        projectStructure: string,
        projectPath: string
    ) => Promise<boolean>;
    obsidianLogRun: (
        apiKey: string,
        projectName: string,
        mission: string,
        model: string,
        steps: string[],
        result: string,
        criteraMet: string
    ) => Promise<boolean>;
    obsidianLogDecision: (
        apiKey: string,
        projectName: string,
        summary: string,
        filesChanged: string
    ) => Promise<boolean>;

    // Window
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
