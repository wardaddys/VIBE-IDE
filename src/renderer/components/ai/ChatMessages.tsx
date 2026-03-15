import React, { useEffect, useRef, useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';
import { ThinkBlock } from './ThinkBlock';
import { ThinkingIndicator } from './ThinkingIndicator';

/* ═══════════════════════════════════════════════════════════
   XML TAG EXTRACTION HELPER
   ═══════════════════════════════════════════════════════════ */
function extractTag(text: string, tag: string): string | null {
    try {
        const match = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return match ? match[1].trim() : null;
    } catch { return null; }
}

/* ═══════════════════════════════════════════════════════════
   SEGMENT TYPES
   ═══════════════════════════════════════════════════════════ */
interface Segment {
    type: 'text' | 'plan' | 'critique' | 'reflection' | 'verification' | 'done' | 'analyze' | 'execute' | 'write_file';
    content: string;
}

/* ═══════════════════════════════════════════════════════════
   XML RESPONSE PARSER
   Splits response into typed segments. Strips unrecognized tags.
   ═══════════════════════════════════════════════════════════ */
function parseAgentResponse(content: string): Segment[] {
    const segments: Segment[] = [];

    // Regex for all known top-level XML blocks
    const blockPattern = /(<plan>[\s\S]*?<\/plan>|<critique>[\s\S]*?<\/critique>|<reflection>[\s\S]*?<\/reflection>|<verification>[\s\S]*?<\/verification>|<done>[\s\S]*?<\/done>|<analyze>[\s\S]*?<\/analyze>|<execute>[\s\S]*?<\/execute>|<write_file[\s\S]*?<\/write_file>|<read_file\s[^>]*\/?>)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = blockPattern.exec(content)) !== null) {
        // Text before this block
        if (match.index > lastIndex) {
            const textBefore = content.slice(lastIndex, match.index);
            const cleaned = stripUnknownTags(textBefore).trim();
            if (cleaned) segments.push({ type: 'text', content: cleaned });
        }

        const block = match[0];
        if (block.startsWith('<plan>')) {
            segments.push({ type: 'plan', content: block });
        } else if (block.startsWith('<critique>')) {
            segments.push({ type: 'critique', content: block });
        } else if (block.startsWith('<reflection>')) {
            segments.push({ type: 'reflection', content: block });
        } else if (block.startsWith('<verification>')) {
            segments.push({ type: 'verification', content: block });
        } else if (block.startsWith('<done>')) {
            segments.push({ type: 'done', content: block });
        } else if (block.startsWith('<analyze>')) {
            segments.push({ type: 'analyze', content: block });
        } else if (block.startsWith('<execute>')) {
            segments.push({ type: 'execute', content: block });
        } else if (block.startsWith('<write_file')) {
            segments.push({ type: 'write_file', content: block });
        }
        // read_file is silently stripped — no segment added

        lastIndex = match.index + match[0].length;
    }

    // Remaining text after last block
    if (lastIndex < content.length) {
        const remaining = content.slice(lastIndex);
        const cleaned = stripUnknownTags(remaining).trim();
        if (cleaned) segments.push({ type: 'text', content: cleaned });
    }

    return segments;
}

/** Strip any unrecognized XML-like tags, keeping their inner text */
function stripUnknownTags(text: string): string {
    return text
        .replace(/<\/?(?:mission|steps|step[^>]*|criteria|risks|score|notes|proceed|evidence|remaining|summary|files_changed|criteria_met|issues|revised_plan)[^>]*>/gi, '')
        .trim();
}

/* ═══════════════════════════════════════════════════════════
   BEAUTIFUL UI COMPONENTS FOR AGENT PHASES
   ═══════════════════════════════════════════════════════════ */

