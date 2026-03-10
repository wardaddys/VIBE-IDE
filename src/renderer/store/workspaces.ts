import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage } from '../../shared/types';

export interface ChatThread { id: string; title: string; messages: ChatMessage[]; updatedAt: number; }
export interface Workspace { path: string; name: string; threads: ChatThread[]; }

interface WorkspaceState {
    workspaces: Workspace[];
    activeWorkspacePath: string | null;
    activeThreadId: string | null;
    addWorkspace: (path: string) => void;
    setActiveWorkspace: (path: string | null) => void;
    createThread: (workspacePath: string, title?: string) => string;
    setActiveThread: (threadId: string | null) => void;
    saveMessagesToThread: (workspacePath: string, threadId: string, messages: ChatMessage[]) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set) => ({
            workspaces: [],
            activeWorkspacePath: null,
            activeThreadId: null,
            addWorkspace: (path) => set((state) => {
                if (state.workspaces.find(w => w.path === path)) return state;
                const name = path.split(/[/\\]/).pop() || path;
                return { workspaces: [{ path, name, threads: [] }, ...state.workspaces] };
            }),
            setActiveWorkspace: (path) => set({ activeWorkspacePath: path }),
            createThread: (workspacePath, title = 'New conversation') => {
                const id = Math.random().toString(36).substring(7);
                set((state) => ({
                    workspaces: state.workspaces.map(w => w.path === workspacePath 
                        ? { ...w, threads: [{ id, title, messages: [], updatedAt: Date.now() }, ...w.threads] } 
                        : w
                    ),
                    activeThreadId: id
                }));
                return id;
            },
            setActiveThread: (id) => set({ activeThreadId: id }),
            saveMessagesToThread: (path, id, messages) => set((state) => ({
                workspaces: state.workspaces.map(w => w.path === path 
                    ? { ...w, threads: w.threads.map(t => t.id === id ? { ...t, messages, updatedAt: Date.now() } : t) }
                    : w
                )
            }))
        }),
        { name: 'vibe-workspaces' }
    )
);
