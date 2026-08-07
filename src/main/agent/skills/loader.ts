/* =======================================================================
   SkillLoader - discovers SKILL.md folders and implements progressive
   disclosure: only (name, description) sit in context until a skill is
   invoked, at which point its full body is injected.
   ======================================================================= */
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { SkillMeta } from '../../../shared/agent';

/** Parse the minimal YAML frontmatter of a SKILL.md (no YAML dependency). */
function parseFrontmatter(md: string): { meta: Record<string, string>; body: string } {
    const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
    if (!m) return { meta: {}, body: md };
    const meta: Record<string, string> = {};
    for (const line of m[1].split('\n')) {
        const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
        if (kv) meta[kv[1].trim().toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, '');
    }
    return { meta, body: m[2] };
}

export class SkillLoader {
    private skills = new Map<string, SkillMeta>();

    constructor(private dirs: string[]) {}

    async scan(extraDirs: string[] = []): Promise<void> {
        this.skills.clear();
        const roots = [...this.dirs, ...extraDirs];
        for (const root of roots) {
            let entries;
            try { entries = await fsp.readdir(root, { withFileTypes: true }); } catch { continue; }
            for (const e of entries) {
                if (!e.isDirectory()) continue;
                const skillMd = path.join(root, e.name, 'SKILL.md');
                let raw: string;
                try { raw = await fsp.readFile(skillMd, 'utf-8'); } catch { continue; }
                const { meta } = parseFrontmatter(raw);
                const name = meta.name || e.name;
                this.skills.set(name, {
                    name,
                    description: meta.description || '',
                    path: path.join(root, e.name),
                    allowedTools: meta['allowed-tools'] ? meta['allowed-tools'].split(',').map((s) => s.trim()) : undefined,
                });
            }
        }
    }

    /** Cheap index for the system preamble (progressive disclosure). */
    index(): string {
        if (this.skills.size === 0) return '';
        return [...this.skills.values()].map((s) => `- ${s.name}: ${s.description}`).join('\n');
    }

    list(): SkillMeta[] { return [...this.skills.values()]; }

    /** Load a skill's full body for injection when invoked. */
    async load(name: string): Promise<string> {
        const s = this.skills.get(name);
        if (!s) return `Skill "${name}" not found. Available: ${[...this.skills.keys()].join(', ') || '(none)'}`;
        try {
            const raw = await fsp.readFile(path.join(s.path, 'SKILL.md'), 'utf-8');
            const { body } = parseFrontmatter(raw);
            let out = `SKILL: ${s.name}\nLOCATION: ${s.path}\n\n${body.trim()}`;
            // List bundled scripts/resources so the model knows what it can run.
            const files = await fsp.readdir(s.path).catch(() => [] as string[]);
            const extras = files.filter((f) => f !== 'SKILL.md');
            if (extras.length) out += `\n\nBUNDLED FILES (run via bash using LOCATION):\n${extras.map((f) => `- ${f}`).join('\n')}`;
            return out;
        } catch (e: any) {
            return `Failed to load skill "${name}": ${e?.message || String(e)}`;
        }
    }
}
