import { buildChatRoute, normalizeModelId } from './modelRouter';
import type { ChatMessage } from '../../shared/types';
import { describe, expect, it } from 'vitest';

describe('modelRouter', () => {
    const messages: ChatMessage[] = [
        { role: 'system', content: 'sys' },
        { role: 'user', content: 'hello' },
    ];

    it('normalizes prefixed ids', () => {
        expect(normalizeModelId('openrouter:openai/gpt-4o-mini')).toBe('openai/gpt-4o-mini');
        expect(normalizeModelId('hf:Qwen/Qwen2.5-Coder-32B-Instruct')).toBe('Qwen/Qwen2.5-Coder-32B-Instruct');
        expect(normalizeModelId('ollama:llama3.2')).toBe('llama3.2');
    });

    it('routes openrouter with bearer auth', () => {
        const route = buildChatRoute('openrouter:openai/gpt-4o-mini', messages, { openrouter: 'k' }, { stream: true });
        expect(route.mode).toBe('openai');
        expect(route.endpoint).toBe('https://openrouter.ai/api/v1/chat/completions');
        expect(route.headers.Authorization).toBe('Bearer k');
    });

    it('routes gemini with x-goog-api-key header', () => {
        const route = buildChatRoute('gemini-2.5-flash', messages, { gemini: 'g-key' }, { stream: true });
        expect(route.mode).toBe('gemini');
        expect(route.headers['x-goog-api-key']).toBe('g-key');
        expect(route.endpoint.includes('key=')).toBe(false);
    });

    it('routes ollama prefixed models locally', () => {
        const route = buildChatRoute('ollama:llama3.2', messages, {}, { stream: true });
        expect(route.mode).toBe('ollama');
        expect(route.endpoint).toBe('http://localhost:11434/api/chat');
        expect(route.body.model).toBe('llama3.2');
    });

    it('throws when required provider key is missing', () => {
        expect(() => buildChatRoute('claude-3-7-sonnet-20250219', messages, {}, { stream: true })).toThrow('Claude API key missing.');
    });
});
