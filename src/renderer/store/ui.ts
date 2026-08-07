import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProjectMemory {
    lastSession: string;
    keyFiles: string[];
    architecturalDecisions: string[];
    currentPhase: string;
    updatedAt: string;
}

export type ChatMode = 'auto' | 'chat' | 'agent';
/** chat = conversation front and center; ide = editor+terminal center, chat docked right. */
export type LayoutMode = 'chat' | 'ide';

interface UIState {
    sidebarWidth: number;
    terminalHeight: number;
    showModelPicker: boolean;
    projectPath: string | null;
    ollamaConnected: boolean;
    vibeInstructions: string | null;
    projectMemory: ProjectMemory | null;
    chatMode: ChatMode;
    layoutMode: LayoutMode;
    setLayoutMode: (mode: LayoutMode) => void;
    setSidebarWidth: (width: number) => void;
    setTerminalHeight: (height: number) => void;
    setShowModelPicker: (show: boolean) => void;
    setProjectPath: (path: string | null) => void;
    setVibeInstructions: (instructions: string | null) => void;
    setOllamaConnected: (connected: boolean) => void;
    setProjectMemory: (memory: ProjectMemory | null) => void;
    setChatMode: (mode: ChatMode) => void;
    isLoggedIn: boolean;
    setIsLoggedIn: (v: boolean) => void;
    /** Workspace (editor+terminal) panel visibility in chat layout. Lives in the
        store so the agent delta handler can auto-open it on file touches. */
    workspaceOpen: boolean;
    setWorkspaceOpen: (open: boolean) => void;
    toggleWorkspaceOpen: () => void;
    /** Dual-model debate mode — replaces chat surface with DebatePanel. */
    debateMode: boolean;
    setDebateMode: (v: boolean) => void;
    toggleDebateMode: () => void;
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
            chatMode: 'auto',
            layoutMode: 'chat',
            setLayoutMode: (layoutMode) => set({ layoutMode }),
            ollamaConnected: false,
            setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
            setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
            setShowModelPicker: (showModelPicker) => set({ showModelPicker }),
            setProjectPath: (projectPath) => set({ projectPath }),
            setVibeInstructions: (vibeInstructions) => set({ vibeInstructions }),
            setOllamaConnected: (ollamaConnected) => set({ ollamaConnected }),
            setProjectMemory: (projectMemory) => set({ projectMemory }),
            setChatMode: (chatMode) => set({ chatMode }),
            isLoggedIn: false,
            setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
            workspaceOpen: false,
            setWorkspaceOpen: (workspaceOpen) => set({ workspaceOpen }),
            toggleWorkspaceOpen: () => set((s) => ({ workspaceOpen: !s.workspaceOpen })),
            debateMode: false,
            setDebateMode: (debateMode) => set({ debateMode }),
            toggleDebateMode: () => set((s) => ({ debateMode: !s.debateMode })),
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
