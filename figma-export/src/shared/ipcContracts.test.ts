import { IPC_CHANNEL_VALUES, IPC_CHANNELS } from './ipcContracts';
import { describe, expect, it } from 'vitest';

describe('ipc contracts', () => {
    it('has unique channel values', () => {
        const unique = new Set(IPC_CHANNEL_VALUES);
        expect(unique.size).toBe(IPC_CHANNEL_VALUES.length);
    });

    it('contains required agent channels', () => {
        expect(IPC_CHANNELS.agent.startForProject).toBe('agent:startForProject');
        expect(IPC_CHANNELS.agent.getBriefing).toBe('agent:getBriefing');
        expect(IPC_CHANNELS.agent.logAction).toBe('agent:logAction');
        expect(IPC_CHANNELS.agent.getStatus).toBe('agent:getStatus');
    });

    it('contains required window event channels', () => {
        expect(IPC_CHANNELS.window.maximizeEvent).toBe('window:maximized');
    });
});
