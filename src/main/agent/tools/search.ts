/* =======================================================================
   Search tools: glob (filename patterns) and grep (content regex).
   Pure-Node implementation - no bundled ripgrep binary, so no asarUnpack
   packaging trap. Confined to the project root, skips heavy dirs.
   ======================================================================= */
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { Tool, ToolContext, ToolResult } from '../types';

const IGNORE = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', '__pycache__', '.venv', '.turbo', 'out']);
const MAX_FILES = 5000;
const MAX_MATCHES = 400;
const NUL = String.fromCharCode(0);

export function globToRegExp(glob: string): RegExp {
    // Translate a glob to a regex. ** = any dirs, * = any non-slash, ? = one char.
    let re = '';
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === '*') {
            if (glob[i + 1] === '*') { re += '.*'; i++; if (glob[i + 1] === '/') i++; }
            else re += '[^/]*';
        } else if (c === '?') re += '[^/]';
        else if ('+.^${}()|[]\\'.includes(c)) re += '\\' + c;
        else if (c === '/') re += '/';
        else re += c;
    }
    return new RegExp('^' + re + '$');
}

async function walk(dir: string, root: string, out: string[], onFile?: (p: string) => void): Promise<void> {
    if (out.length >= MAX_FILES) return;
    let entries;
    try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
        if (out.length >= MAX_FILES) return;
        if (IGNORE.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full, root, out, onFile);
        else if (e.isFile()) { out.push(full); onFile?.(full); }
    }
}

export const globTool: Tool<{ pattern: string; path?: string }> = {
    name: 'glob',
    description: 'Find files by glob pattern (e.g. "src/**/*.ts"). Returns matching paths, newest first.',
    tier: 'safe',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: 'Glob pattern, e.g. **/*.tsx' },
            path: { type: 'string', description: 'Base directory (defaults to project root).' },
        },
        required: ['pattern'],
    },
    render: (i) => `Glob ${i.pattern}`,
    async execute(input, ctx): Promise<ToolResult> {
        const base = ctx.resolvePath(input.path || ctx.projectRoot || '.');
        const files: string[] = [];
        await walk(base, base, files);
        const re = globToRegExp(input.pattern.replace(/^\.\//, ''));
        const matched: Array<{ p: string; m: number }> = [];
        for (const f of files) {
            const rel = path.relative(base, f).split(path.sep).join('/');
            if (re.test(rel) || re.test('/' + rel)) {
                let mtime = 0;
                try { mtime = (await fsp.stat(f)).mtimeMs; } catch { /* ignore */ }
                matched.push({ p: rel, m: mtime });
            }
        }
        matched.sort((a, b) => b.m - a.m);
        const list = matched.slice(0, MAX_MATCHES).map((x) => x.p);
        return { ok: true, content: list.join('\n') || '(no matches)', data: { count: matched.length } };
    },
};

export const grepTool: Tool<{ pattern: string; path?: string; glob?: string; ignoreCase?: boolean }> = {
    name: 'grep',
    description: 'Search file contents by regex. Returns file:line:match. Optional glob filter restricts which files are scanned.',
    tier: 'safe',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: {
            pattern: { type: 'string', description: 'Regular expression.' },
            path: { type: 'string', description: 'Base directory (defaults to project root).' },
            glob: { type: 'string', description: 'Restrict to files matching this glob.' },
            ignoreCase: { type: 'boolean' },
        },
        required: ['pattern'],
    },
    render: (i) => `Grep ${i.pattern}`,
    async execute(input, ctx): Promise<ToolResult> {
        const base = ctx.resolvePath(input.path || ctx.projectRoot || '.');
        let re: RegExp;
        try { re = new RegExp(input.pattern, input.ignoreCase ? 'i' : undefined); }
        catch (e: any) { return { ok: false, isError: true, content: `Bad regex: ${e.message}` }; }
        const fileRe = input.glob ? globToRegExp(input.glob) : null;

        const files: string[] = [];
        await walk(base, base, files);
        const results: string[] = [];
        let scanned = 0;
        for (const f of files) {
            if (results.length >= MAX_MATCHES) break;
            const rel = path.relative(base, f).split(path.sep).join('/');
            if (fileRe && !fileRe.test(rel)) continue;
            let content: string;
            try { content = await fsp.readFile(f, 'utf-8'); } catch { continue; }
            if (content.indexOf(NUL) !== -1) continue; // skip binaries
            scanned++;
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                if (re.test(lines[i])) {
                    results.push(`${rel}:${i + 1}:${lines[i].slice(0, 200)}`);
                    if (results.length >= MAX_MATCHES) break;
                }
            }
        }
        return {
            ok: true,
            content: results.join('\n') || '(no matches)',
            data: { matches: results.length, filesScanned: scanned },
        };
    },
};

export const searchTools: Tool[] = [globTool, grepTool];
