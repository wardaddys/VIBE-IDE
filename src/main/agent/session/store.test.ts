/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { SessionStore } from './store';

describe('SessionStore.listByProject', () => {
    let tmp: string;
    let store: SessionStore;

    beforeEach(async () => {
        tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-session-store-'));
        store = new SessionStore(tmp);
    });

    afterEach(async () => {
        await fs.rm(tmp, { recursive: true, force: true });
    });

    it('groups sessions by project root sorted by latest project first', async () => {
        const a = await store.create({ surface: 'cowork', projectRoot: '/home/user/app', model: 'm1' });
        const b = await store.create({ surface: 'cowork', projectRoot: '/home/user/app', model: 'm1' });
        const c = await store.create({ surface: 'cowork', projectRoot: '/home/user/web', model: 'm1' });

        // Touch updatedAt ordering: b latest, then a, then c.
        await new Promise((r) => setTimeout(r, 15));
        await store.saveMessages(a.id, [{ role: 'user', parts: [{ type: 'text', text: 'x' }] }]);
        await new Promise((r) => setTimeout(r, 15));
        await store.saveMessages(b.id, [{ role: 'user', parts: [{ type: 'text', text: 'y' }] }]);

        const projects = await store.listByProject('cowork');
        expect(projects).toHaveLength(2);
        expect(projects[0].root).toBe('/home/user/app');
        expect(projects[0].name).toBe('app');
        expect(projects[0].sessions.map((s) => s.id)).toEqual([b.id, a.id]);
        expect(projects[1].root).toBe('/home/user/web');
    });

    it('filters by surface', async () => {
        await store.create({ surface: 'chat', projectRoot: '/p1', model: 'm1' });
        await store.create({ surface: 'cowork', projectRoot: '/p2', model: 'm1' });
        const projects = await store.listByProject('cowork');
        expect(projects).toHaveLength(1);
        expect(projects[0].root).toBe('/p2');
    });

    it('buckets null project roots under "No project"', async () => {
        const s = await store.create({ surface: 'cowork', projectRoot: null, model: 'm1' });
        const projects = await store.listByProject('cowork');
        expect(projects).toHaveLength(1);
        expect(projects[0].root).toBeNull();
        expect(projects[0].name).toBe('No project');
        expect(projects[0].sessions.map((x) => x.id)).toEqual([s.id]);
    });
});
