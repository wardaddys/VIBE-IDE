type StreamChunk = { content: string; done: boolean };
type StreamHandler = (chunk: StreamChunk) => void;

class StreamBus {
    private handlers = new Set<StreamHandler>();

    subscribe(fn: StreamHandler): () => void {
        this.handlers.add(fn);
        return () => this.handlers.delete(fn);
    }

    emit(chunk: StreamChunk) {
        this.handlers.forEach(fn => fn(chunk));
    }
}

export const streamBus = new StreamBus();
