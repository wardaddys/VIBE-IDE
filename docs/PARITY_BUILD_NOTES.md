# VIBE IDE - Claude Desktop Parity Build (implementation notes)

Date: 2026-07-10
Status: Phases A-F built, type-clean (0 tsc errors), 31/31 unit tests pass, production bundle builds.

## What was built

A native tool-calling agent kernel in the MAIN process with three surfaces (Chat / Cowork /
Code) over one loop, backed by Ollama local + cloud models. This replaces the old
XML-regex-over-text "agent" and the PowerShell screen-scraping tool execution.

### New main-process module: `src/main/agent/`
| File | Role |
|------|------|
| `kernel.ts` | The native tool-calling loop. Streams a turn, executes tool calls (permission-gated), feeds results back, repeats. Per-run AbortController. Sub-agent spawner (depth<=2). |
| `registry.ts` | ToolRegistry: advertises schemas to the model, executes calls through the broker, truncates results. |
| `permissions.ts` | PermissionBroker: allow/deny/always, persisted to `.vibe/permissions.json`, keyed on resolved target. Out-of-root -> force ask. |
| `presets.ts` | Surface presets = system prompt + tool set + posture (chat/cowork/code). |
| `fsGuard.ts` | Canonicalizes paths (~, .., symlinks) so rules can't be bypassed. |
| `scheduler.ts` | Cron + one-shot headless runs. |
| `provider/ollama.ts` | Native `/api/chat` with `tools` (primary transport, local + cloud). |
| `provider/openaiCompat.ts` | OpenRouter / HF / OpenAI / DeepSeek / Groq, streamed tool-arg accumulation. |
| `provider/anthropic.ts` | `/v1/messages` for real Claude keys + Claude-Code drop-in. |
| `mcp/host.ts` | MCP stdio JSON-RPC client. Tools registered as `mcp__server__tool`. Defends against stdout-logging servers. |
| `skills/loader.ts` | SKILL.md discovery + progressive disclosure. |
| `session/store.ts` | Thread + message persistence (JSONL). |
| `tools/fs.ts` | read_file, write_file (blind-write guard), edit_file (unique-match), list_dir. |
| `tools/search.ts` | glob + grep (pure Node, no ripgrep binary -> no asarUnpack trap). |
| `tools/bash.ts` | Persistent per-session shell + exit-code sentinel (real exit codes, no prompt scraping). |
| `tools/web.ts` | web_search / web_fetch via Ollama's hosted API. |
| `tools/task.ts` | Sub-agent delegation. |
| `tools/skill.ts` | use_skill (loads a skill body on demand). |
| `index.ts` | Wires all subsystems + the generic agent IPC surface. |

### New renderer
| File | Role |
|------|------|
| `store/agentRun.ts` | Run state: items (user/assistant/thinking/tool/permission/status/error), surface, sessions. |
| `services/agentClient.ts` | Bridges `window.vibe.kernel.onDelta` -> store; runTurn / cancel / approve / switchSurface. |
| `components/agent/AgentSurface.tsx` | The UI: Chat/Cowork/Code tabs, message stream, model picker, input, drag-drop images. |
| `components/agent/ToolCallCard.tsx` | Collapsible tool call with inline diff for edits. |
| `components/agent/PermissionPrompt.tsx` | Allow once / session / always / deny. |
| `components/agent/ArtifactPane.tsx` | Sandboxed live preview of ```html / ```svg artifacts. |

### Shared / wiring
- `shared/agent.ts` - the serializable contract (AgentDelta, MessagePart, RunRequest, etc.).
- `shared/ipcContracts.ts` - added `AGENT_CHANNELS`.
- `main/preload.ts` - added `window.vibe.kernel.*`.
- `main/index.ts` - calls `registerAgentHandlers`.
- `MainArea.tsx` - right panel now renders `<AgentSurface/>`.
- `electron-builder.yml` - `asar: true` + `asarUnpack` node-pty.
- `vite.config.ts` - externalized `node:crypto`/`node:net`/`node:stream`.

## Bugs fixed along the way
1. `write_file` no-op in the legacy loop -> the new `tools/fs.ts` writes for real (with a blind-overwrite guard).
2. Global AbortController cross-cancel -> per-run controller in the kernel.
3. `message.tool_calls` discarded -> the native adapter consumes them.
4. PermissionBroker emit-before-pending race (found by a unit test) -> pending set before emit.

## How to run
- Dev: `npm run dev`
- Build: `npm run build` (tsc + vite + electron-builder)
- Tests: `npm test`  (31 passing)
- Typecheck: `npx tsc --noEmit`

## Configuration
- Ollama web tools: set the `ollama` API key in Settings (OLLAMA_API_KEY from ollama.com/settings/keys).
- MCP servers: `<userData>/mcp.json`, Claude-Desktop shape: `{ "mcpServers": { "github": { "command": "npx", "args": [...] } } }`. Reload via the kernel `mcpReload`.
- Skills: drop SKILL.md folders under `<userData>/skills/` or `<project>/.vibe/skills/`.

## Deferred / follow-ups
- The legacy `ChatBar` + `orchestrator.ts` (XML path) remain in the tree but are no longer mounted; safe to delete once the new surface is accepted.
- MCP HTTP/SSE transport (stdio is implemented; HTTP is stubbed to error clearly).
- Parallel tool execution (currently sequential, which is safer with the permission broker).
- Artifact <-> tool message bridge (preview is sandboxed and one-way for now).
