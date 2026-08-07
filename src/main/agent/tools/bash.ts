/* =======================================================================
   bash tool - structured command execution with a PERSISTENT shell per
   session and an exit-code sentinel. Replaces the PowerShell-prompt scrape.

   Why persistent: an agent's `cd`, activated venv, and exported env must
   survive across commands. Why a nonce'd sentinel: so a command whose own
   output contains the marker can't falsely terminate the read, and so we
   get a REAL exit code (the old scrape had none - couldn't tell pass/fail).
   ======================================================================= */
import * as pty from 'node-pty';
import { randomBytes } from 'node:crypto';
import { existsSync } from 'node:fs';
import os from 'node:os';
import type { Tool, ToolContext, ToolResult } from '../types';
import type { CommandRecord } from '../commandLog';

const DEFAULT_TIMEOUT = 120_000;

/** Prompt fields for the terminal mirror so it can draw a real shell-style
    `┌──(user㉿host)-[cwd]` / `└─#` prompt before each command. */
function promptMeta(cwd: string): { cwd: string; user: string; host: string; root: boolean } {
    const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
    const home = os.homedir();
    const short = cwd === home ? '~' : (cwd.startsWith(home + '/') ? '~' + cwd.slice(home.length) : cwd);
    const user = isRoot ? 'root' : (process.env.USER || process.env.USERNAME || 'user');
    return { cwd: short, user, host: os.hostname().split('.')[0], root: isRoot };
}

interface Shell {
    proc: pty.IPty;
    buffer: string;
    queue: Promise<unknown>;
    /** Last cwd this shell was synced to (re-`cd` when the session's cwd changes). */
    cwd: string;
    /** Resolves once the shell has provably executed a command (startup done). */
    ready: Promise<void>;
}

const shells = new Map<string, Shell>();

interface ShellSpec {
    file: string;
    args: string[];
    /** One-time setup written right after spawn. */
    init?: string;
    /** Prepended to every command on the same line. */
    prefix: string;
    sentinel: (nonce: string) => string;
    strip: RegExp;
}

