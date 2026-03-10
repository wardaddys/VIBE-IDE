import React from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { EditorTabs } from '../editor/EditorTabs';
import { MonacoEditor } from '../editor/MonacoEditor';
import { ChatMessages } from '../ai/ChatMessages';
import { ChatBar } from './ChatBar';

export function MainArea() {
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
                </div>
                <ChatMessages />
                <ChatBar />
            </GlassPanel>
        </div>
    );
}
