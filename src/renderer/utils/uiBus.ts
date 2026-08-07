type UiEvent =
    | { t: 'openSettings'; section?: string }
    | { t: 'openSchedule' }
    | { t: 'openProjects' }
    | { t: 'openPalette' }
    | { t: 'openModel' }
    | { t: 'toggleWorkspace' }
    | { t: 'newChat' };

type Handler = (e: UiEvent) => void;
const handlers = new Set<Handler>();

export const uiBus = {
    emit: (e: UiEvent) => { for (const h of handlers) h(e); },
    on: (h: Handler) => { handlers.add(h); return () => { handlers.delete(h); }; },
};
export type { UiEvent };