function shellCmd(): ShellSpec {
    if (process.platform === 'win32') {
        return {
            file: 'powershell.exe',
            args: ['-NoLogo', '-NoProfile'],
            // PSReadLine repaints the whole ConPTY screen on input, so every
            // capture window contained 2-3 copies of the PREVIOUS commands'
            // scrollback. Killing it turns the echo back into plain text.
            init: "Remove-Module PSReadLine -ErrorAction SilentlyContinue; $ProgressPreference='SilentlyContinue'",
            // Reset LASTEXITCODE so the sentinel can't read a stale value from
            // an earlier command when the current one is cmdlet-only.
            prefix: '$global:LASTEXITCODE=$null; ',
            // $? alone is a liar for native commands: `python ... 2>&1` that
            // writes to stderr flips $? to False via NativeCommandError even
            // when the process exited 0 (a passing test run reported exit 1).
            // Prefer the real process exit code whenever one exists.
            sentinel: (n) => `Write-Output "__VIBE_EXIT_$(if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } elseif ($?) { 0 } else { 1 })__${n}__"`,
            strip: /\x1b\[[0-9;?]*[A-Za-z]/g,
        };
    }
    // Use a PLAIN bash for the agent shell — NOT the user's $SHELL. Many setups
    // default to zsh with a two-line prompt + syntax-highlighting /
    // autosuggestion ZLE plugins that repaint the input line and inject escape
    // codes. That corrupts the exit-code sentinel and shows up as bogus
    // "[timed out] exit 124" on commands that actually completed (you saw the
    // mangled `=nnmap` echo). --norc/--noprofile + empty PS1 + no bracketed-paste
    // gives a deterministic stream to parse. Fall back to $SHELL only if bash is
    // genuinely absent.
    const hasBash = existsSync('/bin/bash');
    const file = hasBash ? '/bin/bash' : (process.env.SHELL || '/bin/sh');
    return {
        file,
        args: hasBash ? ['--norc', '--noprofile'] : [],
        init: hasBash ? "PS1=''; PROMPT_COMMAND=''; bind 'set enable-bracketed-paste off' 2>/dev/null" : undefined,
        prefix: '',
        sentinel: (n) => `echo "__VIBE_EXIT_$?__${n}__"`,
        strip: /\x1b\[[0-9;?]*[A-Za-z]/g,
    };
}

function getShell(sessionId: string, cwd: string): Shell {
    let s = shells.get(sessionId);
    if (s) return s;
    const spec = shellCmd();
    const launch = { file: spec.file, args: spec.args };
    const proc = pty.spawn(launch.file, launch.args, {
        name: 'xterm-256color',
        cols: 120,
        rows: 40,
        cwd,
        env: { ...process.env, GIT_PAGER: 'cat', PAGER: 'cat', TERM: 'xterm-256color' } as Record<string, string>,
    });
    // Readiness gate: PowerShell takes seconds to boot, and input written
    // during boot can be EATEN by PSReadLine before Remove-Module runs - the
    // first command of a session silently vanished and its sentinel never
    // fired (tool card spun until the user cancelled). Nothing may enter the
    // shell until this marker proves the shell is executing commands.
    const readyMarker = `__VIBE_READY_${randomBytes(4).toString('hex')}__`;
    let readyDone = false;
    let readyResolve!: () => void;
    const ready = new Promise<void>((res) => { readyResolve = res; });

    s = { proc, buffer: '', queue: Promise.resolve(), cwd, ready };
    proc.onData((d) => {
        s!.buffer += d;
        if (!readyDone && s!.buffer.includes(readyMarker)) { readyDone = true; readyResolve(); }
    });
    proc.onExit(() => shells.delete(sessionId));

    const probe = process.platform === 'win32' ? `Write-Output "${readyMarker}"` : `echo "${readyMarker}"`;
    proc.write((spec.init ? spec.init + '; ' : '') + probe + '\r');
    // Never gate forever if the marker is lost (exotic shells/profiles).
    setTimeout(() => { if (!readyDone) { readyDone = true; readyResolve(); } }, 10_000);

    shells.set(sessionId, s);
    return s;
}

function runInShell(s: Shell, command: string, timeoutMs: number, signal: AbortSignal): Promise<{ output: string; code: number }> {
    const spec = shellCmd();
    const nonce = randomBytes(6).toString('hex');
    const marker = new RegExp(`__VIBE_EXIT_(-?\\d+)__${nonce}__`);
    s.buffer = '';

    return new Promise((resolve) => {
        let done = false;
        let poll: ReturnType<typeof setInterval>;
        let timer: ReturnType<typeof setTimeout>;
        const finish = (output: string, code: number) => {
            if (done) return; done = true;
            clearInterval(poll); clearTimeout(timer);
            // Don't leak an abort listener on the run-level signal (shared across
            // every tool call in the run) when the command completes normally.
            signal.removeEventListener('abort', onAbort);
            resolve({ output, code });
        };
        const onAbort = () => {
            try { s.proc.write('\x03'); } catch { /* pty gone */ }
            finish(clean(s.buffer, spec.strip) + '\n[cancelled]', 130);
        };

        timer = setTimeout(() => {
            // Interrupt the runaway so it stops writing into the shared pty;
            // execute() then discards this now-tainted shell.
            try { s.proc.write('\x03'); } catch { /* pty gone */ }
            finish(clean(s.buffer, spec.strip) + '\n[timed out]', 124);
        }, timeoutMs);
        if (signal.aborted) { onAbort(); return; }
        signal.addEventListener('abort', onAbort, { once: true });

        poll = setInterval(() => {
            const m = s.buffer.match(marker);
            if (m) {
                const code = parseInt(m[1], 10);
                let out = s.buffer.slice(0, m.index);
                // Drop the echoed command line (incl. the exit-code prefix) and
                // the echoed sentinel command itself.
                out = clean(out, spec.strip);
                out = stripEchoedCommand(out, spec.prefix + command);
                out = stripSentinelEcho(out);
                out = stripPrompts(out);
                finish(out.trim(), Number.isFinite(code) ? code : 0);
            }
        }, 60);

        // Send the command, then the sentinel on its OWN line. If the command has a
        // parse error (e.g. cmd-style syntax), PowerShell still runs the sentinel line
        // next, so we get an immediate exit marker instead of hanging until timeout.
        s.proc.write(spec.prefix + command + '\r');
        s.proc.write(spec.sentinel(nonce) + '\r');
    });
}

function clean(s: string, strip: RegExp): string {
    return s
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)?/g, '') // OSC (window-title junk like ]0;C:\...)
        .replace(strip, '')                                   // CSI colors/cursor
        .replace(/\x07/g, '')
        .replace(/\r/g, '');
}