/* ─── EXECUTION PLAN ─────────────────────────────────────── */
function PlanCard({ content }: { content: string }) {
    const [collapsed, setCollapsed] = useState(false);
    const mission = extractTag(content, 'mission') || '';
    const criteria = extractTag(content, 'criteria') || '';
    const risks = extractTag(content, 'risks') || '';
    const stepsRaw = content.match(/<step[^>]*>([\s\S]*?)<\/step>/gi) || [];
    const steps = stepsRaw.map(s => {
        const inner = s.match(/<step[^>]*>([\s\S]*?)<\/step>/i);
        return inner ? inner[1].trim() : '';
    }).filter(Boolean);

    return (
        <div className="agent-card agent-card--plan">
            <div className="agent-card__header" onClick={() => setCollapsed(!collapsed)}>
                <span className="agent-card__icon">🎯</span>
                <span className="agent-card__title">Execution Plan</span>
                <span className="agent-card__toggle">{collapsed ? '▸' : '▾'}</span>
            </div>
            {!collapsed && (
                <div className="agent-card__body">
                    {mission && <div className="agent-plan__mission">{mission}</div>}
                    {steps.length > 0 && (
                        <div className="agent-plan__steps">
                            {steps.map((s, i) => (
                                <div key={i} className="agent-plan__step">
                                    <span className="agent-plan__step-num">
                                        {['①','②','③','④','⑤','⑥','⑦','⑧','⑨','⑩'][i] || `${i+1}.`}
                                    </span>
                                    <span>{s}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {criteria && (
                        <div className="agent-plan__criteria">
                            <span className="agent-plan__criteria-label">Criteria:</span> {criteria}
                        </div>
                    )}
                    {risks && (
                        <div className="agent-plan__risks">
                            <span className="agent-plan__risks-label">⚠ Risks:</span> {risks}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* ─── CRITIQUE / PLAN REVIEW ─────────────────────────────── */
function CritiqueCard({ content }: { content: string }) {
    const scoreStr = extractTag(content, 'score') || '8';
    const score = parseInt(scoreStr, 10);
    const revisedPlan = extractTag(content, 'revised_plan') || '';
    const approved = score >= 7 || revisedPlan.toUpperCase().includes('APPROVED');
    const variant = approved ? 'approved' : 'revised';

    return (
        <div className={`agent-card agent-card--critique agent-card--critique-${variant}`}>
            <div className="agent-card__header">
                <span className="agent-card__icon">{approved ? '✓' : '↻'}</span>
                <span className="agent-card__title">Plan Review</span>
                <span className="agent-critique__score">Score: {score}/10</span>
            </div>
            <div className="agent-critique__status">
                {approved ? 'Approved' : 'Issues found — revising plan…'}
            </div>
        </div>
    );
}

/* ─── REFLECTION PILL ────────────────────────────────────── */
function ReflectionPill({ content }: { content: string }) {
    const scoreStr = extractTag(content, 'score') || '8';
    const score = parseInt(scoreStr, 10);
    const proceed = extractTag(content, 'proceed');
    const good = score >= 7;

    return (
        <span className={`agent-pill agent-pill--${good ? 'good' : 'retry'}`}>
            Score {score}/10 {good ? '✓' : '↻'} {proceed === 'no' ? 'Retrying' : 'Proceeding'}
        </span>
    );
}

/* ─── VERIFICATION CARD ──────────────────────────────────── */
function VerificationCard({ content }: { content: string }) {
    const criteriaMet = extractTag(content, 'criteria_met') || 'unknown';
    const remaining = extractTag(content, 'remaining') || '';
    const evidence = extractTag(content, 'evidence') || '';

    let icon = '✅'; let title = 'Mission Complete'; let variant = 'complete';
    if (criteriaMet === 'no') { icon = '⚠'; title = 'Incomplete'; variant = 'incomplete'; }
    if (criteriaMet === 'partial') { icon = '🔄'; title = 'Partially Complete'; variant = 'partial'; }

    return (
        <div className={`agent-card agent-card--verification agent-card--verification-${variant}`}>
            <div className="agent-card__header">
                <span className="agent-card__icon">{icon}</span>
                <span className="agent-card__title">{title}</span>
            </div>
            <div className="agent-card__body">
                {evidence && <div className="agent-verification__evidence">{evidence}</div>}
                {remaining && (
                    <div className="agent-verification__remaining">
                        <div className="agent-verification__remaining-title">Still needed:</div>
                        {remaining.split('\n').filter(Boolean).map((item, i) => (
                            <div key={i} className="agent-verification__remaining-item">• {item.replace(/^[-•]\s*/, '')}</div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── DONE CARD ──────────────────────────────────────────── */
function DoneCard({ content }: { content: string }) {
    const summary = extractTag(content, 'summary') || 'Task completed';
    const filesChanged = extractTag(content, 'files_changed') || '';

    return (
        <div className="agent-card agent-card--done">
            <div className="agent-card__header">
                <span className="agent-card__icon">✅</span>
                <span className="agent-card__title">Task Complete</span>
            </div>
            <div className="agent-card__body">
                <div className="agent-done__summary">{summary}</div>
                {filesChanged && (
                    <div className="agent-done__files">Files: {filesChanged}</div>
                )}
            </div>
        </div>
    );
}

/* ─── ANALYSIS CARD ──────────────────────────────────────── */
function AnalyzeCard({ content }: { content: string }) {
    const inner = extractTag(content, 'analyze') || content.replace(/<\/?analyze>/gi, '').trim();
    return (
        <div className="agent-card agent-card--analyze">
            <div className="agent-card__header">
                <span className="agent-card__icon">💭</span>
                <span className="agent-card__title">Analysis</span>
            </div>
            <div className="agent-card__body">
                <div className="agent-analyze__content">{inner}</div>
            </div>
        </div>
    );
}

/* ─── COMMAND BLOCK ──────────────────────────────────────── */
function CommandBlock({ command }: { command: string }) {
    const handleCopy = () => navigator.clipboard.writeText(command);
    return (
        <div className="agent-command">
            <div className="agent-command__header">
                <span className="agent-command__label">Terminal Command</span>
                <button onClick={handleCopy} className="agent-command__copy">Copy</button>
            </div>
            <div className="agent-command__body">
                <span className="agent-command__prompt">$</span>{command}
            </div>
        </div>
    );
}

/* ─── FILE WRITE BLOCK ───────────────────────────────────── */
function FileWriteBlock({ path, content }: { path: string, content: string }) {
    const projectPath = useUIStore(state => state.projectPath);
    const openFile = useEditorStore(state => state.openFile);
    const [written, setWritten] = useState(false);

    useEffect(() => {
        if (projectPath && !written) {
            const fullPath = `${projectPath}/${path}`;
            window.vibe.writeFile(fullPath, content).then(() => {
                setWritten(true);
                openFile(fullPath, content);
            }).catch(() => {});
        }
    }, [projectPath, path, content, written]);

    return (
        <div className={`agent-file-write ${written ? 'agent-file-write--done' : ''}`}>
            <div className={`agent-file-write__dot ${written ? 'agent-file-write__dot--done' : ''}`} />
            <div className="agent-file-write__info">
                <span className="agent-file-write__path">{path}</span>
                <span className={`agent-file-write__status ${written ? 'agent-file-write__status--done' : ''}`}>
                    {written ? 'SAVED' : 'SAVING…'}
                </span>
            </div>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   MAIN CHAT MESSAGES COMPONENT
   ═══════════════════════════════════════════════════════════ */
export function ChatMessages() {
    const messages = useOllamaStore(state => state.messages);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }, [messages, isGenerating]);

    const renderContent = (content: string) => {
        if (!content) return <span className="chat-empty">…</span>;

        // ── Special prefix-based blocks (unchanged) ──
        if (content.startsWith('__TERMINAL_OUTPUT__\n')) {
            const output = content.replace('__TERMINAL_OUTPUT__\n', '');
            return (
                <div className="chat-terminal-output">
                    <div className="chat-terminal-output__label">Terminal Output</div>
                    {output}
                </div>
            );
        }

        if (content.startsWith('__FILE_CONTENTS__')) {
            const firstNewline = content.indexOf('\n');
            const header = content.slice('__FILE_CONTENTS__ '.length, firstNewline);
            const body = content.slice(firstNewline + 1);
            return (
                <div className="chat-file-contents">
                    <div className="chat-file-contents__label">📄 Reading: {header}</div>
                    {body.slice(0, 600)}{body.length > 600 ? '\n… (truncated for display)' : ''}
                </div>
            );
        }

        if (content.startsWith('__SWARM_LABEL__')) {
            const label = content.replace('__SWARM_LABEL__', '');
            return <div className="chat-swarm-label">{label}</div>;
        }

        // ── Parse agent XML blocks ──
        const segments = parseAgentResponse(content);

        // If parser found nothing special, render as plain text
        if (segments.length === 0) return <span>{content}</span>;
        if (segments.length === 1 && segments[0].type === 'text') {
            return <span>{segments[0].content}</span>;
        }

        return (
            <>
                {segments.map((seg, i) => {
                    switch (seg.type) {
                        case 'plan': return <PlanCard key={i} content={seg.content} />;
                        case 'critique': return <CritiqueCard key={i} content={seg.content} />;
                        case 'reflection': return <ReflectionPill key={i} content={seg.content} />;
                        case 'verification': return <VerificationCard key={i} content={seg.content} />;
                        case 'done': return <DoneCard key={i} content={seg.content} />;
                        case 'analyze': return <AnalyzeCard key={i} content={seg.content} />;
                        case 'execute': {
                            const cmd = seg.content.replace(/<\/?execute>/g, '').trim();
                            return <CommandBlock key={i} command={cmd} />;
                        }
                        case 'write_file': {
                            const pathMatch = seg.content.match(/path=['"]([^'"]+)['"]/);
                            const filePath = pathMatch ? pathMatch[1] : 'unknown.txt';
                            const fileContent = seg.content.replace(/<write_file[^>]*>/, '').replace(/<\/write_file>/, '').trim();
                            return <FileWriteBlock key={i} path={filePath} content={fileContent} />;
                        }
                        case 'text':
                            return <span key={i}>{seg.content}</span>;
                        default:
                            return null;
                    }
                })}
            </>
        );
    };

    return (
        <div ref={containerRef} className="chat-messages">
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
                            <div className={`chat-bubble chat-bubble--${msg.role} ${isSpecialBlock ? 'chat-bubble--special' : ''}`}>
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
