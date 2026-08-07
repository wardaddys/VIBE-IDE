/* use_skill - inject a skill's instructions on demand (progressive disclosure). */
import type { Tool, ToolContext, ToolResult } from '../types';

export const useSkillTool: Tool<{ name: string }> = {
    name: 'use_skill',
    description: 'Load a skill by name to get its full instructions and bundled scripts. Skills are listed in the system context.',
    tier: 'safe',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: { name: { type: 'string', description: 'Skill name to load.' } },
        required: ['name'],
    },
    render: (i) => `Use skill: ${i.name}`,
    async execute(input, ctx: ToolContext): Promise<ToolResult> {
        if (!ctx.loadSkill) return { ok: false, isError: true, content: 'Skills are not available in this context.' };
        const body = await ctx.loadSkill(input.name);
        return { ok: true, content: body };
    },
};

export const skillTools: Tool[] = [useSkillTool];
