## Plan: Ruthless OOP and Test Strategy

This project should not be converted to pure OOP end-to-end. The better target is a hybrid architecture: object-oriented domain services in main process, functional-reactive renderer orchestration, and strict boundary contracts between renderer, preload, and IPC handlers. The current code already trends this way, but it has high coupling hotspots and weak verification discipline. The plan below hardens architecture and testing without forcing an unnatural rewrite.

Validation note (2026-03-17): This document is calibrated against the current workspace snapshot. Keep claims tied to concrete files and avoid absolute language where behavior is probabilistic without a reproducer.

**Ruthless Findings**
1. Chat orchestration is overloaded and violates single responsibility in practice.
Evidence: [src/renderer/components/layout/ChatBar.tsx](src/renderer/components/layout/ChatBar.tsx#L269) coordinates UI state, model dispatch, project scan, planner/critic/executor loop, terminal polling, stream lifecycle, persistence, and Obsidian side-effects.
Risk: expensive regressions, hard-to-isolate bugs, low testability.
2. Dead code exists in critical path and signals missing enforcement.
Evidence: [src/renderer/components/layout/ChatBar.tsx](src/renderer/components/layout/ChatBar.tsx#L16) and [src/renderer/components/layout/ChatBar.tsx](src/renderer/components/layout/ChatBar.tsx#L17) define context estimation constants that are currently unused.
Risk: drift between intended and actual behavior.
3. Main process service classes are useful, but contract governance is incomplete.
Evidence: Class-based services exist in [src/main/ipc/agent/backgroundManager.ts](src/main/ipc/agent/backgroundManager.ts#L10), [src/main/ipc/agent/collector.ts](src/main/ipc/agent/collector.ts#L42), and [src/main/ipc/agent/reviewer.ts](src/main/ipc/agent/reviewer.ts#L16). Typed bridge contracts also exist in [src/shared/types.ts](src/shared/types.ts) and [src/main/preload.ts](src/main/preload.ts), but IPC channel names remain duplicated string literals across preload and main handlers.
Risk: drift can occur at runtime if channel names/payload assumptions change without integration tests or shared channel constants.
4. Renderer uses direct global side effects and cross-store state grabs.
Evidence: [src/renderer/components/layout/ChatBar.tsx](src/renderer/components/layout/ChatBar.tsx#L307), [src/renderer/components/layout/ChatBar.tsx](src/renderer/components/layout/ChatBar.tsx#L321), [src/renderer/components/filetree/FileTree.tsx](src/renderer/components/filetree/FileTree.tsx#L41).
Risk: hidden dependencies, harder deterministic testing.
5. Settings save path is inconsistent with startup path for background config propagation.
Evidence: [src/renderer/components/layout/SettingsModal.tsx](src/renderer/components/layout/SettingsModal.tsx#L45) omits apiKeys while [src/renderer/components/filetree/FileTree.tsx](src/renderer/components/filetree/FileTree.tsx#L46) includes apiKeys.
Risk: runtime mismatch after settings edits.
6. Strict TypeScript posture is partially diluted.
Evidence: [tsconfig.json](tsconfig.json#L20) and [tsconfig.json](tsconfig.json#L21) disable unused locals and parameters checks.
Risk: stale code accumulates in key paths.

**Is Pure OOP Better Here**
1. No, pure OOP is not better for this app as a whole.
2. Yes, OOP is better for long-lived stateful services with lifecycle and side effects.
Use OOP in: background agents, terminal manager, provider clients.
3. Functional-reactive is better in renderer UI composition and state transitions.
Use functional approach in: React components, store actions, pure parsers/formatters.
4. Best architecture for this app: layered hybrid.
Layer A: Domain services as classes in main.
Layer B: IPC adapters and typed contracts.
Layer C: Renderer orchestrators as thin functions/hooks.
Layer D: Pure utility modules with no side effects.

**Steps**
1. Phase 1: Architecture guardrails
Define and enforce module boundaries: renderer cannot own heavy orchestration logic that mixes UI and infrastructure concerns. Extract orchestration service from [src/renderer/components/layout/ChatBar.tsx](src/renderer/components/layout/ChatBar.tsx#L269). Keep component focused on view events and rendering.
2. Phase 2: OOP where it pays off
Retain class-based services in main process and introduce explicit interfaces for terminal, model routing, and background lifecycle dependencies used by IPC handlers.
3. Phase 3: Functional purity in renderer
Move parser, planner-step graph logic, token/context policy, and intent detection into pure testable modules under renderer utils/services with no window/global/store writes.
4. Phase 4: Contract-driven IPC hardening
Add typed request and response schemas per IPC channel. Add integration tests that fail on any signature drift between preload and main handlers.
5. Phase 5: Testing rollout in execution order
Start with unit tests for model routing and DAG parsing, then integration tests for IPC and background reconfiguration, then Electron e2e smoke and workflow tests.
6. Phase 6: CI quality gates
Windows-first CI must block merges on type-check, lint, unit, integration, and smoke e2e.

**Accuracy Calibrations For Extended Failure List**
1. ChatBar size claims should reference current measured file length. Use current line count from [src/renderer/components/layout/ChatBar.tsx](src/renderer/components/layout/ChatBar.tsx) instead of stale historic values.
2. Path traversal risk is valid, but examples should be Windows-relevant in this repo context. Anchor on unrestricted read/write behavior in [src/main/ipc/filesystem.ts](src/main/ipc/filesystem.ts#L47) and [src/main/ipc/filesystem.ts](src/main/ipc/filesystem.ts#L56).
3. Stop behavior should be described as partial cancellation: current stream aborts, but loop-level cancellation token is absent in [src/renderer/components/layout/ChatBar.tsx](src/renderer/components/layout/ChatBar.tsx#L303).
4. Swarm parallelism risk should be phrased as unsafe/conflated streaming behavior unless accompanied by a deterministic reproducer. Evidence remains strong due to single global abort controller and shared stream channel in [src/main/ipc/ollama.ts](src/main/ipc/ollama.ts#L7) and [src/main/ipc/ollama.ts](src/main/ipc/ollama.ts#L289).
5. Gemini key exposure claim is valid as written and should remain high-priority, based on query-string key usage in [src/main/ipc/modelRouter.ts](src/main/ipc/modelRouter.ts#L135).

**Relevant files**
- [src/renderer/components/layout/ChatBar.tsx](src/renderer/components/layout/ChatBar.tsx) — split orchestration from UI; remove dead constants or wire them to real guardrails.
- [src/renderer/components/layout/SettingsModal.tsx](src/renderer/components/layout/SettingsModal.tsx) — align save-time background config with startup behavior.
- [src/renderer/components/filetree/FileTree.tsx](src/renderer/components/filetree/FileTree.tsx) — reference behavior for full background config propagation.
- [src/main/ipc/agent/backgroundManager.ts](src/main/ipc/agent/backgroundManager.ts) — keep as orchestrator class; add stronger contracts and tests.
- [src/main/ipc/agent/collector.ts](src/main/ipc/agent/collector.ts) — isolate intervals and filesystem side effects for testability.
- [src/main/ipc/agent/reviewer.ts](src/main/ipc/agent/reviewer.ts) — isolate timer/cooldown logic with deterministic clock tests.
- [src/main/ipc/modelRouter.ts](src/main/ipc/modelRouter.ts) — primary pure-logic unit-test target.
- [src/main/ipc/terminal.ts](src/main/ipc/terminal.ts) — lifecycle and buffering integration tests.
- [src/main/preload.ts](src/main/preload.ts) — contract surface snapshot tests.
- [src/shared/types.ts](src/shared/types.ts) — canonical contract typing for renderer-main boundaries.
- [tsconfig.json](tsconfig.json) — tighten compiler checks for stale/dead code prevention.

**Verification**
1. Architecture checks
Confirm orchestration extraction reduced ChatBar branch complexity and global side-effect touch points.
2. Unit coverage checks
Model router, intent detection, plan parsing, dependency wave building, and token/context policy are covered with deterministic tests.
3. Integration coverage checks
IPC handlers, background manager reconfiguration, and terminal lifecycle pass contract tests under mocked dependencies.
4. E2E checks
Windows smoke: launch app, open folder, chat mode switch, casual chat, task prompt, settings save, background status refresh, artifact verification.
5. Governance checks
CI blocks merge on failing checks and publishes failure artifacts.

**Decisions**
- Included scope: ruthless architecture assessment plus full testing strategy.
- Recommended architecture: hybrid, not pure OOP rewrite.
- Explicitly excluded: full rewrite for stylistic purity without measurable reliability gain.

**Further Considerations**
1. If large refactor bandwidth is limited, start with a Strangler approach: extract one subsystem from ChatBar at a time while adding tests around each extraction.
2. Promote noUnusedLocals and noUnusedParameters to true after initial cleanup to avoid noisy adoption.
3. Treat IPC channels as public APIs: version them once external plugins or extensions depend on them.

## Execution Status Addendum (2026-03-17)

1. Completed since this audit:
- Agent orchestration loop extracted from `ChatBar` into `src/renderer/services/agent/orchestrator.ts`.
- Swarm orchestration extracted from `ChatBar` into `src/renderer/services/agent/swarm.ts`.
- Planning/prompt/intent/xml/stream concerns separated into agent service modules.
- IPC channel constants centralized via `src/shared/ipcContracts.ts` and wired in main/preload.
- Automated test suite added and passing for routing, plan DAG waves, cancellation, swarm wave computation, and IPC contracts.

2. Guardrails currently in effect:
- Baseline compile checks pass.
- Scoped strict TypeScript checks pass via `tsconfig.strict.json`.
- Test suite passes via Vitest.

3. Next session first engineering task:
- Extract direct chat flow from `ChatBar` into a dedicated service module, then verify with tests and both typecheck levels.

## Continuation Update (2026-03-18)

1. Completed in this session:
- Direct chat flow extracted from `src/renderer/components/layout/ChatBar.tsx` into `src/renderer/services/agent/direct.ts`.
- `ChatBar` now delegates direct chat execution to the dedicated service, matching the orchestrator/swarm split pattern.

2. Verification completed after extraction:
- `npm.cmd test` passes.
- Baseline TypeScript check passes via `cmd /c npx tsc --noEmit`.
- Strict check passes via `npm.cmd run typecheck:strict`.

3. Windows shell note:
- PowerShell execution policy blocked `npm` script invocations in this environment; using `npm.cmd` and `cmd /c npx ...` is a reliable workaround.
