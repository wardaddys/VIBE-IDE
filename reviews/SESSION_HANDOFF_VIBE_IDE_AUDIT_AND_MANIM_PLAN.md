# VIBE-IDE Session Handoff: Repo Overview, Manim Integration Plan & Deep Bug Audit

## 1) Repo overview

VIBE-IDE is an agent-first desktop IDE built with Electron + React + TypeScript + Vite. It is designed around AI-assisted workflows where the agent can plan work, edit files, run terminal commands, verify results, and keep project context warm in the background. The project explicitly says it is not a VS Code fork.

### Stack

- Language(s): TypeScript, TSX, HTML, CSS
- Framework / runtime: Electron + React 18 + Vite
- Notable libraries: Monaco Editor, Zustand, xterm.js, node-pty, electron-builder, Vitest, MUI

### How it’s organized

```
src/
  main/        Electron main process, IPC, filesystem, terminal, Ollama, Obsidian, background agents
    agent/     background intelligence: collector, reviewer, manager
    ipc/       app-facing IPC handlers
  renderer/    React UI
    components/  UI feature groups: agent, editor, terminal, auth, layout, etc.
    services/    agent orchestration logic in the UI
    store/       Zustand app state
    hooks/       UI/runtime hooks
    utils/       event bus, helpers
  shared/      cross-process contracts, types, IPC channel definitions
```

The app is split into Electron main, renderer, and shared contracts. `src/main/index.ts` wires the main window and IPC handlers, `preload.ts` exposes the `window.vibe` bridge, the renderer drives the UI through stores and services, and shared IPC contracts keep the two sides aligned. The architecture is intentionally agent-heavy, with a collector/reviewer background system that writes project memory under `.vibe/`.

### How to run it

```bash
npm install
npm run dev
npm run build
npm test
npm run typecheck:strict
```

### Big-picture assessment

- Strong product identity
- Good separation between main, renderer, and shared contracts
- Interesting background intelligence / project memory model
- Clear agentic workflow direction
- Good contract testing presence
- But there are real reliability and maintainability risks in watchers, lifecycle handling, secret handling, and file-backed runtime contracts

---

## 2) Manim integration plan for VIBE-IDE

### The right narrative

VIBE should support Manim as a native AI-driven creative workflow: the user can ask it to create or modify Manim scenes, the agent writes and repairs the code, VIBE runs renders, previews the result, and iterates until the animation is correct.

That means Manim should not be treated like a random external dependency or a mere “detected project type.” Instead, VIBE should behave like a Manim-capable animation workstation.

### What “native workflow” means

The user should be able to come in with a prompt like:

- “Create a scene for this theorem”
- “Make this animation smoother”
- “Fix the scene that failed to render”
- “Turn this explanation into an animation”

And VIBE should handle the whole cycle:

1. Understand the request
2. Generate or edit Manim code
3. Run the render
4. Inspect output or failure
5. Repair the scene
6. Rerender
7. Preview the result
8. Repeat until correct

### What VIBE should do for Manim

- Create Manim scenes from scratch
- Modify existing scenes
- Run Manim render commands
- Preview the output
- Inspect logs and errors
- Repair failing scenes
- Keep project memory and successful render history
- Support both brand new and existing projects

### Why this fits VIBE

VIBE already has:

- File editing
- Terminal control
- Agent planning
- Background project memory
- Preview-oriented UI modes
- IPC-separated main/renderer architecture

That makes it a natural fit for a Manim workflow.

### Suggested architecture

#### Main process

Responsible for:

- Command execution
- Artifact discovery
- Log capture
- Error parsing
- File-system access
- Process cleanup

#### Renderer

Responsible for:

- Scene list UI
- Render controls
- Preview surface
- Log display
- Artifact browser
- Retry button
- User interactions

#### Shared

Responsible for:

- Typed IPC contracts
- Render request/result structures
- Scene metadata
- Artifact metadata
- Status / error shapes

#### Agent

Responsible for:

- Planning the visual change
- Editing the scene
- Reading render failures
- Rerunning and repairing
- Stopping when the animation is correct

### The most useful UX

1. User opens or creates a Manim project
2. VIBE offers a Manim workspace
3. Agent writes the scene
4. VIBE renders it
5. VIBE previews it
6. Agent fixes failures automatically
7. Repeat until done

### Minimal viable version

If you want the smallest useful version:

- Create Manim scene files
- Run render commands
- Show preview artifacts
- Let the agent edit and rerender

### Better version

- Scene discovery
- Output comparison
- Render profiles
- Artifact history
- Error-aware repair loop
- Project memory persistence

### Strong product sentence

> VIBE should support Manim as a native AI-driven creative workflow, where the user can ask for new scenes or edits, the agent writes and repairs the code, VIBE runs renders, previews the result, and iterates until the animation is correct.

