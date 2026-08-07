/* =======================================================================
   task tool - spawn a sub-agent (worker) with isolated context and a
   read-biased tool set. Only the worker's final text crosses back to the
   conductor. Depth and tool restrictions are enforced by the kernel
   (max depth 2, read/research only - no write/bash).

   Conductor pattern: the parent model can dispatch a sub-task to a specific
   WORKER MODEL via `model`, and firing several task calls in ONE turn runs
   the workers CONCURRENTLY.
   ======================================================================= */
import type { Tool, ToolContext, ToolResult } from '../types';

export const taskTool: Tool<{ description: string; prompt: string; subagent_type?: string; model?: string }> = {
    name: 'task',
    description: 'Delegate a self-contained sub-task to a fresh worker sub-agent (isolated context, read/research-only). Use for broad codebase exploration or parallel research so the main thread stays focused. Pass `model` to run this worker on a specific model; omit it to use your own. Issue SEVERAL task calls in one turn to run workers concurrently, then synthesize their summaries yourself. Returns the worker\'s summary.',
    tier: 'safe',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: {
            description: { type: 'string', description: 'Short (3-5 word) task label.' },
            prompt: { type: 'string', description: 'Full, self-contained instructions for the worker.' },
            subagent_type: { type: 'string', description: 'Optional agent preset (default: explore).' },
            model: { type: 'string', description: 'Optional worker model to run this sub-task on. Omit to inherit the conductor model.' },
        },
        required: ['description', 'prompt'],
    },
    render: (i) => `Sub-agent${i.model ? ` (${i.model})` : ''}: ${i.description}`,
    async execute(input, ctx: ToolContext): Promise<ToolResult> {
        if (!ctx.runSubAgent) {
            return { ok: false, isError: true, content: 'Sub-agents are not available in this context.' };
        }
        const text = await ctx.runSubAgent({
            description: input.description,
            prompt: input.prompt,
            subagentType: input.subagent_type || 'explore',
            model: input.model,
            parentCtx: ctx,
        });
        return { ok: true, content: text };
    },
};

export const taskTools: Tool[] = [taskTool];
