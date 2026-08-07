/* =======================================================================
   AgentKernel - the native tool-calling loop. Runs in the MAIN process.

   loop:
     stream a turn -> collect (text, thinking, tool_calls)
     if no tool_calls: done
     else execute each call (permission-gated) -> feed results back -> repeat
   ======================================================================= */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
    AgentDelta,
    AgentMessage,
    MessagePart,
    PermissionRule,
    RunRequest,
    StopReason,
} from '../../shared/agent';
import type { ProviderEvent, ToolContext } from './types';
import { ToolRegistry } from './registry';
import { PermissionBroker } from './permissions';
import { selectProvider } from './provider';
import { presetFor } from './presets';
import { resolveWithinRoot } from './fsGuard';
import { clearReadCache } from './tools/fs';
import { logCommand } from './commandLog';

const MAX_ITERS_DEFAULT = 40;
const MAX_ITERS_BY_SURFACE: Record<string, number> = {};
const MAX_SUBAGENT_DEPTH = 2;

/** Tools a plan-mode run may use - read/search only, nothing state-changing. */
const PLAN_SAFE_TOOLS = new Set(['read_file', 'glob', 'grep', 'list_dir', 'web_search', 'web_fetch', 'use_skill', 'task']);

const BUILD_NOTE = `MODE: BUILD
Execute the request end-to-end IN THIS RUN. Never end your turn by asking permission to proceed, offering to "start now", or posing a question whose only sensible answer is "yes" - the user already said yes by sending the message. If details are ambiguous, state your assumption in one line and keep going. Verify your own work (build, tests, grader, re-read) before finishing. Finish with results, not questions.`;

const PLAN_NOTE = `MODE: PLAN
Do NOT modify files or run state-changing commands in this run (write/exec tools are disabled). Read, search, and analyze as much as needed, then present a concrete plan: numbered steps, the files you will touch, the commands you will run, the risks, and how you will verify success. End by asking the user to approve or adjust the plan - they will switch to Build mode to execute it.`;

export interface KernelDeps {
    registry: ToolRegistry;
    getBriefing?: () => Promise<string>;
    getMemory?: (root: string) => Promise<string>;
    getSkillsIndex?: () => string;
    loadSkill?: (name: string) => Promise<string>;
    getVibeInstructions?: (root: string) => Promise<string | null>;
    onPersist?: (sessionId: string, messages: AgentMessage[]) => void;
}

interface ActiveRun {
    controller: AbortController;
    broker: PermissionBroker;
}

export class AgentKernel {
    private runs = new Map<string, ActiveRun>();
    /**
     * "Allow for session" rules, keyed by chat sessionId. A PermissionBroker
     * only lives for one run; this store is what makes session-scope approvals
     * actually stick for the rest of the conversation.
     */
    private sessionAllows = new Map<string, PermissionRule[]>();

    constructor(private deps: KernelDeps) {}

    cancel(runId: string) {
        const r = this.runs.get(runId);
        if (r) { r.controller.abort(); r.broker.cancelAllPending(); }
    }

    getBroker(runId: string): PermissionBroker | undefined {
        return this.runs.get(runId)?.broker;
    }

