# VIBE IDE — System Design: Claude Desktop Parity on Ollama

Status: PROPOSED · 2026-07-10
Scope: Rearchitect VIBE IDE so it delivers the Claude Desktop experience — Chat, Cowork, and Claude Code–grade agentic coding — running on Ollama local and Ollama Cloud models.

---

## 0. The one decision that matters

**Do not hand-roll the agent runtime. Embed Claude Code (via the Claude Agent SDK) in the Electron main process, pointed at Ollama's Anthropic-compatible API (`http://localhost:11434/v1/messages`).**

Rationale, in order of weight:

1. Ollama ships an Anthropic-compatible `/v1/messages` endpoint with full support for streaming, system prompts, tool_use/tool_result blocks, thinking blocks, and vision. Running Claude Code against Ollama is an *officially documented and supported* Ollama integration (`ollama launch claude`), including cloud models (`glm-5:cloud`, `kimi-k2.5:cloud`, `qwen3.5:cloud`, `minimax-m2.7:cloud`).
2. "Feel exactly like Claude Desktop" is not a UI problem — it is the agent engine: the tool loop, permission model, MCP client, skills, subagents, hooks, slash commands, session resume, compaction, checkpoints. That engine is years of iteration. Reimplementing it on `/api/chat` + regex XML (the current approach) permanently caps quality at "demo."
3. Claude Desktop's Cowork mode is itself built on the Claude Agent SDK. Using the same engine is literally how you get the same behavior.
4. The engine is model-agnostic through the base-URL override. Every capability (MCP, skills, subagents, plan mode) works with whatever open model Ollama serves — quality then depends only on the model's tool-calling reliability, which is exactly why Ollama Cloud's frontier open models (kimi-k2.6, glm-5.1, qwen3.5, minimax-m3, deepseek-v4-flash) are the default recommendation, with local models as the offline fallback.

The current renderer-side planner→critic→executor→verifier pipeline (`src/renderer/services/agent/orchestrator.ts`) is deleted, not evolved. Justification in §2.

A thin **native path** (direct `/api/chat` via ollama-js) remains for plain chat streaming, title generation, inline completions, and the background collector/reviewer agents — places where spawning a full agent session is waste. This is not a second competing runtime; it has a bounded role: single-call or single-loop inference with at most the web_search/web_fetch tools.

---

## 1. Requirements

### 1.1 Functional — parity matrix

| # | Claude Desktop capability | VIBE target implementation | Phase |
|---|---|---|---|
| F1 | Chat mode: streaming conversations, history, search, edit/retry, attachments (images), extended thinking toggle | Native path (`/api/chat`, ollama-js), SQLite persistence, think param per model capability | P2 |
| F2 | Model picker with capability badges | Existing selector, rebuilt on live catalogs: local `/api/tags` + `ollama.com/api/tags` (cloud) | P2 |
| F3 | Web search + web fetch in chat and agent | Ollama web search API (`POST ollama.com/api/web_search`, `/api/web_fetch`) exposed as: chat-mode tool (native path) and in-process MCP server (agent path) | P2 |
| F4 | Claude Code: agentic loop with Read/Write/Edit/Bash/Grep/Glob/WebFetch, plan mode, permission modes | Agent SDK session per conversation, `ANTHROPIC_BASE_URL` → Ollama | P1 |
| F5 | Permission prompts (allow once / always / deny), acceptEdits, bypass | SDK `canUseTool` callback → IPC → renderer modal; rules persisted per project | P1 |
| F6 | Live tool-use rendering: tool cards, diffs, todo list widget | Renderer components consuming SDK stream events (incl. TodoWrite) | P1 |
| F7 | Session persistence, resume, fork, compaction | SDK native sessions + VIBE index DB | P1–P2 |
| F8 | CLAUDE.md / VIBE.md project instructions | SDK settingSources (CLAUDE.md); VIBE surfaces an editor UI for it | P1 |
| F9 | MCP client: stdio + HTTP servers, user-managed registry | SDK `mcpServers` option; VIBE settings UI writes `.mcp.json`-equivalent | P4 |
| F10 | Skills (SKILL.md folders) | SDK skills loading; VIBE skills manager UI (install/enable/create) | P3 |
| F11 | Subagents (Task tool, custom agent defs) | SDK `agents` option + `.claude/agents/*.md`; replaces "swarm" | P4 |
| F12 | Hooks (PreToolUse/PostToolUse etc.) | SDK hooks config; power-user settings pane | P4 |
| F13 | Slash commands | SDK custom commands (`.claude/commands`) + command palette UI | P3 |
| F14 | Cowork mode: folder-scoped autonomous tasks, task widget, file deliverables | Cowork surface = SDK session with cwd = mounted folder, task widget from TodoWrite, outputs pane | P3 |
| F15 | Scheduled tasks (`/loop`, cron) | Main-process scheduler (node-cron) spawning headless SDK sessions | P3 |
| F16 | Checkpoints / rewind | Git-based shadow snapshots per tool-write + Monaco diff/restore UI | P4 |
| F17 | Artifacts (rendered HTML/React preview) | Sandboxed `<webview>`/iframe artifact pane fed from code blocks | P5 |
| F18 | Memory across sessions | CLAUDE.md auto-memory + `.vibe/` notes retained; background reviewer briefings | P3 |
| F19 | Connectors directory / plugins | Curated MCP registry JSON shipped with app; one-click add | P5 |
| F20 | Desktop niceties: tray, global hotkey, auto-update | electron-builder + electron-updater, `globalShortcut` | P5 |

Explicit non-goals: Anthropic account features (Claude.ai sync, Projects cloud storage, mobile handoff), computer-use/browser-control (separate initiative), voice.

### 1.2 Non-functional

