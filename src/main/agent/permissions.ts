/* =======================================================================
   PermissionBroker - the gate between model output and side effects.

   Order of evaluation:
     1. explicit deny rule (tool+target glob)
     2. explicit allow rule ("always" from a prior prompt)
     3. tier default: safe -> allow; mutating/exec/network -> ask
     4. out-of-root target -> force ask even if tool is otherwise safe
   Decisions with scope "always" persist to <root>/.vibe/permissions.json.
   Keys on the RESOLVED target (canonical path / normalized command).
   ======================================================================= */
import fsp from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
    AgentDelta,
    PermissionDecision,
    PermissionRequest,
    PermissionResolution,
    PermissionRule,
    PermissionTier,
} from '../../shared/agent';

function globToRe(glob: string): RegExp {
    let re = '';
    for (const c of glob) {
        if (c === '*') re += '.*';
        else if ('+.^${}()|[]\\?'.includes(c)) re += '\\' + c;
        else re += c;
    }
    return new RegExp('^' + re + '$');
}

export interface PendingPrompt {
    req: PermissionRequest;
    resolve: (r: PermissionResolution) => void;
}

export class PermissionBroker {
    private rules: PermissionRule[] = [];
    private pending = new Map<string, PendingPrompt>();
    private projectRoot: string | null = null;
    private emit: (d: AgentDelta) => void = () => {};
    /**
     * in-memory "session" scope allows, not persisted.
     * The kernel attaches ONE shared array per chat session so these survive
     * across runs (a broker instance only lives for a single run).
     */
    private sessionAllows: PermissionRule[] = [];

    /** Share session-scope allows across runs of the same chat session. */
    attachSessionAllows(shared: PermissionRule[]) { this.sessionAllows = shared; }
    /** posture: cowork/code remember "always"; chat stays cautious */
    autoAllowSafe = true;
    /** sandboxed sub-agents auto-approve their (read-biased) tools to avoid hanging */
    autoAllowAll = false;
    /**
     * When true, out-of-root targets are DENIED even while autoAllowAll is set.
     * A worker auto-approves so it doesn't hang on a prompt no user can answer,
     * but that must not become a hole to read/write outside the project root.
     */
    denyOutsideRoot = false;

    async load(projectRoot: string | null) {
        this.projectRoot = projectRoot;
        this.rules = [];
        if (!projectRoot) return;
        try {
            const raw = await fsp.readFile(path.join(projectRoot, '.vibe', 'permissions.json'), 'utf-8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed.rules)) this.rules = parsed.rules;
        } catch { /* none yet */ }
    }

    setEmitter(emit: (d: AgentDelta) => void) { this.emit = emit; }

    private async persist() {
        if (!this.projectRoot) return;
        const dir = path.join(this.projectRoot, '.vibe');
        await fsp.mkdir(dir, { recursive: true }).catch(() => {});
        await fsp.writeFile(path.join(dir, 'permissions.json'), JSON.stringify({ rules: this.rules }, null, 2)).catch(() => {});
    }

    private matches(rule: PermissionRule, tool: string, target: string | null): boolean {
        if (!globToRe(rule.tool).test(tool)) return false;
        if (rule.target) {
            if (!target) return false;
            if (!globToRe(rule.target).test(target)) return false;
        }
        return true;
    }

    private staticDecision(tool: string, tier: PermissionTier, target: string | null, outsideRoot: boolean): PermissionDecision {
        for (const r of [...this.sessionAllows, ...this.rules]) {
            if (this.matches(r, tool, target)) return r.decision;
        }
        if (outsideRoot) return 'ask';
        if (tier === 'safe' && this.autoAllowSafe) return 'allow';
        return 'ask';
    }

    /**
     * Check a tool call. Resolves to allow/deny; emits a permission_req and
     * awaits the user when the static rules say "ask".
     */
    async check(opts: {
        runId: string;
        tool: string;
        tier: PermissionTier;
        render: string;
        target: string | null;
        outsideRoot: boolean;
        input: unknown;
    }): Promise<'allow' | 'deny'> {
        if (this.autoAllowAll) {
            // Confined workers must never reach outside the project root, even
            // though they auto-approve everything else (no user to force-ask).
            if (opts.outsideRoot && this.denyOutsideRoot) return 'deny';
            return 'allow';
        }
        const decision = this.staticDecision(opts.tool, opts.tier, opts.target, opts.outsideRoot);
        if (decision === 'allow') return 'allow';
        if (decision === 'deny') return 'deny';

        const req: PermissionRequest = {
            id: randomUUID(),
            runId: opts.runId,
            toolName: opts.tool,
            tier: opts.tier,
            render: opts.render + (opts.outsideRoot ? '  ! outside project root' : ''),
            target: opts.target,
            input: opts.input,
        };
        // Set pending BEFORE emitting so a synchronous resolution can't be lost.
        const resolution = await new Promise<PermissionResolution>((resolve) => {
            this.pending.set(req.id, { req, resolve });
            this.emit({ t: 'permission_req', runId: opts.runId, req });
        });
        this.emit({ t: 'permission_resolved', runId: opts.runId, reqId: req.id, decision: resolution.decision });

        if (resolution.scope !== 'once') {
            // Allow rules generalize to the WHOLE tool. "Allow for session" /
            // "Always allow" must cover the next command/file too - keying on
            // the exact target string meant every new command re-prompted.
            // Deny rules stay target-scoped so a broad deny can't brick a tool.
            const generalizeAllow = resolution.decision === 'allow';
            const rule: PermissionRule = {
                tool: opts.tool,
                target: generalizeAllow ? undefined : (opts.target ?? undefined),
                decision: resolution.decision,
                scope: resolution.scope,
                createdAt: new Date().toISOString(),
            };
            if (resolution.scope === 'session') this.sessionAllows.push(rule);
            else { this.rules.push(rule); await this.persist(); }
        }
        return resolution.decision;
    }

    /** Called from IPC when the user answers a prompt. */
    resolve(res: PermissionResolution): boolean {
        const p = this.pending.get(res.reqId);
        if (!p) return false;
        this.pending.delete(res.reqId);
        p.resolve(res);
        return true;
    }

    /** Auto-deny everything still pending (e.g. run cancelled). */
    cancelAllPending() {
        for (const [, p] of this.pending) p.resolve({ reqId: p.req.id, decision: 'deny', scope: 'once' });
        this.pending.clear();
    }

    /** Wipe the attached session-scope allows (in place - the array is shared). */
    clearSession() { this.sessionAllows.length = 0; }
}
