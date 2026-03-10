import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProjectMemory {
    lastSession: string;
    keyFiles: string[];
    architecturalDecisions: string[];
    currentPhase: string;
    updatedAt: string;
}

interface UIState {
    sidebarWidth: number;
    terminalHeight: number;
    showModelPicker: boolean;
    projectPath: string | null;
    ollamaConnected: boolean;
    vibeInstructions: string | null;
    projectMemory: ProjectMemory | null;
    setSidebarWidth: (width: number) => void;
    setTerminalHeight: (height: number) => void;
    setShowModelPicker: (show: boolean) => void;
    setProjectPath: (path: string | null) => void;
    setVibeInstructions: (instructions: string | null) => void;
    setOllamaConnected: (connected: boolean) => void;
    setProjectMemory: (memory: ProjectMemory | null) => void;
    isLoggedIn: boolean;
    setIsLoggedIn: (v: boolean) => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            sidebarWidth: 210,
            terminalHeight: 140,
            showModelPicker: false,
            projectPath: null,
            vibeInstructions: null,
            projectMemory: null,
            ollamaConnected: false,
            setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
            setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
            setShowModelPicker: (showModelPicker) => set({ showModelPicker }),
            setProjectPath: (projectPath) => set({ projectPath }),
            setVibeInstructions: (vibeInstructions) => set({ vibeInstructions }),
            setOllamaConnected: (ollamaConnected) => set({ ollamaConnected }),
            setProjectMemory: (projectMemory) => set({ projectMemory }),
            isLoggedIn: false,
            setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn })
        }),
        { 
            name: 'vibe-ui-storage', 
            partialize: (state) => {
                const { vibeInstructions, projectMemory, ...rest } = state;
                return rest;
            }
        }
    )
);
