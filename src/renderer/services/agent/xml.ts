export function extractTag(text: string, tag: string): string | null {
    try {
        const match = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return match ? match[1].trim() : null;
    } catch {
        return null;
    }
}
