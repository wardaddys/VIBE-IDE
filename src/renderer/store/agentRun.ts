import { create } from 'zustand';
import type {
    AgentDelta, PermissionRequest, Surface, SessionRecord, UserQuestionRequest,
} from '../../shared/agent';
import { useUsageStore } from './usage';

export interface ToolItemData {
    kind: 'tool';
    id: string;
    name: string;
    render: string;
    status: 'running' | 'ok' | 'error';
    resultContent?: string;
    data?: any;
}
export type RunItem =
    | { kind: 'user'; id: string; text: string; images?: { mimeType: string; dataBase64: string }[] }
    | { kind: 'assistant'; id: string; text: string; model?: string }
    | { kind: 'thinking'; id: string; text: string }
    | ToolItemData
    | { kind: 'permission'; id: string; req: PermissionRequest; resolved?: 'allow' | 'deny' }
    | { kind: 'question'; id: string; req: UserQuestionRequest; answers?: Record<string, string[]>; dismissed?: boolean }
    | { kind: 'status'; id: string; text: string }
    | { kind: 'error'; id: string; text: string };

/** Everything one conversation needs to keep streaming while off-screen. */
export interface SessionView {
    items: RunItem[];
    runId: string | null;
    running: boolean;
    currentAssistantId: string | null;
    currentThinkingId: string | null;
    currentModel: string;
    pendingPermissions: PermissionRequest[];
    usage: { inputTokens: number; outputTokens: number };
}

const emptyView = (): SessionView => ({
    items: [], runId: null, running: false,
    currentAssistantId: null, currentThinkingId: null,
    currentModel: '', pendingPermissions: [],
    usage: { inputTokens: 0, outputTokens: 0 },
});

const MAX_STASHED_VIEWS = 12;

let seq = 0;
const nid = () => `it_${Date.now()}_${seq++}`;

/** Pure per-view reducer - applied to the on-screen view OR a stashed one. */
function reduceView(view: SessionView, d: AgentDelta): SessionView {
    const items = view.items.slice();
    const v: SessionView = { ...view, items };
    const findLast = (id: string | null) => (id ? items.findIndex((x) => x.id === id) : -1);

    switch (d.t) {
        case 'run_start':
            v.runId = d.runId; v.running = true; v.currentModel = d.model;
            v.currentAssistantId = null; v.currentThinkingId = null;
            break;
        case 'text': {
            const idx = findLast(view.currentAssistantId);
            if (idx === -1) {
                const id = nid();
                items.push({ kind: 'assistant', id, text: d.v, model: view.currentModel });
                v.currentAssistantId = id;
            } else {
                const it = items[idx] as any;
                items[idx] = { ...it, text: it.text + d.v };
            }
            break;
        }
        case 'thinking': {
            const idx = findLast(view.currentThinkingId);
            if (idx === -1) {
                const id = nid();
                items.push({ kind: 'thinking', id, text: d.v });
                v.currentThinkingId = id;
            } else {
                const it = items[idx] as any;
                items[idx] = { ...it, text: it.text + d.v };
            }
            break;
        }
        case 'tool_call':
            items.push({ kind: 'tool', id: d.id, name: d.name, render: d.render || d.name, status: 'running' });
            v.currentAssistantId = null;
            v.currentThinkingId = null;
            break;
        case 'tool_result': {
            const idx = items.findIndex((x) => x.kind === 'tool' && x.id === d.id);
            if (idx !== -1) {
                const it = items[idx] as ToolItemData;
                items[idx] = { ...it, status: d.ok ? 'ok' : 'error', resultContent: d.content, data: d.data };
            }
            break;
        }
        case 'status':
            items.push({ kind: 'status', id: nid(), text: d.v });
            break;
        case 'permission_req':
            items.push({ kind: 'permission', id: d.req.id, req: d.req });
            v.pendingPermissions = [...view.pendingPermissions, d.req];
            v.currentAssistantId = null;
            break;
        case 'permission_resolved': {
            const idx = items.findIndex((x) => x.kind === 'permission' && x.id === d.reqId);
            if (idx !== -1) {
                const it = items[idx] as any;
                items[idx] = { ...it, resolved: d.decision };
            }
            v.pendingPermissions = view.pendingPermissions.filter((p) => p.id !== d.reqId);
            break;
        }
        case 'ask_user':
            items.push({ kind: 'question', id: d.req.id, req: d.req });
            v.currentAssistantId = null;
            v.currentThinkingId = null;
            break;
        case 'ask_user_resolved': {
            const idx = items.findIndex((x) => x.kind === 'question' && x.id === d.reqId);
            if (idx !== -1) {
                const it = items[idx] as any;
                items[idx] = { ...it, answers: d.answers };
            }
            break;
        }
        case 'usage':
            v.usage = {
                inputTokens: view.usage.inputTokens + (d.inputTokens ?? 0),
                outputTokens: view.usage.outputTokens + (d.outputTokens ?? 0),
            };
            break;
        case 'error':
            items.push({ kind: 'error', id: nid(), text: d.message });
            break;
        case 'done':
            v.running = false; v.runId = null;
            v.currentAssistantId = null; v.currentThinkingId = null;
            // A question still waiting can never be answered once the run ends
            // (stopped/errored) - dismiss it so the panel closes instead of
            // hanging around in a dead state.
            for (let k = 0; k < items.length; k++) {
                const it = items[k];
                if (it.kind === 'question' && !it.answers && !it.dismissed) {
                    items[k] = { ...it, dismissed: true };
                }
            }
            break;
    }
    return v;
}

