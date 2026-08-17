import { useEffect } from 'react';
import { useTerminalStore } from '../store/terminal';
import { useUIStore } from '../store/ui';

export function useBackgroundTerminal() {
    useEffect(() => {
        // Cleanup matters: React StrictMode double-mounts effects in dev, which
        // used to spawn TWO pty processes and orphan one on every reload.
        let cancelled = false;
        let createdId: string | null = null;
        const projectPath = useUIStore.getState().projectPath;
        window.vibe.createTerminal(projectPath || undefined).then((id: string) => {
            if (cancelled) { window.vibe.killTerminal(id); return; }
            createdId = id;
            useTerminalStore.getState().addSession({ id, title: 'Background' });
            // No data listener needed - main buffers output; the agent reads it
            // via getTerminalOutput. (The old noop listener leaked per mount.)
        }).catch(console.error);
        return () => {
            cancelled = true;
            if (createdId) {
                window.vibe.killTerminal(createdId);
                useTerminalStore.getState().removeSession(createdId);
            }
        };
    }, []);
}
