import { useCallback } from 'react';

export function useTerminal() {
    const createTerminal = useCallback(async (cwd?: string): Promise<string> => {
        return window.vibe.createTerminal(cwd);
    }, []);

    const sendInput = useCallback((id: string, data: string) => {
        window.vibe.sendTerminalInput(id, data);
    }, []);

    const resizeTerminal = useCallback((id: string, cols: number, rows: number) => {
        window.vibe.resizeTerminal(id, cols, rows);
    }, []);

    const onData = useCallback((callback: (id: string, data: string) => void) => {
        window.vibe.onTerminalData(callback);
    }, []);

    const killTerminal = useCallback((id: string) => {
        window.vibe.killTerminal(id);
    }, []);

    return { createTerminal, sendInput, resizeTerminal, onData, killTerminal };
}
