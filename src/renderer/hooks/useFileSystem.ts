import { useCallback } from 'react';
import type { FileEntry } from '../../shared/types';

export function useFileSystem() {
    const openFolder = useCallback(async (): Promise<string | null> => {
        return window.vibe.openFolder();
    }, []);

    const readDir = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
        return window.vibe.readDir(dirPath);
    }, []);

    const readFile = useCallback(async (filePath: string): Promise<string> => {
        return window.vibe.readFile(filePath);
    }, []);

    const writeFile = useCallback(async (filePath: string, content: string): Promise<boolean> => {
        return window.vibe.writeFile(filePath, content);
    }, []);

    return { openFolder, readDir, readFile, writeFile };
}
