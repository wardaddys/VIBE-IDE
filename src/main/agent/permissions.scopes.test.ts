/* Regression tests for the "allow for session / always allow re-prompts on
   every command" bug: allow rules must generalize to the tool, and session
   allows must survive across broker instances (one broker per run). */
import { describe, it, expect } from 'vitest';
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { PermissionBroker } from './permissions';
import type { PermissionRule } from '../../shared/agent';

const opts = (over: any) => ({
    runId: 'r', tool: 'x', tier: 'safe' as const, render: 'x', target: null, outsideRoot: false, input: {}, ...over,
});

describe('PermissionBroker scopes', () => {
    it('session allow covers the NEXT, different command of the same tool', async () => {
        const b = new PermissionBroker();
        await b.load(null);
        b.setEmitter((d) => { if (d.t === 'permission_req') b.resolve({ reqId: d.req.id, decision: 'allow', scope: 'session' }); });
        expect(await b.check(opts({ tool: 'bash', tier: 'exec', target: 'ls' }))).toBe('allow');

        let asked = false;
        b.setEmitter((d) => { if (d.t === 'permission_req') { asked = true; b.resolve({ reqId: d.req.id, decision: 'deny', scope: 'once' }); } });
        expect(await b.check(opts({ tool: 'bash', tier: 'exec', target: 'npm run build' }))).toBe('allow');
        expect(asked).toBe(false);
    });

    it('session allows survive across broker instances via the shared array', async () => {
        const shared: PermissionRule[] = [];
        const b1 = new PermissionBroker();
        b1.attachSessionAllows(shared);
        await b1.load(null);
        b1.setEmitter((d) => { if (d.t === 'permission_req') b1.resolve({ reqId: d.req.id, decision: 'allow', scope: 'session' }); });
        expect(await b1.check(opts({ tool: 'bash', tier: 'exec', target: 'ls' }))).toBe('allow');

        // Next run -> NEW broker (as the kernel does), same shared session store.
        const b2 = new PermissionBroker();
        b2.attachSessionAllows(shared);
        await b2.load(null);
        let asked = false;
        b2.setEmitter((d) => { if (d.t === 'permission_req') { asked = true; b2.resolve({ reqId: d.req.id, decision: 'deny', scope: 'once' }); } });
        expect(await b2.check(opts({ tool: 'bash', tier: 'exec', target: 'git status' }))).toBe('allow');
        expect(asked).toBe(false);
    });

    it('always allow persists tool-wide and applies to other targets after reload', async () => {
        const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'vibe-perm-'));
        try {
            const b1 = new PermissionBroker();
            await b1.load(root);
            b1.setEmitter((d) => { if (d.t === 'permission_req') b1.resolve({ reqId: d.req.id, decision: 'allow', scope: 'always' }); });
            expect(await b1.check(opts({ tool: 'write_file', tier: 'mutating', target: path.join(root, 'a.txt') }))).toBe('allow');

            const b2 = new PermissionBroker();
            await b2.load(root);
            let asked = false;
            b2.setEmitter((d) => { if (d.t === 'permission_req') { asked = true; b2.resolve({ reqId: d.req.id, decision: 'deny', scope: 'once' }); } });
            expect(await b2.check(opts({ tool: 'write_file', tier: 'mutating', target: path.join(root, 'b.txt') }))).toBe('allow');
            expect(asked).toBe(false);

            const saved = JSON.parse(await fsp.readFile(path.join(root, '.vibe', 'permissions.json'), 'utf-8'));
            expect(saved.rules[0].tool).toBe('write_file');
            expect(saved.rules[0].target).toBeUndefined();
        } finally {
            await fsp.rm(root, { recursive: true, force: true });
        }
    });

    it('deny rules stay target-scoped (no tool-wide bricking)', async () => {
        const b = new PermissionBroker();
        await b.load(null);
        b.setEmitter((d) => { if (d.t === 'permission_req') b.resolve({ reqId: d.req.id, decision: 'deny', scope: 'session' }); });
        expect(await b.check(opts({ tool: 'bash', tier: 'exec', target: 'rm -rf /' }))).toBe('deny');

        // A DIFFERENT command still asks (and here gets approved).
        let asked = false;
        b.setEmitter((d) => { if (d.t === 'permission_req') { asked = true; b.resolve({ reqId: d.req.id, decision: 'allow', scope: 'once' }); } });
        expect(await b.check(opts({ tool: 'bash', tier: 'exec', target: 'ls' }))).toBe('allow');
        expect(asked).toBe(true);
    });
});
