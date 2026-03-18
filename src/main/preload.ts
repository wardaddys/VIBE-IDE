import { contextBridge, ipcRenderer } from 'electron';
import type { BackgroundAgentConfig, ChatMessage, FileEntry, VibeAPI } from '../shared/types';
import { IPC_CHANNELS } from '../shared/ipcContracts';

const vibeApi: VibeAPI = {
    // FILESYSTEM
    openFolder: () => ipcRenderer.invoke('fs:openFolder'),
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
    getModelCapabilities: (modelName: string) => ipcRenderer.invoke('ollama:getCapabilities', modelName),
    getLoadedModels: () => ipcRenderer.invoke('ollama:getLoadedModels'),
    listOpenRouterModels: (apiKeys?: Record<string, string>) => ipcRenderer.invoke('openrouter:listModels', apiKeys),
    searchHuggingFaceModels: (query: string, apiKeys?: Record<string, string>) => ipcRenderer.invoke('hf:searchModels', query, apiKeys),

    // BACKGROUND AGENTS
    startBackgroundAgents: (projectPath: string, config?: BackgroundAgentConfig) =>
        ipcRenderer.invoke(IPC_CHANNELS.agent.startForProject, projectPath, config),
    getBriefing: () =>
        ipcRenderer.invoke(IPC_CHANNELS.agent.getBriefing),
    logAgentAction: (description: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.agent.logAction, description),
    generateNotebookExport: (outputPath: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.agent.generateExport, outputPath),
    setObsidianKey: (key: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.agent.setObsidianKey, key),
    triggerBriefing: () =>
        ipcRenderer.invoke(IPC_CHANNELS.agent.triggerBriefing),
    getAgentStatus: () =>
        ipcRenderer.invoke(IPC_CHANNELS.agent.getStatus),

    // OBSIDIAN INTEGRATION
    obsidianPing: (apiKey: string) =>
        ipcRenderer.invoke('obsidian:ping', apiKey),
    obsidianUpsertNote: (apiKey: string, vaultPath: string, content: string) =>
        ipcRenderer.invoke('obsidian:upsertNote', apiKey, vaultPath, content),
    obsidianAppendNote: (apiKey: string, vaultPath: string, content: string) =>
        ipcRenderer.invoke('obsidian:appendNote', apiKey, vaultPath, content),
    obsidianUpdateProject: (
        apiKey: string,
        projectName: string,
        projectStructure: string,
        projectPath: string
    ) => ipcRenderer.invoke(
        'obsidian:updateProjectNote',
        apiKey, projectName, projectStructure, projectPath
    ),
    obsidianLogRun: (
        apiKey: string,
        projectName: string,
        mission: string,
        model: string,
        steps: string[],
        result: string,
        criteraMet: string
    ) => ipcRenderer.invoke(
        'obsidian:logAgentRun',
        apiKey, projectName, mission, model, steps, result, criteraMet
    ),
    obsidianLogDecision: (
        apiKey: string,
        projectName: string,
        summary: string,
        filesChanged: string
    ) => ipcRenderer.invoke(
        'obsidian:logDecision',
        apiKey, projectName, summary, filesChanged
    ),

    // WINDOW CONTROLS
    minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
    maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
    closeWindow: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onWindowMaximized: (callback: (maximized: boolean) => void) => {
        ipcRenderer.removeAllListeners(IPC_CHANNELS.window.maximizeEvent);
        ipcRenderer.on(IPC_CHANNELS.window.maximizeEvent, (_event, maximized) => callback(!!maximized));
    },
};

contextBridge.exposeInMainWorld('vibe', vibeApi);
