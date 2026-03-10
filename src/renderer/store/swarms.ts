import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AgentNode {
    id: number;
    role: string;
    model: string;
    dependsOn?: number[]; // ids of agents this one waits for
}

export interface SwarmConfig {
    id: string;
    name: string;
    agents: AgentNode[];
}

export interface SwarmHandoff {
    originalRequest: string;
    previousAgentRole: string;
    previousAgentOutput: string;
    sharedContext: Record<string, string>; // agentRole -> output, accumulates
}

interface SwarmState {
    swarms: SwarmConfig[];
    addSwarm: (swarm: SwarmConfig) => void;
    removeSwarm: (id: string) => void;
}

export const useSwarmStore = create<SwarmState>()(
    persist(
        (set) => ({
            swarms: [],
            addSwarm: (swarm) => set((state) => ({ swarms: [...state.swarms, swarm] })),
            removeSwarm: (id) => set((state) => ({ swarms: state.swarms.filter(s => s.id !== id) }))
        }),
        { name: 'vibe-swarms-storage' }
    )
);
