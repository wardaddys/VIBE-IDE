# VIBE IDE → Claude Desktop Parity: System Design

Author: system-design pass for M. Saeed
Date: 2026-07-10
Status: Draft for build
Scope: Make VIBE match Claude Desktop's three surfaces — **Chat**, **Cowork**, **Claude Code** — running on Ollama local + cloud models, with the same agentic behavior (native tool calling, MCP connectors, skills, permissions, sub-agents, scheduled tasks, artifacts).

---

## 0. Verdict first

You are not missing "features." You are missing **one thing**: a real agent kernel.

Claude Desktop's Chat, Cowork, and Claude Code are **not three products**. They are one native tool-calling loop with three tool sets and three UIs bolted on top. Everything users perceive as "Cowork can touch my files," "Claude Code runs my build," "Chat searches the web" reduces to: *the model emits a structured `tool_use`, a harness executes it against a registered tool, the result is fed back, repeat until stop.*

VIBE today fakes that loop with regex over free text (`<read_file>`, `<execute>`) and executes tools by typing into a PowerShell pane and scraping the output. That is the ceiling you keep hitting. You cannot reach parity by adding more XML tags. You reach it by replacing the loop.

The good news: Ollama already exposes native tool calling for local **and** cloud models on three compatible surfaces (`/api/chat`, `/v1/chat/completions`, `/v1/messages`). The transport is solved. The work is the kernel, the tool registry, the MCP client, the permission broker, and three UI shells over one core.

**What I would build:** a single `AgentKernel` in the **main process** (not the renderer — see §3.1), a typed in-process `ToolRegistry`, an `McpHost` for connectors, a `PermissionBroker`, a `SkillLoader`, and a `SubAgent` runner. The three surfaces become thin presets over that kernel. Estimated: this is the 80% that unlocks the other 95% of perceived parity.

---

## 1. Current state (ground truth, from source)

| Area | File | Reality |
|---|---|---|
| Agent loop | `src/renderer/services/agent/orchestrator.ts` | Plan → Critic → Execute(waves) → Verify. Tools parsed by **regex** over model text. Runs in the **renderer**. |
| "Tool" execution | same | `read_file`→`fs:readFile` ✓. `execute`→types into PowerShell pane, polls stdout ✗ fragile. `write_file`→**does nothing** (sets a string, never calls `writeFile`). Critical silent bug. |
| Model routing | `src/main/ipc/modelRouter.ts` | ollama / openai / anthropic / gemini / openrouter / hf. Ollama chosen by `-cloud` substring or `ollama:` prefix. **`tools` never sent.** |
| Streaming | `src/main/ipc/ollama.ts` `ollama:chat` | Extracts `message.content` only. **Discards `message.tool_calls`.** |
| Direct chat | `src/renderer/services/agent/direct.ts` | Single-shot streamed chat. Fine. |
| Modes | `store/ui.ts` `chatMode` | `auto`/`chat`/`agent`, chosen by keyword regex `intent.ts`. |
| Background intel | `main/ipc/agent/{collector,reviewer}.ts` | Ambient collector + reviewer producing "briefings." This is your proto-Cowork ambient layer. Keep it. |
| Filesystem | `main/ipc/filesystem.ts` | Real read/write/watch, path-confined to project root ✓. No edit(search/replace), no glob, no grep. |
| MCP | — | **Not implemented.** `INFO.md` claims it; no client exists. |
| Permissions | `types.ts` `requiresApproval` | Field exists, **never used**. No approval UI, no gating on command exec or out-of-root writes. |
| Skills / Sub-agents / Scheduled tasks / Artifacts / Web-search tool | — | None. |

### 1.1 The three bugs to fix regardless of parity work
1. **`write_file` no-op** (`orchestrator.ts`, the `writeMatch` branch). The agent literally cannot save files it writes. Everything downstream ("verify," "criteria met") is scored against work that never hit disk.
2. **Single global `abortController`** in `ollama.ts` — one in-flight request kills the previous. The moment you have sub-agents or parallel waves, they abort each other. Must become per-run.
3. **PowerShell prompt detection** (`runtime.ts` `pollTerminalOutput`, regex `/^PS [A-Za-z]:\\/`) — breaks on non-Windows, on `oh-my-posh`/custom prompts, on any long-running command with no prompt echo. This entire mechanism goes away when tools run in-process (§4).

