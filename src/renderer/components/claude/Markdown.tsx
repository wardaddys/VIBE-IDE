import React from 'react';

/* Markdown -> React (no deps). Blocks Claude commonly emits: fenced code with
   lightweight highlighting + copy, GFM tables, task lists, nested lists,
   headings, blockquotes, hr, inline bold/italic/code/links. */

const KEYWORDS = new Set(('const let var function return if else for while do switch case break continue class extends new import from export default async await try catch finally throw typeof instanceof void this super yield in of null true false undefined def elif except with lambda pass raise fn pub struct enum impl match use mut public private static final interface type namespace')
    .split(' '));

function highlight(code: string): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d._]*\b)|([A-Za-z_$][\w$]*)/g;
    let last = 0; let m: RegExpExecArray | null; let i = 0;
    while ((m = re.exec(code)) !== null) {
        if (m.index > last) out.push(code.slice(last, m.index));
        if (m[1]) out.push(<span key={i} className="tok-com">{m[1]}</span>);
        else if (m[2]) out.push(<span key={i} className="tok-str">{m[2]}</span>);
        else if (m[3]) out.push(<span key={i} className="tok-num">{m[3]}</span>);
        else if (m[4]) {
            if (KEYWORDS.has(m[4])) out.push(<span key={i} className="tok-kw">{m[4]}</span>);
            else if (code[re.lastIndex] === '(') out.push(<span key={i} className="tok-fn">{m[4]}</span>);
            else out.push(m[4]);
        }
        last = re.lastIndex; i++;
    }
    if (last < code.length) out.push(code.slice(last));
    return out;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
    const [copied, setCopied] = React.useState(false);
    const copy = () => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); };
    return (
        <div className="cl-code">
            <div className="cl-code__bar">
                <span className="cl-code__lang">{lang || 'code'}</span>
                <button className="cl-code__copy" onClick={copy}>{copied ? 'copied' : 'copy'}</button>
            </div>
            <pre><code>{highlight(code)}</code></pre>
        </div>
    );
}

/** Add a viewBox when the svg only has width/height, so CSS scaling scales
    instead of cropping. */
