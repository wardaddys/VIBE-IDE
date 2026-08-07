import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    apiKeys: {
        gemini: string;
        claude: string;
        openai: string;
        deepseek: string;
        groq: string;
        openrouter: string;
        hf: string;
        obsidian: string;
        ollama: string;
    };
    backgroundModels: {
        collector: string;
        reviewer: string;
    };
    /** 'ask' = prompt for risky tools; 'auto' = approve everything for this machine. */
    permissionMode: 'ask' | 'auto';
    /** 'build' = execute end-to-end, no "shall I proceed?"; 'plan' = read-only, propose first. */
    agentMode: 'build' | 'plan';
    /** Preferred vision model for describing images when the main model can't see.
        Empty = auto-pick a vision-capable model from what's available. */
    visionModel: string;
    setApiKey: (provider: string, key: string) => void;
    setBackgroundModel: (role: 'collector' | 'reviewer', model: string) => void;
    setPermissionMode: (mode: 'ask' | 'auto') => void;
    setAgentMode: (mode: 'build' | 'plan') => void;
    setVisionModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKeys: {
                gemini: '',
                claude: '',
                openai: '',
                deepseek: '',
                groq: '',
                openrouter: '',
                hf: '',
                obsidian: '',
                ollama: ''
            },
            backgroundModels: {
                collector: '',
                reviewer: ''
            },
            permissionMode: 'ask',
            setPermissionMode: (permissionMode) => set({ permissionMode }),
            agentMode: 'build',
            setAgentMode: (agentMode) => set({ agentMode }),
            visionModel: '',
            setVisionModel: (visionModel) => set({ visionModel }),
            setApiKey: (provider, key) =>
                set((state) => ({
                    apiKeys: {
                        ...state.apiKeys,
                        [provider]: key
                    }
                })),
            setBackgroundModel: (role, model) =>
                set((state) => ({
                    backgroundModels: {
                        ...state.backgroundModels,
                        [role]: model
                    }
                }))
        }),
        { name: 'vibe-settings-storage' }
    )
);