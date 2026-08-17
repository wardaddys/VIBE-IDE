import { create } from 'zustand';

interface EditorState {
    openFiles: string[];
    activeFileId: string | null;
    fileContents: Record<string, string>;
    openFile: (path: string, content: string) => void;
    closeFile: (path: string) => void;
    setActiveFile: (path: string) => void;
    updateContent: (path: string, content: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    openFiles: [],
    activeFileId: null,
    fileContents: {},
    openFile: (path, content) => set((state) => {
        if (state.openFiles.includes(path)) {
            return { activeFileId: path };
        }
        return {
            openFiles: [...state.openFiles, path],
            activeFileId: path,
            fileContents: { ...state.fileContents, [path]: content }
        };
    }),
    closeFile: (path) => set((state) => {
        const newOpenFiles = state.openFiles.filter(p => p !== path);
        const newContents = { ...state.fileContents };
        delete newContents[path];

        let newActive = state.activeFileId;
        if (newActive === path) {
            newActive = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
        }

        return {
            openFiles: newOpenFiles,
            activeFileId: newActive,
            fileContents: newContents
        };
    }),
    setActiveFile: (path) => set({ activeFileId: path }),
    updateContent: (path, content) => set((state) => ({
        fileContents: { ...state.fileContents, [path]: content }
    }))
}));