---

## 3) Deep bug audit: overall review of wardadddy/VIBE-IDE

This repo is not broken, but there are concrete issues that affect correctness, reliability, and maintainability. The most important problems are:

- Watcher reliability
- Silent failure handling
- Stateful background loops
- File-backed runtime contracts without schema/version discipline
- Main-process responsibility pileup
- Secret-handling / integration hygiene

### Risk level

Medium to high

### Major themes

- Too much mutable state in background agents
- File-backed contracts are weakly versioned
- Errors are often swallowed
- Lifecycle boundaries are not strongly enforced
- Renderer and main logic still carry a lot of orchestration responsibility

---

## 4) File-by-file deep bug audit

### `src/main/index.ts`

#### Findings

1. **Debug logging uses `executeJavaScript` per log line**
   - The debug log window appends log lines by evaluating JavaScript in the renderer. This works, but it is brittle and heavier than necessary.
   - Why it matters: every log line becomes script execution; noisy logs can slow the debug window; timing issues become harder to reason about.

2. **Load retry logic can hide persistent failures**
   - The renderer reload retry loop is capped, which is good, but it still assumes the failure is transient. If the real issue is a broken asset path or dev server failure, retries only delay diagnosis.
   - Why it matters: failure can look like “white window for a while”; diagnosis is delayed; root cause may remain unclear.

3. **`render-process-gone` reloads without crash-loop protection**
   - Reloading the renderer after a crash is sensible, but if the crash is deterministic, the app can loop through reloads.
   - Why it matters: repeated crash/reload cycle; white or flapping UI; poor recovery experience.

4. **`sandbox: false` is a high-value trust decision**
   - Even with `contextIsolation: true` and `nodeIntegration: false`, disabling sandbox increases the impact of any IPC/preload issue.
   - Why it matters: broader attack surface; higher consequence if a bridge is wrong; less hardened Electron posture.

5. **Shutdown cleanup is partial**
   - The app explicitly kills shell processes, but other long-lived resources are not clearly coordinated in a single shutdown path.
   - Why it matters: race conditions on exit; background state may continue to do work; exit behavior can become noisy.

### `src/main/ipc/obsidian.ts`

#### Findings

1. **Obsidian fetches have no timeout/abort**
   - A stalled localhost HTTPS request can hang longer than desirable.
   - Why it matters: user actions feel unresponsive; local API problems become harder to diagnose; handlers only return boolean success/failure.

2. **Raw strings are embedded into notes without stronger escaping**
   - Project names, paths, and structures are inserted directly into frontmatter and markdown bodies.
   - Why it matters: malformed notes if values contain edge cases; frontmatter can break; content injection risk is not zero.

3. **Project structure is truncated to 3000 chars**
   - This is a blunt cutoff with no visible warning.
   - Why it matters: snapshot may look authoritative but be incomplete; important structure can be silently omitted.

4. **Handlers return only booleans**
   - This makes debugging local Obsidian integration very hard.
   - Why it matters: users get little diagnostic value; support becomes guesswork.

5. **`criteraMet` is misspelled**
   - Small but real contract drift smell.
   - Why it matters: easy mismatch at call sites; indicates weak contract discipline.

### `src/main/ipc/agent/collector.ts`

#### Findings

1. **Recursive watcher behavior is fragile**
   - `fs.watch(..., { recursive: true })` is one of the biggest reliability risks in this file, especially on large workspaces and certain platforms.
   - Why it matters: dropped events; watcher limits; inconsistent behavior across OSes; stale project state.

2. **Start/stop lifecycle is not obviously idempotent**
   - If the collector is started again, stale handles or state can remain unless all callers are perfectly disciplined.
   - Why it matters: duplicate watchers; duplicate intervals; mixed project state.

3. **`stop()` does not fully reset runtime state**
   - It clears some resources, but it does not reset all agent state.
   - Why it matters: stale events leak into a new session; counters and timestamps persist unexpectedly; collector can “remember” the wrong project.

4. **Git health polling is expensive**
   - The health loop shells out to multiple git commands on a schedule.
   - Why it matters: periodic overhead; slow or noisy on large repos; can become expensive on slow filesystems.

5. **`events.log` writes are synchronous**
   - Appending in the hot path means bursts of file events can block longer than ideal.
   - Why it matters: collector lag; responsiveness issues; unnecessary main-process blocking.

6. **Language inference is heuristic**
   - It infers language from extension frequency in observed events.
   - Why it matters: misleading classification on mixed repos; bursty edits skew results; project snapshot may be wrong.

7. **Many errors are swallowed**
   - A lot of `catch {}` blocks hide failures.
   - Why it matters: hidden bugs; difficult diagnosis; partial failure looks like “just not working”.

