export function cleanTerminalOutput(raw: string): string {
    return raw
        .replace(/\x1b\[[0-9;]*[mGKHFABCDJsu]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter(line => {
            const l = line.trim();
            if (l.length === 0) return false;
            // Remove PowerShell banner lines only
            if (l.startsWith('Windows PowerShell')) return false;
            if (l.includes('Microsoft Corporation') && l.includes('rights reserved')) return false;
            if (l.includes('aka.ms/pscore6')) return false;
            if (l.startsWith('Try the new cross-platform')) return false;
            // Remove bare PS prompt lines like "PS C:\Users\foo>"
            if (/^PS [A-Za-z]:\\[^>]*>\s*$/.test(l)) return false;
            return true;
        })
        .join('\n')
        .trim();
}
