import React, { useEffect, useRef } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { useTerminalStore } from '../../store/terminal';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';
import { ThinkBlock } from './ThinkBlock';

function CommandBlock({ command }: { command: string }) {
    const activeTerminalId = useTerminalStore(state => state.activeTerminalId);
    const [status, setStatus] = React.useState<'pending' | 'running' | 'done'>('pending');

    React.useEffect(() => {
        if (activeTerminalId && status === 'pending') {
            setStatus('running');
            setTimeout(() => {
                window.vibe.sendTerminalInput(activeTerminalId, command + '\r');
                setStatus('done');
            }, 300);
        }
    }, [activeTerminalId]);

    return (
        <div style={{
            background: '#0d1117',
            border: `1px solid ${status === 'done' ? '#238636' : '#30363d'}`,
            borderRadius: 6,
            padding: '8px 12px',
            margin: '4px 0',
        }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#7c8fa6', textTransform: 'uppercase', letterSpacing: 1 }}>Terminal</span>
                <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 4,
                    background: status === 'done' ? 'rgba(35,134,54,0.15)' : 'rgba(230,138,0,0.15)',
                    color: status === 'done' ? '#3fb950' : '#e68a00',
                }}>
                    {status === 'done' ? 'DONE' : 'RUNNING'}
                </span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={command}>{command}</div>
        </div>
    );
}

function FileWriteBlock({ path, content }: { path: string, content: string }) {
    const projectPath = useUIStore(state => state.projectPath);
    const openFile = useEditorStore(state => state.openFile);
    const [written, setWritten] = React.useState(false);
    
    useEffect(() => {
        if (projectPath && !written) {
            const fullPath = `${projectPath}/${path}`;
            window.vibe.writeFile(fullPath, content).then(() => {
                setWritten(true);
                openFile(fullPath, content);
            }).catch(console.error);
        }
    }, [projectPath, path, content, written]);
    
    return (
        <div style={{ background: 'rgba(0, 168, 112, 0.05)', border: '1px solid rgba(0, 168, 112, 0.2)', padding: '6px 12px', borderRadius: 6, margin: '4px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: written ? 'var(--green)' : 'var(--warn)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: 'var(--text)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {path} <span style={{ fontSize: 9, color: written ? 'var(--green)' : 'var(--text-muted)', fontWeight: 700, marginLeft: 4 }}>{written ? 'SAVED' : 'SAVING…'}</span>
                </div>
            </div>
        </div>
    );
}

function PlanBlock({ plan }: { plan: string }) {
    return (
        <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent)', padding: '10px 14px', borderRadius: 8, margin: '6px 0' }}>
            <div style={{ color: 'var(--accent)', fontWeight: 800, marginBottom: 6, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 }}>🎯 Execution Plan</div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text)' }}>{plan}</div>
        </div>
    );
}

function ThinkingBlock({ startTime }: { startTime: number }) {
    const [elapsed, setElapsed] = React.useState(0);
    const agentStatus = useOllamaStore(state => state.agentStatus);

    React.useEffect(() => {
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [startTime]);

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', color: 'var(--text-muted)', fontSize: 11 }}>
            <div style={{
                width: 10,
                height: 10,
                border: '2px solid var(--accent)',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                flexShrink: 0,
            }} />
            <span style={{ fontWeight: 600, color: 'var(--accent)' }}>
                {agentStatus || `Processing (${elapsed}s)…`}
            </span>
        </div>
    );
}

export function ChatMessages() {
    const messages = useOllamaStore(state => state.messages);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const containerRef = useRef<HTMLDivElement>(null);
    const [thinkingStartTime] = React.useState(() => Date.now());

    useEffect(() => { if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; }, [messages]);

    const renderContent = (content: string) => {
        if (!content) return <span style={{ opacity: 0.5 }}>…</span>;

        if (content.startsWith('__TERMINAL_OUTPUT__\n')) {
            const output = content.replace('__TERMINAL_OUTPUT__\n', '');
            return (
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: '#e6edf3', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    <div style={{ color: '#7c8fa6', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Terminal Output</div>
                    {output}
                </div>
            );
        }

        if (content.startsWith('__FILE_CONTENTS__')) {
            const firstNewline = content.indexOf('\n');
            const header = content.slice('__FILE_CONTENTS__ '.length, firstNewline);
            const body = content.slice(firstNewline + 1);
            return (
                <div style={{ background: 'rgba(0,102,255,0.04)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                    <div style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>📄 Reading: {header}</div>
                    {body.slice(0, 600)}{body.length > 600 ? '\n… (truncated for display)' : ''}
                </div>
            );
        }

        if (content.startsWith('__SWARM_LABEL__')) {
            const label = content.replace('__SWARM_LABEL__', '');
            return (
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: 1, padding: '2px 0' }}>{label}</div>
            );
        }

        const parts = content.split(/(<execute>[\s\S]*?<\/execute>|<write_file[\s\S]*?<\/write_file>|<plan>[\s\S]*?<\/plan>)/g);
        return parts.map((part, index) => {
            if (part.startsWith('<execute>')) {
                const cmd = part.replace(/<\/?execute>/g, '').trim();
                return <CommandBlock key={index} command={cmd} />;
            }
            if (part.startsWith('<write_file')) {
                const pathMatch = part.match(/path=['"]([^'"]+)['"]/);
                const path = pathMatch ? pathMatch[1] : 'unknown.txt';
                let fileContent = part.replace(/<write_file[^>]*>/, '').replace(/<\/write_file>/, '').trim();
                return <FileWriteBlock key={index} path={path} content={fileContent} />;
            }
            if (part.startsWith('<plan>')) return <PlanBlock key={index} plan={part.replace(/<\/?plan>/g, '').trim()} />;
            return <span key={index}>{part}</span>;
        });
    };

    return (
        <div ref={containerRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {messages.map((msg, i) => {
                const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant';
                const isStreaming = isLastAssistant && isGenerating && msg.content === '';
                const isSpecialBlock = msg.content.startsWith('__TERMINAL_OUTPUT__')
                    || msg.content.startsWith('__FILE_CONTENTS__')
                    || msg.content.startsWith('__SWARM_LABEL__');

                return (
                    <React.Fragment key={i}>
                        {isLastAssistant && <ThinkBlock />}
                        {(!isStreaming || msg.content !== '') && (
                            <div style={{
                                alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                maxWidth: isSpecialBlock ? '100%' : '92%',
                                background: isSpecialBlock ? 'transparent' : msg.role === 'user' ? 'var(--accent-light)' : '#fff',
                                color: 'var(--text)',
                                padding: isSpecialBlock ? '0' : '12px 16px',
                                borderRadius: 'var(--radius-md)',
                                border: isSpecialBlock ? 'none' : msg.role === 'user' ? 'none' : '1px solid var(--border-light)',
                                fontSize: 13,
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'var(--font-sans)',
                            }}>
                                {renderContent(msg.content)}
                            </div>
                        )}
                        {isStreaming && <ThinkingBlock startTime={thinkingStartTime} />}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
