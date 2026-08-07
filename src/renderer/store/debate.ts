/* =======================================================================
   debate.ts — Zustand store for the dual-model debate feature.

   Manages:
   - Model selection (A + B)
   - Debate transcript (round-by-round, per-model)
   - Real-time streaming state
   - Interjection input
   - Synthesis result
   ======================================================================= */
import { create } from 'zustand';
import type { MessagePart } from '../../shared/agent';
import { useOllamaStore } from './ollama';
import { useUIStore } from './ui';
import { useSettingsStore } from './settings';
import { useAgentRunStore } from './agentRun';
import { getFallbackCapabilities } from '../utils/capabilities';

// Vision/routing helpers — mirror agentClient so debate turns pick the same
// vision fallback + cloud/local routing the single-model path uses.
function modelHasVision(model: string): boolean {
    const caps = useOllamaStore.getState().modelCapabilities[model];
    if (caps && (caps.vision || caps.image)) return true;
    return !!getFallbackCapabilities(model).vision;
}
function modelRouting(model: string): { ollamaCloud: boolean; ollamaLocal: boolean } {
    const o = useOllamaStore.getState();
    const local = o.models.includes(model);
    const cloud = (o.cloudModelNames.includes(model) && !local) || /(?::|-)cloud\b/i.test(model);
    return { ollamaCloud: cloud, ollamaLocal: local };
}
function buildRecentChatContext(items: any[]): string {
    const recent = items.slice(-12);
    if (recent.length === 0) return '';
    return [
        '== CURRENT CONVERSATION CONTEXT (most recent messages) ==',
        ...recent.map((it) => {
            if (it.kind === 'user') return `[User] ${it.text || ''}`.slice(0, 800);
            if (it.kind === 'assistant') return `[Assistant] ${it.text || ''}`.slice(0, 800);
            if (it.kind === 'tool') return `[Tool: ${it.name}] ${(it.resultContent || '').slice(0, 400)}`;
            if (it.kind === 'error') return `[Error] ${it.text || ''}`.slice(0, 400);
            return '';
        }).filter(Boolean),
    ].join('\n');
}

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

export interface DebateRound {
    round: number;
    textA: string;
    textB: string;
    complete: boolean;
}

export interface DebateState {
    // Config
    modelA: string;
    modelB: string;
    maxRounds: number;
    judgeModel: string;        // empty = no synthesis
    debateEnabled: boolean;
    simultaneous: boolean;     // both models answer concurrently each round, then sync

    // Runtime
    running: boolean;
    runId: string | null;
    rounds: DebateRound[];
    synthesis: string;
    synthesizing: boolean;
    error: string | null;

    // Actions
    setModelA: (m: string) => void;
    setModelB: (m: string) => void;
    setMaxRounds: (n: number) => void;
    setJudgeModel: (m: string) => void;
    toggleDebate: (on: boolean) => void;
    setSimultaneous: (v: boolean) => void;

    startDebate: (userMessage: string, images?: { mimeType: string; dataBase64: string }[], apiKeys?: Record<string, string>) => Promise<void>;
    cancelDebate: () => Promise<void>;
    interject: (message: string) => Promise<void>;

    // Internal — called by delta handler
    onDelta: (d: { runId: string; type: string; round?: number; content?: string; message?: string }) => void;
    reset: () => void;
}

let deltaWired = false;

