import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FileEntry } from '../../../shared/types';
import { useAgentRunStore } from '../../store/agentRun';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';
import { useSettingsStore } from '../../store/settings';
import { useDebateStore } from '../../store/debate';
import { ModelPicker } from '../claude/ModelPicker';
import { ToolCallCard } from './ToolCallCard';
import { PermissionPrompt } from './PermissionPrompt';
import { ArtifactBadges } from './ArtifactPane';
import { Markdown, extractThink } from '../claude/Markdown';
import { Overlay } from '../claude/Modal';
import { initAgentClient, runTurn, cancelRun, regenerate, editLast, approveAllPending, answerQuestion } from '../../services/agentClient';
import { SLASH_COMMANDS, type SlashCtx } from '../../utils/slashCommands';
import { useUsageStore, fmtTokens } from '../../store/usage';
import type { RunItem } from '../../store/agentRun';

const GREETING: Record<string, { title: string; sub: string }> = {
    chat: { title: 'How can I help?', sub: 'Ask anything. I can search the web and read your open project.' },
    cowork: { title: "Let's get to work.", sub: 'I can read, write, and edit files and run commands in your project.' },
    code: { title: 'What are we building?', sub: 'Terminal-native coding with full file and shell access.' },
    design: { title: 'What should we design?', sub: 'Describe it - the canvas renders every revision live as I work.' },
};

export function AgentSurface() {
    const surface = useAgentRunStore((s) => s.surface);
    const items = useAgentRunStore((s) => s.items);
    const selectedModel = useOllamaStore((s) => s.selectedModel);
    useEffect(() => { initAgentClient(); }, []);
    useEffect(() => { useAgentRunStore.getState().setModel(selectedModel); }, [selectedModel]);
    const empty = items.length === 0;
    const g = GREETING[surface] || GREETING.chat;

    return (
        <div className="cl-main">
            {empty ? (
                <div className="cl-stream"><div className="cl-col--center">
                    <div><div className="cl-greeting">{g.title}</div><div className="cl-greeting__sub">{g.sub}</div></div>
                    <Composer centered />
                </div></div>
            ) : (
                <><Stream /><div className="cl-composer-wrap"><div className="cl-composer-stack"><QuestionPanel /><Composer /></div></div></>
            )}
        </div>
    );
}

/** ask_user answers UI - a card that rises directly above the chat bar while
    the agent waits. Styled to match how questions are posed elsewhere:
    per-question sections, selectable option rows, radio vs checkbox affordance. */
