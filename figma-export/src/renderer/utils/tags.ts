export function getModelTags(modelName: string) {
    const tags: { label: string, color: string, bg: string }[] = [];
    const lower = modelName.toLowerCase();
    
    if (lower.includes('coder') || lower.includes('code')) {
        tags.push({ label: 'Coding', color: 'var(--accent)', bg: 'var(--accent-light)' });
    }
    if (lower.includes('reasoner') || lower.includes('o1') || lower.includes('r1')) {
        tags.push({ label: 'Thinking', color: 'var(--warn)', bg: 'var(--warn-light)' });
    }
    if (lower.includes('pro') || lower.includes('sonnet') || lower.includes('gpt-4') || lower.includes('v3')) {
        tags.push({ label: 'Research', color: 'var(--green)', bg: 'var(--green-light)' });
    }
    if (tags.length === 0) {
        tags.push({ label: 'General', color: 'var(--text-secondary)', bg: 'rgba(0,0,0,0.05)' });
    }
    return tags;
}
