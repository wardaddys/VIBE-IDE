type StreamChunk = { content: string; done: boolean };

type SubscribeFn = (handler: (chunk: StreamChunk) => void) => () => void;

interface WaitForStreamDoneOptions {
    subscribe: SubscribeFn;
    shouldStop: () => boolean;
    timeoutMs?: number;
    pollIntervalMs?: number;
    onTimeout?: () => void;
    onResolved?: () => void;
}

export function waitForStreamDone(options: WaitForStreamDoneOptions): Promise<string> {
    const {
        subscribe,
        shouldStop,
        timeoutMs = 120000,
        pollIntervalMs = 100,
        onTimeout,
        onResolved,
    } = options;

    return new Promise((resolve) => {
        let fullContent = '';
        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            clearInterval(cancelPoll);
            unsub();
            onResolved?.();
            resolve(fullContent);
        };

        const cancelPoll = setInterval(() => {
            if (!finished && shouldStop()) {
                finish();
            }
        }, pollIntervalMs);

        const timeout = setTimeout(() => {
            if (finished) return;
            onTimeout?.();
            finish();
        }, timeoutMs);

        const unsub = subscribe((chunk) => {
            if (chunk.content) fullContent += chunk.content;
            if (chunk.done) {
                finish();
            }
        });
    });
}
