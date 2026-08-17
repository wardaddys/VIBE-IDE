import { create } from 'zustand';

/* In-app folder picker state. Used as a fallback when the native OS dialog
   (dialog.showOpenDialog) is unavailable — common under sudo on Linux because
   root has no DBus session bus / xdg-desktop-portal for the user's desktop. */
interface FolderPickerState {
    open: boolean;
    resolve: ((p: string | null) => void) | null;
    openPicker: () => Promise<string | null>;
    done: (p: string | null) => void;
}

export const useFolderPicker = create<FolderPickerState>((set, get) => ({
    open: false,
    resolve: null,
    openPicker: () => new Promise<string | null>((res) => set({ open: true, resolve: res })),
    done: (p) => { const r = get().resolve; set({ open: false, resolve: null }); r?.(p); },
}));

/** Try the native OS folder picker first; fall back to the in-app picker if it
    fails or returns null. Works correctly whether VIBE runs as a normal user
    or as root/sudo. */
export const pickFolder = async (): Promise<string | null> => {
    try {
        const native = await window.vibe.openFolder();
        if (native) return native;
    } catch {
        // Native dialog failed (e.g. sudo with no portal). Fall through.
    }
    return useFolderPicker.getState().openPicker();
};
