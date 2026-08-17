import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editor';
import { useUIStore } from '../../store/ui';
import { detectRunPlanForFile, executeRunPlan, createRunOverride, type RunPlan } from '../../utils/run';

/** Thin bar above the editor: detected run command + ▶ Run + config escape hatch. */
export function RunBar() {
    const activeFileId = useEditorStore((s) => s.activeFileId);
    const projectPath = useUIStore((s) => s.projectPath);
    const [plan, setPlan] = useState<RunPlan | null>(null);
    const [note, setNote] = useState('');

    useEffect(() => {
        let alive = true;
        setNote('');
        detectRunPlanForFile(projectPath, activeFileId).then((p) => { if (alive) setPlan(p); }).catch(() => { if (alive) setPlan(null); });
        return () => { alive = false; };
    }, [projectPath, activeFileId]);

    const run = () => {
        if (!plan) return;
        if (!executeRunPlan(plan)) setNote('no terminal available');
    };

    const configure = async () => {
        if (!projectPath) { setNote('open a project folder first'); return; }
        try {
            const p = await createRunOverride(projectPath);
            const content = await window.vibe.readFile(p).catch(() => '');
            useEditorStore.getState().openFile(p, content);
            setNote('edit run.json, then reopen a file to refresh');
        } catch { setNote('could not create .vibe/run.json'); }
    };

    return (
        <div className="cl-runbar">
            <button className="cl-runbtn" onClick={run} disabled={!plan} title={plan?.command || 'No runner detected for this project/file'}>▶ Run</button>
            <span className="cl-runlabel" title={plan?.command || ''}>
                {plan ? plan.label : 'no runner detected - set one via run config'}
            </span>
            <span style={{ flex: 1 }} />
            {note && <span className="cl-runlabel">{note}</span>}
            <button className="cl-runcfg" onClick={configure} title="Create .vibe/run.json with a custom command - works for any toolchain on PATH">run config</button>
        </div>
    );
}
