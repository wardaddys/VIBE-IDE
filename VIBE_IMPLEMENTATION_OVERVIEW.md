# VIBE Implementation Overview

## What Was Implemented

### 1. Chat behavior now supports normal conversation
- Added intent detection to prevent every message from entering planner mode.
- Casual prompts now use direct chat path.
- Agentic loop runs only for task-like prompts.
- Added stream timeout guard to avoid indefinite wait hangs.

### 2. OpenRouter support added
- Added OpenRouter API key in settings store/UI.
- Added OpenRouter models to model selector and swarm agent manager.
- Added OpenRouter route handling in chat streaming router.
- Added model prefix normalization (`openrouter:`, `hf:`, `ollama:`).
- Added live OpenRouter catalog discovery via IPC (`openrouter:listModels`).
- OpenRouter rows in selector now show context window, per-1M input/output pricing, and capability badges (tools/vision).
- Added OpenRouter catalog controls in selector: search, sort (A-Z, cheapest input, cheapest output, largest context), and tools/vision filters.
- Added Cloud Models (API) controls in selector: search, sort (A-Z, Z-A, provider), and provider filter dropdown.
- Added one-click Clear buttons for both OpenRouter and Cloud control bars to reset search, sort, and filters instantly.

### 3. Hugging Face support kept and extended
- Existing `hf:` chat path preserved.
- Background agents now also support `hf:` model routing.
- Added Hugging Face model search via IPC (`hf:searchModels`) and switched picker from renderer-direct fetch to main-process API calls.

### 4. Background agents are now configurable
- Added background model settings:
  - Collector model
  - Reviewer model
- Added runtime API key propagation to background agents.
- Added immediate background agent reconfiguration on settings save.
- Reduced reviewer interval to 2 minutes.
- Reduced collector distill interval to 30 minutes.
- Removed hardcoded `glm-5:cloud` defaults from settings and background agents.
- Added automatic background model fallback resolution (OpenRouter → HF → Ollama) when fields are left blank.
- Added manual background briefing trigger API (`agent:triggerBriefing`).
- Added realtime background status strip in chat panel header (running state, events, briefing count) with "Refresh briefing" button.

### 5. Obsidian integration fixed
- Implemented missing IPC handlers used by renderer:
  - `obsidian:updateProjectNote`
  - `obsidian:logAgentRun`
  - `obsidian:logDecision`
- Removed hardcoded default key behavior; now requires provided key.

### 6. Background startup contract upgraded
- `startBackgroundAgents` now accepts a config object:
  - `obsidianKey`
  - `apiKeys`
  - `collectorModel`
  - `reviewerModel`
- File tree startup now sends full config.

### 7. Shared provider router extracted
- Added shared routing module for provider/model resolution:
  - `src/main/ipc/modelRouter.ts`
- `ollama:chat` now uses this shared route builder for streaming calls.
- Collector/Reviewer now use shared non-stream helper for background model calls.

### 8. Explicit chat mode toggle added
- Added persisted UI mode toggle with 3 states:
  - `auto`
  - `chat`
  - `agent`
- Main chat header now exposes mode buttons.
- Send flow now respects explicit mode before intent auto-detection.
- Direct chat system prompt now explicitly grounds the model as running inside VIBE IDE to avoid generic "I cannot access your directory" responses.

### 9. Durable plan artifacts and DAG waves added
- Main loop now persists plan execution artifacts under `.vibe`:
  - `.vibe/plans/plan-<timestamp>.json`
  - `.vibe/STATE.json`
  - `.vibe/verification.latest.json`
- Plan step parsing now reads `depends="..."` attributes and builds dependency waves.
- Execution follows dependency-resolved wave ordering with fallback for malformed/cyclic plans.

## Files Changed

### Main process
- `src/main/index.ts`
- `src/main/preload.ts`
- `src/main/ipc/ollama.ts`
- `src/main/ipc/modelRouter.ts`
- `src/main/ipc/obsidian.ts`
- `src/main/ipc/agent/backgroundManager.ts`
- `src/main/ipc/agent/collector.ts`
- `src/main/ipc/agent/reviewer.ts`

