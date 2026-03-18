import type { ChatMessage } from '../../../shared/types';
import { useOllamaStore } from '../../store/ollama';

export interface RunDirectChatDeps {
    selectedModel: string;
    apiKeys: Record<string, string>;
    vibeInstructions: string | null;
    baseMessages: ChatMessage[];
    getBriefingContext: () => Promise<string>;
    getThinkOptions: () => { enabled: boolean; level: 'low' | 'medium' | 'high' } | null;
    waitForStreamDone: (timeoutMs?: number) => Promise<string>;
    shouldStop: () => boolean;
}

export function buildDirectSystemPrompt(vibeInstructions: string | null, briefingContext: string): string {
    return `You are VIBE Chat Assistant running inside the VIBE IDE desktop app.\n` +
        `Never claim you are outside the IDE or that you cannot access the project by default.\n` +
        `If project context is missing, ask the user to open/select a folder in VIBE and continue.\n` +
        `Respond naturally and helpfully.\n` +
        `Do not enter planning/tool XML mode unless the user explicitly asks to execute coding tasks.\n` +
        `${vibeInstructions ? `PROJECT RULES:\n${vibeInstructions}\n` : ''}` +
        `${briefingContext || ''}`;
}

export async function runDirectChat(deps: RunDirectChatDeps): Promise<void> {
    const {
        selectedModel,
        apiKeys,
        vibeInstructions,
        baseMessages,
        getBriefingContext,
        getThinkOptions,
        waitForStreamDone,
        shouldStop,
    } = deps;

    if (shouldStop()) return;

    useOllamaStore.getState().setIsGenerating(true);
    useOllamaStore.getState().setAgentStep(0, 0);
    useOllamaStore.getState().setAgentStatus('');

    const briefingContext = await getBriefingContext();
    if (shouldStop()) return;

    const directMessages: ChatMessage[] = [
        {
            role: 'system',
            content: buildDirectSystemPrompt(vibeInstructions, briefingContext),
        },
        ...baseMessages,
    ];

    useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

    try {
        if (shouldStop()) return;
        await window.vibe.chat(selectedModel, directMessages, apiKeys, getThinkOptions());
        await waitForStreamDone();
    } catch (e) {
        window.vibe.log(`[CHAT] Direct mode failed: ${e}`);
    } finally {
        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    }
}
