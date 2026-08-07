import { Overlay } from './Modal';
import React, { useEffect, useState } from 'react';
import type { FileEntry } from '../../../shared/types';
import { useUIStore } from '../../store/ui';
import { pickFolder } from '../../store/folderPicker';

export function Projects({ onClose }: { onClose: () => void }) {
    const projectPath = useUIStore((s) => s.projectPath);
    const setVibeInstructions = useUIStore((s) => s.setVibeInstructions);
    const [instructions, setInstructions] = useState('');
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!projectPath) return;
        window.vibe.readFile(`${projectPath}/VIBE.md`).then(setInstructions).catch(() => setInstructions(''));
        window.vibe.readDir(projectPath).then((f) => setFiles(f.filter((x) => x.isFile))).catch(() => setFiles([]));
    }, [projectPath]);

    const save = async () => {
        if (!projectPath) return;
        await window.vibe.writeFile(`${projectPath}/VIBE.md`, instructions);
        setVibeInstructions(instructions);
        setSaved(true); setTimeout(() => setSaved(false), 1500);
    };
    const openFolder = async () => { const p = await pickFolder(); if (p) { useUIStore.getState().setProjectPath(p); try { window.vibe.watchFolder(p); } catch {} } };

    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal cl-set" style={{ width: 720, height: '80vh', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                <div className="cl-modal__head"><span className="cl-modal__title">Project</span><button className="cl-x" onClick={onClose}>×</button></div>
                <div className="cl-set__body">
                    {!projectPath ? (
                        <div className="cl-empty">No project open. <button className="cl-pill-btn cl-pill-btn--on" onClick={openFolder} style={{ marginLeft: 8 }}>Open folder</button></div>
                    ) : (
                        <>
                            <div className="cl-field"><label className="cl-field__label">Folder</label><div style={{ fontSize: 12.5, fontFamily: 'var(--cl-mono)', color: 'var(--cl-text-2)' }}>{projectPath}</div></div>
                            <div className="cl-field">
                                <label className="cl-field__label">Custom instructions (VIBE.md)</label>
                                <textarea className="cl-input" style={{ height: 200, padding: 12, lineHeight: 1.5 }} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Project-specific rules the agent follows on every turn — conventions, do's and don'ts, architecture notes…" />
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                                    <button className="cl-pill-btn cl-pill-btn--on" onClick={save}>Save instructions</button>
                                    {saved && <span style={{ color: '#2f7d47', fontSize: 12.5 }}>Saved</span>}
                                </div>
                            </div>
                            <div className="cl-field">
                                <label className="cl-field__label">Knowledge ({files.length} files in root)</label>
                                <div className="cl-field__hint">All files in the project are available to the agent via read/glob/grep. Top-level: {files.slice(0, 20).map((f) => f.name).join(', ') || '(none)'}</div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Overlay>
    );
}
