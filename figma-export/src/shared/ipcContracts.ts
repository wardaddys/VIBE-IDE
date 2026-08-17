export const IPC_CHANNELS = {
    agent: {
        startForProject: 'agent:startForProject',
        getBriefing: 'agent:getBriefing',
        logAction: 'agent:logAction',
        generateExport: 'agent:generateExport',
        setObsidianKey: 'agent:setObsidianKey',
        triggerBriefing: 'agent:triggerBriefing',
        getStatus: 'agent:getStatus',
    },
    window: {
        maximizeEvent: 'window:maximized',
    },
} as const;

// Shared data home for VIBE projects. First-run prompt + move.
export const DATA_CHANNELS = {
    get: 'data:getHome',
    set: 'data:setHome',
    pick: 'data:pickHome',
    isFirstRun: 'data:isFirstRun',
    default: 'data:defaultHome',
} as const;

// Kernel (native tool-calling agent) IPC surface
export const AGENT_CHANNELS = {
    run: 'kernel:run',
    cancel: 'kernel:cancel',
    approve: 'kernel:approve',
    answer: 'kernel:answer',
    listTools: 'kernel:listTools',
    delta: 'kernel:delta',
    createSession: 'kernel:createSession',
    listSessions: 'kernel:listSessions',
    listProjects: 'kernel:listProjects',
    getMessages: 'kernel:getMessages',
    getSession: 'kernel:getSession',
    renameSession: 'kernel:renameSession',
    deleteSession: 'kernel:deleteSession',
    sessionRewind: 'kernel:sessionRewind',
    mcpGetConfig: 'kernel:mcpGetConfig',
    mcpSaveConfig: 'kernel:mcpSaveConfig',
    mcpReload: 'kernel:mcpReload',
    skillsList: 'kernel:skillsList',
    scheduleList: 'kernel:scheduleList',
    scheduleAdd: 'kernel:scheduleAdd',
    scheduleUpdate: 'kernel:scheduleUpdate',
    scheduleRemove: 'kernel:scheduleRemove',
    scheduledFired: 'kernel:scheduledFired',
    // Live catalogs (pulled from the web)
    cloudModels: 'kernel:cloudModels',
    mcpSearch: 'kernel:mcpSearch',
    mcpAdd: 'kernel:mcpAdd',
    mcpRemove: 'kernel:mcpRemove',
    skillsCatalog: 'kernel:skillsCatalog',
    skillsInstall: 'kernel:skillsInstall',
    skillsRemove: 'kernel:skillsRemove',
} as const;

// Dual-model debate — two models argue in real-time, user can interject.
export const DEBATE_CHANNELS = {
    start: 'debate:start',
    cancel: 'debate:cancel',
    interject: 'debate:interject',
    delta: 'debate:delta',
    listModels: 'debate:listModels',
} as const;

export const IPC_CHANNEL_VALUES = [
    ...Object.values(IPC_CHANNELS.agent),
    ...Object.values(IPC_CHANNELS.window),
    ...Object.values(AGENT_CHANNELS),
    ...Object.values(DEBATE_CHANNELS),
];