---

## 2. Capability gap matrix (Claude Desktop → VIBE)

| Claude Desktop capability | VIBE today | Gap | Target component |
|---|---|---|---|
| Native tool calling (streamed `tool_use`) | Regex over text | Full | `AgentKernel` + provider adapters (§3.2, §6) |
| In-process tools: Read/Write/Edit/Glob/Grep/Bash | Partial + terminal scrape | High | `ToolRegistry` (§4) |
| Bash tool with sandbox + streaming | Screen-scraped PS pane | High | `BashTool` via node-pty, structured (§4.2) |
| MCP connectors (stdio + HTTP/SSE) | None | Full | `McpHost` (§5) |
| Skills (folder = instructions + scripts) | None | Full | `SkillLoader` (§7) |
| Permission prompts (allow / deny / always) | None | Full | `PermissionBroker` (§8) |
| Sub-agents (Task tool, isolated context) | `swarm.ts` (text-based) | Medium | `SubAgentRunner` (§9) |
| Extended thinking | `thinkOptions` (partial) | Low | already routed; wire to native `think` (§6.3) |
| Web search / fetch tools | None | Medium | wrap Ollama `/api/web_search`,`/api/web_fetch` (§4.3) |
| Projects / memory / threads | `.vibe/memory.json`, workspace threads | Medium | formalize `SessionStore` (§10) |
| Artifacts (live HTML/preview) | Monaco + (planned) preview | Medium | `ArtifactPane` (§11.3) |
| Scheduled / recurring tasks | None | Medium | `Scheduler` (§12) |
| Vision / image input | capability flags only | Medium | multimodal message parts (§6.4) |
| File upload into chat | None | Low | drag-drop → tool context (§11) |
| Chat / Cowork / Code surfaces | one chat + one loop | High | three presets over kernel (§11) |

---

## 3. Target architecture

### 3.1 Process topology — move the kernel to main

Today the agent loop lives in the **renderer** and calls Node via IPC per tool. That is the wrong boundary for a native loop, because:

- MCP **stdio** servers are child processes — you cannot spawn/pipe them from a sandboxed renderer.
- Every tool call becomes an IPC round-trip; sub-agents multiply that.
- The permission broker must sit *between* model output and side effects — that gate belongs in main, where the side effects are.

Target:

```
┌─────────────────────────────── Electron Main (Node) ───────────────────────────────┐
│                                                                                     │
│  AgentKernel (the loop)                                                             │
│    ├─ ProviderAdapter  ── Ollama native /api/chat  (local + cloud)  [primary]       │
│    │                   ── Anthropic-compat /v1/messages (Claude Code drop-in)       │
│    │                   ── OpenAI-compat (OpenRouter / HF / etc.)                     │
│    ├─ ToolRegistry ──── read/write/edit/glob/grep/bash/web_search/task/...          │
│    ├─ McpHost ───────── stdio + HTTP/SSE MCP servers → tools namespaced mcp__srv__x │
│    ├─ PermissionBroker ─ allow/deny/always, per-tool + per-path rules               │
│    ├─ SkillLoader ───── SKILL.md discovery, progressive disclosure                  │
│    ├─ SubAgentRunner ── spawns child AgentKernel with isolated context              │
│    └─ SessionStore ──── threads, memory, plan artifacts, permission decisions       │
│                                                                                     │
│  IPC surface (typed, generic):  agent:run · agent:cancel · agent:approve            │
│  events:  agent:delta (text|thinking|tool_call|tool_result|status|permission_req)   │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                            │ contextBridge (preload)
┌──────────────────────────────────────────┴──────────────────────────────────────────┐
│  Renderer (React) — dumb-ish views subscribing to agent:delta                        │
│    Surfaces:  ChatView · CoworkView · CodeView   (presets: tool set + layout)        │
│    Shared:    MessageStream · ToolCallCard · PermissionPrompt · DiffView · Artifact   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

The renderer stops *driving* the loop and starts *rendering* it. `orchestrator.ts`'s job (deciding what tool to call) moves into the kernel in main; the renderer only shows deltas and answers permission prompts.

### 3.2 The kernel loop (replaces the XML plan/critic/execute machine)

```
run(session, userMessage):
  messages ← session.history + userMessage
  loop (until stop_reason == end_turn OR budget exhausted):
    stream ← provider.chat(model, messages, tools=registry.schemas(session), think)
    for delta in stream:
      emit delta                      # text / thinking / tool_call partials → UI
    assistantMsg ← collect(stream)    # text + tool_calls[] + stop_reason
    messages.push(assistantMsg)
    if assistantMsg.tool_calls is empty: break     # model is done talking
    results ← []
    for call in assistantMsg.tool_calls:
      decision ← permissions.check(call)           # may emit permission_req → await user
      if decision == deny: results.push(toolDenied(call)); continue
      out ← registry.execute(call, session.ctx)    # in-process or MCP or subagent
      results.push(toolResult(call.id, out))
      emit tool_result
    messages.push(results)            # role:'tool' entries, keyed by call id
  persist(session, messages)
