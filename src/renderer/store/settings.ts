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
    };
    backgroundModels: {
        collector: string;
        reviewer: string;
    };
    setApiKey: (provider: string, key: string) => void;
    setBackgroundModel: (role: 'collector' | 'reviewer', model: string) => void;
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
                obsidian: ''
            },
            backgroundModels: {
                collector: '',
                reviewer: ''
            },
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