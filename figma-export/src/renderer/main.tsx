import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

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