interface AgentRunState {
    surface: Surface;
    model: string;
    sessions: Partial<Record<Surface, string>>;   // surface -> sessionId

    // The ACTIVE (on-screen) view, flattened so existing components keep working.
    items: RunItem[];
    runId: string | null;
    running: boolean;
    currentAssistantId: string | null;
    currentThinkingId: string | null;
    currentModel: string;
    pendingPermissions: PermissionRequest[];
    usage: { inputTokens: number; outputTokens: number };

    composerDraft: string;

    /** Off-screen conversations that are (or were) streaming - keyed by sessionId. */
    stash: Record<string, SessionView>;
    /** runId -> session key, so every delta finds its conversation. */
    runSessions: Record<string, string>;

    activeKey: () => string;
    setSurface: (s: Surface) => void;
    setModel: (m: string) => void;
    setSession: (s: Surface, id: string) => void;
    pushUser: (text: string, images?: { mimeType: string; dataBase64: string }[]) => void;
    clear: () => void;
    setItems: (items: RunItem[]) => void;
    dropFromLastUser: () => string;
    setComposerDraft: (t: string) => void;
    pushAssistant: (text: string) => void;
    pushError: (sessionKey: string, text: string) => void;
    /** Save the on-screen view into the stash (before switching away). */
    stashActive: () => void;
    /** Restore a stashed view to the screen. Returns false if none exists. */
    restoreStash: (key: string) => boolean;
    apply: (d: AgentDelta) => void;
    beginRun: () => void;
    /** running=false for one session, wherever it currently lives. */
    finishRun: (sessionKey: string) => void;
}

const draftKey = (surface: Surface) => `draft:${surface}`;
const keyOf = (st: Pick<AgentRunState, 'sessions' | 'surface'>) => st.sessions[st.surface] || draftKey(st.surface);

const viewOf = (st: AgentRunState): SessionView => ({
    items: st.items, runId: st.runId, running: st.running,
    currentAssistantId: st.currentAssistantId, currentThinkingId: st.currentThinkingId,
    currentModel: st.currentModel, pendingPermissions: st.pendingPermissions,
    usage: st.usage,
});

const flatten = (v: SessionView) => ({
    items: v.items, runId: v.runId, running: v.running,
    currentAssistantId: v.currentAssistantId, currentThinkingId: v.currentThinkingId,
    currentModel: v.currentModel, pendingPermissions: v.pendingPermissions,
    usage: v.usage,
});

