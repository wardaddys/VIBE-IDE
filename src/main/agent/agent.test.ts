import { describe, it, expect } from 'vitest';
import { isWithin, resolveWithinRoot, canonicalize } from './fsGuard';
import { globToRegExp } from './tools/search';
import { cronMatches } from './scheduler';
import { PermissionBroker } from './permissions';

describe('fsGuard', () => {
    it('confines paths within root and flags escapes', () => {
        const root = '/home/u/proj';
        expect(isWithin('/home/u/proj/src/a.ts', root)).toBe(true);
        expect(isWithin('/home/u/proj', root)).toBe(true);
        expect(isWithin('/home/u/other', root)).toBe(false);
        expect(isWithin('/etc/passwd', root)).toBe(false);
    });

    it('resolves relative paths against root and marks outside-root', () => {
        const root = '/home/u/proj';
        const inside = resolveWithinRoot('src/x.ts', root);
        expect(inside.outsideRoot).toBe(false);
        const outside = resolveWithinRoot('../secret.txt', root);
        expect(outside.outsideRoot).toBe(true);
    });

    it('canonicalizes .. segments', () => {
        expect(canonicalize('/a/b/../c', null)).toBe('/a/c');
    });
});

describe('globToRegExp', () => {
    it('matches ** across directories and * within a segment', () => {
        expect(globToRegExp('src/**/*.ts').test('src/a/b/c.ts')).toBe(true);
        expect(globToRegExp('src/**/*.ts').test('src/a.ts')).toBe(true);
        expect(globToRegExp('*.ts').test('a.ts')).toBe(true);
        expect(globToRegExp('*.ts').test('a/b.ts')).toBe(false);
        expect(globToRegExp('**/*.tsx').test('deep/nested/View.tsx')).toBe(true);
    });
});

describe('cronMatches', () => {
    it('matches a daily 6am schedule', () => {
        const d = new Date(2026, 0, 5, 6, 0, 0);
        expect(cronMatches('0 6 * * *', d)).toBe(true);
        expect(cronMatches('0 7 * * *', d)).toBe(false);
    });
    it('supports step syntax', () => {
        expect(cronMatches('*/15 * * * *', new Date(2026, 0, 1, 0, 30))).toBe(true);
        expect(cronMatches('*/15 * * * *', new Date(2026, 0, 1, 0, 31))).toBe(false);
    });
    it('supports day-of-week', () => {
        // 2026-01-05 is a Monday (dow=1)
        expect(cronMatches('0 9 * * 1', new Date(2026, 0, 5, 9, 0))).toBe(true);
        expect(cronMatches('0 9 * * 2', new Date(2026, 0, 5, 9, 0))).toBe(false);
    });
});

describe('PermissionBroker', () => {
    const opts = (over: any) => ({
        runId: 'r', tool: 'x', tier: 'safe' as const, render: 'x', target: null, outsideRoot: false, input: {}, ...over,
    });

    it('auto-allows safe tools', async () => {
        const b = new PermissionBroker();
        await b.load(null);
        expect(await b.check(opts({ tool: 'read_file', tier: 'safe' }))).toBe('allow');
    });

    it('asks for mutating tools, then honors the user decision', async () => {
        const b = new PermissionBroker();
        await b.load(null);
        let capturedReqId = '';
        b.setEmitter((d) => { if (d.t === 'permission_req') capturedReqId = d.req.id; });
        const p = b.check(opts({ tool: 'write_file', tier: 'mutating' }));
        // microtask: the req has been emitted
        await Promise.resolve();
        expect(capturedReqId).not.toBe('');
        b.resolve({ reqId: capturedReqId, decision: 'allow', scope: 'once' });
        expect(await p).toBe('allow');
    });

    it('remembers a session-scoped allow', async () => {
        const b = new PermissionBroker();
        await b.load(null);
        b.setEmitter((d) => { if (d.t === 'permission_req') b.resolve({ reqId: d.req.id, decision: 'allow', scope: 'session' }); });
        expect(await b.check(opts({ tool: 'bash', tier: 'exec', target: 'ls' }))).toBe('allow');
        // second call with same tool+target should not need a prompt (session rule)
        let asked = false;
        b.setEmitter((d) => { if (d.t === 'permission_req') { asked = true; b.resolve({ reqId: d.req.id, decision: 'deny', scope: 'once' }); } });
        expect(await b.check(opts({ tool: 'bash', tier: 'exec', target: 'ls' }))).toBe('allow');
        expect(asked).toBe(false);
    });

    it('forces a prompt for out-of-root targets even on safe tools', async () => {
        const b = new PermissionBroker();
        await b.load(null);
        let asked = false;
        b.setEmitter((d) => { if (d.t === 'permission_req') { asked = true; b.resolve({ reqId: d.req.id, decision: 'deny', scope: 'once' }); } });
        const res = await b.check(opts({ tool: 'read_file', tier: 'safe', outsideRoot: true, target: '/etc/passwd' }));
        expect(asked).toBe(true);
        expect(res).toBe('deny');
    });
});
