import React, { useEffect, useRef } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';
import { useSettingsStore } from '../../store/settings';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { useTerminalStore } from '../../store/terminal';
import { terminalBus } from '../../utils/terminalBus';

const DARK_THEME = {
    background: '#1a1a2e',
    foreground: '#e2e2ef',
    cursor: '#00d4aa',
    cursorAccent: '#1a1a2e',
    selectionBackground: 'rgba(0, 212, 170, 0.2)',
    selectionForeground: '#ffffff',
    black: '#1a1a2e',
    red: '#ff4466',
    green: '#00d4aa',
    yellow: '#ffaa33',
    blue: '#4488ff',
    magenta: '#aa66ff',
    cyan: '#00aaff',
    white: '#e2e2ef',
    brightBlack: '#4a4a68',
    brightRed: '#ff6688',
    brightGreen: '#33e0bb',
    brightYellow: '#ffcc66',
    brightBlue: '#66aaff',
    brightMagenta: '#cc88ff',
    brightCyan: '#33ccff',
    brightWhite: '#ffffff',
};

const LIGHT_THEME = {
    background: '#f2f2f7',
    foreground: '#1a1a2e',
    cursor: '#c65a3a',
    cursorAccent: '#f2f2f7',
    selectionBackground: 'rgba(198, 90, 58, 0.18)',
    selectionForeground: '#1a1a2e',
    black: '#1a1a2e',
    red: '#c93a55',
    green: '#1f9d6c',
    yellow: '#c07f1a',
    blue: '#2a6cff',
    magenta: '#7850dc',
    cyan: '#0a7fbf',
    white: '#f2f2f7',
    brightBlack: '#6f6f85',
    brightRed: '#e0506a',
    brightGreen: '#27b57e',
    brightYellow: '#d99a2b',
    brightBlue: '#4a86ff',
    brightMagenta: '#9a6ff0',
    brightCyan: '#1a9fd9',
    brightWhite: '#ffffff',
};

export function TerminalPane() {
    const terminalHeight = useUIStore(state => state.terminalHeight);
    const theme = useSettingsStore(state => state.theme);
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const termIdRef = useRef<string | null>(null);

    const safeFit = () => {
        try {
            const el = containerRef.current;
            if (!el || el.clientWidth === 0 || el.clientHeight === 0) return;
            fitAddonRef.current?.fit();
            if (terminalRef.current && termIdRef.current) {
                window.vibe.resizeTerminal(termIdRef.current, terminalRef.current.cols, terminalRef.current.rows);
            }
        } catch { /* terminal not attached / zero-size — ignore */ }
    };

    useEffect(() => {
        if (!containerRef.current) return;

        const terminal = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.4,
            theme: useSettingsStore.getState().theme === 'light' ? LIGHT_THEME : DARK_THEME,
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);
        terminal.open(containerRef.current);
        safeFit();

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;

        let mounted = true;

        window.vibe.createTerminal(useUIStore.getState().projectPath || undefined).then((id: string) => {
            if (!mounted) return;
            termIdRef.current = id;
            useTerminalStore.getState().addSession({ id, title: 'Bash' }); // CRITICAL FIX
            window.vibe.onTerminalData((incomingId: string, data: string) => {
                if (incomingId === id) terminal.write(data);
            });
            terminal.onData((data) => window.vibe.sendTerminalInput(id, data));
            safeFit();
        });

        const resizeObserver = new ResizeObserver(() => {
            safeFit();
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            mounted = false;
            resizeObserver.disconnect();
            if (termIdRef.current) {
                window.vibe.killTerminal(termIdRef.current);
            }
            terminal.dispose();
        };
    }, []);

    // Mirror the agent's bash activity into this terminal (display only — the
    // pty above is still the user's real interactive shell). Replays the full
    // command log on mount so reopening the terminal shows everything the agent
    // has run, then follows new output and auto-scrolls to the latest.
    useEffect(() => {
        const hist = terminalBus.getHistory();
        if (hist) terminalRef.current?.write(hist);
        terminalRef.current?.scrollToBottom();
        const unsub = terminalBus.subscribe((text) => {
            terminalRef.current?.write(text);
            terminalRef.current?.scrollToBottom();
        });
        return unsub;
    }, []);

    // Follow the app theme without recreating the pty session.
    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.options.theme = theme === 'light' ? LIGHT_THEME : DARK_THEME;
        }
    }, [theme]);

    return (
        <GlassPanel style={{ height: terminalHeight, padding: 8, overflow: 'hidden', flexShrink: 0 }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: theme === 'light' ? LIGHT_THEME.background : DARK_THEME.background
                }}
            />
        </GlassPanel>
    );
}
