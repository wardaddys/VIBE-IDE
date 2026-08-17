import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CollectorAgent } from './collector';
import { ReviewerAgent } from './reviewer';

/* Regression tests for the background-agent lifecycle audit:
   start/stop must be idempotent, state must reset between projects, and
   .vibe artifacts must carry a schema version. */

describe('CollectorAgent lifecycle', () => {
    let root: string;
    let c: CollectorAgent;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-collector-'));
        c = new CollectorAgent();
    });
    afterEach(async () => {
        c.stop();
        await fs.promises.rm(root, { recursive: true, force: true });
    });

    it('start is idempotent for the same project (no duplicate watchers)', () => {
        c.start(root);
        const watchers = c.watchers.length;
        const health = c.healthInterval;
        const distill = c.distillInterval;
        c.start(root);
        expect(c.watchers.length).toBe(watchers);
        expect(c.healthInterval).toBe(health);
        expect(c.distillInterval).toBe(distill);
    });

    it('stop fully resets runtime state', () => {
        c.start(root);
        c.addEvent({ ts: Date.now(), type: 'file_changed', path: 'a.ts' });
        c.stop();
        expect(c.isRunning).toBe(false);
        expect(c.events).toEqual([]);
        expect(c.projectPath).toBeNull();
        expect(c.vibeDir).toBeNull();
        expect(c.watchers).toEqual([]);
        expect(c.healthInterval).toBeNull();
        expect(c.distillInterval).toBeNull();
        expect(c.lastEventTime).toBeNull();
    });

    it('switching projects leaves no watcher from the old one', () => {
        const other = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-collector-b-'));
        try {
            c.start(root);
            const first = c.watchers;
            c.start(other);
            expect(c.projectPath).toBe(other);
            expect(c.watchers).not.toBe(first);
            expect(c.watchers.every(w => !first.includes(w))).toBe(true);
        } finally {
            fs.rmSync(other, { recursive: true, force: true });
        }
    });

    it('health.json carries a schema version', async () => {
        c.start(root);
        await c.updateHealth();
        // The start() health run may still be in flight (git probes are async);
        // wait for the artifact to appear rather than racing it.
        const file = path.join(root, '.vibe', 'health.json');
        for (let i = 0; i < 60 && !fs.existsSync(file); i++) {
            await new Promise((res) => setTimeout(res, 50));
        }
        const health = JSON.parse(fs.readFileSync(file, 'utf8'));
        expect(health.version).toBe(1);
        expect(health.projectPath).toBe(root);
    });
});

describe('ReviewerAgent lifecycle', () => {
    let root: string;
    let r: ReviewerAgent;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-reviewer-'));
        r = new ReviewerAgent();
    });
    afterEach(async () => {
        r.stop();
        await fs.promises.rm(root, { recursive: true, force: true });
    });

    it('start is idempotent (no duplicate interval)', () => {
        r.start(root);
        const interval = r.reviewInterval;
        r.start(root);
        expect(r.reviewInterval).toBe(interval);
    });

    it('stop clears the interval and project binding', () => {
        r.start(root);
        r.stop();
        expect(r.isRunning).toBe(false);
        expect(r.reviewInterval).toBeNull();
        expect(r.projectPath).toBeNull();
    });

    it('stale briefings are returned with an honest label instead of vanishing', () => {
        r.projectPath = root;
        r.vibeDir = path.join(root, '.vibe');
        fs.mkdirSync(r.vibeDir, { recursive: true });
        fs.writeFileSync(path.join(r.vibeDir, 'briefing.json'), JSON.stringify({
            version: 1,
            generatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 h old
            content: 'The project is a desktop IDE.'
        }));
        const briefing = r.getBriefing();
        expect(briefing).toContain('stale');
        expect(briefing).toContain('desktop IDE');
    });

    it('fresh briefings come back as-is', () => {
        r.projectPath = root;
        r.vibeDir = path.join(root, '.vibe');
        fs.mkdirSync(r.vibeDir, { recursive: true });
        fs.writeFileSync(path.join(r.vibeDir, 'briefing.json'), JSON.stringify({
            version: 1,
            generatedAt: new Date().toISOString(),
            content: 'Fresh briefing.'
        }));
        expect(r.getBriefing()).toBe('Fresh briefing.');
    });
});
