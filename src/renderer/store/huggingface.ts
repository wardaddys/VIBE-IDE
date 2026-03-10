import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HFModel {
    id: string;
    name: string;
}

interface HFState {
    pinnedModels: HFModel[];
    hfApiKey: string;
    pinModel: (model: HFModel) => void;
    unpinModel: (id: string) => void;
    setHFApiKey: (key: string) => void;
}

export const useHFStore = create<HFState>()(
    persist(
        (set) => ({
            pinnedModels: [],
            hfApiKey: '',
            pinModel: (model) => set(state => ({
                pinnedModels: state.pinnedModels.find(m => m.id === model.id)
                    ? state.pinnedModels
                    : [...state.pinnedModels, model]
            })),
            unpinModel: (id) => set(state => ({
                pinnedModels: state.pinnedModels.filter(m => m.id !== id)
            })),
            setHFApiKey: (hfApiKey) => set({ hfApiKey }),
        }),
        { name: 'vibe-hf-storage' }
    )
);