8. **Distillation depends on fragile text parsing**
   - The model must emit `FACT:` lines for facts to be captured.
   - Why it matters: model format drift drops output; useful facts can be lost silently; brittle long-term behavior.

### `src/main/ipc/agent/reviewer.ts`

#### Findings

1. **Timer-driven briefing generation can overlap lifecycle boundaries**
   - The reviewer is stateful and periodic. `isSynthesizing` helps, but lifecycle and restart discipline still matter a lot.
   - Why it matters: missed or overlapping briefings; stale internal state; unpredictable behavior on restart.

2. **The review interval can become stale or duplicated**
   - If the reviewer is started more than once without perfect cleanup, duplicate timers can happen.
   - Why it matters: briefing churn; mixed project context; unnecessary work.

3. **Only the last 500 characters of the agent log are used**
   - That is very little context.
   - Why it matters: important activity can be clipped; briefing quality drops; the model may miss the real current state.

4. **Prompt input is trusted without schema validation**
   - Raw JSON and raw log text are fed into the model prompt.
   - Why it matters: briefing quality depends on noisy inputs; prompt injection is possible in principle; malformed input can degrade usefulness.

5. **Briefings expire after 30 minutes**
   - This may be deliberate, but it can surprise users.
   - Why it matters: a valid briefing can suddenly become “unavailable”; may feel like data loss.

6. **Obsidian sync failures are silent**
   - If the write fails, the user gets no meaningful feedback.
   - Why it matters: missing notes go unnoticed; debugging integration issues becomes hard.

7. **Synchronous file I/O is used in the main briefing path**
   - Probably acceptable at this scale, but it is still blocking work.
   - Why it matters: periodic blocking; compounding latency with other sync tasks.

---

## 5) Cross-file architectural risks

1. **Mutable runtime state is spread across ad hoc class instances**
   - Collector and reviewer both rely on many mutable fields and timers.
   - Risk: stale state leakage; restart bugs; lifecycle bugs.

2. **`.vibe` file contracts are implicit**
   - Files like `events.log`, `health.json`, `facts.json`, `briefing.json` are important runtime interfaces, but they are not strongly versioned.
   - Risk: schema drift; silent incompatibility; fragile future changes.

3. **Silent failure is common**
   - Many catches swallow errors completely.
   - Risk: hard debugging; hidden corruption; false sense of health.

4. **Main process does too much**
   - `src/main/index.ts` is handling logging, IPC registration, window management, lifecycle cleanup, background wiring.
   - Risk: maintenance pressure; harder testing; brittle startup order.

---

## 6) Concrete fix plan

### High priority

- Replace fragile recursive watcher behavior with a safer watcher strategy.
- Make collector/reviewer start-stop behavior idempotent.
- Remove or harden any secret-handling defaults.
- Add timeouts and structured failure handling to Obsidian sync.
- Reduce silent error swallowing in background agents.

### Medium priority

- Add `.vibe` schema/versioning.
- Reduce synchronous I/O in hot paths.
- Increase log context available to the reviewer.
- Improve error surfacing in the UI.
- Split root-component orchestration into smaller modules over time.

### Lower priority

- Improve model/health snapshot heuristics.
- Improve note sanitization and markdown escaping.
- Add stronger tests for watcher and lifecycle behavior.

---

## 7) File-by-file summary of what to fix

### `src/main/index.ts`

- Avoid per-line `executeJavaScript`
- Protect against renderer crash loops
- Document or revisit `sandbox: false`
- Centralize shutdown cleanup

### `src/main/ipc/obsidian.ts`

- Add timeout/abort
- Sanitize note content
- Return richer failure information
- Fix the misspelled field name

### `src/main/ipc/agent/collector.ts`

- Make lifecycle idempotent
- Replace fragile recursive watching
- Avoid synchronous event-path I/O when possible
- Reset state on stop
- Add schema/versioning to artifacts

### `src/main/ipc/agent/reviewer.ts`

- Increase log context
- Make lifecycle more robust
- Surface sync failures
- Add schema/versioning to `briefing.json`

---

## 8) Final assessment

This is a serious and ambitious Electron agent IDE. The codebase has a coherent vision, good contracts in some places, and real product depth. The main risk is not “it’s bad” — the risk is that the background intelligence layer is still in the “works well when everything goes right” phase.

The biggest quality gains will come from:

- Explicit lifecycle boundaries
- Safer watchers
- Richer failure reporting
- Versioned file-backed runtime contracts
- Less silent error swallowing

---

## 9) Suggested next action plan

1. Refactor watcher + lifecycle handling.
2. Harden Obsidian sync.
3. Add shared `.vibe` schemas.
4. Add tests for restart and failure cases.
5. Split high-density orchestration over time.

---

## 10) Session note

This document is the combined handoff capturing everything discussed in the session: repo overview, Manim integration direction, deep bug audit, file-by-file findings, and fix priorities.
