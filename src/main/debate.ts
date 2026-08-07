/* =======================================================================
   debate.ts — Dual-model debate engine.

   Each debater turn now runs through the SAME AgentKernel that single-model
   chat uses. That means both models get FULL parity with a normal turn:
   - the complete tool set for the surface (read/write/edit/bash/grep/glob/web/…)
   - project context (structure, memory, VIBE.md) in the system prompt
   - permission gating (auto-approved + confined to the project root here)
   - the image/vision pass (a non-vision debater gets images described first)

   This file only ORCHESTRATES: turn-taking, rounds, interjections, synthesis.
   Turns run sequentially (A, then B seeing A) with isolated shells per model.
   ======================================================================= */
import { ipcMain, BrowserWindow } from 'electron';
import { DEBATE_CHANNELS } from '../shared/ipcContracts';
import type {
    AgentDelta, AgentMessage, MessagePart, RunRequest, Surface,
    DebateStartRequest as DebateRequest,
    DebateModelRouting as ModelRouting,
    DebateVisionRef as VisionRef,
} from '../shared/agent';
import type { AgentKernel } from './agent/kernel';
import { killSessionShell } from './agent/tools/bash';

// ─── Types ──────────────────────────────────────────────────────────

export interface DebateDelta {
    runId: string;
    type: 'round_start' | 'token_a' | 'token_b' | 'round_end' | 'interjection' | 'synthesis_start' | 'synthesis_token' | 'synthesis_end' | 'done' | 'error';
    round?: number;
    content?: string;
    message?: string;
}

interface DebateState {
    running: boolean;
    cancelController: AbortController;
    /** Per-model conversation history (text only — images are handled once in round 1). */
    historyA: AgentMessage[];
    historyB: AgentMessage[];
    currentResponseA: string;
    currentResponseB: string;
    interjectionQueue: string[];
}

const debates = new Map<string, DebateState>();

// ─── Prompts ────────────────────────────────────────────────────────

const DEBATE_FRAMING = `You are ONE of TWO expert models in a live technical debate. Investigate the open project with your tools as needed, then give your best, most thorough answer. When you later see the other model's answer, critique it specifically — what it got right, what it missed, and what you would do differently. Be concise, correct, and actionable. No filler.`;

const COUNTER_PROMPT = (otherResponse: string, round: number) => `Here is the other model's response from round ${round}:

---OTHER MODEL'S RESPONSE---
${otherResponse}
---END---

Respond to it. What did they get right, what did they get wrong, and what would you do differently? Use your tools to verify if useful. Be specific and technical.`;

const textPart = (text: string): MessagePart => ({ type: 'text', text });
const imagePartsOf = (input: MessagePart[]): MessagePart[] => input.filter((p) => p.type === 'image');
const textOf = (input: MessagePart[]): string => input.filter((p) => p.type === 'text').map((p: any) => p.text).join('\n');

// ─── Debate loop ────────────────────────────────────────────────────

