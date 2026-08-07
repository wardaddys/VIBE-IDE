/* =======================================================================
   terminalBus — a running log of the AGENT's shell activity, mirrored into
   whatever terminal pane(s) are mounted (cowork workspace, IDE).

   The agent keeps running commands in its own hidden, sentinel-parsed shell
   (reliable exit codes); this bus only records + WRITES the command + output
   into the visible xterm for display. The visible terminal stays a real
   interactive pty the user can type into — the two never cross.

   The full history is buffered, so closing/reopening the terminal (or opening
   it after the agent already ran things) replays the entire command log.
   ======================================================================= */
type Listener = (text: string) => void;

const listeners = new Set<Listener>();
let history = '';
const MAX_HISTORY = 250_000; // cap the buffer (~250 KB of scrollback)

export const terminalBus = {
    /** Record + write raw terminal text (use \r\n line endings) to every pane. */
    write(text: string): void {
        history += text;
        if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);
        for (const l of listeners) { try { l(text); } catch { /* ignore */ } }
    },
    /** Subscribe a terminal pane; returns an unsubscribe fn. */
    subscribe(l: Listener): () => void {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },
    /** The full buffered log — replayed when a terminal mounts. */
    getHistory(): string { return history; },
    /** Clear the log. */
    clear(): void { history = ''; },
    get active(): boolean { return listeners.size > 0; },
};

export interface AgentPrompt { cwd?: string; user?: string; host?: string; root?: boolean }

/** Render an agent bash result (`$ cmd\n output \n[exit N]`) as a real
    shell-style prompt block, so each agent command looks like it was typed at a
    fresh `┌──(user㉿host)-[cwd]` / `└─#` prompt — exactly like the interactive
    shell. */
export function formatAgentBlock(content: string, meta?: AgentPrompt): string {
    const user = meta?.user || 'root';
    const host = meta?.host || 'localhost';
    const cwd = meta?.cwd || '~';
    const tag = meta?.root === false ? '$' : '#';
    // Drop the leading "$ " so the command sits right after the prompt; the
    // rest (output + [exit N]) follows on its own lines.
    const body = String(content || '').replace(/^\$ /, '').replace(/\r?\n/g, '\r\n');
    const top = `\x1b[38;5;39m┌──(\x1b[38;5;196m${user}\x1b[38;5;208m㉿\x1b[38;5;196m${host}\x1b[38;5;39m)-[\x1b[38;5;250m${cwd}\x1b[38;5;39m]\x1b[0m`;
    const bot = `\x1b[38;5;39m└─${tag}\x1b[0m `;
    return `\r\n${top}\r\n${bot}${body}\r\n`;
}