/** Drop everything from the echoed sentinel command onward (it always trails the real output). */
function stripSentinelEcho(out: string): string {
    const lines = out.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (/(?:Write-Output|echo) "__VIBE_EXIT_/.test(lines[i])) return lines.slice(0, i).join('\n');
    }
    return out;
}

function stripPrompts(out: string): string {
    return out
        .split('\n')
        .filter((l) => !/^PS [A-Za-z]:.*>\s*$/.test(l.trim()) && !/^Windows PowerShell\s*$/.test(l.trim()) && !/^Copyright \(C\) Microsoft/.test(l.trim()))
        .join('\n');
}

function stripEchoedCommand(out: string, command: string): string {
    const firstLine = command.split('\n')[0];
    const idx = out.indexOf(firstLine);
    if (idx !== -1 && idx < 200) return out.slice(idx + firstLine.length).replace(/^\s*\n/, '');
    return out;
}

/** PowerShell 5.1 has no `&&`. Convert top-level `&&` to `;`, but NEVER inside
    quotes - the old blind /&&/g replace corrupted `echo "a && b"`. (Note: `;`
    runs the RHS regardless of LHS status; true short-circuit fidelity would need
    a real parser, which isn't worth it for the legacy PowerShell path.) */
function convertAndOperators(cmd: string): string {
    let out = '';
    let quote: string | null = null;
    for (let i = 0; i < cmd.length; i++) {
        const c = cmd[i];
        if (quote) { out += c; if (c === quote) quote = null; continue; }
        if (c === '"' || c === "'") { quote = c; out += c; continue; }
        if (c === '&' && cmd[i + 1] === '&') { out += ';'; i++; continue; }
        out += c;
    }
    return out;
}

