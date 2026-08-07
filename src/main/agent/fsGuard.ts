/* =======================================================================
   Filesystem guard / canonicalizer.
   Every tool that touches a path routes through resolveWithinRoot so that
   permission rules and root-confinement key on a CANONICAL absolute path.
   Defeats `..`, `~`, and symlink escapes (quirk #9 in the design doc).
   ======================================================================= */
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

export function expandHome(p: string): string {
    if (p === '~') return os.homedir();
    if (p.startsWith('~/') || p.startsWith('~\\')) return path.join(os.homedir(), p.slice(2));
    return p;
}

/** Canonicalize: expand ~, resolve to absolute, then realpath as far as it exists. */
export function canonicalize(input: string, base: string | null): string {
    let p = expandHome(input);
    if (!path.isAbsolute(p)) p = path.resolve(base || process.cwd(), p);
    // Resolve symlinks on the longest existing prefix (target may not exist yet).
    let existing = p;
    const tail: string[] = [];
    while (!fs.existsSync(existing)) {
        const parent = path.dirname(existing);
        if (parent === existing) break;
        tail.unshift(path.basename(existing));
        existing = parent;
    }
    try {
        const real = fs.realpathSync(existing);
        return tail.length ? path.join(real, ...tail) : real;
    } catch {
        return p;
    }
}

export function isWithin(candidate: string, root: string): boolean {
    const rel = path.relative(root, candidate);
    return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

export interface ResolveOptions {
    allowOutsideRoot?: boolean;
}

/**
 * Resolve a path for a tool. Returns the canonical absolute path.
 * Marks whether it fell outside the project root so the permission broker
 * can force an approval prompt even for otherwise-safe tools.
 */
export function resolveWithinRoot(
    input: string,
    root: string | null,
): { resolved: string; outsideRoot: boolean } {
    const resolved = canonicalize(input, root);
    const outsideRoot = root ? !isWithin(resolved, canonicalize(root, null)) : true;
    return { resolved, outsideRoot };
}
