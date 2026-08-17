/* Provider selection - routes a model id to the right adapter. */
import type { ProviderAdapter } from '../types';
import { ollamaAdapter, isOllamaModel } from './ollama';
import { openAiCompatAdapter } from './openaiCompat';
import { anthropicAdapter } from './anthropic';
import { isOmniModel } from './omni';
import { isOfoxModel } from './ofox';

export function selectProvider(
    model: string,
    apiKeys: Record<string, string>,
    opts?: { ollamaCloud?: boolean; ollamaLocal?: boolean },
): ProviderAdapter {
    // Explicit third-party prefixes always win.
    if (model.startsWith('openrouter:') || model.startsWith('hf:')) return openAiCompatAdapter;
    if (model.startsWith('anthropic:')) return anthropicAdapter;
    // OmniRoute & OfoxAI are OpenAI-compatible gateways.
    if (isOmniModel(model) || isOfoxModel(model)) return openAiCompatAdapter;
    if (model.includes('claude') && apiKeys.claude) return anthropicAdapter;
    // Anything the picker tagged as an Ollama model (local or cloud) -> native,
    // even if the name contains vendor-y substrings (gpt-oss, deepseek-v3, gemini-*).
    if (opts?.ollamaCloud || opts?.ollamaLocal || model.startsWith('ollama:')) return ollamaAdapter;
    // Raw vendor names only when a matching key exists (user genuinely means the cloud vendor).
    if (model.includes('gpt-') && apiKeys.openai) return openAiCompatAdapter;
    if (model.includes('deepseek') && apiKeys.deepseek) return openAiCompatAdapter;
    // Gemini speaks the OpenAI-compatible endpoint (routing it to the
    // Anthropic adapter, as before, produced guaranteed 401s).
    if (model.includes('gemini') && apiKeys.gemini) return openAiCompatAdapter;
    if (isOllamaModel(model)) return ollamaAdapter;
    return ollamaAdapter;
}

export { ollamaAdapter, openAiCompatAdapter, anthropicAdapter, isOllamaModel, isOmniModel, isOfoxModel };
export { listOfoxModels } from './ofox';

/** Strip the 'ollama:' prefix; leave provider-routed prefixes
    ('anthropic:' / 'openrouter:' / 'hf:' / 'omni:' / 'ofox:') intact so the
    adapter can still recognise and route them. */
export function stripModel(model: string): string {
    if (model.startsWith('ollama:')) return model.slice('ollama:'.length);
    if (model.startsWith('openrouter:') || model.startsWith('hf:') || model.startsWith('anthropic:') || model.startsWith('omni:') || model.startsWith('ofox:')) return model;
    return model;
}

