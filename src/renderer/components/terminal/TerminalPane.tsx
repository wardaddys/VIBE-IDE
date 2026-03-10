import React, { useEffect, useRef } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { useTerminalStore } from '../../store/terminal';

export function TerminalPane() {
    const terminalHeight = useUIStore(state => state.terminalHeight);
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const termIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const terminal = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.4,
            theme: {
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
            }
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);
        terminal.open(containerRef.current);
        fitAddon.fit();

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
            fitAddon.fit();
            window.vibe.resizeTerminal(id, terminal.cols, terminal.rows);
        });

        const resizeObserver = new ResizeObserver(() => {
            if (fitAddonRef.current && terminalRef.current && termIdRef.current) {
                fitAddonRef.current.fit();
                window.vibe.resizeTerminal(termIdRef.current, terminalRef.current.cols, terminalRef.current.rows);
            }
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

    return (
        <GlassPanel style={{ height: terminalHeight, padding: 8, overflow: 'hidden', flexShrink: 0 }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: '#1a1a2e'
                }}
            />
        </GlassPanel>
    );
}
