import type { ModelCapability } from '../../shared/types';

export const OLLAMA_ONLY_MODELS = new Set<string>([
    'gpt-oss-120b',
]);

export async function fetchCapabilities(modelId: string): Promise<ModelCapability> {
    try {
        const result = await window.vibe.getModelCapabilities(modelId);
        if (!result) return getFallbackCapabilities(modelId);
        return {
            think: result.think,
            thinkBudget: result.thinkBudget,
            vision: result.vision,
            tools: result.tools,
            image: result.vision,
            canExecute: true,
            requiresApproval: true,
        };
    } catch {
        return getFallbackCapabilities(modelId);
    }
}

// Keep as fallback for cloud models Ollama doesn't know about
export function getFallbackCapabilities(modelId: string): ModelCapability {
    const lower = modelId.toLowerCase();
    const caps: ModelCapability = { canExecute: true, requiresApproval: true };

    if (lower.includes('qwq') || lower.includes('deepseek-r1') ||
        lower.includes('r1') || lower.includes('claude-3-7') ||
        lower.includes('claude-3-5') || lower.includes('qwen3')) {
        caps.think = true;
        caps.thinkBudget = lower.includes('claude') ? 'tiered' : 'toggle';
    }

    if (lower.includes('qwen2.5') || lower.includes('gemma3')) {
        caps.think = true;
        caps.thinkBudget = 'toggle';
    }

    if (lower.includes('vl') || lower.includes('vision') ||
        lower.includes('llava') || lower.includes('gemini') ||
        lower.includes('gpt-4o') || lower.includes('llama4')) {
        caps.vision = true;
        caps.image = true;
    }

    if (lower.includes('gemini') || lower.includes('gpt-4o') ||
        lower.includes('claude') || lower.includes('qwen') ||
        lower.includes('llama3')) {
        caps.tools = true;
    }

    if (lower.includes('reasoner') || lower.includes('o1') || lower.includes('o3') ||
        lower.includes('sonnet') || lower.includes('deepseek')) {
        caps.think = true;
    }

    if (lower.includes('gemini') || lower.includes('gpt-4o') ||
        lower.includes('claude') || lower.includes('cloud')) {
        caps.web = true;
    }

    return caps;
}

// Synchronous alias kept for backward compatibility (used in initial store hydration)
export function getCapabilities(modelId: string): ModelCapability {
    return getFallbackCapabilities(modelId);
}
