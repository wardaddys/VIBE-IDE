import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import { useSettingsStore } from './store/settings';

// Apply the persisted theme before first paint (no dark flash in light mode).
document.documentElement.dataset.theme = useSettingsStore.getState().theme || 'dark';

// Uncaught exceptions and promise rejections must reach the runtime log file —
// without this they only exist in a devtools console the user never opens.
window.addEventListener('error', (e) => {
    try { window.vibe?.log(`[UNCAUGHT] ${e.message} @ ${e.filename}:${e.lineno}:${e.colno}${e.error?.stack ? `\n${e.error.stack}` : ''}`); } catch { }
});
window.addEventListener('unhandledrejection', (e) => {
    const r: any = e.reason;
    try { window.vibe?.log(`[UNHANDLED-REJECTION] ${r?.stack || r?.message || String(r)}`); } catch { }
});

// Forward renderer console.log to main process debug window
const _origLog = console.log
const _origError = console.error
const _origWarn = console.warn

console.log = (...args: any[]) => {
    _origLog(...args)
    try {
        window.vibe?.log(`[LOG] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`)
    } catch { }
}

console.error = (...args: any[]) => {
    _origError(...args)
    try {
        window.vibe?.log(`[ERROR] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`)
    } catch { }
}

console.warn = (...args: any[]) => {
    _origWarn(...args)
    try {
        window.vibe?.log(`[WARN] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`)
    } catch { }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
