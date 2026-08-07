/* =======================================================================
   Filesystem tools: read_file, write_file, edit_file, list_dir.
   Real, in-process, canonical-path-guarded. No terminal scraping.

   Design rules enforced here:
   - write_file refuses to clobber a file not read this session (blind-write
     guard, Claude-Code style).
   - edit_file requires a UNIQUE old_string match or it fails loudly.
   - read_file returns line-numbered content so edits can target precisely.
   ======================================================================= */
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from '../types';

const MAX_READ_BYTES = 400_000;

/** Per-session record of files that were read (enables the blind-write guard). */
const readCache = new Map<string, Set<string>>();
function markRead(sessionId: string, p: string) {
    let s = readCache.get(sessionId);
    if (!s) { s = new Set(); readCache.set(sessionId, s); }
    s.add(p);
}
function wasRead(sessionId: string, p: string): boolean {
    return readCache.get(sessionId)?.has(p) ?? false;
}

function numberLines(text: string, start = 1): string {
    const lines = text.split('\n');
    const width = String(start + lines.length - 1).length;
    return lines.map((l, i) => `${String(start + i).padStart(width, ' ')}\t${l}`).join('\n');
}

export const readFileTool: Tool<{ path: string; offset?: number; limit?: number }> = {
    name: 'read_file',
    description: 'Read a text file from the project. Returns line-numbered content. Use offset/limit (1-based line numbers) for large files.',
    tier: 'safe',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'File path, relative to project root or absolute.' },
            offset: { type: 'number', description: 'First line to read (1-based).' },
            limit: { type: 'number', description: 'Max number of lines to read.' },
        },
        required: ['path'],
    },
    render: (i) => `Read ${i.path}`,
    async execute(input, ctx): Promise<ToolResult> {
        const { resolved } = { resolved: ctx.resolvePath(input.path) };
        const stat = await fsp.stat(resolved).catch(() => null);
        if (!stat) return { ok: false, isError: true, content: `File not found: ${input.path}` };
        if (stat.size > MAX_READ_BYTES && !input.limit) {
            return { ok: false, isError: true, content: `File is ${stat.size} bytes; too large. Re-call with a limit (lines).` };
        }
        const raw = await fsp.readFile(resolved, 'utf-8');
        markRead(ctx.sessionId, resolved);
        const allLines = raw.split('\n');
        const start = Math.max(1, input.offset ?? 1);
        const end = input.limit ? start + input.limit - 1 : allLines.length;
        const slice = allLines.slice(start - 1, end).join('\n');
        const numbered = numberLines(slice, start);
        return { ok: true, content: numbered, data: { path: resolved, totalLines: allLines.length } };
    },
};

export const writeFileTool: Tool<{ path: string; content: string }> = {
    name: 'write_file',
    description: 'Create or overwrite a file with complete content. To modify an existing file you must read it first this session.',
    tier: 'mutating',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: {
            path: { type: 'string', description: 'Destination path.' },
            content: { type: 'string', description: 'Full file content.' },
        },
        required: ['path', 'content'],
    },
    render: (i) => `Write ${i.path}`,
    async execute(input, ctx): Promise<ToolResult> {
        const resolved = ctx.resolvePath(input.path);
        const exists = await fsp.stat(resolved).then(() => true).catch(() => false);
        if (exists && !wasRead(ctx.sessionId, resolved)) {
            return {
                ok: false, isError: true,
                content: `Refusing to overwrite existing file without reading it first: ${input.path}. Call read_file on it, then retry.`,
            };
        }
        await fsp.mkdir(path.dirname(resolved), { recursive: true });
        await fsp.writeFile(resolved, input.content, 'utf-8');
        markRead(ctx.sessionId, resolved); // now safe to edit further
        const lines = input.content.split('\n').length;
        return { ok: true, content: `Wrote ${input.path} (${lines} lines).`, data: { path: resolved, action: exists ? 'overwrite' : 'create' } };
    },
};

export const editFileTool: Tool<{ path: string; old_string: string; new_string: string; replace_all?: boolean }> = {
    name: 'edit_file',
    description: 'Replace an exact string in a file. old_string must be unique unless replace_all is true. Read the file first.',
    tier: 'mutating',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: {
            path: { type: 'string' },
            old_string: { type: 'string', description: 'Exact text to replace (include enough context to be unique).' },
            new_string: { type: 'string', description: 'Replacement text.' },
            replace_all: { type: 'boolean', description: 'Replace every occurrence.' },
        },
        required: ['path', 'old_string', 'new_string'],
    },
    render: (i) => `Edit ${i.path}`,
    async execute(input, ctx): Promise<ToolResult> {
        const resolved = ctx.resolvePath(input.path);
        const raw = await fsp.readFile(resolved, 'utf-8').catch(() => null);
        if (raw == null) return { ok: false, isError: true, content: `File not found: ${input.path}` };
        if (input.old_string === input.new_string) {
            return { ok: false, isError: true, content: 'old_string and new_string are identical.' };
        }
        const count = raw.split(input.old_string).length - 1;
        if (count === 0) return { ok: false, isError: true, content: `old_string not found in ${input.path}.` };
        if (count > 1 && !input.replace_all) {
            return { ok: false, isError: true, content: `old_string is not unique (${count} matches). Add context or set replace_all.` };
        }
        const updated = input.replace_all
            ? raw.split(input.old_string).join(input.new_string)
            : raw.replace(input.old_string, input.new_string);
        await fsp.writeFile(resolved, updated, 'utf-8');
        const diff = miniDiff(input.old_string, input.new_string);
        return {
            ok: true,
            content: `Edited ${input.path} (${input.replace_all ? count : 1} replacement${(input.replace_all ? count : 1) > 1 ? 's' : ''}).`,
            data: { path: resolved, diff },
        };
    },
};

export const listDirTool: Tool<{ path?: string }> = {
    name: 'list_dir',
    description: 'List files and directories at a path (non-recursive).',
    tier: 'safe',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'Directory (defaults to project root).' } },
    },
    render: (i) => `List ${i.path || '.'}`,
    async execute(input, ctx): Promise<ToolResult> {
        const target = ctx.resolvePath(input.path || ctx.projectRoot || '.');
        const entries = await fsp.readdir(target, { withFileTypes: true }).catch(() => null);
        if (!entries) return { ok: false, isError: true, content: `Cannot list: ${input.path}` };
        const lines = entries
            .filter((e) => !e.name.startsWith('.git') && e.name !== 'node_modules')
            .sort((a, b) => (a.isDirectory() === b.isDirectory() ? a.name.localeCompare(b.name) : a.isDirectory() ? -1 : 1))
            .map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
        return { ok: true, content: lines.join('\n') || '(empty)', data: { count: lines.length } };
    },
};

function miniDiff(oldStr: string, newStr: string): string {
    const o = oldStr.split('\n');
    const n = newStr.split('\n');
    const out: string[] = [];
    o.forEach((l) => out.push(`- ${l}`));
    n.forEach((l) => out.push(`+ ${l}`));
    return out.slice(0, 40).join('\n');
}

export function clearReadCache(sessionId: string) {
    readCache.delete(sessionId);
}

export const fsTools: Tool[] = [readFileTool, writeFileTool, editFileTool, listDirTool];
