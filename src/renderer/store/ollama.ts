import { create } from 'zustand';
import type { ChatMessage, ModelCapability } from '../../shared/types';
import { getCapabilities } from '../utils/capabilities';

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
    thinkingContent: string;
    isThinking: boolean;
    thinkingStartTime: number | null;
    thinkingElapsed: number | null;
    streamBuffer: string;
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
    appendStreamChunk: (chunk: string) => void;
    finalizeStream: () => void;
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
    thinkingContent: '',
    isThinking: false,
    thinkingStartTime: null,
    thinkingElapsed: null,
    streamBuffer: '',
    thinkEnabled: false,
    thinkLevel: 'medium',

    setConnectionState: (connected: boolean, version: string | null) => set({ connected, version }),
    setModels: (models: string[]) => set((state) => {
        const capsMap: Record<string, ModelCapability> = {};
        models.forEach(m => {
            capsMap[m] = getCapabilities(m);
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
        const newMessages = [...state.messages];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1].content += content;
        }
        return { messages: newMessages };
    }),
    setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),
    setAgentStatus: (agentStatus: string) => set({ agentStatus }),
    setAgentStep: (agentStep: number, agentMaxSteps: number) => set({ agentStep, agentMaxSteps }),
    clearMessages: () => set({ messages: [] }),

    appendStreamChunk: (chunk: string) => set((state) => {
        const newBuffer = state.streamBuffer + chunk;
        
        let thinkingContent = state.thinkingContent;
        let isThinking = state.isThinking;
        let thinkingStartTime = state.thinkingStartTime;
        let cleanBuffer = newBuffer;
        
        if (!isThinking && cleanBuffer.includes('<think>')) {
            isThinking = true;
            thinkingStartTime = Date.now();
        }
        
        const thinkRegex = /<think>([\s\S]*?)<\/think>/g;
        let match;
        while ((match = thinkRegex.exec(cleanBuffer)) !== null) {
            thinkingContent += match[1];
            isThinking = false;
        }
        cleanBuffer = cleanBuffer.replace(/<think>[\s\S]*?<\/think>/g, '');
        
        const openThinkMatch = cleanBuffer.match(/<think>([\s\S]*)$/);
        let mainContent = cleanBuffer;
        if (openThinkMatch) {
            thinkingContent = openThinkMatch[1];
            mainContent = cleanBuffer.replace(/<think>[\s\S]*$/, '');
        }
        
        const newMessages = [...state.messages];
        if (mainContent && newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content: newMessages[newMessages.length - 1].content + mainContent
            };
        }
        
        return {
            messages: newMessages,
            thinkingContent,
            isThinking,
            thinkingStartTime,
            streamBuffer: isThinking ? newBuffer : '',
        };
    }),

    finalizeStream: () => set((state) => {
        const elapsed = state.thinkingStartTime
            ? Math.floor((Date.now() - state.thinkingStartTime) / 1000)
            : null;
        return {
            streamBuffer: '',
            isThinking: false,
            thinkingElapsed: elapsed,
        };
    }),

    resetThinking: () => set({ 
        thinkingContent: '', 
        thinkingElapsed: null, 
        isThinking: false, 
        streamBuffer: '',
        thinkingStartTime: null 
    }),

    setThinkEnabled: (thinkEnabled) => set({ thinkEnabled }),
    setThinkLevel: (thinkLevel) => set({ thinkLevel }),
}));
