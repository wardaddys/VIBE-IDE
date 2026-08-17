import type { AgentDelta, MessagePart, PermissionScope, RunRequest, Surface } from '../../shared/agent';
import type { RunItem } from '../store/agentRun';
import { useAgentRunStore } from '../store/agentRun';
import { useSettingsStore } from '../store/settings';
import { useOllamaStore } from '../store/ollama';
import { useUIStore } from '../store/ui';
import { useEditorStore } from '../store/editor';
import { setModelContent } from '../components/editor/MonacoEditor';
import { getFallbackCapabilities } from '../utils/capabilities';
import { useDebateStore } from '../store/debate';
import { terminalBus, formatAgentBlock } from '../utils/terminalBus';

let wired = false;

/** Subscribe once to the kernel delta stream and fan it into the store. */
export function initAgentClient() {
    if (wired) return;
    wired = true;
    window.vibe.kernel.onDelta((d) => {
        useAgentRunStore.getState().apply(d);
        followAgentFiles(d);
        mirrorAgentTerminal(d);
    });
}

/** Mirror the agent's bash command + output into any mounted terminal pane so
    the user watches it run in a real terminal (display only). */
function mirrorAgentTerminal(d: AgentDelta) {
    // Always record (even if no terminal is open) so the log is complete when
    // the user opens/reopens the terminal later.
    if (d.t === 'tool_result' && d.name === 'bash') {
        terminalBus.write(formatAgentBlock(d.content, d.data as any));
    }
}

/* -- IDE layout: the editor follows whatever file the agent is touching. --- */
const FOLLOW_TOOLS = new Set(['read_file', 'write_file', 'edit_file']);
const MUTATING_TOOLS = new Set(['write_file', 'edit_file']);
const callPaths = new Map<string, { path: string; mutating: boolean }>();

function resolveProjectPath(p: string): string {
    if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(p)) return p; // already absolute (win drive/UNC/posix)
    const root = useUIStore.getState().projectPath;
    return root ? `${root.replace(/[\\/]+$/, '')}/${p}` : p;
}

function openInEditor(path: string) {
    window.vibe.readFile(path)
        .then((content) => {
            useEditorStore.getState().openFile(path, content); // appends a tab (multi-file), makes it active
            useEditorStore.getState().updateContent(path, content);
            setModelContent(path, content); // sync an already-open Monaco model
            // Make the file visible: in chat layout the Workspace panel may be
            // closed - pop it open so agent-touched files actually show up.
            const ui = useUIStore.getState();
            if (ui.layoutMode !== 'ide' && !ui.workspaceOpen) ui.setWorkspaceOpen(true);
        })
        .catch(() => { /* unreadable (binary/deleted/out-of-root) - don't follow */ });
}

function followAgentFiles(d: AgentDelta) {
    // Follow in both layouts (IDE always shows the editor; chat layout gets the
    // Workspace panel auto-opened). Skip where there is no editor to show into.
    if (useAgentRunStore.getState().surface === 'design') return; // Design layout has a canvas, not an editor
    if (d.t === 'tool_call' && FOLLOW_TOOLS.has(d.name)) {
        const p = (d.input as any)?.path;
        if (typeof p !== 'string' || !p) return;
        const abs = resolveProjectPath(p);
        callPaths.set(d.id, { path: abs, mutating: MUTATING_TOOLS.has(d.name) });
        if (!MUTATING_TOOLS.has(d.name)) openInEditor(abs); // reads: show immediately
    } else if (d.t === 'tool_result') {
        const rec = callPaths.get(d.id);
        callPaths.delete(d.id);
        // writes/edits: open AFTER the change lands so the editor shows the result
        if (rec?.mutating && d.ok) openInEditor(rec.path);
    }
}

/** Does this model accept images natively? Real capability flag first, then a
    name-pattern fallback for models Ollama hasn't reported on. */
function modelHasVision(model: string): boolean {
    const caps = useOllamaStore.getState().modelCapabilities[model];
    if (caps && (caps.vision || caps.image)) return true;
    return !!getFallbackCapabilities(model).vision;
}

/** Routing (cloud vs local) for a given model name. */
function modelRouting(model: string): { ollamaCloud: boolean; ollamaLocal: boolean } {
    const o = useOllamaStore.getState();
    const local = o.models.includes(model);
    const cloud = (o.cloudModelNames.includes(model) && !local) || /(?::|-)cloud\b/i.test(model);
    return { ollamaCloud: cloud, ollamaLocal: local };
}

/** Choose a vision-capable model to describe images for a non-vision main model.
    Order: explicit user preference -> a vision-capable cloud (Pro) model ->
    a vision-capable local model. Null if none is available. */
function pickVisionModel(): { model: string; ollamaCloud: boolean; ollamaLocal: boolean } | null {
    const pref = useSettingsStore.getState().visionModel;
    if (pref) return { model: pref, ...modelRouting(pref) };
    const o = useOllamaStore.getState();
    const cloud = o.cloudModelNames.find(modelHasVision);
    if (cloud) return { model: cloud, ...modelRouting(cloud) };
    const local = o.models.find(modelHasVision);
    if (local) return { model: local, ...modelRouting(local) };
    return null;
}

