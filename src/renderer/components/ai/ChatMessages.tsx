import React, { useEffect, useRef } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';
import { ThinkBlock } from './ThinkBlock';
import { ThinkingIndicator } from './ThinkingIndicator';

function CommandBlock({ command }: { command: string }) {
    const handleCopy = () => {
        navigator.clipboard.writeText(command);
    };
    return (
        <div style={{ background: '#1e1e2e', border: '1px solid #313244', borderRadius: 8, margin: '8px 0', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Terminal Command</span>
                <button onClick={handleCopy} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 10 }}>Copy</button>
            </div>
            <div style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#cdd6f4', whiteSpace: 'pre-wrap' }}>
                <span style={{ color: 'var(--accent)', marginRight: 8, opacity: 0.7 }}>$</span>{command}
            </div>
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

export function ChatMessages() {
    const messages = useOllamaStore(state => state.messages);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => { 
        if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight; 
    }, [messages, isGenerating]);

    const renderContent = (content: string) => {
        if (!content) return <span style={{ opacity: 0.5 }}>…</span>;

        if (content.startsWith('__TERMINAL_OUTPUT__\n')) {
            const output = content.replace('__TERMINAL_OUTPUT__\n', '');
            return (
                <div style={{ background: '#0d1117', border: '1px solid #30363d', borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: '#e6edf3', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
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
                <div style={{ background: 'rgba(0,102,255,0.04)', border: '1px solid var(--border)', borderRadius: 6, padding: '10px 14px', fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
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
                        {isStreaming && <ThinkingIndicator />}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
