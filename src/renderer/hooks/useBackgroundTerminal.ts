import { useEffect } from 'react';
import { useTerminalStore } from '../store/terminal';
import { useUIStore } from '../store/ui';

export function useBackgroundTerminal() {
    useEffect(() => {
        const projectPath = useUIStore.getState().projectPath;
        window.vibe.createTerminal(projectPath || undefined).then((id: string) => {
            useTerminalStore.getState().addSession({ id, title: 'Background' });
            // Listen for data but don't render it — agent loop reads it via getTerminalOutput
            window.vibe.onTerminalData((_id: string, _data: string) => {
                // Silently buffer — terminal.ts handles buffering
            });
        }).catch(console.error);
    }, []);
}