function ensureViewBox(code: string): string {
    const open = code.match(/<svg[^>]*>/i)?.[0];
    if (!open || /viewBox=/i.test(open)) return code;
    const w = open.match(/width\s*=\s*"([\d.]+)/i)?.[1];
    const h = open.match(/height\s*=\s*"([\d.]+)/i)?.[1];
    if (!w || !h) return code;
    return code.replace(open, open.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`));
}

/** WYSIWYG svg document: the WHOLE graphic scales to fit its box - the inline
    view and the expanded view must show the same picture, never a crop. */
export function svgFitDoc(code: string): string {
    return `<!doctype html><html><head><style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden}
body{display:grid;place-items:center}
svg{max-width:100%;max-height:100%;width:auto;height:auto}
</style></head><body>${ensureViewBox(code)}</body></html>`;
}

/** Inline-rendered SVG block: sandboxed iframe (no scripts, no origin access). */
function SvgBlock({ code }: { code: string }) {
    const [showCode, setShowCode] = React.useState(false);
    const [expanded, setExpanded] = React.useState(false);
    const srcDoc = svgFitDoc(code);
    return (
        <div className="cl-svgblock">
            <iframe title="svg" sandbox="" srcDoc={srcDoc} />
            <div className="cl-code__bar" style={{ borderTop: '1px solid var(--cl-border-soft)' }}>
                <span className="cl-code__lang">svg</span>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="cl-code__copy" onClick={() => setExpanded(true)}>expand</button>
                    <button className="cl-code__copy" onClick={() => setShowCode((v) => !v)}>{showCode ? 'hide code' : 'code'}</button>
                </div>
            </div>
            {showCode && <CodeBlock lang="svg" code={code} />}
            {expanded && (
                <div className="cl-svglightbox" onClick={() => setExpanded(false)}>
                    <iframe title="svg-full" sandbox="" srcDoc={srcDoc} onClick={(e) => e.stopPropagation()} />
                    <button className="cl-svglightbox__close" onClick={() => setExpanded(false)}>Close</button>
                </div>
            )}
        </div>
    );
}

/** Allow only web-safe link schemes. Model output is untrusted: a
    `javascript:`/`data:`/`vbscript:` href would execute in the renderer (which
    holds the powerful `window.vibe` bridge) on click. Returns null to drop. */
function safeHref(url: string): string | null {
    const u = url.trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;      // explicit web schemes
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null;  // any other scheme -> drop
    return u;                                          // relative path / #anchor
}

function inline(text: string, keyBase: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0; let m: RegExpExecArray | null; let i = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) nodes.push(text.slice(last, m.index));
        if (m[2] !== undefined) nodes.push(<strong key={`${keyBase}-${i}`}>{m[2]}</strong>);
        else if (m[3] !== undefined) nodes.push(<em key={`${keyBase}-${i}`}>{m[3]}</em>);
        else if (m[4] !== undefined) nodes.push(<code key={`${keyBase}-${i}`} className="inline">{m[4]}</code>);
        else if (m[5] !== undefined) {
            const href = safeHref(m[6]);
            nodes.push(href
                ? <a key={`${keyBase}-${i}`} href={href} target="_blank" rel="noreferrer noopener">{m[5]}</a>
                : <span key={`${keyBase}-${i}`}>{m[5]}</span>);
        }
        last = m.index + m[0].length; i++;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
}

function indentOf(line: string): number { const m = line.match(/^(\s*)/); return m ? Math.floor(m[1].replace(/\t/g, '  ').length / 2) : 0; }

/** Parse a contiguous list block (possibly nested) starting at lines[i]. */
function parseList(lines: string[], start: number, key: number): { node: React.ReactNode; next: number } {
    const isItem = (l: string) => /^\s*([-*+]|\d+\.)\s+/.test(l);
    const ordered = /^\s*\d+\.\s+/.test(lines[start]);
    const baseIndent = indentOf(lines[start]);
    const items: React.ReactNode[] = [];
    let i = start; let li = 0;
    while (i < lines.length && isItem(lines[i]) && indentOf(lines[i]) === baseIndent) {
        let content = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
        const task = content.match(/^\[([ xX])\]\s+(.*)$/);
        i++;
        // gather nested children (deeper indent)
        const children: React.ReactNode[] = [];
        while (i < lines.length && isItem(lines[i]) && indentOf(lines[i]) > baseIndent) {
            const sub = parseList(lines, i, key + 100 + li);
            children.push(sub.node); i = sub.next;
        }
        if (task) {
            items.push(<li key={li} className="cl-task"><input type="checkbox" checked={task[1].toLowerCase() === 'x'} readOnly /><span>{inline(task[2], `t${key}-${li}`)}{children}</span></li>);
        } else {
            items.push(<li key={li}>{inline(content, `li${key}-${li}`)}{children}</li>);
        }
        li++;
    }
    const anyTask = lines[start] && /^\s*[-*+]\s+\[[ xX]\]/.test(lines[start]);
    const node = ordered ? <ol key={key}>{items}</ol> : <ul key={key} className={anyTask ? 'cl-tasks' : undefined}>{items}</ul>;
    return { node, next: i };
}

export function Markdown({ text }: { text: string }) {
    const blocks: React.ReactNode[] = [];
    const lines = text.split('\n');
    let i = 0; let key = 0;

    while (i < lines.length) {
        const line = lines[i];
        const fence = line.match(/^```(\w*)\s*$/);
        if (fence) {
            const lang = fence[1]; const buf: string[] = []; i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
            i++;
            const body = buf.join('\n');
            // SVG renders inline (sandboxed), with the source one toggle away.
            // Sniff content too: models emit svg inside plain/xml/html fences.
            const isSvg = lang.toLowerCase() === 'svg'
                || (/^\s*<svg[\s>]/i.test(body) && ['', 'xml', 'html'].includes(lang.toLowerCase()));
            blocks.push(isSvg
                ? <SvgBlock key={key++} code={body} />
                : <CodeBlock key={key++} lang={lang} code={body} />);
            continue;
        }
        // RAW <svg> dumped straight into prose (no fence at all - very common):
        // collect until </svg> and render it. While still streaming (unclosed),
        // show it as code so it doesn't flash half-parsed markup.
        if (/^\s*<svg[\s>]/i.test(line)) {
            const buf: string[] = [];
            let closed = false;
            while (i < lines.length) {
                buf.push(lines[i]);
                if (/<\/svg>/i.test(lines[i])) { closed = true; i++; break; }
                i++;
            }
            blocks.push(closed
                ? <SvgBlock key={key++} code={buf.join('\n')} />
                : <CodeBlock key={key++} lang="svg" code={buf.join('\n')} />);
            continue;
        }
        // table: header row + separator row of --- | ---
        if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
            const header = splitRow(line);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') { rows.push(splitRow(lines[i])); i++; }
            blocks.push(
                <table key={key++}>
                    <thead><tr>{header.map((h, j) => <th key={j}>{inline(h, `th${key}-${j}`)}</th>)}</tr></thead>
                    <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, `td${key}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
                </table>
            );
            continue;
        }
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) { const lvl = h[1].length; const c = inline(h[2], `h${key}`); blocks.push(lvl === 1 ? <h1 key={key++}>{c}</h1> : lvl === 2 ? <h2 key={key++}>{c}</h2> : <h3 key={key++}>{c}</h3>); i++; continue; }
        if (/^(---|\*\*\*|___)\s*$/.test(line)) { blocks.push(<hr key={key++} />); i++; continue; }
        if (/^>\s?/.test(line)) { const buf: string[] = []; while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; } blocks.push(<blockquote key={key++}>{inline(buf.join(' '), `bq${key}`)}</blockquote>); continue; }
        if (/^\s*([-*+]|\d+\.)\s+/.test(line)) { const r = parseList(lines, i, key++); blocks.push(r.node); i = r.next; continue; }
        if (line.trim() === '') { i++; continue; }
        const buf: string[] = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^(```|#{1,3}\s|>\s?|\s*([-*+]|\d+\.)\s|---|\*\*\*|___)/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]))) { buf.push(lines[i]); i++; }
        blocks.push(<p key={key++}>{inline(buf.join('\n'), `p${key}`)}</p>);
    }
    return <div className="cl-md">{blocks}</div>;
}

function splitRow(line: string): string[] {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

/** Split inline <think>...</think> reasoning out of assistant text (handles a mid-stream unclosed tag). */
export function extractThink(text: string): { thinking: string; visible: string } {
    let thinking = '';
    let visible = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_m, t) => { thinking += t; return ''; });
    const m = visible.match(/<think>/i);
    if (m && m.index !== undefined) { thinking += visible.slice(m.index + m[0].length); visible = visible.slice(0, m.index); }
    return { thinking: thinking.trim(), visible: visible.trim() };
}