export async function runDebate(
    mainWindow: BrowserWindow,
    kernel: AgentKernel,
    req: DebateRequest,
    runId: string,
): Promise<void> {
    const state: DebateState = {
        running: true,
        cancelController: new AbortController(),
        historyA: [],
        historyB: [],
        currentResponseA: '',
        currentResponseB: '',
        interjectionQueue: [],
    };
    debates.set(runId, state);

    const send = (delta: Omit<DebateDelta, 'runId'>) => {
        if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send(DEBATE_CHANNELS.delta, { runId, ...delta } as DebateDelta);
        }
    };

    const maxRounds = req.maxRounds ?? 2;
    const surface: Surface = req.surface ?? 'code';
    const userImages = imagePartsOf(req.input);
    const userText = textOf(req.input) || '(no question text)';

    /** Run one debater turn through the kernel and stream its text back. Tool
        calls are surfaced as inline markers so the user can see it working. */
    const runTurn = async (
        model: string,
        routing: ModelRouting | undefined,
        vision: VisionRef | undefined,
        sessionSuffix: string,
        parts: MessagePart[],
        history: AgentMessage[],
        onChunk: (chunk: string) => void,
        tools?: string[],
        opts?: { surface?: Surface; think?: RunRequest['think'] },
    ): Promise<string> => {
        let text = '';
        const turnReq: RunRequest = {
            sessionId: `debate:${runId}:${sessionSuffix}`,
            surface: opts?.surface ?? surface,
            model,
            projectRoot: req.projectRoot ?? null,
            input: parts,
            apiKeys: req.apiKeys,
            ollamaApiKey: req.ollamaApiKey,
            ollamaCloud: routing?.ollamaCloud,
            ollamaLocal: routing?.ollamaLocal,
            autoApprove: true,     // no interactive user inside a debate turn
            confineToRoot: true,   // ...so file access is locked to the project root
            ephemeral: true,       // don't persist debate turns as chat sessions
            availableModels: req.availableModels,
            vision,
            tools: tools ?? req.tools,
            think: opts?.think,
        };
        await kernel.run(turnReq, (d: AgentDelta) => {
            if (d.t === 'text') { text += d.v; onChunk(d.v); }
            else if (d.t === 'tool_call') onChunk(`\n\`↳ ${d.render || d.name}\`\n`);
            else if (d.t === 'error') onChunk(`\n_[error: ${d.message}]_\n`);
        }, history, state.cancelController.signal);
        return text;
    };

    try {
        const transcript: { round: number; a: string; b: string }[] = [];

        const drainInterjections = (): string => {
            const items = state.interjectionQueue.splice(0);
            for (const m of items) send({ type: 'interjection', content: m });
            return items.length ? `\n\nThe user interjected mid-debate — address this too:\n${items.join('\n')}` : '';
        };

        for (let round = 1; round <= maxRounds; round++) {
            if (state.cancelController.signal.aborted) break;
            send({ type: 'round_start', round });

            // SIMULTANEOUS mode: both models fire at once — round 1 answers the
            // question with no peeking; later rounds each rebut the OTHER model's
            // PREVIOUS round — then we wait for both before advancing.
            if (req.simultaneous) {
                const interj = drainInterjections();
                const priorA = state.currentResponseA;
                const priorB = state.currentResponseB;
                const sParts = (otherPrev: string): MessagePart[] => round === 1
                    ? [textPart(`${DEBATE_FRAMING}\n\nUser question:\n${userText}${interj}`), ...userImages]
                    : [textPart(COUNTER_PROMPT(otherPrev, round - 1) + interj)];
                const [rA, rB] = await Promise.all([
                    runTurn(req.modelA, req.routingA, req.visionA, 'A', sParts(priorB), state.historyA, (chunk) => send({ type: 'token_a', round, content: chunk }))
                        .catch((e) => { send({ type: 'error', message: `Model A (${req.modelA}): ${(e as Error).message}` }); return ''; }),
                    runTurn(req.modelB, req.routingB, req.visionB, 'B', sParts(priorA), state.historyB, (chunk) => send({ type: 'token_b', round, content: chunk }))
                        .catch((e) => { send({ type: 'error', message: `Model B (${req.modelB}): ${(e as Error).message}` }); return ''; }),
                ]);
                state.historyA.push({ role: 'user', parts: [textPart(round === 1 ? userText : COUNTER_PROMPT(priorB, round - 1))] });
                state.historyA.push({ role: 'assistant', parts: [textPart(rA)] });
                state.historyB.push({ role: 'user', parts: [textPart(round === 1 ? userText : COUNTER_PROMPT(priorA, round - 1))] });
                state.historyB.push({ role: 'assistant', parts: [textPart(rB)] });
                state.currentResponseA = rA;
                state.currentResponseB = rB;
                transcript.push({ round, a: rA, b: rB });
                send({ type: 'round_end', round });
                continue;
            }

            // ---- Model A ----
            const aParts: MessagePart[] = round === 1
                ? [textPart(`${DEBATE_FRAMING}\n\nUser question:\n${userText}${drainInterjections()}`), ...userImages]
                : [textPart(COUNTER_PROMPT(state.currentResponseB, round - 1) + drainInterjections())];
            const responseA = await runTurn(
                req.modelA, req.routingA, req.visionA, 'A', aParts, state.historyA,
                (chunk) => send({ type: 'token_a', round, content: chunk }),
            ).catch((e) => { send({ type: 'error', message: `Model A (${req.modelA}): ${(e as Error).message}` }); return ''; });
            state.historyA.push({ role: 'user', parts: [textPart(round === 1 ? userText : COUNTER_PROMPT(state.currentResponseB, round - 1))] });
            state.historyA.push({ role: 'assistant', parts: [textPart(responseA)] });
            state.currentResponseA = responseA;

            if (state.cancelController.signal.aborted) break;

            // ---- Model B (answers having seen A's response from THIS round) ----
            const bParts: MessagePart[] = round === 1
                ? [textPart(`${DEBATE_FRAMING}\n\nUser question:\n${userText}\n\nThe other model answered:\n---\n${responseA || '(no answer)'}\n---\nGive your OWN answer, then say where you disagree.${drainInterjections()}`), ...userImages]
                : [textPart(COUNTER_PROMPT(responseA, round) + drainInterjections())];
            const responseB = await runTurn(
                req.modelB, req.routingB, req.visionB, 'B', bParts, state.historyB,
                (chunk) => send({ type: 'token_b', round, content: chunk }),
            ).catch((e) => { send({ type: 'error', message: `Model B (${req.modelB}): ${(e as Error).message}` }); return ''; });
            state.historyB.push({ role: 'user', parts: [textPart(round === 1 ? userText : COUNTER_PROMPT(responseA, round))] });
            state.historyB.push({ role: 'assistant', parts: [textPart(responseB)] });
            state.currentResponseB = responseB;

            transcript.push({ round, a: responseA, b: responseB });
            send({ type: 'round_end', round });
        }

        // Synthesis (judge) — pure text, no tools.
        if (!state.cancelController.signal.aborted && transcript.length) {
            const judgeModel = req.judgeModel || req.modelA;
            const judgeRouting = req.judgeModel ? undefined : req.routingA;
            const debateTranscript = [
                `USER QUESTION: ${userText}\n`,
                ...transcript.map((t) => `ROUND ${t.round}:\nMODEL A (${req.modelA}): ${t.a || '(no answer)'}\n\nMODEL B (${req.modelB}): ${t.b || '(no answer)'}\n`),
            ].join('\n');

            send({ type: 'synthesis_start' });
            await runTurn(
                judgeModel, judgeRouting, undefined, 'judge',
                [textPart(`You are the judge of a debate between two AI models. The debate is already OVER and the full transcript is below — do NOT try to investigate, verify, or use any tools; you have everything you need. Write the verdict directly: synthesize their best points into one definitive answer, note where they disagreed and which position is correct, and give a clear final recommendation. Be concise and practical.\n\n${debateTranscript}`)],
                [],
                (chunk) => send({ type: 'synthesis_token', content: chunk }),
                [], // no tools for synthesis
                // Judge just summarizes text: run it on the light 'chat' surface
                // (not the tool-pushing code/security prompt) with reasoning OFF,
                // so it writes the verdict instead of looping "let me verify…".
                { surface: 'chat', think: null },
            ).catch((e) => { send({ type: 'error', message: `Judge/Synthesis: ${(e as Error).message}` }); return ''; });
            send({ type: 'synthesis_end' });
        }

        send({ type: 'done' });
    } catch (e) {
        send({ type: 'error', message: (e as Error).message });
    } finally {
        state.running = false;
        debates.delete(runId);
        // Reap the confined shells the debate turns spun up.
        killSessionShell(`debate:${runId}:A`);
        killSessionShell(`debate:${runId}:B`);
        killSessionShell(`debate:${runId}:judge`);
    }
}

