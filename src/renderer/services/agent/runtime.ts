import { useOllamaStore } from '../../store/ollama';
import { useTerminalStore } from '../../store/terminal';
import { cleanTerminalOutput } from '../../utils/terminal';

interface StopAwareOptions {
    shouldStop?: () => boolean;
}

export function getThinkOptions() {
    const store = useOllamaStore.getState();
    const caps = store.modelCapabilities[store.selectedModel] ?? {};
    if (!caps.think || !store.thinkEnabled) return null;
    return { enabled: true, level: store.thinkLevel };
}

export async function pollTerminalOutput(
    termId: string,
    options: StopAwareOptions = {},
): Promise<string> {
    const { shouldStop } = options;

    let rawOutput = '';
    let pollAttempts = 0;
    const MAX_POLL = 60;

    while (pollAttempts < MAX_POLL) {
        if (shouldStop?.()) break;

        await new Promise(r => setTimeout(r, 500));
        rawOutput = await window.vibe.getTerminalOutput(termId);

        if (rawOutput.length > 3) {
            const lines = rawOutput.split('\n').filter(l => l.trim());
            const lastLine = lines[lines.length - 1]?.trim() || '';
            if (/^PS [A-Za-z]:\\/.test(lastLine)) break;
            if (rawOutput.length > 100 && pollAttempts >= 6) break;
        }
        pollAttempts++;
    }

    await window.vibe.clearTerminalOutput(termId);
    return cleanTerminalOutput(rawOutput);
}

export async function getProjectSnapshot(
    projectPath: string,
    options: StopAwareOptions = {},
): Promise<string> {
    const { shouldStop } = options;

    try {
        const terminalId = useTerminalStore.getState().activeTerminalId;
        if (!terminalId) return 'Project structure unavailable';

        await window.vibe.clearTerminalOutput(terminalId);
        window.vibe.sendTerminalInput(
            terminalId,
            `cd "${projectPath}"; ` +
            `Get-ChildItem -Recurse -Depth 3 ` +
            `-Exclude @('node_modules','build','dist','.git',` +
            `'__pycache__','.vibe') ` +
            `| Select-Object FullName | Format-Table -HideTableHeaders` +
            `\r`,
        );

        await new Promise(r => setTimeout(r, 3000));
        if (shouldStop?.()) {
            await window.vibe.clearTerminalOutput(terminalId);
            return 'Project scan canceled';
        }

        const raw = await window.vibe.getTerminalOutput(terminalId);
        await window.vibe.clearTerminalOutput(terminalId);

        const lines = raw
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('PS '))
            .map(l => l.replace(projectPath, '').replace(/^\\/, ''))
            .filter(l => l.length > 0)
            .slice(0, 150);

        return lines.join('\n') || 'Empty project';
    } catch {
        return 'Could not scan project';
    }
}

export async function getBriefingContext(): Promise<string> {
    try {
        const briefing = await window.vibe.getBriefing();
        if (briefing && briefing !== 'No project briefing available yet.') {
            return `\nPROJECT BRIEFING (from background intelligence):\n${briefing}\n`;
        }
    } catch {
        // Ignore background briefing failures; chat should continue.
    }
    return '';
}