export const bashTool: Tool<{ command: string; timeout?: number; background?: boolean }> = {
    name: 'bash',
    description: 'Run a shell command in a persistent session shell (cd and env persist across calls). Returns combined output and exit code. For LONG jobs (full-port nmap -p-, hashcat/john/aircrack cracking, big-wordlist fuzzing) set background:true — it detaches the job to a logfile and returns immediately; poll the logfile with a later `cat`/`tail` call so you never hit the timeout.',
    tier: 'exec',
    source: 'builtin',
    inputSchema: {
        type: 'object',
        properties: {
            command: { type: 'string', description: 'Shell command to run.' },
            timeout: { type: 'number', description: `Timeout in ms (default ${DEFAULT_TIMEOUT}).` },
            background: { type: 'boolean', description: 'Run detached (nohup → logfile) and return immediately. Use for anything that may exceed ~2 minutes. Poll the returned logfile with cat/tail.' },
        },
        required: ['command'],
    },
    render: (i) => `Run: ${i.command.length > 80 ? i.command.slice(0, 80) + '...' : i.command}`,
    async execute(input, ctx: ToolContext): Promise<ToolResult> {
        const s = getShell(ctx.sessionId, ctx.cwd);

        // Background mode (Unix): detach the command so long scans/cracking don't
        // hit the timeout. Returns immediately with pid + logfile; the agent polls
        // the log with a later cat/tail. Survives shell recycling (nohup).
        if (input.background && process.platform !== 'win32') {
            const jobId = randomBytes(4).toString('hex');
            const log = `/tmp/vibe-job-${jobId}.log`;
            const script = `/tmp/vibe-job-${jobId}.sh`;
            const eof = `VIBE_EOF_${randomBytes(4).toString('hex')}`;
            // Heredoc writes the command verbatim (no quoting hell), then nohup runs it.
            const launch = `cat > ${script} <<'${eof}'\n${input.command}\n${eof}\nnohup bash ${script} > ${log} 2>&1 & echo "VIBE_JOB id=${jobId} pid=$! log=${log}"`;
            const bg = await new Promise<{ output: string; code: number }>((resolve) => {
                s.queue = s.queue
                    .then(() => s.ready)
                    .then(() => runInShell(s, launch, 30_000, ctx.signal))
                    .then(resolve, () => resolve({ output: 'shell error', code: 1 }));
            });
            const bgRecord: CommandRecord = {
                command: input.command,
                output: bg.output.trim(),
                status: 'background',
                cwd: ctx.cwd,
                at: new Date().toISOString(),
            };
            try { ctx.logCommand?.(bgRecord); } catch {}
            return {
                ok: true,
                content: `$ ${input.command}\n[background job ${jobId}] ${bg.output.trim()}\nPoll it:  cat ${log}   ·   tail -n 40 ${log}\nStop it:  kill the pid above. Keeps running even if this shell is recycled.`,
                data: { jobId, log, ...promptMeta(ctx.cwd) },
            };
        }

        let cmd = process.platform === 'win32' ? convertAndOperators(input.command) : input.command;
        // Re-sync the working directory if the session's cwd changed (project
        // switch) - the persistent shell would otherwise keep the stale dir.
        // Prepended to the command so it runs inside the serialized queue.
        if (s.cwd !== ctx.cwd) {
            const q = process.platform === 'win32'
                ? ctx.cwd.replace(/`/g, '``').replace(/\$/g, '`$').replace(/"/g, '`"')
                : ctx.cwd.replace(/(["\\$`])/g, '\\$1');
            cmd = `cd "${q}"; ${cmd}`;
            s.cwd = ctx.cwd;
        }
        const result = await new Promise<{ output: string; code: number }>((resolve) => {
            s.queue = s.queue
                .then(() => s.ready)  // never feed a shell that is still booting
                .then(() => runInShell(s, cmd, input.timeout ?? DEFAULT_TIMEOUT, ctx.signal))
                .then(resolve, () => resolve({ output: 'shell error', code: 1 }));
        });
        // A timed-out (124) or cancelled (130) command is still running in the
        // persistent pty and would bleed into the next command. Discard the
        // tainted shell; the next call spawns a clean one.
        if (result.code === 124 || result.code === 130) killSessionShell(ctx.sessionId);
        const status = result.code === 0 ? 'exit 0' : `exit ${result.code}`;
        const commandStatus = result.code === 0 ? 'ok' : result.code === 124 ? 'timeout' : result.code === 130 ? 'cancelled' : 'error';
        const rec: CommandRecord = {
            command: input.command,
            output: result.output || '(no output)',
            status: commandStatus,
            cwd: ctx.cwd,
            at: new Date().toISOString(),
        };
        try { ctx.logCommand?.(rec); } catch {}
        return {
            ok: result.code === 0,
            isError: result.code !== 0,
            content: `$ ${input.command}\n${result.output || '(no output)'}\n[${status}]`,
            data: { exitCode: result.code, ...promptMeta(ctx.cwd) },
        };
    },
};

export function killSessionShell(sessionId: string) {
    const s = shells.get(sessionId);
    if (s) { try { s.proc.kill(); } catch { /* ignore */ } shells.delete(sessionId); }
}

/** Kill every persistent shell (app quit / teardown) so no pty is orphaned. */
export function killAllShells() {
    for (const [, s] of shells) { try { s.proc.kill(); } catch { /* ignore */ } }
    shells.clear();
}

export const bashTools: Tool[] = [bashTool];