export const useDebateStore = create<DebateState>((set, get) => ({
    modelA: '',
    modelB: '',
    maxRounds: 2,
    judgeModel: '',
    debateEnabled: false,
    simultaneous: false,

    running: false,
    runId: null,
    rounds: [],
    synthesis: '',
    synthesizing: false,
    error: null,

    setModelA: (m) => set({ modelA: m }),
    setModelB: (m) => set({ modelB: m }),
    setMaxRounds: (n) => set({ maxRounds: Math.max(1, Math.min(5, n)) }),
    setJudgeModel: (m) => set({ judgeModel: m }),
    toggleDebate: (on) => set({ debateEnabled: on, rounds: [], synthesis: '', error: null }),
    setSimultaneous: (v) => set({ simultaneous: v }),

    startDebate: async (userMessage, images, apiKeys) => {
        const { modelA, modelB, maxRounds, judgeModel } = get();
        if (!modelA || !modelB) {
            set({ error: 'Select both Model A and Model B to start a debate.' });
            return;
        }
        const imgs = images ?? [];
        if (!userMessage.trim() && imgs.length === 0) {
            set({ error: 'Enter a message (or attach an image) to debate.' });
            return;
        }

        set({ running: true, runId: null, rounds: [], synthesis: '', synthesizing: false, error: null });

        // Wire delta listener once
        if (!deltaWired && typeof window !== 'undefined') {
            window.vibe.debate.onDelta((d) => {
                useDebateStore.getState().onDelta(d);
            });
            deltaWired = true;
        }

        // Build the user turn as message parts (text + images) — the exact shape
        // a single-model chat turn uses, so images flow through the kernel's
        // vision pass for whichever debater lacks native vision.
        const input: MessagePart[] = [];
        if (userMessage.trim()) input.push({ type: 'text', text: userMessage });
        for (const img of imgs) input.push({ type: 'image', mimeType: img.mimeType, dataBase64: img.dataBase64 });

        // Seed the debate with the current conversation history so the debaters
        // continue from where the main assistant left off, not from zero context.
        const recentChat = buildRecentChatContext(useAgentRunStore.getState().items);
        if (recentChat) {
            input.unshift({ type: 'text', text: recentChat });
        }

        const o = useOllamaStore.getState();
        const availableModels = [...new Set([...o.models, ...o.cloudModelNames])];
        // Per-model vision fallback: only when THAT model can't see natively.
        const visionA = modelHasVision(modelA) ? undefined : pickVisionModel() ?? undefined;
        const visionB = modelHasVision(modelB) ? undefined : pickVisionModel() ?? undefined;

        try {
            const result = await window.vibe.debate.start({
                modelA,
                modelB,
                input,
                // Same surface (tool set + system prompt) + project as single-model.
                surface: useAgentRunStore.getState().surface,
                projectRoot: useUIStore.getState().projectPath,
                apiKeys,
                ollamaApiKey: apiKeys?.ollama,
                maxRounds,
                judgeModel: judgeModel || undefined,
                routingA: modelRouting(modelA),
                routingB: modelRouting(modelB),
                visionA,
                visionB,
                availableModels,
                simultaneous: get().simultaneous,
            });
            if (result.ok) set({ runId: result.runId });
        } catch (e) {
            set({ running: false, error: (e as Error).message });
        }
    },

    cancelDebate: async () => {
        const { runId } = get();
        if (runId) await window.vibe.debate.cancel(runId);
        // Wipe the transcript so the debate panel/inline block disappears
        // immediately instead of leaving stale rounds behind.
        set({ running: false, runId: null, rounds: [], synthesis: '', synthesizing: false });
    },

    interject: async (message) => {
        const { runId } = get();
        if (!runId || !message.trim()) return;
        try {
            await window.vibe.debate.interject(runId, message);
        } catch { /* debate may have ended */ }
    },

    onDelta: (d) => {
        const st = get();

        if (d.type === 'error') {
            set({ error: d.message || 'Unknown debate error', running: false });
            return;
        }

        if (d.type === 'round_start') {
            const round = d.round || 1;
            const rounds = [...st.rounds];
            // Ensure the round exists
            if (!rounds[round - 1]) {
                rounds[round - 1] = { round, textA: '', textB: '', complete: false };
            }
            set({ rounds });
            return;
        }

        if (d.type === 'token_a') {
            const round = d.round || 1;
            const rounds = [...st.rounds];
            if (!rounds[round - 1]) rounds[round - 1] = { round, textA: '', textB: '', complete: false };
            rounds[round - 1] = { ...rounds[round - 1], textA: rounds[round - 1].textA + (d.content || '') };
            set({ rounds });
            return;
        }

        if (d.type === 'token_b') {
            const round = d.round || 1;
            const rounds = [...st.rounds];
            if (!rounds[round - 1]) rounds[round - 1] = { round, textA: '', textB: '', complete: false };
            rounds[round - 1] = { ...rounds[round - 1], textB: rounds[round - 1].textB + (d.content || '') };
            set({ rounds });
            return;
        }

        if (d.type === 'round_end') {
            const round = d.round || 1;
            const rounds = [...st.rounds];
            if (rounds[round - 1]) rounds[round - 1] = { ...rounds[round - 1], complete: true };
            set({ rounds });
            return;
        }

        if (d.type === 'interjection') {
            // The interjection text is shown in the UI via the rounds
            // For now, we just note it — the next round will reflect it
            return;
        }

        if (d.type === 'synthesis_start') {
            set({ synthesizing: true });
            return;
        }

        if (d.type === 'synthesis_token') {
            set({ synthesis: st.synthesis + (d.content || '') });
            return;
        }

        if (d.type === 'synthesis_end') {
            set({ synthesizing: false });
            return;
        }

        if (d.type === 'done') {
            set({ running: false, runId: null });
            return;
        }
    },

    reset: () => set({
        rounds: [],
        synthesis: '',
        synthesizing: false,
        error: null,
        running: false,
        runId: null,
    }),
}));