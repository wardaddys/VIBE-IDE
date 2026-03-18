import React from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { EditorTabs } from '../editor/EditorTabs';
import { MonacoEditor } from '../editor/MonacoEditor';
import { ChatMessages } from '../ai/ChatMessages';
import { ChatBar } from './ChatBar';
import { useUIStore } from '../../store/ui';

export function MainArea() {
    const chatMode = useUIStore(state => state.chatMode);
    const setChatMode = useUIStore(state => state.setChatMode);
    const projectPath = useUIStore(state => state.projectPath);
    const [agentStatus, setAgentStatus] = React.useState<any>(null);

    React.useEffect(() => {
        let mounted = true;
        const load = async () => {
            try {
                const s = await window.vibe.getAgentStatus();
                if (mounted) setAgentStatus(s);
            } catch {
                if (mounted) setAgentStatus(null);
            }
        };
        load();
        const t = setInterval(load, 2000);
        return () => { mounted = false; clearInterval(t); };
    }, []);

    const handleRefreshBriefing = async () => {
        try {
            await window.vibe.triggerBriefing();
        } catch {}
    };

    return (
        <div style={{ flex: 1, display: 'flex', gap: 'var(--gap)', overflow: 'hidden' }}>
            {/* Left: File Viewer / Editor — 50% */}
            <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <EditorTabs />
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <MonacoEditor />
                </div>
            </GlassPanel>

            {/* Right: Agent Chat — 50% */}
            <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <div style={{
                    padding: '10px 16px',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                    borderBottom: '1px solid var(--border-light)',
                    flexShrink: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <span>Agent Chat</span>
                    <div style={{ display: 'flex', gap: 6 }}>
                        {(['auto', 'chat', 'agent'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setChatMode(mode)}
                                style={{
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '4px 8px',
                                    cursor: 'pointer',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    letterSpacing: '0.4px',
                                    textTransform: 'uppercase',
                                    background: chatMode === mode ? 'var(--accent)' : 'rgba(0,0,0,0.06)',
                                    color: chatMode === mode ? '#fff' : 'var(--text-muted)'
                                }}
                            >
                                {mode}
                            </button>
                        ))}
                    </div>
                </div>
                <div style={{
                    padding: '6px 16px',
                    borderBottom: '1px solid var(--border-light)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    fontSize: 11,
                    color: 'var(--text-muted)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                        {!projectPath && <span>No active project: background agents idle</span>}
                        {projectPath && (
                            <>
                                <span style={{ color: agentStatus?.collector?.isRunning ? '#1f9d55' : 'var(--text-muted)' }}>
                                    Collector {agentStatus?.collector?.isRunning ? 'running' : 'stopped'}
                                </span>
                                <span>
                                    events {agentStatus?.collector?.eventCount ?? 0}
                                </span>
                                <span style={{ color: agentStatus?.reviewer?.isRunning ? '#1f9d55' : 'var(--text-muted)' }}>
                                    Reviewer {agentStatus?.reviewer?.isRunning ? 'running' : 'stopped'}
                                </span>
                                <span>
                                    briefings {agentStatus?.reviewer?.briefingCount ?? 0}
                                </span>
                            </>
                        )}
                    </div>
                    {projectPath && (
                        <button
                            onClick={handleRefreshBriefing}
                            style={{
                                border: '1px solid var(--border)',
                                background: 'rgba(0,0,0,0.03)',
                                color: 'var(--text-muted)',
                                borderRadius: 6,
                                padding: '3px 8px',
                                fontSize: 10,
                                cursor: 'pointer'
                            }}
                        >
                            Refresh briefing
                        </button>
                    )}
                </div>
                <ChatMessages />
                <ChatBar />
            </GlassPanel>
        </div>
    );
}
