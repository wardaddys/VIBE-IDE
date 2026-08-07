import React, { useState } from 'react';
import type { ToolItemData } from '../../store/agentRun';

const ICONS: Record<string, string> = {
    read_file: 'R', write_file: 'W', edit_file: 'E', list_dir: 'D',
    glob: 'G', grep: '/', bash: '$', web_search: '?', web_fetch: '@',
    task: 'T', use_skill: 'S',
};

function DiffView({ diff }: { diff: string }) {
    return (
        <pre style={{ margin: 0 }}>
            {diff.split('\n').map((line, i) => {
                const add = line.startsWith('+'); const del = line.startsWith('-');
                return (
                    <div key={i} style={{
                        background: add ? 'rgba(60,160,90,0.14)' : del ? 'rgba(200,60,60,0.10)' : 'transparent',
                        color: add ? '#2f7d47' : del ? '#b5473b' : 'var(--cl-text-2)',
                        padding: '0 4px', whiteSpace: 'pre-wrap',
                    }}>{line || ' '}</div>
                );
            })}
        </pre>
    );
}

export function ToolCallCard({ item }: { item: ToolItemData }) {
    const [open, setOpen] = useState(false);
    const icon = ICONS[item.name] || '*';
    const isMcp = item.name.startsWith('mcp__');
    const statusColor = item.status === 'error' ? '#b5473b' : item.status === 'ok' ? '#2f7d47' : 'var(--cl-muted)';
    const diff = item.data && typeof item.data === 'object' ? (item.data as any).diff : undefined;

    return (
        <div className="cl-tool">
            <div className="cl-tool__head" onClick={() => setOpen(!open)}>
                <span className="cl-tool__dot" style={{ color: statusColor }}>{icon}</span>
                <span className="cl-tool__name">{item.render}</span>
                {isMcp && <span className="cl-tool__badge">MCP</span>}
                <span style={{ fontSize: 11, color: statusColor }}>
                    {item.status === 'running' ? 'running' : item.status === 'ok' ? 'done' : 'error'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--cl-muted)' }}>{open ? '▾' : '▸'}</span>
            </div>
            {open && (
                <div className="cl-tool__body">
                    {diff ? <DiffView diff={diff} /> : <pre>{item.resultContent || '(no output yet)'}</pre>}
                </div>
            )}
        </div>
    );
}
