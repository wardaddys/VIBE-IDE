import { waitForStreamDone } from './stream';
import { describe, expect, it } from 'vitest';

describe('stream cancellation', () => {
    it('resolves on done chunk', async () => {
        const listeners: Array<(chunk: { content: string; done: boolean }) => void> = [];
        const subscribe = (handler: (chunk: { content: string; done: boolean }) => void) => {
            listeners.push(handler);
            return () => {
                const i = listeners.indexOf(handler);
                if (i >= 0) listeners.splice(i, 1);
            };
        };

        const p = waitForStreamDone({ subscribe, shouldStop: () => false, timeoutMs: 5000 });
        listeners[0]({ content: 'hello ', done: false });
        listeners[0]({ content: 'world', done: false });
        listeners[0]({ content: '', done: true });

        await expect(p).resolves.toBe('hello world');
    });

    it('resolves early when stop is requested', async () => {
        let stop = false;
        const listeners: Array<(chunk: { content: string; done: boolean }) => void> = [];
        const subscribe = (handler: (chunk: { content: string; done: boolean }) => void) => {
            listeners.push(handler);
            return () => {};
        };

        const p = waitForStreamDone({ subscribe, shouldStop: () => stop, timeoutMs: 5000, pollIntervalMs: 10 });
        listeners[0]({ content: 'partial', done: false });
        stop = true;

        await expect(p).resolves.toBe('partial');
    });
});
