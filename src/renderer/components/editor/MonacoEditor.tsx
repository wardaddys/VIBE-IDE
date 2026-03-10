import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import { useEditorStore } from '../../store/editor';
import { useFileSystem } from '../../hooks/useFileSystem';

self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'typescript' || label === 'javascript') return new tsWorker();
        if (label === 'json') return new jsonWorker();
        if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
        return new editorWorker();
    }
};

monaco.editor.defineTheme('vibe-light', {
    base: 'vs',
    inherit: true,
    rules: [
        { token: 'comment', foreground: '8888a0', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0055cc' },
        { token: 'string', foreground: '00875a' },
        { token: 'number', foreground: 'e68a00' },
        { token: 'type', foreground: '0066ff' },
        { token: 'function', foreground: '6b40bf' },
        { token: 'variable', foreground: '1a1a2e' },
        { token: 'operator', foreground: '4a4a68' },
    ],
    colors: {
        'editor.background': '#00000000',
        'editor.foreground': '#1a1a2e',
        'editor.lineHighlightBackground': '#0066ff08',
        'editor.selectionBackground': '#0066ff18',
        'editorCursor.foreground': '#0066ff',
        'editorLineNumber.foreground': '#aab0c0',
        'editorLineNumber.activeForeground': '#0066ff',
        'editorIndentGuide.background': '#00000008',
        'editorIndentGuide.activeBackground': '#00000015',
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#e4e5ea',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#e4e5ea',
        'editorSuggestWidget.selectedBackground': '#0066ff10',
        'scrollbarSlider.background': '#00000012',
        'scrollbarSlider.hoverBackground': '#00000020',
    }
});

function getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
        ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
        json: 'json', md: 'markdown', css: 'css', scss: 'scss', html: 'html',
        py: 'python', rs: 'rust', go: 'go', cpp: 'cpp', c: 'c', h: 'cpp',
        java: 'java', rb: 'ruby', php: 'php', sh: 'shell', bash: 'shell',
        yml: 'yaml', yaml: 'yaml', toml: 'toml', xml: 'xml', sql: 'sql',
        dockerfile: 'dockerfile', makefile: 'makefile',
    };
    return map[ext || ''] || 'plaintext';
}

const models = new Map<string, monaco.editor.ITextModel>();

export function MonacoEditor() {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const fileContents = useEditorStore(state => state.fileContents);
    const updateContent = useEditorStore(state => state.updateContent);
    const { writeFile } = useFileSystem();

    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const editor = monaco.editor.create(containerRef.current, {
            theme: 'vibe-light',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 24,
            letterSpacing: 0.3,
            minimap: { enabled: true, scale: 1, maxColumn: 60, renderCharacters: false, showSlider: 'mouseover' },
            scrollbar: { verticalScrollbarSize: 3, horizontalScrollbarSize: 3, useShadows: false },
            overviewRulerLanes: 0,
            overviewRulerBorder: false,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            automaticLayout: true,
            wordWrap: 'off',
            tabSize: 2,
            formatOnPaste: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            guides: { indentation: true, bracketPairs: true },
        });

        editorRef.current = editor;

        const changeDisposable = editor.onDidChangeModelContent(() => {
            const currentModel = editor.getModel();
            if (!currentModel) return;

            const val = editor.getValue();
            // Find which file is active
            const activeId = useEditorStore.getState().activeFileId;
            if (activeId && models.get(activeId) === currentModel) {
                updateContent(activeId, val);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    writeFile(activeId, val).catch(console.error);
                }, 1000);
            }
        });

        return () => {
            changeDisposable.dispose();
            editor.dispose();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [writeFile, updateContent]);

    useEffect(() => {
        if (!editorRef.current) return;

        if (!activeFileId) {
            editorRef.current.setModel(null);
            return;
        }

        let model = models.get(activeFileId);
        if (!model) {
            const content = fileContents[activeFileId] || '';
            const language = getLanguageFromPath(activeFileId);
            model = monaco.editor.createModel(content, language);
            models.set(activeFileId, model);
        }

        if (editorRef.current.getModel() !== model) {
            editorRef.current.setModel(model);
        }
    }, [activeFileId, fileContents]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: activeFileId ? 'block' : 'none'
                }}
            />
            {!activeFileId && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 48, opacity: 0.1, marginBottom: 16 }}>V</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Select a file to start coding</div>
                    </div>
                </div>
            )}
        </div>
    );
}
