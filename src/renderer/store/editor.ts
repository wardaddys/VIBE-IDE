import { create } from 'zustand';

interface EditorState {
    openFiles: string[];
    activeFileId: string | null;
    fileContents: Record<string, string>;
    /** Paths with edits not yet written to disk. Guards re-open refreshes. */
    dirtyPaths: Record<string, true>;
    openFile: (path: string, content: string) => void;
    closeFile: (path: string) => void;
    setActiveFile: (path: string) => void;
    updateContent: (path: string, content: string) => void;
    markSaved: (path: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    openFiles: [],
    activeFileId: null,
    fileContents: {},
    dirtyPaths: {},
    openFile: (path, content) => set((state) => {
        if (state.openFiles.includes(path)) {
            // Already open: just focus it — but if the on-disk content differs
            // and the buffer is clean, refresh so the user never edits a stale
            // copy. Dirty buffers are NEVER overwritten.
            if (state.dirtyPaths[path] || state.fileContents[path] === content) {
                return { activeFileId: path };
            }
            return { activeFileId: path, fileContents: { ...state.fileContents, [path]: content } };
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
        const newDirty = { ...state.dirtyPaths };
        delete newDirty[path];

        let newActive = state.activeFileId;
        if (newActive === path) {
            newActive = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
        }

        return {
            openFiles: newOpenFiles,
            activeFileId: newActive,
            fileContents: newContents,
            dirtyPaths: newDirty
        };
    }),
    setActiveFile: (path) => set({ activeFileId: path }),
    updateContent: (path, content) => set((state) => ({
        fileContents: { ...state.fileContents, [path]: content },
        dirtyPaths: { ...state.dirtyPaths, [path]: true }
    })),
    markSaved: (path) => set((state) => {
        if (!state.dirtyPaths[path]) return state;
        const dirtyPaths = { ...state.dirtyPaths };
        delete dirtyPaths[path];
        return { dirtyPaths };
    })
}));