// ─── IPC Handlers ───────────────────────────────────────────────────

export function registerDebateHandlers(mainWindow: BrowserWindow, kernel: AgentKernel): void {
    ipcMain.handle(DEBATE_CHANNELS.start, async (_e, req: DebateRequest) => {
        const runId = `debate_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        // Fire and forget — streaming happens via delta events.
        runDebate(mainWindow, kernel, req, runId).catch(() => {});
        return { ok: true, runId };
    });

    ipcMain.handle(DEBATE_CHANNELS.cancel, async (_e, runId: string) => {
        const state = debates.get(runId);
        if (state) state.cancelController.abort();
        return { ok: true };
    });

    ipcMain.handle(DEBATE_CHANNELS.interject, async (_e, runId: string, message: string) => {
        const state = debates.get(runId);
        if (state) { state.interjectionQueue.push(message); return { ok: true }; }
        return { ok: false, error: 'Debate not found or already finished' };
    });

    ipcMain.handle(DEBATE_CHANNELS.listModels, async () => {
        // Local Ollama roster for the debate picker (cloud models are merged in
        // by the renderer from the kernel's cloudModels call).
        try {
            const ollamaRes = await fetch('http://localhost:11434/api/tags').catch(() => null);
            const ollamaModels: string[] = [];
            if (ollamaRes?.ok) {
                const data = await ollamaRes.json();
                for (const m of data.models || []) ollamaModels.push(`ollama:${m.name}`);
            }
            return { ok: true, models: ollamaModels };
        } catch {
            return { ok: true, models: [] };
        }
    });
}
