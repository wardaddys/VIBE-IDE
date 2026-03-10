# VIBE IDE

**Agent-first integrated development environment.**

Your AI writes the code, runs the terminal, fixes errors. You make the decisions.

---

## What Is VIBE?

VIBE is a standalone Electron desktop application that combines a world-class code editor (Monaco), an integrated terminal, and an autonomous AI agent layer. It is NOT a VS Code fork — it embeds Monaco Editor independently with a custom UI built from scratch.

## Core Differentiators

- **Model Agnostic:** Local models via Ollama (free, offline) + cloud models (Claude, GPT, Gemini) via integrated token proxy. Users never copy API keys.
- **Multi-Domain:** Not just for web devs. Cybersecurity (VM viewer), embedded systems (serial monitor), and general development are first-class citizens.
- **Offline-First:** Full functionality with local models. Cloud is an upgrade, not a requirement.
- **Premium UI:** Glass-morphism design language with mesh gradient backgrounds. Light theme by default. Looks like a product built by a 50-person design team.

## Target Users

1. General software developers (all languages)
2. Cybersecurity professionals (red team, pentesting)
3. Embedded systems engineers (ECU, IoT, firmware)
4. Web developers (full-stack)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop Shell | Electron |
| UI Framework | React 18 + TypeScript |
| Build Tool | Vite |
| Code Editor | Monaco Editor |
| Terminal | xterm.js + node-pty |
| State Management | Zustand |
| AI Communication | Ollama API (local) + custom proxy (cloud) |
| Agent Protocol | MCP (Model Context Protocol) |
| Packaging | electron-builder |

## Design System

- **Style:** Glass-morphism panels on mesh gradient background
- **Theme:** Light by default, dark available
- **Fonts:** DM Sans (UI), JetBrains Mono (code)
- **Accent:** Blue gradient (#0055ff → #0088ff → #00aaff)
- **Panels:** Frosted glass with backdrop blur, 14px border radius, soft shadows
- **Background:** Multi-layer radial gradients (blue + cyan + warm orange undertone)

## Session Types

| Type | Special Panes | Use Case |
|------|--------------|----------|
| General | Editor + Terminal + Mission Control | Any language, any project |
| Security | + VM Viewer (noVNC/RDP) | Pentesting, exploit dev |
| Embedded | + Serial Monitor | ECU tuning, IoT, firmware |
| Web | + Browser Preview | Frontend, full-stack |

## Model Strategy

### Free Tier (Local via Ollama)

| Model | VRAM | Best For |
|-------|------|----------|
| Qwen 2.5 Coder 1.5B | ~2GB | Low VRAM, basic coding |
| DeepSeek Coder 1.3B | ~2GB | Code completion |
| Phi-3 Mini 3.8B | ~3GB | General tasks |
| Qwen 2.5 Coder 7B | ~6GB | Good quality coding |
| Qwen 2.5 Coder 32B | ~20GB | Best open-source coding |
| DeepSeek V3 | ~16GB+ | Complex reasoning |

### Paid Tier (Cloud via Token Proxy)

| Provider | Models | Strength |
|----------|--------|----------|
| Anthropic | Claude Sonnet 4, Opus 4 | Best tool use, coding |
| OpenAI | GPT-4o, GPT-4.1 | Fast, vision |
| Google | Gemini 2.5 Pro/Flash | Massive context, cheap |

Revenue model: Buy API tokens wholesale, sell to users at ~20% margin via Paddle (Merchant of Record, pays out to Payoneer).

## Agent Architecture

```
USER PROMPT → PLAN → EXECUTE → OBSERVE → DECIDE
                                            ↓
                                    SUCCESS → report
                                    ERROR → CORRECT → loop back to EXECUTE
```

The agent communicates with the system through MCP tools:

| Tool | Description |
|------|-------------|
| read_file | Read file contents |
| write_file | Create/overwrite file |
| edit_file | Targeted search/replace |
| list_directory | List files and folders |
| run_command | Execute shell command |
| search_codebase | Regex/semantic search |
| git_operation | Commit, branch, diff |
| browser_screenshot | Capture browser preview |
| vm_screenshot | Capture VM viewer |
| serial_send / serial_read | Hardware communication |
| ask_user | Request user approval |

## UI Layout

```
┌──────────────────────────────────────────────────────┐
│ TitleBar [VIBE logo] [Session Tabs] [User]            │
├──────┬───────────────────────────────┬───────────────┤
│      │  Editor Tabs + Monaco Editor  │  Mission      │
│ File │  (glass panel)               │  Control      │
│ Tree │                               │  (glass panel)│
│      │                               │  280px        │
│ 210px├───────────────────────────────┴───────────────┤
│      │  Terminal (dark bg inside glass panel) 140px   │
├──────┴───────────────────────────────────────────────┤
│ ChatBar [Model Selector] [Input] [/plan /edit] [Send] │
└──────────────────────────────────────────────────────┘

Background: mesh gradient. All panels: glass-morphism with 6px gap.
```

## Development Phases

| Phase | Weeks | Goal |
|-------|-------|------|
| 0 — Foundation | 1-3 | Electron + Monaco + Terminal + File Tree + Ollama chat |
| 1 — Agent Core | 4-7 | MCP tools, agent loop, Mission Control, plan/execute/observe |
| 2 — Model Router | 8-11 | Multi-model support, token proxy, credit system, Paddle |
| 3 — Workstation | 12-16 | Session types, VM viewer, browser preview, serial monitor |
| 4 — Polish | 17-22 | Cybersecurity features, embedded tools, settings, keybindings |
| 5 — Launch | 23-26 | Website, docs, code signing, auto-update, launch strategy |

## Project Structure

```
vibe-ide/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── electron-builder.yml
├── INFO.md                    ← this file
├── src/
│   ├── main/                  # Electron Main Process
│   │   ├── index.ts           # Window creation, IPC setup
│   │   ├── preload.ts         # contextBridge (secure IPC)
│   │   └── ipc/
│   │       ├── filesystem.ts  # File read/write/watch
│   │       ├── terminal.ts    # node-pty shell management
│   │       └── ollama.ts      # Ollama detect/list/chat
│   ├── renderer/              # React UI
│   │   ├── index.html
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── styles/globals.css
│   │   ├── store/             # Zustand stores
│   │   ├── components/        # React components
│   │   └── hooks/             # Custom hooks
│   └── shared/
│       └── types.ts           # Shared TypeScript types
├── server/                    # Token proxy (Phase 2)
└── resources/                 # Icons, themes, templates
```

## Key Decisions

- **Standalone Electron, NOT a VS Code fork.** Full control over UI. No upstream merge hell.
- **Paddle for payments.** Merchant of Record. Handles global tax. Pays to Payoneer.
- **Light theme default.** Professional, distinctive. Dark theme available.
- **Syncthing for multi-machine dev.** Laptop (coding) ↔ Desktop (Ollama + testing).
- **Open-source planned.** Build reputation, attract contributors, potential acquisition interest.

## Author

Muhammad Saeed — Software engineer and digital creator based in Pakistan.
