import type { ModelCapability } from '../../shared/types';

export const OLLAMA_ONLY_MODELS = new Set<string>([
    'gpt-oss-120b',
]);

export function getCapabilities(modelId: string): ModelCapability {
    const lower = modelId.toLowerCase();
    const caps: ModelCapability = {};

    caps.canExecute = true; 
    caps.requiresApproval = true;

    if (
        lower.includes('qwq') ||
        lower.includes('deepseek-r1') ||
        lower.includes('r1') ||
        lower.includes('claude-3-7') ||
        lower.includes('claude-3-5')
    ) {
        caps.think = true;
        caps.thinkBudget = 'tiered';
    }

    if (
        lower.includes('qwen3') ||
        lower.includes('qwen2.5') ||
        lower.includes('gemma3')
    ) {
        caps.think = true;
        caps.thinkBudget = 'toggle';
    }

    if (lower.includes('vl') || lower.includes('vision') || lower.includes('llava') || lower.includes('gemini') || lower.includes('gpt-4o') || lower.includes('claude-3-5') || lower.includes('claude-3-7')) {
        caps.image = true;
    }

    if (lower.includes('reasoner') || lower.includes('r1') || lower.includes('o1') || lower.includes('o3') || lower.includes('sonnet') || lower.includes('deepseek')) {
        caps.think = true;
    }

    if (lower.includes('gemini') || lower.includes('gpt-4o') || lower.includes('claude') || lower.includes('cloud')) {
        caps.web = true;
    }

    return caps;
}