- **Windows-first** (dev machine is Windows; PowerShell quirks already encoded in `commandSanitizer.ts`). macOS/Linux follow.
- **Offline-capable**: every agent feature must work on a local model with zero network. Cloud is an upgrade path, selected per session.
- **Multi-session concurrency**: ≥3 simultaneous agent sessions + chat without cross-talk (hard requirement; current architecture cannot do 2).
- **Latency**: chat first-token < 500 ms on a loaded local 7B; agent tool-round-trip overhead (non-model) < 100 ms.
- **Crash isolation**: an agent session crash must not take down the app or other sessions.
- **Secrets**: API keys in OS keychain (`safeStorage`), never in renderer localStorage, never in logs.

### 1.3 Constraints

- Solo developer, part-time. Phases must each ship something usable.
- Existing stack retained: Electron 31, React 18, Vite, Zustand, Monaco, xterm/node-pty.
- Claude Code binary/SDK is Anthropic-proprietary (not OSS). It is npm-installable and designed for embedding, but **shipping it inside a commercial installer is a licensing checkpoint** — verify Anthropic Commercial Terms before the packaged release; fallback is a first-run "install engine" step that runs `npm i -g @anthropic-ai/claude-code` / `ollama launch claude --config` equivalent on the user's machine, which keeps distribution on Anthropic's channel.
- Local Ollama daemon is required even for cloud models in the agent path (the daemon is the Anthropic-shim host and transparently proxies `:cloud` models after `ollama signin`). Direct `ollama.com/api/chat` (Bearer `OLLAMA_API_KEY`) is used only by the native path and web search/fetch.

---

## 2. Current-state audit (ground truth, why it can't reach parity)

Repo: `VIBE-IDE/` — Electron main (`src/main`), React renderer (`src/renderer`), ~3.7k LOC core.

What exists and works: Monaco editor shell, xterm.js terminal on node-pty, file tree + watcher, Zustand stores, model selector with capability probing (`ollama:getCapabilities` reads real `/api/show` capabilities), multi-provider router (`modelRouter.ts`: Ollama/OpenRouter/Anthropic/OpenAI/DeepSeek/Groq/Gemini/HF), background collector/reviewer agents, Obsidian logging, plan artifacts under `.vibe/`.

Structural blockers found in the audit — each one is fatal for parity on its own:

1. **No native tool calling.** The agent "protocol" is regex over streamed prose: `stepResponse.match(/<read_file\s+path=.../)`, `<execute>`, `<write_file>` (orchestrator.ts:286-336). Ollama has had first-class `tools`/`tool_calls` in `/api/chat` for two years and the current code never sends a `tools` array. Modern tool-trained models (qwen3.5, kimi, glm) are RL-tuned to emit structured tool_calls; forcing them through prose-XML throws that training away and produces the classic failure: paths hallucinated inside tags, tags split across chunks, code fences swallowing tags.
2. **Command execution = keystroke injection into the user's visible terminal, output scraped by regex.** `runtime.ts` types into node-pty and polls until it sees `/^PS [A-Za-z]:\\/`. No exit codes, breaks on cmd/bash/zsh, breaks on any prompt customization (starship/oh-my-posh), breaks on long-running commands (60×500 ms cap), interleaves with anything the human types, and `clearTerminalOutput` races the shell. Claude Code executes headlessly with captured stdout/stderr/exit code; the human terminal is for the human.
3. **One global stream, one global AbortController** (`ollama.ts:7`, channel `ollama:stream`). Any second concurrent generation aborts the first — background agents, subagents, and multi-tab chat are structurally impossible.
4. **Rigid staged pipeline** (plan → critic → execute-per-step → verify) with self-graded `<score>` gates. Claude-style behavior is a single loop where the model interleaves reading, thinking, editing, running, and reacting to real signals (exit codes, diffs); the pipeline shape prevents exactly that fluidity, and "score ≥ 7" self-assessment is noise on small models.
5. **Chat history is ephemeral** (Zustand in-memory; tool results injected as fake `user` messages with `__TERMINAL_OUTPUT__` markers). No sessions, no resume, nothing like Claude Desktop's history.
6. **No permission layer.** The executor writes files and runs arbitrary shell with zero gating — the opposite of Claude Desktop's trust model, and dangerous with weaker local models.
7. **Context handling**: `num_ctx: 16384` hardcoded for every Ollama call (modelRouter.ts:57); no compaction; transcripts silently truncate. Also `modelName.includes('-cloud')` matches `-cloud` but not the actual `:cloud` suffix Ollama uses — cloud models only route correctly today by falling through to the default branch; an `openrouter:*-cloud` id would misroute to local Ollama.
8. Hygiene: a Syncthing conflict file sits in `src/renderer/components/ai/` (`ModelCapabilities.sync-conflict-*.tsx`) and is inside tsc's include set.

Verdict: keep the shell (editor/terminal/tree/stores/selector), replace the entire agent and chat transport underneath it.

---

## 3. High-level target architecture

```
┌────────────────────────────── Electron Renderer (React) ──────────────────────────────┐
│                                                                                        │
│  Surface: CHAT          Surface: COWORK              Surface: CODE (IDE)               │
│  ┌───────────────┐      ┌────────────────────┐      ┌──────────────────────────────┐  │
│  │ Conversation  │      │ Task widget (todos) │      │ Monaco + tabs + file tree    │  │
│  │ list + thread │      │ Deliverables pane   │      │ xterm (human terminal)       │  │
│  │ think blocks  │      │ Permission modals   │      │ Agent thread + tool cards    │  │
│  └──────┬────────┘      └─────────┬──────────┘      │ Diff viewer / checkpoints    │  │
│         │                          │                 └──────────────┬───────────────┘  │
│  ═══════╪══════════════ shared components: ToolCard, DiffCard, TodoList,              │
│         │                P