import { contextBridge, ipcRenderer } from 'electron';
import type { BackgroundAgentConfig, ChatMessage, FileEntry, VibeAPI } from '../shared/types';
import { IPC_CHANNELS, AGENT_CHANNELS, DEBATE_CHANNELS, DATA_CHANNELS } from '../shared/ipcContracts';
import type {
    AgentDelta, McpConfig, McpServerConfig, PermissionResolution, RunRequest, ScheduledTask, Surface,
    DebateStartRequest,
} from '../shared/agent';

const vibeApi: VibeAPI = {
    // PLATFORM (sync, read once) — renderer uses this to choose bash vs PowerShell.
    platform: process.platform,

    // FILESYSTEM
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
    listDirs: (dir?: string) => ipcRenderer.invoke('fs:listDirs', dir),
    makeDir: (parent: string, name: string) => ipcRenderer.invoke('fs:makeDir', parent, name),
    setProjectFolder: (dir: string) => ipcRenderer.invoke('fs:setProjectFolder', dir),

    // DATA HOME (shared, user-chosen, movable root for projects & engagements)
    dataHome: {
        get: (): Promise<{ path: string; chosen: boolean; default: string }> => ipcRenderer.invoke(DATA_CHANNELS.get),
        isFirstRun: (): Promise<boolean> => ipcRenderer.invoke(DATA_CHANNELS.isFirstRun),
        default: (): Promise<string> => ipcRenderer.invoke(DATA_CHANNELS.default),
        pick: (): Promise<string | null> => ipcRenderer.invoke(DATA_CHANNELS.pick),
        set: (path: string, move?: boolean): Promise<{ ok: boolean; path?: string; error?: string }> => ipcRenderer.invoke(DATA_CHANNELS.set, path, move),
    },
    readDir: (dirPath: string): Promise<FileEntry[]> => ipcRenderer.invoke('fs:readDir', dirPath),
    readFile: (filePath: string): Promise<string> => ipcRenderer.invoke('fs:readFile', filePath),
    writeFile: (filePath: string, content: string): Promise<boolean> => ipcRenderer.invoke('fs:writeFile', filePath, content),
    watchFolder: (dirPath: string) => ipcRenderer.invoke('fs:watchFolder', dirPath),
    onFolderChanged: (callback: () => void) => {
        ipcRenderer.removeAllListeners('fs:changed');
        ipcRenderer.on('fs:changed', () => callback());
    },
    readMemory: (projectPath: string): Promise<string | null> => ipcRenderer.invoke('fs:readMemory', projectPath),
    writeMemory: (projectPath: string, memory: object): Promise<boolean> => ipcRenderer.invoke('fs:writeMemory', projectPath, memory),

    // TERMINAL
    createTerminal: (cwd?: string): Promise<string> => ipcRenderer.invoke('terminal:create', cwd),
    sendTerminalInput: (id: string, data: string) => ipcRenderer.invoke('terminal:input', id, data),
    resizeTerminal: (id: string, cols: number, rows: number) => ipcRenderer.invoke('terminal:resize', id, cols, rows),
    onTerminalData: (callback: (id: string, data: string) => void) => {
        ipcRenderer.on('terminal:data', (_event, id, data) => callback(id, data));
    },
    killTerminal: (id: string) => ipcRenderer.invoke('terminal:kill', id),
    getTerminalOutput: (id: string): Promise<string> => ipcRenderer.invoke('terminal:getOutput', id),
    clearTerminalOutput: (id: string): Promise<void> => ipcRenderer.invoke('terminal:clearOutput', id),

    // OLLAMA
    detectOllama: () => ipcRenderer.invoke('ollama:detect'),
    statusOllama: () => ipcRenderer.invoke('ollama:status'),
    listModels: () => ipcRenderer.invoke('ollama:listModels'),
    chat: (model: string, messages: ChatMessage[], apiKeys?: Record<string, string>, thinkOptions?: any) => ipcRenderer.invoke('ollama:chat', model, messages, apiKeys, thinkOptions),
    onChatStream: (callback: (chunk: { content: string, done: boolean }) => void) => {
        ipcRenderer.removeAllListeners('ollama:stream');
        ipcRenderer.on('ollama:stream', (_event, chunk) => callback(chunk));
    },
    log: (msg: string) => ipcRenderer.invoke('log:renderer', msg),
    stopGeneration: () => ipcRenderer.invoke('ollama:stop'),
    getModelCapabilities: (modelName: string, opts?: { cloud?: boolean; ollamaKey?: string }) => ipcRenderer.invoke('ollama:getCapabilities', modelName, opts),
    getLoadedModels: () => ipcRenderer.invoke('ollama:getLoadedModels'),
    listOpenRouterModels: (apiKeys?: Record<string, string>) => ipcRenderer.invoke('openrouter:listModels', apiKeys),
    searchHuggingFaceModels: (query: string, apiKeys?: Record<string, string>) => ipcRenderer.invoke('hf:searchModels', query, apiKeys),
    listOmniModels: (apiKeys?: Record<string, string>) => ipcRenderer.invoke('omni:listModels', apiKeys),
    listOfoxModels: (apiKeys?: Record<string, string>) => ipcRenderer.invoke('ofox:listModels', apiKeys),

    // BACKGROUND AGENTS
    startBackgroundAgents: (projectPath: string, config?: BackgroundAgentConfig) =>
        ipcRenderer.invoke(IPC_CHANNELS.agent.startForProject, projectPath, config),
    getBriefing: () => ipcRenderer.invoke(IPC_CHANNELS.agent.getBriefing),
    logAgentAction: (description: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.logAction, description),
    generateNotebookExport: (outputPath: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.generateExport, outputPath),
    setObsidianKey: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.agent.setObsidianKey, key),
    triggerBriefing: () => ipcRenderer.invoke(IPC_CHANNELS.agent.triggerBriefing),
    getAgentStatus: () => ipcRenderer.invoke(IPC_CHANNELS.agent.getStatus),

    // OBSIDIAN INTEGRATION
    obsidianPing: (apiKey: string) => ipcRenderer.invoke('obsidian:ping', apiKey),
    obsidianUpsertNote: (apiKey: string, vaultPath: string, content: string) => ipcRenderer.invoke('obsidian:upsertNote', apiKey, vaultPath, content),
    obsidianAppendNote: (apiKey: string, vaultPath: string, content: string) => ipcRenderer.invoke('obsidian:appendNote', apiKey, vaultPath, content),
    obsidianUpdateProject: (apiKey: string, projectName: string, projectStructure: string, projectPath: string) =>
        ipcRenderer.invoke('obsidian:updateProjectNote', apiKey, projectName, projectStructure, projectPath),
    obsidianLogRun: (apiKey: string, projectName: string, mission: string, model: string, steps: string[], result: string, criteriaMet: string) =>
        ipcRenderer.invoke('obsidian:logAgentRun', apiKey, projectName, mission, model, steps, result, criteriaMet),
    obsidianLogDecision: (apiKey: string, projectName: string, summary: string, filesChanged: string) =>
        ipcRenderer.invoke('obsidian:logDecision', apiKey, projectName, summary, filesChanged),

    // AGENT KERNEL (native tool-calling)
    kernel: {
        run: (req: RunRequest) => ipcRenderer.invoke(AGENT_CHANNELS.run, req),
        cancel: (runId: string) => ipcRenderer.invoke(AGENT_CHANNELS.cancel, runId),
        approve: (runId: string, res: PermissionResolution) => ipcRenderer.invoke(AGENT_CHANNELS.approve, runId, res),
        answer: (reqId: string, answers: Record<string, string[]>) => ipcRenderer.invoke(AGENT_CHANNELS.answer, reqId, answers),
        listTools: (surface?: Surface) => ipcRenderer.invoke(AGENT_CHANNELS.listTools, surface),
        onDelta: (cb: (d: AgentDelta) => void) => {
            ipcRenderer.removeAllListeners(AGENT_CHANNELS.delta);
            ipcRenderer.on(AGENT_CHANNELS.delta, (_e, d) => cb(d));
        },
        onScheduledFired: (cb: (info: { taskId: string; sessionId: string }) => void) => {
            ipcRenderer.removeAllListeners(AGENT_CHANNELS.scheduledFired);
            ipcRenderer.on(AGENT_CHANNELS.scheduledFired, (_e, info) => cb(info));
        },
        createSession: (opts: { surface: Surface; title?: string; projectRoot: string | null; model: string }) =>
            ipcRenderer.invoke(AGENT_CHANNELS.createSession, opts),
        listSessions: (surface?: Surface) => ipcRenderer.invoke(AGENT_CHANNELS.listSessions, surface),
        listProjects: (surface?: Surface) => ipcRenderer.invoke(AGENT_CHANNELS.listProjects, surface),
        getMessages: (id: string) => ipcRenderer.invoke(AGENT_CHANNELS.getMessages, id),
        getSession: (id: string) => ipcRenderer.invoke(AGENT_CHANNELS.getSession, id),
        renameSession: (id: string, title: string) => ipcRenderer.invoke(AGENT_CHANNELS.renameSession, id, title),
        deleteSession: (id: string) => ipcRenderer.invoke(AGENT_CHANNELS.deleteSession, id),
        sessionRewind: (id: string) => ipcRenderer.invoke(AGENT_CHANNELS.sessionRewind, id),
        mcpGetConfig: () => ipcRenderer.invoke(AGENT_CHANNELS.mcpGetConfig),
        mcpSaveConfig: (config: McpConfig) => ipcRenderer.invoke(AGENT_CHANNELS.mcpSaveConfig, config),
        mcpReload: () => ipcRenderer.invoke(AGENT_CHANNELS.mcpReload),
        skillsList: () => ipcRenderer.invoke(AGENT_CHANNELS.skillsList),
        scheduleList: () => ipcRenderer.invoke(AGENT_CHANNELS.scheduleList),
        scheduleAdd: (t: Partial<ScheduledTask>) => ipcRenderer.invoke(AGENT_CHANNELS.scheduleAdd, t),
        scheduleUpdate: (id: string, patch: Partial<ScheduledTask>) => ipcRenderer.invoke(AGENT_CHANNELS.scheduleUpdate, id, patch),
        scheduleRemove: (id: string) => ipcRenderer.invoke(AGENT_CHANNELS.scheduleRemove, id),
        cloudModels: (ollamaKey?: string) => ipcRenderer.invoke(AGENT_CHANNELS.cloudModels, ollamaKey),
        mcpSearch: (query?: string) => ipcRenderer.invoke(AGENT_CHANNELS.mcpSearch, query),
        mcpAdd: (key: string, config: McpServerConfig) => ipcRenderer.invoke(AGENT_CHANNELS.mcpAdd, key, config),
        mcpRemove: (key: string) => ipcRenderer.invoke(AGENT_CHANNELS.mcpRemove, key),
        skillsCatalog: () => ipcRenderer.invoke(AGENT_CHANNELS.skillsCatalog),
        skillsInstall: (name: string) => ipcRenderer.invoke(AGENT_CHANNELS.skillsInstall, name),
        skillsRemove: (name: string) => ipcRenderer.invoke(AGENT_CHANNELS.skillsRemove, name),
    },

    // WINDOW CONTROLS
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onWindowMaximized: (callback: (maximized: boolean) => void) => {
        ipcRenderer.removeAllListeners(IPC_CHANNELS.window.maximizeEvent);
        ipcRenderer.on(IPC_CHANNELS.window.maximizeEvent, (_event, maximized) => callback(!!maximized));
    },

    // DUAL-MODEL DEBATE
    debate: {
        start: (req: DebateStartRequest) =>
            ipcRenderer.invoke(DEBATE_CHANNELS.start, req),
        cancel: (runId: string) => ipcRenderer.invoke(DEBATE_CHANNELS.cancel, runId),
        interject: (runId: string, message: string) => ipcRenderer.invoke(DEBATE_CHANNELS.interject, runId, message),
        onDelta: (cb: (d: { runId: string; type: string; round?: number; content?: string; message?: string }) => void) => {
            ipcRenderer.removeAllListeners(DEBATE_CHANNELS.delta);
            ipcRenderer.on(DEBATE_CHANNELS.delta, (_e, d) => cb(d));
        },
        listModels: (apiKeys?: Record<string, string>) => ipcRenderer.invoke(DEBATE_CHANNELS.listModels, apiKeys),
    },
};

contextBridge.exposeInMainWorld('vibe', vibeApi);