async function ensureSession(surface: Surface, model: string): Promise<string> {
    const store = useAgentRunStore.getState();
    const existing = store.sessions[surface];
    if (existing) return existing;
    const projectRoot = useUIStore.getState().projectPath;
    const rec = await window.vibe.kernel.createSession({ surface, projectRoot, model });
    store.setSession(surface, rec.id);
    return rec.id;
}

/** Send a user turn to the kernel for the active surface. */
export async function runTurn(text: string, images: { mimeType: string; dataBase64: string }[] = []) {
    const store = useAgentRunStore.getState();
    const surface = store.surface;
    const activeModel = store.model;
    if (!activeModel) { store.apply({ t: 'error', runId: '', message: 'No model selected.' }); return; }

    const firstTurn = store.items.length === 0;
    const sessionId = await ensureSession(surface, activeModel);
    if (firstTurn && text.trim()) {
        const title = text.trim().replace(/\s+/g, ' ').slice(0, 48);
        window.vibe.kernel.renameSession(sessionId, title).catch(() => {});
    }
    const projectRoot = useUIStore.getState().projectPath;
    const keys = useSettingsStore.getState().apiKeys as Record<string, string>;
    const localModels = useOllamaStore.getState().models;
    const cloudNames = useOllamaStore.getState().cloudModelNames;
    const ollamaLocal = localModels.includes(activeModel);
    const ollamaCloud = cloudNames.includes(activeModel) && !ollamaLocal;

    // Worker models the conductor can dispatch to (local + cloud), minus the
    // conductor's own model.
    const availableModels = [...new Set([...localModels, ...cloudNames])].filter((m) => m !== activeModel);

    // Vision fallback: if the user attached images but the active model can't see,
    // route the images through a vision-capable model that describes them as text.
    let vision: { model: string; ollamaCloud: boolean; ollamaLocal: boolean } | undefined;
    if (images.length > 0 && !modelHasVision(activeModel)) {
        const picked = pickVisionModel();
        if (picked && picked.model !== activeModel) vision = picked;
        else if (!picked) store.pushAssistant('_You attached an image but the current model has no vision, and no vision-capable model is available. Pick a vision model in Settings → Models, or switch to a model that can see._');
    }

    const parts: MessagePart[] = [];
    if (text.trim()) parts.push({ type: 'text', text });
    for (const img of images) parts.push({ type: 'image', mimeType: img.mimeType, dataBase64: img.dataBase64 });

    store.pushUser(text, images);
    store.beginRun();

    const req: RunRequest = {
        sessionId,
        surface,
        model: activeModel,
        projectRoot,
        input: parts,
        apiKeys: keys,
        ollamaApiKey: keys.ollama || '',
        ollamaCloud,
        ollamaLocal,
        think: null,
        autoApprove: useSettingsStore.getState().permissionMode === 'auto',
        mode: useSettingsStore.getState().agentMode,
        availableModels,
        vision,
    };
    try {
        await window.vibe.kernel.run(req);
    } catch (e: any) {
        useAgentRunStore.getState().pushError(sessionId, e?.message || String(e));
    } finally {
        // The 'done' delta normally clears the running flag on the right
        // conversation; this is the safety net if the IPC call itself blew up.
        useAgentRunStore.getState().finishRun(sessionId);
    }
}

export function cancelRun() {
    const runId = useAgentRunStore.getState().runId;
    if (runId) window.vibe.kernel.cancel(runId);
}

export function approvePermission(reqId: string, decision: 'allow' | 'deny', scope: PermissionScope) {
    // Resolve against the request's OWN run - the prompt may belong to a
    // conversation that is no longer on screen.
    const st = useAgentRunStore.getState();
    const req = st.pendingPermissions.find((p) => p.id === reqId)
        || Object.values(st.stash).flatMap((v) => v.pendingPermissions).find((p) => p.id === reqId);
    const runId = req?.runId || st.runId;
    if (runId) window.vibe.kernel.approve(runId, { reqId, decision, scope });
}

/** Submit the user's selections for an ask_user question card. */
export function answerQuestion(reqId: string, answers: Record<string, string[]>) {
    window.vibe.kernel.answer(reqId, answers).catch(() => {});
}

/** Approve everything currently waiting (used when switching to auto-allow). */
export function approveAllPending() {
    const st = useAgentRunStore.getState();
    const all = [...st.pendingPermissions, ...Object.values(st.stash).flatMap((v) => v.pendingPermissions)];
    for (const p of all) window.vibe.kernel.approve(p.runId, { reqId: p.id, decision: 'allow', scope: 'session' });
}

/** Point the whole workspace (file tree, VIBE.md, runs, agent cwd) at a
    session's own folder. Each chat is bound to the folder it was created in;
    switching chats switches the active folder. */
