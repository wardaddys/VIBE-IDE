import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { appendCommandLog } from './commandLog';

describe('commandLog', () => {
    let root: string;

    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'vibe-cmdlog-'));
    });

    afterEach(() => {
        fs.rmSync(root, { recursive: true, force: true });
    });

    it('writes a markdown log with command, cwd and output', () => {
        appendCommandLog(root, {
            command: 'npm test',
            output: 'Tests passed',
            status: 'ok',
            cwd: root,
            at: new Date().toISOString(),
            surface: 'cowork',
        });
        const file = path.join(root, '.vibe', 'commands.md');
        expect(fs.existsSync(file)).toBe(true);
        const text = fs.readFileSync(file, 'utf-8');
        expect(text).toContain('# Command history');
        expect(text).toContain('npm test');
        expect(text).toContain('Tests passed');
        expect(text).toContain(`cwd: ${root}`);
        expect(text).toContain('cowork');
    });
});