### Renderer
- `src/renderer/App.tsx`
- `src/renderer/components/layout/ChatBar.tsx`
- `src/renderer/components/layout/SettingsModal.tsx`
- `src/renderer/components/layout/MainArea.tsx`
- `src/renderer/components/filetree/FileTree.tsx`
- `src/renderer/components/ai/ModelSelector.tsx`
- `src/renderer/components/ai/HuggingFacePicker.tsx`
- `src/renderer/components/layout/AgentManager.tsx`
- `src/renderer/store/settings.ts`
- `src/renderer/store/ui.ts`

### Shared
- `src/shared/types.ts`

## Current Behavior (Expected)

1. Saying "hi" responds normally and does not trigger the full planner/critic/executor loop.
2. Task-like prompts still trigger the agentic workflow.
3. OpenRouter models can be selected in chat/swarm selectors when key is provided.
4. Background agents can run on configured model IDs, including prefixed cloud IDs.
5. Obsidian project updates and run/decision logs are now wired end-to-end.
6. OpenRouter live catalog is fetched through main-process IPC and rendered with pricing/context metadata.
7. Hugging Face search runs through main-process IPC (no renderer-side direct provider fetch).
8. Background agent health is visible in realtime in the chat header and can be manually nudged with "Refresh briefing".
9. Neural widget no longer overlaps bottom-right chat action controls.

## Remaining Work (Next Optional Enhancements)

1. Upgrade DAG execution from wave-sequenced steps to true safe parallel execution for non-conflicting steps.
2. Add richer task state schema per step (pending/running/succeeded/failed timestamps and retry history).
3. Add explicit UI surfacing of latest plan artifact and verification status in chat panel.
4. Add migration/version field for `.vibe/STATE.json` schema evolution.

## How To Use New Background Model Config

In Settings:
- Set API keys (`openrouter`, `hf`, etc.).
- Set model IDs in Background Agent Models:
  - Examples:
    - `glm-5:cloud`
    - `openrouter:openai/gpt-4o-mini`
    - `hf:Qwen/Qwen2.5-Coder-32B-Instruct`

Save settings:
- Background agents are reconfigured immediately for the active project.

## Validation Notes
- Type/lint diagnostics report no current errors after these changes.

## Progress Update (2026-03-17, Later Session)

### Architecture extraction completed further
- Extracted core ChatBar agent loop into dedicated orchestrator service:
  - `src/renderer/services/agent/orchestrator.ts`
- Extracted swarm execution flow into dedicated service:
  - `src/renderer/services/agent/swarm.ts`
- Kept ChatBar as a thinner dispatcher/UI wiring layer that delegates to services.

### Additional modularization completed
- Added agent service modules for separated concerns:
  - `src/renderer/services/agent/intent.ts`
  - `src/renderer/services/agent/plan.ts`
  - `src/renderer/services/agent/prompts.ts`
  - `src/renderer/services/agent/stream.ts`
  - `src/renderer/services/agent/xml.ts`

### Testing and contracts completed
- Added tests for:
  - model routing (`modelRouter.test.ts`)
  - DAG/plan parsing and wave building (`plan.test.ts`)
  - stream cancellation behavior (`stream.test.ts`)
  - swarm wave computation (`swarm.test.ts`)
  - IPC channel contract constants (`ipcContracts.test.ts`)
- Added shared IPC contract constants and wired main/preload to those constants:
  - `src/shared/ipcContracts.ts`

### Guardrails completed
- Added test runner and scripts (`vitest`, `npm test`, `typecheck:strict`).
- Added scoped strict TypeScript config:
  - `tsconfig.strict.json`
- Current checks passing:
  - unit tests
  - baseline typecheck
  - strict scoped typecheck

## Next Session - First Task (Planned)
1. Extract direct chat flow from `ChatBar` into a dedicated service module (same pattern as orchestrator/swarm extraction), then re-run tests and typechecks.

## Continuation Update (2026-03-18)

1. Planned task completed:
- Extracted direct chat flow into `src/renderer/services/agent/direct.ts`.
- Rewired `src/renderer/components/layout/ChatBar.tsx` to delegate direct chat execution to the new service.

2. Validation results in this session:
- Unit tests pass (`npm.cmd test`).
- Baseline typecheck passes (`cmd /c npx tsc --noEmit`).
- Strict typecheck passes (`npm.cmd run typecheck:strict`).

3. Environment note:
- On this Windows host, `npm.ps1` was blocked by PowerShell execution policy; `npm.cmd` and `cmd /c npx ...` were used for successful verification.
