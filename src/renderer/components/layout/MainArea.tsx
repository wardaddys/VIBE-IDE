import React from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { EditorTabs } from '../editor/EditorTabs';
import { MonacoEditor } from '../editor/MonacoEditor';
import { AgentSurface } from '../agent/AgentSurface';

export function MainArea() {
    return (
        <div style={{ flex: 1, display: 'flex', gap: 'var(--gap)', overflow: 'hidden' }}>
            {/* Left: File Viewer / Editor */}
            <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <EditorTabs />
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <MonacoEditor />
                </div>
            </GlassPanel>

            {/* Right: Agent surfaces (Chat / Cowork / Code) over the native kernel */}
            <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <AgentSurface />
            </GlassPanel>
        </div>
    );
}