    /** Entry point. `emit` streams normalized deltas to the caller (IPC -> renderer). */
    async run(req: RunRequest, emit: (d: AgentDelta) => void, history: AgentMessage[] = [], parentSignal?: AbortSignal): Promise<StopReason> {
        const runId = randomUUID();
        const controller = new AbortController();
        // Cancelling the parent run must cancel its sub-agents too (they own a
        // separate controller/runId the UI never sees). Link them here.
        if (parentSignal) {
            if (parentSignal.aborted) controller.abort();
            else parentSignal.addEventListener('abort', () => controller.abort(), { once: true });
        }
        const broker = new PermissionBroker();
        const preset = req.tools ? { ...presetFor(req.surface), tools: req.tools } : presetFor(req.surface);
        broker.autoAllowSafe = preset.autoAllowSafe;
        broker.autoAllowAll = !!req.autoApprove;
        broker.denyOutsideRoot = !!req.confineToRoot;
        broker.setEmitter(emit);
        let shared = this.sessionAllows.get(req.sessionId);
        if (!shared) { shared = []; this.sessionAllows.set(req.sessionId, shared); }
        broker.attachSessionAllows(shared);
        await broker.load(req.projectRoot);
        this.runs.set(runId, { controller, broker });

        emit({ t: 'run_start', runId, surface: req.surface, model: req.model, sessionId: req.sessionId });
        let persisted: AgentMessage[] | null = null;

        try {
            const system = await this.buildSystemPrompt(req);
            const messages: AgentMessage[] = [
                { role: 'system', parts: [{ type: 'text', text: system }] },
                ...history,
                { role: 'user', parts: req.input },
            ];
            persisted = messages;

            const ctx: ToolContext = {
                runId,
                sessionId: req.sessionId,
                projectRoot: req.projectRoot,
                cwd: req.projectRoot || process.cwd(),
                signal: controller.signal,
                emit,
                permissions: broker,
                resolvePath: (input, opts) => {
                    const { resolved } = resolveWithinRoot(input, req.projectRoot);
                    if (!opts?.allowOutsideRoot && req.projectRoot) {
                        // Confinement is enforced at the permission layer (force-ask),
                        // not by throwing - the model shouldn't crash on an out-of-root read.
                    }
                    return resolved;
                },
                apiKeys: req.apiKeys ?? {},
                ollamaApiKey: req.ollamaApiKey,
                visionModel: req.vision,
                depth: req.depth ?? 0,
                runSubAgent: (spec) => this.runSubAgent(spec, req, emit),
                loadSkill: this.deps.loadSkill,
                logCommand: (rec) => logCommand(req.projectRoot, { ...rec, surface: req.surface, runId }),
            };

            // Vision fallback: if the main model can't see but images are attached,
            // describe them with a vision model and swap the images for that text
            // BEFORE the first turn, so every turn (and the persisted history) sees
            // the description instead of re-sending raw images to a blind model.
            if (req.vision) await this.runVisionPass(messages, req, runId, controller.signal, ctx, emit);

            const provider = selectProvider(req.model, ctx.apiKeys, { ollamaCloud: req.ollamaCloud, ollamaLocal: req.ollamaLocal });
            // Plan mode is enforced, not just suggested: write/exec tools are not
            // even advertised to the model. Explicit req.tools (sub-agents) win.
            const enabledTools = (req.mode === 'plan' && !req.tools)
                ? preset.tools.filter((t) => PLAN_SAFE_TOOLS.has(t))
                : preset.tools;
            const toolDefs = this.deps.registry.providerDefs(enabledTools);

            let stop: StopReason = 'end_turn';

            const maxIters = MAX_ITERS_BY_SURFACE[req.surface] || MAX_ITERS_DEFAULT;
            for (let iter = 0; iter < maxIters; iter++) {
                if (controller.signal.aborted) { stop = 'stopped'; break; }

                // Keep the context window under control for long autonomous hunts.
                trimHistory(messages, preset.numCtx ?? 65536);

                const turn = await this.collectTurn(
                    () => provider.stream({
                        model: stripModel(req.model),
                        messages,
                        tools: toolDefs,
                        think: req.think,
                        numCtx: preset.numCtx,
                        signal: controller.signal,
                        apiKeys: ctx.apiKeys,
                        ollamaApiKey: ctx.ollamaApiKey,
                        ollamaCloud: req.ollamaCloud,
                        ollamaLocal: req.ollamaLocal,
                    }),
                    runId,
                    emit,
                    messages,
                );

                if (turn.error) { emit({ t: 'error', runId, message: turn.error }); stop = 'error'; break; }

                // Reconstruct the assistant message for history.
                const asstParts: MessagePart[] = [];
                if (turn.thinking) asstParts.push({ type: 'thinking', text: turn.thinking });
                if (turn.text) asstParts.push({ type: 'text', text: turn.text });
                for (const tc of turn.toolCalls) asstParts.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
                messages.push({ role: 'assistant', parts: asstParts });

                if (turn.toolCalls.length === 0) { stop = 'end_turn'; break; }

                // Execute tool calls. Normally sequential (safer with the permission
                // broker + shared shell). EXCEPTION: when the conductor dispatches a
                // batch of workers (all `task` calls) in one turn, run them
                // concurrently - workers are isolated + read-only, so there is no
                // shell contention or write interleaving.
                const resultParts: MessagePart[] = [];
                const allWorkers = turn.toolCalls.length > 1 && turn.toolCalls.every((tc) => tc.name === 'task');
                if (allWorkers) {
                    for (const tc of turn.toolCalls) {
                        const tool = this.deps.registry.get(tc.name);
                        emit({ t: 'tool_call', runId, id: tc.id, name: tc.name, input: tc.input, render: tool?.render ? safe(tool.render, tc.input) : tc.name });
                    }
                    const results = await Promise.all(turn.toolCalls.map((tc) => this.deps.registry.execute(tc, ctx)));
                    turn.toolCalls.forEach((tc, i) => {
                        const res = results[i];
                        emit({ t: 'tool_result', runId, id: tc.id, name: tc.name, ok: res.ok, content: res.content, data: res.data });
                        resultParts.push({ type: 'tool_result', toolUseId: tc.id, content: res.content, isError: res.isError, name: tc.name });
                    });
                } else {
                    for (const tc of turn.toolCalls) {
                        if (controller.signal.aborted) break;
                        const tool = this.deps.registry.get(tc.name);
                        emit({ t: 'tool_call', runId, id: tc.id, name: tc.name, input: tc.input, render: tool?.render ? safe(tool.render, tc.input) : tc.name });
                        const res = await this.deps.registry.execute(tc, ctx);
                        emit({ t: 'tool_result', runId, id: tc.id, name: tc.name, ok: res.ok, content: res.content, data: res.data });
                        resultParts.push({ type: 'tool_result', toolUseId: tc.id, content: res.content, isError: res.isError, name: tc.name });
                    }
                }
                messages.push({ role: 'tool', parts: resultParts });

                if (controller.signal.aborted) { stop = 'stopped'; break; }
                if (iter === maxIters - 1) stop = 'budget';
            }

            emit({ t: 'done', runId, stopReason: stop });
            return stop;
        } catch (e: any) {
            if (controller.signal.aborted) { emit({ t: 'done', runId, stopReason: 'stopped' }); return 'stopped'; }
            emit({ t: 'error', runId, message: e?.message || String(e) });
            emit({ t: 'done', runId, stopReason: 'error' });
            return 'error';
        } finally {
            if (persisted && !req.ephemeral) this.deps.onPersist?.(req.sessionId, persisted.filter((m) => m.role !== 'system'));
            // NOTE: session-scope allows deliberately survive the run - they live
            // in this.sessionAllows and die with the app (or an explicit clear).
            clearReadCache(req.sessionId);
            this.runs.delete(runId);
        }
    }