async function applySessionFolder(sessionId: string) {
    try {
        const rec = await window.vibe.kernel.getSession(sessionId);
        const folder = rec?.projectRoot || null;
        if (folder && folder !== useUIStore.getState().projectPath) {
            useUIStore.getState().setProjectPath(folder);
            try { window.vibe.watchFolder(folder); } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
}

/** Switch surface: stash the live view, restore the target's (or load history). */
export async function switchSurface(surface: Surface) {
    const store = useAgentRunStore.getState();
    if (store.surface === surface) return;
    useDebateStore.getState().reset(); // don't carry a debate view across surfaces
    store.stashActive();
    store.setSurface(surface);
    const sessionId = store.sessions[surface];
    if (sessionId) applySessionFolder(sessionId); // follow this surface's chat folder
    const key = sessionId || `draft:${surface}`;
    if (useAgentRunStore.getState().restoreStash(key)) return; // mid-stream view - full transcript intact
    store.clear();
    if (!sessionId) return;
    await loadPersisted(sessionId);
}

/** Fetch a session's saved transcript, guarding against the user switching again mid-fetch. */
async function loadPersisted(sessionId: string) {
    try {
        const msgs = await window.vibe.kernel.getMessages(sessionId);
        const store = useAgentRunStore.getState();
        if (store.activeKey() !== sessionId) return; // stale fetch - user moved on
        const items = msgs.flatMap((m, i): RunItem[] => {
            if (m.role === 'user') return [{ kind: 'user', id: `h_${i}`, text: partsText(m.parts), images: partsImages(m.parts) }];
            if (m.role === 'assistant') {
                const t = partsText(m.parts);
                return t ? [{ kind: 'assistant', id: `h_${i}`, text: t }] : [];
            }
            if (m.role === 'tool') {
                // Reconstruct tool result cards from persisted tool messages.
                const toolParts = m.parts.filter((p): p is Extract<MessagePart, { type: 'tool_result' }> => p.type === 'tool_result');
                return toolParts.map((p, k) => ({
                    kind: 'tool' as const,
                    id: p.toolUseId || `h_${i}_${k}`,
                    name: p.name || 'tool',
                    render: p.name || 'tool',
                    status: (p.isError ? 'error' : 'ok') as 'ok' | 'error',
                    resultContent: p.content,
                }));
            }
            return [];
        });
        store.setItems(items);
    } catch { /* ignore */ }
}

function partsImages(parts: MessagePart[]): { mimeType: string; dataBase64: string }[] {
    return parts.filter((p) => p.type === 'image').map((p: any) => ({ mimeType: p.mimeType, dataBase64: p.dataBase64 }));
}

function partsText(parts: MessagePart[]): string {
    return parts.filter((p) => p.type === 'text').map((p: any) => p.text).join('');
}

/** Start a fresh conversation for the current surface. */
export function newChat() {
    const store = useAgentRunStore.getState();
    store.stashActive();               // a streaming chat keeps living off-screen
    store.setSession(store.surface, '');
    store.clear();
    useDebateStore.getState().reset(); // a finished debate belongs to its own chat
}

/** Start a fresh chat bound to the currently open project (or unattached if none). */
export function newChatInCurrentProject() {
    const projectRoot = useUIStore.getState().projectPath;
    newChatForProject(projectRoot);
}

/** Start a fresh chat bound to a specific project folder. */
export async function newChatForProject(projectRoot: string | null | undefined) {
    if (projectRoot && projectRoot !== useUIStore.getState().projectPath) {
        useUIStore.getState().setProjectPath(projectRoot);
        try { window.vibe.watchFolder(projectRoot); } catch { /* ignore */ }
    }
    newChat();
}

/** Load a specific past session into the view. */
export async function loadSession(surface: Surface, sessionId: string) {
    const store = useAgentRunStore.getState();
    if (store.surface === surface && store.sessions[surface] === sessionId) return;
    useDebateStore.getState().reset(); // debate view is scoped to the chat that ran it
    store.stashActive();
    store.setSurface(surface);
    store.setSession(surface, sessionId);
    applySessionFolder(sessionId); // switch the workspace to this chat's folder
    if (useAgentRunStore.getState().restoreStash(sessionId)) return; // live view survives the round trip
    store.clear();
    await loadPersisted(sessionId);
}

/** Regenerate the last assistant turn: rewind history + rerun the last user message. */
export async function regenerate() {
    const store = useAgentRunStore.getState();
    if (store.running) return;
    const surface = store.surface;
    const sessionId = store.sessions[surface];
    const text = store.dropFromLastUser();
    if (!text || !sessionId) return;
    await window.vibe.kernel.sessionRewind(sessionId).catch(() => {});
    await runTurn(text);
}

/** Pull the last user message back for editing; returns its text. */
export async function editLast(): Promise<string> {
    const store = useAgentRunStore.getState();
    if (store.running) return '';
    const surface = store.surface;
    const sessionId = store.sessions[surface];
    const text = store.dropFromLastUser();
    if (sessionId) await window.vibe.kernel.sessionRewind(sessionId).catch(() => {});
    return text;
}
