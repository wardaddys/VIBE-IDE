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

export const IPC_CHANNEL_VALUES = [
    ...Object.values(IPC_CHANNELS.agent),
    ...Object.values(IPC_CHANNELS.window),
];