    /**
     * Consume a provider stream into a single assistant turn, emitting deltas live.
     * If the provider stops because of `max_tokens` while the assistant is still
     * mid-thought / mid-tool-JSON, we automatically continue in the background with
     * a lightweight "continue from where you stopped" prompt so long tasks are not
     * abandoned just because the current response ran out of tokens.
     */
    private async collectTurn(
        makeStream: () => AsyncGenerator<ProviderEvent>,
        runId: string,
        emit: (d: AgentDelta) => void,
        messages: AgentMessage[],
        maxContinuations = 3,
    ): Promise<{ text: string; thinking: string; toolCalls: Array<{ id: string; name: string; input: unknown }>; error?: string }> {
        let text = '';
        let thinking = '';
        const toolCalls: Array<{ id: string; name: string; input: unknown }> = [];
        let error: string | undefined;
        let stopReason: import('./types').ProviderStopReason | undefined;
        let continuations = 0;

        const drain = async (stream: AsyncGenerator<ProviderEvent>) => {
            for await (const ev of stream) {
                if (ev.t === 'text') { text += ev.v; emit({ t: 'text', runId, v: ev.v }); }
                else if (ev.t === 'thinking') { thinking += ev.v; emit({ t: 'thinking', runId, v: ev.v }); }
                else if (ev.t === 'tool_call') { toolCalls.push({ id: ev.id, name: ev.name, input: ev.input }); }
                else if (ev.t === 'usage') emit({ t: 'usage', runId, inputTokens: ev.inputTokens, outputTokens: ev.outputTokens });
                else if (ev.t === 'done') {
                    stopReason = ev.stopReason;
                    if (ev.stopReason === 'error') error = ev.error || 'provider error';
                    else if (ev.stopReason === 'max_tokens') {
                        emit({ t: 'status', runId, v: '! response hit the output-token limit; continuing in background…' });
                    }
                }
            }
        };

        await drain(makeStream());

        // Auto-continue: the model ran out of output tokens before it could finish.
        // We push a minimal "continue" user prompt so the model sees the partial
        // assistant message in history and can finish its thought/tool call. We only
        // continue when there is partial output to build on; a clean stop is left alone.
        while (stopReason === 'max_tokens' && continuations < maxContinuations && (text.trim() || thinking.trim() || toolCalls.length > 0)) {
            continuations++;
            emit({ t: 'status', runId, v: `> continuation turn ${continuations}/${maxContinuations}` });

            // Build the continuation prompt from the partial assistant output so the
            // model has context. For Ollama/Anthropic/OpenAI a user message right
            // after an unfinished assistant message is interpreted as "continue".
            const parts: MessagePart[] = [];
            if (thinking.trim()) parts.push({ type: 'thinking', text: thinking });
            if (text.trim()) parts.push({ type: 'text', text });
            for (const tc of toolCalls) parts.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
            const continuationAsst: AgentMessage = { role: 'assistant', parts };
            const continuationUser: AgentMessage = { role: 'user', parts: [{ type: 'text', text: 'Continue from where you stopped. Complete your previous thought or tool call.' }] };
            messages.push(continuationAsst, continuationUser);

            // Reset accumulators for the continuation turn, but preserve stopReason detection.
            const prevText = text;
            const prevThinking = thinking;
            const prevToolCalls = toolCalls.slice();
            text = '';
            thinking = '';
            toolCalls.length = 0;
            stopReason = undefined;
            await drain(makeStream());

            // Remove the synthetic assistant + user messages we injected for continuation.
            // They were needed to give the model context, but we don't want them to stay
            // in the main history as if they were real turns (they duplicate the partial
            // output that is already captured by the reconstructed assistant message below).
            // We leave them in if the continuation produced more content; otherwise drop them.
            const lastTwo = messages.splice(-2, 2);
            if (text.trim() || thinking.trim() || toolCalls.length) {
                // The continuation produced additional output. Re-merge: put the partial
                // assistant + continuation text back as one coherent assistant message.
                const mergedParts: MessagePart[] = [];
                if (prevThinking.trim() || thinking.trim()) mergedParts.push({ type: 'thinking', text: `${prevThinking}${thinking}` });
                if (prevText.trim() || text.trim()) mergedParts.push({ type: 'text', text: `${prevText}${text}` });
                for (const tc of [...prevToolCalls, ...toolCalls]) mergedParts.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input });
                messages.push({ role: 'assistant', parts: mergedParts });
            }
        }

        if (stopReason === 'max_tokens') {
            emit({ t: 'status', runId, v: '! response still hit the output-token limit after continuing; task may be incomplete.' });
        }

        return { text, thinking, toolCalls, error };
    }

    /** Describe attached images with a vision model, then replace the image parts
        in the user's message with that text so a non-vision main model can use it. */
    private async runVisionPass(
        messages: AgentMessage[],
        req: RunRequest,
        runId: string,
        signal: AbortSignal,
        ctx: ToolContext,
        emit: (d: AgentDelta) => void,
    ): Promise<void> {
        const vision = req.vision;
        if (!vision) return;
        const userMsg = [...messages].reverse().find((m) => m.role === 'user' && m.parts.some((p) => p.type === 'image'));
        if (!userMsg) return;
        const imageParts = userMsg.parts.filter((p) => p.type === 'image');
        if (imageParts.length === 0) return;

        emit({ t: 'status', runId, v: `> ${req.model} has no vision - describing ${imageParts.length} image(s) with ${vision.model}` });

        const visionMessages: AgentMessage[] = [
            { role: 'system', parts: [{ type: 'text', text: 'You are a precise vision assistant. Describe the image(s) in complete, faithful detail: layout, objects, colors, and ALL visible text transcribed verbatim. Do not summarize or omit. Someone who cannot see the image must be able to answer questions about it from your description alone.' }] },
            { role: 'user', parts: [...imageParts, { type: 'text', text: 'Describe every attached image in full detail.' }] },
        ];

        const provider = selectProvider(vision.model, ctx.apiKeys, { ollamaCloud: vision.ollamaCloud, ollamaLocal: vision.ollamaLocal });
        let description = '';
        try {
            for await (const ev of provider.stream({
                model: stripModel(vision.model),
                messages: visionMessages,
                tools: [],
                think: null,
                numCtx: 32768,
                signal,
                apiKeys: ctx.apiKeys,
                ollamaApiKey: ctx.ollamaApiKey,
                ollamaCloud: vision.ollamaCloud,
                ollamaLocal: vision.ollamaLocal,
            })) {
                if (ev.t === 'text') description += ev.v;
            }
        } catch { /* fall through to placeholder */ }

        const kept = userMsg.parts.filter((p) => p.type !== 'image');
        const body = description.trim() || '(the vision model could not describe the image)';
        kept.push({ type: 'text', text: `[Image(s) the user attached, described by ${vision.model} because ${req.model} has no vision:\n${body}\n]` });
        userMsg.parts = kept;
    }

    private async runSubAgent(
        spec: { description: string; prompt: string; subagentType: string; model?: string; parentCtx: ToolContext },
        parentReq: RunRequest,
        emit: (d: AgentDelta) => void,
    ): Promise<string> {
        if (spec.parentCtx.depth >= MAX_SUBAGENT_DEPTH) {
            return 'Sub-agent depth limit reached; refusing to spawn deeper.';
        }
        // Conductor pattern: a worker can run on a DIFFERENT model than the
        // conductor. Prefixed/vendor models route via selectProvider; an Ollama
        // ":cloud" tag needs the cloud host, so recompute the routing flags.
        const worker = spec.model && spec.model !== parentReq.model
            ? { model: spec.model, ollamaCloud: /(?::|-)cloud\b/i.test(spec.model), ollamaLocal: false }
            : { model: parentReq.model, ollamaCloud: parentReq.ollamaCloud, ollamaLocal: parentReq.ollamaLocal };

        // Worker: isolated history, read/research-only tool set (safe to run
        // several concurrently - no shared shell, no writes).
        const childReq: RunRequest = {
            ...parentReq,
            model: worker.model,
            ollamaCloud: worker.ollamaCloud,
            ollamaLocal: worker.ollamaLocal,
            input: [{ type: 'text', text: spec.prompt }],
            tools: ['read_file', 'glob', 'grep', 'list_dir', 'web_search', 'web_fetch'],
            autoApprove: true,
            // Auto-approval must not become a hole: a worker canNOT read/write
            // outside the project root (would otherwise exfil ~/.ssh, /etc, ...).
            confineToRoot: true,
            depth: spec.parentCtx.depth + 1,
            mode: undefined, // workers report to the conductor, not the user - no plan/build framing
        };
        let finalText = '';
        const childEmit = (d: AgentDelta) => {
            // Keep the worker's text internal; surface status + token usage to the
            // conductor's stream, re-tagged with the PARENT runId.
            if (d.t === 'text') finalText += d.v;
            else if (d.t === 'status' || d.t === 'usage') emit({ ...d, runId: spec.parentCtx.runId });
        };
        emit({ t: 'status', runId: spec.parentCtx.runId, v: `> worker${spec.model ? ` (${worker.model})` : ''}: ${spec.description}` });
        await this.run(childReq, childEmit, [], spec.parentCtx.signal);
        return finalText || '(worker returned no text)';
    }

    private async buildSystemPrompt(req: RunRequest): Promise<string> {
        const preset = presetFor(req.surface);
        const [structure, memory, briefing, vibe] = await Promise.all([
            req.projectRoot ? projectSnapshot(req.projectRoot) : Promise.resolve(''),
            req.projectRoot && this.deps.getMemory ? this.deps.getMemory(req.projectRoot).catch(() => '') : Promise.resolve(''),
            this.deps.getBriefing ? this.deps.getBriefing().catch(() => '') : Promise.resolve(''),
            req.projectRoot && this.deps.getVibeInstructions ? this.deps.getVibeInstructions(req.projectRoot).catch(() => null) : Promise.resolve(null),
        ]);
        const base = preset.systemPrompt({
            projectRoot: req.projectRoot,
            projectStructure: structure,
            memory,
            briefing: briefing && briefing !== 'No project briefing available yet.' ? briefing : '',
            skillsIndex: this.deps.getSkillsIndex?.() || '',
            vibeInstructions: vibe,
            platform: process.platform,
            workerModels: req.availableModels,
        });
        const modeNote = req.mode === 'plan' ? PLAN_NOTE : req.mode === 'build' ? BUILD_NOTE : '';
        return modeNote ? `${base}\n\n${modeNote}` : base;
    }
}