```

That is the whole thing. Plan/critic/verify from the current code become **optional strategies** you can layer *inside* a tool or a system-prompt preset — not the transport. Claude Desktop does not run a hardcoded 4-phase state machine; it lets the model plan in-context and call tools. Match that. Keep your plan-artifact persistence (`.vibe/plans/*.json`) as an *output* of a "plan mode" preset, not as the control flow.

**Why native loop over the current state machine:** the current machine caps at `MAX_STEPS=12`, forces one tool per step via regex, and can't interleave reasoning with tool use mid-turn. Native tool calling lets the model call three tools, read results, and call two more in a single logical turn — which is exactly why Claude Desktop feels fluid and VIBE feels mechanical.

---

## 4. Tool layer (in-process, typed) — the thing that kills terminal-scraping

### 4.1 Registry contract

```ts
// src/main/agent/tools/types.ts
export interface ToolContext {
  sessionId: string;
  projectRoot: string | null;
  cwd: string;
  signal: AbortSignal;          // per-run, NOT the global controller
  emit: (e: AgentDelta) => void;
  permissions: PermissionBroker;
}

export interface Tool<I = unknown, O = unknown> {
  name: string;                 // "read_file", "bash", "mcp__github__create_issue"
  description: string;
  inputSchema: JSONSchema;      // sent verbatim to the model
  mutates: boolean;             // → permission tier
  reads: boolean;
  render?: (input: I) => string;// one-line UI summary ("Edit src/x.ts")
  execute(input: I, ctx: ToolContext): Promise<ToolResult<O>>;
}

export interface ToolResult<O = unknown> {
  ok: boolean;
  content: string;              // model-visible text (truncated/paginated)
  data?: O;                     // structured, for UI (diff, rows, image)
  isError?: boolean;
}
```

### 4.2 Core tools (parity set)

| Tool | Impl | Notes / hidden quirk |
|---|---|---|
| `read_file` | reuse `fs:readFile` | Add line-range + byte cap. Return with line numbers so `edit_file` can target. |
| `write_file` | `fs:writeFile` | **Fixes the no-op bug.** Refuse to overwrite a file not previously read this session (Claude Code's rule — prevents blind clobber). |
| `edit_file` | new | Exact-string search/replace with uniqueness check; fail loudly if `old_string` not unique. This is what makes surgical edits possible; today VIBE can only rewrite whole files. |
| `glob` | new, `fast-glob` | Confine to root. Sort by mtime. |
| `grep` | new, `ripgrep` binary bundled | Ship `rg` in `resources/`; do **not** shell out to a maybe-absent system `rg`. |
| `list_dir` | reuse `fs:readDir` | — |
| `bash` | node-pty, structured | See below. |
| `web_search` | Ollama `/api/web_search` | §4.3 |
| `web_fetch` | Ollama `/api/web_fetch` | §4.3 |
| `task` | `SubAgentRunner` | §9 |

**`bash` done right (no more scraping):** spawn the command in a dedicated pty *per invocation* (or a persistent shell with a sentinel-echo protocol), capture stdout/stderr to completion using an **exit-code sentinel**, not a prompt-regex:

```
send:  <cmd>; echo "__VIBE_EXIT_$LASTEXITCODE__<nonce>"
read:  until line matches __VIBE_EXIT_(\d+)_<nonce>__
```

The nonce defeats the case where the command's *own output* contains your sentinel — a real failure mode the current `PS ...` regex ignores. On POSIX use `; echo "__VIBE_EXIT_$?__<nonce>"`. This gives you a real exit code (the current code has none — it cannot tell success from failure) and terminates deterministically regardless of prompt theme or OS.

Keep the interactive terminal pane for the *user*. The agent's `bash` tool uses its own managed shell so agent commands and human commands don't interleave in one scrollback.

### 4.3 Web tools — free parity win

Ollama exposes `POST https://ollama.com/api/web_search` and `/api/web_fetch` (Bearer `OLLAMA_API_KEY`). Wrap both as tools. This gives Chat and Cowork the same "search the web" behavior Claude Desktop has, using the user's existing Ollama account — no separate search vendor. Quirk: results are large (thousands of tokens); truncate to ~2k tokens/result before feeding back, and bump `num_ctx` to ≥32k when these tools are enabled or the model will silently drop earlier context.

---

## 5. MCP host (connectors = the bulk of "Cowork can do X")

MCP is how Claude Desktop talks to Slack, GitHub, Notion, Linear, filesystem servers, etc. It is a JSON-RPC 2.0 protocol over two transports: **stdio** (local child process) and **HTTP/SSE** (remote). Implement a client `McpHost` in main.

```
McpHost:
  loadConfig(.vibe/mcp.json | app settings)      # Claude-Desktop-shaped config
  for each server:
     stdio:  spawn(command, args, env); frame JSON-RPC over stdin/stdout
     http:   POST + SSE stream
  initialize → tools/list → register each as Tool "mcp__<server>__<tool>"
  route registry.execute → tools/call
  surface tools/list_changed, prompts, resources
```

Config compatible with Claude Desktop's shape so users can paste existing configs:

```json
{ "mcpServers": {
    "github":     { "command": "npx", "args": ["-y","@modelcontextprotocol/server-github"],
                    "env": { "GITHUB_TOKEN": "..." } },
    "filesystem": { "command": "npx", "args": ["-y","@modelcontextprotocol/server-filesystem","<root>"] }
} }
```

Decisions I'd make:
- **stdio first**, HTTP/SSE second. Most connectors people run locally are stdio.
- Namespacing `mcp__server__tool` (double underscore) matches the Claude ecosystem and keeps your permission rules greppable.
- Lazy-load `tools/list` on demand and cache; some servers are slow to boot — do not block session start on them (mirror the "servers still connecting" pattern Claude Desktop uses).

Hidden quirk: MCP stdio servers that log to **stdout** instead of stderr corrupt the JSON-RPC frame. Defend the parser (skip non-JSON lines) and pin server versions in config — an upstream server that adds a banner line to stdout will silently break every tool it exposes.

---

## 6. Provider / transport layer

### 6.1 Which endpoint — recommendation

Use **Ollama native `/api/chat` with the `tools` array as the kernel's primary transport** for both local and cloud models. Reasons: one schema for local and cloud, matches your existing `modelRouter` ollama branch, first-class `think`, and tool calls returned as structured `message.tool_calls`. Keep the **Anthropic-compat `/v1/messages`** adapter *only* for the CodeView "bring Claude Code semantics" path and for users who point external Claude Code at VIBE. Keep **OpenAI-compat** for OpenRouter/HF/third-party keys you already support.

Do **not** make Anthropic-compat the primary internal format: `tool_choice` is unsupported there (confirmed in Ollama docs), token counts are approximate, and you'd be translating your own tools into Anthropic blocks for no gain when the native endpoint is right there.

### 6.2 Native tool-call shapes

Request (native):
```json
{ "model": "qwen3.5:cloud", "stream": true,
  "messages": [...],
  "tools": [ { "type":"function","function":{ "name":"edit_file","description":"...",
             "parameters": { "type":"object","properties":{...},"required":[...] } } } ],
  "options": { "num_ctx": 65536 } }
```
Assistant turn returns `message.tool_calls: [{ function: { name, arguments } }]`. Feed results back as:
```json
{ "role":"tool", "tool_name":"edit_file", "content":"<result text>" }
```

### 6.3 Streaming — the quirk that will bite you

Ollama's **native** streaming delivers assistant *text* incrementally, but **tool calls typically arrive as a complete object in the final chunk of that turn**, not as token-by-token argument deltas. The Anthropic-compat stream *does* emit `input_json_delta` for tool args. Design the `ProviderAdapter` so the kernel consumes a **normalized delta stream** and never assumes partial tool-args:

```
AgentDelta =
  | { t:'text', v:string }
  | { t:'thinking', v:string }
  | { t:'tool_call', id, name, args }      # emitted once, args complete
  | { t:'tool_result', id, result }
  | { t:'status', v }
  | { t:'permission_req', call }
  | { t:'done', stop_reason }
```

If you build the UI expecting streamed tool-arg JSON (as the Anthropic path allows), it will render empty tool cards on the native path. Normalize down to "tool_call arrives complete," and treat arg-streaming as a nice-to-have the UI can ignore.

Also: the current `ollama:chat` handler must stop discarding `message.tool_calls`. That single omission is why no tool loop is possible today even though the endpoint supports it.

### 6.4 Multimodal

Native `/api/chat` accepts `images: [base64]` on a message. Anthropic-compat accepts base64 image blocks (URL images not supported — quirk). Model the internal message `content` as parts `(text | image | tool_use | tool_result | thinking)` so vision, drag-drop upload, and screenshots all flow through one type. Don't special-case images later; bake the parts model in now.

### 6.5 Model catalog

Cloud models rotate and get **deprecated on a schedule** (e.g. `glm-4.6`→`glm-5.1`, `qwen3-next:80b`→`qwen3.5`, retirements dated in Ollama docs). Do **not** hardcode a model list (the code already leans this way — `OLLAMA_ONLY_MODELS` is a static set, and old defaults like `glm-5:cloud` were rightly removed per the overview). Fetch `https://ollama.com/api/tags` for cloud availability at runtime and cache. Surface deprecation: when a selected model 404s, auto-suggest the documented successor.

---

## 7. Skills subsystem

A skill is a folder with `SKILL.md` (YAML frontmatter: name, description, optional `allowed-tools`) plus optional scripts/resources. Behavior to replicate: **progressive disclosure** — only the name+description sit in context until the model (or a trigger) invokes the skill, at which point the body is injected and its scripts become runnable.

```
SkillLoader:
  scan  .vibe/skills/*, <userSkills>/*, bundled skills
  index (name, description) → cheap, always in system preamble
  on invoke(name):  inject SKILL.md body; register declared scripts as runnable;
                    respect allowed-tools to scope permissions
```

Decision: implement skills as a **first-class tool** `use_skill(name)` plus an auto-suggest hook that surfaces matching skills by description (same as how this very environment routes work). That keeps them model-invocable in Chat *and* usable as slash-commands in CodeView.

---

## 8. Permission broker (the safety + UX gate)

Nothing today gates command execution or out-of-root writes. Claude Desktop's whole trust model is the allow/deny/always-allow prompt. Implement:

```
PermissionBroker.check(call) → allow | deny | ask
  rules (in order):
    explicit deny  (path/tool globs)
    explicit allow ("always allowed" from prior prompt)
    tier default:   read-only → allow;  mutating/exec/network → ask
  on ask: emit permission_req; await agent:approve(id, decision, scope)
          scope ∈ {once, session, always}; persist "always" to .vibe/permissions.json
```

Tiers map to `Tool.mutates|reads` (already sketched in `ModelCapability.requiresApproval`, currently dead). Concrete rules Claude-Desktop-equivalent:
- `read_file`, `glob`, `grep`, `list_dir`, `web_search` → auto-allow.
- `write_file`, `edit_file`, `bash`, any `mcp__*` that mutates → ask, with once/session/always.
- Out-of-root path in any tool → force-ask even if the tool is otherwise allowed.
- **Never** auto-allow `bash` blanket; match Claude Code's "allow this exact command / allow this prefix" granularity or you recreate a foot-gun.

Hidden quirk: permission decisions must key on the **resolved** target (canonical absolute path, normalized command), not the raw arg. `../../etc/hosts` and a symlink to it must hit the same rule, or "deny outside root" is trivially bypassed. `filesystem.ts` already does `path.relative` confinement — reuse `resolveAllowedPath` as the canonicalizer for every tool, not just fs.

---

## 9. Sub-agents (Task tool)

Your `swarm.ts` is the seed. Replace its text-passing with a real `task` tool that spawns a child `AgentKernel` with: its own message history (isolated context), a restricted tool set, a token/step budget, and a single string result returned to the parent. This is how Claude Desktop parallelizes "explore the codebase" or "review this" without polluting the main thread's context.

```
task({ description, prompt, subagent_type }) →
   child = AgentKernel(preset[subagent_type], tools=preset.tools, budget)
   result = child.run(prompt)          # child's tool calls gated by same broker
   return result.finalText             # only the summary crosses back
```

Decision: cap sub-agent depth at 2 and forbid a sub-agent from spawning network-mutating MCP tools unless the parent was explicitly granted them. Unbounded recursion + auto-allowed tools is how an agent burns your Ollama cloud quota in a loop.

---

## 10. Sessions, memory, threads

Formalize what's scattered across `workspaces.ts`, `.vibe/memory.json`, and plan artifacts into one `SessionStore` (SQLite via `better-sqlite3`, or JSONL append log if you want zero native deps):

```
Session { id, surface: chat|cowork|code, projectRoot, model, createdAt }
Message { sessionId, role, parts[], ts }
Memory  { projectRoot, facts[], lastSession, keyFiles[] }   # ← keep .vibe/facts.json
Permission { projectRoot, rule, decision, scope }
PlanArtifact { ... }                                         # keep current shape
```

Keep the ambient collector/reviewer (`main/ipc/agent/*`) feeding `Memory.facts` — that is a genuine differentiator (persistent project intelligence) and already works. Wire its briefing into the kernel's system preamble instead of only into the old loop.

---

## 11. The three surfaces (one kernel, three presets)

A "surface" = (system-prompt preset) + (enabled tool set) + (layout). That's it.

| | ChatView | CoworkView | CodeView |
|---|---|---|---|
| Preset intent | conversational, answer-first | agentic file/task work in a folder | terminal-native coding |
| Default tools | web_search, web_fetch, artifacts, (read-only fs) | read/write/edit/glob/grep/bash, MCP, skills, task, scheduled | read/write/edit/glob/grep/bash, MCP, git, plan-mode |
| Permission posture | ask on any mutation | ask, remembers "always" per project | Claude-Code-style command allowlist |
| Layout | message stream + artifact pane | file tree + stream + diff + task list widget | editor + terminal + stream, git gutter |
| Maps to Claude | Chat | Cowork | Claude Code |

### 11.1 Shared render components
`MessageStream`, `ToolCallCard` (collapsible: shows `Tool.render(input)` one-liner + expandable result/diff), `PermissionPrompt` (allow/deny/always), `DiffView` (for edit_file), `ThinkingBlock` (reuse `ThinkBlock.tsx`), `ArtifactPane`.

### 11.2 Mode selection
Kill the keyword-regex `intent.ts` as the *primary* switch. The surface sets the posture; within a surface, let the **model** decide to use tools (that's the point of native tool calling). Keep an explicit Chat/Agent toggle for user override (you already have `chatMode`). Auto-intent-by-regex is a crutch that misfires — the current `intent.ts` matches bare `write`/`create`/`generate`, so "write a poem" and "create a haiku" both wrongly enter agent mode; native tool calling makes the guesser unnecessary.

### 11.3 Artifacts
Render model-produced HTML/SVG/React in a sandboxed `<webview>` pane with a message bridge (so an artifact can call back a tool, mirroring Claude Desktop's artifact interactivity). Reuse Monaco for the code view of the same artifact. Persist artifacts per session.

---

## 12. Scheduled / recurring tasks

Claude Desktop can run a prompt on a schedule ("every morning…"). Implement a `Scheduler` in main: cron-or-fireAt records in `SessionStore`, a timer that wakes the kernel headless with a stored prompt and a target surface, results delivered to a notifications inbox. Ollama's Claude Code integration exposes `/loop`; you can mirror that as a CodeView slash-command backed by the same `Scheduler`.

---

## 13. IPC contract changes

Collapse the fixed method list in `preload.ts` toward a **generic agent channel** plus the existing fs/terminal primitives:

```
invoke  agent:run        (sessionId, userParts)      → runId
invoke  agent:cancel     (runId)
invoke  agent:approve    (permReqId, decision, scope)
invoke  agent:listTools  (sessionId)                 → ToolSchema[]
invoke  mcp:reload
event   agent:delta      (runId, AgentDelta)         # the normalized stream §6.3
```

Keep `fs:*`, `terminal:*`, `ollama:listModels`, obsidian, window controls. Retire: `ollama:chat` as the *agent* path (becomes an internal provider call); the renderer no longer orchestrates. The per-run `AbortController` replaces the module-global one — mandatory before sub-agents/waves.

---

## 14. Non-obvious failure modes (read this section twice)

1. **`write_file` never wrote.** Fix before anything else or you'll "verify" phantom work. (§1.1)
2. **Global abort controller** cross-cancels concurrent runs. Sub-agents and parallel tool calls are impossible until it's per-run. (§1.1)
3. **Native stream gives tool calls only at end-of-turn**, not as arg deltas — UI built on arg-streaming shows empty cards. Normalize. (§6.3)
4. **`tool_choice` unsupported on Ollama's Anthropic-compat endpoint** — you cannot force or forbid a tool there. If a preset needs "must call tool X," you must do it via prompt, or use the native endpoint and post-validate. (§6.1)
5. **MCP stdio servers that print to stdout** corrupt JSON-RPC framing. Skip non-JSON lines; pin versions. (§5)
6. **Bundled `ripgrep`/binaries**: `electron-builder` won't sign/notarize or unpack them unless listed in `asarUnpack`/`extraResources`. A tool that shells to `rg` works in `vite dev` and vanishes in the packaged app. Configure `electron-builder.yml` now, test the *packaged* build, not just dev.
7. **Context blow-up from web/grep/read**: large tool results silently push the system prompt and early turns out of `num_ctx`; the model "forgets" its instructions mid-run. Enforce per-result truncation + raise `num_ctx` (cloud models run full context; local ones don't — detect and cap).
8. **Cloud model deprecation** retires model IDs on dated schedules. Hardcoded IDs 404 in production. Fetch the catalog; map deprecated→successor. (§6.5)
9. **Permission bypass via path aliasing** (`..`, symlinks, UNC, `~`). Canonicalize before matching rules. (§8)
10. **Renderer-side secrets**: API keys currently flow through renderer state and into IPC calls. Once the kernel is in main, keep `OLLAMA_API_KEY` and MCP tokens **in main only**; never ship them to the renderer. Today they round-trip through the window — tighten this when you move the loop.
11. **Ollama not running / not signed in**: cloud calls fail with opaque errors. You already `ensureOllamaRunning()`; also detect "signed out" (401 from ollama.com) and prompt `ollama signin`, distinct from "server down."
12. **node-pty ABI**: rebuilt per Electron version; an Electron bump silently breaks the terminal until `electron-builder install-app-deps` reruns. Pin and add a postinstall guard.

---

## 15. Build plan (phased, each phase shippable)

**Phase A — Kernel + real tools (unblocks everything).**
Move loop to main as `AgentKernel`. Add `ToolRegistry` with read/write/edit/glob/grep/list_dir. Send `tools` to Ollama native; stop discarding `tool_calls`. Per-run AbortController. Fix `write_file`. Retire regex tool parsing. *Exit:* model edits a file via native tool call, streamed, in ChatView. Delete/September the plan/critic/verify machine into an optional preset.

**Phase B — Bash + permissions.**
Structured `bash` tool with exit-code sentinel (kill the PS-prompt scrape). `PermissionBroker` with allow/deny/always + persisted rules + `PermissionPrompt` UI. *Exit:* agent runs a build, sees the real exit code, and you approve the command once/always.

**Phase C — MCP host.**
stdio client, `mcp.json` (Claude-Desktop shape), namespaced tools, lazy `tools/list`. *Exit:* a GitHub or filesystem MCP server's tools appear and execute under the broker.

**Phase D — Surfaces.**
Split ChatView / CoworkView / CodeView as presets. Shared `ToolCallCard`/`DiffView`/task-list widget. Wire ambient briefings into the preamble. *Exit:* three tabs that feel like Chat / Cowork / Claude Code.

**Phase E — Skills, sub-agents, web tools, artifacts.**
`SkillLoader` + `use_skill`. `task` sub-agent runner. `web_search`/`web_fetch` tools. Sandboxed `ArtifactPane`. *Exit:* a skill triggers, spawns a sub-agent, which searches the web and renders an artifact.

**Phase F — Scheduler, sessions, multimodal, packaging.**
`Scheduler`, `SessionStore` (SQLite), image parts + drag-drop upload. Harden packaged build (asarUnpack rg, node-pty rebuild, signed binaries). *Exit:* signed installer where every Phase A–E capability works from the packaged app, plus a scheduled morning task.

Sequencing rationale: A is the spine — nothing else is real without it. B before C because you do **not** want MCP tools executing before the permission gate exists. D after C so surfaces present the full tool set. E/F are breadth once the core is load-bearing.

---

## 16. What I'd revisit as it grows

- **JSONL vs SQLite** for sessions: start JSONL (zero native deps, git-diffable), migrate to SQLite when thread search/history queries get slow (>~10k messages).
- **Tool result truncation policy**: static 2k cap works early; later, make it model-context-aware and add a `read_more(offset)` affordance like paginated file reads.
- **MCP HTTP/SSE + OAuth connectors**: defer until stdio is solid; the OAuth dance (remote connectors) is its own project.
- **Local model tool-call reliability**: small local models drop/malform tool calls. Keep a validator/repair layer (you have `repair.ts` — repurpose it to fix malformed native tool-call JSON, not XML). Gate "agentic mode" on `capabilities.tools === true` and warn on models known to be weak at it.
- **Parallel tool execution**: the kernel executes a turn's tool calls sequentially first (simpler, safer with the broker). Add bounded parallelism for read-only tools once permission UX handles concurrent prompts.
- **Windows/macOS/Linux shell divergence**: the sentinel-echo bash protocol needs per-OS variants; centralize in `BashTool`, not scattered `sanitizeForPowerShell` calls.

---

## Appendix — reference facts (verified 2026-07-10)

- Ollama cloud models: run server-side, same API as local, `:cloud`-suffixed or plain when hit via `https://ollama.com`. Auth: `OLLAMA_API_KEY` (create at ollama.com/settings/keys) or `ollama signin` for local proxying.
- Native tool calling: `/api/chat` accepts `tools`, returns `message.tool_calls`; results returned as `role:'tool'` messages. Confirmed by Ollama tool-calling + web-search agent docs.
- Anthropic-compat `/v1/messages`: supports messages, streaming, system, vision(base64), tools, tool_result, thinking. **Unsupported:** `tool_choice`, `metadata`, prompt caching, batches, citations, PDF, URL images, count_tokens. Token counts approximate.
- Claude Code on Ollama: `ANTHROPIC_BASE_URL=http://localhost:11434`, `ANTHROPIC_AUTH_TOKEN=ollama`, recommends ≥64k context; `ollama launch claude`.
- Web search/fetch: `POST ollama.com/api/web_search` and `/api/web_fetch`, Bearer key; results ~thousands of tokens, recommend ≥32k context.
- Cloud model deprecations are dated and announced; do not hardcode model IDs.

Sources: [Ollama Cloud](https://docs.ollama.com/cloud), [Anthropic compatibility](https://docs.ollama.com/api/anthropic-compatibility), [Claude Code integration](https://docs.ollama.com/integrations/claude-code), [Web search](https://docs.ollama.com/capabilities/web-search), [Tool calling](https://docs.ollama.com/capabilities/tool-calling).
