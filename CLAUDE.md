# VIBE — agent context

**VIBE is an agent-first desktop IDE.** An Electron app where AI can plan, edit files,
run terminal commands, verify its work, and keep project context warm via background
agents. Local-first (Ollama) with cloud providers layered on. Not a VS Code fork.

## ⛔ Hard constraint: VIBE ships ZERO security/Tensora code

VIBE was split from a combined codebase on 2026-08-02. Its security workbench
("Tensora") now lives in a **separate sibling repo** at `../Tensora`. Do **not**
re-introduce any of it here:

- No `tensora`, `camofox`, `kali`, `bola_test`, `browser_fetch`, `ssrf`, engagement,
  or hunt/pentest code — in source, comments, deps, or docs.
- `Surface` is exactly `'chat' | 'cowork' | 'code' | 'design'` (see `src/shared/agent.ts`).
  Never add `'security'`.
- There is no `123` unlock, no `TensoraWorkbench`, no `window.vibe.tensora` bridge,
  no `tensora:*` IPC. The brand in the top bar is inert.
- **Invariant to preserve:** `grep -rniE "tensora|camofox|kali|bola_test|browser_fetch" src *.json *.yml` must return nothing.

If a task sounds like it needs security tooling, it belongs in `../Tensora`, not here.

## Run / build / test

```bash
npm run dev        # vite + auto-launches Electron (vite-plugin-electron, entry src/main/index.ts)
npm run build      # tsc && vite build && electron-builder  -> release/<version>/
npm test           # vitest run  (13 test files; all pass)
npm run typecheck:strict   # stricter profile; has PRE-EXISTING noUnusedLocals warnings, not part of build
```

Electron identity: appId `com.vibe.ide`, data home `~/Documents/VIBE`.

## Architecture

Three process zones. IPC is the only bridge between main and renderer.

- **`src/main/`** — Electron main (Node). Owns the filesystem, terminal (node-pty),
  Ollama, and the agent kernel.
  - `runtimeLog.ts` — durable runtime log at `<dataHome>/logs/runtime.log`
    (rotates at 2 MB). All console output, renderer errors, and crashes land
    here; `app:getRuntimeLogPath` / `app:openRuntimeLog` expose it to the UI
    (Settings → Appearance). Check this file first when debugging.
  - `agent/` — **the native tool-calling kernel** (`kernel.ts` = the loop),
    `presets.ts` (per-surface system prompt + tool set + posture), `registry.ts`,
    `permissions.ts` (permission broker), `scheduler.ts`, `commandLog.ts`,
    `fsGuard.ts` (root confinement).
    - `tools/` — the agent's tools: `fs`, `search`, `bash`, `web`, `task`
      (sub-agents), `skill`, `ask`, `vision`.
    - `mcp/` — MCP host (`host.ts`) for external tool servers.
    - `provider/`, `session/`, `skills/`.
  - `ipc/` — `filesystem.ts`, `terminal.ts`, `ollama.ts`, `obsidian.ts`,
    `modelRouter.ts`, and `ipc/agent/` (background `collector`/`reviewer`/`backgroundManager`).
  - `index.ts` — wires everything; `preload.ts` — the `window.vibe` bridge;
    `dataHome.ts` — the user-chosen data root.
- **`src/renderer/`** — React UI.
  - `components/` grouped: `agent` (AgentSurface, DesignCanvas, DebatePanel),
    `claude` (ChatRail, Settings, Projects, CommandPalette, ModelPicker),
    `editor` (Monaco), `terminal`, `filetree`, `layout`, `auth`, `ai`, `common`.
  - `store/` — zustand stores: `ui`, `agentRun`, `settings`, `ollama`, `debate`,
    `editor`, `usage`, `swarms`, etc.
  - `services/agentClient.ts` + `services/agent/*` (direct/orchestrator/plan/stream/
    repair/swarm) — renderer-side agent orchestration.
- **`src/shared/`** — cross-process contracts: `agent.ts` (`Surface`, `RunRequest`,
  deltas), `ipcContracts.ts` (channel names — `AGENT_CHANNELS`, `DATA_CHANNELS`,
  `DEBATE_CHANNELS`), `types.ts` (`VibeAPI`).

**Surfaces**: same kernel, four faces defined in `agent/presets.ts` — Chat (read-only
Q&A), Cowork (autonomous file/shell agent), Code (terminal-native coding), Design
(live HTML/SVG canvas). Switch via `ChatRail`.

## Conventions

- TypeScript, `strict: true`, `noUnusedLocals: false`. 4-space indent, single quotes.
- Renderer state = zustand stores in `store/`. Cross-process calls = add a channel to
  `shared/ipcContracts.ts`, a handler in `main/`, and a method on `VibeAPI`/`preload.ts`.
- The agent must **read a file before editing**, verify with build/tests, and stay
  inside the project root (`fsGuard`). Permission-gated tools prompt the user.
- After changing IPC contracts or `VibeAPI`, run `npx tsc --noEmit` — the contract test
  (`shared/ipcContracts.test.ts`) guards channel consistency.
- **Theming:** `theme: 'dark' | 'light'` lives in `store/settings.ts` (persisted) and is
  applied via `<html data-theme>`; both variable blocks in `styles/globals.css` have
  light overrides, and Monaco (`vibe-dark`/`vibe-light`) + xterm follow the setting.
  Add new colors as CSS variables in both themes — never hardcode hex in components.
- **Main-window sandbox is ON** (`sandbox: true`). The preload must stay a fully
  bundled file whose only runtime `require()` is `'electron'` — verify with
  `grep -o "require([^)]*)" dist-electron/preload.js` after building.
- **Background agents** (`ipc/agent/collector|reviewer.ts`) are idempotent:
  `start()` for the same project is a no-op, `stop()` fully resets state, and all
  `.vibe` artifacts carry a `version` field (currently `1`).

## Developing further

1. `npm run dev`, make the change, keep `npx tsc --noEmit` green.
2. `npm test` after touching the kernel, stores, or services.
3. Before finishing, re-check the zero-Tensora invariant grep above.
4. The agent kernel (`src/main/agent/*`) is **shared conceptually with `../Tensora`**
   (it was copied there). If you change kernel behavior that both should get, apply the
   same change in both repos, or note the divergence. See the split note below.

## Related

- Sibling repo `../Tensora` — the standalone security workbench (has its own CLAUDE.md).
- `SETUP.md` — clone & run. `README.md` — product overview. `docs/` — design notes.
