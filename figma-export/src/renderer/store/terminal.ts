import { create } from 'zustand';
import type { TerminalSession } from '../../shared/types';

interface TerminalState {
    sessions: TerminalSession[];
    activeTerminalId: string | null;
    addSession: (session: TerminalSession) => void;
    removeSession: (id: string) => void;
    setActiveSession: (id: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
    sessions: [],
    activeTerminalId: null,
    addSession: (session) => set((state) => ({
        sessions: [...state.sessions, session],
        activeTerminalId: session.id
    })),
    removeSession: (id) => set((state) => {
        const newSessions = state.sessions.filter(s => s.id !== id);
        let newActive = state.activeTerminalId;
        if (newActive === id) {
            newActive = newSessions.length > 0 ? newSessions[newSessions.length - 1].id : null;
        }
        return { sessions: newSessions, activeTerminalId: newActive };
    }),
    setActiveSession: (id) => set({ activeTerminalId: id })
}));
