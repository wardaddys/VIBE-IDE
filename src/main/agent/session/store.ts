/* =======================================================================
   SessionStore - thread + message persistence as JSONL (zero native deps).
   Design note: start JSONL; migrate to SQLite when history search gets slow.
   ======================================================================= */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AgentMessage, ProjectRecord, SessionRecord, Surface } from '../../../shared/agent';

export class SessionStore {
    private indexPath: string;
    private dir: string;
    private index: SessionRecord[] = [];
    private loaded = false;

    constructor(baseDir: string) {
        this.dir = path.join(baseDir, 'sessions');
        this.indexPath = path.join(this.dir, 'index.json');
    }

    private async ensure() {
        if (this.loaded) return;
        await fsp.mkdir(this.dir, { recursive: true }).catch(() => {});
        try { this.index = JSON.parse(await fsp.readFile(this.indexPath, 'utf-8')); } catch { this.index = []; }
        this.loaded = true;
    }

    private async saveIndex() {
        await fsp.writeFile(this.indexPath, JSON.stringify(this.index, null, 2)).catch(() => {});
    }

    async create(opts: { surface: Surface; title?: string; projectRoot: string | null; model: string }): Promise<SessionRecord> {
        await this.ensure();
        const now = new Date().toISOString();
        const rec: SessionRecord = {
            id: randomUUID(),
            surface: opts.surface,
            title: opts.title || 'New session',
            projectRoot: opts.projectRoot,
            model: opts.model,
            createdAt: now,
            updatedAt: now,
        };
        this.index.unshift(rec);
        await this.saveIndex();
        return rec;
    }

    async list(surface?: Surface): Promise<SessionRecord[]> {
        await this.ensure();
        return surface ? this.index.filter((s) => s.surface === surface) : this.index;
    }

    /** Group sessions by project root, sorted by most-recently updated project first.
     *  Each project's sessions are sorted by updatedAt desc. */
    async listByProject(surface?: Surface): Promise<ProjectRecord[]> {
        await this.ensure();
        const source = surface ? this.index.filter((s) => s.surface === surface) : this.index;
        const groups = new Map<string | null, SessionRecord[]>();
        for (const rec of source) {
            const key = rec.projectRoot ?? null;
            const list = groups.get(key) || [];
            list.push(rec);
            groups.set(key, list);
        }
        const out: ProjectRecord[] = [];
        for (const [root, sessions] of groups) {
            sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            out.push({
                root,
                name: root ? root.split(/[/\\]/).filter(Boolean).pop() || root : 'No project',
                sessions,
                updatedAt: sessions[0]?.updatedAt || new Date(0).toISOString(),
            });
        }
        out.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        return out;
    }

    async get(id: string): Promise<SessionRecord | null> {
        await this.ensure();
        return this.index.find((s) => s.id === id) ?? null;
    }

    async rename(id: string, title: string) {
        await this.ensure();
        const rec = this.index.find((s) => s.id === id);
        if (rec) { rec.title = title; rec.updatedAt = new Date().toISOString(); await this.saveIndex(); }
    }

    async remove(id: string) {
        await this.ensure();
        this.index = this.index.filter((s) => s.id !== id);
        await this.saveIndex();
        await fsp.rm(path.join(this.dir, `${id}.json`), { force: true }).catch(() => {});
    }

    /** Overwrite the full message log for a session (kernel passes the complete list). */
    async saveMessages(id: string, messages: AgentMessage[]) {
        await this.ensure();
        await fsp.writeFile(path.join(this.dir, `${id}.json`), JSON.stringify(messages)).catch(() => {});
        const rec = this.index.find((s) => s.id === id);
        if (rec) { rec.updatedAt = new Date().toISOString(); await this.saveIndex(); }
    }

    /** Drop the last user turn and everything after it; return that user's text. */
    async rewind(id: string): Promise<{ text: string }> {
        const msgs = await this.getMessages(id);
        let idx = -1;
        for (let i = msgs.length - 1; i >= 0; i--) { if (msgs[i].role === 'user') { idx = i; break; } }
        if (idx === -1) return { text: '' };
        const lastUser = msgs[idx];
        const kept = msgs.slice(0, idx);
        await this.saveMessages(id, kept);
        const text = lastUser.parts.filter((p) => p.type === 'text').map((p: any) => p.text).join('');
        return { text };
    }

    async getMessages(id: string): Promise<AgentMessage[]> {
        await this.ensure();
        try { return JSON.parse(await fsp.readFile(path.join(this.dir, `${id}.json`), 'utf-8')); }
        catch { return []; }
    }
}