function QuestionPanel() {
    const items = useAgentRunStore((s) => s.items);
    const pendingQ = [...items].reverse().find((i) => i.kind === 'question' && !(i as any).answers && !(i as any).dismissed) as
        Extract<RunItem, { kind: 'question' }> | undefined;
    const [sel, setSel] = useState<Record<string, string[]>>({});
    useEffect(() => { setSel({}); }, [pendingQ?.id]);
    if (!pendingQ) return null;

    const qs = pendingQ.req.questions;
    const instant = qs.length === 1 && !qs[0].multi; // single choice -> answer on click
    const toggle = (q: string, opt: string, multi: boolean) => setSel((s) => {
        const cur = s[q] || [];
        return { ...s, [q]: multi ? (cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]) : [opt] };
    });
    const canSubmit = qs.every((q) => (sel[q.question] || []).length > 0);

    return (
        <div className="cl-qpanel">
            <div className="cl-qpanel__head">
                <span>{instant ? 'A quick question' : qs.length > 1 ? `${qs.length} questions` : 'A quick question'}</span>
                <button className="cl-qpanel__x" title="Skip / dismiss" onClick={() => answerQuestion(pendingQ.id, {})}>×</button>
            </div>
            {qs.map((q) => (
                <div key={q.question} className="cl-qsec">
                    <div className="cl-qsec__q">{q.question}</div>
                    {q.multi && <div className="cl-qsec__hint">select all that apply</div>}
                    <div className="cl-qopts">
                        {q.options.map((o) => {
                            const on = (sel[q.question] || []).includes(o.label);
                            return (
                                <button key={o.label}
                                    className={`cl-qopt ${on ? 'cl-qopt--on' : ''}`}
                                    onClick={() => instant
                                        ? answerQuestion(pendingQ.id, { [q.question]: [o.label] })
                                        : toggle(q.question, o.label, !!q.multi)}>
                                    <span className={`cl-qopt__mark ${q.multi ? 'cl-qopt__mark--multi' : ''}`}>{on ? '✓' : ''}</span>
                                    <span className="cl-qopt__label">{o.label}</span>
                                    {o.description && <span className="cl-qopt__desc">{o.description}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
            {!instant && (
                <div className="cl-qpanel__row">
                    <button className="cl-qsubmit" disabled={!canSubmit} onClick={() => answerQuestion(pendingQ.id, sel)}>Submit</button>
                </div>
            )}
        </div>
    );
}

/** Inline dual-model debate transcript, rendered at the tail of the chat stream
    while a debate started from the composer runs (or after it finishes). Reads
    the debate store directly; the composer drives start/interject/cancel. */
/** Debaters can be reasoning models that emit <think> inline in their text
    (when the provider doesn't split it into a channel). Hide the reasoning and
    strip any stray tags so the debate view shows only the real answer. */
function debateVisible(text: string): string {
    return extractThink(text).visible.replace(/<\/?think>/gi, '').trim();
}

function DebateBlock() {
    const rounds = useDebateStore((s) => s.rounds);
    const synthesis = useDebateStore((s) => s.synthesis);
    const synthesizing = useDebateStore((s) => s.synthesizing);
    const running = useDebateStore((s) => s.running);
    const error = useDebateStore((s) => s.error);
    const modelA = useDebateStore((s) => s.modelA);
    const modelB = useDebateStore((s) => s.modelB);
    if (!running && rounds.length === 0 && !synthesis && !error) return null;

    const col = (who: string, color: string, text: string, live: boolean) => {
        const shown = debateVisible(text);
        return (
        <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--cl-border, #2a2a2a)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ color, fontWeight: 600, fontSize: 11, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                {shown ? <Markdown text={shown} /> : <span style={{ color: 'var(--cl-muted, #888)' }}>{text ? 'thinking…' : 'waiting…'}</span>}
                {live && <span className="cl-cursor" />}
            </div>
        </div>
        );
    };

    return (
        <div className="cl-msg cl-msg--assistant cl-msg__wrap">
            <div className="cl-msg__body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--cl-muted, #888)', marginBottom: 6 }}>
                    <span>⚖ Debate</span>
                    <span style={{ color: '#4fc3f7' }}>{modelA || 'Model A'}</span>
                    <span>vs</span>
                    <span style={{ color: '#ffb74d' }}>{modelB || 'Model B'}</span>
                </div>
                {rounds.map((r) => (
                    <div key={r.round} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--cl-muted, #888)', marginBottom: 4 }}>
                            Round {r.round}{!r.complete && running ? ' · streaming…' : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {col(modelA || 'Model A', '#4fc3f7', r.textA, !r.complete && running && !r.textB)}
                            {col(modelB || 'Model B', '#ffb74d', r.textB, !r.complete && running && !!r.textA && !r.textB)}
                        </div>
                    </div>
                ))}
                {synthesizing && <div className="cl-status">⚖ Synthesizing a verdict…</div>}
                {synthesis && (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--cl-border, #2a2a2a)', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--cl-muted, #888)', marginBottom: 4 }}>⚖ Synthesis</div>
                        <Markdown text={debateVisible(synthesis)} />
                    </div>
                )}
                {error && <div className="cl-errline" style={{ marginTop: 6 }}>{error}</div>}
            </div>
        </div>
    );
}

function Stream() {
    const items = useAgentRunStore((s) => s.items);
    const running = useAgentRunStore((s) => s.running);
    const ref = useRef<HTMLDivElement>(null);
    // Claude-desktop scroll behavior: follow the stream only while the user is
    // already at the bottom; never yank them back down while they read history.
    const pinnedRef = useRef(true);
    const [pinned, setPinned] = useState(true);
    const onScroll = () => {
        const el = ref.current;
        if (!el) return;
        const p = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        pinnedRef.current = p;
        setPinned(p);
    };
    useEffect(() => { if (pinnedRef.current && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [items, running]);
    const jump = () => {
        const el = ref.current;
        if (el) el.scrollTop = el.scrollHeight;
        pinnedRef.current = true;
        setPinned(true);
    };
    const lastAssistant = [...items].reverse().find((x) => x.kind === 'assistant');
    const lastUser = [...items].reverse().find((x) => x.kind === 'user');
    const lastItem = items[items.length - 1];
    const copy = (t: string) => navigator.clipboard?.writeText(t);
    const [lightbox, setLightbox] = useState<string | null>(null);

    return (
        <>
        <div className="cl-stream" ref={ref} onScroll={onScroll}><div className="cl-col">
            {items.map((it) => {
                switch (it.kind) {
                    case 'user':
                        return (
                            <div key={it.id} className="cl-msg cl-msg--user cl-msg__wrap">
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    {it.images && it.images.length > 0 && (
                                        <div className="cl-msg-imgs">{it.images.map((im, k) => { const src = `data:${im.mimeType};base64,${im.dataBase64}`; return <img key={k} className="cl-thumb" src={src} onClick={() => setLightbox(src)} />; })}</div>
                                    )}
                                    {it.text && <div className="cl-msg__body">{it.text}</div>}
                                    <div className="cl-acts">
                                        <button className="cl-act" onClick={() => copy(it.text)}>Copy</button>
                                        {!running && it.id === lastUser?.id && <button className="cl-act" onClick={async () => useAgentRunStore.getState().setComposerDraft(await editLast())}>Edit</button>}
                                    </div>
                                </div>
                            </div>
                        );
                    case 'assistant':
                        return (
                            <div key={it.id} className="cl-msg cl-msg--assistant cl-msg__wrap">
                                {(() => {
                                    const { thinking, visible } = extractThink(it.text);
                                    return (
                                        <div className="cl-msg__body">
                                            {thinking && (
                                                <details className="cl-status" style={{ margin: '0 0 8px' }}>
                                                    <summary style={{ cursor: 'pointer' }}>Thought process</summary>
                                                    <div style={{ whiteSpace: 'pre-wrap', padding: '6px 0', fontStyle: 'italic' }}>{thinking}</div>
                                                </details>
                                            )}
                                            <Markdown text={visible} />
                                            {running && lastItem?.id === it.id && <span className="cl-cursor" />}
                                            <ArtifactBadges text={visible} />
                                        </div>
                                    );
                                })()}
                                <div className="cl-acts">
                                    {it.model && <span className="cl-modelbadge">{it.model}</span>}
                                    <button className="cl-act" onClick={() => copy(it.text)}>Copy</button>
                                    {!running && it.id === lastAssistant?.id && <button className="cl-act" onClick={regenerate}>Regenerate</button>}
                                </div>
                            </div>
                        );
                    case 'thinking':
                        return <details key={it.id} className="cl-status" style={{ margin: '8px 0' }}><summary style={{ cursor: 'pointer' }}>Thought process</summary><div style={{ whiteSpace: 'pre-wrap', padding: '6px 0', fontStyle: 'italic' }}>{it.text}</div></details>;
                    case 'tool': return <ToolCallCard key={it.id} item={it} />;
                    case 'permission': return <PermissionPrompt key={it.id} req={it.req} resolved={it.resolved} />;
                    case 'question': {
                        const picks = it.answers ? Object.values(it.answers).flat() : [];
                        return (
                            <div key={it.id} className="cl-status">
                                {it.answers
                                    ? (picks.length ? `Answered: ${picks.join(', ')}` : 'Skipped')
                                    : (it as any).dismissed
                                        ? 'Question dismissed (run stopped)'
                                        : 'Waiting for your selection below…'}
                            </div>
                        );
                    }
                    case 'status': return <div key={it.id} className="cl-status">{it.text}</div>;
                    case 'error': return <div key={it.id} className="cl-errline">{it.text}</div>;
                    default: return null;
                }
            })}
            <DebateBlock />
            {running && lastItem && lastItem.kind !== 'assistant' && (
                <div className="cl-typing"><span /><span /><span /></div>
            )}
        </div>
        {!pinned && (
            <div className="cl-jumpwrap"><button className="cl-jump" onClick={jump} title="Jump to latest">↓</button></div>
        )}
        </div>
        {lightbox && <Overlay onClose={() => setLightbox(null)}><img className="cl-lightbox-img" src={lightbox} onClick={() => setLightbox(null)} /></Overlay>}
        </>
    );
}

async function listProjectFiles(root: string): Promise<{ rel: string; path: string }[]> {
    const out: { rel: string; path: string }[] = [];
    const walk = async (dir: string, depth: number) => {
        if (depth > 2 || out.length > 400) return;
        const entries: FileEntry[] = await window.vibe.readDir(dir).catch(() => []);
        for (const e of entries) {
            if (out.length > 400) return;
            if (e.isDirectory) await walk(e.path, depth + 1);
            else out.push({ rel: e.path.replace(root, '').replace(/^[/\\]/, ''), path: e.path });
        }
    };
    await walk(root, 0);
    return out;
}

/** Token telemetry: this conversation inline, lifetime in the tooltip. */
function UsageChip() {
    const usage = useAgentRunStore((s) => s.usage);
    const totalInput = useUsageStore((s) => s.totalInput);
    const totalOutput = useUsageStore((s) => s.totalOutput);
    const runs = useUsageStore((s) => s.runs);
    if (usage.inputTokens === 0 && usage.outputTokens === 0) return null;
    return (
        <span className="cl-usagechip"
            title={`This conversation. Lifetime: ${fmtTokens(totalInput)}↑ ${fmtTokens(totalOutput)}↓ across ${runs} runs`}>
            {fmtTokens(usage.inputTokens)}↑ {fmtTokens(usage.outputTokens)}↓
        </span>
    );
}

/** Build <-> Plan. Build executes end-to-end with no "shall I proceed?" turns;
    Plan is a read-only run that ends with a plan awaiting approval. */
function AgentModeChip() {
    const mode = useSettingsStore((s) => s.agentMode);
    const toggle = () => useSettingsStore.getState().setAgentMode(mode === 'plan' ? 'build' : 'plan');
    return (
        <button
            className={`cl-modelchip ${mode === 'plan' ? 'cl-modelchip--plan' : ''}`}
            onClick={toggle}
            title={mode === 'plan'
                ? 'Plan mode: read-only. The agent researches, proposes a numbered plan, and waits for your approval. Click for Build.'
                : 'Build mode: the agent executes end-to-end and never stops to ask "should I proceed?". Click for Plan.'}
        >
            {mode === 'plan' ? 'Plan' : 'Build'}
        </button>
    );
}

/** Toggle beside the model chip: Ask first <-> Allow all (auto-approve). */
function PermissionModeChip() {
    const mode = useSettingsStore((s) => s.permissionMode);
    const toggle = () => {
        const next = mode === 'auto' ? 'ask' : 'auto';
        useSettingsStore.getState().setPermissionMode(next);
        if (next === 'auto') approveAllPending(); // unblock anything already waiting
    };
    return (
        <button
            className={`cl-modelchip ${mode === 'auto' ? 'cl-modelchip--auto' : ''}`}
            onClick={toggle}
            title={mode === 'auto'
                ? 'All tool calls run without asking. Click to require approval.'
                : 'Risky tool calls ask for approval. Click to allow everything.'}
        >
            {mode === 'auto' ? 'Allow all' : 'Ask first'}
        </button>
    );
}

function Composer({ centered }: { centered?: boolean }) {
    const [input, setInput] = useState('');
    const [showModel, setShowModel] = useState(false);
    const [images, setImages] = useState<{ mimeType: string; dataBase64: string; name: string }[]>([]);
    const [attachments, setAttachments] = useState<{ name: string; text: string }[]>([]);
    const [fileList, setFileList] = useState<{ rel: string; path: string }[]>([]);
    const [active, setActive] = useState(0);
    const running = useAgentRunStore((s) => s.running);
    const surface = useAgentRunStore((s) => s.surface);
    const draft = useAgentRunStore((s) => s.composerDraft);
    const selectedModel = useOllamaStore((s) => s.selectedModel);
    const projectPath = useUIStore((s) => s.projectPath);
    const taRef = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // -- Debate mode (inline, in the cowork chat) --------------------------
    const [debateOn, setDebateOn] = useState(false);
    const [modelB, setModelB] = useState('');
    const [rounds, setRounds] = useState(2);
    const debateRunning = useDebateStore((s) => s.running);
    const simultaneous = useDebateStore((s) => s.simultaneous);
    const setSimultaneous = useDebateStore((s) => s.setSimultaneous);
    const localModels = useOllamaStore((s) => s.models);
    const cloudNames = useOllamaStore((s) => s.cloudModelNames);
    // Model A is the current chat model; Model B is any OTHER available model.
    const modelBOptions = useMemo(
        () => [...new Set([...cloudNames, ...localModels])].filter((m) => m !== selectedModel),
        [cloudNames, localModels, selectedModel],
    );

    useEffect(() => { if (draft) { setInput(draft); useAgentRunStore.getState().setComposerDraft(''); setTimeout(() => taRef.current?.focus(), 0); } }, [draft]);
    useEffect(() => { if (projectPath) listProjectFiles(projectPath).then(setFileList); else setFileList([]); }, [projectPath]);
    const autosize = () => { const el = taRef.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 220) + 'px'; } };

    const slashActive = input.startsWith('/') && !input.includes(' ');
    const slashMatches = useMemo(() => slashActive ? SLASH_COMMANDS.filter((s) => s.cmd.startsWith(input.toLowerCase())) : [], [slashActive, input]);
    const atMatch = input.match(/(?:^|\s)@([\w./\\-]*)$/);
    const atQuery = atMatch ? atMatch[1].toLowerCase() : null;
    const atMatches = useMemo(() => atQuery !== null ? fileList.filter((f) => f.rel.toLowerCase().includes(atQuery)).slice(0, 8) : [], [atQuery, fileList]);
    useEffect(() => { setActive(0); }, [input]);

    const ctx: SlashCtx = {
        fill: (t) => { setInput(t); setTimeout(() => { taRef.current?.focus(); autosize(); }, 0); },
        send: (t) => { setInput(''); if (taRef.current) taRef.current.style.height = 'auto'; runTurn(t); },
        openModel: () => setShowModel(true),
        note: (md) => useAgentRunStore.getState().pushAssistant(md),
    };
    const pickSlash = (cmd: typeof SLASH_COMMANDS[number]) => { setInput(''); cmd.run(ctx); };
    const pickFile = async (f: { rel: string; path: string }) => {
        setInput((prev) => prev.replace(/@([\w./\\-]*)$/, `@${f.rel} `));
        const text = await window.vibe.readFile(f.path).catch(() => '');
        if (text) setAttachments((a) => a.some((x) => x.name === f.rel) ? a : [...a, { name: f.rel, text: text.slice(0, 20000) }]);
        setTimeout(() => taRef.current?.focus(), 0);
    };
    // FileReader, NOT String.fromCharCode(...bytes): spreading a screenshot-sized
    // Uint8Array as arguments overflows the call stack, which is why pasted
    // screenshots silently never appeared.
    const fileToB64 = (f: File) => new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => { const s = String(r.result || ''); resolve(s.slice(s.indexOf(',') + 1)); };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
    });
    const addFiles = async (files: File[]) => {
        for (const f of files) {
            if (f.type.startsWith('image/')) {
                if (f.size > 15 * 1024 * 1024) { useAgentRunStore.getState().pushAssistant(`_Image ${f.name || ''} is over 15 MB - too large to send._`); continue; }
                try {
                    const b64 = await fileToB64(f);
                    setImages((p) => [...p, { mimeType: f.type, dataBase64: b64, name: f.name || 'screenshot.png' }]);
                } catch { /* unreadable image - skip */ }
            } else {
                const text = await f.text().catch(() => '');
                if (text) setAttachments((a) => [...a, { name: f.name, text: text.slice(0, 20000) }]);
            }
        }
    };
    const filesFromDataTransfer = (dt: DataTransfer): File[] => {
        const out: File[] = [];
        for (const it of Array.from(dt.items || [])) {
            if (it.kind === 'file') { const f = it.getAsFile(); if (f) out.push(f); }
        }
        const files = out.length ? out : Array.from(dt.files);
        return files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('text/') || /\.(txt|md|json|csv|log|ts|tsx|js|jsx|py|c|cpp|h|ino|rs|go|java|yml|yaml|toml|xml|html|css)$/i.test(f.name));
    };

    // Claude-desktop behavior: pasting a screenshot lands in the composer no
    // matter what has focus, not only when the caret is in the textarea.
    useEffect(() => {
        const onWinPaste = (e: ClipboardEvent) => {
            if (e.target === taRef.current) return; // textarea's own handler covers this
            if (!e.clipboardData) return;
            const usable = filesFromDataTransfer(e.clipboardData);
            if (usable.length) { e.preventDefault(); addFiles(usable); taRef.current?.focus(); }
        };
        window.addEventListener('paste', onWinPaste);
        return () => window.removeEventListener('paste', onWinPaste);
    }, []);

    const send = () => {
        // Debate mode: a running debate takes the message as an interjection to
        // BOTH models; otherwise this starts a fresh debate (Model A = the chat
        // model, Model B = the picked opponent). Falls through to normal chat off.
        if (debateOn) {
            const text = input.trim();
            if ((!text && images.length === 0) || !selectedModel) return;
            if (debateRunning) {
                if (text) useDebateStore.getState().interject(text);
                setInput(''); if (taRef.current) taRef.current.style.height = 'auto';
                return;
            }
            if (!modelB) { useAgentRunStore.getState().pushAssistant('_Pick a second model (Model B) to debate against._'); return; }
            // Same input plumbing as a normal turn: fold attached files into text,
            // pass images through so the kernel's vision pass handles them.
            let composed = input;
            if (attachments.length) composed = attachments.map((a) => `Attached file ${a.name}:\n\`\`\`\n${a.text}\n\`\`\``).join('\n\n') + (composed ? `\n\n${composed}` : '');
            const imgs = images.map((i) => ({ mimeType: i.mimeType, dataBase64: i.dataBase64 }));
            const ds = useDebateStore.getState();
            ds.setModelA(selectedModel); ds.setModelB(modelB); ds.setMaxRounds(rounds); ds.reset();
            useAgentRunStore.getState().pushUser(text, imgs);
            ds.startDebate(composed, imgs, useSettingsStore.getState().apiKeys as Record<string, string>);
            setInput(''); setImages([]); setAttachments([]);
            if (taRef.current) taRef.current.style.height = 'auto';
            return;
        }
        if ((!input.trim() && images.length === 0 && attachments.length === 0) || running || !selectedModel) return;
        let text = input;
        if (attachments.length) text = attachments.map((a) => `Attached file ${a.name}:\n\`\`\`\n${a.text}\n\`\`\``).join('\n\n') + (text ? `\n\n${text}` : '');
        const imgs = images.map((i) => ({ mimeType: i.mimeType, dataBase64: i.dataBase64 }));
        setInput(''); setImages([]); setAttachments([]);
        if (taRef.current) taRef.current.style.height = 'auto';
        runTurn(text, imgs);
    };

    const menuOpen = slashMatches.length > 0 || atMatches.length > 0;
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (menuOpen) {
            const list = slashMatches.length > 0 ? slashMatches : atMatches;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); slashMatches.length > 0 ? pickSlash(slashMatches[active]) : pickFile(atMatches[active]); return; }
            if (e.key === 'Escape') { e.preventDefault(); setInput((v) => v.replace(/@([\w./\\-]*)$/, '').replace(/^\/\S*$/, '')); return; }
        }
        // Enter must never kill a running stream (losing a whole turn to a reflexive
        // keypress). Stop is the ■ button or Escape - a deliberate action.
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!running) send(); }
        if (e.key === 'Escape' && (running || debateRunning)) { e.preventDefault(); if (debateRunning) useDebateStore.getState().cancelDebate(); else cancelRun(); }
    };

    return (
        <div className={centered ? 'cl-composer-wrap cl-composer-wrap--center' : undefined} style={{ width: '100%', maxWidth: centered ? undefined : 760, margin: centered ? undefined : '0 auto' }}>
            {showModel && <ModelPicker onClose={() => setShowModel(false)} />}
            <div className="cl-composer" style={{ position: 'relative' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => { e.preventDefault(); await addFiles(Array.from(e.dataTransfer.files)); }}>
                {slashMatches.length > 0 && (
                    <div className="cl-menu">
                        {slashMatches.map((s, i) => <div key={s.cmd} className={`cl-menu__row ${i === active ? 'cl-menu__row--active' : ''}`} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pickSlash(s); }}><b style={{ minWidth: 96 }}>{s.cmd}</b><span>{s.desc}</span><span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--cl-muted)' }}>{s.group}</span></div>)}
                    </div>
                )}
                {slashMatches.length === 0 && atMatches.length > 0 && (
                    <div className="cl-menu">
                        {atMatches.map((f, i) => <div key={f.path} className={`cl-menu__row ${i === active ? 'cl-menu__row--active' : ''}`} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pickFile(f); }}>{f.rel}</div>)}
                    </div>
                )}
                {(images.length > 0 || attachments.length > 0) && (
                    <div className="cl-imgchips">
                        {images.map((img, i) => <span key={`i${i}`} className="cl-imgchip"><img className="cl-thumb-sm" src={`data:${img.mimeType};base64,${img.dataBase64}`} />{img.name}<button onClick={() => setImages((p) => p.filter((_, j) => j !== i))}>x</button></span>)}
                        {attachments.map((a, i) => <span key={`a${i}`} className="cl-imgchip">@ {a.name}<button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>x</button></span>)}
                    </div>
                )}
                <textarea ref={taRef} value={input}
                    onChange={(e) => { setInput(e.target.value); autosize(); }}
                    onPaste={async (e) => {
                        const usable = filesFromDataTransfer(e.clipboardData);
                        if (usable.length) { e.preventDefault(); await addFiles(usable); }
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={running ? 'Working…  (Esc or ■ to stop)' : `Message ${surface[0].toUpperCase() + surface.slice(1)}…   ( / for commands, @ for files )`}
                    rows={1} />
                <input
                    ref={fileRef} type="file" multiple style={{ display: 'none' }}
                    accept="image/*,.txt,.md,.json,.csv,.log,.ts,.tsx,.js,.jsx,.py,.c,.cpp,.h,.ino,.rs,.go,.java,.yml,.yaml,.toml,.xml,.html,.css"
                    onChange={async (e) => {
                        const fs = Array.from(e.target.files || []);
                        if (fs.length) await addFiles(fs);
                        e.target.value = ''; // allow re-attaching the same file
                        taRef.current?.focus();
                    }}
                />
                {debateOn && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px 8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--cl-muted, #888)' }}>⚖ <span style={{ color: '#4fc3f7' }}>{selectedModel || 'Model A'}</span> vs</span>
                        <select className="cl-input" style={{ maxWidth: 220, fontSize: 12, padding: '2px 6px' }} value={modelB} onChange={(e) => setModelB(e.target.value)} disabled={debateRunning}>
                            <option value="">Pick Model B…</option>
                            {modelBOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <span style={{ fontSize: 11, color: 'var(--cl-muted, #888)' }}>rounds</span>
                        <select className="cl-input" style={{ width: 56, fontSize: 12, padding: '2px 6px' }} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} disabled={debateRunning}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <button
                            type="button"
                            onClick={() => setSimultaneous(!simultaneous)}
                            disabled={debateRunning}
                            title={simultaneous ? 'Simultaneous: both models answer at once each round, then rebut the other’s previous answer' : 'Sequential: Model A answers, then Model B answers having seen A'}
                            style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--cl-border, #333)', background: simultaneous ? 'var(--cl-accent)' : 'transparent', color: simultaneous ? '#fff' : 'var(--cl-text-2, #888)', cursor: 'pointer', fontWeight: 600 }}
                        >{simultaneous ? '⇉ simultaneous' : '→ sequential'}</button>
                        {debateRunning && <span style={{ fontSize: 11, color: 'var(--cl-muted, #888)' }}>· type to interject both models</span>}
                    </div>
                )}
                <div className="cl-composer__row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <button className="cl-attach" title="Attach images or files (or paste / drag-drop)" onClick={() => fileRef.current?.click()}>+</button>
                        <button className="cl-modelchip" onClick={() => setShowModel(true)}>{selectedModel || 'Select model'}</button>
                        <AgentModeChip />
                        <PermissionModeChip />
                        <button
                            className={`cl-modelchip ${debateOn ? 'cl-modelchip--auto' : ''}`}
                            onClick={() => setDebateOn((v) => !v)}
                            title="Debate mode: two models answer, then critique and rebut each other in turn, streamed side by side. Model A is the current chat model; pick a Model B.">
                            ⚖ Debate
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <UsageChip />
                        {(() => {
                            const busy = running || debateRunning;
                            const stop = () => { if (debateRunning) useDebateStore.getState().cancelDebate(); else cancelRun(); };
                            const disabled = !busy && (debateOn
                                ? (!input.trim() || !selectedModel || !modelB)
                                : ((!input.trim() && images.length === 0 && attachments.length === 0) || !selectedModel));
                            return (
                                <button className={busy ? 'cl-send cl-send--stop' : 'cl-send'} onClick={busy ? stop : send} disabled={disabled}>{busy ? '■' : '↑'}</button>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}
