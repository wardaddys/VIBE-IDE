import { create } from 'zustand';
import type { ChatMessage, ModelCapability } from '../../shared/types';
import { getFallbackCapabilities, fetchCapabilities } from '../utils/capabilities';

interface OllamaState {
    connected: boolean;
    version: string | null;
    models: string[];
    /** key = model name → capability flags */
    modelCapabilities: Record<string, ModelCapability>;
    selectedModel: string;
    messages: ChatMessage[];
    isGenerating: boolean;
    agentStep: number;
    agentMaxSteps: number;
    agentStatus: string;
    
    // Thinking / Reasoning state
    isThinking: boolean;
    thinkingContent: string;
    thinkingStartTime: number | null;
    thinkingElapsed: number | null;
    thinkEnabled: boolean;
    thinkLevel: 'low' | 'medium' | 'high';

    setConnectionState: (connected: boolean, version: string | null) => void;
    setModels: (models: string[]) => void;
    /** Update capability flags for a single model (used when a user selects a custom model) */
    setModelCapability: (modelId: string, caps: ModelCapability) => void;
    setSelectedModel: (modelName: string) => void;
    addMessage: (msg: ChatMessage) => void;
    updateLastMessage: (content: string) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    setAgentStatus: (status: string) => void;
    setAgentStep: (step: number, max: number) => void;
    clearMessages: () => void;

    // Thinking methods
    startThinking: () => void;
    appendThinkContent: (content: string) => void;
    finalizeThinking: () => void;
    resetThinking: () => void;
    setThinkEnabled: (enabled: boolean) => void;
    setThinkLevel: (level: 'low' | 'medium' | 'high') => void;
}

export const useOllamaStore = create<OllamaState>((set) => ({
    connected: false,
    version: null,
    models: [],
    modelCapabilities: {},
    selectedModel: '',
    messages: [],
    isGenerating: false,
    agentStep: 0,
    agentMaxSteps: 0,
    agentStatus: '',
    
    // Initial thinking state
    isThinking: false,
    thinkingContent: '',
    thinkingStartTime: null,
    thinkingElapsed: null,
    thinkEnabled: false,
    thinkLevel: 'medium',

    setConnectionState: (connected: boolean, version: string | null) => set({ connected, version }),
    setModels: (models: string[]) => set((state) => {
        // Start with fallback capabilities synchronously
        const capsMap: Record<string, ModelCapability> = {};
        models.forEach(m => {
            capsMap[m] = getFallbackCapabilities(m);
        });

        // Async fetch real capabilities and update store
        models.forEach(async (modelName) => {
            try {
                const real = await fetchCapabilities(modelName);
                useOllamaStore.getState().setModelCapability(modelName, real);
            } catch { /* keep fallback */ }
        });

        return {
            models,
            modelCapabilities: { ...state.modelCapabilities, ...capsMap },
            connected: models.length > 0 ? true : state.connected,
            selectedModel: state.selectedModel || (models.length > 0 ? models[0] : '')
        };
    }),
    setModelCapability: (modelId: string, caps: ModelCapability) => set(state => ({
        modelCapabilities: { ...state.modelCapabilities, [modelId]: caps }
    })),
    setSelectedModel: (selectedModel: string) => set({ selectedModel }),
    addMessage: (msg: ChatMessage) => set((state) => ({ messages: [...state.messages, msg] })),
    updateLastMessage: (content: string) => set((state) => {
        if (!content) return state;
        const newMessages = [...state.messages];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content: newMessages[newMessages.length - 1].content + content
            };
        }
        return { messages: newMessages };
    }),
    setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),
    setAgentStatus: (agentStatus: string) => set({ agentStatus }),
    setAgentStep: (agentStep: number, agentMaxSteps: number) => set({ agentStep, agentMaxSteps }),
    clearMessages: () => set({ messages: [], thinkingContent: '', isThinking: false, thinkingElapsed: null }),

    startThinking: () => set({ isThinking: true, thinkingContent: '', thinkingStartTime: Date.now(), thinkingElapsed: null }),
    appendThinkContent: (content) => set((state) => ({ thinkingContent: state.thinkingContent + content })),
    finalizeThinking: () => set((state) => ({
        isThinking: false,
        thinkingElapsed: state.thinkingStartTime ? Math.round((Date.now() - state.thinkingStartTime) / 1000) : null,
    })),
    resetThinking: () => set({ thinkingContent: '', isThinking: false, thinkingStartTime: null, thinkingElapsed: null }),

    setThinkEnabled: (thinkEnabled) => set({ thinkEnabled }),
    setThinkLevel: (thinkLevel) => set({ thinkLevel }),
}));

