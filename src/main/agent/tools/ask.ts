/* =======================================================================
   ask_user tool - blocking multiple-choice questions to the user.
   The tool emits an `ask_user` delta, parks the run on a promise, and the
   renderer resolves it over IPC (kernel:answer). Cancellation aborts the
   wait via the run's AbortSignal so a cancelled run can never hang here.
   ======================================================================= */
import { randomUUID } from 'node:crypto';
import type { Tool, ToolContext, ToolResult } from '../types';
import type { UserQuestion, UserQuestionRequest } from '../../../shared/agent';

interface PendingAsk {
    resolve: (answers: Record<string, string[]> | null) => void;
    runId: string;
}

const pending = new Map<string, PendingAsk>();

/** Called from IPC when the user submits their selections. */
export function resolveAsk(reqId: string, answers: Record<string, string[]>): boolean {
    const p = pending.get(reqId);
    if (!p) return false;
    pending.delete(reqId);
    p.resolve(answers || {});
    return true;
}

interface AskInputQuestion {
    question: string;
    options: Array<string | { label: string; description?: string }>;
    multi?: boolean;
}

export const askUserTool: Tool<{ questions: AskInputQuestion[] }> = {
    name: 'ask_user',
    description: 'Ask the user 1-4 multiple-choice questions and WAIT for their selections. Use only when a decision is genuinely the user\'s to make (scope, direction, preference between valid options) - not for confirmations of work you can already do. Each question needs 2-6 short option labels; set multi=true to allow several selections.',
    tier: 'safe',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: {
            questions: {
                type: 'array',
                description: '1-4 questions, each with 2-6 options.',
                items: {
                    type: 'object',
                    properties: {
                        question: { type: 'string', description: 'The full question text.' },
                        options: { type: 'array', items: { type: 'string' }, description: 'Short option labels.' },
                        multi: { type: 'boolean', description: 'Allow selecting more than one option.' },
                    },
                    required: ['question', 'options'],
                },
            },
        },
        required: ['questions'],
    },
    render: (i) => {
        const n = i.questions?.length ?? 0;
        return `Ask: ${i.questions?.[0]?.question ?? 'user input'}${n > 1 ? `  (+${n - 1} more)` : ''}`;
    },
    async execute(input, ctx: ToolContext): Promise<ToolResult> {
        const questions: UserQuestion[] = (input.questions || [])
            .slice(0, 4)
            .map((q) => ({
                question: String(q.question || '').slice(0, 300),
                options: (q.options || []).slice(0, 6).map((o) =>
                    typeof o === 'string'
                        ? { label: o.slice(0, 80) }
                        : { label: String(o.label ?? '').slice(0, 80), description: o.description ? String(o.description).slice(0, 200) : undefined }),
                multi: !!q.multi,
            }))
            .filter((q) => q.question && q.options.length >= 2);
        if (questions.length === 0) {
            return { ok: false, isError: true, content: 'ask_user needs at least one question with 2+ options.' };
        }

        const req: UserQuestionRequest = { id: randomUUID(), runId: ctx.runId, questions };
        const answers = await new Promise<Record<string, string[]> | null>((resolve) => {
            pending.set(req.id, { resolve, runId: ctx.runId });
            const onAbort = () => { pending.delete(req.id); resolve(null); };
            ctx.signal.addEventListener('abort', onAbort, { once: true });
            ctx.emit({ t: 'ask_user', runId: ctx.runId, req });
        });

        if (answers === null) {
            return { ok: false, isError: true, content: 'The user did not answer (run cancelled).' };
        }
        ctx.emit({ t: 'ask_user_resolved', runId: ctx.runId, reqId: req.id, answers });
        const lines = questions.map((q) => {
            const sel = answers[q.question] || [];
            return `Q: ${q.question}\nA: ${sel.length ? sel.join(', ') : '(nothing selected)'}`;
        });
        return { ok: true, content: lines.join('\n\n') };
    },
};

export const askTools: Tool[] = [askUserTool];
