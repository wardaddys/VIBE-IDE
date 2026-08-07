import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Lifetime token telemetry, persisted across restarts. Per-session numbers
    live in the agentRun store; this is the odometer. */
interface UsageState {
    totalInput: number;
    totalOutput: number;
    runs: number;
    add: (input: number, output: number) => void;
    bumpRuns: () => void;
    reset: () => void;
}

export const useUsageStore = create<UsageState>()(
    persist(
        (set) => ({
            totalInput: 0,
            totalOutput: 0,
            runs: 0,
            add: (input, output) => set((s) => ({ totalInput: s.totalInput + input, totalOutput: s.totalOutput + output })),
            bumpRuns: () => set((s) => ({ runs: s.runs + 1 })),
            reset: () => set({ totalInput: 0, totalOutput: 0, runs: 0 }),
        }),
        { name: 'vibe-usage-storage' }
    )
);

export function fmtTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}
