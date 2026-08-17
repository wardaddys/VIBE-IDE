const TASK_INTENT_RE = /(fix|build|implement|write|edit|refactor|create|run|execute|terminal|command|bug|error|test|install|setup|update|change|patch|analy[sz]e code|read file|open file|generate)/i;

export function shouldUseAgenticMode(text: string): boolean {
    return TASK_INTENT_RE.test(text);
}