function stripModel(model: string): string {
    if (model.startsWith('ollama:')) return model.slice('ollama:'.length);
    if (model.startsWith('openrouter:') || model.startsWith('hf:') || model.startsWith('anthropic:')) return model;
    return model;
}

function safe(fn: (i: unknown) => string, input: unknown): string {
    try { return fn(input); } catch { return ''; }
}

function estimateTokens(parts: MessagePart[]): number {
    let chars = 0;
    for (const p of parts) {
        if (p.type === 'text' || p.type === 'thinking') chars += p.text.length;
        else if (p.type === 'tool_result') chars += p.content.length;
        else if (p.type === 'tool_use') chars += JSON.stringify(p.input).length + p.name.length;
    }
    // Rough heuristic: ~4 chars per token for English/code text.
    return Math.ceil(chars / 4);
}

/**
 * Keep the conversation history inside the model's context budget by dropping the
 * oldest non-system turns while preserving the first user message and the most
 * recent assistant/tool exchange. This is a simple sliding window; long tool
 * outputs are the main driver of token growth.
 */
function trimHistory(messages: AgentMessage[], budgetTokens: number): void {
    // Reserve ~30% for the response + system + safety margin.
    const inputBudget = Math.floor(budgetTokens * 0.65);
    const systemIdx = messages.findIndex((m) => m.role === 'system');
    const system: AgentMessage | undefined = systemIdx >= 0 ? messages[systemIdx] : undefined;
    let current = system ? estimateTokens(system.parts) : 0;
    // Always keep the first user turn (the original request) so the agent does not
    // forget what it is supposed to do.
    const firstUserIdx = messages.findIndex((m) => m.role === 'user');
    if (firstUserIdx >= 0) current += estimateTokens(messages[firstUserIdx].parts);

    // Walk from newest to oldest, deciding which turns to retain.
    const keep = new Set<number>();
    if (systemIdx >= 0) keep.add(systemIdx);
    if (firstUserIdx >= 0) keep.add(firstUserIdx);

    for (let i = messages.length - 1; i >= 0; i--) {
        if (keep.has(i)) continue;
        const cost = estimateTokens(messages[i].parts);
        if (current + cost <= inputBudget) {
            keep.add(i);
            current += cost;
        }
    }

    const kept = messages.filter((_, i) => keep.has(i));
    // If nothing would be kept besides system/firstUser (e.g., budget too small),
    // keep the last assistant+tool pair so the loop can still proceed.
    if (kept.length <= (systemIdx >= 0 ? 1 : 0) + (firstUserIdx >= 0 ? 1 : 0) && messages.length > kept.length) {
        const last = messages[messages.length - 1];
        if (last && !keep.has(messages.length - 1)) {
            kept.push(last);
        }
    }
    messages.length = 0;
    messages.push(...kept);
}

/** Lightweight project structure snapshot (depth-limited, ignores heavy dirs). */
async function projectSnapshot(root: string, maxEntries = 140): Promise<string> {
    const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', '.venv', '.vibe', 'out']);
    const lines: string[] = [];
    async function walk(dir: string, depth: number, prefix: string) {
        if (lines.length >= maxEntries || depth > 3) return;
        let entries;
        try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
        entries.sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1));
        for (const e of entries) {
            if (lines.length >= maxEntries) return;
            if (IGNORE.has(e.name) || e.name.startsWith('.git')) continue;
            lines.push(prefix + e.name + (e.isDirectory() ? '/' : ''));
            if (e.isDirectory()) await walk(path.join(dir, e.name), depth + 1, prefix + '  ');
        }
    }
    await walk(root, 0, '');
    return lines.join('\n');
}