export const useAgentRunStore = create<AgentRunState>((set, get) => ({
    surface: 'cowork',
    model: '',
    sessions: {},

    items: [],
    runId: null,
    running: false,
    currentAssistantId: null,
    currentThinkingId: null,
    currentModel: '',
    pendingPermissions: [],
    usage: { inputTokens: 0, outputTokens: 0 },

    composerDraft: '',
    stash: {},
    runSessions: {},

    activeKey: () => keyOf(get()),
    setSurface: (surface) => set({ surface }),
    setModel: (model) => set({ model }),
    setSession: (s, id) => set((st) => ({ sessions: { ...st.sessions, [s]: id } })),
    pushUser: (text, images) => set((st) => ({
        items: [...st.items, { kind: 'user', id: nid(), text, images }],
        currentAssistantId: null,
        currentThinkingId: null,
    })),
    clear: () => set({ ...flatten(emptyView()) }),
    setItems: (items) => set({ items, currentAssistantId: null, currentThinkingId: null }),
    setComposerDraft: (composerDraft) => set({ composerDraft }),
    pushAssistant: (text) => set((st) => ({
        items: [...st.items, { kind: 'assistant', id: nid(), text }],
        currentAssistantId: null,
        currentThinkingId: null,
    })),
    pushError: (sessionKey, text) => {
        const st = get();
        if (sessionKey === keyOf(st)) {
            set({ items: [...st.items, { kind: 'error', id: nid(), text }] });
        } else if (st.stash[sessionKey]) {
            const v = st.stash[sessionKey];
            set({ stash: { ...st.stash, [sessionKey]: { ...v, items: [...v.items, { kind: 'error', id: nid(), text }] } } });
        }
    },
    dropFromLastUser: () => {
        const st = get();
        let idx = -1;
        for (let i = st.items.length - 1; i >= 0; i--) { if (st.items[i].kind === 'user') { idx = i; break; } }
        if (idx === -1) return '';
        const text = (st.items[idx] as any).text || '';
        set({ items: st.items.slice(0, idx), currentAssistantId: null, currentThinkingId: null });
        return text;
    },

    stashActive: () => {
        const st = get();
        const key = keyOf(st);
        if (st.items.length === 0 && !st.running) return; // nothing worth keeping
        const stash = { ...st.stash, [key]: viewOf(st) };
        // Bound memory: evict the oldest idle view.
        const keys = Object.keys(stash);
        if (keys.length > MAX_STASHED_VIEWS) {
            const evict = keys.find((k) => !stash[k].running && k !== key);
            if (evict) delete stash[evict];
        }
        set({ stash });
    },

    restoreStash: (key) => {
        const st = get();
        const v = st.stash[key];
        if (!v) return false;
        const stash = { ...st.stash };
        delete stash[key];
        set({ ...flatten(v), stash });
        return true;
    },

    beginRun: () => set({ running: true }),

    finishRun: (sessionKey) => {
        const st = get();
        if (sessionKey === keyOf(st)) {
            if (st.running) set({ running: false, runId: null, currentAssistantId: null, currentThinkingId: null });
        } else if (st.stash[sessionKey]?.running) {
            const v = st.stash[sessionKey];
            set({ stash: { ...st.stash, [sessionKey]: { ...v, running: false, runId: null } } });
        }
    },

    apply: (d) => {
        const st = get();
        const active = keyOf(st);

        // Lifetime telemetry (per-session accounting happens in reduceView).
        if (d.t === 'usage') useUsageStore.getState().add(d.inputTokens ?? 0, d.outputTokens ?? 0);
        if (d.t === 'run_start') useUsageStore.getState().bumpRuns();

        // -- Bind a new run to its conversation ------------------------------
        if (d.t === 'run_start') {
            const sid = d.sessionId;
            // Only runs for conversations this window knows about may render.
            // Scheduled/background runs use fresh sessionIds -> ignored here.
            if (sid && sid === active) {
                set({
                    ...flatten(reduceView(viewOf(st), d)),
                    runSessions: { ...st.runSessions, [d.runId]: sid },
                });
            } else if (sid && st.stash[sid]) {
                set({
                    stash: { ...st.stash, [sid]: reduceView(st.stash[sid], d) },
                    runSessions: { ...st.runSessions, [d.runId]: sid },
                });
            } else if (!sid && st.running && !st.runId) {
                // Legacy path (no sessionId on the delta): bind to the view that
                // just called beginRun, like the old activeRunId logic did.
                set({
                    ...flatten(reduceView(viewOf(st), d)),
                    runSessions: { ...st.runSessions, [d.runId]: active },
                });
            }
            return;
        }

        // -- Route every other delta by its runId -----------------------------
        const rid = (d as any).runId as string | undefined;
        const key = rid ? st.runSessions[rid] : active;   // runId '' -> local/renderer errors
        if (!key) return; // unknown run (background/sub-agent) - never leak into a chat

        const patch: Partial<AgentRunState> = {};
        if (key === active) {
            Object.assign(patch, flatten(reduceView(viewOf(st), d)));
        } else if (st.stash[key]) {
            patch.stash = { ...st.stash, [key]: reduceView(st.stash[key], d) };
        }
        if (d.t === 'done') {
            const runSessions = { ...st.runSessions };
            if (rid) delete runSessions[rid];
            patch.runSessions = runSessions;
        }
        set(patch);
    },
}));

export type { SessionRecord };
