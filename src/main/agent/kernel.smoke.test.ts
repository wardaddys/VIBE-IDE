import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

// Stub Ollama /api/chat: turn 1 -> emit a write_file tool call; turn 2 (after the
// tool result comes back) -> emit a final text message. Exercises the REAL native
// adapter + kernel loop + permission broker + fs tool + a real file write.
let server: http.Server;
let baseUrl = '';
let capturedToolName: string | undefined = 'UNSET';

beforeAll(async () => {
    server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => (body += c));
        req.on('end', () => {
            const parsed = JSON.parse(body || '{}');
            const msgs = parsed.messages || [];
            const lastRole = msgs[msgs.length - 1]?.role;
            if (lastRole === 'tool') capturedToolName = msgs[msgs.length - 1]?.tool_name;
            res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
            if (lastRole === 'tool') {
                res.write(JSON.stringify({ message: { role: 'assistant', content: 'Done. Wrote the file.' }, done: false }) + '\n');
                res.write(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
            } else {
                res.write(JSON.stringify({
                    message: { role: 'assistant', content: '', tool_calls: [
                        { function: { name: 'write_file', arguments: { path: 'smoke.txt', content: 'hello from the VIBE kernel' } } },
                    ] }, done: false,
                }) + '\n');
                res.write(JSON.stringify({ message: { content: '' }, done: true }) + '\n');
            }
            res.end();
        });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
    process.env.OLLAMA_HOST = baseUrl;
});

afterAll(() => new Promise<void>((r) => server.close(() => r())));

describe('kernel end-to-end (stubbed Ollama)', () => {
    it('runs the loop, gets a tool call, writes a real file, and finishes', async () => {
        // Dynamic import AFTER OLLAMA_HOST is set (adapter captures host at load).
        const { AgentKernel } = await import('./kernel');
        const { ToolRegistry } = await import('./registry');
        const { fsTools } = await import('./tools/fs');
        const { PermissionBroker } = await import('./permissions');
        const agentMod = await import('../../shared/agent');

        const projectRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'vibe-smoke-'));
        const registry = new ToolRegistry();
        registry.registerAll(fsTools);
        const kernel = new AgentKernel({ registry });

        let runId = '';
        let finalText = '';
        let sawToolCall = false;
        let sawToolResult = false;
        const emit = (d: any) => {
            if (d.t === 'run_start') runId = d.runId;
            if (d.t === 'text') finalText += d.v;
            if (d.t === 'tool_call') sawToolCall = true;
            if (d.t === 'tool_result') sawToolResult = true;
            // Auto-approve the write_file permission prompt.
            if (d.t === 'permission_req') {
                const broker: InstanceType<typeof PermissionBroker> | undefined = kernel.getBroker(runId);
                broker?.resolve({ reqId: d.req.id, decision: 'allow', scope: 'once' });
            }
        };

        const stop = await kernel.run({
            sessionId: 's1',
            surface: 'cowork',
            model: 'test-model',
            projectRoot,
            input: [{ type: 'text', text: 'create smoke.txt' }],
            apiKeys: {},
        }, emit, []);

        const written = await fsp.readFile(path.join(projectRoot, 'smoke.txt'), 'utf-8');
        expect(written).toBe('hello from the VIBE kernel');
        expect(sawToolCall).toBe(true);
        expect(sawToolResult).toBe(true);
        expect(finalText).toContain('Done');
        expect(stop).toBe('end_turn');
        // The tool result must carry tool_name back to Ollama, or multi-step tool use breaks.
        expect(capturedToolName).toBe('write_file');
    });
});
