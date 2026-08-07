import { uiBus } from './uiBus';
import { useUIStore } from '../store/ui';
import { useSettingsStore } from '../store/settings';
import { useAgentRunStore } from '../store/agentRun';

export interface SlashCtx {
    fill: (text: string) => void;     // put text in composer + focus (for commands needing an argument)
    send: (text: string) => void;     // run immediately
    openModel: () => void;
    note: (markdown: string) => void; // push an assistant-style info message
}

export interface SlashCommand { cmd: string; desc: string; group: string; run: (c: SlashCtx) => void | Promise<void>; }

const P = (t: string) => (c: SlashCtx) => c.send(t);           // prompt, auto-run
const F = (t: string) => (c: SlashCtx) => c.fill(t);           // prompt needing an argument

export const SLASH_COMMANDS: SlashCommand[] = [
    // ---- Actions ----
    { cmd: '/model', desc: 'Switch model', group: 'Actions', run: (c) => c.openModel() },
    { cmd: '/clear', desc: 'Start a new chat', group: 'Actions', run: () => uiBus.emit({ t: 'newChat' }) },
    { cmd: '/settings', desc: 'Open settings', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings' }) },
    { cmd: '/skills', desc: 'Manage skills', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings', section: 'skills' }) },
    { cmd: '/connectors', desc: 'Manage MCP connectors', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings', section: 'connectors' }) },
    { cmd: '/mcp', desc: 'Manage MCP connectors', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings', section: 'connectors' }) },
    { cmd: '/keys', desc: 'API keys', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings', section: 'providers' }) },
    { cmd: '/schedule', desc: 'Scheduled tasks', group: 'Actions', run: () => uiBus.emit({ t: 'openSchedule' }) },
    { cmd: '/projects', desc: 'Project settings + instructions', group: 'Actions', run: () => uiBus.emit({ t: 'openProjects' }) },
    { cmd: '/memory', desc: 'Edit project instructions (VIBE.md)', group: 'Actions', run: () => uiBus.emit({ t: 'openProjects' }) },
    { cmd: '/workspace', desc: 'Toggle editor + terminal', group: 'Actions', run: () => uiBus.emit({ t: 'toggleWorkspace' }) },
    { cmd: '/palette', desc: 'Command palette', group: 'Actions', run: () => uiBus.emit({ t: 'openPalette' }) },

    // ---- Agent modes ----
    { cmd: '/goal', desc: 'Autonomous mode: don\'t stop until done', group: 'Tasks', run: F('Work autonomously until this is fully complete. Do not stop to ask questions — make reasonable decisions, handle edge cases, run the build/tests, and verify before finishing. Task: ') },
    { cmd: '/grill-me', desc: 'Interview me before building', group: 'Tasks', run: F('Before writing any code, interview me to pin down requirements. Ask a structured series of pointed questions covering scope (v1 vs later), users, tech choices, edge cases, and design preferences. Ask them, then wait for my answers. What I want to build: ') },
    { cmd: '/learn', desc: 'Save a rule to VIBE.md forever', group: 'Tasks', run: F('Append the following as a permanent project rule to VIBE.md (create the file if missing, preserve existing content): ') },

    // ---- Coding tasks (run the agent) ----
    { cmd: '/init', desc: 'Analyze the project and write VIBE.md', group: 'Tasks', run: P('Analyze this entire project and write a VIBE.md at the project root documenting: the build, run, and test commands; the architecture and key modules and how they connect; coding conventions; and anything a new contributor must know. Read the important files first, then write VIBE.md.') },
    { cmd: '/explain', desc: 'Explain how this codebase works', group: 'Tasks', run: P('Explain how this codebase works: the entry points, the overall architecture, and the main modules and how they connect. Read the key files first, then give a clear walkthrough.') },
    { cmd: '/review', desc: 'Review the code for issues', group: 'Tasks', run: P('Review this project for bugs, security issues, and performance problems. Inspect the code, then give a prioritized list with file:line references and concrete fixes.') },
    { cmd: '/fix', desc: 'Find and fix bugs; run tests', group: 'Tasks', run: P('Find bugs and errors in this project. Run the build and tests, read the failures, fix them, and verify by re-running until green.') },
    { cmd: '/test', desc: 'Write and run tests', group: 'Tasks', run: P('Write meaningful tests for the most important untested code in this project, then run them and make them pass.') },
    { cmd: '/docs', desc: 'Write/update the README', group: 'Tasks', run: P('Write or update the README for this project so a new user can install, configure, and use it. Base every claim on the actual code.') },
    { cmd: '/commit', desc: 'Stage + commit current changes', group: 'Tasks', run: P('Run git status and git diff, then stage the changes and create a git commit with a clear, conventional commit message that summarizes what changed.') },
    { cmd: '/pr', desc: 'Draft a PR description from the diff', group: 'Tasks', run: P('Run git diff against the default branch and summarize it as a pull request description: a title, a short summary, and a bullet list of the notable changes.') },
    { cmd: '/security', desc: 'Security review', group: 'Tasks', run: P('Do a security review of this codebase: injection, auth, secret handling, unsafe file/exec, and dependency risks. Report findings with severity and concrete fixes.') },
    { cmd: '/optimize', desc: 'Find and optimize hot paths', group: 'Tasks', run: P('Find the performance hot paths in this project. Reason about or measure their cost, make the optimization, and verify behavior is unchanged by running the tests.') },
    { cmd: '/summarize', desc: 'Summarize this conversation', group: 'Tasks', run: P('Summarize our conversation so far into a concise brief with the key decisions and next steps.') },
    { cmd: '/refactor', desc: 'Refactor a target (type it)', group: 'Tasks', run: F('Refactor the following for clarity and maintainability without changing behavior, then run the tests: ') },
    { cmd: '/plan', desc: 'Plan a task (type it)', group: 'Tasks', run: F('Make a concrete, step-by-step implementation plan for: ') },
    { cmd: '/web', desc: 'Web search (type a query)', group: 'Tasks', run: F('Search the web and answer, citing sources: ') },

    // ---- Diagnostics ----
    { cmd: '/doctor', desc: 'Check environment + config', group: 'Info', run: async (c) => {
        const ui = useUIStore.getState();
        const keys = useSettingsStore.getState().apiKeys as Record<string, string>;
        const setKeys = Object.entries(keys).filter(([, v]) => v).map(([k]) => k);
        let mcp = 0, skills = 0;
        try { const cfg = await window.vibe.kernel.mcpGetConfig(); mcp = Object.keys(cfg.mcpServers || {}).length; } catch {}
        try { skills = (await window.vibe.kernel.skillsList()).length; } catch {}
        c.note([
            '## VIBE doctor',
            `- **Ollama**: ${ui.ollamaConnected ? 'connected' : 'not detected (run `ollama serve`)'}`,
            `- **Project**: ${ui.projectPath || 'none open'}`,
            `- **API keys set**: ${setKeys.length ? setKeys.join(', ') : 'none'}`,
            `- **Ollama Cloud key**: ${keys.ollama ? 'set' : 'missing (needed for cloud models + web search)'}`,
            `- **MCP connectors**: ${mcp}`,
            `- **Skills installed**: ${skills}`,
        ].join('\n'));
    } },
    { cmd: '/help', desc: 'List commands', group: 'Info', run: (c) => {
        const lines = SLASH_COMMANDS.filter((x) => x.cmd !== '/help').map((x) => `- \`${x.cmd}\` — ${x.desc}`);
        c.note('## Slash commands\n' + lines.join('\n'));
    } },
];
