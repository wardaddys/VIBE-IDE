# VIBE IDE

Agent-first desktop IDE where AI can plan, execute, verify, and keep project context warm in the background.

VIBE combines Monaco, terminal control, local/cloud model routing, and multi-agent orchestration in a standalone Electron app. It is not a VS Code fork.

## Why VIBE

- AI that does real work: planning, file edits, terminal execution, and verification loops.
- Local-first by default: strong Ollama support with cloud providers layered on top.
- Persistent project intelligence: background agents keep briefings and health snapshots up to date.
- Built as a product: fast UI, strong TypeScript contracts, and testable service boundaries.

## What Is New In This Build

- Refactored agent logic out of the chat UI into dedicated services:
   - direct chat service
   - orchestrator service
   - swarm service
   - plan/prompt/stream/runtime helpers
- Added stop-aware cancellation hardening across direct, orchestrator, and swarm flows.
- Added background intelligence agents (collector + reviewer) managed by a background manager.
- Added live neural widget for background agent status visualization.
- Added shared IPC channel contracts and tests for contract consistency.
- Added strict typecheck profile and expanded Vitest coverage for key services.

## Core Features

- Multi-mode chat runtime:
   - auto mode (intent-based switch)
   - chat mode (direct assistant)
   - agent mode (task execution loop)
- Swarm execution with dependency-aware wave scheduling.
- Unified model routing for Ollama, OpenAI-style APIs, Anthropic, Gemini, OpenRouter, and HuggingFace routing.
- Thinking controls for supported models (toggle and tiered budgets).
- Project context persistence under `.vibe/` (memory, plans, briefing, verification artifacts).
- Obsidian integration hooks for project logs and briefing sync.

## Architecture Snapshot

- Electron main process:
   - secure preload bridge
   - IPC handlers for filesystem, terminal, model routing, obsidian, and background agents
- Renderer:
   - React + Zustand UI and state
   - modular agent runtime services
   - Monaco editor + terminal panel + model picker + neural widget
- Shared:
   - typed IPC contracts and shared app types

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Electron |
| Frontend | React 18, TypeScript, Vite |
| Editor | Monaco Editor |
| Terminal | xterm.js + node-pty |
| State | Zustand |
| Testing | Vitest |
| Packaging | electron-builder |

## Quick Start

### Prerequisites

- Node.js 18+
- Ollama (optional but recommended for local-first usage)

### Setup

```bash
git clone https://github.com/wardaddys/VIBE-IDE.git
cd VIBE-IDE
npm install
```

### Run

```bash
npm run dev
```

### Validate

```bash
npm test
npm run typecheck:strict
```

Windows note: if PowerShell policy blocks npm scripts, use `npm.cmd` equivalents.

## Repo Scripts

- `npm run dev` - start Vite/Electron dev flow
- `npm run build` - compile and package build
- `npm test` - run Vitest test suite
- `npm run test:watch` - watch mode tests
- `npm run typecheck:strict` - strict TypeScript profile

## Product Direction

- Keep extracting orchestration logic out of UI components.
- Expand contract-driven IPC coverage and tests.
- Continue improving model routing quality, observability, and guardrails.
- Grow background project intelligence and briefing quality.

## Author

Muhammad Saeed  
Software engineer and digital creator based in Pakistan.

VIBE IDE is built to make autonomous software development practical, transparent, and user-controlled.
