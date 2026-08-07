# VIBE IDE - Complete Feature Inventory (base -> current)

Baseline = the published repo `wardaddys/VIBE-IDE`. Everything under "Added this session"
was built on top of that baseline to reach Claude-Desktop-style parity on Ollama.

============================================================
PART 1 - BASELINE (wardaddys/VIBE-IDE)
============================================================

Shell & stack
- Standalone Electron desktop app (not a VS Code fork); React 18 + TypeScript + Vite; Zustand state.
- Monaco editor, editor tabs, file tree/explorer.
- Integrated terminal (xterm.js + node-pty) with a rolling output buffer.
- Secure preload/contextBridge IPC; typed IPC channel contracts + tests; strict tsc profile; Vitest.

Chat & agent (XML-based)
- Three modes: auto (regex intent), chat (direct streamed), agent (task loop).
- Agent loop: Plan -> Critic -> Execute(waves) -> Verify, with retries + reflection gate.
- DAG execution: `depends="..."` steps compiled into dependency waves.
- Tools parsed by REGEX over model text: read_file (real), execute (terminal scrape),
  write_file (was a no-op bug), analyze.
- Swarm: multi-agent runner with dependency-aware waves (text passing).
- `.vibe/` artifacts: memory.json, facts.json, plans/*.json, STATE.json, verification.latest.json.
- Repair artifacts generated on failed verification.

Model routing
- Unified router: Ollama (local + :cloud), OpenAI-style, Anthropic, Gemini, OpenRouter, HuggingFace.
- Ollama lifecycle (detect, serve, list via tags+ps+CLI), loaded-models.
- Capability detection (think/vision/tools/context) via /api/show + heuristics + fallback table.
- Thinking controls (toggle + tiered budgets); OpenRouter catalog (pricing/context/caps); HF search.

Background intelligence
- Collector + Reviewer agents managed by a background manager; periodic briefings.
- Neural widget visualizing collector/reviewer/health status.

Integrations & UI
- Obsidian: ping, note upsert/append, project note, run/decision logging.
- Settings modal: cloud API keys + background-agent models.
- Glass-morphism panels on mesh gradient; DM Sans + JetBrains Mono; light theme.

Known gaps at baseline
- No native tool calling (XML regex), terminal-scraping execution, write_file no-op,
  no MCP client, no permission gate, no skills/sub-agent-tool/scheduler/artifacts,
  Windows/PowerShell-centric, one global abort controller.

============================================================
PART 2 - ADDED THIS SESSION (parity rebuild)
============================================================

Native agent kernel (main process)
- AgentKernel: real native tool-calling loop (stream -> tool_use -> tool_result -> repeat).
- Per-run AbortController (replaces the global one); budget + max-iteration guards.
- Provider adapters behind one normalized delta stream:
  - Ollama native /api/chat with `tools` (primary; local + cloud).
  - Ollama CLOUD routing: cloud models hit https://ollama.com/api/chat with the Bearer API key
    (no `ollama signin` needed).
  - OpenAI-compatible (OpenRouter/HF/OpenAI/DeepSeek/Groq) with streamed tool-arg assembly.
  - Anthropic /v1/messages (real Claude keys + Claude-Code drop-in).

In-process tool registry (real tools, no scraping)
- read_file (line-numbered, ranged), write_file (fixed; blind-overwrite guard),
  edit_file (unique-match search/replace), list_dir.
- glob + grep (pure Node, no bundled ripgrep).
- bash: PERSISTENT per-session shell + exit-code sentinel; interactive PowerShell over pty
  (fixed the `-Command -` failure), `&&`->`;` on Windows, prompt/banner stripping, real exit codes.
- web_search + web_fetch (Ollama hosted API).
- task (sub-agent, isolated context, depth-limited).
- use_skill (progressive-disclosure skill loader).

Permission broker
- allow / deny / always, persisted to .vibe/permissions.json; keyed on canonical resolved target;
  out-of-root forces a prompt; safe tools auto-allow. Inline permission cards in the UI.

MCP host (connectors)
- stdio JSON-RPC client (defends against stdout-logging servers).
- Streamable-HTTP transport (session id + JSON/SSE responses) so remote registry servers connect.
- Tools namespaced mcp__server__tool at the network tier.
- Live registry browser (registry.modelcontextprotocol.io): search + Add/Remove + hot reload.

Skills
- SkillLoader with progressive disclosure; use_skill tool.
- Live catalog from github/anthropics/skills: install downloads the folder + auto-loads; remove.

Three surfaces over one kernel
- Chat / Cowork / Code presets (system prompt + tool set + permission posture + layout).

Conversation UX (Claude-style)
- Conversation-first shell: left chat rail, centered column, warm palette, big composer.
- Rich markdown: GFM tables, task lists, nested lists, syntax-highlighted code + copy buttons.
- Streaming: correct blinking cursor on the streaming message + bouncing typing indicator.
- Message actions: copy, regenerate, edit-and-resend, per-message model badge.
- Images: paste (clipboard items) / drag / attach -> thumbnails in composer AND in messages,
  click-to-open lightbox; images persist in history and go to vision models.
- Attachments: any file dropped/pasted -> text extracted into context.
- @-file mentions: fuzzy project-file picker inserts file contents.

Slash commands (keyboard-navigable)
- Actions: /model /clear /settings /skills /connectors /mcp /keys /schedule /projects /memory
  /workspace /palette.
- Tasks (run the agent): /init /explain /review /fix /test /docs /commit /pr /security /optimize
  /summarize /refactor /plan /web, plus Antigravity-style /goal /grill-me /learn.
- Info: /doctor (env + key + MCP + skills diagnostics), /help.

History, projects, scheduling, palette
- Sessions store (JSONL); auto-titled chats; rename / delete / search in the rail.
- Projects: per-project custom instructions (VIBE.md, injected each turn) + knowledge view.
- Scheduler + UI: recurring (cron) / one-shot tasks; pause/resume/delete; headless runs into a new chat.
- Command palette (Ctrl/Cmd+K) + shortcuts (Ctrl+N new chat, Ctrl+B workspace, Ctrl+, settings, Esc).

Full settings surface
- Sections: Account, API keys (incl. Ollama Cloud), Models (live picker), Connectors, Skills.
- Working model navigator: Local Ollama + live Ollama Cloud + OpenRouter + HF, searchable; portal-based
  modals that cover the window and close on backdrop/Esc.

Engineering
- Zero-new-dependency policy for the kernel; typed shared contract (shared/agent.ts);
  generic agent IPC surface; unit tests for fsGuard, glob, cron, and the permission broker;
  packaging config (asarUnpack node-pty, node:crypto external).

Status: TypeScript clean (0 errors), 32 unit tests passing, production bundle builds.
