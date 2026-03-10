import { useCallback } from 'react';
import type { OllamaModel, ChatMessage } from '../../shared/types';

export function useOllama() {
    const detectOllama = useCallback(async (): Promise<{ detected: boolean; version?: string }> => {
        return window.vibe.detectOllama();
    }, []);

    const listModels = useCallback(async (): Promise<OllamaModel[]> => {
        return window.vibe.listModels();
    }, []);

    const chat = useCallback(async (model: string, messages: ChatMessage[]) => {
        return window.vibe.chat(model, messages);
    }, []);

    const onStream = useCallback((callback: (chunk: { content: string; done: boolean }) => void) => {
        window.vibe.onChatStream(callback);
    }, []);

    const stopGeneration = useCallback(() => {
        window.vibe.stopGeneration();
    }, []);

    return { detectOllama, listModels, chat, onStream, stopGeneration };
}
