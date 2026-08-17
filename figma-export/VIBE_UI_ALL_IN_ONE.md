# VIBE IDE — UI Reference & Redesign Guide (for the Figma agent)

> **For the Figma agent.** This is the complete reference to VIBE IDE's UI: what the app
> is, how its UI is built, every component, every design token, and exactly what we want
> you to deliver. The source code for all of this lives in `src/renderer/` next to this
> file (read-only copy — it does not build standalone).

---

## 1. What VIBE IDE is

VIBE is an **agent-first desktop IDE** — an Electron app (React + TypeScript) where an AI
agent plans, edits files, runs terminal commands, verifies its own work, and keeps project
context warm via background agents. It is local-first (Ollama) with cloud providers on top.
Think: Claude Desktop's conversation + a code editor + a terminal, fused into one window.

It is **not** a VS Code fork. The UI is bespoke: a custom title bar, frosted-glass panels,
a conversation rail on the left, and an agent chat surface that adapts into four "surfaces".

The **product identity**: calm, focused, dark, glassy, "operator desk for AI workers".
Current brand accent is a **warm coral** (`#d8724e`) in the conversation shell.

---

## 2. The task — what we want you to do

We want to **redesign / polish the UI**. Not rebuild the product — restyle it.

1. **Reconstruct the current layout** as a high-fidelity frame set (match what the code
   renders today). Base it on the source in this folder.
2. **Redesign it**: propose a fresh, coherent visual language — colors, typography scale,
   spacing, glass/panel treatment, component styling — that keeps the product recognizable
   and stays a *desktop agent IDE* (dark theme, high information density, keyboard-first).
3. **Deliver as reusable components** (Figma components/variants) so we can hand the design
   back and implement it in code 1:1.

The whole theme lives in ~20 CSS variables (§8), so any restyle is cheap to implement if
you express your design as **tokens + components**.

### Deliverables we expect back

| # | Deliverable | Detail |
|---|---|---|
| 1 | Design tokens | A complete token set (colors, text styles, radii, spacing, elevation, blur) as Figma variables, mapped 1:1 to the CSS vars we have |
| 2 | Component library | Figma components/variants for every UI element listed in §7 |
| 3 | Frame set | Full-screen frames of the 4 surfaces (§4) at a fixed canvas size (e.g. 1440×900) in dark mode |
| 4 | State variants | At minimum: hover, active/selected, focused input, empty states, loading, error |
| 5 | Notes | Which components changed and why, and which tokens map to which CSS variable |

---

## 3. How the source is organized (read first)

```
figma-export/
├── VIBE_UI_FOR_FIGMA.md   ← this file (everything you need)
└── src/renderer/
    ├── App.tsx            ← root component: composes the entire shell (start here)
    ├── main.tsx           ← React bootstrap
    ├── components/        ← all UI grouped by domain
    ├── hooks/             ← React hooks (filesystem, terminal, ollama)
    ├── services/          ← agent orchestration (renderer-side)
    ├── store/             ← zustand state (what the UI renders from)
    ├── styles/
    │   └── globals.css    ← SINGLE source of all styles + tokens (875 lines)
    └── utils/             ← helpers, tag styles, event buses
```

> Note: the code **cannot run standalone** — this is a static copy for design reference.
> To visualize the true current look, run the real app (`npm run dev`) and screenshot it,
> or ask the repo owner for screenshots of each surface.

---

## 4. The four surfaces (one app, four faces)

The same agent kernel appears as four UI layouts, switched from the left rail's segmented
control (Chat | Cowork | Code | Design):

| Surface | Files | Posture |
|---|---|---|
| **Chat** | `AgentSurface.tsx` | Read-only Q&A, conversation-first, single column |
| **Cowork** | `AgentSurface.tsx` + `cl-workspace` | Autonomous file/shell agent; chat first + docked workspace (tabs, editor, terminal) toggled with `Ctrl+B` |
| **Code** | `EditorTabs` + `RunBar` + `EditorPane` + `TerminalPane` (`.cl-idecenter`) | Terminal-native coding; editor center stage, chat docked right |
| **Design** | `AgentSurface` (`.cl-split__chat--design`) + `DesignCanvas.tsx` | Live HTML/SVG canvas; chat left, preview right |

Every surface shares the same chrome: top bar, left rail, chat panel, model picker,
command palette, settings.

---

## 5. Component inventory (full file map)

### App shell — `App.tsx`
Renders, in order: `LoginScreen` → `DataHomeSetup` (first run) → the main `.cl-app` shell
with `.cl-topbar`, `.cl-body` → `ChatRail` + surface area, then modals
(`Settings`, `ScheduledTasks`, `Projects`, `CommandPalette`, `ModelPicker`, `FolderPicker`).

### agent/ — the agent surfaces
| File | Role |
|---|---|
| `AgentSurface.tsx` | Main agent chat panel: messages, input bar, model picker trigger, permission prompts |
| `ArtifactPane.tsx` | Rendered artifact (HTML/SVG preview) pane |
| `DesignCanvas.tsx` | Design surface — chat left, live preview canvas right |
| `DebatePanel.tsx` | Dual-model debate view |
| `NeuralWidget.tsx` | Background-intelligence / neural activity widget |
| `PermissionPrompt.tsx` | Permission-gated tool approval UI |
| `ToolCallCard.tsx` | Card showing a tool call (fs, bash, web…) and its result |

### ai/ — AI + model UI
| File | Role |
|---|---|
| `ChatMessages.tsx` | Message list rendering (user/assistant bubbles, tool cards) |
| `ModelSelector.tsx` | Full model picker (local, cloud, OfoxAI, OpenRouter, HuggingFace, swarms) |
| `HuggingFacePicker.tsx` | HuggingFace model browser modal |
| `ModelCapabilities.tsx` | Model capability badges (tools/vision) |
| `ThinkBlock.tsx` | Collapsible "thinking" block |
| `ThinkingIndicator.tsx` | "Agent is thinking…" animated indicator |

### claude/ — conversation-first shell (Claude-style)
| File | Role |
|---|---|
| `ChatRail.tsx` | Left rail: new chat, surface switcher, history, model badge |
| `CommandPalette.tsx` | ⌘K palette |
| `Markdown.tsx` | Markdown renderer for assistant output |
| `Modal.tsx` | Modal overlay primitives (`Overlay`) |
| `ModelPicker.tsx` | Select-model modal (Local / Ollama Cloud / OpenRouter / HF / OmniRoute / OfoxAI) |
| `Projects.tsx` | Project list/switch modal |
| `ScheduledTasks.tsx` | Scheduled background tasks modal |
| `Settings.tsx` | Settings modal (API keys, providers, MCP, skills) |

### common/ — building blocks
| File | Role |
|---|---|
| `GlassPanel.tsx` | Frosted-glass panel primitive (variants: default/strong) |
| `ErrorBoundary.tsx` | Error boundary |
| `FolderPicker.tsx` | Native folder picker prompt |

### editor/ — code editing
| File | Role |
|---|---|
| `EditorTabs.tsx` | Open-file tab strip |
| `EditorPane.tsx` | Wraps Monaco + status bar |
| `MonacoEditor.tsx` | Monaco editor instance |
| `RunBar.tsx` | Run/debug command bar above editor |

### filetree/ — explorer
| File | Role |
|---|---|
| `FileTree.tsx` | File tree root |
| `FileTreeItem.tsx` | Single tree row (icon, name, expand chevron) |

### layout/ — chrome
| File | Role |
|---|---|
| `TitleBar.tsx`, `MenuBar.tsx`, `Sidebar.tsx`, `MainArea.tsx` | Legacy chrome (no longer mounted from `App.tsx`) |
| `AgentManager.tsx` | Swarm/agent creation panel |
| `SettingsModal.tsx` | Legacy settings modal variant |
| `DataHomeSetup.tsx` | First-run data folder setup screen |

> The **live** chrome lives in `App.tsx`, `ChatRail.tsx`, and the `claude/` + `agent/` groups.

### terminal/ — shell
| File | Role |
|---|---|
| `TerminalPane.tsx` | Terminal (xterm) pane |

### store/ — zustand state (drives what the UI renders)
| Store | Purpose |
|---|---|
| `ui.ts` | layout mode, modals, project path, workspace open, debate mode, login |
| `agentRun.ts` | current agent run state, surface, messages |
| `ollama.ts` | model list, selected model, connection state |
| `settings.ts` | API keys per provider (ollama, openrouter, hf, gemini, claude, openai, deepseek, groq, ofox, ofoxBase, omni, omniBase) |
| `debate.ts`, `editor.ts`, `folderPicker.ts`, `huggingface.ts`, `swarms.ts`, `terminal.ts`, `usage.ts` | respective UI state |

### styles/globals.css — the single source of visual truth
- Lines 9–67: **design tokens** (colors, glass, radii, layout sizes)
- Lines 559–575: **Claude-shell tokens** (`--cl-*`) — the live app runs on this theme today
- Rest: all component class styles (`.cl-*`, `.chat-*`, `.cl-mp-*`, …)

---

## 6. Current layout anatomy (what the frames must contain)

From `App.tsx` (the live composition):

```
┌──────────────────────────────────────────────────────────────┐
│ .cl-topbar  44px  (draggable)                                 │
│ VIBE  │  <project name>      │ ⌘K ⚖️ IDE Workspace _ □ ✕     │
├──────────────┬───────────────────────────────────────────────┤
│ .cl-rail     │  surface area (one of the 4 layouts):          │
│  268px       │  chat column  OR  editor+terminal  OR canvas   │
│  New chat    │                                               │
│  [Chat|Cowork │                                               │
│   Code|Design]│  .cl-split / .cl-idecenter / .cl-workspace   │
│  History     │                                               │
│  Model badge │                                               │
└──────────────┴───────────────────────────────────────────────┘
```

### The chat panel (`.cl-split__chat`, hosts `AgentSurface`)
- Header: project/model info
- Scrollable messages (`.chat-bubble--user` right/aligned accent, `--assistant` left)
- Tool-call cards (file edits, bash runs, web fetches)
- Thinking blocks, permission prompts
- Bottom composer: input + send + model picker trigger

### Layout mode toggle (top bar "IDE" button)
- `layoutMode === 'ide'` → code-first: editor center, chat docked right (`.cl-idecenter`)
- else → chat-first: chat fills center; `Ctrl+B` toggles the docked workspace (`.cl-workspace`)

---

## 7. Components to design (build each as a Figma component)

Reuse shared primitives (`GlassPanel`, `Modal/Overlay`, buttons, inputs, tag pills) as
nested instances.

**Chrome**
- Custom title bar (brand, project title, window controls)
- Left rail: "New chat" button, segmented surface switcher, history list, footer (model + settings)
- Command palette (⌘K) modal
- Settings modal (sections: providers/API keys, MCP servers, skills, models)
- Model picker modal (groups: Local, Ollama Cloud, OpenRouter, HuggingFace, OmniRoute, OfoxAI)
- Projects modal, Scheduled Tasks modal, Folder picker dialog

**Chat / agent surface**
- User + assistant message bubbles (markdown-rendered)
- Tool-call card (icon, tool name, args, result/status) — `ToolCallCard.tsx`
- Thinking block (collapsible) — `ThinkBlock.tsx`
- "Agent is thinking" indicator — `ThinkingIndicator.tsx`
- Permission prompt (approve/deny) — `PermissionPrompt.tsx`
- Composer bar (multiline input, send, model trigger, mode hint)
- Debate panel (two-column model comparison)

**Editor / code surface**
- Editor tab strip (file tabs, dirty dot, close)
- Run bar (run/debug controls)
- Editor status bar / breadcrumbs
- Terminal pane (tabs + xterm output)

**File tree / workspace**
- Tree rows (folder/file icons, indent guides, expand chevron)
- Empty states (no project, no models, no API keys)

**Misc**
- Tag pills (LOCAL / CLOUD / OR / HF / OMNI / OFOX / SWARM, capability badges)
- Glass panels (default + strong variants)
- Buttons (primary/secondary/ghost), inputs, selects, checkboxes, scrollbars

---

## 8. Design tokens (current — extracted verbatim from `globals.css`)

> If you redefine the token values in Figma, that is the **entire theme** — every component
> reads from these variables. Nothing else needs to change.

### 8.1 Base theme `:root` (lines 9–67)

**Background** (`.bg-mesh` — layered gradient behind everything):
```
radial-gradient(ellipse at 20% 0%,   rgba(61,139,255,0.05) 0%, transparent 55%),
radial-gradient(ellipse at 80% 100%, rgba(216,114,78,0.04) 0%, transparent 55%),
linear-gradient(180deg, #15151d 0%, #101017 100%)
```
Flat dark, blue tint top-left, faint coral bottom-right.

**Glass — strong** (title bar, chat bar):

| Token | Value |
|---|---|
| `--glass-bg` | `rgba(26,26,34,0.74)` |
| `--glass-blur` | `blur(24px)` |
| `--glass-border` | `1px solid rgba(255,255,255,0.08)` |
| `--glass-shadow` | `0 1px 3px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.4)` |

**Glass — panel** (sidebar, editor, terminal, right pane):

| Token | Value |
|---|---|
| `--panel-bg` | `rgba(24,24,31,0.6)` |
| `--panel-blur` | `blur(16px)` |
| `--panel-border` | `1px solid rgba(255,255,255,0.07)` |
| `--panel-shadow` | `0 2px 12px rgba(0,0,0,0.32)` |

**Text:**

| Token | Value |
|---|---|
| `--text` | `#e7e7f0` |
| `--text-secondary` | `#9a9aab` |
| `--text-muted` | `#6f6f80` |
| `--text-faint` | `#55556a` |

**Accent (blue — used in IDE-side components):**

| Token | Value |
|---|---|
| `--accent` | `#3d8bff` |
| `--accent-gradient` | `linear-gradient(135deg, #2a6cff, #3d8bff, #4aa8ff)` |
| `--accent-light` | `rgba(61,139,255,0.10)` |
| `--accent-medium` | `rgba(61,139,255,0.18)` |

**Semantic:**

| Token | Value | Meaning |
|---|---|---|
| `--green` / `--green-light` | `#35c88f` / `rgba(53,200,143,0.12)` | success / running / verified |
| `--warn` / `--warn-light` | `#e6a33a` / `rgba(230,163,58,0.12)` | warning |
| `--error` | `#e0506a` | error / stop |

**Borders:** `--border` `rgba(255,255,255,0.09)` · `--border-light` `rgba(255,255,255,0.05)`

**Typography:**
| Token | Value |
|---|---|
| `--font-sans` | `'DM Sans', 'SF Pro Display', system-ui, -apple-system, sans-serif` |
| `--font-mono` | `'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace` |

**Radii:** `--radius-sm` 6px · `--radius-md` 10px · `--radius-lg` 14px

**Layout:**
| Token | Value |
|---|---|
| `--gap` | `6px` |
| `--sidebar-width` | `210px` |
| `--right-pane-width` | `340px` |
| `--terminal-height` | `140px` |
| `--titlebar-height` | `44px` |
| `--chatbar-height` | `56px` |

**Scrollbar (global):** 5px, transparent track, thumb `rgba(255,255,255,0.14)` radius 3px (hover 0.24)

**Animations:** `fadeIn`, `fadeUp` (8px rise), `pulse`, `blink`, `spin` — ~0.2–0.3s ease-out

### 8.2 Claude-shell theme `:root` (lines 559–575)

> This overrides the whole app with a warm, calm, conversation-first look. **The live app
> runs on this theme today** (class prefix `.cl-`).

| Token | Value |
|---|---|
| `--cl-bg` | `#121218` (dark operator background) |
| `--cl-surface` | `#1b1b23` (panels / composer) |
| `--cl-surface-2` | `#23232d` (raised) |
| `--cl-rail` | `#17171e` (left rail) |
| `--cl-text` | `#e7e7f0` |
| `--cl-text-2` | `#9a9aab` |
| `--cl-muted` | `#6f6f80` |
| `--cl-accent` | `#d8724e` (coral — the brand color of the shell) |
| `--cl-accent-hover` | `#e28560` |
| `--cl-user-bubble` | `#262631` |
| `--cl-border` | `rgba(255,255,255,0.10)` |
| `--cl-border-soft` | `rgba(255,255,255,0.055)` |
| `--cl-code-bg` | `#0d0d13` |
| `--cl-font` | `ui-sans-serif, -apple-system, 'Segoe UI', 'DM Sans', system-ui, sans-serif` |
| `--cl-mono` | `'JetBrains Mono', ui-monospace, 'SF Mono', monospace` |

### 8.3 Key class conventions (use as anchors in Figma)
| Pattern | Meaning |
|---|---|
| `.cl-app` / `.cl-body` | root shell + body flex row |
| `.cl-topbar` | 44px custom title bar |
| `.cl-rail` / `.cl-rail--collapsed` | 268px left rail |
| `.cl-split` / `.cl-split__chat` / `.cl-idecenter` | layout mode containers |
| `.cl-workspace` | docked editor+terminal panel |
| `.chat-bubble--user / --assistant` | chat bubbles |
| `.cl-mp__*` | model picker modal |
| `.cl-seg__btn--active` | segmented surface switcher |
| `.cl-modal`, `.cl-modal__head`, `.cl-x` | modal chrome |

---

## 9. Design constraints — please respect

1. **Dark theme only** (no light mode exists).
2. **High information density** — this is a pro tool; don't go oversized/airy.
3. **Keep it an agent IDE** — the conversation is the center of gravity; editor/terminal are
   contextual tools. Don't demote the chat.
4. **Keyboard-first** — small-footprint controls, visible focus states.
5. **Glass/frosted panels** are part of the identity — evolve them, don't remove them entirely.
6. **Do not rename or remove functionality** — this is a restyle, not a product change.
7. Implementable: prefer **CSS-variable-level changes** and component restyles that map
   cleanly onto the existing class names (`.cl-*`, `.chat-*`). Avoid new layout paradigms
   that would require restructuring React trees.
8. Canvas: design at **1440×900**, device scale 1×, desktop app frame (with our custom title
   bar, not an OS frame).

---

## 10. Handoff format we'll implement from

When you finish, hand back:
- **Figma file link** + a short written summary of the new visual language
- Every token named so it maps to our CSS var (e.g. `cl-bg` → Figma color variable)
- Every component named after its file (e.g. `ChatRail`, `AgentSurface`, `ModelPicker`)
- Frame names matching the 4 surfaces (`Surface Chat`, `Surface Cowork`, `Surface Code`,
  `Surface Design`) plus any modals you redesigned

The implementer (an AI coding agent) will translate your Figma into updated `globals.css`
+ `.tsx` files. Name things predictably so that mapping is unambiguous.

---

## 11. Current-brand quick reference

| Element | Current value |
|---|---|
| Shell background | `#121218` (`--cl-bg`) |
| Surface / panels | `#1b1b23`, raised `#23232d` |
| Rail | `#17171e` |
| Accent (brand) | `#d8724e` coral |
| Primary text | `#e7e7f0`, secondary `#9a9aab`, muted `#6f6f80` |
| Sans font | DM Sans / Inter-like humanist sans |
| Mono font | JetBrains Mono |
| Radii | 6 / 10 / 14 px |
| Border | white @ 10% / 5.5% alpha |
| Success / warn / error | `#35c88f` / `#e6a33a` / `#e0506a` |

---

## 12. Summary of the ask, in one line

> Recreate VIBE IDE's current UI in Figma from this source, then redesign it into a
> coherent, tokenized, component-based dark theme we can implement 1:1 back into the app —
> keeping every feature and the four surfaces intact.

# FULL UI SOURCE CODE

> Every source file referenced above, in full, in dependency-independent order.
> `globals.css` is the visual truth. All other files are the component markup.

## `src/renderer/App.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { useOllamaStore } from './store/ollama';
import { useUIStore } from './store/ui';
import { useSettingsStore } from './store/settings';
import { LoginScreen } from './components/auth/LoginScreen';
import { useBackgroundTerminal } from './hooks/useBackgroundTerminal';
import { ChatRail } from './components/claude/ChatRail';
import { AgentSurface } from './components/agent/AgentSurface';
import { DesignCanvas } from './components/agent/DesignCanvas';
import { EditorTabs } from './components/editor/EditorTabs';
import { EditorPane } from './components/editor/EditorPane';
import { RunBar } from './components/editor/RunBar';
import { TerminalPane } from './components/terminal/TerminalPane';
import { useAgentRunStore } from './store/agentRun';
import { Settings } from './components/claude/Settings';
import { ScheduledTasks } from './components/claude/ScheduledTasks';
import { Projects } from './components/claude/Projects';
import { CommandPalette } from './components/claude/CommandPalette';
import { ModelPicker } from './components/claude/ModelPicker';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { FolderPicker } from './components/common/FolderPicker';
import { DataHomeSetup } from './components/layout/DataHomeSetup';
import DebatePanel from './components/agent/DebatePanel';
import { useDebateStore } from './store/debate';
import { uiBus } from './utils/uiBus';
import { newChatInCurrentProject } from './services/agentClient';

type Modal =
    | { kind: 'settings'; section?: string }
    | { kind: 'schedule' } | { kind: 'projects' } | { kind: 'palette' } | { kind: 'model' } | null;

export default function App() {
    const setConnectionState = useOllamaStore((s) => s.setConnectionState);
    const setModels = useOllamaStore((s) => s.setModels);
    const setOllamaConnected = useUIStore((s) => s.setOllamaConnected);
    const isLoggedIn = useUIStore((s) => s.isLoggedIn);
    const setIsLoggedIn = useUIStore((s) => s.setIsLoggedIn);
    const projectPath = useUIStore((s) => s.projectPath);
    const setVibeInstructions = useUIStore((s) => s.setVibeInstructions);
    const layoutMode = useUIStore((s) => s.layoutMode);
    const setLayoutMode = useUIStore((s) => s.setLayoutMode);
    const surface = useAgentRunStore((s) => s.surface);
    const workspaceOpen = useUIStore((s) => s.workspaceOpen);
    const setWorkspaceOpen = useUIStore((s) => s.setWorkspaceOpen);
    const toggleWorkspaceOpen = useUIStore((s) => s.toggleWorkspaceOpen);
    const debateMode = useUIStore((s) => s.debateMode);
    const toggleDebateMode = useUIStore((s) => s.toggleDebateMode);

    const [isMax, setIsMax] = useState(false);
    const [modal, setModal] = useState<Modal>(null);
    // First-run: ask where to keep projects & engagements (once per machine).
    const [firstRun, setFirstRun] = useState(false);
    useEffect(() => { window.vibe.dataHome?.isFirstRun?.().then(setFirstRun).catch(() => {}); }, []);
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    useBackgroundTerminal();

    useEffect(() => {
        const check = async () => {
            try {
                const { detected, version } = await window.vibe.detectOllama();
                setConnectionState(detected, version ?? null); setOllamaConnected(detected);
                if (detected) setModels(await window.vibe.listModels());
                const okey = (useSettingsStore.getState().apiKeys as any).ollama;
                if (okey) window.vibe.kernel.cloudModels(okey).then((c) => useOllamaStore.getState().setCloudModelNames(c.map((m) => m.name))).catch(() => {});
            } catch { setConnectionState(false, null); setOllamaConnected(false); }
        };
        check(); const t = setInterval(check, 30000); return () => clearInterval(t);
    }, [setConnectionState, setModels, setOllamaConnected]);

    useEffect(() => { if (window.vibe?.onWindowMaximized) window.vibe.onWindowMaximized((m: boolean) => setIsMax(m)); }, []);

    useEffect(() => {
        if (projectPath) window.vibe.readFile(`${projectPath}/VIBE.md`).then(setVibeInstructions).catch(() => setVibeInstructions(null));
        else setVibeInstructions(null);
    }, [projectPath]);

    // UI event bus → modals
    useEffect(() => uiBus.on((e) => {
        if (e.t === 'openSettings') setModal({ kind: 'settings', section: e.section });
        else if (e.t === 'openSchedule') setModal({ kind: 'schedule' });
        else if (e.t === 'openProjects') setModal({ kind: 'projects' });
        else if (e.t === 'openPalette') setModal({ kind: 'palette' });
        else if (e.t === 'openModel') setModal({ kind: 'model' });
        else if (e.t === 'toggleWorkspace') useUIStore.getState().toggleWorkspaceOpen();
        else if (e.t === 'newChat') newChatInCurrentProject();
    }), []);

    // keyboard shortcuts
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const mod = e.metaKey || e.ctrlKey;
            if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setModal({ kind: 'palette' }); }
            else if (mod && e.key.toLowerCase() === 'n') { e.preventDefault(); newChatInCurrentProject(); }
            else if (mod && e.key === ',') { e.preventDefault(); setModal({ kind: 'settings' }); }
            else if (mod && e.key.toLowerCase() === 'b') { e.preventDefault(); useUIStore.getState().toggleWorkspaceOpen(); }
            else if (e.key === 'Escape') { setModal(null); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);

    if (!isLoggedIn) return <LoginScreen onLogin={() => setIsLoggedIn(true)} />;
    if (firstRun) return <DataHomeSetup onDone={() => setFirstRun(false)} />;

    const projectName = projectPath ? projectPath.split(/[/\\]/).pop() : 'VIBE';
    const close = () => setModal(null);

    return (
        <div className="cl-app">
            <div className="cl-topbar titlebar-drag">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: isMac ? 68 : 0 }}>
                    <span
                        className="cl-topbar__brand"
                        style={{ userSelect: 'none' }}
                    >VIBE</span>
                </div>
                <span className="cl-topbar__title">{projectName}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button data-clickable className="cl-winbtn" onClick={() => uiBus.emit({ t: 'openPalette' })} title="Command palette (Ctrl K)" style={{ width: 'auto', padding: '0 8px', fontSize: 13 }}>⌘K</button>
                    {surface !== 'design' && (
                        <button data-clickable className="cl-winbtn" onClick={() => toggleDebateMode()}
                            title="Toggle dual-model debate mode"
                            style={{ width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600, color: debateMode ? 'var(--cl-accent)' : 'var(--cl-text-2)' }}>⚖️</button>
                    )}
                    {surface !== 'design' && (
                        <button data-clickable className="cl-winbtn" onClick={() => setLayoutMode(layoutMode === 'ide' ? 'chat' : 'ide')}
                            title={layoutMode === 'ide' ? 'Back to chat-first layout' : 'Code-first layout: editor center, chat docked right'}
                            style={{ width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600, color: layoutMode === 'ide' ? 'var(--cl-accent)' : 'var(--cl-text-2)' }}>IDE</button>
                    )}
                    {surface !== 'design' && layoutMode !== 'ide' && (
                        <button data-clickable className="cl-winbtn" onClick={() => toggleWorkspaceOpen()} title="Toggle editor & terminal (Ctrl B)" style={{ width: 'auto', padding: '0 10px', fontSize: 12, fontWeight: 600, color: workspaceOpen ? 'var(--cl-accent)' : 'var(--cl-text-2)' }}>Workspace</button>
                    )}
                    {!isMac && (
                        <>
                            <button data-clickable className="cl-winbtn" onClick={() => window.vibe.minimizeWindow()}>_</button>
                            <button data-clickable className="cl-winbtn" onClick={() => window.vibe.maximizeWindow()}>{isMax ? '❐' : '□'}</button>
                            <button data-clickable className="cl-winbtn" onClick={() => window.vibe.closeWindow()} style={{ color: '#c0392b' }}>✕</button>
                        </>
                    )}
                </div>
            </div>

            <div className="cl-body">
                <ErrorBoundary label="Workbench">
                <ChatRail />
                {surface === 'design' ? (
                    /* Design: chat left, live canvas center-right. */
                    <div className="cl-split">
                        <div className="cl-split__chat cl-split__chat--design"><AgentSurface /></div>
                        <DesignCanvas />
                    </div>
                ) : layoutMode === 'ide' ? (
                    /* Code-first: editor + terminal center stage, chat docked right.
                       The editor follows whatever file the agent touches. */
                    <div className="cl-split">
                        <div className="cl-idecenter">
                            <EditorTabs />
                            <RunBar />
                            <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}><EditorPane /></div>
                            <div style={{ height: 220, borderTop: '1px solid var(--cl-border-soft)', overflow: 'hidden', flexShrink: 0 }}><TerminalPane /></div>
                        </div>
                        <div className="cl-split__chat cl-split__chat--dock"><AgentSurface /></div>
                    </div>
                ) : (
                    <>
                        {debateMode ? <DebatePanel /> : <AgentSurface />}
                        {workspaceOpen && (
                            <div className="cl-workspace">
                                <div className="cl-ws__head"><span>Workspace</span><button className="cl-winbtn" style={{ width: 22, height: 22 }} onClick={() => setWorkspaceOpen(false)}>✕</button></div>
                                <EditorTabs />
                                <div style={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}><EditorPane /></div>
                                <div style={{ height: 200, borderTop: '1px solid var(--cl-border-soft)', overflow: 'hidden' }}><TerminalPane /></div>
                            </div>
                        )}
                    </>
                )}
                </ErrorBoundary>
            </div>

            {modal?.kind === 'settings' && <Settings onClose={close} initialSection={modal.section as any} />}
            {modal?.kind === 'schedule' && <ScheduledTasks onClose={close} />}
            {modal?.kind === 'projects' && <Projects onClose={close} />}
            {modal?.kind === 'palette' && <CommandPalette onClose={close} />}
            {modal?.kind === 'model' && <ModelPicker onClose={close} />}
            <FolderPicker />
        </div>
    );
}
```

## `src/renderer/components/agent/AgentSurface.tsx`

```tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { FileEntry } from '../../../shared/types';
import { useAgentRunStore } from '../../store/agentRun';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';
import { useSettingsStore } from '../../store/settings';
import { useDebateStore } from '../../store/debate';
import { ModelPicker } from '../claude/ModelPicker';
import { ToolCallCard } from './ToolCallCard';
import { PermissionPrompt } from './PermissionPrompt';
import { ArtifactBadges } from './ArtifactPane';
import { Markdown, extractThink } from '../claude/Markdown';
import { Overlay } from '../claude/Modal';
import { initAgentClient, runTurn, cancelRun, regenerate, editLast, approveAllPending, answerQuestion } from '../../services/agentClient';
import { SLASH_COMMANDS, type SlashCtx } from '../../utils/slashCommands';
import { useUsageStore, fmtTokens } from '../../store/usage';
import type { RunItem } from '../../store/agentRun';

const GREETING: Record<string, { title: string; sub: string }> = {
    chat: { title: 'How can I help?', sub: 'Ask anything. I can search the web and read your open project.' },
    cowork: { title: "Let's get to work.", sub: 'I can read, write, and edit files and run commands in your project.' },
    code: { title: 'What are we building?', sub: 'Terminal-native coding with full file and shell access.' },
    design: { title: 'What should we design?', sub: 'Describe it - the canvas renders every revision live as I work.' },
};

export function AgentSurface() {
    const surface = useAgentRunStore((s) => s.surface);
    const items = useAgentRunStore((s) => s.items);
    const selectedModel = useOllamaStore((s) => s.selectedModel);
    useEffect(() => { initAgentClient(); }, []);
    useEffect(() => { useAgentRunStore.getState().setModel(selectedModel); }, [selectedModel]);
    const empty = items.length === 0;
    const g = GREETING[surface] || GREETING.chat;

    return (
        <div className="cl-main">
            {empty ? (
                <div className="cl-stream"><div className="cl-col--center">
                    <div><div className="cl-greeting">{g.title}</div><div className="cl-greeting__sub">{g.sub}</div></div>
                    <Composer centered />
                </div></div>
            ) : (
                <><Stream /><div className="cl-composer-wrap"><div className="cl-composer-stack"><QuestionPanel /><Composer /></div></div></>
            )}
        </div>
    );
}

/** ask_user answers UI - a card that rises directly above the chat bar while
    the agent waits. Styled to match how questions are posed elsewhere:
    per-question sections, selectable option rows, radio vs checkbox affordance. */
function QuestionPanel() {
    const items = useAgentRunStore((s) => s.items);
    const pendingQ = [...items].reverse().find((i) => i.kind === 'question' && !(i as any).answers && !(i as any).dismissed) as
        Extract<RunItem, { kind: 'question' }> | undefined;
    const [sel, setSel] = useState<Record<string, string[]>>({});
    useEffect(() => { setSel({}); }, [pendingQ?.id]);
    if (!pendingQ) return null;

    const qs = pendingQ.req.questions;
    const instant = qs.length === 1 && !qs[0].multi; // single choice -> answer on click
    const toggle = (q: string, opt: string, multi: boolean) => setSel((s) => {
        const cur = s[q] || [];
        return { ...s, [q]: multi ? (cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]) : [opt] };
    });
    const canSubmit = qs.every((q) => (sel[q.question] || []).length > 0);

    return (
        <div className="cl-qpanel">
            <div className="cl-qpanel__head">
                <span>{instant ? 'A quick question' : qs.length > 1 ? `${qs.length} questions` : 'A quick question'}</span>
                <button className="cl-qpanel__x" title="Skip / dismiss" onClick={() => answerQuestion(pendingQ.id, {})}>×</button>
            </div>
            {qs.map((q) => (
                <div key={q.question} className="cl-qsec">
                    <div className="cl-qsec__q">{q.question}</div>
                    {q.multi && <div className="cl-qsec__hint">select all that apply</div>}
                    <div className="cl-qopts">
                        {q.options.map((o) => {
                            const on = (sel[q.question] || []).includes(o.label);
                            return (
                                <button key={o.label}
                                    className={`cl-qopt ${on ? 'cl-qopt--on' : ''}`}
                                    onClick={() => instant
                                        ? answerQuestion(pendingQ.id, { [q.question]: [o.label] })
                                        : toggle(q.question, o.label, !!q.multi)}>
                                    <span className={`cl-qopt__mark ${q.multi ? 'cl-qopt__mark--multi' : ''}`}>{on ? '✓' : ''}</span>
                                    <span className="cl-qopt__label">{o.label}</span>
                                    {o.description && <span className="cl-qopt__desc">{o.description}</span>}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
            {!instant && (
                <div className="cl-qpanel__row">
                    <button className="cl-qsubmit" disabled={!canSubmit} onClick={() => answerQuestion(pendingQ.id, sel)}>Submit</button>
                </div>
            )}
        </div>
    );
}

/** Inline dual-model debate transcript, rendered at the tail of the chat stream
    while a debate started from the composer runs (or after it finishes). Reads
    the debate store directly; the composer drives start/interject/cancel. */
/** Debaters can be reasoning models that emit <think> inline in their text
    (when the provider doesn't split it into a channel). Hide the reasoning and
    strip any stray tags so the debate view shows only the real answer. */
function debateVisible(text: string): string {
    return extractThink(text).visible.replace(/<\/?think>/gi, '').trim();
}

function DebateBlock() {
    const rounds = useDebateStore((s) => s.rounds);
    const synthesis = useDebateStore((s) => s.synthesis);
    const synthesizing = useDebateStore((s) => s.synthesizing);
    const running = useDebateStore((s) => s.running);
    const error = useDebateStore((s) => s.error);
    const modelA = useDebateStore((s) => s.modelA);
    const modelB = useDebateStore((s) => s.modelB);
    if (!running && rounds.length === 0 && !synthesis && !error) return null;

    const col = (who: string, color: string, text: string, live: boolean) => {
        const shown = debateVisible(text);
        return (
        <div style={{ flex: 1, minWidth: 0, border: '1px solid var(--cl-border, #2a2a2a)', borderRadius: 8, padding: '8px 10px' }}>
            <div style={{ color, fontWeight: 600, fontSize: 11, marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{who}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                {shown ? <Markdown text={shown} /> : <span style={{ color: 'var(--cl-muted, #888)' }}>{text ? 'thinking…' : 'waiting…'}</span>}
                {live && <span className="cl-cursor" />}
            </div>
        </div>
        );
    };

    return (
        <div className="cl-msg cl-msg--assistant cl-msg__wrap">
            <div className="cl-msg__body">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--cl-muted, #888)', marginBottom: 6 }}>
                    <span>⚖ Debate</span>
                    <span style={{ color: '#4fc3f7' }}>{modelA || 'Model A'}</span>
                    <span>vs</span>
                    <span style={{ color: '#ffb74d' }}>{modelB || 'Model B'}</span>
                </div>
                {rounds.map((r) => (
                    <div key={r.round} style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--cl-muted, #888)', marginBottom: 4 }}>
                            Round {r.round}{!r.complete && running ? ' · streaming…' : ''}
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            {col(modelA || 'Model A', '#4fc3f7', r.textA, !r.complete && running && !r.textB)}
                            {col(modelB || 'Model B', '#ffb74d', r.textB, !r.complete && running && !!r.textA && !r.textB)}
                        </div>
                    </div>
                ))}
                {synthesizing && <div className="cl-status">⚖ Synthesizing a verdict…</div>}
                {synthesis && (
                    <div style={{ marginTop: 8, borderTop: '1px solid var(--cl-border, #2a2a2a)', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--cl-muted, #888)', marginBottom: 4 }}>⚖ Synthesis</div>
                        <Markdown text={debateVisible(synthesis)} />
                    </div>
                )}
                {error && <div className="cl-errline" style={{ marginTop: 6 }}>{error}</div>}
            </div>
        </div>
    );
}

function Stream() {
    const items = useAgentRunStore((s) => s.items);
    const running = useAgentRunStore((s) => s.running);
    const ref = useRef<HTMLDivElement>(null);
    // Claude-desktop scroll behavior: follow the stream only while the user is
    // already at the bottom; never yank them back down while they read history.
    const pinnedRef = useRef(true);
    const [pinned, setPinned] = useState(true);
    const onScroll = () => {
        const el = ref.current;
        if (!el) return;
        const p = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        pinnedRef.current = p;
        setPinned(p);
    };
    useEffect(() => { if (pinnedRef.current && ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [items, running]);
    const jump = () => {
        const el = ref.current;
        if (el) el.scrollTop = el.scrollHeight;
        pinnedRef.current = true;
        setPinned(true);
    };
    const lastAssistant = [...items].reverse().find((x) => x.kind === 'assistant');
    const lastUser = [...items].reverse().find((x) => x.kind === 'user');
    const lastItem = items[items.length - 1];
    const copy = (t: string) => navigator.clipboard?.writeText(t);
    const [lightbox, setLightbox] = useState<string | null>(null);

    return (
        <>
        <div className="cl-stream" ref={ref} onScroll={onScroll}><div className="cl-col">
            {items.map((it) => {
                switch (it.kind) {
                    case 'user':
                        return (
                            <div key={it.id} className="cl-msg cl-msg--user cl-msg__wrap">
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                    {it.images && it.images.length > 0 && (
                                        <div className="cl-msg-imgs">{it.images.map((im, k) => { const src = `data:${im.mimeType};base64,${im.dataBase64}`; return <img key={k} className="cl-thumb" src={src} onClick={() => setLightbox(src)} />; })}</div>
                                    )}
                                    {it.text && <div className="cl-msg__body">{it.text}</div>}
                                    <div className="cl-acts">
                                        <button className="cl-act" onClick={() => copy(it.text)}>Copy</button>
                                        {!running && it.id === lastUser?.id && <button className="cl-act" onClick={async () => useAgentRunStore.getState().setComposerDraft(await editLast())}>Edit</button>}
                                    </div>
                                </div>
                            </div>
                        );
                    case 'assistant':
                        return (
                            <div key={it.id} className="cl-msg cl-msg--assistant cl-msg__wrap">
                                {(() => {
                                    const { thinking, visible } = extractThink(it.text);
                                    return (
                                        <div className="cl-msg__body">
                                            {thinking && (
                                                <details className="cl-status" style={{ margin: '0 0 8px' }}>
                                                    <summary style={{ cursor: 'pointer' }}>Thought process</summary>
                                                    <div style={{ whiteSpace: 'pre-wrap', padding: '6px 0', fontStyle: 'italic' }}>{thinking}</div>
                                                </details>
                                            )}
                                            <Markdown text={visible} />
                                            {running && lastItem?.id === it.id && <span className="cl-cursor" />}
                                            <ArtifactBadges text={visible} />
                                        </div>
                                    );
                                })()}
                                <div className="cl-acts">
                                    {it.model && <span className="cl-modelbadge">{it.model}</span>}
                                    <button className="cl-act" onClick={() => copy(it.text)}>Copy</button>
                                    {!running && it.id === lastAssistant?.id && <button className="cl-act" onClick={regenerate}>Regenerate</button>}
                                </div>
                            </div>
                        );
                    case 'thinking':
                        return <details key={it.id} className="cl-status" style={{ margin: '8px 0' }}><summary style={{ cursor: 'pointer' }}>Thought process</summary><div style={{ whiteSpace: 'pre-wrap', padding: '6px 0', fontStyle: 'italic' }}>{it.text}</div></details>;
                    case 'tool': return <ToolCallCard key={it.id} item={it} />;
                    case 'permission': return <PermissionPrompt key={it.id} req={it.req} resolved={it.resolved} />;
                    case 'question': {
                        const picks = it.answers ? Object.values(it.answers).flat() : [];
                        return (
                            <div key={it.id} className="cl-status">
                                {it.answers
                                    ? (picks.length ? `Answered: ${picks.join(', ')}` : 'Skipped')
                                    : (it as any).dismissed
                                        ? 'Question dismissed (run stopped)'
                                        : 'Waiting for your selection below…'}
                            </div>
                        );
                    }
                    case 'status': return <div key={it.id} className="cl-status">{it.text}</div>;
                    case 'error': return <div key={it.id} className="cl-errline">{it.text}</div>;
                    default: return null;
                }
            })}
            <DebateBlock />
            {running && lastItem && lastItem.kind !== 'assistant' && (
                <div className="cl-typing"><span /><span /><span /></div>
            )}
        </div>
        {!pinned && (
            <div className="cl-jumpwrap"><button className="cl-jump" onClick={jump} title="Jump to latest">↓</button></div>
        )}
        </div>
        {lightbox && <Overlay onClose={() => setLightbox(null)}><img className="cl-lightbox-img" src={lightbox} onClick={() => setLightbox(null)} /></Overlay>}
        </>
    );
}

async function listProjectFiles(root: string): Promise<{ rel: string; path: string }[]> {
    const out: { rel: string; path: string }[] = [];
    const walk = async (dir: string, depth: number) => {
        if (depth > 2 || out.length > 400) return;
        const entries: FileEntry[] = await window.vibe.readDir(dir).catch(() => []);
        for (const e of entries) {
            if (out.length > 400) return;
            if (e.isDirectory) await walk(e.path, depth + 1);
            else out.push({ rel: e.path.replace(root, '').replace(/^[/\\]/, ''), path: e.path });
        }
    };
    await walk(root, 0);
    return out;
}

/** Token telemetry: this conversation inline, lifetime in the tooltip. */
function UsageChip() {
    const usage = useAgentRunStore((s) => s.usage);
    const totalInput = useUsageStore((s) => s.totalInput);
    const totalOutput = useUsageStore((s) => s.totalOutput);
    const runs = useUsageStore((s) => s.runs);
    if (usage.inputTokens === 0 && usage.outputTokens === 0) return null;
    return (
        <span className="cl-usagechip"
            title={`This conversation. Lifetime: ${fmtTokens(totalInput)}↑ ${fmtTokens(totalOutput)}↓ across ${runs} runs`}>
            {fmtTokens(usage.inputTokens)}↑ {fmtTokens(usage.outputTokens)}↓
        </span>
    );
}

/** Build <-> Plan. Build executes end-to-end with no "shall I proceed?" turns;
    Plan is a read-only run that ends with a plan awaiting approval. */
function AgentModeChip() {
    const mode = useSettingsStore((s) => s.agentMode);
    const toggle = () => useSettingsStore.getState().setAgentMode(mode === 'plan' ? 'build' : 'plan');
    return (
        <button
            className={`cl-modelchip ${mode === 'plan' ? 'cl-modelchip--plan' : ''}`}
            onClick={toggle}
            title={mode === 'plan'
                ? 'Plan mode: read-only. The agent researches, proposes a numbered plan, and waits for your approval. Click for Build.'
                : 'Build mode: the agent executes end-to-end and never stops to ask "should I proceed?". Click for Plan.'}
        >
            {mode === 'plan' ? 'Plan' : 'Build'}
        </button>
    );
}

/** Toggle beside the model chip: Ask first <-> Allow all (auto-approve). */
function PermissionModeChip() {
    const mode = useSettingsStore((s) => s.permissionMode);
    const toggle = () => {
        const next = mode === 'auto' ? 'ask' : 'auto';
        useSettingsStore.getState().setPermissionMode(next);
        if (next === 'auto') approveAllPending(); // unblock anything already waiting
    };
    return (
        <button
            className={`cl-modelchip ${mode === 'auto' ? 'cl-modelchip--auto' : ''}`}
            onClick={toggle}
            title={mode === 'auto'
                ? 'All tool calls run without asking. Click to require approval.'
                : 'Risky tool calls ask for approval. Click to allow everything.'}
        >
            {mode === 'auto' ? 'Allow all' : 'Ask first'}
        </button>
    );
}

function Composer({ centered }: { centered?: boolean }) {
    const [input, setInput] = useState('');
    const [showModel, setShowModel] = useState(false);
    const [images, setImages] = useState<{ mimeType: string; dataBase64: string; name: string }[]>([]);
    const [attachments, setAttachments] = useState<{ name: string; text: string }[]>([]);
    const [fileList, setFileList] = useState<{ rel: string; path: string }[]>([]);
    const [active, setActive] = useState(0);
    const running = useAgentRunStore((s) => s.running);
    const surface = useAgentRunStore((s) => s.surface);
    const draft = useAgentRunStore((s) => s.composerDraft);
    const selectedModel = useOllamaStore((s) => s.selectedModel);
    const projectPath = useUIStore((s) => s.projectPath);
    const taRef = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    // -- Debate mode (inline, in the cowork chat) --------------------------
    const [debateOn, setDebateOn] = useState(false);
    const [modelB, setModelB] = useState('');
    const [rounds, setRounds] = useState(2);
    const debateRunning = useDebateStore((s) => s.running);
    const simultaneous = useDebateStore((s) => s.simultaneous);
    const setSimultaneous = useDebateStore((s) => s.setSimultaneous);
    const localModels = useOllamaStore((s) => s.models);
    const cloudNames = useOllamaStore((s) => s.cloudModelNames);
    // Model A is the current chat model; Model B is any OTHER available model.
    const modelBOptions = useMemo(
        () => [...new Set([...cloudNames, ...localModels])].filter((m) => m !== selectedModel),
        [cloudNames, localModels, selectedModel],
    );

    useEffect(() => { if (draft) { setInput(draft); useAgentRunStore.getState().setComposerDraft(''); setTimeout(() => taRef.current?.focus(), 0); } }, [draft]);
    useEffect(() => { if (projectPath) listProjectFiles(projectPath).then(setFileList); else setFileList([]); }, [projectPath]);
    const autosize = () => { const el = taRef.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 220) + 'px'; } };

    const slashActive = input.startsWith('/') && !input.includes(' ');
    const slashMatches = useMemo(() => slashActive ? SLASH_COMMANDS.filter((s) => s.cmd.startsWith(input.toLowerCase())) : [], [slashActive, input]);
    const atMatch = input.match(/(?:^|\s)@([\w./\\-]*)$/);
    const atQuery = atMatch ? atMatch[1].toLowerCase() : null;
    const atMatches = useMemo(() => atQuery !== null ? fileList.filter((f) => f.rel.toLowerCase().includes(atQuery)).slice(0, 8) : [], [atQuery, fileList]);
    useEffect(() => { setActive(0); }, [input]);

    const ctx: SlashCtx = {
        fill: (t) => { setInput(t); setTimeout(() => { taRef.current?.focus(); autosize(); }, 0); },
        send: (t) => { setInput(''); if (taRef.current) taRef.current.style.height = 'auto'; runTurn(t); },
        openModel: () => setShowModel(true),
        note: (md) => useAgentRunStore.getState().pushAssistant(md),
    };
    const pickSlash = (cmd: typeof SLASH_COMMANDS[number]) => { setInput(''); cmd.run(ctx); };
    const pickFile = async (f: { rel: string; path: string }) => {
        setInput((prev) => prev.replace(/@([\w./\\-]*)$/, `@${f.rel} `));
        const text = await window.vibe.readFile(f.path).catch(() => '');
        if (text) setAttachments((a) => a.some((x) => x.name === f.rel) ? a : [...a, { name: f.rel, text: text.slice(0, 20000) }]);
        setTimeout(() => taRef.current?.focus(), 0);
    };
    // FileReader, NOT String.fromCharCode(...bytes): spreading a screenshot-sized
    // Uint8Array as arguments overflows the call stack, which is why pasted
    // screenshots silently never appeared.
    const fileToB64 = (f: File) => new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => { const s = String(r.result || ''); resolve(s.slice(s.indexOf(',') + 1)); };
        r.onerror = () => reject(r.error);
        r.readAsDataURL(f);
    });
    const addFiles = async (files: File[]) => {
        for (const f of files) {
            if (f.type.startsWith('image/')) {
                if (f.size > 15 * 1024 * 1024) { useAgentRunStore.getState().pushAssistant(`_Image ${f.name || ''} is over 15 MB - too large to send._`); continue; }
                try {
                    const b64 = await fileToB64(f);
                    setImages((p) => [...p, { mimeType: f.type, dataBase64: b64, name: f.name || 'screenshot.png' }]);
                } catch { /* unreadable image - skip */ }
            } else {
                const text = await f.text().catch(() => '');
                if (text) setAttachments((a) => [...a, { name: f.name, text: text.slice(0, 20000) }]);
            }
        }
    };
    const filesFromDataTransfer = (dt: DataTransfer): File[] => {
        const out: File[] = [];
        for (const it of Array.from(dt.items || [])) {
            if (it.kind === 'file') { const f = it.getAsFile(); if (f) out.push(f); }
        }
        const files = out.length ? out : Array.from(dt.files);
        return files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('text/') || /\.(txt|md|json|csv|log|ts|tsx|js|jsx|py|c|cpp|h|ino|rs|go|java|yml|yaml|toml|xml|html|css)$/i.test(f.name));
    };

    // Claude-desktop behavior: pasting a screenshot lands in the composer no
    // matter what has focus, not only when the caret is in the textarea.
    useEffect(() => {
        const onWinPaste = (e: ClipboardEvent) => {
            if (e.target === taRef.current) return; // textarea's own handler covers this
            if (!e.clipboardData) return;
            const usable = filesFromDataTransfer(e.clipboardData);
            if (usable.length) { e.preventDefault(); addFiles(usable); taRef.current?.focus(); }
        };
        window.addEventListener('paste', onWinPaste);
        return () => window.removeEventListener('paste', onWinPaste);
    }, []);

    const send = () => {
        // Debate mode: a running debate takes the message as an interjection to
        // BOTH models; otherwise this starts a fresh debate (Model A = the chat
        // model, Model B = the picked opponent). Falls through to normal chat off.
        if (debateOn) {
            const text = input.trim();
            if ((!text && images.length === 0) || !selectedModel) return;
            if (debateRunning) {
                if (text) useDebateStore.getState().interject(text);
                setInput(''); if (taRef.current) taRef.current.style.height = 'auto';
                return;
            }
            if (!modelB) { useAgentRunStore.getState().pushAssistant('_Pick a second model (Model B) to debate against._'); return; }
            // Same input plumbing as a normal turn: fold attached files into text,
            // pass images through so the kernel's vision pass handles them.
            let composed = input;
            if (attachments.length) composed = attachments.map((a) => `Attached file ${a.name}:\n\`\`\`\n${a.text}\n\`\`\``).join('\n\n') + (composed ? `\n\n${composed}` : '');
            const imgs = images.map((i) => ({ mimeType: i.mimeType, dataBase64: i.dataBase64 }));
            const ds = useDebateStore.getState();
            ds.setModelA(selectedModel); ds.setModelB(modelB); ds.setMaxRounds(rounds); ds.reset();
            useAgentRunStore.getState().pushUser(text, imgs);
            ds.startDebate(composed, imgs, useSettingsStore.getState().apiKeys as Record<string, string>);
            setInput(''); setImages([]); setAttachments([]);
            if (taRef.current) taRef.current.style.height = 'auto';
            return;
        }
        if ((!input.trim() && images.length === 0 && attachments.length === 0) || running || !selectedModel) return;
        let text = input;
        if (attachments.length) text = attachments.map((a) => `Attached file ${a.name}:\n\`\`\`\n${a.text}\n\`\`\``).join('\n\n') + (text ? `\n\n${text}` : '');
        const imgs = images.map((i) => ({ mimeType: i.mimeType, dataBase64: i.dataBase64 }));
        setInput(''); setImages([]); setAttachments([]);
        if (taRef.current) taRef.current.style.height = 'auto';
        runTurn(text, imgs);
    };

    const menuOpen = slashMatches.length > 0 || atMatches.length > 0;
    const onKeyDown = (e: React.KeyboardEvent) => {
        if (menuOpen) {
            const list = slashMatches.length > 0 ? slashMatches : atMatches;
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, list.length - 1)); return; }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
            if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); slashMatches.length > 0 ? pickSlash(slashMatches[active]) : pickFile(atMatches[active]); return; }
            if (e.key === 'Escape') { e.preventDefault(); setInput((v) => v.replace(/@([\w./\\-]*)$/, '').replace(/^\/\S*$/, '')); return; }
        }
        // Enter must never kill a running stream (losing a whole turn to a reflexive
        // keypress). Stop is the ■ button or Escape - a deliberate action.
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!running) send(); }
        if (e.key === 'Escape' && (running || debateRunning)) { e.preventDefault(); if (debateRunning) useDebateStore.getState().cancelDebate(); else cancelRun(); }
    };

    return (
        <div className={centered ? 'cl-composer-wrap cl-composer-wrap--center' : undefined} style={{ width: '100%', maxWidth: centered ? undefined : 760, margin: centered ? undefined : '0 auto' }}>
            {showModel && <ModelPicker onClose={() => setShowModel(false)} />}
            <div className="cl-composer" style={{ position: 'relative' }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={async (e) => { e.preventDefault(); await addFiles(Array.from(e.dataTransfer.files)); }}>
                {slashMatches.length > 0 && (
                    <div className="cl-menu">
                        {slashMatches.map((s, i) => <div key={s.cmd} className={`cl-menu__row ${i === active ? 'cl-menu__row--active' : ''}`} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pickSlash(s); }}><b style={{ minWidth: 96 }}>{s.cmd}</b><span>{s.desc}</span><span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--cl-muted)' }}>{s.group}</span></div>)}
                    </div>
                )}
                {slashMatches.length === 0 && atMatches.length > 0 && (
                    <div className="cl-menu">
                        {atMatches.map((f, i) => <div key={f.path} className={`cl-menu__row ${i === active ? 'cl-menu__row--active' : ''}`} onMouseEnter={() => setActive(i)} onMouseDown={(e) => { e.preventDefault(); pickFile(f); }}>{f.rel}</div>)}
                    </div>
                )}
                {(images.length > 0 || attachments.length > 0) && (
                    <div className="cl-imgchips">
                        {images.map((img, i) => <span key={`i${i}`} className="cl-imgchip"><img className="cl-thumb-sm" src={`data:${img.mimeType};base64,${img.dataBase64}`} />{img.name}<button onClick={() => setImages((p) => p.filter((_, j) => j !== i))}>x</button></span>)}
                        {attachments.map((a, i) => <span key={`a${i}`} className="cl-imgchip">@ {a.name}<button onClick={() => setAttachments((p) => p.filter((_, j) => j !== i))}>x</button></span>)}
                    </div>
                )}
                <textarea ref={taRef} value={input}
                    onChange={(e) => { setInput(e.target.value); autosize(); }}
                    onPaste={async (e) => {
                        const usable = filesFromDataTransfer(e.clipboardData);
                        if (usable.length) { e.preventDefault(); await addFiles(usable); }
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={running ? 'Working…  (Esc or ■ to stop)' : `Message ${surface[0].toUpperCase() + surface.slice(1)}…   ( / for commands, @ for files )`}
                    rows={1} />
                <input
                    ref={fileRef} type="file" multiple style={{ display: 'none' }}
                    accept="image/*,.txt,.md,.json,.csv,.log,.ts,.tsx,.js,.jsx,.py,.c,.cpp,.h,.ino,.rs,.go,.java,.yml,.yaml,.toml,.xml,.html,.css"
                    onChange={async (e) => {
                        const fs = Array.from(e.target.files || []);
                        if (fs.length) await addFiles(fs);
                        e.target.value = ''; // allow re-attaching the same file
                        taRef.current?.focus();
                    }}
                />
                {debateOn && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 2px 8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: 'var(--cl-muted, #888)' }}>⚖ <span style={{ color: '#4fc3f7' }}>{selectedModel || 'Model A'}</span> vs</span>
                        <select className="cl-input" style={{ maxWidth: 220, fontSize: 12, padding: '2px 6px' }} value={modelB} onChange={(e) => setModelB(e.target.value)} disabled={debateRunning}>
                            <option value="">Pick Model B…</option>
                            {modelBOptions.map((m) => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <span style={{ fontSize: 11, color: 'var(--cl-muted, #888)' }}>rounds</span>
                        <select className="cl-input" style={{ width: 56, fontSize: 12, padding: '2px 6px' }} value={rounds} onChange={(e) => setRounds(Number(e.target.value))} disabled={debateRunning}>
                            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <button
                            type="button"
                            onClick={() => setSimultaneous(!simultaneous)}
                            disabled={debateRunning}
                            title={simultaneous ? 'Simultaneous: both models answer at once each round, then rebut the other’s previous answer' : 'Sequential: Model A answers, then Model B answers having seen A'}
                            style={{ fontSize: 11, padding: '3px 9px', borderRadius: 6, border: '1px solid var(--cl-border, #333)', background: simultaneous ? 'var(--cl-accent)' : 'transparent', color: simultaneous ? '#fff' : 'var(--cl-text-2, #888)', cursor: 'pointer', fontWeight: 600 }}
                        >{simultaneous ? '⇉ simultaneous' : '→ sequential'}</button>
                        {debateRunning && <span style={{ fontSize: 11, color: 'var(--cl-muted, #888)' }}>· type to interject both models</span>}
                    </div>
                )}
                <div className="cl-composer__row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <button className="cl-attach" title="Attach images or files (or paste / drag-drop)" onClick={() => fileRef.current?.click()}>+</button>
                        <button className="cl-modelchip" onClick={() => setShowModel(true)}>{selectedModel || 'Select model'}</button>
                        <AgentModeChip />
                        <PermissionModeChip />
                        <button
                            className={`cl-modelchip ${debateOn ? 'cl-modelchip--auto' : ''}`}
                            onClick={() => setDebateOn((v) => !v)}
                            title="Debate mode: two models answer, then critique and rebut each other in turn, streamed side by side. Model A is the current chat model; pick a Model B.">
                            ⚖ Debate
                        </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <UsageChip />
                        {(() => {
                            const busy = running || debateRunning;
                            const stop = () => { if (debateRunning) useDebateStore.getState().cancelDebate(); else cancelRun(); };
                            const disabled = !busy && (debateOn
                                ? (!input.trim() || !selectedModel || !modelB)
                                : ((!input.trim() && images.length === 0 && attachments.length === 0) || !selectedModel));
                            return (
                                <button className={busy ? 'cl-send cl-send--stop' : 'cl-send'} onClick={busy ? stop : send} disabled={disabled}>{busy ? '■' : '↑'}</button>
                            );
                        })()}
                    </div>
                </div>
            </div>
        </div>
    );
}
```

## `src/renderer/components/agent/ArtifactPane.tsx`

```tsx
import React, { useMemo, useState } from 'react';
import { svgFitDoc } from '../claude/Markdown';

/**
 * Detects fenced ```html / ```svg blocks in assistant text and offers a
 * sandboxed live preview. The iframe is sandboxed (allow-scripts only, no
 * same-origin) so artifact code cannot touch the app or the user's data.
 */
interface Artifact { lang: 'html' | 'svg'; code: string; }

function extractArtifacts(text: string): Artifact[] {
    const out: Artifact[] = [];
    const re = /```(html|svg)\s*\n([\s\S]*?)```/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        out.push({ lang: m[1].toLowerCase() as 'html' | 'svg', code: m[2].trim() });
    }
    return out;
}

export function ArtifactBadges({ text }: { text: string }) {
    const artifacts = useMemo(() => extractArtifacts(text), [text]);
    const [open, setOpen] = useState<Artifact | null>(null);
    if (artifacts.length === 0) return null;

    return (
        <>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '6px 0' }}>
                {artifacts.map((a, i) => (
                    <button key={i} onClick={() => setOpen(a)}
                        style={{ border: '1px solid var(--border)', background: 'rgba(0,102,255,0.06)', color: 'var(--accent, #0066ff)', borderRadius: 8, padding: '5px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                        Preview {a.lang.toUpperCase()} artifact
                    </button>
                ))}
            </div>
            {open && <ArtifactModal artifact={open} onClose={() => setOpen(null)} />}
        </>
    );
}

function ArtifactModal({ artifact, onClose }: { artifact: Artifact; onClose: () => void }) {
    // Same scale-to-fit document as the inline chat renderer, so the preview
    // can never show a different framing than the chat did.
    const srcDoc = artifact.lang === 'svg' ? svgFitDoc(artifact.code) : artifact.code;
    return (
        <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'grid', placeItems: 'center' }}>
            <div onClick={(e) => e.stopPropagation()} style={{ width: '80vw', height: '80vh', background: '#fff', borderRadius: 14, overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>Artifact preview ({artifact.lang})</span>
                    <button onClick={onClose} style={{ border: 'none', background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12 }}>Close</button>
                </div>
                <iframe title="artifact" sandbox="allow-scripts" srcDoc={srcDoc} style={{ flex: 1, border: 'none', width: '100%' }} />
            </div>
        </div>
    );
}
```

## `src/renderer/components/agent/DebatePanel.tsx`

```tsx
/* =======================================================================
   DebatePanel.tsx — UI for the dual-model debate feature.

   Shows:
   - Model A / Model B pickers
   - Round count selector
   - Optional judge model for synthesis
   - Start/Cancel buttons
   - Live streaming debate transcript (side-by-side per round)
   - Interjection input
   - Synthesis result
   ======================================================================= */
import React, { useState, useEffect } from 'react';
import {
    Box, Paper, Typography, Button, Select, MenuItem, FormControl, InputLabel,
    ToggleButton, ToggleButtonGroup, TextField, IconButton, Divider, Chip,
    CircularProgress, Tooltip, Collapse,
} from '@mui/material';
import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ForumIcon from '@mui/icons-material/Forum';
import SendIcon from '@mui/icons-material/Send';
import { useDebateStore, type DebateRound } from '../../store/debate';
import { useSettingsStore } from '../../store/settings';
import { extractThink } from '../claude/Markdown';

const colorA = '#4fc3f7';   // blue
const colorB = '#ffb74d';   // amber

/** Hide inline <think> reasoning (and stray tags) from a reasoning model. */
const clean = (t: string): string => extractThink(t || '').visible.replace(/<\/?think>/gi, '').trim();

function RoundView({ round }: { round: DebateRound }) {
    return (
        <Paper elevation={0} sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <Chip
                    size="small"
                    label={`Round ${round.round}`}
                    color="primary"
                    variant="outlined"
                />
                {!round.complete && (
                    <CircularProgress size={12} sx={{ ml: 1 }} />
                )}
            </Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                <Box>
                    <Typography variant="caption" sx={{ color: colorA, fontWeight: 600, display: 'block', mb: 0.5 }}>
                        MODEL A
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, minHeight: 20 }}>
                        {clean(round.textA) || <span style={{ color: '#666' }}>{round.textA ? 'thinking…' : 'waiting…'}</span>}
                    </Typography>
                </Box>
                <Box>
                    <Typography variant="caption" sx={{ color: colorB, fontWeight: 600, display: 'block', mb: 0.5 }}>
                        MODEL B
                    </Typography>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5, minHeight: 20 }}>
                        {clean(round.textB) || <span style={{ color: '#666' }}>{round.textB ? 'thinking…' : 'waiting…'}</span>}
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
}

export default function DebatePanel() {
    const [message, setMessage] = useState('');
    const [interjection, setInterjection] = useState('');
    const [availableModels, setAvailableModels] = useState<string[]>([]);

    const d = useDebateStore();
    const settings = useSettingsStore();

    // Load models on mount
    useEffect(() => {
        // Use the same model list as the main model picker
        window.vibe.listModels().then((models: string[]) => {
            setAvailableModels(models.map(m => `ollama:${m}`));
        }).catch(() => {});

        // Also load cloud models from the kernel
        window.vibe.kernel.cloudModels().then((cloudModels) => {
            const cloud = cloudModels.map(m => m.name);
            setAvailableModels(prev => [...prev, ...cloud]);
        }).catch(() => {});
    }, []);

    const handleStart = () => {
        if (!message.trim()) return;
        d.startDebate(message, [], settings.apiKeys);
        setMessage('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleStart();
        }
    };

    const handleInterject = () => {
        if (!interjection.trim()) return;
        d.interject(interjection);
        setInterjection('');
    };

    return (
        <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <ForumIcon fontSize="small" color="primary" />
                <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>
                    Model Debate
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <ToggleButtonGroup
                    size="small"
                    value={d.debateEnabled ? 'on' : 'off'}
                    exclusive
                    onChange={(_, v) => d.toggleDebate(v === 'on')}
                >
                    <ToggleButton value="on" size="small">ON</ToggleButton>
                    <ToggleButton value="off" size="small">OFF</ToggleButton>
                </ToggleButtonGroup>
            </Box>

            {!d.debateEnabled ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                        Toggle ON to enable model debate mode
                    </Typography>
                </Box>
            ) : (
                <>
                    {/* Config bar */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel sx={{ fontSize: 13 }}>Model A</InputLabel>
                            <Select
                                value={d.modelA}
                                label="Model A"
                                onChange={(e) => d.setModelA(e.target.value)}
                                sx={{ fontSize: 13 }}
                            >
                                {availableModels.map(m => <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{m}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel sx={{ fontSize: 13 }}>Model B</InputLabel>
                            <Select
                                value={d.modelB}
                                label="Model B"
                                onChange={(e) => d.setModelB(e.target.value)}
                                sx={{ fontSize: 13 }}
                            >
                                {availableModels.map(m => <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{m}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                            <InputLabel sx={{ fontSize: 13 }}>Rounds</InputLabel>
                            <Select
                                value={d.maxRounds}
                                label="Rounds"
                                onChange={(e) => d.setMaxRounds(Number(e.target.value))}
                                sx={{ fontSize: 13 }}
                            >
                                {[1, 2, 3, 4, 5].map(n => <MenuItem key={n} value={n} sx={{ fontSize: 13 }}>{n}</MenuItem>)}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ minWidth: 140 }}>
                            <InputLabel sx={{ fontSize: 13 }}>Judge (optional)</InputLabel>
                            <Select
                                value={d.judgeModel}
                                label="Judge (optional)"
                                onChange={(e) => d.setJudgeModel(e.target.value)}
                                sx={{ fontSize: 13 }}
                            >
                                <MenuItem value="" sx={{ fontSize: 13 }}>No synthesis</MenuItem>
                                {availableModels.map(m => <MenuItem key={m} value={m} sx={{ fontSize: 13 }}>{m}</MenuItem>)}
                            </Select>
                        </FormControl>
                    </Box>

                    {/* Message input */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            multiline
                            maxRows={3}
                            placeholder="Ask a question for the models to debate…"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            onKeyDown={handleKeyDown}
                            sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}
                        />
                        {d.running ? (
                            <IconButton color="error" onClick={() => d.cancelDebate()}>
                                <StopIcon />
                            </IconButton>
                        ) : (
                            <IconButton color="primary" onClick={handleStart} disabled={!message.trim()}>
                                <PlayArrowIcon />
                            </IconButton>
                        )}
                    </Box>

                    {d.error && (
                        <Typography variant="caption" color="error" sx={{ mb: 1 }}>
                            {d.error}
                        </Typography>
                    )}

                    {/* Debate transcript */}
                    <Box sx={{ flexGrow: 1, overflow: 'auto', pr: 1 }}>
                        {d.rounds.map((round, i) => (
                            <RoundView key={i} round={round} />
                        ))}

                        {d.synthesizing && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <CircularProgress size={16} />
                                <Typography variant="caption" color="text.secondary">
                                    Synthesizing…
                                </Typography>
                            </Box>
                        )}

                        {d.synthesis && (
                            <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: 'primary.main', color: 'primary.contrastText' }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, fontSize: 13 }}>
                                    ⚖️ Synthesized Answer
                                </Typography>
                                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: 13, lineHeight: 1.5 }}>
                                    {clean(d.synthesis)}
                                </Typography>
                            </Paper>
                        )}
                    </Box>

                    {/* Interjection bar */}
                    <Collapse in={d.running}>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, pt: 1, borderTop: '1px solid', borderColor: 'divider' }}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Interject — send a message to both models mid-debate…"
                                value={interjection}
                                onChange={(e) => setInterjection(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleInterject();
                                    }
                                }}
                                sx={{ '& .MuiInputBase-input': { fontSize: 13 } }}
                            />
                            <Tooltip title="Send interjection">
                                <IconButton
                                    color="secondary"
                                    onClick={handleInterject}
                                    disabled={!interjection.trim()}
                                >
                                    <SendIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Collapse>
                </>
            )}
        </Box>
    );
}
```

## `src/renderer/components/agent/DesignCanvas.tsx`

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useAgentRunStore, type RunItem } from '../../store/agentRun';
import { svgFitDoc } from '../claude/Markdown';

/** Pull the newest ```html / ```svg block out of assistant text - including a
    PARTIAL block that is still streaming (no closing fence yet). */
function extractBlock(text: string): string {
    const re = /```(html|svg)\s*\n/gi;
    let m: RegExpExecArray | null;
    let last: { lang: string; start: number } | null = null;
    while ((m = re.exec(text)) !== null) last = { lang: m[1].toLowerCase(), start: re.lastIndex };
    if (!last) return '';
    const rest = text.slice(last.start);
    const end = rest.indexOf('```');
    const code = (end === -1 ? rest : rest.slice(0, end)).trim();
    if (!code) return '';
    return last.lang === 'svg' ? svgFitDoc(code) : code;
}

function latestDesignDoc(items: RunItem[]): string {
    for (let i = items.length - 1; i >= 0; i--) {
        const it = items[i];
        if (it.kind !== 'assistant') continue;
        const doc = extractBlock(it.text);
        if (doc) return doc;
    }
    return '';
}

/** Live-rendering canvas for the Design surface. Sandbox: scripts only - the
    design cannot reach the app, the filesystem, or the network origin. */
export function DesignCanvas() {
    const items = useAgentRunStore((s) => s.items);
    const running = useAgentRunStore((s) => s.running);
    const [doc, setDoc] = useState('');
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latest = latestDesignDoc(items);

    useEffect(() => {
        if (!running) {
            if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
            setDoc(latest);
            return;
        }
        // While streaming, refresh at most ~2x/sec (each srcDoc swap is a full reload).
        if (timerRef.current) return;
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setDoc(latestDesignDoc(useAgentRunStore.getState().items));
        }, 450);
    }, [latest, running]);
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    const copy = () => { if (doc) navigator.clipboard?.writeText(doc); };

    return (
        <div className="cl-canvas">
            <div className="cl-canvas__bar">
                <span>Canvas</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {running && <span className="cl-canvas__live">● live</span>}
                    <button onClick={copy} disabled={!doc}>copy html</button>
                </div>
            </div>
            {doc ? (
                <iframe className="cl-canvas__frame" title="design-canvas" sandbox="allow-scripts" srcDoc={doc} />
            ) : (
                <div className="cl-canvas__empty">
                    <div style={{ fontSize: 42, opacity: 0.15 }}>◇</div>
                    <div>Describe what you want designed.<br />It renders here live while the agent streams.</div>
                </div>
            )}
        </div>
    );
}
```

## `src/renderer/components/agent/NeuralWidget.tsx`

```tsx
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useUIStore } from '../../store/ui'

interface AgentStatus {
  collector: {
    isRunning: boolean
    eventCount: number
    lastEventTime: number | null
    isDistilling: boolean
    lastDistillTime: number | null
  }
  reviewer: {
    isRunning: boolean
    isSynthesizing: boolean
    lastBriefingTime: number
    briefingCount: number
  }
}

export function NeuralWidget() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const tRef = useRef(0)
  const statusRef = useRef<AgentStatus | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [status, setStatus] = useState<AgentStatus | null>(null)
  const projectPath = useUIStore(state => state.projectPath);
  const [facts, setFacts] = useState<string[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [repair, setRepair] = useState<any>(null);

  // Poll agent status every 2 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const s = await window.vibe.getAgentStatus()
        setStatus(s)
        statusRef.current = s
      } catch {}
    }
    poll()
    const interval = setInterval(poll, 2000)
    return () => clearInterval(interval)
  }, [])

  // Canvas animation

  // Load facts, health, and repair suggestions when expanded
  useEffect(() => {
    if (!expanded || !projectPath) return;
    const load = async () => {
      try {
        const factsContent = await window.vibe.readFile(`${projectPath}/.vibe/facts.json`);
        const parsed = JSON.parse(factsContent);
        if (Array.isArray(parsed.facts)) setFacts(parsed.facts.slice(-5));
      } catch {}
      try {
        const healthContent = await window.vibe.readFile(`${projectPath}/.vibe/health.json`);
        setHealth(JSON.parse(healthContent));
      } catch {}
      try {
        const repairContent = await window.vibe.readFile(`${projectPath}/.vibe/swarm-repairs/latest.json`);
        setRepair(JSON.parse(repairContent));
      } catch {}
    };
    load();
  }, [expanded, projectPath]);
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width = 200
    const H = canvas.height = 90

    // Internal simulation state
    let sparks: Array<{
      t: number; speed: number; arc: number
      size: number; trail: Array<{x:number;y:number}>; hue: number
    }> = []
    let shockwaves: Array<{x:number;y:number;r:number;maxR:number;t:number;hue:number}> = []
    let lastEventCount = 0
    let lastSynthesizing = false
    let reviewerGlow = 0
    let collectorFlare = 0
    let synapseFlow = 0

    const N1 = { x: 45, y: H / 2 }
    const N2 = { x: W - 45, y: H / 2 }
    const NR = 18

    function spawnSparks() {
      for (let i = 0; i < 4; i++) {
        sparks.push({
          t: 0,
          speed: 0.012 + Math.random() * 0.015,
          arc: (Math.random() - 0.5) * 1.0,
          size: 1.5 + Math.random() * 2,
          trail: [],
          hue: 195 + Math.random() * 30
        })
      }
    }

    function spawnShockwave(x: number, y: number, hue: number) {
      shockwaves.push({ x, y, r: NR, maxR: NR + 35, t: 0, hue })
    }

    function lerp(a: number, b: number, t: number) { return a + (b-a)*t }
    function ease(t: number) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t }

    function draw() {
      tRef.current += 0.018
      const T = tRef.current
      const s = statusRef.current

      // Check for new events
      if (s) {
        if (s.collector.eventCount > lastEventCount) {
          lastEventCount = s.collector.eventCount
          collectorFlare = 1
          synapseFlow = Math.min(1, synapseFlow + 0.5)
          spawnSparks()
          spawnShockwave(N1.x, N1.y, 210)
        }
        if (s.reviewer.isSynthesizing && !lastSynthesizing) {
          reviewerGlow = 1
          synapseFlow = 1
          spawnShockwave(N2.x, N2.y, 165)
        }
        lastSynthesizing = s.reviewer.isSynthesizing
      }

      // Decay
      collectorFlare = Math.max(0, collectorFlare - 0.03)
      reviewerGlow = Math.max(0, reviewerGlow - 0.012)
      synapseFlow = Math.max(0, synapseFlow - 0.01)

      // Clear with deep space bg
      ctx.fillStyle = '#070a14'
      ctx.fillRect(0, 0, W, H)

      // Subtle nebula
      const ng = ctx.createRadialGradient(W/2, H/2, 0, W/2, H/2, 80)
      ng.addColorStop(0, 'rgba(40,80,180,0.06)')
      ng.addColorStop(1, 'transparent')
      ctx.fillStyle = ng
      ctx.fillRect(0, 0, W, H)

      // Neural bridge
      const x1 = N1.x + NR, x2 = N2.x - NR
      ctx.beginPath()
      ctx.moveTo(x1, H/2)
      ctx.lineTo(x2, H/2)
      ctx.strokeStyle = 'rgba(60,120,255,0.15)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      if (synapseFlow > 0.1) {
        for (let strand = 0; strand < 2; strand++) {
          ctx.beginPath()
          for (let i = 0; i <= 40; i++) {
            const f = i/40
            const x = lerp(x1, x2, f)
            const wave = Math.sin(f * Math.PI * 5 - T * 7 + strand * 1.5) * 7 * synapseFlow
            if (i===0) ctx.moveTo(x, H/2+wave)
            else ctx.lineTo(x, H/2+wave)
          }
          ctx.strokeStyle = `hsla(${185+strand*20},100%,70%,${0.45*synapseFlow})`
          ctx.lineWidth = 1
          ctx.stroke()
        }
      }

      // Shockwaves
      shockwaves = shockwaves.filter(sw => sw.t < 1)
      for (const sw of shockwaves) {
        sw.t += 0.025
        const r = lerp(sw.r, sw.maxR, ease(sw.t))
        const alpha = (1 - sw.t) * 0.55
        ctx.beginPath()
        ctx.arc(sw.x, sw.y, r, 0, Math.PI*2)
        ctx.strokeStyle = `hsla(${sw.hue},100%,70%,${alpha})`
        ctx.lineWidth = 0.8
        ctx.stroke()
      }

      // Sparks
      sparks = sparks.filter(sp => sp.t < 1)
      for (const sp of sparks) {
        sp.t += sp.speed
        const f = ease(sp.t)
        const x = lerp(x1, x2, f)
        const y = H/2 + Math.sin(sp.t * Math.PI) * 25 * sp.arc
        sp.trail.push({x,y})
        if (sp.trail.length > 6) sp.trail.shift()
        const alpha = Math.sin(sp.t * Math.PI)
        for (let i = 0; i < sp.trail.length; i++) {
          const tp = sp.trail[i]
          ctx.beginPath()
          ctx.arc(tp.x, tp.y, sp.size * (i/sp.trail.length) * 0.8, 0, Math.PI*2)
          ctx.fillStyle = `hsla(${sp.hue},100%,80%,${(i/sp.trail.length)*alpha*0.7})`
          ctx.fill()
        }
        ctx.beginPath()
        ctx.arc(x, y, sp.size, 0, Math.PI*2)
        ctx.fillStyle = `hsla(${sp.hue},100%,95%,${alpha})`
        ctx.fill()
      }

      // Draw node function
      const drawNode = (
        nx: number, ny: number,
        phase: number, flare: number,
        hue1: number, hue2: number
      ) => {
        const breathe = 1 + 0.07 * Math.sin(phase)
        const r = NR * breathe
        const glow = 0.25 + flare * 0.75

        // Outer glow
        for (let i = 3; i >= 1; i--) {
          const gr = ctx.createRadialGradient(nx,ny,0,nx,ny,r*(1+i*0.55))
          gr.addColorStop(0, `hsla(${hue1},100%,65%,${0.05*glow*i*0.25})`)
          gr.addColorStop(1,'transparent')
          ctx.beginPath()
          ctx.arc(nx, ny, r*(1+i*0.55), 0, Math.PI*2)
          ctx.fillStyle = gr
          ctx.fill()
        }

        // Orbital ring
        ctx.save()
        ctx.translate(nx, ny)
        ctx.rotate(phase * 0.35)
        ctx.beginPath()
        ctx.ellipse(0, 0, r*1.55, r*0.35, 0, 0, Math.PI*2)
        ctx.strokeStyle = `hsla(${hue2},100%,75%,${0.18*glow})`
        ctx.lineWidth = 0.5
        ctx.stroke()
        ctx.restore()

        // Core
        const cg = ctx.createRadialGradient(nx-r*0.3,ny-r*0.3,r*0.05,nx,ny,r)
        cg.addColorStop(0, `hsla(${hue1},50%,96%,1)`)
        cg.addColorStop(0.35, `hsla(${hue1},90%,68%,1)`)
        cg.addColorStop(0.75, `hsla(${hue2},100%,42%,1)`)
        cg.addColorStop(1, `hsla(${hue2},100%,18%,1)`)
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI*2)
        ctx.fillStyle = cg
        ctx.fill()

        // Specular
        const sg = ctx.createRadialGradient(nx-r*0.3,ny-r*0.32,0,nx-r*0.2,ny-r*0.2,r*0.55)
        sg.addColorStop(0,'rgba(255,255,255,0.45)')
        sg.addColorStop(1,'transparent')
        ctx.beginPath()
        ctx.arc(nx, ny, r, 0, Math.PI*2)
        ctx.fillStyle = sg
        ctx.fill()

        // Flare rays
        if (flare > 0.25) {
          for (let i = 0; i < 10; i++) {
            const angle = (i/10)*Math.PI*2 + phase
            const len = r*(0.6+0.4*Math.sin(angle*3+T*3))*flare
            ctx.beginPath()
            ctx.moveTo(nx+Math.cos(angle)*r, ny+Math.sin(angle)*r)
            ctx.lineTo(nx+Math.cos(angle)*(r+len), ny+Math.sin(angle)*(r+len))
            ctx.strokeStyle = `hsla(${hue1},100%,88%,${0.4*flare})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      drawNode(N1.x, N1.y, T*1.1, collectorFlare, 210, 235)
      drawNode(N2.x, N2.y, T*0.65+1.8, reviewerGlow, 162, 190)

      // Labels
      ctx.font = '8px SF Mono, monospace'
      ctx.textAlign = 'center'
      ctx.fillStyle = `rgba(150,180,255,${0.45 + collectorFlare*0.4})`
      ctx.fillText('collector', N1.x, H - 8)
      ctx.fillStyle = `rgba(100,220,175,${0.45 + reviewerGlow*0.4})`
      ctx.fillText('reviewer', N2.x, H - 8)

      animRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(animRef.current)
  }, [])

  const formatTime = (ms: number | null) => {
    if (!ms) return '-'
    const s = Math.floor((Date.now() - ms) / 1000)
    if (s < 60) return `${s}s ago`
    return `${Math.floor(s/60)}m ago`
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: 220,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      gap: 8,
      pointerEvents: 'auto'
    }}>
      {expanded && status && (
        <div style={{
          background: 'rgba(7,10,20,0.95)',
          border: '1px solid rgba(60,120,255,0.25)',
          borderRadius: 12,
          padding: '14px 16px',
          minWidth: 220,
          backdropFilter: 'blur(16px)',
          fontFamily: 'SF Mono, monospace',
          fontSize: 11,
          color: 'rgba(180,210,255,0.85)',
          lineHeight: 1.9
        }}>
          <div style={{ color: 'rgba(100,160,255,0.6)', fontSize: 9, letterSpacing: '0.2em', marginBottom: 8 }}>
            VIBE NEURAL AGENTS
          </div>
          <div style={{ borderBottom: '1px solid rgba(60,120,255,0.15)', paddingBottom: 8, marginBottom: 8 }}>
            <div style={{ color: 'rgba(100,180,255,0.9)', fontWeight: 600, marginBottom: 2 }}>
               Collector
            </div>
            <div>events: {status.collector.eventCount}</div>
            <div>last event: {formatTime(status.collector.lastEventTime)}</div>
            <div>distilling: {status.collector.isDistilling ? ' active' : 'idle'}</div>
          </div>
          <div>
            <div style={{ color: 'rgba(80,220,160,0.9)', fontWeight: 600, marginBottom: 2 }}>
               Reviewer
            </div>
            <div>briefings: {status.reviewer.briefingCount}</div>
            <div>last briefing: {formatTime(status.reviewer.lastBriefingTime || null)}</div>
            <div>synthesizing: {status.reviewer.isSynthesizing ? ' active' : 'idle'}</div>
          </div>
          {/* Facts */}
          {facts.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, color: 'rgba(180,210,255,0.9)', marginBottom: 4 }}>Facts</div>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {facts.slice(0, 5).map((f, i) => <li key={i} style={{ fontSize: 11 }}>{f}</li>)}
              </ul>
            </div>
          )}
          {/* Health */}
          {health && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, color: 'rgba(180,210,255,0.9)', marginBottom: 4 }}>Health</div>
              <div>Branch: {health.git?.branch}</div>
              <div>Uncommitted: {health.git?.uncommittedChanges}</div>
              <div>Recent: {Array.isArray(health.recentChanges) ? health.recentChanges.slice(-3).join(', ') : ''}</div>
            </div>
          )}
          {/* Repair Suggestions */}
          {repair && repair.suggestedChanges && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 600, color: 'rgba(180,210,255,0.9)', marginBottom: 4 }}>Repair Suggestions</div>
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {repair.suggestedChanges.map((chg: any, i: number) => (
                  <li key={i} style={{ fontSize: 11 }}>{chg.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer', lineHeight: 0 }}
        title="VIBE Neural Agents"
      >
        <canvas
          ref={canvasRef}
          style={{
            borderRadius: 12,
            border: '1px solid rgba(60,120,255,0.2)',
            display: 'block'
          }}
        />
      </div>
    </div>
  )
}
```

## `src/renderer/components/agent/PermissionPrompt.tsx`

```tsx
import React from 'react';
import type { PermissionRequest } from '../../../shared/agent';
import { approvePermission } from '../../services/agentClient';

const TIER_LABEL: Record<string, string> = { safe: 'read', mutating: 'write', exec: 'run command', network: 'network' };

export function PermissionPrompt({ req, resolved }: { req: PermissionRequest; resolved?: 'allow' | 'deny' }) {
    if (resolved) {
        return (
            <div className="cl-status" style={{ color: resolved === 'allow' ? '#2f7d47' : '#b5473b', fontStyle: 'normal' }}>
                {resolved === 'allow' ? 'Approved' : 'Denied'}: {req.render}
            </div>
        );
    }
    return (
        <div className="cl-perm">
            <div className="cl-perm__t">Permission needed — {TIER_LABEL[req.tier] || req.tier}</div>
            <div className="cl-perm__d">{req.render}</div>
            {req.target && <div className="cl-perm__target">{req.target}</div>}
            <div className="cl-perm__row">
                <button className="cl-btn cl-btn--primary" onClick={() => approvePermission(req.id, 'allow', 'once')}>Allow once</button>
                <button className="cl-btn cl-btn--ghost" onClick={() => approvePermission(req.id, 'allow', 'session')}>Allow for session</button>
                <button className="cl-btn cl-btn--ghost" onClick={() => approvePermission(req.id, 'allow', 'always')}>Always allow</button>
                <button className="cl-btn cl-btn--danger" onClick={() => approvePermission(req.id, 'deny', 'once')}>Deny</button>
            </div>
        </div>
    );
}
```

## `src/renderer/components/agent/ToolCallCard.tsx`

```tsx
import React, { useState } from 'react';
import type { ToolItemData } from '../../store/agentRun';

const ICONS: Record<string, string> = {
    read_file: 'R', write_file: 'W', edit_file: 'E', list_dir: 'D',
    glob: 'G', grep: '/', bash: '$', web_search: '?', web_fetch: '@',
    task: 'T', use_skill: 'S',
};

function DiffView({ diff }: { diff: string }) {
    return (
        <pre style={{ margin: 0 }}>
            {diff.split('\n').map((line, i) => {
                const add = line.startsWith('+'); const del = line.startsWith('-');
                return (
                    <div key={i} style={{
                        background: add ? 'rgba(60,160,90,0.14)' : del ? 'rgba(200,60,60,0.10)' : 'transparent',
                        color: add ? '#2f7d47' : del ? '#b5473b' : 'var(--cl-text-2)',
                        padding: '0 4px', whiteSpace: 'pre-wrap',
                    }}>{line || ' '}</div>
                );
            })}
        </pre>
    );
}

export function ToolCallCard({ item }: { item: ToolItemData }) {
    const [open, setOpen] = useState(false);
    const icon = ICONS[item.name] || '*';
    const isMcp = item.name.startsWith('mcp__');
    const statusColor = item.status === 'error' ? '#b5473b' : item.status === 'ok' ? '#2f7d47' : 'var(--cl-muted)';
    const diff = item.data && typeof item.data === 'object' ? (item.data as any).diff : undefined;

    return (
        <div className="cl-tool">
            <div className="cl-tool__head" onClick={() => setOpen(!open)}>
                <span className="cl-tool__dot" style={{ color: statusColor }}>{icon}</span>
                <span className="cl-tool__name">{item.render}</span>
                {isMcp && <span className="cl-tool__badge">MCP</span>}
                <span style={{ fontSize: 11, color: statusColor }}>
                    {item.status === 'running' ? 'running' : item.status === 'ok' ? 'done' : 'error'}
                </span>
                <span style={{ fontSize: 10, color: 'var(--cl-muted)' }}>{open ? '▾' : '▸'}</span>
            </div>
            {open && (
                <div className="cl-tool__body">
                    {diff ? <DiffView diff={diff} /> : <pre>{item.resultContent || '(no output yet)'}</pre>}
                </div>
            )}
        </div>
    );
}
```

## `src/renderer/components/ai/ChatMessages.tsx`

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';
import { ThinkBlock } from './ThinkBlock';
import { ThinkingIndicator } from './ThinkingIndicator';

/* ===========================================================
   XML TAG EXTRACTION HELPER
   =========================================================== */
function extractTag(text: string, tag: string): string | null {
    try {
        const match = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return match ? match[1].trim() : null;
    } catch { return null; }
}

/* ===========================================================
   SEGMENT TYPES
   =========================================================== */
interface Segment {
    type: 'text' | 'plan' | 'critique' | 'reflection' | 'verification' | 'done' | 'analyze' | 'execute' | 'write_file';
    content: string;
}

/* ===========================================================
   XML RESPONSE PARSER
   Splits response into typed segments. Strips unrecognized tags.
   =========================================================== */
function parseAgentResponse(content: string): Segment[] {
    const segments: Segment[] = [];

    // Regex for all known top-level XML blocks
    const blockPattern = /(<plan>[\s\S]*?<\/plan>|<critique>[\s\S]*?<\/critique>|<reflection>[\s\S]*?<\/reflection>|<verification>[\s\S]*?<\/verification>|<done>[\s\S]*?<\/done>|<analyze>[\s\S]*?<\/analyze>|<execute>[\s\S]*?<\/execute>|<write_file[\s\S]*?<\/write_file>|<read_file\s[^>]*\/?>)/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = blockPattern.exec(content)) !== null) {
        // Text before this block
        if (match.index > lastIndex) {
            const textBefore = content.slice(lastIndex, match.index);
            const cleaned = stripUnknownTags(textBefore).trim();
            if (cleaned) segments.push({ type: 'text', content: cleaned });
        }

        const block = match[0];
        if (block.startsWith('<plan>')) {
            segments.push({ type: 'plan', content: block });
        } else if (block.startsWith('<critique>')) {
            segments.push({ type: 'critique', content: block });
        } else if (block.startsWith('<reflection>')) {
            segments.push({ type: 'reflection', content: block });
        } else if (block.startsWith('<verification>')) {
            segments.push({ type: 'verification', content: block });
        } else if (block.startsWith('<done>')) {
            segments.push({ type: 'done', content: block });
        } else if (block.startsWith('<analyze>')) {
            segments.push({ type: 'analyze', content: block });
        } else if (block.startsWith('<execute>')) {
            segments.push({ type: 'execute', content: block });
        } else if (block.startsWith('<write_file')) {
            segments.push({ type: 'write_file', content: block });
        }
        // read_file is silently stripped - no segment added

        lastIndex = match.index + match[0].length;
    }

    // Remaining text after last block
    if (lastIndex < content.length) {
        const remaining = content.slice(lastIndex);
        const cleaned = stripUnknownTags(remaining).trim();
        if (cleaned) segments.push({ type: 'text', content: cleaned });
    }

    return segments;
}

/** Strip any unrecognized XML-like tags, keeping their inner text */
function stripUnknownTags(text: string): string {
    return text
        .replace(/<\/?(?:mission|steps|step[^>]*|criteria|risks|score|notes|proceed|evidence|remaining|summary|files_changed|criteria_met|issues|revised_plan)[^>]*>/gi, '')
        .trim();
}

/* ===========================================================
   BEAUTIFUL UI COMPONENTS FOR AGENT PHASES
   =========================================================== */

/* --- EXECUTION PLAN --------------------------------------- */
function PlanCard({ content }: { content: string }) {
    const [collapsed, setCollapsed] = useState(false);
    const mission = extractTag(content, 'mission') || '';
    const criteria = extractTag(content, 'criteria') || '';
    const risks = extractTag(content, 'risks') || '';
    const stepsRaw = content.match(/<step[^>]*>([\s\S]*?)<\/step>/gi) || [];
    const steps = stepsRaw.map(s => {
        const inner = s.match(/<step[^>]*>([\s\S]*?)<\/step>/i);
        return inner ? inner[1].trim() : '';
    }).filter(Boolean);

    return (
        <div className="agent-card agent-card--plan">
            <div className="agent-card__header" onClick={() => setCollapsed(!collapsed)}>
                <span className="agent-card__icon"></span>
                <span className="agent-card__title">Execution Plan</span>
                <span className="agent-card__toggle">{collapsed ? '' : ''}</span>
            </div>
            {!collapsed && (
                <div className="agent-card__body">
                    {mission && <div className="agent-plan__mission">{mission}</div>}
                    {steps.length > 0 && (
                        <div className="agent-plan__steps">
                            {steps.map((s, i) => (
                                <div key={i} className="agent-plan__step">
                                    <span className="agent-plan__step-num">
                                        {['','','','','','','','','',''][i] || `${i+1}.`}
                                    </span>
                                    <span>{s}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {criteria && (
                        <div className="agent-plan__criteria">
                            <span className="agent-plan__criteria-label">Criteria:</span> {criteria}
                        </div>
                    )}
                    {risks && (
                        <div className="agent-plan__risks">
                            <span className="agent-plan__risks-label">! Risks:</span> {risks}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

/* --- CRITIQUE / PLAN REVIEW ------------------------------- */
function CritiqueCard({ content }: { content: string }) {
    const scoreStr = extractTag(content, 'score') || '8';
    const score = parseInt(scoreStr, 10);
    const revisedPlan = extractTag(content, 'revised_plan') || '';
    const approved = score >= 7 || revisedPlan.toUpperCase().includes('APPROVED');
    const variant = approved ? 'approved' : 'revised';

    return (
        <div className={`agent-card agent-card--critique agent-card--critique-${variant}`}>
            <div className="agent-card__header">
                <span className="agent-card__icon">{approved ? 'ok' : ''}</span>
                <span className="agent-card__title">Plan Review</span>
                <span className="agent-critique__score">Score: {score}/10</span>
            </div>
            <div className="agent-critique__status">
                {approved ? 'Approved' : 'Issues found - revising plan...'}
            </div>
        </div>
    );
}

/* --- REFLECTION PILL -------------------------------------- */
function ReflectionPill({ content }: { content: string }) {
    const scoreStr = extractTag(content, 'score') || '8';
    const score = parseInt(scoreStr, 10);
    const proceed = extractTag(content, 'proceed');
    const good = score >= 7;

    return (
        <span className={`agent-pill agent-pill--${good ? 'good' : 'retry'}`}>
            Score {score}/10 {good ? 'ok' : ''} {proceed === 'no' ? 'Retrying' : 'Proceeding'}
        </span>
    );
}

/* --- VERIFICATION CARD ------------------------------------ */
function VerificationCard({ content }: { content: string }) {
    const criteriaMet = extractTag(content, 'criteria_met') || 'unknown';
    const remaining = extractTag(content, 'remaining') || '';
    const evidence = extractTag(content, 'evidence') || '';

    let icon = ''; let title = 'Mission Complete'; let variant = 'complete';
    if (criteriaMet === 'no') { icon = '!'; title = 'Incomplete'; variant = 'incomplete'; }
    if (criteriaMet === 'partial') { icon = ''; title = 'Partially Complete'; variant = 'partial'; }

    return (
        <div className={`agent-card agent-card--verification agent-card--verification-${variant}`}>
            <div className="agent-card__header">
                <span className="agent-card__icon">{icon}</span>
                <span className="agent-card__title">{title}</span>
            </div>
            <div className="agent-card__body">
                {evidence && <div className="agent-verification__evidence">{evidence}</div>}
                {remaining && (
                    <div className="agent-verification__remaining">
                        <div className="agent-verification__remaining-title">Still needed:</div>
                        {remaining.split('\n').filter(Boolean).map((item, i) => (
                            <div key={i} className="agent-verification__remaining-item"> {item.replace(/^[-]\s*/, '')}</div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

/* --- DONE CARD -------------------------------------------- */
function DoneCard({ content }: { content: string }) {
    const summary = extractTag(content, 'summary') || 'Task completed';
    const filesChanged = extractTag(content, 'files_changed') || '';

    return (
        <div className="agent-card agent-card--done">
            <div className="agent-card__header">
                <span className="agent-card__icon"></span>
                <span className="agent-card__title">Task Complete</span>
            </div>
            <div className="agent-card__body">
                <div className="agent-done__summary">{summary}</div>
                {filesChanged && (
                    <div className="agent-done__files">Files: {filesChanged}</div>
                )}
            </div>
        </div>
    );
}

/* --- ANALYSIS CARD ---------------------------------------- */
function AnalyzeCard({ content }: { content: string }) {
    const inner = extractTag(content, 'analyze') || content.replace(/<\/?analyze>/gi, '').trim();
    return (
        <div className="agent-card agent-card--analyze">
            <div className="agent-card__header">
                <span className="agent-card__icon"></span>
                <span className="agent-card__title">Analysis</span>
            </div>
            <div className="agent-card__body">
                <div className="agent-analyze__content">{inner}</div>
            </div>
        </div>
    );
}

/* --- COMMAND BLOCK ---------------------------------------- */
function CommandBlock({ command }: { command: string }) {
    const handleCopy = () => navigator.clipboard.writeText(command);
    return (
        <div className="agent-command">
            <div className="agent-command__header">
                <span className="agent-command__label">Terminal Command</span>
                <button onClick={handleCopy} className="agent-command__copy">Copy</button>
            </div>
            <div className="agent-command__body">
                <span className="agent-command__prompt">$</span>{command}
            </div>
        </div>
    );
}

/* --- FILE WRITE BLOCK ------------------------------------- */
function FileWriteBlock({ path, content }: { path: string, content: string }) {
    const projectPath = useUIStore(state => state.projectPath);
    const openFile = useEditorStore(state => state.openFile);
    const [written, setWritten] = useState(false);

    useEffect(() => {
        if (projectPath && !written) {
            const fullPath = `${projectPath}/${path}`;
            window.vibe.writeFile(fullPath, content).then(() => {
                setWritten(true);
                openFile(fullPath, content);
            }).catch(() => {});
        }
    }, [projectPath, path, content, written]);

    return (
        <div className={`agent-file-write ${written ? 'agent-file-write--done' : ''}`}>
            <div className={`agent-file-write__dot ${written ? 'agent-file-write__dot--done' : ''}`} />
            <div className="agent-file-write__info">
                <span className="agent-file-write__path">{path}</span>
                <span className={`agent-file-write__status ${written ? 'agent-file-write__status--done' : ''}`}>
                    {written ? 'SAVED' : 'SAVING...'}
                </span>
            </div>
        </div>
    );
}

/* ===========================================================
   MAIN CHAT MESSAGES COMPONENT
   =========================================================== */
export function ChatMessages() {
    const messages = useOllamaStore(state => state.messages);
    const isGenerating = useOllamaStore(state => state.isGenerating);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }, [messages, isGenerating]);

    const renderContent = (content: string) => {
        if (!content) return <span className="chat-empty">...</span>;

        // -- Special prefix-based blocks (unchanged) --
        if (content.startsWith('__TERMINAL_OUTPUT__\n')) {
            const output = content.replace('__TERMINAL_OUTPUT__\n', '');
            return (
                <div className="chat-terminal-output">
                    <div className="chat-terminal-output__label">Terminal Output</div>
                    {output}
                </div>
            );
        }

        if (content.startsWith('__FILE_CONTENTS__')) {
            const firstNewline = content.indexOf('\n');
            const header = content.slice('__FILE_CONTENTS__ '.length, firstNewline);
            const body = content.slice(firstNewline + 1);
            return (
                <div className="chat-file-contents">
                    <div className="chat-file-contents__label"> Reading: {header}</div>
                    {body.slice(0, 600)}{body.length > 600 ? '\n... (truncated for display)' : ''}
                </div>
            );
        }

        if (content.startsWith('__SWARM_LABEL__')) {
            const label = content.replace('__SWARM_LABEL__', '');
            return <div className="chat-swarm-label">{label}</div>;
        }

        // -- Parse agent XML blocks --
        const segments = parseAgentResponse(content);

        // If parser found nothing special, render as plain text
        if (segments.length === 0) return <span>{content}</span>;
        if (segments.length === 1 && segments[0].type === 'text') {
            return <span>{segments[0].content}</span>;
        }

        return (
            <>
                {segments.map((seg, i) => {
                    switch (seg.type) {
                        case 'plan': return <PlanCard key={i} content={seg.content} />;
                        case 'critique': return <CritiqueCard key={i} content={seg.content} />;
                        case 'reflection': return <ReflectionPill key={i} content={seg.content} />;
                        case 'verification': return <VerificationCard key={i} content={seg.content} />;
                        case 'done': return <DoneCard key={i} content={seg.content} />;
                        case 'analyze': return <AnalyzeCard key={i} content={seg.content} />;
                        case 'execute': {
                            const cmd = seg.content.replace(/<\/?execute>/g, '').trim();
                            return <CommandBlock key={i} command={cmd} />;
                        }
                        case 'write_file': {
                            const pathMatch = seg.content.match(/path=['"]([^'"]+)['"]/);
                            const filePath = pathMatch ? pathMatch[1] : 'unknown.txt';
                            const fileContent = seg.content.replace(/<write_file[^>]*>/, '').replace(/<\/write_file>/, '').trim();
                            return <FileWriteBlock key={i} path={filePath} content={fileContent} />;
                        }
                        case 'text':
                            return <span key={i}>{seg.content}</span>;
                        default:
                            return null;
                    }
                })}
            </>
        );
    };

    return (
        <div ref={containerRef} className="chat-messages">
            {messages.map((msg, i) => {
                const isLastAssistant = i === messages.length - 1 && msg.role === 'assistant';
                const isStreaming = isLastAssistant && isGenerating && msg.content === '';
                const isSpecialBlock = msg.content.startsWith('__TERMINAL_OUTPUT__')
                    || msg.content.startsWith('__FILE_CONTENTS__')
                    || msg.content.startsWith('__SWARM_LABEL__');

                return (
                    <React.Fragment key={i}>
                        {isLastAssistant && <ThinkBlock />}
                        {(!isStreaming || msg.content !== '') && (
                            <div className={`chat-bubble chat-bubble--${msg.role} ${isSpecialBlock ? 'chat-bubble--special' : ''}`}>
                                {renderContent(msg.content)}
                            </div>
                        )}
                        {isStreaming && <ThinkingIndicator />}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
```

## `src/renderer/components/ai/HuggingFacePicker.tsx`

```tsx
import { useState, useEffect, useRef } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useHFStore } from '../../store/huggingface';
import { useSettingsStore } from '../../store/settings';

interface HFModel {
    id: string;
    likes: number;
    downloads: number;
    pipeline_tag: string;
    tags: string[];
}

interface Props { onClose: () => void; }

export function HuggingFacePicker({ onClose }: Props) {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState<HFModel[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { pinnedModels, pinModel, unpinModel } = useHFStore();
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const searchRef = useRef<any>(null);

    const searchModels = async (query: string) => {
        setLoading(true);
        setError('');
        try {
            const data = await window.vibe.searchHuggingFaceModels(query || 'instruct', apiKeys);
            setResults(data);
        } catch (e: any) {
            setError(e.message || 'Search failed');
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    // Search on mount with empty query to show popular models
    useEffect(() => {
        searchModels('');
    }, []);

    // Debounced search on input
    useEffect(() => {
        if (searchRef.current) clearTimeout(searchRef.current);
        searchRef.current = setTimeout(() => {
            searchModels(search);
        }, 500);
        return () => clearTimeout(searchRef.current);
    }, [search]);

    const isPinned = (id: string) => pinnedModels.some(m => m.id === id);

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <GlassPanel variant="strong" style={{ width: 580, maxHeight: '82vh', display: 'flex', flexDirection: 'column', zIndex: 1000 }}>
                {/* Header */}
                <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-light)', flexShrink: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>
                                 HuggingFace Models
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                Live search - add models to your selector
                            </div>
                        </div>
                        <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-muted)' }}></button>
                    </div>
                    <div style={{ position: 'relative' }}>
                        <input
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search models (e.g. mistral, llama, coder...)"
                            autoFocus
                            style={{
                                width: '100%',
                                padding: '9px 36px 9px 12px',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                                background: 'rgba(255,255,255,0.9)',
                                fontSize: 13,
                                color: 'var(--text)',
                                outline: 'none',
                            }}
                        />
                        {loading && (
                            <div style={{
                                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                width: 14, height: 14, border: '2px solid var(--accent)', borderTopColor: 'transparent',
                                borderRadius: '50%', animation: 'spin 1s linear infinite'
                            }} />
                        )}
                    </div>
                    {error && <div style={{ marginTop: 6, fontSize: 12, color: 'var(--error)' }}>! {error}</div>}
                </div>

                {/* Results */}
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {results.length === 0 && !loading && (
                        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                            {error ? 'Search failed - check your connection' : 'No models found'}
                        </div>
                    )}
                    {results.map(model => {
                        const pinned = isPinned(model.id);
                        return (
                            <div key={model.id} style={{
                                padding: '12px 24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid var(--border-light)',
                                background: pinned ? 'rgba(0,102,255,0.03)' : 'transparent',
                                gap: 12,
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {model.id}
                                    </div>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                             {(model.likes || 0).toLocaleString()}
                                        </span>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            v {(model.downloads || 0).toLocaleString()}
                                        </span>
                                        {model.pipeline_tag && (
                                            <span style={{
                                                fontSize: 9, padding: '1px 6px', borderRadius: 4,
                                                background: 'var(--accent-light)', color: 'var(--accent)',
                                                fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5
                                            }}>
                                                {model.pipeline_tag}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => pinned
                                        ? unpinModel(model.id)
                                        : pinModel({ id: model.id, name: model.id.split('/').pop() || model.id })
                                    }
                                    style={{
                                        padding: '5px 14px',
                                        borderRadius: 'var(--radius-md)',
                                        border: pinned ? '1px solid var(--error)' : '1px solid var(--accent)',
                                        background: pinned ? 'rgba(224,48,80,0.06)' : 'var(--accent-light)',
                                        color: pinned ? 'var(--error)' : 'var(--accent)',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        flexShrink: 0,
                                        transition: 'all 0.15s',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {pinned ? 'Remove' : '+ Add'}
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div style={{
                    padding: '12px 24px',
                    borderTop: '1px solid var(--border-light)',
                    flexShrink: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        {pinnedModels.length} model{pinnedModels.length !== 1 ? 's' : ''} added
                        {!apiKeys?.hf && '  Add HF token in Settings for more results'}
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '7px 20px',
                            background: 'var(--accent-gradient)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer',
                            fontWeight: 600,
                            fontSize: 13
                        }}
                    >
                        Done
                    </button>
                </div>
            </GlassPanel>
        </div>
    );
}
```

## `src/renderer/components/ai/ModelCapabilities.tsx`

```tsx
import { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';
import type { ModelCapability } from '../../../shared/types';

export const ModelCapabilities = () => {
    const selected = useOllamaStore(s => s.selectedModel);
    const caps: ModelCapability = useOllamaStore(
        s => s.modelCapabilities[selected] ?? {}
    );
    const thinkEnabled = useOllamaStore(s => s.thinkEnabled);
    const thinkLevel = useOllamaStore(s => s.thinkLevel);
    const setThinkEnabled = useOllamaStore(s => s.setThinkEnabled);
    const setThinkLevel = useOllamaStore(s => s.setThinkLevel);
    const [showLevels, setShowLevels] = useState(false);

    // Don't render anything if no capabilities
    if (!caps.think && !caps.vision && !caps.tools) return null;

    const levels: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high'];
    const levelBudgets = { low: 2048, medium: 8192, high: 16000 };

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>

            {/* THINK BUTTON */}
            {caps.think && (
                <div style={{ position: 'relative' }}>
                    <button
                        onClick={() => {
                            if (caps.thinkBudget === 'tiered') {
                                setShowLevels(s => !s);
                                if (!thinkEnabled) setThinkEnabled(true);
                            } else {
                                setThinkEnabled(!thinkEnabled);
                                setShowLevels(false);
                            }
                        }}
                        title={thinkEnabled ? 'Thinking ON' : 'Enable thinking'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            padding: '4px 8px',
                            borderRadius: 6,
                            border: `1px solid ${thinkEnabled
                                ? 'var(--accent)' : 'var(--border)'}`,
                            background: thinkEnabled
                                ? 'var(--accent-light)' : 'transparent',
                            color: thinkEnabled
                                ? 'var(--accent)' : 'var(--text-muted)',
                            fontSize: 11,
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                    >
                        
                        {caps.thinkBudget === 'tiered' && thinkEnabled && (
                            <span style={{
                                textTransform: 'uppercase',
                                letterSpacing: 0.5
                            }}>
                                {thinkLevel}
                            </span>
                        )}
                        {caps.thinkBudget !== 'tiered' && (
                            <span>{thinkEnabled ? 'ON' : 'Think'}</span>
                        )}
                    </button>

                    {/* Level picker - tiered models only */}
                    {caps.thinkBudget === 'tiered' && showLevels && (
                        <>
                            <div
                                onClick={() => setShowLevels(false)}
                                style={{ position: 'fixed', inset: 0, zIndex: 98 }}
                            />
                            <div style={{
                                position: 'absolute',
                                bottom: 'calc(100% + 8px)',
                                left: 0,
                                zIndex: 99,
                                background: '#fff',
                                border: '1px solid var(--border)',
                                borderRadius: 8,
                                boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                                overflow: 'hidden',
                                minWidth: 140,
                            }}>
                                <div style={{
                                    padding: '8px 12px 4px',
                                    fontSize: 10,
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    textTransform: 'uppercase',
                                    letterSpacing: 1
                                }}>
                                    Thinking Budget
                                </div>
                                {levels.map(level => (
                                    <button
                                        key={level}
                                        onClick={() => {
                                            setThinkLevel(level);
                                            setThinkEnabled(true);
                                            setShowLevels(false);
                                        }}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            width: '100%',
                                            padding: '7px 12px',
                                            background: thinkLevel === level
                                                ? 'var(--accent-light)' : 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            fontWeight: thinkLevel === level ? 700 : 500,
                                            color: thinkLevel === level
                                                ? 'var(--accent)' : 'var(--text)',
                                            textAlign: 'left',
                                            textTransform: 'capitalize',
                                        }}
                                    >
                                        <span>{level}</span>
                                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                            {(levelBudgets[level] / 1000).toFixed(0)}k tokens
                                        </span>
                                    </button>
                                ))}
                                <div style={{
                                    borderTop: '1px solid var(--border-light)',
                                    padding: '6px 12px'
                                }}>
                                    <button
                                        onClick={() => {
                                            setThinkEnabled(false);
                                            setShowLevels(false);
                                        }}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 11,
                                            color: 'var(--error)',
                                            fontWeight: 600,
                                            padding: 0
                                        }}
                                    >
                                        Turn off
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* VISION BADGE - shows when model supports images */}
            {caps.vision && (
                <div
                    title="This model can see images"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '4px 7px',
                        borderRadius: 6,
                        border: '1px solid rgba(0,168,112,0.3)',
                        background: 'rgba(0,168,112,0.06)',
                        color: 'var(--green)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'default',
                    }}
                >
                     Vision
                </div>
            )}

            {/* TOOLS BADGE - shows when model supports function calling */}
            {caps.tools && (
                <div
                    title="This model supports tool calling"
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        padding: '4px 7px',
                        borderRadius: 6,
                        border: '1px solid rgba(230,138,0,0.3)',
                        background: 'rgba(230,138,0,0.06)',
                        color: 'var(--warn)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'default',
                    }}
                >
                     Tools
                </div>
            )}

        </div>
    );
};
```

## `src/renderer/components/ai/ModelSelector.tsx`

```tsx
import { useEffect, useMemo, useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { useSwarmStore } from '../../store/swarms';
import { getModelTags } from '../../utils/tags';
import { AgentManager } from '../layout/AgentManager';
import { OLLAMA_ONLY_MODELS } from '../../../shared/constants';
import { useHFStore } from '../../store/huggingface';
import { HuggingFacePicker } from './HuggingFacePicker';

interface Props { onClose: () => void; }

export function ModelSelector({ onClose }: Props) {
    const models = useOllamaStore(state => state.models);
    const selectedModel = useOllamaStore(state => state.selectedModel);
    const setSelectedModel = useOllamaStore(state => state.setSelectedModel);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const swarms = useSwarmStore(state => state.swarms);
    const [showAgentManager, setShowAgentManager] = useState(false);
    const [showHFPicker, setShowHFPicker] = useState(false);
    const { pinnedModels } = useHFStore();
    const [loadedModels, setLoadedModels] = useState<string[]>([]);
    const [openRouterModels, setOpenRouterModels] = useState<Array<{
        id: string;
        label: string;
        contextWindow: number | null;
        inputPer1M: number | null;
        outputPer1M: number | null;
        supportsTools: boolean;
        supportsVision: boolean;
    }>>([]);
    const [openRouterSort, setOpenRouterSort] = useState<'recommended' | 'cheapest-in' | 'cheapest-out' | 'largest-context'>('recommended');
    const [openRouterQuery, setOpenRouterQuery] = useState('');
    const [toolsOnly, setToolsOnly] = useState(false);
    const [visionOnly, setVisionOnly] = useState(false);
    const [cloudQuery, setCloudQuery] = useState('');
    const [cloudSort, setCloudSort] = useState<'a-z' | 'z-a' | 'provider'>('a-z');
    const [cloudProvider, setCloudProvider] = useState<'all' | 'gemini' | 'claude' | 'openai' | 'deepseek' | 'groq' | 'ofox'>('all');
    const [ofoxModels, setOfoxModels] = useState<Array<{ id: string; label: string }>>([]);

    // Fetch which models are currently loaded in VRAM
    useEffect(() => {
        const fetchLoaded = async () => {
            try {
                const loaded = await window.vibe.getLoadedModels();
                setLoadedModels(loaded);
            } catch { }
        };
        fetchLoaded();
        const interval = setInterval(fetchLoaded, 10000);
        return () => clearInterval(interval);
    }, []);

    // Fetch OfoxAI models when API key is set
    useEffect(() => {
        if (!apiKeys.ofox) { setOfoxModels([]); return; }
        window.vibe.listOfoxModels(apiKeys).then(models => setOfoxModels(models || [])).catch(() => setOfoxModels([]));
    }, [apiKeys.ofox, apiKeys.ofoxBase]);

    // -----------------------------------------------------------------
    // Two buckets - localonly models and Ollamacloud models.
    // -----------------------------------------------------------------
    const localModels = models.filter(m => !OLLAMA_ONLY_MODELS.has(m));
    const cloudModels = models.filter(m => OLLAMA_ONLY_MODELS.has(m));

    // -----------------------------------------------------------------
    // Pull the list on mount and then refresh every 30s (so newly
    // pulled models appear without a restart).
    // -----------------------------------------------------------------
    useEffect(() => {
        const load = () => {
            window.vibe.listModels().then((m: any) => useOllamaStore.getState().setModels(m));
        };
        load();
        const interval = setInterval(load, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const loadOpenRouter = async () => {
            try {
                const rows = await window.vibe.listOpenRouterModels(apiKeys);
                setOpenRouterModels(rows || []);
            } catch {
                setOpenRouterModels([]);
            }
        };
        loadOpenRouter();
    }, [apiKeys.openrouter]);

    const cloudRoster = [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'gemini' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'gemini' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', provider: 'gemini' },
        { id: 'claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet', provider: 'claude' },
        { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
        { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
        { id: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'deepseek' },
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Groq)', provider: 'groq' }
    ];

    const baseCloudModels = cloudRoster.filter(m => !!apiKeys[m.provider as keyof typeof apiKeys]);
    const ofoxMappedModels = apiKeys.ofox
        ? (ofoxModels.length > 0
            ? ofoxModels.map(m => ({ id: m.id, name: m.label, provider: 'ofox' }))
            : [
                { id: 'ofox:gpt-4o', name: 'GPT-4o (OfoxAI)', provider: 'ofox' },
                { id: 'ofox:claude-3-7-sonnet-20250219', name: 'Claude 3.7 Sonnet (OfoxAI)', provider: 'ofox' },
                { id: 'ofox:deepseek-chat', name: 'DeepSeek V3 (OfoxAI)', provider: 'ofox' }
            ])
        : [];
    const availableCloudModels = [...baseCloudModels, ...ofoxMappedModels];

    const filteredCloudModels = useMemo(() => {
        let rows = [...availableCloudModels];

        const q = cloudQuery.trim().toLowerCase();
        if (q) {
            rows = rows.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.id.toLowerCase().includes(q) ||
                r.provider.toLowerCase().includes(q)
            );
        }

        if (cloudProvider !== 'all') {
            rows = rows.filter(r => r.provider === cloudProvider);
        }

        if (cloudSort === 'z-a') {
            rows.sort((a, b) => b.name.localeCompare(a.name));
        } else if (cloudSort === 'provider') {
            rows.sort((a, b) => a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
        } else {
            rows.sort((a, b) => a.name.localeCompare(b.name));
        }

        return rows;
    }, [availableCloudModels, cloudQuery, cloudSort, cloudProvider]);

    const renderModelItem = (m: { name?: string, id?: string, label?: string }, isSwarm = false) => {
        const id = m.id || m.name || '';
        const displayName = m.label || m.name || m.id;
        const isSelected = selectedModel === id;
        const isLoaded = loadedModels.some(lm =>
            lm.toLowerCase().includes(id.toLowerCase()) ||
            id.toLowerCase().includes(lm.toLowerCase())
        );
        return (
            <div key={id} onClick={() => { setSelectedModel(id); onClose(); }} style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isSelected ? 'var(--accent-light)' : 'transparent', borderBottom: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? 'var(--accent)' : 'transparent', border: isSelected ? 'none' : '1px solid var(--accent)' }} />
                    <span style={{ fontSize: 13, fontWeight: isSelected ? (isSwarm ? 700 : 600) : 500, color: isSwarm ? 'var(--accent)' : 'var(--text)' }}>
                        {displayName}
                    </span>
                    {isLoaded && (
                        <span
                            title="Loaded in memory"
                            style={{
                                width: 6, height: 6,
                                borderRadius: '50%',
                                background: 'var(--green)',
                                display: 'inline-block',
                                marginLeft: 4,
                                boxShadow: '0 0 4px var(--green)',
                            }}
                        />
                    )}
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                    {!isSwarm && getModelTags(id).map(tag => (
                        <span key={tag.label} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: tag.color, background: tag.bg }}>{tag.label}</span>
                    ))}
                    {isSwarm && <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: 'var(--accent)', background: 'var(--accent-light)' }}>SWARM</span>}
                </div>
            </div>
        );
    };

    const formatPrice = (n: number | null) => {
        if (n === null || Number.isNaN(n)) return null;
        if (n < 0.001) return '<$0.001';
        if (n < 1) return `$${n.toFixed(3)}`;
        return `$${n.toFixed(2)}`;
    };

    const filteredOpenRouterModels = useMemo(() => {
        let rows = [...openRouterModels];

        const q = openRouterQuery.trim().toLowerCase();
        if (q) {
            rows = rows.filter(r =>
                r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
            );
        }

        if (toolsOnly) rows = rows.filter(r => r.supportsTools);
        if (visionOnly) rows = rows.filter(r => r.supportsVision);

        if (openRouterSort === 'cheapest-in') {
            rows.sort((a, b) => (a.inputPer1M ?? Number.POSITIVE_INFINITY) - (b.inputPer1M ?? Number.POSITIVE_INFINITY));
        } else if (openRouterSort === 'cheapest-out') {
            rows.sort((a, b) => (a.outputPer1M ?? Number.POSITIVE_INFINITY) - (b.outputPer1M ?? Number.POSITIVE_INFINITY));
        } else if (openRouterSort === 'largest-context') {
            rows.sort((a, b) => (b.contextWindow ?? 0) - (a.contextWindow ?? 0));
        } else {
            rows.sort((a, b) => a.label.localeCompare(b.label));
        }

        return rows;
    }, [openRouterModels, openRouterQuery, toolsOnly, visionOnly, openRouterSort]);

    const renderOpenRouterItem = (m: {
        id: string;
        label: string;
        contextWindow: number | null;
        inputPer1M: number | null;
        outputPer1M: number | null;
        supportsTools: boolean;
        supportsVision: boolean;
    }) => {
        const isSelected = selectedModel === m.id;
        const inPrice = formatPrice(m.inputPer1M);
        const outPrice = formatPrice(m.outputPer1M);

        return (
            <div
                key={m.id}
                onClick={() => { setSelectedModel(m.id); onClose(); }}
                style={{
                    padding: '10px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: isSelected ? 'var(--accent-light)' : 'transparent',
                    borderBottom: '1px solid var(--border-light)'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSelected ? 'var(--accent)' : 'transparent', border: isSelected ? 'none' : '1px solid var(--accent)' }} />
                    <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {m.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <span>{m.contextWindow ? `${m.contextWindow.toLocaleString()} ctx` : 'ctx ?'}</span>
                            <span>{inPrice ? `in ${inPrice}/1M` : 'in ?'}</span>
                            <span>{outPrice ? `out ${outPrice}/1M` : 'out ?'}</span>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: 6, marginLeft: 8 }}>
                    {m.supportsTools && (
                        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: '#1b6c2e', background: 'rgba(27,108,46,0.12)' }}>
                            Tools
                        </span>
                    )}
                    {m.supportsVision && (
                        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 700, padding: '2px 6px', borderRadius: 4, color: '#774000', background: 'rgba(230,138,0,0.14)' }}>
                            Vision
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
            
            {showAgentManager && <AgentManager onClose={() => setShowAgentManager(false)} />}
            {showHFPicker && <HuggingFacePicker onClose={() => setShowHFPicker(false)} />}

            <GlassPanel variant="strong" style={{ position: 'absolute', bottom: 'calc(100% + 12px)', left: 0, right: 0, zIndex: 10, padding: '12px 0', boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' }}>
                
                <div style={{ padding: '4px 16px 12px' }}>
                    <button onClick={() => { setShowAgentManager(true); onClose(); }} style={{ width: '100%', padding: '10px', background: 'var(--accent-light)', color: 'var(--accent)', border: '1px dashed var(--accent)', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 12, transition: 'all 0.2s' }}>
                        + Create Custom Swarm
                    </button>
                </div>

                <div style={{ margin: '4px 0 8px', borderTop: '1px solid var(--border-light)' }} />

                {swarms.length > 0 && (
                    <>
                        <div style={{ padding: '0 16px 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)', fontWeight: 700 }}>Custom Swarms</div>
                        <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {swarms.map(swarm => renderModelItem({ id: swarm.id, label: swarm.name }, true))}
                        </div>
                        <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                    </>
                )}

                <div style={{ padding: '0 16px 8px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Local Models (Free)</div>
                {localModels.length === 0 ? (
                    <div style={{ padding: '8px 16px', fontSize: 13, color: 'var(--text-secondary)' }}>
                        No local Ollama models detected yet. VIBE auto-refreshes this list.
                    </div>
                ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {localModels.map(m => renderModelItem({ id: m, label: m }))}
                    </div>
                )}

                {/* ---------- Ollamacloud models (free) ---------- */}
                {cloudModels.length > 0 && (
                    <>
                        <div style={{ padding: '8px 16px 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)', fontWeight: 700, marginTop: 8 }}>
                            Ollama Cloud (Free)
                        </div>
                        <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                            {cloudModels.map(m => renderModelItem({ id: m, label: `${m} (Ollama Cloud)` }))}
                        </div>
                    </>
                )}
                
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '8px 16px 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--text-muted)', fontWeight: 600 }}>Cloud Models (API)</div>
                {availableCloudModels.length > 0 && (
                    <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                            value={cloudQuery}
                            onChange={e => setCloudQuery(e.target.value)}
                            placeholder="Search Cloud API models..."
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: '#fff',
                                fontSize: 12,
                                color: 'var(--text)',
                                outline: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                                value={cloudSort}
                                onChange={e => setCloudSort(e.target.value as 'a-z' | 'z-a' | 'provider')}
                                style={{
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                    background: '#fff',
                                    fontSize: 11,
                                    color: 'var(--text)'
                                }}
                            >
                                <option value="a-z">Sort: A-Z</option>
                                <option value="z-a">Sort: Z-A</option>
                                <option value="provider">Sort: Provider</option>
                            </select>
                            <select
                                value={cloudProvider}
                                onChange={e => setCloudProvider(e.target.value as 'all' | 'gemini' | 'claude' | 'openai' | 'deepseek' | 'groq')}
                                style={{
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                    background: '#fff',
                                    fontSize: 11,
                                    color: 'var(--text)'
                                }}
                            >
                                <option value="all">Provider: All</option>
                                <option value="gemini">Gemini</option>
                                <option value="claude">Claude</option>
                                <option value="openai">OpenAI</option>
                                <option value="deepseek">DeepSeek</option>
                                <option value="groq">Groq</option>
                                <option value="ofox">OfoxAI</option>
                            </select>
                            <button
                                onClick={() => {
                                    setCloudQuery('');
                                    setCloudSort('a-z');
                                    setCloudProvider('all');
                                }}
                                style={{
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                    background: 'rgba(0,0,0,0.03)',
                                    fontSize: 11,
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear
                            </button>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {filteredCloudModels.length}/{availableCloudModels.length}
                            </span>
                        </div>
                    </div>
                )}
                <div style={{ maxHeight: 250, overflowY: 'auto' }}>
                    {availableCloudModels.length === 0 ? (
                        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>No API keys found. Add them in Settings.</div>
                    ) : (
                        filteredCloudModels.map(m => renderModelItem({ id: m.id, label: m.name }))
                    )}
                </div>

                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '8px 16px 4px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#2f6fec', fontWeight: 700 }}>OpenRouter (Live)</div>
                {!!apiKeys.openrouter && openRouterModels.length > 0 && (
                    <div style={{ padding: '4px 16px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <input
                            value={openRouterQuery}
                            onChange={e => setOpenRouterQuery(e.target.value)}
                            placeholder="Search OpenRouter models..."
                            style={{
                                width: '100%',
                                padding: '6px 8px',
                                borderRadius: 6,
                                border: '1px solid var(--border)',
                                background: '#fff',
                                fontSize: 12,
                                color: 'var(--text)',
                                outline: 'none'
                            }}
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                            <select
                                value={openRouterSort}
                                onChange={e => setOpenRouterSort(e.target.value as 'recommended' | 'cheapest-in' | 'cheapest-out' | 'largest-context')}
                                style={{
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                    background: '#fff',
                                    fontSize: 11,
                                    color: 'var(--text)'
                                }}
                            >
                                <option value="recommended">Sort: A-Z</option>
                                <option value="cheapest-in">Sort: Cheapest Input</option>
                                <option value="cheapest-out">Sort: Cheapest Output</option>
                                <option value="largest-context">Sort: Largest Context</option>
                            </select>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="checkbox" checked={toolsOnly} onChange={e => setToolsOnly(e.target.checked)} />
                                Tools only
                            </label>
                            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="checkbox" checked={visionOnly} onChange={e => setVisionOnly(e.target.checked)} />
                                Vision only
                            </label>
                            <button
                                onClick={() => {
                                    setOpenRouterQuery('');
                                    setOpenRouterSort('recommended');
                                    setToolsOnly(false);
                                    setVisionOnly(false);
                                }}
                                style={{
                                    padding: '5px 8px',
                                    borderRadius: 6,
                                    border: '1px solid var(--border)',
                                    background: 'rgba(0,0,0,0.03)',
                                    fontSize: 11,
                                    color: 'var(--text-muted)',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear
                            </button>
                            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {filteredOpenRouterModels.length}/{openRouterModels.length}
                            </span>
                        </div>
                    </div>
                )}
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                    {!apiKeys.openrouter ? (
                        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>Add OpenRouter key in Settings to load full catalog.</div>
                    ) : openRouterModels.length === 0 ? (
                        <div style={{ padding: '8px 16px', fontSize: 12, color: 'var(--text-secondary)' }}>No OpenRouter models returned.</div>
                    ) : (
                        filteredOpenRouterModels.map(m => renderOpenRouterItem(m))
                    )}
                </div>

                {/* HuggingFace section */}
                <div style={{ margin: '8px 0', borderTop: '1px solid var(--border-light)' }} />
                <div style={{ padding: '8px 16px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', color: '#ff6e00', fontWeight: 700 }}>HuggingFace (Free)</span>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowHFPicker(true); }}
                        style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, border: '1px solid #ff6e00', background: 'rgba(255,110,0,0.06)', color: '#ff6e00', cursor: 'pointer', fontWeight: 600 }}
                    >
                        + Browse
                    </button>
                </div>
                {pinnedModels.length === 0 ? (
                    <div style={{ padding: '6px 16px 10px', fontSize: 12, color: 'var(--text-muted)' }}>
                        No HF models added. Click Browse →
                    </div>
                ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                        {pinnedModels.map(m => renderModelItem({ id: `hf:${m.id}`, label: m.name }))}
                    </div>
                )}
            </GlassPanel>
        </>
    );
}
```

## `src/renderer/components/ai/ThinkBlock.tsx`

```tsx
import React, { useState } from 'react';
import { useOllamaStore } from '../../store/ollama';

export function ThinkBlock() {
    const isThinking = useOllamaStore(state => state.isThinking);
    const thinkingContent = useOllamaStore(state => state.thinkingContent);
    const thinkingElapsed = useOllamaStore(state => state.thinkingElapsed);
    const [expanded, setExpanded] = useState(false);

    if (!isThinking && !thinkingContent) return null;

    return (
        <div style={{ alignSelf: 'flex-start', maxWidth: '92%', marginBottom: 2 }}>
            <button
                onClick={() => !isThinking && setExpanded(e => !e)}
                style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    background: 'transparent', border: 'none',
                    cursor: isThinking ? 'default' : 'pointer',
                    padding: '4px 0', color: 'var(--text-muted)',
                    fontSize: 12, fontFamily: 'var(--font-sans)',
                }}
            >
                {isThinking ? (
                    <div style={{
                        width: 10, height: 10,
                        border: '2px solid var(--accent)', borderTopColor: 'transparent',
                        borderRadius: '50%', animation: 'spin 1s linear infinite', flexShrink: 0,
                    }} />
                ) : (
                    <span style={{ fontSize: 11, opacity: 0.6 }}>{expanded ? '' : ''}</span>
                )}
                <span style={{ fontStyle: 'italic', color: isThinking ? 'var(--accent)' : 'var(--text-muted)' }}>
                    {isThinking ? 'Thinking...' : `Thought for ${thinkingElapsed}s`}
                </span>
            </button>

            {!isThinking && expanded && thinkingContent && (
                <div style={{
                    marginTop: 4, padding: '10px 14px',
                    background: 'rgba(0,102,255,0.03)', border: '1px solid var(--border-light)',
                    borderRadius: 'var(--radius-md)', fontSize: 12, color: 'var(--text-secondary)',
                    lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'var(--font-sans)',
                    maxHeight: 300, overflowY: 'auto',
                }}>
                    {thinkingContent}
                </div>
            )}
        </div>
    );
}
```

## `src/renderer/components/ai/ThinkingIndicator.tsx`

```tsx
import React from 'react';
import { useOllamaStore } from '../../store/ollama';

export function ThinkingIndicator() {
    const agentStep = useOllamaStore(state => state.agentStep);
    const agentMaxSteps = useOllamaStore(state => state.agentMaxSteps);
    const agentStatus = useOllamaStore(state => state.agentStatus);
    const isLooping = agentStep > 0;

    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: isLooping ? 'rgba(230,138,0,0.06)' : 'var(--accent-light)',
            borderRadius: 6,
            color: isLooping ? 'var(--warn)' : 'var(--accent)',
            fontSize: 12,
            border: `1px solid ${isLooping ? 'rgba(230,138,0,0.15)' : 'transparent'}`,
        }}>
            <div style={{
                width: 10,
                height: 10,
                border: `2px solid ${isLooping ? 'var(--warn)' : 'var(--accent)'}`,
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                flexShrink: 0,
            }} />
            <span>
                {agentStatus
                    ? agentStatus
                    : isLooping
                        ? `Agent working... (step ${agentStep}/${agentMaxSteps})`
                        : 'Agent is thinking...'}
            </span>
        </div>
    );
}
```

## `src/renderer/components/auth/LoginScreen.tsx`

```tsx
import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';

interface Props {
    onLogin: () => void;
}

export function LoginScreen({ onLogin }: Props) {
    const [loading, setLoading] = useState(false);

    const handleGoogleLogin = async () => {
        setLoading(true);
        // TODO: implement real Google OAuth flow with backend
        setTimeout(() => {
            setLoading(false);
            onLogin();
        }, 1500);
    };

    return (
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-mesh)' }}>
            <GlassPanel variant="strong" style={{ width: 400, padding: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
                <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 32, letterSpacing: 6, background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', textAlign: 'center', marginBottom: 8 }}>VIBE</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>Agent-first IDE</div>
                </div>

                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <button
                        onClick={handleGoogleLogin}
                        disabled={loading}
                        style={{ width: '100%', padding: '12px 20px', background: loading ? 'rgba(0,0,0,0.05)' : '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'all 0.2s' }}
                    >
                        {loading ? (
                            <div style={{ width: 18, height: 18, border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        ) : (
                            <svg width="18" height="18" viewBox="0 0 18 18">
                                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2.01a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z"/>
                                <path fill="#FBBC05" d="M4.5 10.51a4.8 4.8 0 010-3.02V5.42H1.83a8 8 0 000 7.16l2.67-2.07z"/>
                                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.42L4.5 7.49a4.77 4.77 0 014.48-3.31z"/>
                            </svg>
                        )}
                        {loading ? 'Signing in...' : 'Continue with Google'}
                    </button>

                    <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-faint)' }}>
                        By continuing you agree to the Terms of Service
                    </div>
                </div>

                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', borderTop: '1px solid var(--border-light)', paddingTop: 16, width: '100%' }}>
                    VIBE v0.1.0  Made by Muhammad Saeed
                </div>
            </GlassPanel>
        </div>
    );
}
```

## `src/renderer/components/claude/ChatRail.tsx`

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import type { ProjectRecord, Surface, SessionRecord } from '../../../shared/agent';
import { useAgentRunStore } from '../../store/agentRun';
import { useUIStore } from '../../store/ui';
import { switchSurface, newChat, newChatForProject, newChatInCurrentProject, loadSession } from '../../services/agentClient';
import { pickFolder } from '../../store/folderPicker';
import { uiBus } from '../../utils/uiBus';

// The four IDE surfaces. Same kernel, different tool set + posture + layout.
const SURFACES: { id: Surface; label: string }[] = [
    { id: 'chat', label: 'Chat' }, { id: 'cowork', label: 'Cowork' }, { id: 'code', label: 'Code' }, { id: 'design', label: 'Design' },
];

function timeAgo(iso: string): string {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(s) || s < 0) return '';
    if (s < 60) return 'now';
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
}

export function ChatRail() {
    const surface = useAgentRunStore((s) => s.surface);
    const activeSession = useAgentRunStore((s) => s.sessions[surface]);
    const items = useAgentRunStore((s) => s.items);
    const projectPath = useUIStore((s) => s.projectPath);
    const ollamaConnected = useUIStore((s) => s.ollamaConnected);
    const [projects, setProjects] = useState<ProjectRecord[]>([]);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [query, setQuery] = useState('');

    const refresh = async () => {
        try { setProjects(await window.vibe.kernel.listProjects(surface)); } catch { setProjects([]); }
    };
    useEffect(() => { refresh(); }, [surface, items.length, activeSession]);

    // Expand the current project and the project of the active session so the
    // user always sees where they are.
    useEffect(() => {
        const next: Record<string, boolean> = { ...expanded };
        let changed = false;
        const ensureExpanded = (root: string | null) => {
            const key = root ?? '__none__';
            if (!next[key]) { next[key] = true; changed = true; }
        };
        if (projectPath) ensureExpanded(projectPath);
        const activeProject = projects.find((p) => p.sessions.some((s) => s.id === activeSession));
        if (activeProject) ensureExpanded(activeProject.root);
        if (changed) setExpanded(next);
    }, [activeSession, projects, projectPath]);

    const openFolder = async () => {
        const p = await pickFolder();
        if (p) { await newChatForProject(p); refresh(); }
    };
    const folderName = (p: string | null | undefined) => (p ? p.split(/[/\\]/).filter(Boolean).pop() : null);
    const rename = async (s: SessionRecord) => {
        const t = prompt('Rename conversation', s.title); if (t != null) { await window.vibe.kernel.renameSession(s.id, t); refresh(); }
    };
    const del = async (s: SessionRecord) => {
        await window.vibe.kernel.deleteSession(s.id);
        if (s.id === activeSession) newChatInCurrentProject();
        refresh();
    };

    const filtered = useMemo(() => {
        if (!query) return projects;
        const q = query.toLowerCase();
        return projects
            .map((p) => ({ ...p, sessions: p.sessions.filter((s) => (s.title || '').toLowerCase().includes(q)) }))
            .filter((p) => p.sessions.length > 0 || (p.name || '').toLowerCase().includes(q));
    }, [projects, query]);

    const projectName = projectPath ? projectPath.split(/[/\\]/).pop() : null;

    return (
        <div className="cl-rail">
            <div className="cl-rail__top">
                <button className="cl-newchat" onClick={() => { newChatInCurrentProject(); refresh(); }} title={projectPath ? `New chat in ${folderName(projectPath)}` : 'New chat'}>
                    <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> New chat
                </button>
                <div className="cl-seg">
                    {SURFACES.map((s) => (
                        <button key={s.id} className={`cl-seg__btn ${surface === s.id ? 'cl-seg__btn--active' : ''}`} onClick={() => switchSurface(s.id)}>{s.label}</button>
                    ))}
                </div>
                <input className="cl-input" style={{ height: 32, fontSize: 12.5 }} placeholder="Search projects & chats…" value={query} onChange={(e) => setQuery(e.target.value)} />
                {!projectPath && (
                    <div className="cl-rail__hint">
                        <button className="cl-rail__hint-link" onClick={openFolder}>Open a project folder</button> to keep chats attached.
                    </div>
                )}
            </div>

            <div className="cl-rail__label">Projects</div>
            <div className="cl-rail__list">
                {filtered.length === 0 && (
                    <div style={{ padding: '6px 14px', fontSize: 12, color: 'var(--cl-muted)' }}>{query ? 'No matches' : 'No projects yet'}</div>
                )}
                {filtered.map((project) => (
                    <ProjectNode
                        key={projectKey(project)}
                        project={project}
                        isExpanded={!!expanded[projectKey(project)]}
                        activeSession={activeSession}
                        currentProjectPath={projectPath}
                        onToggle={() => setExpanded((prev) => ({ ...prev, [projectKey(project)]: !prev[projectKey(project)] }))}
                        onActivate={() => { newChatForProject(project.root); refresh(); }}
                        onNewChat={() => { newChatForProject(project.root); refresh(); }}
                        onLoad={(sess) => loadSession(surface, sess.id)}
                        onRename={rename}
                        onDelete={del}
                    />
                ))}
            </div>

            <div className="cl-rail__foot">
                <button onClick={openFolder} title="Open project folder" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120 }}>{projectName ? `📁 ${projectName}` : '📁 Open folder'}</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button onClick={() => uiBus.emit({ t: 'openSchedule' })} title="Scheduled tasks">⏱</button>
                    <button onClick={() => uiBus.emit({ t: 'openProjects' })} title="Project settings">◇</button>
                    <span title={ollamaConnected ? 'Ollama connected' : 'Ollama offline'} style={{ width: 7, height: 7, borderRadius: '50%', background: ollamaConnected ? '#4a9d6b' : '#c96442' }} />
                    <button onClick={() => uiBus.emit({ t: 'openSettings' })} title="Settings">⚙</button>
                </div>
            </div>
        </div>
    );
}

function projectKey(p: ProjectRecord): string {
    return p.root ?? '__none__';
}

interface ProjectNodeProps {
    project: ProjectRecord;
    isExpanded: boolean;
    activeSession?: string;
    currentProjectPath: string | null;
    onToggle: () => void;
    onActivate: () => void;
    onNewChat: () => void;
    onLoad: (s: SessionRecord) => void;
    onRename: (s: SessionRecord) => void;
    onDelete: (s: SessionRecord) => void;
}

function ProjectNode({ project, isExpanded, activeSession, currentProjectPath, onToggle, onActivate, onNewChat, onLoad, onRename, onDelete }: ProjectNodeProps) {
    const isCurrentProject = currentProjectPath === project.root;
    const activateAndToggle = () => {
        if (!isCurrentProject) onActivate();
        onToggle();
    };
    return (
        <div className={`cl-proj ${isCurrentProject ? 'cl-proj--current' : ''}`}>
            <div className="cl-proj__head">
                <button
                    className={`cl-proj__toggle ${isCurrentProject ? 'cl-proj__toggle--active' : ''}`}
                    onClick={activateAndToggle}
                    title={project.root ?? 'Chats not attached to a project'}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
                >
                    <span style={{ fontSize: 10, color: 'var(--cl-muted)', width: 10 }}>{isExpanded ? '▼' : '▶'}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{project.name}</span>
                    <span style={{ fontSize: 10, color: 'var(--cl-muted)', flexShrink: 0 }}>{project.sessions.length}</span>
                </button>
                <button className="cl-proj__act" onClick={onNewChat} title="New chat in this project">+</button>
            </div>
            {isExpanded && (
                <div className="cl-proj__chats">
                    {project.sessions.map((sess) => (
                        <div key={sess.id} className="cl-histrow cl-histrow--nested">
                            <button
                                className={`cl-histitem ${sess.id === activeSession ? 'cl-histitem--active' : ''}`}
                                onClick={() => onLoad(sess)}
                                title={`${sess.title}${sess.projectRoot ? `\n📁 ${sess.projectRoot}` : ''}`}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}
                            >
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sess.title || 'Untitled'}</span>
                                <span style={{ flexShrink: 0, fontSize: 10.5, color: 'var(--cl-muted)' }}>{timeAgo(sess.updatedAt)}</span>
                            </button>
                            <div className="cl-histrow__acts">
                                <button onClick={() => onRename(sess)} title="Rename">✎</button>
                                <button onClick={() => onDelete(sess)} title="Delete">🗑</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
```

## `src/renderer/components/claude/CommandPalette.tsx`

```tsx
import { Overlay } from './Modal';
import React, { useEffect, useMemo, useState } from 'react';
import type { SessionRecord, Surface } from '../../../shared/agent';
import { useAgentRunStore } from '../../store/agentRun';
import { newChatInCurrentProject, switchSurface, loadSession } from '../../services/agentClient';
import { uiBus } from '../../utils/uiBus';

interface Cmd { id: string; label: string; hint?: string; run: () => void; }

export function CommandPalette({ onClose }: { onClose: () => void }) {
    const surface = useAgentRunStore((s) => s.surface);
    const [query, setQuery] = useState('');
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [active, setActive] = useState(0);

    useEffect(() => { window.vibe.kernel.listSessions(surface).then(setSessions).catch(() => setSessions([])); }, [surface]);

    const base: Cmd[] = useMemo(() => [
        { id: 'new', label: 'New chat', hint: 'Ctrl N', run: () => { newChatInCurrentProject(); onClose(); } },
        { id: 'chat', label: 'Switch to Chat', run: () => { switchSurface('chat' as Surface); onClose(); } },
        { id: 'cowork', label: 'Switch to Cowork', run: () => { switchSurface('cowork' as Surface); onClose(); } },
        { id: 'code', label: 'Switch to Code', run: () => { switchSurface('code' as Surface); onClose(); } },
        { id: 'model', label: 'Browse models', run: () => { uiBus.emit({ t: 'openModel' }); onClose(); } },
        { id: 'skills', label: 'Manage skills', run: () => { uiBus.emit({ t: 'openSettings', section: 'skills' }); onClose(); } },
        { id: 'connectors', label: 'Manage connectors (MCP)', run: () => { uiBus.emit({ t: 'openSettings', section: 'connectors' }); onClose(); } },
        { id: 'schedule', label: 'Scheduled tasks', run: () => { uiBus.emit({ t: 'openSchedule' }); onClose(); } },
        { id: 'projects', label: 'Project settings', run: () => { uiBus.emit({ t: 'openProjects' }); onClose(); } },
        { id: 'settings', label: 'Settings', hint: 'Ctrl ,', run: () => { uiBus.emit({ t: 'openSettings' }); onClose(); } },
    ], [onClose]);

    const sessionCmds: Cmd[] = sessions.map((s) => ({ id: 's:' + s.id, label: s.title || 'Untitled', hint: 'chat', run: () => { loadSession(surface, s.id); onClose(); } }));
    const all = [...base, ...sessionCmds];
    const q = query.toLowerCase();
    const filtered = q ? all.filter((c) => c.label.toLowerCase().includes(q)) : all;

    useEffect(() => { setActive(0); }, [query]);

    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal" style={{ width: 560, maxWidth: '92vw', maxHeight: '70vh' }} onClick={(e) => e.stopPropagation()}>
                <div className="cl-mp__search" style={{ borderBottom: '0.5px solid var(--cl-border-soft)' }}>
                    <input autoFocus className="cl-input" placeholder="Type a command or search chats…" value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
                            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
                            else if (e.key === 'Enter') { e.preventDefault(); filtered[active]?.run(); }
                            else if (e.key === 'Escape') onClose();
                        }} />
                </div>
                <div className="cl-mp__list">
                    {filtered.map((c, i) => (
                        <div key={c.id} className={`cl-mp__row ${i === active ? 'cl-mp__row--active' : ''}`} onMouseEnter={() => setActive(i)} onClick={c.run}>
                            <span className="cl-mp__name">{c.label}</span>
                            {c.hint && <span className="cl-mp__meta">{c.hint}</span>}
                        </div>
                    ))}
                    {filtered.length === 0 && <div className="cl-empty">No matches</div>}
                </div>
            </div>
        </Overlay>
    );
}
```

## `src/renderer/components/claude/Markdown.tsx`

```tsx
import React from 'react';

/* Markdown -> React (no deps). Blocks Claude commonly emits: fenced code with
   lightweight highlighting + copy, GFM tables, task lists, nested lists,
   headings, blockquotes, hr, inline bold/italic/code/links. */

const KEYWORDS = new Set(('const let var function return if else for while do switch case break continue class extends new import from export default async await try catch finally throw typeof instanceof void this super yield in of null true false undefined def elif except with lambda pass raise fn pub struct enum impl match use mut public private static final interface type namespace')
    .split(' '));

function highlight(code: string): React.ReactNode[] {
    const out: React.ReactNode[] = [];
    const re = /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d._]*\b)|([A-Za-z_$][\w$]*)/g;
    let last = 0; let m: RegExpExecArray | null; let i = 0;
    while ((m = re.exec(code)) !== null) {
        if (m.index > last) out.push(code.slice(last, m.index));
        if (m[1]) out.push(<span key={i} className="tok-com">{m[1]}</span>);
        else if (m[2]) out.push(<span key={i} className="tok-str">{m[2]}</span>);
        else if (m[3]) out.push(<span key={i} className="tok-num">{m[3]}</span>);
        else if (m[4]) {
            if (KEYWORDS.has(m[4])) out.push(<span key={i} className="tok-kw">{m[4]}</span>);
            else if (code[re.lastIndex] === '(') out.push(<span key={i} className="tok-fn">{m[4]}</span>);
            else out.push(m[4]);
        }
        last = re.lastIndex; i++;
    }
    if (last < code.length) out.push(code.slice(last));
    return out;
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
    const [copied, setCopied] = React.useState(false);
    const copy = () => { navigator.clipboard?.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); };
    return (
        <div className="cl-code">
            <div className="cl-code__bar">
                <span className="cl-code__lang">{lang || 'code'}</span>
                <button className="cl-code__copy" onClick={copy}>{copied ? 'copied' : 'copy'}</button>
            </div>
            <pre><code>{highlight(code)}</code></pre>
        </div>
    );
}

/** Add a viewBox when the svg only has width/height, so CSS scaling scales
    instead of cropping. */
function ensureViewBox(code: string): string {
    const open = code.match(/<svg[^>]*>/i)?.[0];
    if (!open || /viewBox=/i.test(open)) return code;
    const w = open.match(/width\s*=\s*"([\d.]+)/i)?.[1];
    const h = open.match(/height\s*=\s*"([\d.]+)/i)?.[1];
    if (!w || !h) return code;
    return code.replace(open, open.replace(/<svg/i, `<svg viewBox="0 0 ${w} ${h}"`));
}

/** WYSIWYG svg document: the WHOLE graphic scales to fit its box - the inline
    view and the expanded view must show the same picture, never a crop. */
export function svgFitDoc(code: string): string {
    return `<!doctype html><html><head><style>
html,body{margin:0;height:100%;background:transparent;overflow:hidden}
body{display:grid;place-items:center}
svg{max-width:100%;max-height:100%;width:auto;height:auto}
</style></head><body>${ensureViewBox(code)}</body></html>`;
}

/** Inline-rendered SVG block: sandboxed iframe (no scripts, no origin access). */
function SvgBlock({ code }: { code: string }) {
    const [showCode, setShowCode] = React.useState(false);
    const [expanded, setExpanded] = React.useState(false);
    const srcDoc = svgFitDoc(code);
    return (
        <div className="cl-svgblock">
            <iframe title="svg" sandbox="" srcDoc={srcDoc} />
            <div className="cl-code__bar" style={{ borderTop: '1px solid var(--cl-border-soft)' }}>
                <span className="cl-code__lang">svg</span>
                <div style={{ display: 'flex', gap: 10 }}>
                    <button className="cl-code__copy" onClick={() => setExpanded(true)}>expand</button>
                    <button className="cl-code__copy" onClick={() => setShowCode((v) => !v)}>{showCode ? 'hide code' : 'code'}</button>
                </div>
            </div>
            {showCode && <CodeBlock lang="svg" code={code} />}
            {expanded && (
                <div className="cl-svglightbox" onClick={() => setExpanded(false)}>
                    <iframe title="svg-full" sandbox="" srcDoc={srcDoc} onClick={(e) => e.stopPropagation()} />
                    <button className="cl-svglightbox__close" onClick={() => setExpanded(false)}>Close</button>
                </div>
            )}
        </div>
    );
}

/** Allow only web-safe link schemes. Model output is untrusted: a
    `javascript:`/`data:`/`vbscript:` href would execute in the renderer (which
    holds the powerful `window.vibe` bridge) on click. Returns null to drop. */
function safeHref(url: string): string | null {
    const u = url.trim();
    if (/^(https?:|mailto:)/i.test(u)) return u;      // explicit web schemes
    if (/^[a-z][a-z0-9+.-]*:/i.test(u)) return null;  // any other scheme -> drop
    return u;                                          // relative path / #anchor
}

function inline(text: string, keyBase: string): React.ReactNode[] {
    const nodes: React.ReactNode[] = [];
    const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
    let last = 0; let m: RegExpExecArray | null; let i = 0;
    while ((m = re.exec(text)) !== null) {
        if (m.index > last) nodes.push(text.slice(last, m.index));
        if (m[2] !== undefined) nodes.push(<strong key={`${keyBase}-${i}`}>{m[2]}</strong>);
        else if (m[3] !== undefined) nodes.push(<em key={`${keyBase}-${i}`}>{m[3]}</em>);
        else if (m[4] !== undefined) nodes.push(<code key={`${keyBase}-${i}`} className="inline">{m[4]}</code>);
        else if (m[5] !== undefined) {
            const href = safeHref(m[6]);
            nodes.push(href
                ? <a key={`${keyBase}-${i}`} href={href} target="_blank" rel="noreferrer noopener">{m[5]}</a>
                : <span key={`${keyBase}-${i}`}>{m[5]}</span>);
        }
        last = m.index + m[0].length; i++;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
}

function indentOf(line: string): number { const m = line.match(/^(\s*)/); return m ? Math.floor(m[1].replace(/\t/g, '  ').length / 2) : 0; }

/** Parse a contiguous list block (possibly nested) starting at lines[i]. */
function parseList(lines: string[], start: number, key: number): { node: React.ReactNode; next: number } {
    const isItem = (l: string) => /^\s*([-*+]|\d+\.)\s+/.test(l);
    const ordered = /^\s*\d+\.\s+/.test(lines[start]);
    const baseIndent = indentOf(lines[start]);
    const items: React.ReactNode[] = [];
    let i = start; let li = 0;
    while (i < lines.length && isItem(lines[i]) && indentOf(lines[i]) === baseIndent) {
        let content = lines[i].replace(/^\s*([-*+]|\d+\.)\s+/, '');
        const task = content.match(/^\[([ xX])\]\s+(.*)$/);
        i++;
        // gather nested children (deeper indent)
        const children: React.ReactNode[] = [];
        while (i < lines.length && isItem(lines[i]) && indentOf(lines[i]) > baseIndent) {
            const sub = parseList(lines, i, key + 100 + li);
            children.push(sub.node); i = sub.next;
        }
        if (task) {
            items.push(<li key={li} className="cl-task"><input type="checkbox" checked={task[1].toLowerCase() === 'x'} readOnly /><span>{inline(task[2], `t${key}-${li}`)}{children}</span></li>);
        } else {
            items.push(<li key={li}>{inline(content, `li${key}-${li}`)}{children}</li>);
        }
        li++;
    }
    const anyTask = lines[start] && /^\s*[-*+]\s+\[[ xX]\]/.test(lines[start]);
    const node = ordered ? <ol key={key}>{items}</ol> : <ul key={key} className={anyTask ? 'cl-tasks' : undefined}>{items}</ul>;
    return { node, next: i };
}

export function Markdown({ text }: { text: string }) {
    const blocks: React.ReactNode[] = [];
    const lines = text.split('\n');
    let i = 0; let key = 0;

    while (i < lines.length) {
        const line = lines[i];
        const fence = line.match(/^```(\w*)\s*$/);
        if (fence) {
            const lang = fence[1]; const buf: string[] = []; i++;
            while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
            i++;
            const body = buf.join('\n');
            // SVG renders inline (sandboxed), with the source one toggle away.
            // Sniff content too: models emit svg inside plain/xml/html fences.
            const isSvg = lang.toLowerCase() === 'svg'
                || (/^\s*<svg[\s>]/i.test(body) && ['', 'xml', 'html'].includes(lang.toLowerCase()));
            blocks.push(isSvg
                ? <SvgBlock key={key++} code={body} />
                : <CodeBlock key={key++} lang={lang} code={body} />);
            continue;
        }
        // RAW <svg> dumped straight into prose (no fence at all - very common):
        // collect until </svg> and render it. While still streaming (unclosed),
        // show it as code so it doesn't flash half-parsed markup.
        if (/^\s*<svg[\s>]/i.test(line)) {
            const buf: string[] = [];
            let closed = false;
            while (i < lines.length) {
                buf.push(lines[i]);
                if (/<\/svg>/i.test(lines[i])) { closed = true; i++; break; }
                i++;
            }
            blocks.push(closed
                ? <SvgBlock key={key++} code={buf.join('\n')} />
                : <CodeBlock key={key++} lang="svg" code={buf.join('\n')} />);
            continue;
        }
        // table: header row + separator row of --- | ---
        if (/\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
            const header = splitRow(line);
            i += 2;
            const rows: string[][] = [];
            while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') { rows.push(splitRow(lines[i])); i++; }
            blocks.push(
                <table key={key++}>
                    <thead><tr>{header.map((h, j) => <th key={j}>{inline(h, `th${key}-${j}`)}</th>)}</tr></thead>
                    <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{inline(c, `td${key}-${ri}-${ci}`)}</td>)}</tr>)}</tbody>
                </table>
            );
            continue;
        }
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) { const lvl = h[1].length; const c = inline(h[2], `h${key}`); blocks.push(lvl === 1 ? <h1 key={key++}>{c}</h1> : lvl === 2 ? <h2 key={key++}>{c}</h2> : <h3 key={key++}>{c}</h3>); i++; continue; }
        if (/^(---|\*\*\*|___)\s*$/.test(line)) { blocks.push(<hr key={key++} />); i++; continue; }
        if (/^>\s?/.test(line)) { const buf: string[] = []; while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, '')); i++; } blocks.push(<blockquote key={key++}>{inline(buf.join(' '), `bq${key}`)}</blockquote>); continue; }
        if (/^\s*([-*+]|\d+\.)\s+/.test(line)) { const r = parseList(lines, i, key++); blocks.push(r.node); i = r.next; continue; }
        if (line.trim() === '') { i++; continue; }
        const buf: string[] = [];
        while (i < lines.length && lines[i].trim() !== '' && !/^(```|#{1,3}\s|>\s?|\s*([-*+]|\d+\.)\s|---|\*\*\*|___)/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]))) { buf.push(lines[i]); i++; }
        blocks.push(<p key={key++}>{inline(buf.join('\n'), `p${key}`)}</p>);
    }
    return <div className="cl-md">{blocks}</div>;
}

function splitRow(line: string): string[] {
    return line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
}

/** Split inline <think>...</think> reasoning out of assistant text (handles a mid-stream unclosed tag). */
export function extractThink(text: string): { thinking: string; visible: string } {
    let thinking = '';
    let visible = text.replace(/<think>([\s\S]*?)<\/think>/gi, (_m, t) => { thinking += t; return ''; });
    const m = visible.match(/<think>/i);
    if (m && m.index !== undefined) { thinking += visible.slice(m.index + m[0].length); visible = visible.slice(0, m.index); }
    return { thinking: thinking.trim(), visible: visible.trim() };
}
```

## `src/renderer/components/claude/Modal.tsx`

```tsx
import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Full-window modal overlay, portaled to <body> so no ancestor (transform,
    overflow, pointer-events) can trap it. Backdrop click + Esc close it;
    clicks inside the dialog do not. */
export function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, [onClose]);

    return createPortal(
        <div className="cl-modal-ov" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            {children}
        </div>,
        document.body,
    );
}
```

## `src/renderer/components/claude/ModelPicker.tsx`

```tsx
import { Overlay } from './Modal';
import React, { useEffect, useMemo, useState } from 'react';
import type { CloudModelInfo } from '../../../shared/agent';
import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { fetchCapabilities } from '../../utils/capabilities';

interface Row { id: string; label: string; meta?: string; group: string; tag?: { text: string; color: string; bg: string } }

export function ModelPicker({ onClose }: { onClose: () => void }) {
    const localModels = useOllamaStore((s) => s.models);
    const selected = useOllamaStore((s) => s.selectedModel);
    const apiKeys = useSettingsStore((s) => s.apiKeys);
    const [query, setQuery] = useState('');
    const [cloud, setCloud] = useState<CloudModelInfo[]>([]);
    const [openrouter, setOpenrouter] = useState<{ id: string; label: string }[]>([]);
    const [hf, setHf] = useState<{ id: string }[]>([]);
    const [omni, setOmni] = useState<{ id: string; label: string }[]>([]);
    const [ofox, setOfox] = useState<{ id: string; label: string }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            const [c, or, om, ox] = await Promise.all([
                window.vibe.kernel.cloudModels(apiKeys.ollama || undefined).catch(() => []),
                apiKeys.openrouter ? window.vibe.listOpenRouterModels(apiKeys).catch(() => []) : Promise.resolve([]),
                (apiKeys.omniBase || apiKeys.omni) ? window.vibe.listOmniModels(apiKeys).catch(() => []) : Promise.resolve([]),
                apiKeys.ofox ? window.vibe.listOfoxModels(apiKeys).catch(() => []) : Promise.resolve([]),
            ]);
            setCloud(c);
            useOllamaStore.getState().setCloudModelNames((c as any[]).map((m) => m.name));
            setOpenrouter((or as any[]).map((m) => ({ id: m.id, label: m.label })));
            setOmni((om as any[]).map((m) => ({ id: m.id, label: m.label })));
            setOfox((ox as any[]).map((m) => ({ id: m.id, label: m.label })));
            setLoading(false);
        })();
    }, []);

    // HF search on demand
    useEffect(() => {
        if (query.length < 3) { setHf([]); return; }
        const t = setTimeout(async () => {
            const r = await window.vibe.searchHuggingFaceModels(query, apiKeys).catch(() => []);
            setHf((r as any[]).map((m) => ({ id: m.id })));
        }, 350);
        return () => clearTimeout(t);
    }, [query]);

    const rows = useMemo(() => {
        const out: Row[] = [];
        for (const m of localModels) out.push({ id: m, label: m, group: 'Local (installed)', tag: { text: 'LOCAL', color: '#2f7d47', bg: 'rgba(60,160,90,0.14)' } });
        for (const m of cloud) out.push({ id: m.name, label: m.name, meta: sizeStr(m.size), group: 'Ollama Cloud', tag: { text: 'CLOUD', color: '#c96442', bg: 'rgba(201,100,66,0.12)' } });
        for (const m of openrouter) out.push({ id: `openrouter:${m.id}`, label: m.label || m.id, group: 'OpenRouter', tag: { text: 'OR', color: '#7850dc', bg: 'rgba(120,80,220,0.12)' } });
        for (const m of hf) out.push({ id: `hf:${m.id}`, label: m.id, group: 'Hugging Face', tag: { text: 'HF', color: '#b5731a', bg: 'rgba(230,150,30,0.14)' } });
        for (const m of omni) out.push({ id: m.id, label: m.label, group: 'OmniRoute', tag: { text: 'OMNI', color: '#7a5cff', bg: 'rgba(122,92,255,0.14)' } });
        for (const m of ofox) out.push({ id: m.id, label: m.label, group: 'OfoxAI', tag: { text: 'OFOX', color: '#ff4500', bg: 'rgba(255,69,0,0.14)' } });
        const q = query.toLowerCase();
        return q ? out.filter((r) => r.label.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)) : out;
    }, [localModels, cloud, openrouter, hf, omni, ofox, query]);

    const grouped = useMemo(() => {
        const g: Record<string, Row[]> = {};
        for (const r of rows) (g[r.group] ||= []).push(r);
        return g;
    }, [rows]);

    const pick = async (id: string) => {
        useOllamaStore.getState().setSelectedModel(id);
        try { useOllamaStore.getState().setModelCapability(id, await fetchCapabilities(id)); } catch { /* ignore */ }
        onClose();
    };

    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal cl-mp" onClick={(e) => e.stopPropagation()}>
                <div className="cl-modal__head">
                    <span className="cl-modal__title">Select a model</span>
                    <button className="cl-x" onClick={onClose}>×</button>
                </div>
                <div className="cl-mp__search">
                    <input autoFocus className="cl-input" placeholder="Search local, cloud, OpenRouter, Hugging Face…" value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="cl-mp__list">
                    {loading && <div className="cl-empty">Loading catalogs…</div>}
                    {!loading && rows.length === 0 && <div className="cl-empty">No models. Is Ollama running? Add provider keys in Settings.</div>}
                    {Object.entries(grouped).map(([group, gr]) => (
                        <div key={group}>
                            <div className="cl-mp__group">{group} <span style={{ color: 'var(--cl-muted)', fontWeight: 400 }}>({gr.length})</span></div>
                            {gr.map((r) => (
                                <div key={r.id} className={`cl-mp__row ${r.id === selected ? 'cl-mp__row--active' : ''}`} onClick={() => pick(r.id)}>
                                    {r.tag && <span className="cl-tagpill" style={{ color: r.tag.color, background: r.tag.bg }}>{r.tag.text}</span>}
                                    <span className="cl-mp__name">{r.label}</span>
                                    {r.meta && <span className="cl-mp__meta">{r.meta}</span>}
                                    {r.id === selected && <span style={{ color: 'var(--cl-accent)', fontSize: 12 }}>✓</span>}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </Overlay>
    );
}

function sizeStr(bytes: number): string {
    if (!bytes) return '';
    const gb = bytes / 1e9;
    return gb >= 1 ? `${gb.toFixed(0)}GB` : `${(bytes / 1e6).toFixed(0)}MB`;
}
```

## `src/renderer/components/claude/Projects.tsx`

```tsx
import { Overlay } from './Modal';
import React, { useEffect, useState } from 'react';
import type { FileEntry } from '../../../shared/types';
import { useUIStore } from '../../store/ui';
import { pickFolder } from '../../store/folderPicker';

export function Projects({ onClose }: { onClose: () => void }) {
    const projectPath = useUIStore((s) => s.projectPath);
    const setVibeInstructions = useUIStore((s) => s.setVibeInstructions);
    const [instructions, setInstructions] = useState('');
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        if (!projectPath) return;
        window.vibe.readFile(`${projectPath}/VIBE.md`).then(setInstructions).catch(() => setInstructions(''));
        window.vibe.readDir(projectPath).then((f) => setFiles(f.filter((x) => x.isFile))).catch(() => setFiles([]));
    }, [projectPath]);

    const save = async () => {
        if (!projectPath) return;
        await window.vibe.writeFile(`${projectPath}/VIBE.md`, instructions);
        setVibeInstructions(instructions);
        setSaved(true); setTimeout(() => setSaved(false), 1500);
    };
    const openFolder = async () => { const p = await pickFolder(); if (p) { useUIStore.getState().setProjectPath(p); try { window.vibe.watchFolder(p); } catch {} } };

    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal cl-set" style={{ width: 720, height: '80vh', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                <div className="cl-modal__head"><span className="cl-modal__title">Project</span><button className="cl-x" onClick={onClose}>×</button></div>
                <div className="cl-set__body">
                    {!projectPath ? (
                        <div className="cl-empty">No project open. <button className="cl-pill-btn cl-pill-btn--on" onClick={openFolder} style={{ marginLeft: 8 }}>Open folder</button></div>
                    ) : (
                        <>
                            <div className="cl-field"><label className="cl-field__label">Folder</label><div style={{ fontSize: 12.5, fontFamily: 'var(--cl-mono)', color: 'var(--cl-text-2)' }}>{projectPath}</div></div>
                            <div className="cl-field">
                                <label className="cl-field__label">Custom instructions (VIBE.md)</label>
                                <textarea className="cl-input" style={{ height: 200, padding: 12, lineHeight: 1.5 }} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Project-specific rules the agent follows on every turn — conventions, do's and don'ts, architecture notes…" />
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
                                    <button className="cl-pill-btn cl-pill-btn--on" onClick={save}>Save instructions</button>
                                    {saved && <span style={{ color: '#2f7d47', fontSize: 12.5 }}>Saved</span>}
                                </div>
                            </div>
                            <div className="cl-field">
                                <label className="cl-field__label">Knowledge ({files.length} files in root)</label>
                                <div className="cl-field__hint">All files in the project are available to the agent via read/glob/grep. Top-level: {files.slice(0, 20).map((f) => f.name).join(', ') || '(none)'}</div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </Overlay>
    );
}
```

## `src/renderer/components/claude/ScheduledTasks.tsx`

```tsx
import { Overlay } from './Modal';
import React, { useEffect, useState } from 'react';
import type { ScheduledTask, Surface } from '../../../shared/agent';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';

const PRESETS: { label: string; cron: string }[] = [
    { label: 'Every morning (8am)', cron: '0 8 * * *' },
    { label: 'Hourly', cron: '0 * * * *' },
    { label: 'Every 15 min', cron: '*/' + '15 * * * *' },
    { label: 'Weekdays 9am', cron: '0 9 * * 1-5' },
    { label: 'Weekly (Mon 9am)', cron: '0 9 * * 1' },
];

export function ScheduledTasks({ onClose }: { onClose: () => void }) {
    const [tasks, setTasks] = useState<ScheduledTask[]>([]);
    const [title, setTitle] = useState('');
    const [prompt, setPrompt] = useState('');
    const [cron, setCron] = useState(PRESETS[0].cron);
    const [surface, setSurface] = useState<Surface>('cowork');
    const model = useOllamaStore((s) => s.selectedModel);
    const projectRoot = useUIStore((s) => s.projectPath);

    const load = async () => setTasks(await window.vibe.kernel.scheduleList().catch(() => []));
    useEffect(() => { load(); }, []);

    const add = async () => {
        if (!prompt.trim() || !model) return;
        await window.vibe.kernel.scheduleAdd({ title: title || prompt.slice(0, 40), prompt, cron, surface, model, projectRoot, enabled: true });
        setTitle(''); setPrompt(''); load();
    };
    const toggle = async (t: ScheduledTask) => { await window.vibe.kernel.scheduleUpdate(t.id, { enabled: !t.enabled }); load(); };
    const remove = async (t: ScheduledTask) => { await window.vibe.kernel.scheduleRemove(t.id); load(); };

    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal cl-set" style={{ width: 720, height: '80vh', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                <div className="cl-modal__head"><span className="cl-modal__title">Scheduled tasks</span><button className="cl-x" onClick={onClose}>×</button></div>
                <div className="cl-set__body">
                    <div className="cl-set__sub">Run a prompt automatically on a schedule. Results appear as a new conversation.</div>
                    <div className="cl-field"><label className="cl-field__label">Title</label><input className="cl-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Morning briefing" /></div>
                    <div className="cl-field"><label className="cl-field__label">Prompt</label><textarea className="cl-input" style={{ height: 70, padding: 10 }} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Summarize my open PRs and today's calendar" /></div>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <div className="cl-field" style={{ flex: 1 }}><label className="cl-field__label">When</label>
                            <select className="cl-input" value={cron} onChange={(e) => setCron(e.target.value)}>{PRESETS.map((p) => <option key={p.cron} value={p.cron}>{p.label}</option>)}</select>
                        </div>
                        <div className="cl-field" style={{ width: 150 }}><label className="cl-field__label">Mode</label>
                            <select className="cl-input" value={surface} onChange={(e) => setSurface(e.target.value as Surface)}><option value="chat">Chat</option><option value="cowork">Cowork</option><option value="code">Code</option><option value="design">Design</option></select>
                        </div>
                    </div>
                    <button className="cl-pill-btn cl-pill-btn--on" onClick={add} style={{ marginBottom: 20 }}>Add task</button>

                    {tasks.length === 0 && <div className="cl-empty">No scheduled tasks yet.</div>}
                    {tasks.map((t) => (
                        <div className="cl-catalog-row" key={t.id}>
                            <div className="cl-catalog-row__main">
                                <div className="cl-catalog-row__name">{t.title} <span className="cl-transport" style={{ color: '#7850dc', background: 'rgba(120,80,220,0.12)' }}>{t.cron || t.fireAt}</span></div>
                                <div className="cl-catalog-row__desc">{t.prompt}</div>
                            </div>
                            <button className="cl-pill-btn" onClick={() => toggle(t)}>{t.enabled ? 'Pause' : 'Resume'}</button>
                            <button className="cl-pill-btn cl-pill-btn--danger" onClick={() => remove(t)} style={{ marginLeft: 6 }}>Delete</button>
                        </div>
                    ))}
                </div>
            </div>
        </Overlay>
    );
}
```

## `src/renderer/components/claude/Settings.tsx`

```tsx
import { Overlay } from './Modal';
import React, { useEffect, useState } from 'react';
import type { McpRegistryEntry, SkillCatalogEntry } from '../../../shared/agent';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { useOllamaStore } from '../../store/ollama';
import { ModelPicker } from './ModelPicker';
import { getFallbackCapabilities } from '../../utils/capabilities';

type Section = 'account' | 'providers' | 'models' | 'connectors' | 'skills';
const NAV: { id: Section; label: string; icon: string }[] = [
    { id: 'account', label: 'Account', icon: '◐' },
    { id: 'providers', label: 'API keys', icon: '⚿' },
    { id: 'models', label: 'Models', icon: '◇' },
    { id: 'connectors', label: 'Connectors', icon: '⇄' },
    { id: 'skills', label: 'Skills', icon: '✦' },
];

export function Settings({ onClose, initialSection }: { onClose: () => void; initialSection?: Section }) {
    const [section, setSection] = useState<Section>(initialSection || 'account');
    return (
        <Overlay onClose={onClose}>
            <div className="cl-modal cl-set" onClick={(e) => e.stopPropagation()}>
                <div className="cl-set__nav">
                    <div style={{ fontSize: 15, fontWeight: 600, padding: '4px 12px 12px' }}>Settings</div>
                    {NAV.map((n) => (
                        <button key={n.id} className={`cl-set__navbtn ${section === n.id ? 'cl-set__navbtn--active' : ''}`} onClick={() => setSection(n.id)}>
                            <span style={{ width: 16, textAlign: 'center' }}>{n.icon}</span>{n.label}
                        </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <button className="cl-set__navbtn" onClick={onClose}>Close</button>
                </div>
                <div className="cl-set__body">
                    {section === 'account' && <Account />}
                    {section === 'providers' && <Providers />}
                    {section === 'models' && <Models />}
                    {section === 'connectors' && <Connectors />}
                    {section === 'skills' && <Skills />}
                </div>
            </div>
        </Overlay>
    );
}

function Account() {
    const connected = useUIStore((s) => s.ollamaConnected);
    return (
        <>
            <div className="cl-set__h">Account</div>
            <div className="cl-set__sub">VIBE runs on your local Ollama plus any cloud providers you configure.</div>
            <div className="cl-field">
                <span className="cl-field__label">Ollama</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#4a9d6b' : '#c96442' }} />
                    {connected ? 'Connected to local Ollama' : 'Ollama not detected — start it with `ollama serve`'}
                </div>
                <div className="cl-field__hint">For cloud models, sign in once with <code>ollama signin</code>, then add your API key under API keys → Ollama Cloud.</div>
            </div>
            <DataLocation />
        </>
    );
}

/* Where VIBE keeps projects — change or MOVE it. The pointer is stored
   update-proof in userData; the data lives where you choose. */
function DataLocation() {
    const [path, setPath] = useState<string>('…');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const load = () => window.vibe.dataHome.get().then((d) => setPath(d.path)).catch(() => {});
    useEffect(() => { load(); }, []);
    const change = async (move: boolean) => {
        setMsg(null);
        const p = await window.vibe.dataHome.pick().catch(() => null);
        if (!p) return;
        setBusy(true);
        const res = await window.vibe.dataHome.set(p, move);
        setBusy(false);
        if (res.ok) { setMsg(move ? 'Moved — existing projects were relocated here.' : 'Updated — new work will be created here.'); load(); }
        else setMsg(res.error || 'Could not update the location.');
    };
    return (
        <div className="cl-field">
            <span className="cl-field__label">Data location</span>
            <input className="cl-input" readOnly value={path} style={{ fontFamily: 'monospace', fontSize: 12 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="cl-btn" disabled={busy} onClick={() => change(false)}>Change…</button>
                <button className="cl-btn" disabled={busy} onClick={() => change(true)} title="Pick a new folder and MOVE existing projects into it">{busy ? 'Working…' : 'Move data…'}</button>
            </div>
            <div className="cl-field__hint">Your projects live here. It's outside the app, so updates never wipe it.</div>
            {msg && <div className="cl-field__hint" style={{ color: 'var(--cl-accent)' }}>{msg}</div>}
        </div>
    );
}

const PROVIDERS: { id: string; label: string; hint: string; link?: string }[] = [
    { id: 'ollama', label: 'Ollama Cloud', hint: 'Enables cloud models + web search. Create a key at ollama.com/settings/keys.' },
    { id: 'claude', label: 'Anthropic (Claude)', hint: 'sk-ant-…' },
    { id: 'openai', label: 'OpenAI', hint: 'sk-…' },
    { id: 'gemini', label: 'Google Gemini', hint: 'AIza…' },
    { id: 'deepseek', label: 'DeepSeek', hint: '' },
    { id: 'groq', label: 'Groq', hint: '' },
    { id: 'openrouter', label: 'OpenRouter', hint: 'sk-or-…' },
    { id: 'hf', label: 'Hugging Face', hint: 'hf_…' },
    { id: 'ofox', label: 'OfoxAI (Unified API Gateway)', hint: 'Bearer API key for OfoxAI gateway (app.ofox.ai).' },
    { id: 'omni', label: 'OmniRoute (AI gateway)', hint: 'Optional bearer key for your OmniRoute gateway. Leave blank for a keyless local install.' },
    { id: 'obsidian', label: 'Obsidian Local REST API', hint: 'From the Obsidian plugin settings.' },
];

function Providers() {
    const apiKeys = useSettingsStore((s) => s.apiKeys);
    const setApiKey = useSettingsStore((s) => s.setApiKey);
    return (
        <>
            <div className="cl-set__h">API keys</div>
            <div className="cl-set__sub">Keys are stored locally on your machine and autosave as you type.</div>
            {PROVIDERS.map((p) => (
                <div className="cl-field" key={p.id}>
                    <label className="cl-field__label">{p.label}</label>
                    <input type="password" className="cl-input"
                        value={(apiKeys as any)[p.id] || ''}
                        onChange={(e) => setApiKey(p.id, e.target.value)}
                        placeholder={`Enter ${p.label} key…`} />
                    {p.hint && <div className="cl-field__hint">{p.hint}</div>}
                    {p.id === 'ofox' && <OfoxBaseField />}
                    {p.id === 'omni' && <OmniBaseField />}
                </div>
            ))}
        </>
    );
}

function OfoxBaseField() {
    const base = useSettingsStore((s) => s.apiKeys.ofoxBase);
    const setApiKey = useSettingsStore((s) => s.setApiKey);
    return (
        <div style={{ marginTop: 8 }}>
            <label className="cl-field__label">OfoxAI Base URL</label>
            <input className="cl-input" value={base || ''}
                onChange={(e) => setApiKey('ofoxBase', e.target.value)}
                placeholder="https://api.ofox.ai/v1" />
            <div className="cl-field__hint">The OfoxAI OpenAI-compatible endpoint (include <code>/v1</code>). Default is <code>https://api.ofox.ai/v1</code> (or mirror <code>https://api.ofox.io/v1</code>).</div>
        </div>
    );
}

/* OmniRoute's endpoint is user-configurable (self-hosted gateway), so it needs
   a base-URL field alongside the optional key. Empty falls back to the local
   default the `omniroute` CLI serves on. */
function OmniBaseField() {
    const base = useSettingsStore((s) => s.apiKeys.omniBase);
    const setApiKey = useSettingsStore((s) => s.setApiKey);
    return (
        <div style={{ marginTop: 8 }}>
            <label className="cl-field__label">OmniRoute base URL</label>
            <input className="cl-input" value={base || ''}
                onChange={(e) => setApiKey('omniBase', e.target.value)}
                placeholder="http://localhost:20128/v1" />
            <div className="cl-field__hint">The gateway's OpenAI-compatible endpoint (include <code>/v1</code>). Whatever it serves shows up under “OmniRoute” in the model picker. Start it with <code>omniroute</code>.</div>
        </div>
    );
}

function Models() {
    const selected = useOllamaStore((s) => s.selectedModel);
    const models = useOllamaStore((s) => s.models);
    const cloudNames = useOllamaStore((s) => s.cloudModelNames);
    const caps = useOllamaStore((s) => s.modelCapabilities);
    const visionModel = useSettingsStore((s) => s.visionModel);
    const setVisionModel = useSettingsStore((s) => s.setVisionModel);
    const [pick, setPick] = useState(false);

    const allModels = Array.from(new Set([...models, ...cloudNames]));
    const visionModels = allModels.filter((m) => caps[m]?.vision || caps[m]?.image || getFallbackCapabilities(m).vision);

    return (
        <>
            <div className="cl-set__h">Models</div>
            <div className="cl-set__sub">Choose the default model. Local Ollama models, live Ollama Cloud, OpenRouter, and Hugging Face are all searchable.</div>
            <div className="cl-field">
                <label className="cl-field__label">Default model</label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{selected || 'None selected'}</span>
                    <button className="cl-pill-btn" onClick={() => setPick(true)}>Browse models</button>
                </div>
            </div>
            <div className="cl-field">
                <label className="cl-field__label">Vision fallback model</label>
                <select className="cl-input" value={visionModel} onChange={(e) => setVisionModel(e.target.value)}>
                    <option value="">Auto — first vision-capable model detected</option>
                    {allModels.map((m) => {
                        const v = !!(caps[m]?.vision || caps[m]?.image || getFallbackCapabilities(m).vision);
                        return <option key={m} value={m}>{m}{v ? '  · vision' : ''}</option>;
                    })}
                </select>
                <div className="cl-field__hint">
                    When you attach an image and your main model can’t see, this model describes it and hands the text to your main model. Pick <em>any</em> model you know can see — auto-detection can miss newer cloud models, so override it here.{' '}
                    {visionModels.length
                        ? `Auto-detected: ${visionModels.join(', ')}.`
                        : 'None auto-detected — set one manually (a Gemma 3/4, Llava, Qwen-VL, MiniCPM-V, Pixtral, or Claude/GPT-4o model).'}
                </div>
            </div>
            {pick && <ModelPicker onClose={() => setPick(false)} />}
        </>
    );
}

function Connectors() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<McpRegistryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const search = async (q: string) => {
        setLoading(true);
        const r = await window.vibe.kernel.mcpSearch(q).catch(() => []);
        setResults(r);
        setLoading(false);
    };
    useEffect(() => { search(''); }, []);
    useEffect(() => { const t = setTimeout(() => search(query), 350); return () => clearTimeout(t); }, [query]);

    const add = async (e: McpRegistryEntry) => {
        if (!e.install) return;
        setBusy(e.name);
        const key = e.name.split('/').pop() || e.name;
        await window.vibe.kernel.mcpAdd(key, e.install as any).catch(() => {});
        await search(query);
        setBusy(null);
    };
    const remove = async (e: McpRegistryEntry) => {
        setBusy(e.name);
        await window.vibe.kernel.mcpRemove(e.name.split('/').pop() || e.name).catch(() => {});
        await search(query);
        setBusy(null);
    };

    return (
        <>
            <div className="cl-set__h">Connectors (MCP)</div>
            <div className="cl-set__sub">Live from the official Model Context Protocol registry. Add a server and its tools become available to the agent.</div>
            <input className="cl-input" style={{ marginBottom: 14 }} placeholder="Search connectors (github, filesystem, slack…)" value={query} onChange={(e) => setQuery(e.target.value)} />
            {loading && <div className="cl-empty">Loading registry…</div>}
            {!loading && results.length === 0 && <div className="cl-empty">No connectors found.</div>}
            {results.map((e) => (
                <div className="cl-catalog-row" key={e.name + e.version}>
                    <div className="cl-catalog-row__main">
                        <div className="cl-catalog-row__name">
                            {e.title}
                            <span className="cl-transport" style={{ color: e.transport === 'stdio' ? '#2f7d47' : '#7850dc', background: e.transport === 'stdio' ? 'rgba(60,160,90,0.14)' : 'rgba(120,80,220,0.12)' }}>
                                {e.transport === 'remote' ? 'remote' : 'local'}
                            </span>
                        </div>
                        <div className="cl-catalog-row__desc">{e.description}</div>
                    </div>
                    {e.installed
                        ? <button className="cl-pill-btn cl-pill-btn--danger" disabled={busy === e.name} onClick={() => remove(e)}>Remove</button>
                        : <button className="cl-pill-btn cl-pill-btn--on" disabled={!e.install || busy === e.name} onClick={() => add(e)}>{busy === e.name ? '…' : 'Add'}</button>}
                </div>
            ))}
        </>
    );
}

function Skills() {
    const [items, setItems] = useState<SkillCatalogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);

    const load = async () => { setLoading(true); setItems(await window.vibe.kernel.skillsCatalog().catch(() => [])); setLoading(false); };
    useEffect(() => { load(); }, []);

    const install = async (name: string) => { setBusy(name); await window.vibe.kernel.skillsInstall(name).catch(() => {}); await load(); setBusy(null); };
    const remove = async (name: string) => { setBusy(name); await window.vibe.kernel.skillsRemove(name).catch(() => {}); await load(); setBusy(null); };

    return (
        <>
            <div className="cl-set__h">Skills</div>
            <div className="cl-set__sub">Live from Anthropic's public skills library. Installed skills are auto-loaded and callable by the agent.</div>
            {loading && <div className="cl-empty">Loading skills…</div>}
            {!loading && items.length === 0 && <div className="cl-empty">Couldn't reach the skills library.</div>}
            {items.map((s) => (
                <div className="cl-catalog-row" key={s.name}>
                    <div className="cl-catalog-row__main">
                        <div className="cl-catalog-row__name">{s.name}</div>
                        <div className="cl-catalog-row__desc">{s.description || 'No description'}</div>
                    </div>
                    {s.installed
                        ? <button className="cl-pill-btn cl-pill-btn--danger" disabled={busy === s.name} onClick={() => remove(s.name)}>Remove</button>
                        : <button className="cl-pill-btn cl-pill-btn--on" disabled={busy === s.name} onClick={() => install(s.name)}>{busy === s.name ? '…' : 'Install'}</button>}
                </div>
            ))}
        </>
    );
}
```

## `src/renderer/components/common/ErrorBoundary.tsx`

```tsx
import React from 'react';

interface Props { children: React.ReactNode; label?: string }
interface State { error: Error | null }

/**
 * Catches render/runtime errors in a subtree and shows them INSTEAD of letting
 * the exception unmount the whole React root (which is why a single bad render
 * — e.g. mapping over an undefined array — used to blank the entire window).
 * In the happy path it renders children directly, so it adds no DOM node and
 * doesn't disturb flex/grid layouts.
 */
export class ErrorBoundary extends React.Component<Props, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State { return { error }; }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        // Route to the console (mirrored into the VIBE debug-log window) rather
        // than silently white-screening.
        console.error(`[ErrorBoundary${this.props.label ? ` · ${this.props.label}` : ''}]`, error?.message, info?.componentStack);
    }

    reset = () => this.setState({ error: null });

    render() {
        const { error } = this.state;
        if (!error) return this.props.children;
        return (
            <div style={{ padding: 20, overflow: 'auto', fontFamily: 'var(--cl-mono, ui-monospace, monospace)', color: 'var(--cl-text, #ddd)' }}>
                <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--cl-accent, #c96442)' }}>
                    {this.props.label ? `${this.props.label} hit an error` : 'This view hit an error'}
                </div>
                <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', marginBottom: 12, opacity: 0.85 }}>
                    {String(error?.stack || error?.message || error)}
                </div>
                <button className="cl-winbtn" style={{ width: 'auto', padding: '4px 12px' }} onClick={this.reset}>
                    Reload this view
                </button>
            </div>
        );
    }
}
```

## `src/renderer/components/common/FolderPicker.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { useFolderPicker } from '../../store/folderPicker';

/* In-app folder picker — replaces the native OS dialog (which fails under sudo,
   where root has no DBus session bus / xdg-desktop-portal). Navigates directories
   via fs.readdir in the main process, can create a folder, and returns the chosen
   absolute path. Works whether the app runs as root or the desktop user. */

const btn: React.CSSProperties = {
    background: 'var(--cl-bg-2, #23232c)', color: 'var(--cl-text, #e6e6ea)',
    border: '1px solid var(--cl-border-soft, #33333f)', borderRadius: 8,
    padding: '6px 10px', fontSize: 12, cursor: 'pointer',
};

export function FolderPicker(): React.ReactElement | null {
    const open = useFolderPicker((s) => s.open);
    const done = useFolderPicker((s) => s.done);
    const [cur, setCur] = useState('');
    const [parent, setParent] = useState<string | null>(null);
    const [dirs, setDirs] = useState<{ name: string; path: string }[]>([]);
    const [newName, setNewName] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    const load = async (p?: string): Promise<void> => {
        setErr('');
        try {
            const r = await window.vibe.listDirs(p);
            setCur(r.path); setParent(r.parent); setDirs(r.dirs);
        } catch (e: any) { setErr(e?.message || 'Failed to list directory'); }
    };

    useEffect(() => { if (open) { setNewName(''); setBusy(false); load(); } }, [open]);
    if (!open) return null;

    const choosePath = async (target: string): Promise<void> => {
        setBusy(true); setErr('');
        try { const p = await window.vibe.setProjectFolder(target); done(p); }
        catch (e: any) { setErr(e?.message || 'Could not open folder'); setBusy(false); }
    };
    const choose = async (): Promise<void> => choosePath(cur);
    const mkdir = async (): Promise<void> => {
        const name = newName.trim(); if (!name) return;
        setBusy(true); setErr('');
        try { const np = await window.vibe.makeDir(cur, name); setNewName(''); await load(np); }
        catch (e: any) { setErr(e?.message || 'Could not create folder'); }
        setBusy(false);
    };

    const overlay: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
    const panel: React.CSSProperties = { width: 580, maxWidth: '92vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column', background: 'var(--cl-bg, #1a1a22)', color: 'var(--cl-text, #e6e6ea)', border: '1px solid var(--cl-border-soft, #33333f)', borderRadius: 12, boxShadow: '0 12px 48px rgba(0,0,0,.5)', overflow: 'hidden' };
    const rowStyle: React.CSSProperties = { padding: '7px 12px', cursor: 'pointer', borderBottom: '1px solid var(--cl-border-soft, #2a2a33)', display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 };
    const inputStyle: React.CSSProperties = { background: 'var(--cl-bg-2, #23232c)', color: 'var(--cl-text, #e6e6ea)', border: '1px solid var(--cl-border-soft, #33333f)', borderRadius: 8, padding: '6px 9px', fontSize: 12 };
    const selectBtn: React.CSSProperties = { ...btn, marginLeft: 'auto', opacity: 0.85, fontSize: 11, padding: '4px 8px' };

    return (
        <div style={overlay} onClick={() => done(null)}>
            <div style={panel} onClick={(e) => e.stopPropagation()}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--cl-border-soft, #2a2a33)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 14 }}>Select a project / engagement folder</strong>
                    <button onClick={() => done(null)} style={{ marginLeft: 'auto', background: 'transparent', color: 'var(--cl-text-2, #9a9aa5)', border: 'none', cursor: 'pointer', fontSize: 16 }}>✕</button>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', gap: 6 }}>
                    <input value={cur} onChange={(e) => setCur(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(cur); }}
                        spellCheck={false} style={{ ...inputStyle, flex: 1, fontFamily: 'monospace' }} />
                    <button onClick={() => load(cur)} style={btn}>Go</button>
                    {parent && <button onClick={() => load(parent)} title="Up one level" style={btn}>↑ Up</button>}
                </div>
                <div style={{ flex: 1, overflow: 'auto', minHeight: 140, borderTop: '1px solid var(--cl-border-soft, #2a2a33)' }}>
                    {dirs.length === 0 && <div style={{ padding: 16, color: 'var(--cl-text-2, #9a9aa5)', fontSize: 12 }}>No subfolders here. Use “Open this folder” to pick the current path, or create one below.</div>}
                    {dirs.map((d) => (
                        <div key={d.path} style={rowStyle}>
                            <span onClick={() => load(d.path)} style={{ display: 'flex', gap: 8, alignItems: 'center', flex: 1, overflow: 'hidden' }} title={`Open ${d.path}`}>
                                <span>📁</span><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                            </span>
                            <button
                                onClick={(e) => { e.stopPropagation(); choosePath(d.path); }}
                                style={selectBtn}
                                title={`Select ${d.path}`}
                            >Select</button>
                        </div>
                    ))}
                </div>
                {err && <div style={{ padding: '6px 12px', color: 'var(--cl-bad, #e06c75)', fontSize: 12 }}>{err}</div>}
                <div style={{ padding: '10px 12px', borderTop: '1px solid var(--cl-border-soft, #2a2a33)', display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') mkdir(); }}
                        placeholder="New folder name…" spellCheck={false} style={{ ...inputStyle, width: 170 }} />
                    <button onClick={mkdir} disabled={!newName.trim() || busy} style={btn}>+ Create</button>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                        <button onClick={() => done(null)} style={btn}>Cancel</button>
                        <button onClick={choose} disabled={busy} style={{ ...btn, background: 'var(--cl-accent, #6c8cff)', color: '#fff', borderColor: 'transparent', fontWeight: 600 }}>Open this folder</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

## `src/renderer/components/common/GlassPanel.tsx`

```tsx
import React from 'react';

interface Props {
    children: React.ReactNode;
    variant?: 'default' | 'strong';
    className?: string;
    style?: React.CSSProperties;
}

export function GlassPanel({ children, variant = 'default', className, style }: Props) {
    const isStrong = variant === 'strong';
    return (
        <div className={className} style={{
            background: isStrong ? 'var(--glass-bg)' : 'var(--panel-bg)',
            backdropFilter: isStrong ? 'var(--glass-blur)' : 'var(--panel-blur)',
            WebkitBackdropFilter: isStrong ? 'var(--glass-blur)' : 'var(--panel-blur)',
            border: isStrong ? 'var(--glass-border)' : 'var(--panel-border)',
            boxShadow: isStrong ? 'var(--glass-shadow)' : 'var(--panel-shadow)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            ...style,
        }}>
            {children}
        </div>
    );
}
```

## `src/renderer/components/editor/EditorPane.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editor';
import { MonacoEditor } from './MonacoEditor';
import { Markdown, svgFitDoc } from '../claude/Markdown';

/** Editor + a Preview/Code toggle for renderable files (markdown, HTML, SVG).
    Markdown and docs default to the rendered view - no more reading a report as
    raw text; code files just show the editor. */
const RENDERABLE = new Set(['md', 'markdown', 'html', 'htm', 'svg']);
const extOf = (path: string | null) => (path ? (path.split('.').pop() || '').toLowerCase() : '');

export function EditorPane() {
    const activeFileId = useEditorStore((s) => s.activeFileId);
    const fileContents = useEditorStore((s) => s.fileContents);
    const e = extOf(activeFileId);
    const canRender = RENDERABLE.has(e);
    const [mode, setMode] = useState<'raw' | 'rendered'>('rendered');

    // Default renderable files to Preview; reassess on every file switch.
    useEffect(() => { setMode(canRender ? 'rendered' : 'raw'); }, [activeFileId, canRender]);

    const content = activeFileId ? (fileContents[activeFileId] ?? '') : '';
    const showRendered = canRender && mode === 'rendered';
    const name = activeFileId ? activeFileId.split(/[/\\]/).pop() : '';

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {canRender && (
                <div className="cl-renderbar">
                    <span className="cl-renderbar__name">{name}</span>
                    <div className="cl-renderbar__toggle">
                        <button className={mode === 'rendered' ? 'on' : ''} onClick={() => setMode('rendered')}>Preview</button>
                        <button className={mode === 'raw' ? 'on' : ''} onClick={() => setMode('raw')}>Code</button>
                    </div>
                </div>
            )}
            <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
                {showRendered ? <RenderedFile ext={e} content={content} /> : <MonacoEditor />}
            </div>
        </div>
    );
}

function RenderedFile({ ext, content }: { ext: string; content: string }) {
    if (ext === 'html' || ext === 'htm') {
        // Sandboxed: scripts run, but no access to the app or the user's data.
        return <iframe title="html-preview" sandbox="allow-scripts" srcDoc={content} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />;
    }
    if (ext === 'svg') {
        return <iframe title="svg-preview" sandbox="" srcDoc={svgFitDoc(content)} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} />;
    }
    // markdown / md
    return (
        <div className="cl-md-preview" style={{ height: '100%', overflow: 'auto', padding: '20px 28px' }}>
            <Markdown text={content} />
        </div>
    );
}
```

## `src/renderer/components/editor/EditorTabs.tsx`

```tsx
import React from 'react';
import { useEditorStore } from '../../store/editor';

export function EditorTabs() {
    const openFiles = useEditorStore(state => state.openFiles);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const setActiveFile = useEditorStore(state => state.setActiveFile);
    const closeFile = useEditorStore(state => state.closeFile);

    return (
        <div style={{
            display: 'flex',
            height: 36,
            background: 'rgba(0,0,0,0.02)',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
            flexShrink: 0
        }}>
            {openFiles.length === 0 && (
                <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    No files open
                </div>
            )}
            {openFiles.map(path => {
                const isActive = activeFileId === path;
                const name = path.split(/[/\\]/).pop() || path;

                return (
                    <div
                        key={path}
                        onClick={() => setActiveFile(path)}
                        style={{
                            padding: '0 12px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 13,
                            fontFamily: 'var(--font-sans)',
                            color: isActive ? 'var(--text)' : 'var(--text-secondary)',
                            background: isActive ? 'var(--accent-light)' : 'transparent',
                            borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                            borderRight: '1px solid var(--border-light)',
                            cursor: 'pointer',
                            minWidth: 100,
                            userSelect: 'none'
                        }}
                    >
                        <span style={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            background: getExtColor(name)
                        }} />
                        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
                        <button
                            onClick={(e) => { e.stopPropagation(); closeFile(path); }}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'inherit',
                                cursor: 'pointer',
                                opacity: 0.5,
                                fontSize: 14,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

function getExtColor(name: string) {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
        case 'ts': case 'tsx': case 'js': case 'jsx': return 'var(--accent)';
        case 'json': return 'var(--warn)';
        case 'css': case 'scss': return '#6b40bf';
        case 'py': return 'var(--green)';
        case 'html': return 'var(--error)';
        default: return 'var(--text-muted)';
    }
}
```

## `src/renderer/components/editor/MonacoEditor.tsx`

```tsx
import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import { useEditorStore } from '../../store/editor';
import { useFileSystem } from '../../hooks/useFileSystem';

self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'typescript' || label === 'javascript') return new tsWorker();
        if (label === 'json') return new jsonWorker();
        if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
        return new editorWorker();
    }
};

monaco.editor.defineTheme('vibe-light', {
    base: 'vs',
    inherit: true,
    rules: [
        { token: 'comment', foreground: '8888a0', fontStyle: 'italic' },
        { token: 'keyword', foreground: '0055cc' },
        { token: 'string', foreground: '00875a' },
        { token: 'number', foreground: 'e68a00' },
        { token: 'type', foreground: '0066ff' },
        { token: 'function', foreground: '6b40bf' },
        { token: 'variable', foreground: '1a1a2e' },
        { token: 'operator', foreground: '4a4a68' },
    ],
    colors: {
        'editor.background': '#00000000',
        'editor.foreground': '#1a1a2e',
        'editor.lineHighlightBackground': '#0066ff08',
        'editor.selectionBackground': '#0066ff18',
        'editorCursor.foreground': '#0066ff',
        'editorLineNumber.foreground': '#aab0c0',
        'editorLineNumber.activeForeground': '#0066ff',
        'editorIndentGuide.background': '#00000008',
        'editorIndentGuide.activeBackground': '#00000015',
        'editorWidget.background': '#ffffff',
        'editorWidget.border': '#e4e5ea',
        'editorSuggestWidget.background': '#ffffff',
        'editorSuggestWidget.border': '#e4e5ea',
        'editorSuggestWidget.selectedBackground': '#0066ff10',
        'scrollbarSlider.background': '#00000012',
        'scrollbarSlider.hoverBackground': '#00000020',
    }
});

function getLanguageFromPath(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
        ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
        json: 'json', md: 'markdown', css: 'css', scss: 'scss', html: 'html',
        py: 'python', rs: 'rust', go: 'go', cpp: 'cpp', c: 'c', h: 'cpp',
        java: 'java', rb: 'ruby', php: 'php', sh: 'shell', bash: 'shell',
        yml: 'yaml', yaml: 'yaml', toml: 'toml', xml: 'xml', sql: 'sql',
        dockerfile: 'dockerfile', makefile: 'makefile',
    };
    return map[ext || ''] || 'plaintext';
}

const models = new Map<string, monaco.editor.ITextModel>();

/** Languages that read better word-wrapped (prose, not code). */
const PROSE_LANGS = new Set(['markdown', 'plaintext']);

/** Push new disk content into an already-open Monaco model (agent edits, external changes). */
export function setModelContent(path: string, content: string) {
    const m = models.get(path);
    if (m && m.getValue() !== content) m.setValue(content);
}

export function MonacoEditor() {
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const fileContents = useEditorStore(state => state.fileContents);
    const updateContent = useEditorStore(state => state.updateContent);
    const { writeFile } = useFileSystem();

    const timeoutRef = useRef<any>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const editor = monaco.editor.create(containerRef.current, {
            theme: 'vibe-light',
            fontSize: 13,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 24,
            letterSpacing: 0.3,
            minimap: { enabled: true, scale: 1, maxColumn: 60, renderCharacters: false, showSlider: 'mouseover' },
            scrollbar: { verticalScrollbarSize: 3, horizontalScrollbarSize: 3, useShadows: false },
            overviewRulerLanes: 0,
            overviewRulerBorder: false,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            automaticLayout: true,
            wordWrap: 'off',
            tabSize: 2,
            formatOnPaste: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            guides: { indentation: true, bracketPairs: true },
        });

        editorRef.current = editor;

        const changeDisposable = editor.onDidChangeModelContent(() => {
            const currentModel = editor.getModel();
            if (!currentModel) return;

            const val = editor.getValue();
            // Find which file is active
            const activeId = useEditorStore.getState().activeFileId;
            if (activeId && models.get(activeId) === currentModel) {
                updateContent(activeId, val);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                timeoutRef.current = setTimeout(() => {
                    writeFile(activeId, val).catch(console.error);
                }, 1000);
            }
        });

        return () => {
            changeDisposable.dispose();
            editor.dispose();
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, [writeFile, updateContent]);

    useEffect(() => {
        if (!editorRef.current) return;

        if (!activeFileId) {
            editorRef.current.setModel(null);
            return;
        }

        const language = getLanguageFromPath(activeFileId);
        let model = models.get(activeFileId);
        if (!model) {
            const content = fileContents[activeFileId] || '';
            model = monaco.editor.createModel(content, language);
            models.set(activeFileId, model);
        }

        if (editorRef.current.getModel() !== model) {
            editorRef.current.setModel(model);
        }
        // Prose (markdown, plain text) reads better wrapped - no more scrolling
        // left/right through a long-line document. Code stays unwrapped so its
        // structure is visible.
        editorRef.current.updateOptions({ wordWrap: PROSE_LANGS.has(language) ? 'on' : 'off' });
    }, [activeFileId, fileContents]);

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    display: activeFileId ? 'block' : 'none'
                }}
            />
            {!activeFileId && (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 48, opacity: 0.1, marginBottom: 16 }}>V</div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>Select a file to start coding</div>
                    </div>
                </div>
            )}
        </div>
    );
}
```

## `src/renderer/components/editor/RunBar.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { useEditorStore } from '../../store/editor';
import { useUIStore } from '../../store/ui';
import { detectRunPlanForFile, executeRunPlan, createRunOverride, type RunPlan } from '../../utils/run';

/** Thin bar above the editor: detected run command + ▶ Run + config escape hatch. */
export function RunBar() {
    const activeFileId = useEditorStore((s) => s.activeFileId);
    const projectPath = useUIStore((s) => s.projectPath);
    const [plan, setPlan] = useState<RunPlan | null>(null);
    const [note, setNote] = useState('');

    useEffect(() => {
        let alive = true;
        setNote('');
        detectRunPlanForFile(projectPath, activeFileId).then((p) => { if (alive) setPlan(p); }).catch(() => { if (alive) setPlan(null); });
        return () => { alive = false; };
    }, [projectPath, activeFileId]);

    const run = () => {
        if (!plan) return;
        if (!executeRunPlan(plan)) setNote('no terminal available');
    };

    const configure = async () => {
        if (!projectPath) { setNote('open a project folder first'); return; }
        try {
            const p = await createRunOverride(projectPath);
            const content = await window.vibe.readFile(p).catch(() => '');
            useEditorStore.getState().openFile(p, content);
            setNote('edit run.json, then reopen a file to refresh');
        } catch { setNote('could not create .vibe/run.json'); }
    };

    return (
        <div className="cl-runbar">
            <button className="cl-runbtn" onClick={run} disabled={!plan} title={plan?.command || 'No runner detected for this project/file'}>▶ Run</button>
            <span className="cl-runlabel" title={plan?.command || ''}>
                {plan ? plan.label : 'no runner detected - set one via run config'}
            </span>
            <span style={{ flex: 1 }} />
            {note && <span className="cl-runlabel">{note}</span>}
            <button className="cl-runcfg" onClick={configure} title="Create .vibe/run.json with a custom command - works for any toolchain on PATH">run config</button>
        </div>
    );
}
```

## `src/renderer/components/filetree/FileTree.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { useUIStore } from '../../store/ui';
import { useSettingsStore } from '../../store/settings';
import { useFileSystem } from '../../hooks/useFileSystem';
import { FileTreeItem } from './FileTreeItem';
import type { FileEntry } from '../../../shared/types';

export function FileTree() {
    const projectPath = useUIStore(state => state.projectPath);
    const setProjectPath = useUIStore(state => state.setProjectPath);
    const setVibeInstructions = useUIStore(state => state.setVibeInstructions);
    const { openFolder, readDir, readFile } = useFileSystem();
    const [entries, setEntries] = useState<FileEntry[]>([]);

    useEffect(() => {
        if (!projectPath) return;
        
        // Read immediately on mount / projectPath change
        readDir(projectPath).then(setEntries).catch(console.error);

        // Load project memory
        window.vibe.readMemory(projectPath).then((raw: string | null) => {
            if (raw) {
                try {
                    const memory = JSON.parse(raw);
                    useUIStore.getState().setProjectMemory(memory);
                } catch {
                    useUIStore.getState().setProjectMemory(null);
                }
            } else {
                useUIStore.getState().setProjectMemory(null);
            }
        });
        
        window.vibe.watchFolder(projectPath);
        window.vibe.onFolderChanged(() => {
            readDir(projectPath).then(setEntries).catch(console.error);
        });
    }, [projectPath]);

    // Auto-start background agents for existing project on mount
    useEffect(() => {
        const existingPath = useUIStore.getState().projectPath;
        if (existingPath) {
            const settings = useSettingsStore.getState();
            window.vibe.startBackgroundAgents(existingPath, {
                obsidianKey: settings.apiKeys.obsidian || undefined,
                apiKeys: settings.apiKeys,
                collectorModel: settings.backgroundModels.collector,
                reviewerModel: settings.backgroundModels.reviewer,
            }).catch(() => {});
        }
    }, []);

    const handleOpenFolder = async () => {
        const p = await openFolder();
        if (p) {
            setProjectPath(p);
            const settings = useSettingsStore.getState();
            window.vibe.startBackgroundAgents(p, {
                obsidianKey: settings.apiKeys.obsidian || undefined,
                apiKeys: settings.apiKeys,
                collectorModel: settings.backgroundModels.collector,
                reviewerModel: settings.backgroundModels.reviewer,
            }).catch(() => {});
            try {
                const vibemd = await window.vibe.readFile(`${p}/VIBE.md`);
                useUIStore.getState().setVibeInstructions(vibemd);
            } catch {
                useUIStore.getState().setVibeInstructions(null);
            }
        }
    };

    if (!projectPath) {
        return (
            <div style={{ padding: 20, textAlign: 'center' }}>
                <button
                    onClick={handleOpenFolder}
                    style={{
                        background: 'var(--accent-gradient)',
                        color: '#fff',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                        boxShadow: '0 2px 8px rgba(0,100,255,0.2)'
                    }}
                >
                    Open Folder
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '4px 0' }}>
            {entries.map(entry => (
                <FileTreeItem key={entry.path} entry={entry} level={0} />
            ))}
        </div>
    );
}
```

## `src/renderer/components/filetree/FileTreeItem.tsx`

```tsx
import React, { useState } from 'react';
import type { FileEntry } from '../../../shared/types';
import { useFileSystem } from '../../hooks/useFileSystem';
import { useEditorStore } from '../../store/editor';

interface Props {
    entry: FileEntry;
    level: number;
}

export function FileTreeItem({ entry, level }: Props) {
    const [expanded, setExpanded] = useState(false);
    const [children, setChildren] = useState<FileEntry[]>([]);
    const { readDir, readFile } = useFileSystem();
    const openFile = useEditorStore(state => state.openFile);
    const activeFileId = useEditorStore(state => state.activeFileId);

    const isActive = activeFileId === entry.path;

    const handleClick = async () => {
        if (entry.isDirectory) {
            if (!expanded) {
                const _children = await readDir(entry.path);
                setChildren(_children);
            }
            setExpanded(!expanded);
        } else {
            const content = await readFile(entry.path);
            openFile(entry.path, content);
        }
    };

    const getExtColor = (name: string) => {
        const ext = name.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'ts': case 'tsx': case 'js': case 'jsx': return 'var(--accent)';
            case 'json': return 'var(--warn)';
            case 'css': case 'scss': return '#6b40bf';
            case 'py': return 'var(--green)';
            case 'html': return 'var(--error)';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div>
            <div
                onClick={handleClick}
                style={{
                    padding: `4px 16px 4px ${16 + level * 12}px`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    background: isActive ? 'var(--accent-light)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text)',
                    borderLeft: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                    fontWeight: entry.isDirectory ? 500 : 400,
                    userSelect: 'none'
                }}
                onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'rgba(0,0,0,0.02)';
                }}
                onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
            >
                {entry.isDirectory ? (
                    <span style={{ fontSize: 10, opacity: 0.6, width: 12 }}>{expanded ? '' : ''}</span>
                ) : (
                    <div style={{ width: 12, display: 'flex', justifyContent: 'center' }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: getExtColor(entry.name) }} />
                    </div>
                )}
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
            </div>

            {expanded && entry.isDirectory && (
                <div>
                    {children.map(child => (
                        <FileTreeItem key={child.path} entry={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
}
```

## `src/renderer/components/layout/AgentManager.tsx`

```tsx
import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { useSwarmStore, AgentNode } from '../../store/swarms';
import { useUIStore } from '../../store/ui';
import { useHFStore } from '../../store/huggingface';

interface LatestRepairArtifact {
    id: string;
    generatedAt: string;
    diagnosis?: {
        summary?: string;
        confidence?: number;
    };
    suggestedSwarmPreset?: {
        name: string;
        agents: AgentNode[];
    };
    repairCandidates?: Array<{
        rank: number;
        score: number;
        rationale: string;
        preset: {
            name: string;
            agents: AgentNode[];
        };
    }>;
}

export function AgentManager({ onClose }: { onClose: () => void }) {
    const localModels = useOllamaStore(state => state.models);
    const selectedModel = useOllamaStore(state => state.selectedModel);
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const addSwarm = useSwarmStore(state => state.addSwarm);
    const projectPath = useUIStore(state => state.projectPath);
    const pinnedHFModels = useHFStore(state => state.pinnedModels);
    
    const [swarmName, setSwarmName] = useState('My Custom Swarm');
    const [agents, setAgents] = useState<AgentNode[]>([
        { id: 1, role: 'Architect', model: selectedModel || localModels[0] || 'model:auto' }
    ]);
    const [latestRepair, setLatestRepair] = useState<LatestRepairArtifact | null>(null);
    const [isLoadingRepair, setIsLoadingRepair] = useState(false);
    const [selectedRepairCandidateIndex, setSelectedRepairCandidateIndex] = useState(0);
    const [openRouterModels, setOpenRouterModels] = useState<Array<{ id: string; label: string }>>([]);

    const dynamicModelOptions = React.useMemo(() => {
        const options: Array<{ id: string; label: string; group: 'local' | 'openrouter' | 'hf' | 'other' }> = [];
        const seen = new Set<string>();

        const push = (id: string, label: string, group: 'local' | 'openrouter' | 'hf' | 'other') => {
            const normalized = String(id || '').trim();
            if (!normalized || seen.has(normalized)) return;
            seen.add(normalized);
            options.push({ id: normalized, label: label || normalized, group });
        };

        localModels.forEach((model) => push(model, model, 'local'));
        openRouterModels.forEach((model) => push(model.id, model.label || model.id, 'openrouter'));
        pinnedHFModels.forEach((model) => push(`hf:${model.id}`, `HF ${model.name}`, 'hf'));

        if (selectedModel) push(selectedModel, selectedModel, 'other');
        agents.forEach((agent) => push(agent.model, agent.model, 'other'));
        latestRepair?.repairCandidates?.forEach((candidate) => {
            candidate.preset.agents.forEach((agent) => push(agent.model, agent.model, 'other'));
        });
        latestRepair?.suggestedSwarmPreset?.agents?.forEach((agent) => push(agent.model, agent.model, 'other'));

        return options;
    }, [localModels, openRouterModels, pinnedHFModels, selectedModel, agents, latestRepair]);

    const modelGroups = React.useMemo(() => {
        const local = dynamicModelOptions.filter((m) => m.group === 'local');
        const openrouter = dynamicModelOptions.filter((m) => m.group === 'openrouter');
        const hf = dynamicModelOptions.filter((m) => m.group === 'hf');
        const other = dynamicModelOptions.filter((m) => m.group === 'other');
        return { local, openrouter, hf, other };
    }, [dynamicModelOptions]);

    React.useEffect(() => {
        let active = true;

        const loadOpenRouterModels = async () => {
            if (!apiKeys.openrouter) {
                if (active) setOpenRouterModels([]);
                return;
            }

            try {
                const rows = await window.vibe.listOpenRouterModels(apiKeys);
                if (active) {
                    setOpenRouterModels((rows || []).map((row) => ({ id: row.id, label: row.label || row.id })));
                }
            } catch {
                if (active) setOpenRouterModels([]);
            }
        };

        loadOpenRouterModels();
        return () => {
            active = false;
        };
    }, [apiKeys]);

    React.useEffect(() => {
        let active = true;

        const loadLatestRepair = async () => {
            if (!projectPath) {
                if (active) setLatestRepair(null);
                return;
            }

            setIsLoadingRepair(true);
            try {
                const raw = await window.vibe.readFile(`${projectPath}/.vibe/swarm-repairs/latest.json`);
                const parsed = JSON.parse(raw) as LatestRepairArtifact;
                if (active) setLatestRepair(parsed);
                if (active) setSelectedRepairCandidateIndex(0);
            } catch {
                if (active) setLatestRepair(null);
            } finally {
                if (active) setIsLoadingRepair(false);
            }
        };

        loadLatestRepair();
        return () => {
            active = false;
        };
    }, [projectPath]);

    const addAgent = () => {
        const fallback = dynamicModelOptions[0]?.id || selectedModel || 'model:auto';
        setAgents([...agents, { id: Date.now(), role: 'Coder', model: fallback }]);
    };

    const handleSave = () => {
        const swarmId = `swarm-${Date.now()}`;
        addSwarm({ id: swarmId, name: swarmName, agents });
        useOllamaStore.getState().setSelectedModel(swarmId);
        onClose();
    };

    const handleApplyRepairAsPreset = () => {
        const candidates = latestRepair?.repairCandidates || [];
        const preset = candidates[selectedRepairCandidateIndex]?.preset || latestRepair?.suggestedSwarmPreset;
        if (!preset) return;

        const swarmId = `swarm-${Date.now()}`;
        const rebuiltAgents = preset.agents.map((agent, idx) => ({
            ...agent,
            id: idx + 1,
        }));

        addSwarm({
            id: swarmId,
            name: `${preset.name} (${new Date().toLocaleTimeString()})`,
            agents: rebuiltAgents,
        });
        useOllamaStore.getState().setSelectedModel(swarmId);
        onClose();
    };

    const handleLoadRepairIntoCanvas = () => {
        const candidates = latestRepair?.repairCandidates || [];
        const preset = candidates[selectedRepairCandidateIndex]?.preset || latestRepair?.suggestedSwarmPreset;
        if (!preset) return;
        setSwarmName(`${preset.name} (editable)`);
        setAgents(preset.agents.map((agent, idx) => ({ ...agent, id: idx + 1 })));
    };

    const repairCandidates = latestRepair?.repairCandidates || [];
    const activeCandidate = repairCandidates[selectedRepairCandidateIndex] || null;

    return (
        <div style={{ position: 'fixed', inset: 0, zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
            <GlassPanel variant="strong" style={{ width: 800, maxHeight: '90vh', overflowY: 'auto', padding: 32, zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: 16, marginBottom: 24 }}>
                    <div>
                        <h2 style={{ fontSize: 20, margin: '0 0 8px 0', color: 'var(--text)' }}>Swarm Canvas</h2>
                        <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>Design a multi-agent pipeline and save it as a custom model.</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-muted)' }}></button>
                </div>

                <input value={swarmName} onChange={e => setSwarmName(e.target.value)} style={{ fontSize: 16, padding: '12px 16px', borderRadius: 6, border: '1px solid var(--accent)', background: 'rgba(255,255,255,0.5)', outline: 'none', fontWeight: 600, color: 'var(--accent)', marginBottom: 24 }} />

                {(isLoadingRepair || latestRepair?.suggestedSwarmPreset) && (
                    <div style={{
                        border: '1px solid var(--border)',
                        borderRadius: 10,
                        background: 'rgba(0, 102, 255, 0.04)',
                        padding: 14,
                        marginBottom: 18,
                    }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8, color: 'var(--accent)', fontWeight: 700, marginBottom: 8 }}>
                            Latest Swarm Repair
                        </div>
                        {isLoadingRepair && (
                            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Loading latest repair artifact...</div>
                        )}
                        {!isLoadingRepair && latestRepair?.suggestedSwarmPreset && (
                            <>
                                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
                                    {latestRepair.suggestedSwarmPreset.name}
                                </div>
                                {latestRepair.diagnosis?.summary && (
                                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>
                                        {latestRepair.diagnosis.summary}
                                    </div>
                                )}
                                {repairCandidates.length > 0 && (
                                    <div style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                            Candidate (bounded micro-search)
                                        </div>
                                        <select
                                            value={selectedRepairCandidateIndex}
                                            onChange={(e) => setSelectedRepairCandidateIndex(Number(e.target.value))}
                                            style={{
                                                width: '100%',
                                                padding: '7px 8px',
                                                borderRadius: 6,
                                                border: '1px solid var(--border)',
                                                background: '#fff',
                                                color: 'var(--text)',
                                                fontSize: 12,
                                            }}
                                        >
                                            {repairCandidates.map((candidate, idx) => (
                                                <option key={`${candidate.rank}-${idx}`} value={idx}>
                                                    #{candidate.rank} score {candidate.score.toFixed(3)} - {candidate.preset.name}
                                                </option>
                                            ))}
                                        </select>
                                        {activeCandidate?.rationale && (
                                            <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                                                {activeCandidate.rationale}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    <button
                                        onClick={handleApplyRepairAsPreset}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--accent)',
                                            background: 'var(--accent-light)',
                                            color: 'var(--accent)',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            fontWeight: 700,
                                        }}
                                    >
                                        Apply as New Preset
                                    </button>
                                    <button
                                        onClick={handleLoadRepairIntoCanvas}
                                        style={{
                                            padding: '8px 12px',
                                            borderRadius: 6,
                                            border: '1px solid var(--border)',
                                            background: 'rgba(0,0,0,0.02)',
                                            color: 'var(--text-secondary)',
                                            cursor: 'pointer',
                                            fontSize: 12,
                                            fontWeight: 600,
                                        }}
                                    >
                                        Load into Canvas
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
                    {agents.map((agent, index) => (
                        <React.Fragment key={agent.id}>
                            <div style={{ minWidth: 260, background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, position: 'relative' }}>
                                {index > 0 && <button onClick={() => setAgents(agents.filter(a => a.id !== agent.id))} style={{ position: 'absolute', top: 12, right: 12, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer' }}></button>}
                                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 12 }}>NODE {index + 1}</div>
                                
                                <select value={agent.role} onChange={(e) => setAgents(agents.map(a => a.id === agent.id ? { ...a, role: e.target.value } : a))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)', marginBottom: 12 }}>
                                    <option value="Architect">Architect (Planning)</option>
                                    <option value="Coder">Coder (Execution)</option>
                                </select>

                                <select value={agent.model} onChange={(e) => setAgents(agents.map(a => a.id === agent.id ? { ...a, model: e.target.value } : a))} style={{ width: '100%', padding: '8px', borderRadius: 6, border: '1px solid var(--border)' }}>
                                    {modelGroups.local.length > 0 && (
                                        <optgroup label="Local Models">
                                            {modelGroups.local.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </optgroup>
                                    )}
                                    {modelGroups.openrouter.length > 0 && (
                                        <optgroup label="OpenRouter Models">
                                            {modelGroups.openrouter.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </optgroup>
                                    )}
                                    {modelGroups.hf.length > 0 && (
                                        <optgroup label="HuggingFace Models">
                                            {modelGroups.hf.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </optgroup>
                                    )}
                                    {modelGroups.other.length > 0 && (
                                        <optgroup label="Other Available Models">
                                            {modelGroups.other.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                                        </optgroup>
                                    )}
                                </select>
                            </div>
                            {index < agents.length - 1 && <div style={{ color: 'var(--accent)', fontSize: 24 }}>{'→'}</div>}
                        </React.Fragment>
                    ))}
                    <button onClick={addAgent} style={{ minWidth: 150, height: 120, border: '2px dashed var(--border)', borderRadius: 12, background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}>+ Add Node</button>
                </div>

                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
                    <button onClick={handleSave} style={{ padding: '10px 24px', background: 'var(--accent-gradient)', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>Save Swarm Pipeline</button>
                </div>
            </GlassPanel>
        </div>
    );
}
```

## `src/renderer/components/layout/DataHomeSetup.tsx`

```tsx
import React, { useEffect, useState } from 'react';

/* First-run prompt: choose WHERE VIBE keeps projects.
   Shown once per machine (until the data home is chosen). The choice is stored
   in the app's userData (update-proof); the data itself lives where the user
   picks (default ~/Documents/VIBE). Movable later from Settings. */
export function DataHomeSetup({ onDone }: { onDone: () => void }): React.ReactElement {
    const [defaultPath, setDefaultPath] = useState('');
    const [chosen, setChosen] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        window.vibe.dataHome.get().then((d) => setDefaultPath(d.default)).catch(() => {});
    }, []);

    const target = chosen || defaultPath;

    const choose = async (): Promise<void> => {
        try { const p = await window.vibe.dataHome.pick(); if (p) setChosen(p); } catch { /* keep default */ }
    };
    const confirm = async (): Promise<void> => {
        setBusy(true); setErr(null);
        const res = await window.vibe.dataHome.set(target, false);
        setBusy(false);
        if (res.ok) onDone(); else setErr(res.error || 'Could not set the data location.');
    };

    return (
        <div style={overlay}>
            <div style={card}>
                <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: 0.3 }}>Welcome to VIBE</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginTop: 14 }}>Where should VIBE keep your work?</div>
                <p style={{ color: 'var(--cl-text-2, #9aa)', fontSize: 13, lineHeight: 1.55, margin: '8px 0 2px' }}>
                    Your projects live in this folder. It stays in a place you can see and
                    is never wiped by app updates. You can move it any time from Settings.
                </p>
                <div style={pathBox} title={target}>{target || '…'}</div>
                {err && <div style={{ color: '#c96442', fontSize: 12, marginTop: 8 }}>{err}</div>}
                <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
                    <button style={btnGhost} onClick={choose} disabled={busy}>Choose folder…</button>
                    <button style={btnPrimary} onClick={confirm} disabled={busy || !target}>{busy ? 'Setting up…' : 'Use this location'}</button>
                </div>
            </div>
        </div>
    );
}

const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
};
const card: React.CSSProperties = {
    width: 'min(560px, 92vw)', background: 'var(--cl-bg, #16181d)', color: 'var(--cl-text, #e6e6e6)',
    border: '1px solid var(--cl-edge, #2a2d35)', borderRadius: 14, padding: 28, boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
};
const pathBox: React.CSSProperties = {
    marginTop: 14, padding: '10px 12px', borderRadius: 8, background: 'var(--cl-bg-2, #1e2128)',
    border: '1px solid var(--cl-edge, #2a2d35)', fontFamily: 'monospace', fontSize: 12.5,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--cl-text, #e6e6e6)',
};
const btnGhost: React.CSSProperties = {
    padding: '8px 14px', borderRadius: 8, border: '1px solid var(--cl-edge, #2a2d35)',
    background: 'transparent', color: 'var(--cl-text, #e6e6e6)', cursor: 'pointer', fontSize: 13,
};
const btnPrimary: React.CSSProperties = {
    padding: '8px 16px', borderRadius: 8, border: 'none',
    background: 'var(--cl-accent, #c96442)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
};
```

## `src/renderer/components/layout/MainArea.tsx`

```tsx
import React from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { EditorTabs } from '../editor/EditorTabs';
import { MonacoEditor } from '../editor/MonacoEditor';
import { AgentSurface } from '../agent/AgentSurface';

export function MainArea() {
    return (
        <div style={{ flex: 1, display: 'flex', gap: 'var(--gap)', overflow: 'hidden' }}>
            {/* Left: File Viewer / Editor */}
            <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <EditorTabs />
                <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                    <MonacoEditor />
                </div>
            </GlassPanel>

            {/* Right: Agent surfaces (Chat / Cowork / Code) over the native kernel */}
            <GlassPanel style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
                <AgentSurface />
            </GlassPanel>
        </div>
    );
}
```

## `src/renderer/components/layout/MenuBar.tsx`

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { useUIStore } from '../../store/ui';
import { useEditorStore } from '../../store/editor';
import { useOllamaStore } from '../../store/ollama';
import { pickFolder } from '../../store/folderPicker';

interface MenuItem {
    label: string;
    shortcut?: string;
    action?: () => void;
    divider?: boolean;
    disabled?: boolean;
}

interface Menu {
    label: string;
    items: MenuItem[];
}

export function MenuBar() {
    const [openMenu, setOpenMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const projectPath = useUIStore(state => state.projectPath);
    const setProjectPath = useUIStore(state => state.setProjectPath);
    const activeFileId = useEditorStore(state => state.activeFileId);
    const fileContents = useEditorStore(state => state.fileContents);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpenMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    const handleOpenFolder = async () => {
        const p = await pickFolder();
        if (p) setProjectPath(p);
        setOpenMenu(null);
    };

    const handleSaveFile = async () => {
        if (activeFileId && fileContents[activeFileId] !== undefined) {
            await window.vibe.writeFile(activeFileId, fileContents[activeFileId]);
        }
        setOpenMenu(null);
    };

    const handleNewFile = async () => {
        if (!projectPath) return;
        const name = prompt('Enter file name:');
        if (name) {
            await window.vibe.writeFile(`${projectPath}/${name}`, '');
            const content = '';
            useEditorStore.getState().openFile(`${projectPath}/${name}`, content);
        }
        setOpenMenu(null);
    };

    const menus: Menu[] = [
        {
            label: 'File',
            items: [
                { label: 'New File', shortcut: 'Ctrl+N', action: handleNewFile },
                { label: 'Open Folder', shortcut: 'Ctrl+O', action: handleOpenFolder },
                { divider: true, label: '' },
                { label: 'Save', shortcut: 'Ctrl+S', action: handleSaveFile, disabled: !activeFileId },
                { divider: true, label: '' },
                { label: 'Exit', shortcut: 'Alt+F4', action: () => window.vibe.closeWindow() },
            ]
        },
        {
            label: 'Edit',
            items: [
                { label: 'Undo', shortcut: 'Ctrl+Z', action: () => document.execCommand('undo') },
                { label: 'Redo', shortcut: 'Ctrl+Y', action: () => document.execCommand('redo') },
                { divider: true, label: '' },
                { label: 'Cut', shortcut: 'Ctrl+X', action: () => document.execCommand('cut') },
                { label: 'Copy', shortcut: 'Ctrl+C', action: () => document.execCommand('copy') },
                { label: 'Paste', shortcut: 'Ctrl+V', action: () => document.execCommand('paste') },
                { divider: true, label: '' },
                { label: 'Find', shortcut: 'Ctrl+F', action: () => { /* Monaco handles this */ setOpenMenu(null); } },
            ]
        },
        {
            label: 'View',
            items: [
                { label: 'Toggle Sidebar', shortcut: 'Ctrl+B', action: () => {
                    const store = useUIStore.getState();
                    store.setSidebarWidth(store.sidebarWidth === 0 ? 210 : 0);
                    setOpenMenu(null);
                }},
                { label: 'Clear Chat', shortcut: 'Ctrl+L', action: () => { useOllamaStore.getState().clearMessages(); setOpenMenu(null); }},
                { divider: true, label: '' },
                { label: 'Zoom In', shortcut: 'Ctrl++', action: () => { document.body.style.zoom = String(parseFloat(document.body.style.zoom || '1') + 0.1); setOpenMenu(null); }},
                { label: 'Zoom Out', shortcut: 'Ctrl+-', action: () => { document.body.style.zoom = String(parseFloat(document.body.style.zoom || '1') - 0.1); setOpenMenu(null); }},
                { label: 'Reset Zoom', shortcut: 'Ctrl+0', action: () => { document.body.style.zoom = '1'; setOpenMenu(null); }},
            ]
        },
        {
            label: 'Terminal',
            items: [
                { label: 'New Terminal', action: () => {
                    window.vibe.createTerminal(projectPath || undefined);
                    setOpenMenu(null);
                }},
                { label: 'Clear Terminal', action: () => {
                    // Send clear command to active terminal
                    const termId = (window as any).__activeTermId;
                    if (termId) window.vibe.sendTerminalInput(termId, 'cls\r');
                    setOpenMenu(null);
                }},
            ]
        },
        {
            label: 'Help',
            items: [
                { label: 'About VIBE', action: () => { alert('VIBE IDE v0.1.0\nAgent-first IDE by Muhammad Saeed'); setOpenMenu(null); }},
                { label: 'Clear Chat History', action: () => { useOllamaStore.getState().clearMessages(); setOpenMenu(null); }},
            ]
        },
    ];

    return (
        <div ref={menuRef} data-clickable style={{
            display: 'flex',
            alignItems: 'center',
            height: 28,
            padding: '0 8px',
            gap: 0,
            fontSize: 12,
            color: 'var(--text-secondary)',
            background: 'rgba(0,0,0,0.02)',
            borderBottom: '1px solid var(--border-light)',
            flexShrink: 0,
            fontFamily: 'var(--font-sans)',
            position: 'relative',
            zIndex: 50,
        }}>
            {menus.map(menu => (
                <div key={menu.label} style={{ position: 'relative' }}>
                    <button
                        onClick={() => setOpenMenu(openMenu === menu.label ? null : menu.label)}
                        onMouseEnter={() => { if (openMenu) setOpenMenu(menu.label); }}
                        style={{
                            background: openMenu === menu.label ? 'var(--accent-light)' : 'transparent',
                            border: 'none',
                            padding: '4px 10px',
                            cursor: 'pointer',
                            fontSize: 12,
                            color: openMenu === menu.label ? 'var(--accent)' : 'var(--text-secondary)',
                            borderRadius: 4,
                            fontFamily: 'var(--font-sans)',
                            fontWeight: 500,
                        }}
                    >
                        {menu.label}
                    </button>
                    {openMenu === menu.label && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            minWidth: 220,
                            background: '#fff',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                            padding: '4px 0',
                            zIndex: 100,
                        }}>
                            {menu.items.map((item, i) => {
                                if (item.divider) return <div key={i} style={{ height: 1, background: 'var(--border-light)', margin: '4px 0' }} />;
                                return (
                                    <button
                                        key={i}
                                        onClick={() => { if (!item.disabled && item.action) item.action(); }}
                                        disabled={item.disabled}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            width: '100%',
                                            padding: '6px 16px',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: item.disabled ? 'default' : 'pointer',
                                            fontSize: 12,
                                            color: item.disabled ? 'var(--text-faint)' : 'var(--text)',
                                            textAlign: 'left',
                                            fontFamily: 'var(--font-sans)',
                                        }}
                                        onMouseEnter={(e) => { if (!item.disabled) e.currentTarget.style.background = 'var(--accent-light)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                                    >
                                        <span>{item.label}</span>
                                        {item.shortcut && <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>{item.shortcut}</span>}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
```

## `src/renderer/components/layout/SettingsModal.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useSettingsStore } from '../../store/settings';
import { useUIStore } from '../../store/ui';
import { useOllamaStore } from '../../store/ollama';

/* Where VIBE keeps projects. Lets the user change or MOVE the data home
   (the pointer is stored update-proof in userData). */
function DataLocationSection() {
    const [info, setInfo] = useState<{ path: string; default: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const load = () => window.vibe.dataHome.get().then((d) => setInfo({ path: d.path, default: d.default })).catch(() => {});
    useEffect(() => { load(); }, []);
    const change = async (move: boolean) => {
        setMsg(null);
        const p = await window.vibe.dataHome.pick().catch(() => null);
        if (!p) return;
        setBusy(true);
        const res = await window.vibe.dataHome.set(p, move);
        setBusy(false);
        if (res.ok) { setMsg(move ? 'Moved — existing projects were relocated here.' : 'Updated — new work will be created here.'); load(); }
        else setMsg(res.error || 'Could not update the location.');
    };
    const btn: React.CSSProperties = { cursor: 'pointer', width: 'auto', padding: '8px 14px' };
    return (
        <div className="settings-section">
            <h3 className="settings-section__title">Data Location</h3>
            <div className="settings-info-box">
                Where VIBE keeps your projects. It lives outside the app, so updates never wipe it.
            </div>
            <div className="settings-field">
                <label className="settings-field__label">Current location</label>
                <input type="text" readOnly value={info?.path || '…'} className="settings-field__input" style={{ fontFamily: 'monospace', fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="settings-field__input" style={btn} disabled={busy} onClick={() => change(false)}>Change location…</button>
                <button className="settings-field__input" style={btn} disabled={busy} onClick={() => change(true)} title="Pick a new folder and MOVE existing projects into it">{busy ? 'Working…' : 'Move data…'}</button>
            </div>
            {msg && <div style={{ fontSize: 12, color: 'var(--cl-text-2, #9aa)', marginTop: 8 }}>{msg}</div>}
        </div>
    );
}

function ObsidianStatusIndicator({ apiKey }: { apiKey: string }) {
    const [status, setStatus] = React.useState<'unknown' | 'connected' | 'disconnected'>('unknown');

    React.useEffect(() => {
        if (!apiKey) { setStatus('unknown'); return; }
        window.vibe.obsidianPing(apiKey).then(ok => {
            setStatus(ok ? 'connected' : 'disconnected');
        }).catch(() => setStatus('disconnected'));
    }, [apiKey]);

    if (status === 'unknown') return null;

    return (
        <div className="obsidian-status">
            <div className={`obsidian-status__dot obsidian-status__dot--${status}`} />
            {status === 'connected'
                ? 'Obsidian connected - vault ready'
                : 'Obsidian not detected - is the plugin running?'
            }
        </div>
    );
}

export function SettingsModal({ onClose }: { onClose: () => void }) {
    const apiKeys = useSettingsStore(state => state.apiKeys);
    const setApiKey = useSettingsStore(state => state.setApiKey);
    const backgroundModels = useSettingsStore(state => state.backgroundModels);
    const setBackgroundModel = useSettingsStore(state => state.setBackgroundModel);
    const projectPath = useUIStore(state => state.projectPath);
    // Same source as ModelSelector - populated by App.tsx on startup
    const ollamaModels = useOllamaStore(state => state.models);
    const [saved, setSaved] = useState(false);

    const handleSaveAndClose = () => {
        if (apiKeys.obsidian) {
            window.vibe.setObsidianKey(apiKeys.obsidian).catch(() => {});
        }
        if (projectPath) {
            window.vibe.startBackgroundAgents(projectPath, {
                obsidianKey: apiKeys.obsidian || undefined,
                apiKeys,
                collectorModel: backgroundModels.collector || undefined,
                reviewerModel: backgroundModels.reviewer || undefined,
            }).catch(() => {});
        }
        setSaved(true);
        setTimeout(() => onClose(), 400);
    };

    return (
        <div className="settings-overlay">
            <div onClick={onClose} className="settings-backdrop" />
            <GlassPanel variant="strong" className="settings-panel" style={{ overflowY: 'auto', maxHeight: '80vh' }}>
                <div className="settings-header">
                    <h2 className="settings-header__title">IDE Settings</h2>
                    <button onClick={onClose} className="settings-header__close"></button>
                </div>

                <DataLocationSection />

                <div className="settings-section">
                    <h3 className="settings-section__title">Cloud API Keys</h3>
                    {['gemini', 'claude', 'openai', 'deepseek', 'groq', 'openrouter', 'hf', 'ofox'].map(provider => (
                        <div key={provider} className="settings-field">
                            <label className="settings-field__label">
                                {(provider === 'hf' ? 'HuggingFace' : provider === 'openrouter' ? 'OpenRouter' : provider === 'ofox' ? 'OfoxAI' : provider)} API Key
                            </label>
                            <input
                                type="password"
                                value={apiKeys[provider as keyof typeof apiKeys] || ''}
                                onChange={(e) => setApiKey(provider, e.target.value)}
                                placeholder={
                                    provider === 'hf'
                                        ? 'Enter HuggingFace token (hf_...)'
                                        : provider === 'openrouter'
                                            ? 'Enter OpenRouter key (sk-or-...)'
                                            : provider === 'ofox'
                                                ? 'Enter OfoxAI API key (sk-...)'
                                                : `Enter ${provider} key (autosaves)...`
                                }
                                className="settings-field__input"
                            />
                        </div>
                    ))}
                </div>

                <div className="settings-section">
                    <h3 className="settings-section__title">Background Agent Models</h3>
                    <div className="settings-info-box">
                        Type any Ollama model name (e.g. <code>llama3.2</code>, <code>glm-5:cloud</code>).
                        Detected local models appear as suggestions.
                    </div>

                    {/* datalist shares the same detected models as the ModelSelector */}
                    <datalist id="ollama-models-list">
                        {ollamaModels.map((m) => (
                            <option key={m} value={m} />
                        ))}
                    </datalist>

                    <div className="settings-field">
                        <label className="settings-field__label">Collector Model</label>
                        <input
                            type="text"
                            list="ollama-models-list"
                            value={backgroundModels.collector}
                            onChange={(e) => setBackgroundModel('collector', e.target.value)}
                            placeholder="e.g. llama3.2 or glm-5:cloud"
                            className="settings-field__input"
                        />
                    </div>

                    <div className="settings-field">
                        <label className="settings-field__label">Reviewer Model</label>
                        <input
                            type="text"
                            list="ollama-models-list"
                            value={backgroundModels.reviewer}
                            onChange={(e) => setBackgroundModel('reviewer', e.target.value)}
                            placeholder="e.g. llama3.2 or glm-5:cloud"
                            className="settings-field__input"
                        />
                    </div>

                    {ollamaModels.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                            {ollamaModels.length} local model{ollamaModels.length !== 1 ? 's' : ''} detected: {ollamaModels.join(', ')}
                        </div>
                    )}
                </div>

                {/* --- Obsidian Integration Section --- */}
                <div className="settings-section settings-section--obsidian">
                    <h3 className="settings-section__title">Obsidian Integration</h3>

                    <div className="settings-info-box">
                        Install the <strong>Local REST API</strong> plugin in
                        Obsidian, then paste your API key below. VIBE will
                        automatically create project notes and log all agent
                        activity to your vault.
                    </div>

                    <div className="settings-field">
                        <label className="settings-field__label">
                            Obsidian Local REST API Key
                        </label>
                        <input
                            type="password"
                            value={apiKeys.obsidian || ''}
                            onChange={e => setApiKey('obsidian', e.target.value)}
                            placeholder="Paste API key from Obsidian plugin settings..."
                            className="settings-field__input"
                        />
                    </div>

                    <ObsidianStatusIndicator apiKey={apiKeys.obsidian || ''} />
                </div>

                <div className="settings-footer">
                    {saved && <span className="settings-footer__saved">Keys Saved! ok</span>}
                    <button onClick={handleSaveAndClose} className="settings-footer__save-btn">Save & Close</button>
                </div>
            </GlassPanel>
        </div>
    );
}
```

## `src/renderer/components/layout/Sidebar.tsx`

```tsx
import React, { useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';
import { useOllamaStore } from '../../store/ollama';
import { FileTree } from '../filetree/FileTree';
import { SettingsModal } from './SettingsModal';

const toolbarBtnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    padding: '2px 4px',
    borderRadius: 4,
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
};

export function Sidebar() {
    const sidebarWidth = useUIStore(state => state.sidebarWidth);
    // Use the UIlevel flag that is updated every 5s (see App.tsx)
    const ollamaConnected = useUIStore(state => state.ollamaConnected);
    const [showSettings, setShowSettings] = useState(false);
    const projectPath = useUIStore(state => state.projectPath);
    const [refreshKey, setRefreshKey] = useState(0);

    const handleNewFile = async () => {
        if (!projectPath) return;
        const name = prompt('Enter file name:');
        if (name) {
            await window.vibe.writeFile(`${projectPath}/${name}`, '');
            setRefreshKey(k => k + 1);
        }
    };

    const handleNewFolder = async () => {
        if (!projectPath) return;
        const name = prompt('Enter folder name:');
        if (name) {
            // writeFile with a dummy file inside creates the folder
            await window.vibe.writeFile(`${projectPath}/${name}/.gitkeep`, '');
            setRefreshKey(k => k + 1);
        }
    };

    const handleRefresh = () => {
        setRefreshKey(k => k + 1);
    };

    const handleCollapseAll = () => {
        setRefreshKey(k => k + 1); // FileTree re-renders with all folders collapsed
    };

    return (
        <GlassPanel style={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-light)' }}>
                <span style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-muted)', fontWeight: 600 }}>Explorer</span>
                <div style={{ display: 'flex', gap: 2 }}>
                    <button onClick={() => handleNewFile()} title="New File" style={toolbarBtnStyle}></button>
                    <button onClick={() => handleNewFolder()} title="New Folder" style={toolbarBtnStyle}></button>
                    <button onClick={() => handleRefresh()} title="Refresh Explorer" style={toolbarBtnStyle}></button>
                    <button onClick={() => handleCollapseAll()} title="Collapse All" style={toolbarBtnStyle}></button>
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
                <FileTree key={refreshKey} />
            </div>
            <div style={{ padding: '8px 16px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: ollamaConnected ? 'var(--green)' : 'var(--error)' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>Ollama {ollamaConnected ? 'Connected' : 'Disconnected'}</span>
                </div>
                <button onClick={() => setShowSettings(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)' }} title="IDE Settings">*</button>
            </div>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
        </GlassPanel>
    );
}
```

## `src/renderer/components/layout/TitleBar.tsx`

```tsx
import React, { useEffect, useState } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';

export function TitleBar() {
    const [isMaximized, setIsMaximized] = useState(false);
    const projectPath = useUIStore(state => state.projectPath);

    const projectName = projectPath ? projectPath.split(/[/\\]/).pop() : 'No Folder Opened';

    useEffect(() => {
        if (window.vibe?.onWindowMaximized) {
            window.vibe.onWindowMaximized((max: boolean) => setIsMaximized(max));
        }
    }, []);

    const handleMinimize = () => window.vibe?.minimizeWindow();
    const handleMaximize = () => window.vibe?.maximizeWindow();
    const handleClose = () => window.vibe?.closeWindow();

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    return (
        <GlassPanel variant="strong" className="titlebar-drag" style={{
            height: 'var(--titlebar-height)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
            flexShrink: 0,
            borderRadius: 0,
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            marginBottom: 'var(--gap)',
        }}>
            <div style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                fontSize: '15px',
                letterSpacing: '3px',
                background: 'var(--accent-gradient)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginLeft: isMac ? '70px' : '0'
            }}>
                VIBE
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                {projectName}
            </div>

            {!isMac ? (
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button data-clickable onClick={handleMinimize} style={btnStyle}>_</button>
                    <button data-clickable onClick={handleMaximize} style={btnStyle}></button>
                    <button data-clickable onClick={handleClose} style={{ ...btnStyle, color: 'var(--error)' }}></button>
                </div>
            ) : <div style={{ width: 70 }}></div>}
        </GlassPanel>
    );
}

const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--text)',
    cursor: 'pointer',
    fontSize: '14px',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
};
```

## `src/renderer/components/terminal/TerminalPane.tsx`

```tsx
import React, { useEffect, useRef } from 'react';
import { GlassPanel } from '../common/GlassPanel';
import { useUIStore } from '../../store/ui';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';

import { useTerminalStore } from '../../store/terminal';
import { terminalBus } from '../../utils/terminalBus';

export function TerminalPane() {
    const terminalHeight = useUIStore(state => state.terminalHeight);
    const containerRef = useRef<HTMLDivElement>(null);
    const terminalRef = useRef<Terminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const termIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        const terminal = new Terminal({
            cursorBlink: true,
            cursorStyle: 'bar',
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.4,
            theme: {
                background: '#1a1a2e',
                foreground: '#e2e2ef',
                cursor: '#00d4aa',
                cursorAccent: '#1a1a2e',
                selectionBackground: 'rgba(0, 212, 170, 0.2)',
                selectionForeground: '#ffffff',
                black: '#1a1a2e',
                red: '#ff4466',
                green: '#00d4aa',
                yellow: '#ffaa33',
                blue: '#4488ff',
                magenta: '#aa66ff',
                cyan: '#00aaff',
                white: '#e2e2ef',
                brightBlack: '#4a4a68',
                brightRed: '#ff6688',
                brightGreen: '#33e0bb',
                brightYellow: '#ffcc66',
                brightBlue: '#66aaff',
                brightMagenta: '#cc88ff',
                brightCyan: '#33ccff',
                brightWhite: '#ffffff',
            }
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(webLinksAddon);
        terminal.open(containerRef.current);
        fitAddon.fit();

        terminalRef.current = terminal;
        fitAddonRef.current = fitAddon;

        let mounted = true;

        window.vibe.createTerminal(useUIStore.getState().projectPath || undefined).then((id: string) => {
            if (!mounted) return;
            termIdRef.current = id;
            useTerminalStore.getState().addSession({ id, title: 'Bash' }); // CRITICAL FIX
            window.vibe.onTerminalData((incomingId: string, data: string) => {
                if (incomingId === id) terminal.write(data);
            });
            terminal.onData((data) => window.vibe.sendTerminalInput(id, data));
            fitAddon.fit();
            window.vibe.resizeTerminal(id, terminal.cols, terminal.rows);
        });

        const resizeObserver = new ResizeObserver(() => {
            if (fitAddonRef.current && terminalRef.current && termIdRef.current) {
                fitAddonRef.current.fit();
                window.vibe.resizeTerminal(termIdRef.current, terminalRef.current.cols, terminalRef.current.rows);
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            mounted = false;
            resizeObserver.disconnect();
            if (termIdRef.current) {
                window.vibe.killTerminal(termIdRef.current);
            }
            terminal.dispose();
        };
    }, []);

    // Mirror the agent's bash activity into this terminal (display only — the
    // pty above is still the user's real interactive shell). Replays the full
    // command log on mount so reopening the terminal shows everything the agent
    // has run, then follows new output and auto-scrolls to the latest.
    useEffect(() => {
        const hist = terminalBus.getHistory();
        if (hist) terminalRef.current?.write(hist);
        terminalRef.current?.scrollToBottom();
        const unsub = terminalBus.subscribe((text) => {
            terminalRef.current?.write(text);
            terminalRef.current?.scrollToBottom();
        });
        return unsub;
    }, []);

    return (
        <GlassPanel style={{ height: terminalHeight, padding: 8, overflow: 'hidden', flexShrink: 0 }}>
            <div
                ref={containerRef}
                style={{
                    width: '100%',
                    height: '100%',
                    borderRadius: 'var(--radius-sm)',
                    overflow: 'hidden',
                    background: '#1a1a2e'
                }}
            />
        </GlassPanel>
    );
}
```

## `src/renderer/hooks/useBackgroundTerminal.ts`

```ts
import { useEffect } from 'react';
import { useTerminalStore } from '../store/terminal';
import { useUIStore } from '../store/ui';

export function useBackgroundTerminal() {
    useEffect(() => {
        // Cleanup matters: React StrictMode double-mounts effects in dev, which
        // used to spawn TWO pty processes and orphan one on every reload.
        let cancelled = false;
        let createdId: string | null = null;
        const projectPath = useUIStore.getState().projectPath;
        window.vibe.createTerminal(projectPath || undefined).then((id: string) => {
            if (cancelled) { window.vibe.killTerminal(id); return; }
            createdId = id;
            useTerminalStore.getState().addSession({ id, title: 'Background' });
            // No data listener needed - main buffers output; the agent reads it
            // via getTerminalOutput. (The old noop listener leaked per mount.)
        }).catch(console.error);
        return () => {
            cancelled = true;
            if (createdId) {
                window.vibe.killTerminal(createdId);
                useTerminalStore.getState().removeSession(createdId);
            }
        };
    }, []);
}
```

## `src/renderer/hooks/useFileSystem.ts`

```ts
import { useCallback } from 'react';
import type { FileEntry } from '../../shared/types';
import { pickFolder } from '../store/folderPicker';

export function useFileSystem() {
    const openFolder = useCallback(async (): Promise<string | null> => {
        return pickFolder();
    }, []);

    const readDir = useCallback(async (dirPath: string): Promise<FileEntry[]> => {
        return window.vibe.readDir(dirPath);
    }, []);

    const readFile = useCallback(async (filePath: string): Promise<string> => {
        return window.vibe.readFile(filePath);
    }, []);

    const writeFile = useCallback(async (filePath: string, content: string): Promise<boolean> => {
        return window.vibe.writeFile(filePath, content);
    }, []);

    return { openFolder, readDir, readFile, writeFile };
}
```

## `src/renderer/hooks/useOllama.ts`

```ts
import { useCallback } from 'react';
import type { ChatMessage } from '../../shared/types';

export function useOllama() {
    const detectOllama = useCallback(async (): Promise<{ detected: boolean; version?: string }> => {
        return window.vibe.detectOllama();
    }, []);

    const listModels = useCallback(async (): Promise<string[]> => {
        return window.vibe.listModels();
    }, []);

    const chat = useCallback(async (model: string, messages: ChatMessage[]) => {
        return window.vibe.chat(model, messages);
    }, []);

    const onStream = useCallback((callback: (chunk: { content: string; done: boolean }) => void) => {
        window.vibe.onChatStream(callback);
    }, []);

    const stopGeneration = useCallback(() => {
        window.vibe.stopGeneration();
    }, []);

    return { detectOllama, listModels, chat, onStream, stopGeneration };
}
```

## `src/renderer/hooks/useTerminal.ts`

```ts
import { useCallback } from 'react';

export function useTerminal() {
    const createTerminal = useCallback(async (cwd?: string): Promise<string> => {
        return window.vibe.createTerminal(cwd);
    }, []);

    const sendInput = useCallback((id: string, data: string) => {
        window.vibe.sendTerminalInput(id, data);
    }, []);

    const resizeTerminal = useCallback((id: string, cols: number, rows: number) => {
        window.vibe.resizeTerminal(id, cols, rows);
    }, []);

    const onData = useCallback((callback: (id: string, data: string) => void) => {
        window.vibe.onTerminalData(callback);
    }, []);

    const killTerminal = useCallback((id: string) => {
        window.vibe.killTerminal(id);
    }, []);

    return { createTerminal, sendInput, resizeTerminal, onData, killTerminal };
}
```

## `src/renderer/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/globals.css';

// Forward renderer console.log to main process debug window
const _origLog = console.log
const _origError = console.error
const _origWarn = console.warn

console.log = (...args: any[]) => {
    _origLog(...args)
    try {
        window.vibe?.log(`[LOG] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`)
    } catch { }
}

console.error = (...args: any[]) => {
    _origError(...args)
    try {
        window.vibe?.log(`[ERROR] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`)
    } catch { }
}

console.warn = (...args: any[]) => {
    _origWarn(...args)
    try {
        window.vibe?.log(`[WARN] ${args.map(a =>
            typeof a === 'object' ? JSON.stringify(a) : String(a)
        ).join(' ')}`)
    } catch { }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
```

## `src/renderer/services/agent/direct.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildDirectSystemPrompt } from './direct';

describe('direct service', () => {
    it('builds grounded direct-chat prompt with project rules and briefing', () => {
        const prompt = buildDirectSystemPrompt(
            'Always run tests before final response.',
            '\nPROJECT BRIEFING (from background intelligence):\nCore flow is in AgentSurface\n',
        );

        expect(prompt).toContain('You are VIBE Chat Assistant running inside the VIBE IDE desktop app.');
        expect(prompt).toContain('Never claim you are outside the IDE');
        expect(prompt).toContain('PROJECT RULES:\nAlways run tests before final response.\n');
        expect(prompt).toContain('PROJECT BRIEFING (from background intelligence):');
    });

    it('omits project rules block when instructions are absent', () => {
        const prompt = buildDirectSystemPrompt(null, '');
        expect(prompt).not.toContain('PROJECT RULES:');
        expect(prompt).toContain('Respond naturally and helpfully.');
    });
});
```

## `src/renderer/services/agent/direct.ts`

```ts
import type { ChatMessage } from '../../../shared/types';
import { useOllamaStore } from '../../store/ollama';

export interface RunDirectChatDeps {
    selectedModel: string;
    apiKeys: Record<string, string>;
    vibeInstructions: string | null;
    baseMessages: ChatMessage[];
    getBriefingContext: () => Promise<string>;
    getThinkOptions: () => { enabled: boolean; level: 'low' | 'medium' | 'high' } | null;
    waitForStreamDone: (timeoutMs?: number) => Promise<string>;
    shouldStop: () => boolean;
}

export function buildDirectSystemPrompt(vibeInstructions: string | null, briefingContext: string): string {
    return `You are VIBE Chat Assistant running inside the VIBE IDE desktop app.\n` +
        `Never claim you are outside the IDE or that you cannot access the project by default.\n` +
        `If project context is missing, ask the user to open/select a folder in VIBE and continue.\n` +
        `Respond naturally and helpfully.\n` +
        `Do not enter planning/tool XML mode unless the user explicitly asks to execute coding tasks.\n` +
        `${vibeInstructions ? `PROJECT RULES:\n${vibeInstructions}\n` : ''}` +
        `${briefingContext || ''}`;
}

export async function runDirectChat(deps: RunDirectChatDeps): Promise<void> {
    const {
        selectedModel,
        apiKeys,
        vibeInstructions,
        baseMessages,
        getBriefingContext,
        getThinkOptions,
        waitForStreamDone,
        shouldStop,
    } = deps;

    if (shouldStop()) return;

    useOllamaStore.getState().setIsGenerating(true);
    useOllamaStore.getState().setAgentStep(0, 0);
    useOllamaStore.getState().setAgentStatus('');

    const briefingContext = await getBriefingContext();
    if (shouldStop()) return;

    const directMessages: ChatMessage[] = [
        {
            role: 'system',
            content: buildDirectSystemPrompt(vibeInstructions, briefingContext),
        },
        ...baseMessages,
    ];

    useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

    try {
        if (shouldStop()) return;
        await window.vibe.chat(selectedModel, directMessages, apiKeys, getThinkOptions());
        await waitForStreamDone();
    } catch (e) {
        window.vibe.log(`[CHAT] Direct mode failed: ${e}`);
    } finally {
        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    }
}
```

## `src/renderer/services/agent/intent.ts`

```ts
const TASK_INTENT_RE = /(fix|build|implement|write|edit|refactor|create|run|execute|terminal|command|bug|error|test|install|setup|update|change|patch|analy[sz]e code|read file|open file|generate)/i;

export function shouldUseAgenticMode(text: string): boolean {
    return TASK_INTENT_RE.test(text);
}
```

## `src/renderer/services/agent/orchestrator.ts`

```ts
﻿import { useOllamaStore } from '../../store/ollama';
import { useSettingsStore } from '../../store/settings';
import { useTerminalStore } from '../../store/terminal';
import { useUIStore } from '../../store/ui';
import { buildExecutionWaves, parsePlanSteps, type PlanStep } from './plan';
import { buildCriticPrompt, buildExecutorPrompt, buildPlannerPrompt, buildVerifierPrompt } from './prompts';
import { extractTag } from './xml';
import { sanitizeForPowerShell } from '../../utils/commandSanitizer';
import { buildSwarmRepairArtifact, persistSwarmRepairArtifact } from './repair';

const MAX_STEP_RETRIES = 3;
const MAX_STEPS = 12;
const REFLECTION_THRESHOLD = 7;

interface VerificationSnapshot {
    criteriaMet?: string | null;
    score?: string | null;
    remaining?: string | null;
}

export interface RunAgentLoopDeps {
    selectedModel: string;
    apiKeys: Record<string, string>;
    vibeInstructions: string | null;
    shouldStop: () => boolean;
    getThinkOptions: () => { enabled: boolean; level: 'low' | 'medium' | 'high' } | null;
    waitForStreamDone: (timeoutMs?: number) => Promise<string>;
    getProjectSnapshot: (projectPath: string) => Promise<string>;
    getBriefingContext: () => Promise<string>;
    pollTerminalOutput: (termId: string) => Promise<string>;
}

export async function runAgentLoop(userMission: string, deps: RunAgentLoopDeps): Promise<void> {
    const {
        selectedModel,
        apiKeys,
        vibeInstructions,
        shouldStop,
        getThinkOptions,
        waitForStreamDone,
        getProjectSnapshot,
        getBriefingContext,
        pollTerminalOutput,
    } = deps;

    const projectPath = useUIStore.getState().projectPath;
    const projectMemory = useUIStore.getState().projectMemory;
    // Load persistent facts (if any) and merge into memory for planning
    let extendedMemory: any = projectMemory;
    if (projectPath) {
        try {
            const factsContent = await window.vibe.readFile(`${projectPath}/.vibe/facts.json`);
            const factsJson = JSON.parse(factsContent);
            if (factsJson.facts) {
                extendedMemory = { ...(projectMemory ?? {}), facts: factsJson.facts };
            }
        } catch {
            // Ignore if facts file missing or malformed
        }
    }
    const termId = useTerminalStore.getState().activeTerminalId;

    try {
        if (shouldStop()) return;

        useOllamaStore.getState().setAgentStatus('Scanning project...');
        useOllamaStore.getState().setIsGenerating(true);
        const projectStructure = projectPath
            ? await getProjectSnapshot(projectPath)
            : 'No project open';
        if (shouldStop()) return;
        window.vibe.log(`[SCAN] Found structure:\n${projectStructure.slice(0, 500)}`);

        const briefingContext = await getBriefingContext();
        if (shouldStop()) return;
        window.vibe.log(`[BRIEFING] ${briefingContext ? 'Loaded ok' : 'Not available'}`);

        const obsidianKey = useSettingsStore.getState().apiKeys.obsidian;
        const projectName = projectPath?.split(/[/\\]/).pop() || 'Unknown';
        if (obsidianKey && projectPath) {
            window.vibe.obsidianUpdateProject(
                obsidianKey, projectName, projectStructure, projectPath
            ).catch(() => {});
        }

        useOllamaStore.getState().setAgentStatus('Planning...');
        useOllamaStore.getState().setAgentStep(0, 4);
        window.vibe.log(`[AGENT START] Mission: ${userMission.slice(0, 100)}`);
        window.vibe.log(`[PROJECT] ${projectStructure.split('\n').length} files found`);

        const plannerMessages = [
        {
            role: 'system' as const,
            content: buildPlannerPrompt(
                userMission,
                projectPath,
                projectStructure,
                extendedMemory,
                vibeInstructions,
                briefingContext,
            ),
        },
        { role: 'user' as const, content: userMission },
    ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, plannerMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[PLAN] Failed: ${e}`);
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStatus('');
            return;
        }
        if (shouldStop()) return;

        const planResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        let planXml = extractTag(planResponse, 'plan');
        if (!planXml) {
            planXml = planResponse;
        }

        const criteria = extractTag(planResponse, 'criteria') || 'Task completed successfully';
        const planRunId = `plan-${Date.now()}`;
        const planPath = projectPath ? `${projectPath}/.vibe/plans/${planRunId}.json` : null;
        const statePath = projectPath ? `${projectPath}/.vibe/STATE.json` : null;

        const persistPlanArtifacts = async (
        planSteps: PlanStep[],
        status: 'running' | 'completed' | 'failed',
        verification?: VerificationSnapshot,
    ) => {
        if (!projectPath || !planPath || !statePath) return;

        const stepStatus = planSteps.map(s => ({
            id: s.id,
            type: s.type,
            description: s.description,
            dependsOn: s.dependsOn,
        }));

        await window.vibe.writeFile(planPath, JSON.stringify({
            id: planRunId,
            mission: userMission,
            createdAt: new Date().toISOString(),
            status,
            criteria,
            steps: stepStatus,
            verification: verification || null,
        }, null, 2));

        await window.vibe.writeFile(statePath, JSON.stringify({
            updatedAt: new Date().toISOString(),
            activePlanId: status === 'running' ? planRunId : null,
            lastPlanId: planRunId,
            mission: userMission,
            status,
            criteria,
            verification: verification || null,
        }, null, 2));
    };

        useOllamaStore.getState().setAgentStatus('Reviewing plan...');
    useOllamaStore.getState().setAgentStep(1, 4);
    window.vibe.log('[Agent] Phase: CRITIC');

        const criticMessages = [
        { role: 'system' as const, content: buildCriticPrompt(planXml, userMission) },
        { role: 'user' as const, content: 'Review this plan.' },
    ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, criticMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[CRITIC] Failed (non-blocking): ${e}`);
        }
        if (shouldStop()) return;

        const criticResponse = useOllamaStore.getState()
            .messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        const critiqueScore = parseInt(extractTag(criticResponse, 'score') || '8');
        const revisedPlan = extractTag(criticResponse, 'revised_plan');

        window.vibe.log(`[CRITIC] Score: ${critiqueScore} | Revised: ${!!revisedPlan}`);

        if (critiqueScore < 7 && revisedPlan && revisedPlan !== 'APPROVED') {
            planXml = revisedPlan;
        }

        const executionSteps = parsePlanSteps(planXml, userMission);
        const executionWaves = buildExecutionWaves(executionSteps);
        await persistPlanArtifacts(executionSteps, 'running');

        window.vibe.log(`[PLAN] Steps: ${executionSteps.length} | Waves: ${executionWaves.length} | Criteria: ${criteria.slice(0, 100)}`);

        useOllamaStore.getState().setAgentStep(2, 4);

        const previousResults: string[] = [];

        const persistRepairArtifact = async (
            status: 'failed' | 'partial',
            verification: VerificationSnapshot & { evidence?: string | null },
        ) => {
            const artifact = buildSwarmRepairArtifact({
                runId: planRunId,
                mission: userMission,
                criteria,
                status,
                verification: {
                    criteriaMet: verification.criteriaMet ?? null,
                    score: verification.score ?? null,
                    remaining: verification.remaining ?? null,
                    evidence: verification.evidence ?? null,
                },
                previousResults,
                planSteps: executionSteps,
                preferredModel: selectedModel,
                modelPool: useOllamaStore.getState().models,
            });
            await persistSwarmRepairArtifact(projectPath, artifact);
            window.vibe.log(`[REPAIR] Generated ${artifact.id}`);
        };

        if (projectPath && termId) {
            await window.vibe.clearTerminalOutput(termId);
            window.vibe.sendTerminalInput(termId, `cd "${projectPath}"\r`);
            await new Promise(r => setTimeout(r, 800));
            await window.vibe.clearTerminalOutput(termId);
        }

        for (let waveIdx = 0; waveIdx < executionWaves.length; waveIdx++) {
        if (shouldStop()) return;
        const wave = executionWaves[waveIdx].slice(0, MAX_STEPS);
        window.vibe.log(`[WAVE ${waveIdx + 1}] ${wave.map(s => s.id).join(', ')}`);

        for (const step of wave) {
            if (shouldStop()) return;
            useOllamaStore.getState().setAgentStatus(`Step ${step.id}: ${step.description.slice(0, 50)}...`);
            window.vibe.log(`[STEP ${step.id}] Starting: ${step.description.slice(0, 80)}`);

            let stepSuccess = false;
            let retryCount = 0;
            let lastCritique = '';

            while (!stepSuccess && retryCount < MAX_STEP_RETRIES) {
                if (shouldStop()) return;
                const executorMessages = [
                    {
                        role: 'system' as const,
                        content: buildExecutorPrompt(
                            userMission,
                            planXml,
                            step.description + (lastCritique ? `\n\nPREVIOUS ATTEMPT FAILED: ${lastCritique}` : ''),
                            previousResults.slice(-3).join('\n\n'),
                            projectPath,
                        ),
                    },
                    { role: 'user' as const, content: `Execute step ${step.id}: ${step.description}` },
                ];

                useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

                try {
                    await window.vibe.chat(selectedModel, executorMessages, apiKeys, getThinkOptions());
                    await waitForStreamDone();
                } catch {
                    window.vibe.log(`[STEP ${step.id}] LLM call failed, retrying`);
                    retryCount++;
                    continue;
                }
                if (shouldStop()) return;

                const stepResponse = useOllamaStore.getState().messages[useOllamaStore.getState().messages.length - 1]?.content || '';

                let toolResult = '';
                let toolType = 'none';

                const readMatch = stepResponse.match(/<read_file\s+path=['"]([^'"]+)['"]\s*\/?>/);
                if (readMatch) {
                    toolType = 'read_file';
                    const filePath = readMatch[1];
                    useOllamaStore.getState().setAgentStatus(`Reading: ${filePath}`);
                    try {
                        const content = await window.vibe.readFile(projectPath ? `${projectPath}/${filePath}` : filePath);
                        toolResult = `FILE: ${filePath}\n${content}`;
                        useOllamaStore.getState().addMessage({ role: 'user', content: `__FILE_CONTENTS__ ${filePath}\n${content}` });
                    } catch {
                        toolResult = `ERROR: Could not read ${filePath}`;
                        useOllamaStore.getState().addMessage({ role: 'user', content: `__FILE_CONTENTS__ ${filePath}\nERROR: File not found` });
                    }
                }

                // Match write_file with content: <write_file path="...">content</write_file>
                const writeMatchFull = stepResponse.match(/<write_file\s+path=['"]([^'"]+)['"]\s*>([\s\S]*?)<\/write_file>/);
                const writeMatch = stepResponse.match(/<write_file\s+path=['"]([^'"]+)['"]/);
                if (writeMatchFull || writeMatch) {
                    toolType = 'write_file';
                    const filePath = (writeMatchFull || writeMatch)![1];
                    // Prefer content from the full match (with closing tag); fall back to extracting after >
                    let fileContent: string;
                    if (writeMatchFull) {
                        fileContent = writeMatchFull[2].trim();
                    } else {
                        // Model emitted opening tag only â€” try to extract content up to next tag or end
                        const afterTag = stepResponse.slice(stepResponse.indexOf(writeMatch![0]) + writeMatch![0].length);
                        const nextTagIdx = afterTag.search(/<\/?(?:read_file|execute|done|plan|step|reflection)/);
                        fileContent = nextTagIdx >= 0 ? afterTag.slice(0, nextTagIdx).trim() : afterTag.trim();
                    }
                    try {
                        await window.vibe.writeFile(filePath, fileContent);
                        toolResult = `WROTE: ${filePath} (${fileContent.length} chars)`;
                    } catch (writeErr) {
                        toolResult = `ERROR writing ${filePath}: ${(writeErr as Error).message}`;
                    }
                }

                const executeMatch = stepResponse.match(/<execute>([\s\S]*?)<\/execute>/);
                if (executeMatch && termId) {
                    toolType = 'execute';
                    const command = executeMatch[1].trim();
                    // Only translate to PowerShell on Windows. On Linux/macOS the
                    // visible terminal is bash/zsh, so translating would corrupt
                    // valid commands (ls -> dir, && -> ;, grep -> Select-String).
                    const safeCommand = window.vibe.platform === 'win32'
                        ? sanitizeForPowerShell(command)
                        : command;

                    if (safeCommand !== command) {
                        window.vibe.log(`[SANITIZE] Unix->PowerShell: "${command}" -> "${safeCommand}"`);
                    }

                    useOllamaStore.getState().setAgentStatus(`Running: ${safeCommand.slice(0, 50)}`);
                    await window.vibe.clearTerminalOutput(termId);
                    window.vibe.sendTerminalInput(termId, safeCommand + '\r');

                    const cleaned = await pollTerminalOutput(termId);
                    if (shouldStop()) return;
                    toolResult = cleaned || 'Command ran with no output';

                    window.vibe.log(`[OUTPUT] Length: ${toolResult.length} chars`);
                    window.vibe.log(`[OUTPUT] Preview: ${toolResult.slice(0, 150)}`);

                    useOllamaStore.getState().addMessage({ role: 'user', content: `__TERMINAL_OUTPUT__\n${cleaned}` });
                }

                const analyzeMatch = extractTag(stepResponse, 'analyze');
                if (analyzeMatch) {
                    toolType = 'analyze';
                    toolResult = analyzeMatch;
                }

                window.vibe.log(`[TOOL] ${toolType} | Result length: ${toolResult.length}`);

                const reflectionScore = parseInt(extractTag(stepResponse, 'score') || '8');
                const reflectionNotes = extractTag(stepResponse, 'notes') || '';
                const critique = extractTag(stepResponse, 'critique') || '';
                const shouldProceed = extractTag(stepResponse, 'proceed') !== 'no';

                window.vibe.log(`[REFLECT] Score: ${reflectionScore}/10 | Retry: ${retryCount}/${MAX_STEP_RETRIES}`);

                previousResults.push(
                    `Step ${step.id} (${step.description.slice(0, 50)}): ` +
                    `Score ${reflectionScore}/10. ${reflectionNotes}. ` +
                    `Tool result: ${toolResult.slice(0, 200)}`,
                );

                const hasDone = /<done>[\s\S]*?<\/done>/.test(stepResponse);

                if (hasDone) {
                    const doneSummary = extractTag(stepResponse, 'summary') || 'Task completed';
                    const doneFiles = extractTag(stepResponse, 'files_changed') || '';

                    if (projectPath) {
                        const newMemory = {
                            lastSession: doneSummary,
                            keyFiles: [] as string[],
                            architecturalDecisions: [] as string[],
                            currentPhase: 'development',
                            updatedAt: new Date().toISOString(),
                        };
                        window.vibe.writeMemory(projectPath, newMemory).then(() => {
                            useUIStore.getState().setProjectMemory(newMemory);
                        });
                    }

                    if (obsidianKey && projectPath) {
                        window.vibe.obsidianLogDecision(obsidianKey, projectName, doneSummary, doneFiles).catch(() => {});
                    }

                    await persistPlanArtifacts(executionSteps, 'completed', {
                        criteriaMet: 'yes',
                        score: '10',
                        remaining: null,
                    });

                    window.vibe.log(`[Loop] Mission complete | Steps done: ${step.id}`);
                    useOllamaStore.getState().setIsGenerating(false);
                    useOllamaStore.getState().setAgentStep(0, 0);
                    useOllamaStore.getState().setAgentStatus('');
                    return;
                }

                if (reflectionScore >= REFLECTION_THRESHOLD && shouldProceed) {
                    stepSuccess = true;
                } else {
                    lastCritique = critique || `Score was ${reflectionScore}/10. ${reflectionNotes}`;
                    retryCount++;
                    useOllamaStore.getState().setAgentStatus(`Retrying step ${step.id} (attempt ${retryCount + 1})...`);
                }
            }

            window.vibe.logAgentAction(`Step ${step.id}: ${step.description.slice(0, 100)}`).catch(() => {});

            if (!stepSuccess) {
                useOllamaStore.getState().addMessage({
                    role: 'assistant',
                    content:
                        `! Step ${step.id} failed after ${MAX_STEP_RETRIES} attempts. ` +
                        `Last issue: ${previousResults[previousResults.length - 1]}. ` +
                        `Please review and try a more specific instruction.`,
                });
                window.vibe.log(`[STEP ${step.id}] FAILED after ${MAX_STEP_RETRIES} retries`);
                await persistPlanArtifacts(executionSteps, 'failed', {
                    criteriaMet: 'no',
                    score: '0',
                    remaining: `Step ${step.id} failed after retries.`,
                });
                await persistRepairArtifact('failed', {
                    criteriaMet: 'no',
                    score: '0',
                    remaining: `Step ${step.id} failed after retries.`,
                    evidence: previousResults[previousResults.length - 1] || null,
                });
                useOllamaStore.getState().setIsGenerating(false);
                useOllamaStore.getState().setAgentStep(0, 0);
                useOllamaStore.getState().setAgentStatus('');
                return;
            }
        }
    }

        useOllamaStore.getState().setAgentStatus('Verifying results...');
    useOllamaStore.getState().setAgentStep(3, 4);
    window.vibe.log('[Agent] Phase: VERIFY');

        const verifierMessages = [
        {
            role: 'system' as const,
            content: buildVerifierPrompt(userMission, criteria, previousResults.join('\n\n')),
        },
        { role: 'user' as const, content: 'Verify the mission results.' },
    ];

        useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

        try {
            await window.vibe.chat(selectedModel, verifierMessages, apiKeys, getThinkOptions());
            await waitForStreamDone();
        } catch (e) {
            window.vibe.log(`[VERIFY] Failed (non-blocking): ${e}`);
        }
        if (shouldStop()) return;

        const verifierResponse = useOllamaStore.getState().messages[useOllamaStore.getState().messages.length - 1]?.content || '';

        const criteriaMet = extractTag(verifierResponse, 'criteria_met');
        const verifyScore = extractTag(verifierResponse, 'score') || '?';
        const remaining = extractTag(verifierResponse, 'remaining');

        await persistPlanArtifacts(executionSteps, criteriaMet === 'yes' ? 'completed' : 'failed', {
            criteriaMet,
            score: verifyScore,
            remaining: remaining || null,
        });

        if (projectPath) {
            await window.vibe.writeFile(`${projectPath}/.vibe/verification.latest.json`, JSON.stringify({
                mission: userMission,
                generatedAt: new Date().toISOString(),
                criteriaMet,
                score: verifyScore,
                remaining: remaining || null,
                evidence: extractTag(verifierResponse, 'evidence') || null,
            }, null, 2));
        }

        window.vibe.log(`[VERIFY] Criteria met: ${criteriaMet} | Score: ${verifyScore}`);

        if (criteriaMet === 'no' && remaining) {
            useOllamaStore.getState().setAgentStatus('Mission incomplete - informing user...');
            useOllamaStore.getState().addMessage({
                role: 'assistant',
                content:
                    `! Mission partially complete. Still needed:\n${remaining}\n\n` +
                    'Reply to continue or adjust the approach.',
            });
        }

        if (criteriaMet !== 'yes') {
            await persistRepairArtifact(criteriaMet === 'partial' ? 'partial' : 'failed', {
                criteriaMet,
                score: verifyScore,
                remaining: remaining || null,
                evidence: extractTag(verifierResponse, 'evidence') || null,
            });
        }

        if (projectPath) {
            const finalSummary = previousResults.slice(-2).join(' | ');
            const newMemory = {
                lastSession: finalSummary.slice(0, 500),
                keyFiles: [] as string[],
                architecturalDecisions: [] as string[],
                currentPhase: 'development',
                updatedAt: new Date().toISOString(),
            };
            window.vibe.writeMemory(projectPath, newMemory).then(() => {
                useUIStore.getState().setProjectMemory(newMemory);
            });
        }

        const stepDescriptions = executionSteps.map(s => s.description);
        if (obsidianKey && projectPath) {
            window.vibe.obsidianLogRun(
                obsidianKey,
                projectName,
                userMission,
                selectedModel,
                stepDescriptions,
                previousResults.slice(-1)[0] || 'No result',
                criteriaMet || 'unknown',
            ).catch(() => {});
        }

        window.vibe.log(`[AGENT END] Mission: ${userMission.slice(0, 50)} | Steps completed: ${executionSteps.length}`);
        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    } finally {
        if (shouldStop()) {
            useOllamaStore.getState().setIsGenerating(false);
            useOllamaStore.getState().setAgentStep(0, 0);
            useOllamaStore.getState().setAgentStatus('');
        }
    }
}
```

## `src/renderer/services/agent/plan.test.ts`

```ts
import { buildExecutionWaves, parsePlanSteps } from './plan';
import { describe, expect, it } from 'vitest';

describe('plan service', () => {
    it('parses xml steps with dependencies', () => {
        const planXml = `
<plan>
  <steps>
    <step id="1" type="read_file">read a</step>
    <step id="2" depends="1" type="execute">run b</step>
    <step id="3" depends="1,2" type="write_file">write c</step>
  </steps>
</plan>`;

        const steps = parsePlanSteps(planXml, 'fallback');
        expect(steps).toHaveLength(3);
        expect(steps[2].dependsOn).toEqual(['1', '2']);
    });

    it('builds dependency waves in topological order', () => {
        const steps = [
            { id: '1', type: 'analyze', description: 'A', dependsOn: [] },
            { id: '2', type: 'analyze', description: 'B', dependsOn: ['1'] },
            { id: '3', type: 'analyze', description: 'C', dependsOn: ['1'] },
            { id: '4', type: 'analyze', description: 'D', dependsOn: ['2', '3'] },
        ];

        const waves = buildExecutionWaves(steps);
        expect(waves.map(w => w.map(s => s.id))).toEqual([
            ['1'],
            ['2', '3'],
            ['4'],
        ]);
    });

    it('falls back to single mission step when parsing fails', () => {
        const steps = parsePlanSteps('not xml', 'do mission');
        expect(steps).toEqual([
            { id: '1', type: 'execute', description: 'do mission', dependsOn: [] },
        ]);
    });

    it('falls back to single wave when dependency graph is cyclic', () => {
        const cyclic = [
            { id: '1', type: 'execute', description: 'A', dependsOn: ['2'] },
            { id: '2', type: 'execute', description: 'B', dependsOn: ['1'] },
        ];
        const waves = buildExecutionWaves(cyclic);
        expect(waves).toEqual([cyclic]);
    });
});
```

## `src/renderer/services/agent/plan.ts`

```ts
export interface PlanStep {
    id: string;
    type: string;
    description: string;
    dependsOn: string[];
}

export function parsePlanSteps(planXml: string, userMission: string): PlanStep[] {
    const stepMatches = planXml.match(/<step[^>]*id="(\d+)"[^>]*>[\s\S]*?<\/step>/g) || [];
    const parsed = stepMatches.map(stepStr => {
        const idMatch = stepStr.match(/id="(\d+)"/);
        const typeMatch = stepStr.match(/type="([^"]+)"/);
        const dependsMatch = stepStr.match(/depends="([^"]+)"/);
        const contentMatch = stepStr.match(/<step[^>]*>([\s\S]*?)<\/step>/);
        const dependsOn = dependsMatch
            ? dependsMatch[1].split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
            : [];

        return {
            id: idMatch ? idMatch[1] : '1',
            type: typeMatch ? typeMatch[1] : 'execute',
            description: contentMatch ? contentMatch[1].trim() : stepStr,
            dependsOn,
        };
    });

    if (parsed.length > 0) return parsed;
    return [{ id: '1', type: 'execute', description: userMission, dependsOn: [] }];
}

export function buildExecutionWaves(steps: PlanStep[]): PlanStep[][] {
    const byId = new Map(steps.map(s => [s.id, s]));
    const indegree = new Map<string, number>();
    const outgoing = new Map<string, string[]>();

    for (const step of steps) {
        const validDeps = step.dependsOn.filter(dep => byId.has(dep));
        indegree.set(step.id, validDeps.length);
        for (const dep of validDeps) {
            const list = outgoing.get(dep) || [];
            list.push(step.id);
            outgoing.set(dep, list);
        }
    }

    const waves: PlanStep[][] = [];
    let queue = steps.filter(s => (indegree.get(s.id) || 0) === 0).map(s => s.id);
    const visited = new Set<string>();

    while (queue.length > 0) {
        const currentWaveIds = [...queue];
        queue = [];
        const waveSteps: PlanStep[] = [];

        for (const id of currentWaveIds) {
            if (visited.has(id)) continue;
            visited.add(id);
            const step = byId.get(id);
            if (!step) continue;
            waveSteps.push(step);

            for (const nextId of outgoing.get(id) || []) {
                const nextIn = (indegree.get(nextId) || 0) - 1;
                indegree.set(nextId, nextIn);
                if (nextIn === 0) queue.push(nextId);
            }
        }

        if (waveSteps.length > 0) waves.push(waveSteps);
    }

    if (visited.size !== steps.length) {
        return [steps];
    }

    return waves;
}
```

## `src/renderer/services/agent/prompts.ts`

```ts
export function buildPlannerPrompt(
    mission: string,
    projectPath: string | null,
    projectStructure: string,
    memory: any,
    vibeInstructions: string | null,
    briefingContext: string = ''
): string {
    return `You are VIBE Planner - an expert software architect.

Your job is to create a precise, executable plan for this mission:
"${mission}"

PROJECT: ${projectPath || 'unknown'}
PROJECT STRUCTURE (actual files that exist):
\`\`\`
${projectStructure}
\`\`\`
${memory ? `MEMORY: ${JSON.stringify(memory).slice(0, 500)}` : ''}
${vibeInstructions ? `PROJECT RULES:\n${vibeInstructions}` : ''}
${briefingContext}

Output ONLY this XML structure, nothing else:

<plan>
  <mission>${mission}</mission>
  <steps>
    <step id="1" type="read_file|execute|write_file|analyze">
      Description of exactly what to do
    </step>
    <step id="2" depends="1" type="execute">
      Next step description
    </step>
  </steps>
  <criteria>What "done" looks like - specific and testable</criteria>
  <risks>Any risks or things that might go wrong</risks>
</plan>

RULES:
- Maximum 8 steps
- Each step must be atomic - one action only
- type must be: read_file, execute, write_file, or analyze
- depends attribute lists step ids this step waits for
- Be specific - name exact files and commands where known
- Do NOT include code yet - planning only`;
}

export function buildExecutorPrompt(
    mission: string,
    plan: string,
    currentStep: string,
    previousResults: string,
    projectPath: string | null
): string {
    return `You are VIBE Executor - an expert developer running on Windows with PowerShell.

MISSION: ${mission}
CURRENT STEP: ${currentStep}
PROJECT: ${projectPath || 'unknown'}

FULL PLAN FOR CONTEXT:
${plan}

RESULTS SO FAR:
${previousResults || 'No previous results yet.'}

Execute ONLY the current step using exactly ONE of these tools:

To read a file:
<read_file path="relative/path/to/file.ext"/>

To run a terminal command (PowerShell on Windows):
<execute>your powershell command here</execute>

To write a file (complete content only, never partial):
<write_file path="relative/path/to/file.ext">
complete file content here
</write_file>

To analyze/reason without a tool:
<analyze>
your analysis here
</analyze>

After using your tool, output your reflection:
<reflection>
  <score>X</score>
  <notes>What happened, what you found, any issues</notes>
  <proceed>yes|no</proceed>
  <critique>If score < 8, what went wrong and how to fix it</critique>
</reflection>

RULES:
- Use ONLY ONE tool per response
- Always read a file before editing it
- PowerShell syntax only - use semicolons not &&
- Write COMPLETE files - never partial, never placeholder
- Be honest in reflection - low score = retry with fix
- If this is the final step and mission is complete, add:
  <done>
    <summary>What was accomplished</summary>
    <files_changed>list of files</files_changed>
    <criteria_met>yes|no</criteria_met>
  </done>`;
}

export function buildCriticPrompt(plan: string, mission: string): string {
    return `You are VIBE Critic. Review this plan critically.

MISSION: ${mission}

PLAN TO REVIEW:
${plan}

Score the plan and output ONLY this XML:
<critique>
  <score>X</score>
  <issues>List any problems, missing steps, or risks</issues>
  <revised_plan>
    If score < 7, output a corrected plan in the same XML 
    format as the original. If score >= 7, write "APPROVED".
  </revised_plan>
</critique>

Score criteria:
9-10: Perfect, proceed immediately
7-8: Good, minor issues noted
5-6: Needs revision before proceeding
< 5: Major problems, replan required`;
}

export function buildVerifierPrompt(mission: string, criteria: string, results: string): string {
    return `You are VIBE Verifier. Check if the mission was accomplished.

MISSION: ${mission}
ACCEPTANCE CRITERIA: ${criteria}

EXECUTION RESULTS:
${results}

Output ONLY this XML:
<verification>
  <criteria_met>yes|no|partial</criteria_met>
  <score>X</score>
  <evidence>What evidence shows criteria was/wasn't met</evidence>
  <remaining>If partial/no: what still needs to be done</remaining>
</verification>`;
}
```

## `src/renderer/services/agent/repair.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildSwarmRepairArtifact } from './repair';

describe('swarm repair service', () => {
    it('builds partial repair artifact with tester role when verification hints mention tests', () => {
        const artifact = buildSwarmRepairArtifact({
            runId: 'plan-123',
            mission: 'Fix flaky tests in auth flow',
            criteria: 'All tests should pass',
            status: 'partial',
            verification: {
                criteriaMet: 'partial',
                score: '6',
                remaining: 'Tests still fail intermittently in CI',
                evidence: 'Unit tests failed: auth/session timeout',
            },
            previousResults: [
                'Step 2: implementation completed',
                'Step 3: test command failed',
            ],
            planSteps: [
                { id: '1', type: 'analyze', description: 'Inspect auth flow', dependsOn: [] },
                { id: '2', type: 'write_file', description: 'Patch auth handler', dependsOn: ['1'] },
            ],
        });

        expect(artifact.status).toBe('partial');
        expect(artifact.suggestedSwarmPreset.name).toContain('Repair Preset');
        expect(artifact.suggestedSwarmPreset.agents.some(a => a.role === 'Tester')).toBe(true);
        expect(artifact.suggestedChanges.some(c => c.type === 'add_role')).toBe(true);
        expect(artifact.repairCandidates.length).toBe(4);
        expect(artifact.repairCandidates[0].rank).toBe(1);
        expect(artifact.repairCandidates[0].score).toBeGreaterThanOrEqual(artifact.repairCandidates[1].score);
    });

    it('includes debugger role when failure context indicates hard errors', () => {
        const artifact = buildSwarmRepairArtifact({
            runId: 'plan-456',
            mission: 'Fix startup crash',
            criteria: 'App starts without crashing',
            status: 'failed',
            verification: {
                criteriaMet: 'no',
                score: '2',
                remaining: 'Still crashes with exception after retries',
                evidence: 'Unhandled exception in bootstrap',
            },
            previousResults: [
                'Step failed after retries',
            ],
            planSteps: [
                { id: '1', type: 'execute', description: 'Run app', dependsOn: [] },
            ],
        });

        expect(artifact.status).toBe('failed');
        expect(artifact.suggestedSwarmPreset.agents.some(a => a.role === 'Debugger')).toBe(true);
        expect(artifact.diagnosis.confidence).toBeGreaterThanOrEqual(0.55);
        expect(artifact.executionContext.planSteps).toHaveLength(1);
        expect(artifact.repairCandidates.every(c => c.rank >= 1)).toBe(true);
        expect(artifact.repairCandidates.some(c => c.preset.agents.some(a => a.role === 'Debugger'))).toBe(true);
    });
});
```

## `src/renderer/services/agent/repair.ts`

```ts
import type { PlanStep } from './plan';
import type { AgentNode, SwarmConfig } from '../../store/swarms';

export interface RepairVerificationSnapshot {
    criteriaMet?: string | null;
    score?: string | null;
    remaining?: string | null;
    evidence?: string | null;
}

export interface SwarmRepairArtifact {
    id: string;
    generatedAt: string;
    runId: string;
    status: 'failed' | 'partial';
    mission: string;
    criteria: string;
    verification: RepairVerificationSnapshot;
    diagnosis: {
        summary: string;
        likelyCauses: string[];
        confidence: number;
    };
    suggestedChanges: Array<{
        type: 'prompt_patch' | 'add_role' | 'dependency_patch' | 'model_shift';
        message: string;
    }>;
    repairCandidates: Array<{
        rank: number;
        score: number;
        rationale: string;
        preset: Omit<SwarmConfig, 'id'>;
    }>;
    suggestedSwarmPreset: Omit<SwarmConfig, 'id'>;
    executionContext: {
        recentResults: string[];
        planSteps: Array<{ id: string; type: string; description: string; dependsOn: string[] }>;
    };
}

interface BuildRepairArtifactInput {
    runId: string;
    mission: string;
    criteria: string;
    status: 'failed' | 'partial';
    verification: RepairVerificationSnapshot;
    previousResults: string[];
    planSteps: PlanStep[];
    preferredModel?: string;
    modelPool?: string[];
}

const makeAgent = (id: number, role: string, model: string, dependsOn?: number[]): AgentNode => ({
    id,
    role,
    model,
    ...(dependsOn && dependsOn.length > 0 ? { dependsOn } : {}),
});

const detectNeedsTester = (text: string): boolean => {
    return /(test|regression|verify|typecheck|lint|failing|failure|assert)/i.test(text);
};

const detectNeedsDebugger = (text: string): boolean => {
    return /(error|exception|stack|crash|bug|retry|timeout|failed after)/i.test(text);
};

const buildCandidateAgents = (
    mode: 'balanced' | 'verification-heavy' | 'debug-first' | 'fast-patch',
    modelAt: (idx: number) => string,
): AgentNode[] => {
    if (mode === 'verification-heavy') {
        return [
            makeAgent(1, 'Architect', modelAt(0)),
            makeAgent(2, 'Coder', modelAt(1), [1]),
            makeAgent(3, 'Tester', modelAt(2), [2]),
            makeAgent(4, 'Reviewer', modelAt(3), [3]),
        ];
    }

    if (mode === 'debug-first') {
        return [
            makeAgent(1, 'Architect', modelAt(0)),
            makeAgent(2, 'Coder', modelAt(1), [1]),
            makeAgent(3, 'Debugger', modelAt(2), [2]),
            makeAgent(4, 'Reviewer', modelAt(3), [3]),
        ];
    }

    if (mode === 'fast-patch') {
        return [
            makeAgent(1, 'Architect', modelAt(0)),
            makeAgent(2, 'Coder', modelAt(1), [1]),
            makeAgent(3, 'Reviewer', modelAt(2), [2]),
        ];
    }

    return [
        makeAgent(1, 'Architect', modelAt(0)),
        makeAgent(2, 'Coder', modelAt(1), [1]),
        makeAgent(3, 'Debugger', modelAt(2), [2]),
        makeAgent(4, 'Tester', modelAt(3), [3]),
        makeAgent(5, 'Reviewer', modelAt(4), [4]),
    ];
};

const scoreCandidate = (
    agents: AgentNode[],
    needsTester: boolean,
    needsDebugger: boolean,
    status: 'failed' | 'partial',
): number => {
    let score = 0.6;
    const roles = new Set(agents.map(a => a.role));

    if (roles.has('Reviewer')) score += 0.06;
    if (needsTester && roles.has('Tester')) score += 0.18;
    if (needsDebugger && roles.has('Debugger')) score += 0.18;
    if (status === 'partial' && roles.has('Tester')) score += 0.03;

    const extraAgents = Math.max(0, agents.length - 4);
    score -= extraAgents * 0.05;

    return Math.max(0.05, Math.min(0.99, Number(score.toFixed(3))));
};

const rationaleForMode = (mode: 'balanced' | 'verification-heavy' | 'debug-first' | 'fast-patch'): string => {
    switch (mode) {
        case 'verification-heavy':
            return 'Prioritizes validation confidence by introducing a dedicated Tester gate before final review.';
        case 'debug-first':
            return 'Prioritizes error isolation by inserting a Debugger before final review.';
        case 'fast-patch':
            return 'Minimizes latency with a compact pipeline focused on rapid patch and review.';
        default:
            return 'Balanced candidate combining debugging, testing, and final review with stronger dependency ordering.';
    }
};

export function buildSwarmRepairArtifact(input: BuildRepairArtifactInput): SwarmRepairArtifact {
    const {
        runId,
        mission,
        criteria,
        status,
        verification,
        previousResults,
        planSteps,
        preferredModel,
        modelPool,
    } = input;

    const combinedFailureText = [
        verification.remaining || '',
        verification.evidence || '',
        ...previousResults.slice(-4),
    ].join('\n');

    const needsTester = detectNeedsTester(combinedFailureText);
    const needsDebugger = detectNeedsDebugger(combinedFailureText);

    const likelyCauses: string[] = [];
    likelyCauses.push('Execution path likely lacked a strict failure-isolation role before final verification.');
    if (needsTester) {
        likelyCauses.push('Verification/test intent appeared late; adding a dedicated tester role should catch regressions earlier.');
    }
    if (needsDebugger) {
        likelyCauses.push('Error-heavy output suggests dedicated debugging and tighter dependency ordering are needed.');
    }

    const suggestedChanges: SwarmRepairArtifact['suggestedChanges'] = [
        {
            type: 'dependency_patch',
            message: 'Force implementation outputs through a verification gate before completion.',
        },
        {
            type: 'prompt_patch',
            message: 'Require explicit evidence summaries after each role execution.',
        },
    ];

    if (needsDebugger) {
        suggestedChanges.push({
            type: 'add_role',
            message: 'Add Debugger role between implementation and test/review stages.',
        });
    }
    if (needsTester) {
        suggestedChanges.push({
            type: 'add_role',
            message: 'Add Tester role to run validation commands before done criteria.',
        });
    }

    const normalizedPool = Array.from(new Set([
        preferredModel || '',
        ...(modelPool || []),
    ].map(m => String(m || '').trim()).filter(Boolean)));
    const fallbackModel = preferredModel?.trim() || normalizedPool[0] || 'model:auto';
    const resolvedModelPool = normalizedPool.length > 0 ? normalizedPool : [fallbackModel];

    const candidateModes: Array<'balanced' | 'verification-heavy' | 'debug-first' | 'fast-patch'> = [
        'balanced',
        'verification-heavy',
        'debug-first',
        'fast-patch',
    ];

    const repairCandidates = candidateModes.map((mode, modeIdx) => {
        const modelAt = (idx: number) => resolvedModelPool[(modeIdx + idx) % resolvedModelPool.length] || fallbackModel;
        const agents = buildCandidateAgents(mode, modelAt);
        const score = scoreCandidate(agents, needsTester || status === 'partial', needsDebugger, status);
        return {
            rank: 0,
            score,
            rationale: rationaleForMode(mode),
            preset: {
                name: `Repair Preset (${mode}): ${mission.slice(0, 28)}`,
                agents,
            },
        };
    }).sort((a, b) => b.score - a.score || a.preset.agents.length - b.preset.agents.length)
      .map((candidate, idx) => ({ ...candidate, rank: idx + 1 }));

    const suggestedSwarmPreset = repairCandidates[0]?.preset || {
        name: `Repair Preset: ${mission.slice(0, 36)}`,
        agents: buildCandidateAgents('balanced', () => fallbackModel),
    };

    const confidence = Math.min(0.95, Math.max(0.55, 0.6 + (needsTester ? 0.1 : 0) + (needsDebugger ? 0.1 : 0)));

    return {
        id: `repair-${Date.now()}`,
        generatedAt: new Date().toISOString(),
        runId,
        status,
        mission,
        criteria,
        verification,
        diagnosis: {
            summary: status === 'partial'
                ? 'Run was partially successful but lacked a robust verification/closure structure.'
                : 'Run failed verification and needs a stronger role graph and stricter sequencing.',
            likelyCauses,
            confidence,
        },
        suggestedChanges,
        repairCandidates,
        suggestedSwarmPreset,
        executionContext: {
            recentResults: previousResults.slice(-8),
            planSteps: planSteps.map(step => ({
                id: step.id,
                type: step.type,
                description: step.description,
                dependsOn: step.dependsOn,
            })),
        },
    };
}

export async function persistSwarmRepairArtifact(projectPath: string | null, artifact: SwarmRepairArtifact): Promise<void> {
    if (!projectPath) return;

    const dir = `${projectPath}/.vibe/swarm-repairs`;
    const artifactPath = `${dir}/${artifact.id}.json`;
    const latestPath = `${dir}/latest.json`;

    await window.vibe.writeFile(artifactPath, JSON.stringify(artifact, null, 2));
    await window.vibe.writeFile(latestPath, JSON.stringify(artifact, null, 2));
}
```

## `src/renderer/services/agent/runtime.ts`

```ts
import { useOllamaStore } from '../../store/ollama';
import { useTerminalStore } from '../../store/terminal';
import { cleanTerminalOutput } from '../../utils/terminal';

interface StopAwareOptions {
    shouldStop?: () => boolean;
}

export function getThinkOptions() {
    const store = useOllamaStore.getState();
    const caps = store.modelCapabilities[store.selectedModel] ?? {};
    if (!caps.think || !store.thinkEnabled) return null;
    return { enabled: true, level: store.thinkLevel };
}

export async function pollTerminalOutput(
    termId: string,
    options: StopAwareOptions = {},
): Promise<string> {
    const { shouldStop } = options;

    let rawOutput = '';
    let pollAttempts = 0;
    const MAX_POLL = 60;

    while (pollAttempts < MAX_POLL) {
        if (shouldStop?.()) break;

        await new Promise(r => setTimeout(r, 500));
        rawOutput = await window.vibe.getTerminalOutput(termId);

        if (rawOutput.length > 3) {
            const lines = rawOutput.split('\n').filter(l => l.trim());
            const lastLine = lines[lines.length - 1]?.trim() || '';
            if (/^PS [A-Za-z]:\\/.test(lastLine)) break;
            if (rawOutput.length > 100 && pollAttempts >= 6) break;
        }
        pollAttempts++;
    }

    await window.vibe.clearTerminalOutput(termId);
    return cleanTerminalOutput(rawOutput);
}

export async function getProjectSnapshot(
    projectPath: string,
    options: StopAwareOptions = {},
): Promise<string> {
    const { shouldStop } = options;

    try {
        const terminalId = useTerminalStore.getState().activeTerminalId;
        if (!terminalId) return 'Project structure unavailable';

        await window.vibe.clearTerminalOutput(terminalId);
        window.vibe.sendTerminalInput(
            terminalId,
            `cd "${projectPath}"; ` +
            `Get-ChildItem -Recurse -Depth 3 ` +
            `-Exclude @('node_modules','build','dist','.git',` +
            `'__pycache__','.vibe') ` +
            `| Select-Object FullName | Format-Table -HideTableHeaders` +
            `\r`,
        );

        await new Promise(r => setTimeout(r, 3000));
        if (shouldStop?.()) {
            await window.vibe.clearTerminalOutput(terminalId);
            return 'Project scan canceled';
        }

        const raw = await window.vibe.getTerminalOutput(terminalId);
        await window.vibe.clearTerminalOutput(terminalId);

        const lines = raw
            .split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('PS '))
            .map(l => l.replace(projectPath, '').replace(/^\\/, ''))
            .filter(l => l.length > 0)
            .slice(0, 150);

        return lines.join('\n') || 'Empty project';
    } catch {
        return 'Could not scan project';
    }
}

export async function getBriefingContext(): Promise<string> {
    try {
        const briefing = await window.vibe.getBriefing();
        if (briefing && briefing !== 'No project briefing available yet.') {
            return `\nPROJECT BRIEFING (from background intelligence):\n${briefing}\n`;
        }
    } catch {
        // Ignore background briefing failures; chat should continue.
    }
    return '';
}
```

## `src/renderer/services/agent/stream.test.ts`

```ts
import { waitForStreamDone } from './stream';
import { describe, expect, it } from 'vitest';

describe('stream cancellation', () => {
    it('resolves on done chunk', async () => {
        const listeners: Array<(chunk: { content: string; done: boolean }) => void> = [];
        const subscribe = (handler: (chunk: { content: string; done: boolean }) => void) => {
            listeners.push(handler);
            return () => {
                const i = listeners.indexOf(handler);
                if (i >= 0) listeners.splice(i, 1);
            };
        };

        const p = waitForStreamDone({ subscribe, shouldStop: () => false, timeoutMs: 5000 });
        listeners[0]({ content: 'hello ', done: false });
        listeners[0]({ content: 'world', done: false });
        listeners[0]({ content: '', done: true });

        await expect(p).resolves.toBe('hello world');
    });

    it('resolves early when stop is requested', async () => {
        let stop = false;
        const listeners: Array<(chunk: { content: string; done: boolean }) => void> = [];
        const subscribe = (handler: (chunk: { content: string; done: boolean }) => void) => {
            listeners.push(handler);
            return () => {};
        };

        const p = waitForStreamDone({ subscribe, shouldStop: () => stop, timeoutMs: 5000, pollIntervalMs: 10 });
        listeners[0]({ content: 'partial', done: false });
        stop = true;

        await expect(p).resolves.toBe('partial');
    });
});
```

## `src/renderer/services/agent/stream.ts`

```ts
type StreamChunk = { content: string; done: boolean };

type SubscribeFn = (handler: (chunk: StreamChunk) => void) => () => void;

interface WaitForStreamDoneOptions {
    subscribe: SubscribeFn;
    shouldStop: () => boolean;
    timeoutMs?: number;
    pollIntervalMs?: number;
    onTimeout?: () => void;
    onResolved?: () => void;
}

export function waitForStreamDone(options: WaitForStreamDoneOptions): Promise<string> {
    const {
        subscribe,
        shouldStop,
        timeoutMs = 120000,
        pollIntervalMs = 100,
        onTimeout,
        onResolved,
    } = options;

    return new Promise((resolve) => {
        let fullContent = '';
        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;
            clearTimeout(timeout);
            clearInterval(cancelPoll);
            unsub();
            onResolved?.();
            resolve(fullContent);
        };

        const cancelPoll = setInterval(() => {
            if (!finished && shouldStop()) {
                finish();
            }
        }, pollIntervalMs);

        const timeout = setTimeout(() => {
            if (finished) return;
            onTimeout?.();
            finish();
        }, timeoutMs);

        const unsub = subscribe((chunk) => {
            if (chunk.content) fullContent += chunk.content;
            if (chunk.done) {
                finish();
            }
        });
    });
}
```

## `src/renderer/services/agent/swarm.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { computeAgentWaves } from './swarm';

describe('swarm service', () => {
    it('computes dependency waves', () => {
        const agents = [
            { id: 1, role: 'Architect', model: 'a' },
            { id: 2, role: 'Coder', model: 'b', dependsOn: [1] },
            { id: 3, role: 'Reviewer', model: 'c', dependsOn: [1] },
            { id: 4, role: 'Integrator', model: 'd', dependsOn: [2, 3] },
        ];

        const withWaves = computeAgentWaves(agents);
        const wavesById = Object.fromEntries(withWaves.map(a => [a.id, a.wave]));

        expect(wavesById[1]).toBe(0);
        expect(wavesById[2]).toBe(1);
        expect(wavesById[3]).toBe(1);
        expect(wavesById[4]).toBe(2);
    });

    it('handles missing dependency ids as zero-wave deps', () => {
        const agents = [
            { id: 1, role: 'A', model: 'm', dependsOn: [99] },
        ];

        const withWaves = computeAgentWaves(agents);
        expect(withWaves[0].wave).toBe(0);
    });
});
```

## `src/renderer/services/agent/swarm.ts`

```ts
import type { ChatMessage } from '../../../shared/types';
import { useOllamaStore } from '../../store/ollama';
import { useUIStore } from '../../store/ui';
import type { AgentNode, SwarmConfig, SwarmHandoff } from '../../store/swarms';

interface AgentNodeWithWave extends AgentNode {
    wave: number;
}

export function computeAgentWaves(agents: AgentNode[]): AgentNodeWithWave[] {
    const getWave = (agent: AgentNode, allAgents: AgentNode[]): number => {
        if (!agent.dependsOn || agent.dependsOn.length === 0) return 0;
        const depWaves = agent.dependsOn.map(depId => {
            const dep = allAgents.find(a => a.id === depId);
            return dep ? getWave(dep, allAgents) + 1 : 0;
        });
        return Math.max(...depWaves);
    };

    return agents.map(agent => ({
        ...agent,
        wave: getWave(agent, agents),
    }));
}

export interface RunSwarmDeps {
    apiKeys: Record<string, string>;
    shouldStop: () => boolean;
    waitForStreamDone: (timeoutMs?: number) => Promise<string>;
}

export async function runSwarm(swarm: SwarmConfig, userInput: string, deps: RunSwarmDeps): Promise<void> {
    const { apiKeys, shouldStop, waitForStreamDone } = deps;

    useOllamaStore.getState().setIsGenerating(true);
    const projectPath = useUIStore.getState().projectPath;

    try {
        const sharedContext: Record<string, string> = {};
        const agentsWithWaves = computeAgentWaves(swarm.agents);
        const maxWave = Math.max(...agentsWithWaves.map(a => a.wave));

        for (let wave = 0; wave <= maxWave; wave++) {
            if (shouldStop()) return;
            const waveAgents = agentsWithWaves.filter(a => a.wave === wave);

            useOllamaStore.getState().addMessage({
                role: 'user',
                content: `__SWARM_LABEL__Wave ${wave + 1} - ${waveAgents.map(a => a.role).join(', ')}`,
            });

            useOllamaStore.getState().setAgentStatus(
                `Wave ${wave + 1}/${maxWave + 1}: Running ${waveAgents.map(a => a.role).join(' -> ')} safely...`,
            );

            for (const agent of waveAgents) {
                if (shouldStop()) return;
                const depContext = agent.dependsOn
                    ? agent.dependsOn.map(depId => {
                        const depAgent = swarm.agents.find(a => a.id === depId);
                        const role = depAgent?.role || String(depId);
                        return sharedContext[role] ? `\n\n[${role} output]:\n${sharedContext[role]}` : '';
                    }).join('')
                    : '';

                const handoff: SwarmHandoff = {
                    originalRequest: userInput,
                    previousAgentRole: Object.keys(sharedContext)[Object.keys(sharedContext).length - 1] || 'none',
                    previousAgentOutput: Object.values(sharedContext)[Object.values(sharedContext).length - 1] || '',
                    sharedContext,
                };

                const sysPrompt = agent.role === 'Architect'
                    ? `You are the Architect agent in a multi-agent swarm. Your job is analysis and planning only.

Original request: ${userInput}

Produce a detailed, numbered execution plan. Be specific about file names, commands, logic, and edge cases. Output only the plan - no code, no implementation.`
                    : `You are the ${agent.role} agent in a multi-agent swarm.

Original request: ${handoff.originalRequest}
${depContext}

Full shared context from previous agents:
${Object.entries(handoff.sharedContext).map(([role, output]) => `[${role}]:\n${output}`).join('\n\n')}

Execute your part of the work using VIBE tools:
- <read_file path="file"/> before editing any existing file
- <write_file path="file">complete content</write_file> for creating/editing files
- <execute>powershell command</execute> for terminal commands
- Windows PowerShell only. Complete files only, no placeholders.
- <done>summary</done> when your part is complete.${projectPath ? `\nProject path: ${projectPath}` : ''}`;

                const msgs: ChatMessage[] = [
                    { role: 'system', content: sysPrompt },
                    { role: 'user', content: agent.role === 'Architect' ? userInput : 'Execute your role. Context is in your system prompt.' },
                ];

                useOllamaStore.getState().addMessage({ role: 'user', content: `__SWARM_LABEL__  > ${agent.role} (${agent.model})` });
                useOllamaStore.getState().addMessage({ role: 'assistant', content: '' });

                await window.vibe.chat(agent.model, msgs, apiKeys);
                const output = await waitForStreamDone();
                if (shouldStop()) return;

                sharedContext[agent.role] = output;
            }
        }
    } finally {
        useOllamaStore.getState().setIsGenerating(false);
        useOllamaStore.getState().setAgentStep(0, 0);
        useOllamaStore.getState().setAgentStatus('');
    }
}
```

## `src/renderer/services/agent/xml.ts`

```ts
export function extractTag(text: string, tag: string): string | null {
    try {
        const match = text.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
        return match ? match[1].trim() : null;
    } catch {
        return null;
    }
}
```

## `src/renderer/services/agentClient.ts`

```ts
import type { AgentDelta, MessagePart, PermissionScope, RunRequest, Surface } from '../../shared/agent';
import type { RunItem } from '../store/agentRun';
import { useAgentRunStore } from '../store/agentRun';
import { useSettingsStore } from '../store/settings';
import { useOllamaStore } from '../store/ollama';
import { useUIStore } from '../store/ui';
import { useEditorStore } from '../store/editor';
import { setModelContent } from '../components/editor/MonacoEditor';
import { getFallbackCapabilities } from '../utils/capabilities';
import { useDebateStore } from '../store/debate';
import { terminalBus, formatAgentBlock } from '../utils/terminalBus';

let wired = false;

/** Subscribe once to the kernel delta stream and fan it into the store. */
export function initAgentClient() {
    if (wired) return;
    wired = true;
    window.vibe.kernel.onDelta((d) => {
        useAgentRunStore.getState().apply(d);
        followAgentFiles(d);
        mirrorAgentTerminal(d);
    });
}

/** Mirror the agent's bash command + output into any mounted terminal pane so
    the user watches it run in a real terminal (display only). */
function mirrorAgentTerminal(d: AgentDelta) {
    // Always record (even if no terminal is open) so the log is complete when
    // the user opens/reopens the terminal later.
    if (d.t === 'tool_result' && d.name === 'bash') {
        terminalBus.write(formatAgentBlock(d.content, d.data as any));
    }
}

/* -- IDE layout: the editor follows whatever file the agent is touching. --- */
const FOLLOW_TOOLS = new Set(['read_file', 'write_file', 'edit_file']);
const MUTATING_TOOLS = new Set(['write_file', 'edit_file']);
const callPaths = new Map<string, { path: string; mutating: boolean }>();

function resolveProjectPath(p: string): string {
    if (/^([a-zA-Z]:[\\/]|\\\\|\/)/.test(p)) return p; // already absolute (win drive/UNC/posix)
    const root = useUIStore.getState().projectPath;
    return root ? `${root.replace(/[\\/]+$/, '')}/${p}` : p;
}

function openInEditor(path: string) {
    window.vibe.readFile(path)
        .then((content) => {
            useEditorStore.getState().openFile(path, content); // appends a tab (multi-file), makes it active
            useEditorStore.getState().updateContent(path, content);
            setModelContent(path, content); // sync an already-open Monaco model
            // Make the file visible: in chat layout the Workspace panel may be
            // closed - pop it open so agent-touched files actually show up.
            const ui = useUIStore.getState();
            if (ui.layoutMode !== 'ide' && !ui.workspaceOpen) ui.setWorkspaceOpen(true);
        })
        .catch(() => { /* unreadable (binary/deleted/out-of-root) - don't follow */ });
}

function followAgentFiles(d: AgentDelta) {
    // Follow in both layouts (IDE always shows the editor; chat layout gets the
    // Workspace panel auto-opened). Skip where there is no editor to show into.
    if (useAgentRunStore.getState().surface === 'design') return; // Design layout has a canvas, not an editor
    if (d.t === 'tool_call' && FOLLOW_TOOLS.has(d.name)) {
        const p = (d.input as any)?.path;
        if (typeof p !== 'string' || !p) return;
        const abs = resolveProjectPath(p);
        callPaths.set(d.id, { path: abs, mutating: MUTATING_TOOLS.has(d.name) });
        if (!MUTATING_TOOLS.has(d.name)) openInEditor(abs); // reads: show immediately
    } else if (d.t === 'tool_result') {
        const rec = callPaths.get(d.id);
        callPaths.delete(d.id);
        // writes/edits: open AFTER the change lands so the editor shows the result
        if (rec?.mutating && d.ok) openInEditor(rec.path);
    }
}

/** Does this model accept images natively? Real capability flag first, then a
    name-pattern fallback for models Ollama hasn't reported on. */
function modelHasVision(model: string): boolean {
    const caps = useOllamaStore.getState().modelCapabilities[model];
    if (caps && (caps.vision || caps.image)) return true;
    return !!getFallbackCapabilities(model).vision;
}

/** Routing (cloud vs local) for a given model name. */
function modelRouting(model: string): { ollamaCloud: boolean; ollamaLocal: boolean } {
    const o = useOllamaStore.getState();
    const local = o.models.includes(model);
    const cloud = (o.cloudModelNames.includes(model) && !local) || /(?::|-)cloud\b/i.test(model);
    return { ollamaCloud: cloud, ollamaLocal: local };
}

/** Choose a vision-capable model to describe images for a non-vision main model.
    Order: explicit user preference -> a vision-capable cloud (Pro) model ->
    a vision-capable local model. Null if none is available. */
function pickVisionModel(): { model: string; ollamaCloud: boolean; ollamaLocal: boolean } | null {
    const pref = useSettingsStore.getState().visionModel;
    if (pref) return { model: pref, ...modelRouting(pref) };
    const o = useOllamaStore.getState();
    const cloud = o.cloudModelNames.find(modelHasVision);
    if (cloud) return { model: cloud, ...modelRouting(cloud) };
    const local = o.models.find(modelHasVision);
    if (local) return { model: local, ...modelRouting(local) };
    return null;
}

async function ensureSession(surface: Surface, model: string): Promise<string> {
    const store = useAgentRunStore.getState();
    const existing = store.sessions[surface];
    if (existing) return existing;
    const projectRoot = useUIStore.getState().projectPath;
    const rec = await window.vibe.kernel.createSession({ surface, projectRoot, model });
    store.setSession(surface, rec.id);
    return rec.id;
}

/** Send a user turn to the kernel for the active surface. */
export async function runTurn(text: string, images: { mimeType: string; dataBase64: string }[] = []) {
    const store = useAgentRunStore.getState();
    const surface = store.surface;
    const activeModel = store.model;
    if (!activeModel) { store.apply({ t: 'error', runId: '', message: 'No model selected.' }); return; }

    const firstTurn = store.items.length === 0;
    const sessionId = await ensureSession(surface, activeModel);
    if (firstTurn && text.trim()) {
        const title = text.trim().replace(/\s+/g, ' ').slice(0, 48);
        window.vibe.kernel.renameSession(sessionId, title).catch(() => {});
    }
    const projectRoot = useUIStore.getState().projectPath;
    const keys = useSettingsStore.getState().apiKeys as Record<string, string>;
    const localModels = useOllamaStore.getState().models;
    const cloudNames = useOllamaStore.getState().cloudModelNames;
    const ollamaLocal = localModels.includes(activeModel);
    const ollamaCloud = cloudNames.includes(activeModel) && !ollamaLocal;

    // Worker models the conductor can dispatch to (local + cloud), minus the
    // conductor's own model.
    const availableModels = [...new Set([...localModels, ...cloudNames])].filter((m) => m !== activeModel);

    // Vision fallback: if the user attached images but the active model can't see,
    // route the images through a vision-capable model that describes them as text.
    let vision: { model: string; ollamaCloud: boolean; ollamaLocal: boolean } | undefined;
    if (images.length > 0 && !modelHasVision(activeModel)) {
        const picked = pickVisionModel();
        if (picked && picked.model !== activeModel) vision = picked;
        else if (!picked) store.pushAssistant('_You attached an image but the current model has no vision, and no vision-capable model is available. Pick a vision model in Settings → Models, or switch to a model that can see._');
    }

    const parts: MessagePart[] = [];
    if (text.trim()) parts.push({ type: 'text', text });
    for (const img of images) parts.push({ type: 'image', mimeType: img.mimeType, dataBase64: img.dataBase64 });

    store.pushUser(text, images);
    store.beginRun();

    const req: RunRequest = {
        sessionId,
        surface,
        model: activeModel,
        projectRoot,
        input: parts,
        apiKeys: keys,
        ollamaApiKey: keys.ollama || '',
        ollamaCloud,
        ollamaLocal,
        think: null,
        autoApprove: useSettingsStore.getState().permissionMode === 'auto',
        mode: useSettingsStore.getState().agentMode,
        availableModels,
        vision,
    };
    try {
        await window.vibe.kernel.run(req);
    } catch (e: any) {
        useAgentRunStore.getState().pushError(sessionId, e?.message || String(e));
    } finally {
        // The 'done' delta normally clears the running flag on the right
        // conversation; this is the safety net if the IPC call itself blew up.
        useAgentRunStore.getState().finishRun(sessionId);
    }
}

export function cancelRun() {
    const runId = useAgentRunStore.getState().runId;
    if (runId) window.vibe.kernel.cancel(runId);
}

export function approvePermission(reqId: string, decision: 'allow' | 'deny', scope: PermissionScope) {
    // Resolve against the request's OWN run - the prompt may belong to a
    // conversation that is no longer on screen.
    const st = useAgentRunStore.getState();
    const req = st.pendingPermissions.find((p) => p.id === reqId)
        || Object.values(st.stash).flatMap((v) => v.pendingPermissions).find((p) => p.id === reqId);
    const runId = req?.runId || st.runId;
    if (runId) window.vibe.kernel.approve(runId, { reqId, decision, scope });
}

/** Submit the user's selections for an ask_user question card. */
export function answerQuestion(reqId: string, answers: Record<string, string[]>) {
    window.vibe.kernel.answer(reqId, answers).catch(() => {});
}

/** Approve everything currently waiting (used when switching to auto-allow). */
export function approveAllPending() {
    const st = useAgentRunStore.getState();
    const all = [...st.pendingPermissions, ...Object.values(st.stash).flatMap((v) => v.pendingPermissions)];
    for (const p of all) window.vibe.kernel.approve(p.runId, { reqId: p.id, decision: 'allow', scope: 'session' });
}

/** Point the whole workspace (file tree, VIBE.md, runs, agent cwd) at a
    session's own folder. Each chat is bound to the folder it was created in;
    switching chats switches the active folder. */
async function applySessionFolder(sessionId: string) {
    try {
        const rec = await window.vibe.kernel.getSession(sessionId);
        const folder = rec?.projectRoot || null;
        if (folder && folder !== useUIStore.getState().projectPath) {
            useUIStore.getState().setProjectPath(folder);
            try { window.vibe.watchFolder(folder); } catch { /* ignore */ }
        }
    } catch { /* ignore */ }
}

/** Switch surface: stash the live view, restore the target's (or load history). */
export async function switchSurface(surface: Surface) {
    const store = useAgentRunStore.getState();
    if (store.surface === surface) return;
    useDebateStore.getState().reset(); // don't carry a debate view across surfaces
    store.stashActive();
    store.setSurface(surface);
    const sessionId = store.sessions[surface];
    if (sessionId) applySessionFolder(sessionId); // follow this surface's chat folder
    const key = sessionId || `draft:${surface}`;
    if (useAgentRunStore.getState().restoreStash(key)) return; // mid-stream view - full transcript intact
    store.clear();
    if (!sessionId) return;
    await loadPersisted(sessionId);
}

/** Fetch a session's saved transcript, guarding against the user switching again mid-fetch. */
async function loadPersisted(sessionId: string) {
    try {
        const msgs = await window.vibe.kernel.getMessages(sessionId);
        const store = useAgentRunStore.getState();
        if (store.activeKey() !== sessionId) return; // stale fetch - user moved on
        const items = msgs.flatMap((m, i): RunItem[] => {
            if (m.role === 'user') return [{ kind: 'user', id: `h_${i}`, text: partsText(m.parts), images: partsImages(m.parts) }];
            if (m.role === 'assistant') {
                const t = partsText(m.parts);
                return t ? [{ kind: 'assistant', id: `h_${i}`, text: t }] : [];
            }
            if (m.role === 'tool') {
                // Reconstruct tool result cards from persisted tool messages.
                const toolParts = m.parts.filter((p): p is Extract<MessagePart, { type: 'tool_result' }> => p.type === 'tool_result');
                return toolParts.map((p, k) => ({
                    kind: 'tool' as const,
                    id: p.toolUseId || `h_${i}_${k}`,
                    name: p.name || 'tool',
                    render: p.name || 'tool',
                    status: (p.isError ? 'error' : 'ok') as 'ok' | 'error',
                    resultContent: p.content,
                }));
            }
            return [];
        });
        store.setItems(items);
    } catch { /* ignore */ }
}

function partsImages(parts: MessagePart[]): { mimeType: string; dataBase64: string }[] {
    return parts.filter((p) => p.type === 'image').map((p: any) => ({ mimeType: p.mimeType, dataBase64: p.dataBase64 }));
}

function partsText(parts: MessagePart[]): string {
    return parts.filter((p) => p.type === 'text').map((p: any) => p.text).join('');
}

/** Start a fresh conversation for the current surface. */
export function newChat() {
    const store = useAgentRunStore.getState();
    store.stashActive();               // a streaming chat keeps living off-screen
    store.setSession(store.surface, '');
    store.clear();
    useDebateStore.getState().reset(); // a finished debate belongs to its own chat
}

/** Start a fresh chat bound to the currently open project (or unattached if none). */
export function newChatInCurrentProject() {
    const projectRoot = useUIStore.getState().projectPath;
    newChatForProject(projectRoot);
}

/** Start a fresh chat bound to a specific project folder. */
export async function newChatForProject(projectRoot: string | null | undefined) {
    if (projectRoot && projectRoot !== useUIStore.getState().projectPath) {
        useUIStore.getState().setProjectPath(projectRoot);
        try { window.vibe.watchFolder(projectRoot); } catch { /* ignore */ }
    }
    newChat();
}

/** Load a specific past session into the view. */
export async function loadSession(surface: Surface, sessionId: string) {
    const store = useAgentRunStore.getState();
    if (store.surface === surface && store.sessions[surface] === sessionId) return;
    useDebateStore.getState().reset(); // debate view is scoped to the chat that ran it
    store.stashActive();
    store.setSurface(surface);
    store.setSession(surface, sessionId);
    applySessionFolder(sessionId); // switch the workspace to this chat's folder
    if (useAgentRunStore.getState().restoreStash(sessionId)) return; // live view survives the round trip
    store.clear();
    await loadPersisted(sessionId);
}

/** Regenerate the last assistant turn: rewind history + rerun the last user message. */
export async function regenerate() {
    const store = useAgentRunStore.getState();
    if (store.running) return;
    const surface = store.surface;
    const sessionId = store.sessions[surface];
    const text = store.dropFromLastUser();
    if (!text || !sessionId) return;
    await window.vibe.kernel.sessionRewind(sessionId).catch(() => {});
    await runTurn(text);
}

/** Pull the last user message back for editing; returns its text. */
export async function editLast(): Promise<string> {
    const store = useAgentRunStore.getState();
    if (store.running) return '';
    const surface = store.surface;
    const sessionId = store.sessions[surface];
    const text = store.dropFromLastUser();
    if (sessionId) await window.vibe.kernel.sessionRewind(sessionId).catch(() => {});
    return text;
}
```

## `src/renderer/store/agentRun.switch.test.ts`

```ts
/* Regression tests for the "response gets cut when you switch chats mid-stream"
   bug: deltas must keep accumulating into their own conversation while another
   one is on screen, and the full transcript must come back on restore. */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentRunStore } from './agentRun';

const reset = () => {
    useAgentRunStore.setState({
        surface: 'cowork', model: 'm', sessions: {},
        items: [], runId: null, running: false,
        currentAssistantId: null, currentThinkingId: null, currentModel: '',
        pendingPermissions: [], composerDraft: '', stash: {}, runSessions: {},
    });
};

describe('agentRun store - mid-stream chat switching', () => {
    beforeEach(reset);

    it('keeps streaming into a stashed conversation and restores the full transcript', () => {
        const st = () => useAgentRunStore.getState();

        // Conversation A starts a run and streams some text.
        st().setSession('cowork', 'sessA');
        st().pushUser('do the thing');
        st().beginRun();
        st().apply({ t: 'run_start', runId: 'r1', surface: 'cowork', model: 'm', sessionId: 'sessA' });
        st().apply({ t: 'text', runId: 'r1', v: 'Hello ' });
        expect(st().items.some((i) => i.kind === 'assistant' && i.text === 'Hello ')).toBe(true);

        // User switches to conversation B mid-stream.
        st().stashActive();
        st().setSession('cowork', 'sessB');
        st().clear();
        expect(st().items.length).toBe(0);

        // A's deltas keep arriving - they must land in the stash, not on screen.
        st().apply({ t: 'text', runId: 'r1', v: 'world' });
        st().apply({ t: 'tool_call', runId: 'r1', id: 'tc1', name: 'bash', input: {}, render: 'Run: ls' });
        st().apply({ t: 'tool_result', runId: 'r1', id: 'tc1', name: 'bash', ok: true, content: 'ok' });
        st().apply({ t: 'text', runId: 'r1', v: '!' });
        expect(st().items.length).toBe(0); // nothing leaked into B

        // Switch back: full transcript is there, still marked running.
        st().setSession('cowork', 'sessA');
        expect(st().restoreStash('sessA')).toBe(true);
        const asst = st().items.filter((i) => i.kind === 'assistant') as any[];
        expect(asst.map((a) => a.text)).toContain('Hello world');
        expect(asst.map((a) => a.text)).toContain('!'); // new bubble after the tool call
        expect(st().items.some((i) => i.kind === 'tool')).toBe(true);
        expect(st().running).toBe(true);

        // Run finishes on screen.
        st().apply({ t: 'done', runId: 'r1', stopReason: 'end_turn' });
        expect(st().running).toBe(false);
        expect(st().runSessions['r1']).toBeUndefined();
    });

    it('finishes a run that ended while its conversation was stashed', () => {
        const st = () => useAgentRunStore.getState();
        st().setSession('cowork', 'sessA');
        st().pushUser('x');
        st().beginRun();
        st().apply({ t: 'run_start', runId: 'r1', surface: 'cowork', model: 'm', sessionId: 'sessA' });
        st().stashActive();
        st().setSession('cowork', 'sessB');
        st().clear();

        st().apply({ t: 'text', runId: 'r1', v: 'done elsewhere' });
        st().apply({ t: 'done', runId: 'r1', stopReason: 'end_turn' });

        st().setSession('cowork', 'sessA');
        expect(st().restoreStash('sessA')).toBe(true);
        expect(st().running).toBe(false);
        expect(st().items.some((i) => i.kind === 'assistant' && (i as any).text === 'done elsewhere')).toBe(true);
    });

    it('ignores runs for unknown sessions (scheduled/background)', () => {
        const st = () => useAgentRunStore.getState();
        st().setSession('cowork', 'sessA');
        st().apply({ t: 'run_start', runId: 'bg1', surface: 'cowork', model: 'm', sessionId: 'ghost' });
        st().apply({ t: 'text', runId: 'bg1', v: 'leak?' });
        expect(st().items.length).toBe(0);
        expect(st().runSessions['bg1']).toBeUndefined();
    });

    it('routes permission prompts to the right conversation and resolves off-screen', () => {
        const st = () => useAgentRunStore.getState();
        st().setSession('cowork', 'sessA');
        st().pushUser('x');
        st().beginRun();
        st().apply({ t: 'run_start', runId: 'r1', surface: 'cowork', model: 'm', sessionId: 'sessA' });

        st().stashActive();
        st().setSession('cowork', 'sessB');
        st().clear();

        const req = { id: 'p1', runId: 'r1', toolName: 'bash', tier: 'exec' as const, render: 'Run: ls', target: 'ls', input: {} };
        st().apply({ t: 'permission_req', runId: 'r1', req });
        expect(st().pendingPermissions.length).toBe(0);          // not on screen
        expect(st().stash['sessA'].pendingPermissions.length).toBe(1);

        st().apply({ t: 'permission_resolved', runId: 'r1', reqId: 'p1', decision: 'allow' });
        expect(st().stash['sessA'].pendingPermissions.length).toBe(0);
    });
});
```

## `src/renderer/store/agentRun.ts`

```ts
import { create } from 'zustand';
import type {
    AgentDelta, PermissionRequest, Surface, SessionRecord, UserQuestionRequest,
} from '../../shared/agent';
import { useUsageStore } from './usage';

export interface ToolItemData {
    kind: 'tool';
    id: string;
    name: string;
    render: string;
    status: 'running' | 'ok' | 'error';
    resultContent?: string;
    data?: any;
}
export type RunItem =
    | { kind: 'user'; id: string; text: string; images?: { mimeType: string; dataBase64: string }[] }
    | { kind: 'assistant'; id: string; text: string; model?: string }
    | { kind: 'thinking'; id: string; text: string }
    | ToolItemData
    | { kind: 'permission'; id: string; req: PermissionRequest; resolved?: 'allow' | 'deny' }
    | { kind: 'question'; id: string; req: UserQuestionRequest; answers?: Record<string, string[]>; dismissed?: boolean }
    | { kind: 'status'; id: string; text: string }
    | { kind: 'error'; id: string; text: string };

/** Everything one conversation needs to keep streaming while off-screen. */
export interface SessionView {
    items: RunItem[];
    runId: string | null;
    running: boolean;
    currentAssistantId: string | null;
    currentThinkingId: string | null;
    currentModel: string;
    pendingPermissions: PermissionRequest[];
    usage: { inputTokens: number; outputTokens: number };
}

const emptyView = (): SessionView => ({
    items: [], runId: null, running: false,
    currentAssistantId: null, currentThinkingId: null,
    currentModel: '', pendingPermissions: [],
    usage: { inputTokens: 0, outputTokens: 0 },
});

const MAX_STASHED_VIEWS = 12;

let seq = 0;
const nid = () => `it_${Date.now()}_${seq++}`;

/** Pure per-view reducer - applied to the on-screen view OR a stashed one. */
function reduceView(view: SessionView, d: AgentDelta): SessionView {
    const items = view.items.slice();
    const v: SessionView = { ...view, items };
    const findLast = (id: string | null) => (id ? items.findIndex((x) => x.id === id) : -1);

    switch (d.t) {
        case 'run_start':
            v.runId = d.runId; v.running = true; v.currentModel = d.model;
            v.currentAssistantId = null; v.currentThinkingId = null;
            break;
        case 'text': {
            const idx = findLast(view.currentAssistantId);
            if (idx === -1) {
                const id = nid();
                items.push({ kind: 'assistant', id, text: d.v, model: view.currentModel });
                v.currentAssistantId = id;
            } else {
                const it = items[idx] as any;
                items[idx] = { ...it, text: it.text + d.v };
            }
            break;
        }
        case 'thinking': {
            const idx = findLast(view.currentThinkingId);
            if (idx === -1) {
                const id = nid();
                items.push({ kind: 'thinking', id, text: d.v });
                v.currentThinkingId = id;
            } else {
                const it = items[idx] as any;
                items[idx] = { ...it, text: it.text + d.v };
            }
            break;
        }
        case 'tool_call':
            items.push({ kind: 'tool', id: d.id, name: d.name, render: d.render || d.name, status: 'running' });
            v.currentAssistantId = null;
            v.currentThinkingId = null;
            break;
        case 'tool_result': {
            const idx = items.findIndex((x) => x.kind === 'tool' && x.id === d.id);
            if (idx !== -1) {
                const it = items[idx] as ToolItemData;
                items[idx] = { ...it, status: d.ok ? 'ok' : 'error', resultContent: d.content, data: d.data };
            }
            break;
        }
        case 'status':
            items.push({ kind: 'status', id: nid(), text: d.v });
            break;
        case 'permission_req':
            items.push({ kind: 'permission', id: d.req.id, req: d.req });
            v.pendingPermissions = [...view.pendingPermissions, d.req];
            v.currentAssistantId = null;
            break;
        case 'permission_resolved': {
            const idx = items.findIndex((x) => x.kind === 'permission' && x.id === d.reqId);
            if (idx !== -1) {
                const it = items[idx] as any;
                items[idx] = { ...it, resolved: d.decision };
            }
            v.pendingPermissions = view.pendingPermissions.filter((p) => p.id !== d.reqId);
            break;
        }
        case 'ask_user':
            items.push({ kind: 'question', id: d.req.id, req: d.req });
            v.currentAssistantId = null;
            v.currentThinkingId = null;
            break;
        case 'ask_user_resolved': {
            const idx = items.findIndex((x) => x.kind === 'question' && x.id === d.reqId);
            if (idx !== -1) {
                const it = items[idx] as any;
                items[idx] = { ...it, answers: d.answers };
            }
            break;
        }
        case 'usage':
            v.usage = {
                inputTokens: view.usage.inputTokens + (d.inputTokens ?? 0),
                outputTokens: view.usage.outputTokens + (d.outputTokens ?? 0),
            };
            break;
        case 'error':
            items.push({ kind: 'error', id: nid(), text: d.message });
            break;
        case 'done':
            v.running = false; v.runId = null;
            v.currentAssistantId = null; v.currentThinkingId = null;
            // A question still waiting can never be answered once the run ends
            // (stopped/errored) - dismiss it so the panel closes instead of
            // hanging around in a dead state.
            for (let k = 0; k < items.length; k++) {
                const it = items[k];
                if (it.kind === 'question' && !it.answers && !it.dismissed) {
                    items[k] = { ...it, dismissed: true };
                }
            }
            break;
    }
    return v;
}

interface AgentRunState {
    surface: Surface;
    model: string;
    sessions: Partial<Record<Surface, string>>;   // surface -> sessionId

    // The ACTIVE (on-screen) view, flattened so existing components keep working.
    items: RunItem[];
    runId: string | null;
    running: boolean;
    currentAssistantId: string | null;
    currentThinkingId: string | null;
    currentModel: string;
    pendingPermissions: PermissionRequest[];
    usage: { inputTokens: number; outputTokens: number };

    composerDraft: string;

    /** Off-screen conversations that are (or were) streaming - keyed by sessionId. */
    stash: Record<string, SessionView>;
    /** runId -> session key, so every delta finds its conversation. */
    runSessions: Record<string, string>;

    activeKey: () => string;
    setSurface: (s: Surface) => void;
    setModel: (m: string) => void;
    setSession: (s: Surface, id: string) => void;
    pushUser: (text: string, images?: { mimeType: string; dataBase64: string }[]) => void;
    clear: () => void;
    setItems: (items: RunItem[]) => void;
    dropFromLastUser: () => string;
    setComposerDraft: (t: string) => void;
    pushAssistant: (text: string) => void;
    pushError: (sessionKey: string, text: string) => void;
    /** Save the on-screen view into the stash (before switching away). */
    stashActive: () => void;
    /** Restore a stashed view to the screen. Returns false if none exists. */
    restoreStash: (key: string) => boolean;
    apply: (d: AgentDelta) => void;
    beginRun: () => void;
    /** running=false for one session, wherever it currently lives. */
    finishRun: (sessionKey: string) => void;
}

const draftKey = (surface: Surface) => `draft:${surface}`;
const keyOf = (st: Pick<AgentRunState, 'sessions' | 'surface'>) => st.sessions[st.surface] || draftKey(st.surface);

const viewOf = (st: AgentRunState): SessionView => ({
    items: st.items, runId: st.runId, running: st.running,
    currentAssistantId: st.currentAssistantId, currentThinkingId: st.currentThinkingId,
    currentModel: st.currentModel, pendingPermissions: st.pendingPermissions,
    usage: st.usage,
});

const flatten = (v: SessionView) => ({
    items: v.items, runId: v.runId, running: v.running,
    currentAssistantId: v.currentAssistantId, currentThinkingId: v.currentThinkingId,
    currentModel: v.currentModel, pendingPermissions: v.pendingPermissions,
    usage: v.usage,
});

export const useAgentRunStore = create<AgentRunState>((set, get) => ({
    surface: 'cowork',
    model: '',
    sessions: {},

    items: [],
    runId: null,
    running: false,
    currentAssistantId: null,
    currentThinkingId: null,
    currentModel: '',
    pendingPermissions: [],
    usage: { inputTokens: 0, outputTokens: 0 },

    composerDraft: '',
    stash: {},
    runSessions: {},

    activeKey: () => keyOf(get()),
    setSurface: (surface) => set({ surface }),
    setModel: (model) => set({ model }),
    setSession: (s, id) => set((st) => ({ sessions: { ...st.sessions, [s]: id } })),
    pushUser: (text, images) => set((st) => ({
        items: [...st.items, { kind: 'user', id: nid(), text, images }],
        currentAssistantId: null,
        currentThinkingId: null,
    })),
    clear: () => set({ ...flatten(emptyView()) }),
    setItems: (items) => set({ items, currentAssistantId: null, currentThinkingId: null }),
    setComposerDraft: (composerDraft) => set({ composerDraft }),
    pushAssistant: (text) => set((st) => ({
        items: [...st.items, { kind: 'assistant', id: nid(), text }],
        currentAssistantId: null,
        currentThinkingId: null,
    })),
    pushError: (sessionKey, text) => {
        const st = get();
        if (sessionKey === keyOf(st)) {
            set({ items: [...st.items, { kind: 'error', id: nid(), text }] });
        } else if (st.stash[sessionKey]) {
            const v = st.stash[sessionKey];
            set({ stash: { ...st.stash, [sessionKey]: { ...v, items: [...v.items, { kind: 'error', id: nid(), text }] } } });
        }
    },
    dropFromLastUser: () => {
        const st = get();
        let idx = -1;
        for (let i = st.items.length - 1; i >= 0; i--) { if (st.items[i].kind === 'user') { idx = i; break; } }
        if (idx === -1) return '';
        const text = (st.items[idx] as any).text || '';
        set({ items: st.items.slice(0, idx), currentAssistantId: null, currentThinkingId: null });
        return text;
    },

    stashActive: () => {
        const st = get();
        const key = keyOf(st);
        if (st.items.length === 0 && !st.running) return; // nothing worth keeping
        const stash = { ...st.stash, [key]: viewOf(st) };
        // Bound memory: evict the oldest idle view.
        const keys = Object.keys(stash);
        if (keys.length > MAX_STASHED_VIEWS) {
            const evict = keys.find((k) => !stash[k].running && k !== key);
            if (evict) delete stash[evict];
        }
        set({ stash });
    },

    restoreStash: (key) => {
        const st = get();
        const v = st.stash[key];
        if (!v) return false;
        const stash = { ...st.stash };
        delete stash[key];
        set({ ...flatten(v), stash });
        return true;
    },

    beginRun: () => set({ running: true }),

    finishRun: (sessionKey) => {
        const st = get();
        if (sessionKey === keyOf(st)) {
            if (st.running) set({ running: false, runId: null, currentAssistantId: null, currentThinkingId: null });
        } else if (st.stash[sessionKey]?.running) {
            const v = st.stash[sessionKey];
            set({ stash: { ...st.stash, [sessionKey]: { ...v, running: false, runId: null } } });
        }
    },

    apply: (d) => {
        const st = get();
        const active = keyOf(st);

        // Lifetime telemetry (per-session accounting happens in reduceView).
        if (d.t === 'usage') useUsageStore.getState().add(d.inputTokens ?? 0, d.outputTokens ?? 0);
        if (d.t === 'run_start') useUsageStore.getState().bumpRuns();

        // -- Bind a new run to its conversation ------------------------------
        if (d.t === 'run_start') {
            const sid = d.sessionId;
            // Only runs for conversations this window knows about may render.
            // Scheduled/background runs use fresh sessionIds -> ignored here.
            if (sid && sid === active) {
                set({
                    ...flatten(reduceView(viewOf(st), d)),
                    runSessions: { ...st.runSessions, [d.runId]: sid },
                });
            } else if (sid && st.stash[sid]) {
                set({
                    stash: { ...st.stash, [sid]: reduceView(st.stash[sid], d) },
                    runSessions: { ...st.runSessions, [d.runId]: sid },
                });
            } else if (!sid && st.running && !st.runId) {
                // Legacy path (no sessionId on the delta): bind to the view that
                // just called beginRun, like the old activeRunId logic did.
                set({
                    ...flatten(reduceView(viewOf(st), d)),
                    runSessions: { ...st.runSessions, [d.runId]: active },
                });
            }
            return;
        }

        // -- Route every other delta by its runId -----------------------------
        const rid = (d as any).runId as string | undefined;
        const key = rid ? st.runSessions[rid] : active;   // runId '' -> local/renderer errors
        if (!key) return; // unknown run (background/sub-agent) - never leak into a chat

        const patch: Partial<AgentRunState> = {};
        if (key === active) {
            Object.assign(patch, flatten(reduceView(viewOf(st), d)));
        } else if (st.stash[key]) {
            patch.stash = { ...st.stash, [key]: reduceView(st.stash[key], d) };
        }
        if (d.t === 'done') {
            const runSessions = { ...st.runSessions };
            if (rid) delete runSessions[rid];
            patch.runSessions = runSessions;
        }
        set(patch);
    },
}));

export type { SessionRecord };
```

## `src/renderer/store/debate.ts`

```ts
/* =======================================================================
   debate.ts — Zustand store for the dual-model debate feature.

   Manages:
   - Model selection (A + B)
   - Debate transcript (round-by-round, per-model)
   - Real-time streaming state
   - Interjection input
   - Synthesis result
   ======================================================================= */
import { create } from 'zustand';
import type { MessagePart } from '../../shared/agent';
import { useOllamaStore } from './ollama';
import { useUIStore } from './ui';
import { useSettingsStore } from './settings';
import { useAgentRunStore } from './agentRun';
import { getFallbackCapabilities } from '../utils/capabilities';

// Vision/routing helpers — mirror agentClient so debate turns pick the same
// vision fallback + cloud/local routing the single-model path uses.
function modelHasVision(model: string): boolean {
    const caps = useOllamaStore.getState().modelCapabilities[model];
    if (caps && (caps.vision || caps.image)) return true;
    return !!getFallbackCapabilities(model).vision;
}
function modelRouting(model: string): { ollamaCloud: boolean; ollamaLocal: boolean } {
    const o = useOllamaStore.getState();
    const local = o.models.includes(model);
    const cloud = (o.cloudModelNames.includes(model) && !local) || /(?::|-)cloud\b/i.test(model);
    return { ollamaCloud: cloud, ollamaLocal: local };
}
function buildRecentChatContext(items: any[]): string {
    const recent = items.slice(-12);
    if (recent.length === 0) return '';
    return [
        '== CURRENT CONVERSATION CONTEXT (most recent messages) ==',
        ...recent.map((it) => {
            if (it.kind === 'user') return `[User] ${it.text || ''}`.slice(0, 800);
            if (it.kind === 'assistant') return `[Assistant] ${it.text || ''}`.slice(0, 800);
            if (it.kind === 'tool') return `[Tool: ${it.name}] ${(it.resultContent || '').slice(0, 400)}`;
            if (it.kind === 'error') return `[Error] ${it.text || ''}`.slice(0, 400);
            return '';
        }).filter(Boolean),
    ].join('\n');
}

function pickVisionModel(): { model: string; ollamaCloud: boolean; ollamaLocal: boolean } | null {
    const pref = useSettingsStore.getState().visionModel;
    if (pref) return { model: pref, ...modelRouting(pref) };
    const o = useOllamaStore.getState();
    const cloud = o.cloudModelNames.find(modelHasVision);
    if (cloud) return { model: cloud, ...modelRouting(cloud) };
    const local = o.models.find(modelHasVision);
    if (local) return { model: local, ...modelRouting(local) };
    return null;
}

export interface DebateRound {
    round: number;
    textA: string;
    textB: string;
    complete: boolean;
}

export interface DebateState {
    // Config
    modelA: string;
    modelB: string;
    maxRounds: number;
    judgeModel: string;        // empty = no synthesis
    debateEnabled: boolean;
    simultaneous: boolean;     // both models answer concurrently each round, then sync

    // Runtime
    running: boolean;
    runId: string | null;
    rounds: DebateRound[];
    synthesis: string;
    synthesizing: boolean;
    error: string | null;

    // Actions
    setModelA: (m: string) => void;
    setModelB: (m: string) => void;
    setMaxRounds: (n: number) => void;
    setJudgeModel: (m: string) => void;
    toggleDebate: (on: boolean) => void;
    setSimultaneous: (v: boolean) => void;

    startDebate: (userMessage: string, images?: { mimeType: string; dataBase64: string }[], apiKeys?: Record<string, string>) => Promise<void>;
    cancelDebate: () => Promise<void>;
    interject: (message: string) => Promise<void>;

    // Internal — called by delta handler
    onDelta: (d: { runId: string; type: string; round?: number; content?: string; message?: string }) => void;
    reset: () => void;
}

let deltaWired = false;

export const useDebateStore = create<DebateState>((set, get) => ({
    modelA: '',
    modelB: '',
    maxRounds: 2,
    judgeModel: '',
    debateEnabled: false,
    simultaneous: false,

    running: false,
    runId: null,
    rounds: [],
    synthesis: '',
    synthesizing: false,
    error: null,

    setModelA: (m) => set({ modelA: m }),
    setModelB: (m) => set({ modelB: m }),
    setMaxRounds: (n) => set({ maxRounds: Math.max(1, Math.min(5, n)) }),
    setJudgeModel: (m) => set({ judgeModel: m }),
    toggleDebate: (on) => set({ debateEnabled: on, rounds: [], synthesis: '', error: null }),
    setSimultaneous: (v) => set({ simultaneous: v }),

    startDebate: async (userMessage, images, apiKeys) => {
        const { modelA, modelB, maxRounds, judgeModel } = get();
        if (!modelA || !modelB) {
            set({ error: 'Select both Model A and Model B to start a debate.' });
            return;
        }
        const imgs = images ?? [];
        if (!userMessage.trim() && imgs.length === 0) {
            set({ error: 'Enter a message (or attach an image) to debate.' });
            return;
        }

        set({ running: true, runId: null, rounds: [], synthesis: '', synthesizing: false, error: null });

        // Wire delta listener once
        if (!deltaWired && typeof window !== 'undefined') {
            window.vibe.debate.onDelta((d) => {
                useDebateStore.getState().onDelta(d);
            });
            deltaWired = true;
        }

        // Build the user turn as message parts (text + images) — the exact shape
        // a single-model chat turn uses, so images flow through the kernel's
        // vision pass for whichever debater lacks native vision.
        const input: MessagePart[] = [];
        if (userMessage.trim()) input.push({ type: 'text', text: userMessage });
        for (const img of imgs) input.push({ type: 'image', mimeType: img.mimeType, dataBase64: img.dataBase64 });

        // Seed the debate with the current conversation history so the debaters
        // continue from where the main assistant left off, not from zero context.
        const recentChat = buildRecentChatContext(useAgentRunStore.getState().items);
        if (recentChat) {
            input.unshift({ type: 'text', text: recentChat });
        }

        const o = useOllamaStore.getState();
        const availableModels = [...new Set([...o.models, ...o.cloudModelNames])];
        // Per-model vision fallback: only when THAT model can't see natively.
        const visionA = modelHasVision(modelA) ? undefined : pickVisionModel() ?? undefined;
        const visionB = modelHasVision(modelB) ? undefined : pickVisionModel() ?? undefined;

        try {
            const result = await window.vibe.debate.start({
                modelA,
                modelB,
                input,
                // Same surface (tool set + system prompt) + project as single-model.
                surface: useAgentRunStore.getState().surface,
                projectRoot: useUIStore.getState().projectPath,
                apiKeys,
                ollamaApiKey: apiKeys?.ollama,
                maxRounds,
                judgeModel: judgeModel || undefined,
                routingA: modelRouting(modelA),
                routingB: modelRouting(modelB),
                visionA,
                visionB,
                availableModels,
                simultaneous: get().simultaneous,
            });
            if (result.ok) set({ runId: result.runId });
        } catch (e) {
            set({ running: false, error: (e as Error).message });
        }
    },

    cancelDebate: async () => {
        const { runId } = get();
        if (runId) await window.vibe.debate.cancel(runId);
        // Wipe the transcript so the debate panel/inline block disappears
        // immediately instead of leaving stale rounds behind.
        set({ running: false, runId: null, rounds: [], synthesis: '', synthesizing: false });
    },

    interject: async (message) => {
        const { runId } = get();
        if (!runId || !message.trim()) return;
        try {
            await window.vibe.debate.interject(runId, message);
        } catch { /* debate may have ended */ }
    },

    onDelta: (d) => {
        const st = get();

        if (d.type === 'error') {
            set({ error: d.message || 'Unknown debate error', running: false });
            return;
        }

        if (d.type === 'round_start') {
            const round = d.round || 1;
            const rounds = [...st.rounds];
            // Ensure the round exists
            if (!rounds[round - 1]) {
                rounds[round - 1] = { round, textA: '', textB: '', complete: false };
            }
            set({ rounds });
            return;
        }

        if (d.type === 'token_a') {
            const round = d.round || 1;
            const rounds = [...st.rounds];
            if (!rounds[round - 1]) rounds[round - 1] = { round, textA: '', textB: '', complete: false };
            rounds[round - 1] = { ...rounds[round - 1], textA: rounds[round - 1].textA + (d.content || '') };
            set({ rounds });
            return;
        }

        if (d.type === 'token_b') {
            const round = d.round || 1;
            const rounds = [...st.rounds];
            if (!rounds[round - 1]) rounds[round - 1] = { round, textA: '', textB: '', complete: false };
            rounds[round - 1] = { ...rounds[round - 1], textB: rounds[round - 1].textB + (d.content || '') };
            set({ rounds });
            return;
        }

        if (d.type === 'round_end') {
            const round = d.round || 1;
            const rounds = [...st.rounds];
            if (rounds[round - 1]) rounds[round - 1] = { ...rounds[round - 1], complete: true };
            set({ rounds });
            return;
        }

        if (d.type === 'interjection') {
            // The interjection text is shown in the UI via the rounds
            // For now, we just note it — the next round will reflect it
            return;
        }

        if (d.type === 'synthesis_start') {
            set({ synthesizing: true });
            return;
        }

        if (d.type === 'synthesis_token') {
            set({ synthesis: st.synthesis + (d.content || '') });
            return;
        }

        if (d.type === 'synthesis_end') {
            set({ synthesizing: false });
            return;
        }

        if (d.type === 'done') {
            set({ running: false, runId: null });
            return;
        }
    },

    reset: () => set({
        rounds: [],
        synthesis: '',
        synthesizing: false,
        error: null,
        running: false,
        runId: null,
    }),
}));
```

## `src/renderer/store/editor.ts`

```ts
import { create } from 'zustand';

interface EditorState {
    openFiles: string[];
    activeFileId: string | null;
    fileContents: Record<string, string>;
    openFile: (path: string, content: string) => void;
    closeFile: (path: string) => void;
    setActiveFile: (path: string) => void;
    updateContent: (path: string, content: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
    openFiles: [],
    activeFileId: null,
    fileContents: {},
    openFile: (path, content) => set((state) => {
        if (state.openFiles.includes(path)) {
            return { activeFileId: path };
        }
        return {
            openFiles: [...state.openFiles, path],
            activeFileId: path,
            fileContents: { ...state.fileContents, [path]: content }
        };
    }),
    closeFile: (path) => set((state) => {
        const newOpenFiles = state.openFiles.filter(p => p !== path);
        const newContents = { ...state.fileContents };
        delete newContents[path];

        let newActive = state.activeFileId;
        if (newActive === path) {
            newActive = newOpenFiles.length > 0 ? newOpenFiles[newOpenFiles.length - 1] : null;
        }

        return {
            openFiles: newOpenFiles,
            activeFileId: newActive,
            fileContents: newContents
        };
    }),
    setActiveFile: (path) => set({ activeFileId: path }),
    updateContent: (path, content) => set((state) => ({
        fileContents: { ...state.fileContents, [path]: content }
    }))
}));
```

## `src/renderer/store/folderPicker.ts`

```ts
import { create } from 'zustand';

/* In-app folder picker state. Used as a fallback when the native OS dialog
   (dialog.showOpenDialog) is unavailable — common under sudo on Linux because
   root has no DBus session bus / xdg-desktop-portal for the user's desktop. */
interface FolderPickerState {
    open: boolean;
    resolve: ((p: string | null) => void) | null;
    openPicker: () => Promise<string | null>;
    done: (p: string | null) => void;
}

export const useFolderPicker = create<FolderPickerState>((set, get) => ({
    open: false,
    resolve: null,
    openPicker: () => new Promise<string | null>((res) => set({ open: true, resolve: res })),
    done: (p) => { const r = get().resolve; set({ open: false, resolve: null }); r?.(p); },
}));

/** Try the native OS folder picker first; fall back to the in-app picker if it
    fails or returns null. Works correctly whether VIBE runs as a normal user
    or as root/sudo. */
export const pickFolder = async (): Promise<string | null> => {
    try {
        const native = await window.vibe.openFolder();
        if (native) return native;
    } catch {
        // Native dialog failed (e.g. sudo with no portal). Fall through.
    }
    return useFolderPicker.getState().openPicker();
};
```

## `src/renderer/store/huggingface.ts`

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface HFModel {
    id: string;
    name: string;
}

interface HFState {
    pinnedModels: HFModel[];
    hfApiKey: string;
    pinModel: (model: HFModel) => void;
    unpinModel: (id: string) => void;
    setHFApiKey: (key: string) => void;
}

export const useHFStore = create<HFState>()(
    persist(
        (set) => ({
            pinnedModels: [],
            hfApiKey: '',
            pinModel: (model) => set(state => ({
                pinnedModels: state.pinnedModels.find(m => m.id === model.id)
                    ? state.pinnedModels
                    : [...state.pinnedModels, model]
            })),
            unpinModel: (id) => set(state => ({
                pinnedModels: state.pinnedModels.filter(m => m.id !== id)
            })),
            setHFApiKey: (hfApiKey) => set({ hfApiKey }),
        }),
        { name: 'vibe-hf-storage' }
    )
);
```

## `src/renderer/store/ollama.ts`

```ts
import { create } from 'zustand';
import type { ChatMessage, ModelCapability } from '../../shared/types';
import { getFallbackCapabilities, fetchCapabilities } from '../utils/capabilities';
import { useSettingsStore } from './settings';

interface OllamaState {
    connected: boolean;
    version: string | null;
    models: string[];
    cloudModelNames: string[];
    /** key = model name -> capability flags */
    modelCapabilities: Record<string, ModelCapability>;
    selectedModel: string;
    messages: ChatMessage[];
    isGenerating: boolean;
    agentStep: number;
    agentMaxSteps: number;
    agentStatus: string;
    
    // Thinking / Reasoning state
    isThinking: boolean;
    thinkingContent: string;
    thinkingStartTime: number | null;
    thinkingElapsed: number | null;
    thinkEnabled: boolean;
    thinkLevel: 'low' | 'medium' | 'high';

    setConnectionState: (connected: boolean, version: string | null) => void;
    setModels: (models: string[]) => void;
    setCloudModelNames: (names: string[]) => void;
    /** Update capability flags for a single model (used when a user selects a custom model) */
    setModelCapability: (modelId: string, caps: ModelCapability) => void;
    setSelectedModel: (modelName: string) => void;
    addMessage: (msg: ChatMessage) => void;
    updateLastMessage: (content: string) => void;
    setIsGenerating: (isGenerating: boolean) => void;
    setAgentStatus: (status: string) => void;
    setAgentStep: (step: number, max: number) => void;
    clearMessages: () => void;

    // Thinking methods
    startThinking: () => void;
    appendThinkContent: (content: string) => void;
    finalizeThinking: () => void;
    resetThinking: () => void;
    setThinkEnabled: (enabled: boolean) => void;
    setThinkLevel: (level: 'low' | 'medium' | 'high') => void;
}

export const useOllamaStore = create<OllamaState>((set) => ({
    connected: false,
    version: null,
    models: [],
    cloudModelNames: [],
    modelCapabilities: {},
    selectedModel: '',
    messages: [],
    isGenerating: false,
    agentStep: 0,
    agentMaxSteps: 0,
    agentStatus: '',
    
    // Initial thinking state
    isThinking: false,
    thinkingContent: '',
    thinkingStartTime: null,
    thinkingElapsed: null,
    thinkEnabled: false,
    thinkLevel: 'medium',

    setConnectionState: (connected: boolean, version: string | null) => set({ connected, version }),
    setCloudModelNames: (cloudModelNames: string[]) => set((state) => {
        // Fetch REAL capabilities for cloud models too (name-guessing missed the
        // vision/tools flags on the cloud roster). Query ollama.com with the key.
        const unknown = cloudModelNames.filter((m) => !state.modelCapabilities[m]);
        const capsMap: Record<string, ModelCapability> = {};
        unknown.forEach((m) => { capsMap[m] = getFallbackCapabilities(m); });
        const ollamaKey = useSettingsStore.getState().apiKeys?.ollama;
        unknown.forEach(async (m) => {
            try {
                const real = await fetchCapabilities(m, { cloud: true, ollamaKey });
                useOllamaStore.getState().setModelCapability(m, real);
            } catch { /* keep fallback */ }
        });
        return { cloudModelNames, modelCapabilities: { ...state.modelCapabilities, ...capsMap } };
    }),
    setModels: (models: string[]) => set((state) => {
        // Start with fallback capabilities synchronously
        // Only resolve capabilities for models we haven't seen. The connection
        // poller calls setModels every 30s - refetching every model each time
        // hammered /api/show and overwrote real caps with fallbacks.
        const capsMap: Record<string, ModelCapability> = {};
        const unknown = models.filter((m) => !state.modelCapabilities[m]);
        unknown.forEach(m => {
            capsMap[m] = getFallbackCapabilities(m);
        });

        // Async fetch real capabilities for the new ones only
        unknown.forEach(async (modelName) => {
            try {
                const real = await fetchCapabilities(modelName);
                useOllamaStore.getState().setModelCapability(modelName, real);
            } catch { /* keep fallback */ }
        });

        return {
            models,
            modelCapabilities: { ...state.modelCapabilities, ...capsMap },
            connected: models.length > 0 ? true : state.connected,
            selectedModel: state.selectedModel || (models.length > 0 ? models[0] : '')
        };
    }),
    setModelCapability: (modelId: string, caps: ModelCapability) => set(state => ({
        modelCapabilities: { ...state.modelCapabilities, [modelId]: caps }
    })),
    setSelectedModel: (selectedModel: string) => set({ selectedModel }),
    addMessage: (msg: ChatMessage) => set((state) => ({ messages: [...state.messages, msg] })),
    updateLastMessage: (content: string) => set((state) => {
        if (!content) return state;
        const newMessages = [...state.messages];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
            newMessages[newMessages.length - 1] = {
                ...newMessages[newMessages.length - 1],
                content: newMessages[newMessages.length - 1].content + content
            };
        }
        return { messages: newMessages };
    }),
    setIsGenerating: (isGenerating: boolean) => set({ isGenerating }),
    setAgentStatus: (agentStatus: string) => set({ agentStatus }),
    setAgentStep: (agentStep: number, agentMaxSteps: number) => set({ agentStep, agentMaxSteps }),
    clearMessages: () => set({ messages: [], thinkingContent: '', isThinking: false, thinkingElapsed: null }),

    startThinking: () => set({ isThinking: true, thinkingContent: '', thinkingStartTime: Date.now(), thinkingElapsed: null }),
    appendThinkContent: (content) => set((state) => ({ thinkingContent: state.thinkingContent + content })),
    finalizeThinking: () => set((state) => ({
        isThinking: false,
        thinkingElapsed: state.thinkingStartTime ? Math.round((Date.now() - state.thinkingStartTime) / 1000) : null,
    })),
    resetThinking: () => set({ thinkingContent: '', isThinking: false, thinkingStartTime: null, thinkingElapsed: null }),

    setThinkEnabled: (thinkEnabled) => set({ thinkEnabled }),
    setThinkLevel: (thinkLevel) => set({ thinkLevel }),
}));
```

## `src/renderer/store/settings.ts`

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    apiKeys: {
        gemini: string;
        claude: string;
        openai: string;
        deepseek: string;
        groq: string;
        openrouter: string;
        hf: string;
        obsidian: string;
        ollama: string;
        omni: string;
        omniBase: string;
        ofox: string;
        ofoxBase: string;
    };
    backgroundModels: {
        collector: string;
        reviewer: string;
    };
    /** 'ask' = prompt for risky tools; 'auto' = approve everything for this machine. */
    permissionMode: 'ask' | 'auto';
    /** 'build' = execute end-to-end, no "shall I proceed?"; 'plan' = read-only, propose first. */
    agentMode: 'build' | 'plan';
    /** Preferred vision model for describing images when the main model can't see.
        Empty = auto-pick a vision-capable model from what's available. */
    visionModel: string;
    setApiKey: (provider: string, key: string) => void;
    setBackgroundModel: (role: 'collector' | 'reviewer', model: string) => void;
    setPermissionMode: (mode: 'ask' | 'auto') => void;
    setAgentMode: (mode: 'build' | 'plan') => void;
    setVisionModel: (model: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            apiKeys: {
                gemini: '',
                claude: '',
                openai: '',
                deepseek: '',
                groq: '',
                openrouter: '',
                hf: '',
                obsidian: '',
                ollama: '',
                omni: '',
                omniBase: '',
                ofox: '',
                ofoxBase: ''
            },
            backgroundModels: {
                collector: '',
                reviewer: ''
            },
            permissionMode: 'ask',
            setPermissionMode: (permissionMode) => set({ permissionMode }),
            agentMode: 'build',
            setAgentMode: (agentMode) => set({ agentMode }),
            visionModel: '',
            setVisionModel: (visionModel) => set({ visionModel }),
            setApiKey: (provider, key) =>
                set((state) => ({
                    apiKeys: {
                        ...state.apiKeys,
                        [provider]: key
                    }
                })),
            setBackgroundModel: (role, model) =>
                set((state) => ({
                    backgroundModels: {
                        ...state.backgroundModels,
                        [role]: model
                    }
                }))
        }),
        { name: 'vibe-settings-storage' }
    )
);
```

## `src/renderer/store/swarms.ts`

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AgentNode {
    id: number;
    role: string;
    model: string;
    dependsOn?: number[]; // ids of agents this one waits for
}

export interface SwarmConfig {
    id: string;
    name: string;
    agents: AgentNode[];
}

export interface SwarmHandoff {
    originalRequest: string;
    previousAgentRole: string;
    previousAgentOutput: string;
    sharedContext: Record<string, string>; // agentRole -> output, accumulates
}

interface SwarmState {
    swarms: SwarmConfig[];
    addSwarm: (swarm: SwarmConfig) => void;
    removeSwarm: (id: string) => void;
}

export const useSwarmStore = create<SwarmState>()(
    persist(
        (set) => ({
            swarms: [],
            addSwarm: (swarm) => set((state) => ({ swarms: [...state.swarms, swarm] })),
            removeSwarm: (id) => set((state) => ({ swarms: state.swarms.filter(s => s.id !== id) }))
        }),
        { name: 'vibe-swarms-storage' }
    )
);
```

## `src/renderer/store/terminal.ts`

```ts
import { create } from 'zustand';
import type { TerminalSession } from '../../shared/types';

interface TerminalState {
    sessions: TerminalSession[];
    activeTerminalId: string | null;
    addSession: (session: TerminalSession) => void;
    removeSession: (id: string) => void;
    setActiveSession: (id: string) => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
    sessions: [],
    activeTerminalId: null,
    addSession: (session) => set((state) => ({
        sessions: [...state.sessions, session],
        activeTerminalId: session.id
    })),
    removeSession: (id) => set((state) => {
        const newSessions = state.sessions.filter(s => s.id !== id);
        let newActive = state.activeTerminalId;
        if (newActive === id) {
            newActive = newSessions.length > 0 ? newSessions[newSessions.length - 1].id : null;
        }
        return { sessions: newSessions, activeTerminalId: newActive };
    }),
    setActiveSession: (id) => set({ activeTerminalId: id })
}));
```

## `src/renderer/store/ui.ts`

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ProjectMemory {
    lastSession: string;
    keyFiles: string[];
    architecturalDecisions: string[];
    currentPhase: string;
    updatedAt: string;
}

export type ChatMode = 'auto' | 'chat' | 'agent';
/** chat = conversation front and center; ide = editor+terminal center, chat docked right. */
export type LayoutMode = 'chat' | 'ide';

interface UIState {
    sidebarWidth: number;
    terminalHeight: number;
    showModelPicker: boolean;
    projectPath: string | null;
    ollamaConnected: boolean;
    vibeInstructions: string | null;
    projectMemory: ProjectMemory | null;
    chatMode: ChatMode;
    layoutMode: LayoutMode;
    setLayoutMode: (mode: LayoutMode) => void;
    setSidebarWidth: (width: number) => void;
    setTerminalHeight: (height: number) => void;
    setShowModelPicker: (show: boolean) => void;
    setProjectPath: (path: string | null) => void;
    setVibeInstructions: (instructions: string | null) => void;
    setOllamaConnected: (connected: boolean) => void;
    setProjectMemory: (memory: ProjectMemory | null) => void;
    setChatMode: (mode: ChatMode) => void;
    isLoggedIn: boolean;
    setIsLoggedIn: (v: boolean) => void;
    /** Workspace (editor+terminal) panel visibility in chat layout. Lives in the
        store so the agent delta handler can auto-open it on file touches. */
    workspaceOpen: boolean;
    setWorkspaceOpen: (open: boolean) => void;
    toggleWorkspaceOpen: () => void;
    /** Dual-model debate mode — replaces chat surface with DebatePanel. */
    debateMode: boolean;
    setDebateMode: (v: boolean) => void;
    toggleDebateMode: () => void;
}

export const useUIStore = create<UIState>()(
    persist(
        (set) => ({
            sidebarWidth: 210,
            terminalHeight: 140,
            showModelPicker: false,
            projectPath: null,
            vibeInstructions: null,
            projectMemory: null,
            chatMode: 'auto',
            layoutMode: 'chat',
            setLayoutMode: (layoutMode) => set({ layoutMode }),
            ollamaConnected: false,
            setSidebarWidth: (sidebarWidth) => set({ sidebarWidth }),
            setTerminalHeight: (terminalHeight) => set({ terminalHeight }),
            setShowModelPicker: (showModelPicker) => set({ showModelPicker }),
            setProjectPath: (projectPath) => set({ projectPath }),
            setVibeInstructions: (vibeInstructions) => set({ vibeInstructions }),
            setOllamaConnected: (ollamaConnected) => set({ ollamaConnected }),
            setProjectMemory: (projectMemory) => set({ projectMemory }),
            setChatMode: (chatMode) => set({ chatMode }),
            isLoggedIn: false,
            setIsLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
            workspaceOpen: false,
            setWorkspaceOpen: (workspaceOpen) => set({ workspaceOpen }),
            toggleWorkspaceOpen: () => set((s) => ({ workspaceOpen: !s.workspaceOpen })),
            debateMode: false,
            setDebateMode: (debateMode) => set({ debateMode }),
            toggleDebateMode: () => set((s) => ({ debateMode: !s.debateMode })),
        }),
        { 
            name: 'vibe-ui-storage', 
            partialize: (state) => {
                const { vibeInstructions, projectMemory, ...rest } = state;
                return rest;
            }
        }
    )
);
```

## `src/renderer/store/usage.ts`

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Lifetime token telemetry, persisted across restarts. Per-session numbers
    live in the agentRun store; this is the odometer. */
interface UsageState {
    totalInput: number;
    totalOutput: number;
    runs: number;
    add: (input: number, output: number) => void;
    bumpRuns: () => void;
    reset: () => void;
}

export const useUsageStore = create<UsageState>()(
    persist(
        (set) => ({
            totalInput: 0,
            totalOutput: 0,
            runs: 0,
            add: (input, output) => set((s) => ({ totalInput: s.totalInput + input, totalOutput: s.totalOutput + output })),
            bumpRuns: () => set((s) => ({ runs: s.runs + 1 })),
            reset: () => set({ totalInput: 0, totalOutput: 0, runs: 0 }),
        }),
        { name: 'vibe-usage-storage' }
    )
);

export function fmtTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
}
```

## `src/renderer/styles/globals.css`

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

:root {
  /* Dark operator background (flat) */
  --bg-mesh:
    radial-gradient(ellipse at 20% 0%, rgba(61,139,255,0.05) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 100%, rgba(216,114,78,0.04) 0%, transparent 55%),
    linear-gradient(180deg, #15151d 0%, #101017 100%);

  /* Glass - strong variant (title bar, chat bar) */
  --glass-bg: rgba(26, 26, 34, 0.74);
  --glass-blur: blur(24px);
  --glass-border: 1px solid rgba(255, 255, 255, 0.08);
  --glass-shadow: 0 1px 3px rgba(0,0,0,0.3), 0 8px 32px rgba(0,0,0,0.4);

  /* Glass - panel variant (sidebar, editor, terminal, right pane) */
  --panel-bg: rgba(24, 24, 31, 0.6);
  --panel-blur: blur(16px);
  --panel-border: 1px solid rgba(255, 255, 255, 0.07);
  --panel-shadow: 0 2px 12px rgba(0,0,0,0.32);

  /* Text */
  --text: #e7e7f0;
  --text-secondary: #9a9aab;
  --text-muted: #6f6f80;
  --text-faint: #55556a;

  /* Accent */
  --accent: #3d8bff;
  --accent-gradient: linear-gradient(135deg, #2a6cff, #3d8bff, #4aa8ff);
  --accent-light: rgba(61, 139, 255, 0.10);
  --accent-medium: rgba(61, 139, 255, 0.18);

  /* Semantic */
  --green: #35c88f;
  --green-light: rgba(53, 200, 143, 0.12);
  --warn: #e6a33a;
  --warn-light: rgba(230, 163, 58, 0.12);
  --error: #e0506a;

  /* Borders */
  --border: rgba(255, 255, 255, 0.09);
  --border-light: rgba(255, 255, 255, 0.05);

  /* Typography */
  --font-sans: 'DM Sans', 'SF Pro Display', system-ui, -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;

  /* Radii */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;

  /* Layout */
  --gap: 6px;
  --sidebar-width: 210px;
  --right-pane-width: 340px;
  --terminal-height: 140px;
  --titlebar-height: 44px;
  --chatbar-height: 56px;
}

body {
  font-family: var(--font-sans);
  color: var(--text);
  background: var(--bg-mesh);
  overflow: hidden;
  height: 100vh;
  -webkit-font-smoothing: antialiased;
}

/* Custom scrollbars */
*::-webkit-scrollbar { width: 5px; height: 5px; }
*::-webkit-scrollbar-track { background: transparent; }
*::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.14); border-radius: 3px; }
*::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.24); }

/* Animations */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.15; } }
@keyframes spin { to { transform: rotate(360deg); } }

/* Selection */
::selection { background: var(--accent-medium); }

/* Focus */
input:focus, textarea:focus { outline: none; border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(0,102,255,0.1) !important; }

/* Draggable region for custom title bar */
.titlebar-drag { -webkit-app-region: drag; }
.titlebar-drag button, .titlebar-drag input, .titlebar-drag [data-clickable] { -webkit-app-region: no-drag; }

/* ═══════════════════════════════════════════════════════════
   CHAT MESSAGES
   ═══════════════════════════════════════════════════════════ */
.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 12px 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.chat-empty { opacity: 0.5; }

.chat-bubble {
    max-width: 92%;
    padding: 12px 16px;
    border-radius: var(--radius-md);
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    font-family: var(--font-sans);
    animation: fadeUp 0.2s ease-out;
}
.chat-bubble--user {
    align-self: flex-end;
    background: var(--accent-light);
    color: var(--text);
}
.chat-bubble--assistant {
    align-self: flex-start;
    background: var(--cl-surface);
    color: var(--text);
    border: 1px solid var(--border-light);
}
.chat-bubble--special {
    max-width: 100%;
    background: transparent;
    padding: 0;
    border: none;
}

.chat-terminal-output {
    background: #0d1117;
    border: 1px solid #30363d;
    border-radius: 6px;
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: #e6edf3;
    white-space: pre-wrap;
    word-break: break-all;
}
.chat-terminal-output__label {
    color: #7c8fa6;
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.chat-file-contents {
    background: rgba(0,102,255,0.04);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 10px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text);
    white-space: pre-wrap;
}
.chat-file-contents__label {
    color: var(--accent);
    font-size: 10px;
    font-weight: 700;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.chat-swarm-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--accent);
    text-transform: uppercase;
    letter-spacing: 1px;
    padding: 2px 0;
}

/* ═══════════════════════════════════════════════════════════
   AGENT CARDS — Shared base
   ═══════════════════════════════════════════════════════════ */
.agent-card {
    border-radius: 10px;
    margin: 8px 0;
    overflow: hidden;
    animation: fadeUp 0.25s ease-out;
}
.agent-card__header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: default;
}
.agent-card__icon { font-size: 14px; }
.agent-card__title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    flex: 1;
}
.agent-card__toggle {
    font-size: 12px;
    cursor: pointer;
    color: var(--text-muted);
    user-select: none;
}
.agent-card__body {
    padding: 0 14px 12px;
    font-size: 12px;
    line-height: 1.6;
}

/* ─── Plan Card ──────────────────────────────────────────── */
.agent-card--plan {
    background: rgba(0,102,255,0.04);
    border: 1px solid rgba(0,102,255,0.15);
}
.agent-card--plan .agent-card__header { cursor: pointer; }
.agent-card--plan .agent-card__title { color: var(--accent); }
.agent-plan__mission {
    color: var(--text);
    font-weight: 500;
    margin-bottom: 8px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(0,102,255,0.1);
}
.agent-plan__steps { display: flex; flex-direction: column; gap: 4px; margin-bottom: 8px; }
.agent-plan__step { display: flex; gap: 8px; align-items: flex-start; color: var(--text-secondary); }
.agent-plan__step-num { color: var(--accent); font-weight: 700; flex-shrink: 0; width: 18px; }
.agent-plan__criteria {
    color: var(--text-muted);
    font-style: italic;
    font-size: 11px;
    padding-top: 8px;
    border-top: 1px solid rgba(0,102,255,0.1);
}
.agent-plan__criteria-label { font-weight: 700; font-style: normal; }
.agent-plan__risks {
    color: var(--warn);
    font-size: 11px;
    margin-top: 4px;
}
.agent-plan__risks-label { font-weight: 700; }

/* ─── Critique Card ──────────────────────────────────────── */
.agent-card--critique {
    border: 1px solid transparent;
}
.agent-card--critique-approved {
    background: rgba(0,168,112,0.04);
    border-color: rgba(0,168,112,0.2);
}
.agent-card--critique-approved .agent-card__title { color: var(--green); }
.agent-card--critique-approved .agent-card__icon { color: var(--green); }

.agent-card--critique-revised {
    background: rgba(230,138,0,0.04);
    border-color: rgba(230,138,0,0.2);
}
.agent-card--critique-revised .agent-card__title { color: var(--warn); }
.agent-card--critique-revised .agent-card__icon { color: var(--warn); }

.agent-critique__score {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-muted);
    margin-left: auto;
}
.agent-critique__status {
    padding: 0 14px 10px;
    font-size: 12px;
    font-weight: 600;
}
.agent-card--critique-approved .agent-critique__status { color: var(--green); }
.agent-card--critique-revised .agent-critique__status { color: var(--warn); }

/* ─── Reflection Pill ────────────────────────────────────── */
.agent-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    margin: 4px 0;
    animation: fadeIn 0.2s ease-out;
}
.agent-pill--good {
    background: rgba(0,168,112,0.08);
    color: var(--green);
    border: 1px solid rgba(0,168,112,0.2);
}
.agent-pill--retry {
    background: rgba(230,138,0,0.08);
    color: var(--warn);
    border: 1px solid rgba(230,138,0,0.2);
}

/* ─── Verification Card ──────────────────────────────────── */
.agent-card--verification { border: 1px solid transparent; }
.agent-card--verification-complete {
    background: rgba(0,168,112,0.04);
    border-color: rgba(0,168,112,0.2);
}
.agent-card--verification-complete .agent-card__title { color: var(--green); }
.agent-card--verification-incomplete {
    background: rgba(230,138,0,0.04);
    border-color: rgba(230,138,0,0.2);
}
.agent-card--verification-incomplete .agent-card__title { color: var(--warn); }
.agent-card--verification-partial {
    background: rgba(0,102,255,0.04);
    border-color: rgba(0,102,255,0.15);
}
.agent-card--verification-partial .agent-card__title { color: var(--accent); }
.agent-verification__evidence { color: var(--text-secondary); margin-bottom: 6px; }
.agent-verification__remaining-title { font-weight: 700; color: var(--text); margin-bottom: 2px; }
.agent-verification__remaining-item { color: var(--text-secondary); padding-left: 8px; }

/* ─── Done Card ──────────────────────────────────────────── */
.agent-card--done {
    background: rgba(0,168,112,0.04);
    border: 1px solid rgba(0,168,112,0.2);
}
.agent-card--done .agent-card__title { color: var(--green); }
.agent-done__summary { color: var(--text); font-weight: 500; }
.agent-done__files {
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 11px;
    margin-top: 4px;
}

/* ─── Analyze Card ───────────────────────────────────────── */
.agent-card--analyze {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border-light);
}
.agent-card--analyze .agent-card__title { color: var(--text-muted); }
.agent-analyze__content {
    color: var(--text-secondary);
    font-style: italic;
}

/* ─── Command Block ──────────────────────────────────────── */
.agent-command {
    background: #1e1e2e;
    border: 1px solid #313244;
    border-radius: 8px;
    margin: 8px 0;
    overflow: hidden;
}
.agent-command__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 12px;
    background: rgba(255,255,255,0.03);
    border-bottom: 1px solid rgba(255,255,255,0.05);
}
.agent-command__label {
    font-size: 10px;
    color: var(--accent);
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
}
.agent-command__copy {
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    font-size: 10px;
}
.agent-command__copy:hover { color: var(--accent); }
.agent-command__body {
    padding: 12px;
    font-family: var(--font-mono);
    font-size: 12px;
    color: #cdd6f4;
    white-space: pre-wrap;
}
.agent-command__prompt {
    color: var(--accent);
    margin-right: 8px;
    opacity: 0.7;
}

/* ─── File Write Block ───────────────────────────────────── */
.agent-file-write {
    background: rgba(0, 168, 112, 0.05);
    border: 1px solid rgba(0, 168, 112, 0.2);
    padding: 6px 12px;
    border-radius: 6px;
    margin: 4px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}
.agent-file-write__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--warn);
    flex-shrink: 0;
}
.agent-file-write__dot--done { background: var(--green); }
.agent-file-write__info { flex: 1; min-width: 0; display: flex; align-items: center; gap: 4px; }
.agent-file-write__path {
    font-size: 11px;
    color: var(--text);
    font-family: var(--font-mono);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.agent-file-write__status {
    font-size: 9px;
    color: var(--text-muted);
    font-weight: 700;
}
.agent-file-write__status--done { color: var(--green); }

/* ═══════════════════════════════════════════════════════════
   SETTINGS MODAL
   ═══════════════════════════════════════════════════════════ */
.settings-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: flex;
    align-items: center;
    justify-content: center;
}
.settings-backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.5);
    backdrop-filter: blur(4px);
}
.settings-panel {
    width: 500px;
    max-height: 80vh;
    overflow-y: auto;
    padding: 24px;
    z-index: 1000;
    display: flex;
    flex-direction: column;
    gap: 20px;
}
.settings-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: 12px;
}
.settings-header__title { font-size: 18px; margin: 0; color: var(--text); }
.settings-header__close {
    background: transparent;
    border: none;
    cursor: pointer;
    font-size: 20px;
    color: var(--text-muted);
}
.settings-section { display: flex; flex-direction: column; gap: 16px; }
.settings-section--obsidian {
    margin-top: 4px;
    padding-top: 16px;
    border-top: 1px solid var(--border-light);
}
.settings-section__title {
    font-size: 14px;
    color: var(--text);
    margin: 0;
    border-bottom: 1px solid var(--border-light);
    padding-bottom: 8px;
}
.settings-field {}
.settings-field__label {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 600;
    display: block;
    margin-bottom: 4px;
    text-transform: capitalize;
}
.settings-field__input {
    width: 100%;
    padding: 10px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.05);
    color: var(--text);
    outline: none;
}
.settings-info-box {
    padding: 10px 12px;
    background: rgba(0,102,255,0.04);
    border: 1px solid var(--border);
    border-radius: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.6;
}
.settings-footer {
    display: flex;
    justify-content: flex-end;
    gap: 12px;
    margin-top: 10px;
    align-items: center;
}
.settings-footer__saved { color: var(--green); font-size: 13px; font-weight: 600; }
.settings-footer__save-btn {
    padding: 8px 24px;
    background: var(--accent-gradient);
    color: #fff;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-weight: 600;
}

/* ─── Obsidian Status Indicator ──────────────────────────── */
.obsidian-status {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: var(--text-muted);
}
.obsidian-status__dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
}
.obsidian-status__dot--connected { background: var(--green); }
.obsidian-status__dot--disconnected { background: var(--text-muted); }

/* ==========================================================================
   CLAUDE-STYLE UI  (conversation-first shell)
   Overrides the IDE theme with a warm, calm, single-column reading layout.
   ========================================================================== */
:root {
  --cl-bg: #121218;               /* dark operator background */
  --cl-surface: #1b1b23;          /* panels / composer */
  --cl-surface-2: #23232d;        /* raised */
  --cl-rail: #17171e;             /* left rail */
  --cl-text: #e7e7f0;
  --cl-text-2: #9a9aab;
  --cl-muted: #6f6f80;
  --cl-accent: #d8724e;           /* coral, tuned for dark */
  --cl-accent-hover: #e28560;
  --cl-user-bubble: #262631;
  --cl-border: rgba(255,255,255,0.10);
  --cl-border-soft: rgba(255,255,255,0.055);
  --cl-code-bg: #0d0d13;
  --cl-font: ui-sans-serif, -apple-system, 'Segoe UI', 'DM Sans', system-ui, sans-serif;
  --cl-mono: 'JetBrains Mono', ui-monospace, 'SF Mono', monospace;
}

body { background: var(--cl-bg); }

.cl-app { height: 100vh; display: flex; flex-direction: column; overflow: hidden; background: var(--cl-bg); color: var(--cl-text); font-family: var(--cl-font); }
.cl-body { flex: 1; display: flex; min-height: 0; overflow: hidden; }

/* ---- Top bar ---- */
.cl-topbar { height: 44px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; background: var(--cl-bg); border-bottom: 1px solid var(--cl-border-soft); }
.cl-topbar__brand { font-weight: 700; letter-spacing: 2px; font-size: 14px; color: var(--cl-accent); }
.cl-topbar__title { font-size: 13px; color: var(--cl-text-2); font-weight: 500; }
.cl-winbtn { background: transparent; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; color: var(--cl-text-2); font-size: 13px; display: inline-flex; align-items: center; justify-content: center; }
.cl-winbtn:hover { background: rgba(255,255,255,0.07); }

/* ---- Left rail ---- */
.cl-rail { width: 268px; flex-shrink: 0; background: var(--cl-rail); border-right: 1px solid var(--cl-border-soft); display: flex; flex-direction: column; overflow: hidden; transition: width 0.18s ease; }
.cl-rail--collapsed { width: 0; }
.cl-rail__top { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.cl-newchat { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid var(--cl-border); background: var(--cl-surface); color: var(--cl-text); font-size: 13.5px; font-weight: 600; cursor: pointer; transition: background 0.15s; }
.cl-newchat:hover { background: rgba(255,255,255,0.09); }
.cl-seg { display: flex; background: rgba(255,255,255,0.06); border-radius: 10px; padding: 3px; gap: 2px; }
.cl-seg__btn { flex: 1; border: none; background: transparent; padding: 6px 4px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--cl-text-2); cursor: pointer; transition: all 0.15s; }
.cl-seg__btn--active { background: var(--cl-surface-2); color: var(--cl-text); box-shadow: 0 1px 2px rgba(0,0,0,0.06); }
.cl-rail__label { padding: 8px 14px 4px; font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--cl-muted); }
.cl-rail__list { flex: 1; overflow-y: auto; padding: 0 8px 8px; }
.cl-histitem { display: block; width: 100%; text-align: left; border: none; background: transparent; padding: 8px 10px; border-radius: 8px; font-size: 13px; color: var(--cl-text-2); cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-histitem:hover { background: rgba(255,255,255,0.06); color: var(--cl-text); }
.cl-histitem--active { background: rgba(201,100,66,0.1); color: var(--cl-text); }
.cl-rail__foot { padding: 10px 12px; border-top: 1px solid var(--cl-border-soft); display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--cl-text-2); }
.cl-rail__foot button { background: transparent; border: none; cursor: pointer; color: var(--cl-text-2); font-size: 13px; padding: 4px 6px; border-radius: 6px; }
.cl-rail__foot button:hover { background: rgba(255,255,255,0.07); }

/* Inline hint shown at the top of the rail when no project is open. */
.cl-rail__hint { font-size: 11px; line-height: 1.45; color: var(--cl-muted); padding: 4px 2px 2px; }
.cl-rail__hint-link { background: transparent; border: none; color: var(--cl-accent); cursor: pointer; font-size: 11px; font-weight: 600; padding: 0; }
.cl-rail__hint-link:hover { text-decoration: underline; }

/* Project nodes in the left rail. */
.cl-proj { display: flex; flex-direction: column; border-radius: 10px; }
.cl-proj--current { background: rgba(255,255,255,0.03); }
.cl-proj__head { display: flex; align-items: center; gap: 2px; }
.cl-proj__toggle { flex: 1; display: flex; align-items: center; gap: 6; padding: 7px 8px; border-radius: 8px; border: none; background: transparent; color: var(--cl-text-2); font-size: 13px; cursor: pointer; min-width: 0; }
.cl-proj__toggle:hover { background: rgba(255,255,255,0.06); color: var(--cl-text); }
.cl-proj__toggle--active { color: var(--cl-accent); font-weight: 600; }
.cl-proj__act { background: transparent; border: none; color: var(--cl-muted); font-size: 15px; cursor: pointer; padding: 4px 8px; border-radius: 6px; line-height: 1; }
.cl-proj__act:hover { background: rgba(255,255,255,0.08); color: var(--cl-text); }
.cl-proj__chats { display: flex; flex-direction: column; padding: 2px 0 4px; }
.cl-histrow--nested { margin-left: 14px; }

/* ---- Conversation column ---- */
.cl-main { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; position: relative; }
.cl-stream { flex: 1; overflow-y: auto; }
.cl-col { max-width: 814px; margin: 0 auto; padding: 28px 28px 160px; width: 100%; }
.cl-col--center { max-width: 792px; margin: 0 auto; min-height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 24px; gap: 22px; }
.cl-greeting { font-size: 30px; font-weight: 500; color: var(--cl-text); text-align: center; letter-spacing: -0.3px; }
.cl-greeting__sub { font-size: 14px; color: var(--cl-text-2); margin-top: 8px; font-weight: 400; }

/* messages */
.cl-msg { margin: 18px 0; animation: fadeUp 0.2s ease-out; }
.cl-msg--user { display: flex; justify-content: flex-end; }
.cl-msg--user .cl-msg__body { background: var(--cl-user-bubble); border-radius: 16px; padding: 11px 16px; max-width: 80%; font-size: 16.5px; line-height: 1.55; color: var(--cl-text); white-space: pre-wrap; }
.cl-msg--assistant .cl-msg__body { font-size: 17px; line-height: 1.7; color: var(--cl-text); }
.cl-cursor { display: inline-block; width: 8px; height: 17px; background: var(--cl-accent); border-radius: 1px; margin-left: 2px; vertical-align: text-bottom; animation: blink 1s steps(1) infinite; }

/* markdown */
.cl-md > *:first-child { margin-top: 0; }
.cl-md > *:last-child { margin-bottom: 0; }
.cl-md p { margin: 12px 0; }
.cl-md h1 { font-size: 22px; font-weight: 600; margin: 22px 0 10px; }
.cl-md h2 { font-size: 18.5px; font-weight: 600; margin: 20px 0 8px; }
.cl-md h3 { font-size: 16px; font-weight: 600; margin: 16px 0 6px; }
.cl-md ul, .cl-md ol { margin: 12px 0; padding-left: 24px; }
.cl-md li { margin: 5px 0; }
.cl-md a { color: var(--cl-accent); text-decoration: none; }
.cl-md a:hover { text-decoration: underline; }
.cl-md strong { font-weight: 650; }
.cl-md blockquote { border-left: 3px solid var(--cl-border); padding-left: 14px; color: var(--cl-text-2); margin: 12px 0; }
.cl-md hr { border: none; border-top: 1px solid var(--cl-border); margin: 20px 0; }
.cl-md code.inline { background: rgba(60,55,45,0.08); border-radius: 5px; padding: 1.5px 5px; font-family: var(--cl-mono); font-size: 0.88em; }
.cl-code { background: var(--cl-code-bg); border-radius: 12px; margin: 14px 0; overflow: hidden; }
.cl-code__bar { display: flex; align-items: center; justify-content: space-between; padding: 7px 14px; background: rgba(255,255,255,0.05); }
.cl-code__lang { font-size: 11px; color: #b7b3a8; font-family: var(--cl-mono); letter-spacing: 0.3px; }
.cl-code__copy { background: transparent; border: none; color: #b7b3a8; font-size: 11px; cursor: pointer; }
.cl-code__copy:hover { color: #fff; }
.cl-code pre { margin: 0; padding: 14px; overflow-x: auto; }
.cl-code code { font-family: var(--cl-mono); font-size: 12.5px; line-height: 1.6; color: #e8e6df; white-space: pre; }

/* tool + permission cards (calm) */
.cl-tool { border: 1px solid var(--cl-border-soft); border-radius: 12px; margin: 10px 0; background: var(--cl-surface); overflow: hidden; }
.cl-tool__head { display: flex; align-items: center; gap: 9px; padding: 9px 13px; cursor: pointer; font-size: 13px; color: var(--cl-text-2); }
.cl-tool__dot { width: 15px; text-align: center; font-family: var(--cl-mono); font-size: 11px; }
.cl-tool__name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--cl-text); font-weight: 550; }
.cl-tool__badge { font-size: 8px; padding: 2px 5px; border-radius: 4px; background: rgba(201,100,66,0.12); color: var(--cl-accent); font-weight: 700; letter-spacing: 0.3px; }
.cl-tool__body { border-top: 1px solid var(--cl-border-soft); padding: 10px 13px; background: var(--cl-surface-2); }
.cl-tool__body pre { margin: 0; font-family: var(--cl-mono); font-size: 11.5px; line-height: 1.55; white-space: pre-wrap; max-height: 320px; overflow: auto; color: var(--cl-text-2); }

.cl-perm { margin: 12px 0; padding: 14px; border-radius: 14px; border: 1px solid rgba(201,100,66,0.35); background: rgba(201,100,66,0.06); }
.cl-perm__t { font-size: 13.5px; font-weight: 700; margin-bottom: 3px; }
.cl-perm__d { font-size: 13px; color: var(--cl-text-2); margin-bottom: 3px; }
.cl-perm__target { font-size: 11.5px; font-family: var(--cl-mono); color: var(--cl-muted); margin-bottom: 11px; word-break: break-all; }
.cl-perm__row { display: flex; gap: 8px; flex-wrap: wrap; }
.cl-btn { border: none; border-radius: 9px; padding: 7px 13px; font-size: 12.5px; font-weight: 650; cursor: pointer; }
.cl-btn--primary { background: var(--cl-accent); color: #fff; }
.cl-btn--primary:hover { background: var(--cl-accent-hover); }
.cl-btn--ghost { background: rgba(255,255,255,0.06); color: var(--cl-text-2); }
.cl-btn--danger { background: rgba(200,50,60,0.1); color: #b03b3b; }
.cl-status { font-size: 12.5px; color: var(--cl-muted); margin: 6px 0; font-style: italic; }
.cl-errline { font-size: 13px; color: #b03b3b; background: rgba(200,50,60,0.06); border-radius: 10px; padding: 9px 13px; margin: 8px 0; }

/* ---- Composer ---- */
.cl-composer-wrap { position: absolute; left: 0; right: 0; bottom: 0; display: flex; justify-content: center; padding: 0 24px 22px; background: linear-gradient(180deg, rgba(240,238,230,0) 0%, var(--cl-bg) 42%); pointer-events: none; }
.cl-composer-wrap--center { position: static; background: none; padding: 0; width: 100%; }
.cl-composer { pointer-events: auto; width: 100%; max-width: 740px; background: var(--cl-surface-2); border: 1px solid var(--cl-border); border-radius: 20px; box-shadow: 0 4px 24px rgba(60,55,45,0.08); padding: 12px 14px 10px; }
.cl-composer textarea { width: 100%; border: none; outline: none; resize: none; background: transparent; font-family: var(--cl-font); font-size: 15px; line-height: 1.5; color: var(--cl-text); max-height: 220px; pointer-events: auto; position: relative; }
.cl-composer textarea::placeholder { color: var(--cl-muted); }
.cl-composer__row { display: flex; align-items: center; justify-content: space-between; margin-top: 8px; }
.cl-modelchip { background: rgba(255,255,255,0.05); border: 1px solid var(--cl-border-soft); border-radius: 999px; padding: 5px 12px; font-size: 12px; font-weight: 600; color: var(--cl-text-2); cursor: pointer; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-modelchip:hover { background: rgba(255,255,255,0.09); }
.cl-modelchip--auto { background: rgba(230, 150, 0, 0.13); border-color: rgba(230, 150, 0, 0.4); color: #8a5a00; }
.cl-modelchip--auto:hover { background: rgba(230, 150, 0, 0.2); }
.cl-modelchip--plan { background: rgba(80, 110, 220, 0.12); border-color: rgba(80, 110, 220, 0.4); color: #3a4fa8; }
.cl-modelchip--plan:hover { background: rgba(80, 110, 220, 0.19); }
.cl-jumpwrap { position: sticky; bottom: 10px; display: flex; justify-content: center; height: 0; pointer-events: none; }
.cl-jump { pointer-events: auto; transform: translateY(-100%); width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--cl-border); background: var(--cl-surface); color: var(--cl-text-2); font-size: 15px; cursor: pointer; box-shadow: 0 2px 10px rgba(60,55,45,0.16); }
.cl-jump:hover { background: var(--cl-bg); }
.cl-attach { width: 28px; height: 28px; flex-shrink: 0; border-radius: 50%; border: 1px solid var(--cl-border-soft); background: rgba(255,255,255,0.05); color: var(--cl-text-2); font-size: 16px; line-height: 1; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
.cl-attach:hover { background: rgba(255,255,255,0.10); }

/* ---- split layouts: IDE (code-first) + Design ---- */
.cl-split { flex: 1; display: flex; min-width: 0; min-height: 0; }
.cl-idecenter { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; background: var(--cl-surface); }
.cl-split__chat { display: flex; min-width: 0; min-height: 0; flex: 1; }
.cl-split__chat--dock { flex: 0 0 430px; max-width: 480px; border-left: 1px solid var(--cl-border-soft); background: var(--cl-bg); }
.cl-split__chat--design { flex: 0 0 42%; max-width: 560px; min-width: 360px; }

/* ---- run bar ---- */
.cl-runbar { display: flex; align-items: center; gap: 10px; padding: 0 10px; border-bottom: 1px solid var(--cl-border-soft); background: rgba(255,255,255,0.03); height: 30px; flex-shrink: 0; }
.cl-runbtn { border: none; background: var(--cl-accent); color: #fff; border-radius: 6px; padding: 3px 12px; font-size: 12px; font-weight: 600; cursor: pointer; }
.cl-runbtn:hover { background: var(--cl-accent-hover); }
.cl-runbtn:disabled { opacity: 0.35; cursor: not-allowed; }
.cl-runlabel { font-size: 11.5px; color: var(--cl-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-runcfg { border: none; background: none; font-size: 11px; color: var(--cl-muted); cursor: pointer; flex-shrink: 0; }
.cl-runcfg:hover { color: var(--cl-text-2); text-decoration: underline; }

/* ---- design canvas ---- */
.cl-canvas { flex: 1; display: flex; flex-direction: column; min-width: 0; border-left: 1px solid var(--cl-border-soft); background: #fff; }
.cl-canvas__bar { display: flex; justify-content: space-between; align-items: center; padding: 6px 12px; border-bottom: 1px solid var(--cl-border-soft); font-size: 12px; font-weight: 600; color: var(--cl-text-2); background: var(--cl-bg); }
.cl-canvas__bar button { border: 1px solid var(--cl-border-soft); background: none; border-radius: 6px; font-size: 11px; padding: 2px 8px; cursor: pointer; color: var(--cl-text-2); }
.cl-canvas__bar button:disabled { opacity: 0.4; cursor: default; }
.cl-canvas__live { color: #c96442; font-size: 11px; animation: vibe-pulse 1.4s ease-in-out infinite; }
@keyframes vibe-pulse { 50% { opacity: 0.35; } }
.cl-canvas__frame { flex: 1; border: none; width: 100%; background: #fff; }
.cl-canvas__empty { flex: 1; display: flex; flex-direction: column; gap: 10px; align-items: center; justify-content: center; color: var(--cl-muted); font-size: 13px; padding: 24px; text-align: center; line-height: 1.6; }

/* ---- ask_user question panel ---- */
.cl-composer-stack { width: 100%; max-width: 760px; display: flex; flex-direction: column; align-items: stretch; gap: 8px; }
.cl-qpanel { pointer-events: auto; align-self: center; width: 100%; max-width: 740px; background: var(--cl-surface-2, #fff); border: 1px solid var(--cl-border); border-radius: 16px; box-shadow: 0 8px 30px rgba(60,55,45,0.14); overflow: hidden; }
.cl-qpanel__head { display: flex; align-items: center; justify-content: space-between; padding: 9px 12px 5px; font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--cl-muted); }
.cl-qpanel__x { border: none; background: none; font-size: 19px; line-height: 1; cursor: pointer; color: var(--cl-muted); padding: 0 2px; }
.cl-qpanel__x:hover { color: var(--cl-text); }
.cl-qsec { padding: 6px 12px 10px; }
.cl-qsec + .cl-qsec { border-top: 1px solid var(--cl-border-soft); }
.cl-qsec__q { font-size: 14px; font-weight: 600; color: var(--cl-text); line-height: 1.35; }
.cl-qsec__hint { font-size: 11px; color: var(--cl-muted); margin-top: 2px; }
.cl-qopts { display: flex; flex-direction: column; gap: 6px; margin-top: 9px; }
.cl-qopt { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; border: 1px solid var(--cl-border); background: var(--cl-surface); border-radius: 10px; padding: 9px 12px; font-size: 13.5px; color: var(--cl-text); cursor: pointer; transition: background 0.12s, border-color 0.12s; }
.cl-qopt:hover { background: rgba(255,255,255,0.04); }
.cl-qopt--on { border-color: var(--cl-accent); background: rgba(80,110,220,0.08); }
.cl-qopt__mark { width: 18px; height: 18px; flex-shrink: 0; border-radius: 50%; border: 1.5px solid var(--cl-border); display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: #fff; }
.cl-qopt__mark--multi { border-radius: 5px; }
.cl-qopt--on .cl-qopt__mark { background: var(--cl-accent); border-color: var(--cl-accent); }
.cl-qopt__label { flex: 1; line-height: 1.3; }
.cl-qopt__desc { color: var(--cl-muted); font-size: 12px; }
.cl-qpanel__row { display: flex; justify-content: flex-end; padding: 4px 12px 10px; }
.cl-qsubmit { border: none; background: var(--cl-accent); color: #fff; border-radius: 9px; padding: 7px 18px; font-size: 13px; font-weight: 600; cursor: pointer; }
.cl-qsubmit:hover { background: var(--cl-accent-hover); }
.cl-qsubmit:disabled { opacity: 0.4; cursor: not-allowed; }

/* ---- usage telemetry + inline svg ---- */
.cl-usagechip { font-size: 10.5px; color: var(--cl-muted); white-space: nowrap; cursor: default; }
.cl-svgblock { border: 1px solid var(--cl-border-soft); border-radius: 10px; overflow: hidden; margin: 8px 0; background: #fff; }
.cl-svgblock > iframe { width: 100%; height: 280px; border: none; display: block; }

/* ---- editor Preview/Code toggle bar ---- */
.cl-renderbar { display: flex; align-items: center; justify-content: space-between; height: 30px; padding: 0 10px; border-bottom: 1px solid var(--cl-border-soft); background: rgba(255,255,255,0.03); flex-shrink: 0; }
.cl-renderbar__name { font-size: 11.5px; color: var(--cl-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-renderbar__toggle { display: flex; gap: 2px; background: rgba(255,255,255,0.06); border-radius: 7px; padding: 2px; flex-shrink: 0; }
.cl-renderbar__toggle button { border: none; background: none; font-size: 11.5px; padding: 3px 11px; border-radius: 5px; cursor: pointer; color: var(--cl-text-2); }
.cl-renderbar__toggle button.on { background: var(--cl-surface); box-shadow: 0 1px 3px rgba(0,0,0,0.12); font-weight: 600; color: var(--cl-text); }
.cl-md-preview { color: var(--cl-text); background: var(--cl-bg); }
.cl-svglightbox { position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 1000; display: grid; place-items: center; }
.cl-svglightbox > iframe { width: 88vw; height: 84vh; border: none; background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.35); }
.cl-svglightbox__close { position: fixed; top: 18px; right: 22px; border: none; background: rgba(255,255,255,0.92); border-radius: 8px; padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; }
.cl-send { width: 34px; height: 34px; border-radius: 50%; border: none; background: var(--cl-accent); color: #fff; font-size: 16px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; transition: background 0.15s; }
.cl-send:hover { background: var(--cl-accent-hover); }
.cl-send:disabled { opacity: 0.35; cursor: not-allowed; }
.cl-send--stop { background: transparent; border: 2px solid var(--cl-accent); color: var(--cl-accent); }
.cl-imgchips { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 8px; }
.cl-imgchip { font-size: 11px; background: rgba(255,255,255,0.06); border-radius: 7px; padding: 3px 8px; display: flex; gap: 6px; align-items: center; color: var(--cl-text-2); }
.cl-imgchip button { border: none; background: none; cursor: pointer; color: var(--cl-muted); }

/* ---- Workspace drawer (editor/terminal) ---- */
.cl-workspace { width: 46%; min-width: 380px; max-width: 720px; border-left: 1px solid var(--cl-border-soft); background: var(--cl-surface); display: flex; flex-direction: column; }
.cl-ws__head { height: 38px; display: flex; align-items: center; justify-content: space-between; padding: 0 12px; border-bottom: 1px solid var(--cl-border-soft); font-size: 12px; color: var(--cl-text-2); font-weight: 600; }

/* ---- Modal shell (model picker, settings) ---- */
.cl-modal-ov { position: fixed; inset: 0; z-index: 1000; display: flex; align-items: center; justify-content: center; background: rgba(40,38,32,0.4); }
.cl-modal { background: var(--cl-surface-2); border: 0.5px solid var(--cl-border); border-radius: 16px; box-shadow: 0 20px 60px rgba(40,38,32,0.25); display: flex; flex-direction: column; overflow: hidden; }
.cl-modal__head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; border-bottom: 0.5px solid var(--cl-border-soft); }
.cl-modal__title { font-size: 15px; font-weight: 600; color: var(--cl-text); }
.cl-x { background: transparent; border: none; cursor: pointer; color: var(--cl-muted); font-size: 18px; width: 28px; height: 28px; border-radius: 7px; }
.cl-x:hover { background: rgba(255,255,255,0.07); color: var(--cl-text); }
.cl-input { width: 100%; height: 38px; padding: 0 12px; border-radius: 10px; border: 0.5px solid var(--cl-border); background: var(--cl-surface); color: var(--cl-text); outline: none; font-size: 13.5px; font-family: var(--cl-font); }
.cl-input:focus { border-color: var(--cl-accent); box-shadow: 0 0 0 3px rgba(201,100,66,0.12); }

/* model picker */
.cl-mp { width: 560px; max-width: 92vw; height: 74vh; }
.cl-mp__search { padding: 12px 16px; border-bottom: 0.5px solid var(--cl-border-soft); }
.cl-mp__list { flex: 1; overflow-y: auto; padding: 8px; }
.cl-mp__group { font-size: 11px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase; color: var(--cl-muted); padding: 12px 10px 5px; display: flex; align-items: center; gap: 8px; }
.cl-mp__row { display: flex; align-items: center; gap: 10px; padding: 9px 11px; border-radius: 10px; cursor: pointer; }
.cl-mp__row:hover { background: rgba(255,255,255,0.05); }
.cl-mp__row--active { background: rgba(201,100,66,0.10); }
.cl-mp__name { flex: 1; font-size: 13.5px; color: var(--cl-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-mp__meta { font-size: 11px; color: var(--cl-muted); }
.cl-tagpill { font-size: 8.5px; font-weight: 700; padding: 2px 5px; border-radius: 4px; letter-spacing: 0.3px; }

/* settings */
.cl-set { width: 860px; max-width: 94vw; height: 82vh; flex-direction: row; }
.cl-set__nav { width: 200px; flex-shrink: 0; background: var(--cl-rail); border-right: 0.5px solid var(--cl-border-soft); padding: 12px 8px; display: flex; flex-direction: column; gap: 2px; }
.cl-set__navbtn { text-align: left; border: none; background: transparent; padding: 9px 12px; border-radius: 9px; font-size: 13px; color: var(--cl-text-2); cursor: pointer; display: flex; align-items: center; gap: 9px; }
.cl-set__navbtn:hover { background: rgba(255,255,255,0.06); }
.cl-set__navbtn--active { background: var(--cl-surface-2); color: var(--cl-text); font-weight: 550; }
.cl-set__body { flex: 1; overflow-y: auto; padding: 22px 26px; }
.cl-set__h { font-size: 17px; font-weight: 600; margin-bottom: 4px; }
.cl-set__sub { font-size: 12.5px; color: var(--cl-text-2); margin-bottom: 18px; }
.cl-field { margin-bottom: 16px; }
.cl-field__label { font-size: 12.5px; font-weight: 600; color: var(--cl-text-2); display: block; margin-bottom: 5px; }
.cl-field__hint { font-size: 11.5px; color: var(--cl-muted); margin-top: 4px; }
.cl-catalog-row { display: flex; align-items: flex-start; gap: 12px; padding: 13px 14px; border: 0.5px solid var(--cl-border-soft); border-radius: 12px; margin-bottom: 8px; background: var(--cl-surface); }
.cl-catalog-row__main { flex: 1; min-width: 0; }
.cl-catalog-row__name { font-size: 13.5px; font-weight: 600; color: var(--cl-text); display: flex; align-items: center; gap: 8px; }
.cl-catalog-row__desc { font-size: 12px; color: var(--cl-text-2); margin-top: 3px; line-height: 1.5; }
.cl-pill-btn { border: 0.5px solid var(--cl-border); background: var(--cl-surface-2); color: var(--cl-text); border-radius: 999px; padding: 6px 14px; font-size: 12px; font-weight: 600; cursor: pointer; flex-shrink: 0; }
.cl-pill-btn:hover { background: rgba(255,255,255,0.09); }
.cl-pill-btn--on { background: var(--cl-accent); color: #fff; border-color: var(--cl-accent); }
.cl-pill-btn--danger { color: #b03b3b; }
.cl-pill-btn:disabled { opacity: 0.5; cursor: default; }
.cl-transport { font-size: 8.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px; letter-spacing: 0.3px; text-transform: uppercase; }
.cl-empty { text-align: center; color: var(--cl-muted); font-size: 12.5px; padding: 30px 0; }

/* ---- Rich markdown extras ---- */
.cl-md table { border-collapse: collapse; margin: 14px 0; font-size: 14px; width: 100%; display: block; overflow-x: auto; }
.cl-md th, .cl-md td { border: 0.5px solid var(--cl-border); padding: 7px 12px; text-align: left; }
.cl-md th { background: rgba(60,55,45,0.05); font-weight: 600; }
.cl-md ul.cl-tasks { list-style: none; padding-left: 8px; }
.cl-md .cl-task { display: flex; align-items: flex-start; gap: 8px; margin: 4px 0; }
.cl-md .cl-task input { margin-top: 3px; accent-color: var(--cl-accent); }
.cl-md li > ul, .cl-md li > ol { margin: 4px 0; }
.tok-str { color: #a3be8c; }
.tok-com { color: #7c776b; font-style: italic; }
.tok-kw { color: #d6836a; }
.tok-num { color: #b48ead; }
.tok-fn { color: #8fa9d6; }

/* ---- Message actions ---- */
.cl-msg__wrap { position: relative; }
.cl-acts { display: flex; gap: 4px; align-items: center; margin-top: 4px; opacity: 0; transition: opacity 0.12s; }
.cl-msg__wrap:hover .cl-acts { opacity: 1; }
.cl-act { border: none; background: transparent; color: var(--cl-muted); font-size: 11.5px; cursor: pointer; padding: 3px 7px; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px; }
.cl-act:hover { background: rgba(255,255,255,0.07); color: var(--cl-text-2); }
.cl-modelbadge { font-size: 10.5px; color: var(--cl-muted); padding: 3px 4px; }

/* ---- Composer menus (slash / @) ---- */
.cl-menu { position: absolute; bottom: calc(100% + 8px); left: 0; right: 0; background: var(--cl-surface-2); border: 0.5px solid var(--cl-border); border-radius: 12px; box-shadow: 0 8px 28px rgba(40,55,45,0.14); max-height: 240px; overflow-y: auto; padding: 6px; z-index: 20; }
.cl-menu__row { display: flex; gap: 10px; align-items: center; padding: 8px 10px; border-radius: 8px; cursor: pointer; font-size: 13px; color: var(--cl-text-2); }
.cl-menu__row:hover { background: rgba(255,255,255,0.06); color: var(--cl-text); }
.cl-menu__row b { color: var(--cl-text); }

/* ---- History rows ---- */
.cl-histrow { display: flex; align-items: center; border-radius: 8px; }
.cl-histrow:hover { background: rgba(255,255,255,0.06); }
.cl-histrow .cl-histitem { flex: 1; }
.cl-histrow:hover .cl-histitem { background: transparent; }
.cl-histrow__acts { display: none; gap: 2px; padding-right: 6px; }
.cl-histrow:hover .cl-histrow__acts { display: flex; }
.cl-histrow__acts button { border: none; background: transparent; cursor: pointer; color: var(--cl-muted); font-size: 11px; padding: 3px 4px; border-radius: 5px; }
.cl-histrow__acts button:hover { background: rgba(255,255,255,0.10); color: var(--cl-text); }

/* ---- Message images + lightbox ---- */
.cl-msg-imgs { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; margin-bottom: 8px; }
.cl-thumb { max-width: 220px; max-height: 220px; border-radius: 12px; border: 0.5px solid var(--cl-border); cursor: zoom-in; object-fit: cover; }
.cl-thumb-sm { width: 30px; height: 30px; border-radius: 6px; object-fit: cover; margin-right: 6px; vertical-align: middle; }
.cl-lightbox-img { max-width: 90vw; max-height: 90vh; border-radius: 10px; cursor: zoom-out; box-shadow: 0 20px 60px rgba(0,0,0,0.4); }

/* ---- Typing indicator ---- */
.cl-typing { display: inline-flex; gap: 5px; padding: 10px 2px; }
.cl-typing span { width: 7px; height: 7px; border-radius: 50%; background: var(--cl-muted); animation: cl-bounce 1.2s infinite ease-in-out; }
.cl-typing span:nth-child(2) { animation-delay: 0.15s; }
.cl-typing span:nth-child(3) { animation-delay: 0.3s; }
@keyframes cl-bounce { 0%, 80%, 100% { opacity: 0.25; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }
```

## `src/renderer/utils/capabilities.ts`

```ts
import type { ModelCapability } from '../../shared/types';

export const OLLAMA_ONLY_MODELS = new Set<string>([
    'gpt-oss-120b',
]);

export async function fetchCapabilities(modelId: string, opts?: { cloud?: boolean; ollamaKey?: string }): Promise<ModelCapability> {
    try {
        const result = await window.vibe.getModelCapabilities(modelId, opts);
        if (!result) return getFallbackCapabilities(modelId);
        return {
            think: result.think,
            thinkBudget: result.thinkBudget,
            vision: result.vision,
            tools: result.tools,
            image: result.vision,
            canExecute: true,
            requiresApproval: true,
        };
    } catch {
        return getFallbackCapabilities(modelId);
    }
}

// Keep as fallback for cloud models Ollama doesn't know about
export function getFallbackCapabilities(modelId: string): ModelCapability {
    const lower = modelId.toLowerCase();
    const caps: ModelCapability = { canExecute: true, requiresApproval: true };

    if (lower.includes('qwq') || lower.includes('deepseek-r1') ||
        lower.includes('r1') || lower.includes('claude-3-7') ||
        lower.includes('claude-3-5') || lower.includes('qwen3')) {
        caps.think = true;
        caps.thinkBudget = lower.includes('claude') ? 'tiered' : 'toggle';
    }

    if (lower.includes('qwen2.5') || lower.includes('gemma3')) {
        caps.think = true;
        caps.thinkBudget = 'toggle';
    }

    // Vision-capable families (name-pattern fallback for models Ollama doesn't
    // report caps for — mostly cloud). 'vl'/'vision' already catch qwen-vl,
    // internvl, llama-vision, granite-vision, etc.; add the ones whose names
    // don't contain those tokens.
    if (lower.includes('vl') || lower.includes('vision') ||
        lower.includes('llava') || lower.includes('gemini') ||
        lower.includes('gpt-4o') || lower.includes('gpt-5') || lower.includes('llama4') ||
        lower.includes('minicpm') || lower.includes('moondream') || lower.includes('pixtral') ||
        lower.includes('gemma3') || lower.includes('gemma4') || lower.includes('gemma-3') || lower.includes('gemma-4') ||
        lower.includes('claude-3') || lower.includes('claude-4') || lower.includes('claude-opus') || lower.includes('claude-sonnet')) {
        caps.vision = true;
        caps.image = true;
    }

    if (lower.includes('gemini') || lower.includes('gpt-4o') ||
        lower.includes('claude') || lower.includes('qwen') ||
        lower.includes('llama3')) {
        caps.tools = true;
    }

    if (lower.includes('reasoner') || lower.includes('o1') || lower.includes('o3') ||
        lower.includes('sonnet') || lower.includes('deepseek')) {
        caps.think = true;
    }

    if (lower.includes('gemini') || lower.includes('gpt-4o') ||
        lower.includes('claude') || lower.includes('cloud')) {
        caps.web = true;
    }

    return caps;
}

// Synchronous alias kept for backward compatibility (used in initial store hydration)
export function getCapabilities(modelId: string): ModelCapability {
    return getFallbackCapabilities(modelId);
}
```

## `src/renderer/utils/commandSanitizer.ts`

```ts
/**
 * Translate Unix/bash commands to PowerShell equivalents.
 * Runs on every <execute> command before it hits the terminal.
 * If the command is already PowerShell-native it passes through unchanged.
 */
export function sanitizeForPowerShell(command: string): string {
    let cmd = command.trim()

    // Replace && with ; (PowerShell uses semicolons)
    cmd = cmd.replace(/\s*&&\s*/g, '; ')

    // Replace || with PowerShell equivalent
    cmd = cmd.replace(/\s*\|\|\s*/g, '; if ($LASTEXITCODE -ne 0) { ')

    // ls variants -> dir
    cmd = cmd.replace(/^ls\s*-la?\b/gm, 'dir')
    cmd = cmd.replace(/^ls\s*-al?\b/gm, 'dir')
    cmd = cmd.replace(/^ls\s*$/gm, 'dir')
    cmd = cmd.replace(/^ls\s+([^\|]+)/gm, 'dir "$1"')

    // cat -> Get-Content
    cmd = cmd.replace(/\bcat\s+([^\|;\n]+)/g, 'Get-Content "$1"')

    // touch -> New-Item
    cmd = cmd.replace(
        /\btouch\s+([^\|;\n]+)/g,
        'New-Item -ItemType File -Force "$1"'
    )

    // mkdir -p -> New-Item
    cmd = cmd.replace(
        /\bmkdir\s+-p\s+([^\|;\n]+)/g,
        'New-Item -ItemType Directory -Force "$1"'
    )
    cmd = cmd.replace(
        /\bmkdir\s+([^\|;\n]+)/g,
        'New-Item -ItemType Directory -Force "$1"'
    )

    // rm -rf -> Remove-Item
    cmd = cmd.replace(
        /\brm\s+-rf?\s+([^\|;\n]+)/g,
        'Remove-Item -Recurse -Force "$1"'
    )
    cmd = cmd.replace(
        /\brm\s+([^\|;\n]+)/g,
        'Remove-Item "$1"'
    )

    // cp -> Copy-Item
    cmd = cmd.replace(
        /\bcp\s+([^\s]+)\s+([^\|;\n]+)/g,
        'Copy-Item "$1" "$2"'
    )

    // mv -> Move-Item
    cmd = cmd.replace(
        /\bmv\s+([^\s]+)\s+([^\|;\n]+)/g,
        'Move-Item "$1" "$2"'
    )

    // grep -> Select-String
    cmd = cmd.replace(
        /\bgrep\s+([^\s]+)\s+([^\|;\n]+)/g,
        'Select-String "$1" "$2"'
    )

    // find . -name -> Get-ChildItem -Recurse -Filter
    cmd = cmd.replace(
        /\bfind\s+\.\s+-name\s+([^\|;\n]+)/g,
        'Get-ChildItem -Recurse -Filter $1'
    )

    // echo with quotes
    cmd = cmd.replace(/\becho\s+"([^"]+)"/g, 'Write-Host "$1"')
    cmd = cmd.replace(/\becho\s+'([^']+)'/g, "Write-Host '$1'")
    cmd = cmd.replace(/\becho\s+([^\|;\n]+)/g, 'Write-Host $1')

    // pwd -> Get-Location
    cmd = cmd.replace(/\bpwd\b/g, 'Get-Location')

    // which -> Get-Command
    cmd = cmd.replace(/\bwhich\s+([^\|;\n]+)/g, 'Get-Command $1')

    // chmod / chown -> no-op with note (Windows doesn't use these)
    cmd = cmd.replace(
        /\bchmod\s+[^\|;\n]+/g,
        'Write-Host "chmod not needed on Windows"'
    )
    cmd = cmd.replace(
        /\bchown\s+[^\|;\n]+/g,
        'Write-Host "chown not needed on Windows"'
    )

    // head -n -> Select-Object -First
    cmd = cmd.replace(
        /\bhead\s+-(\d+)\s+([^\|;\n]+)/g,
        'Get-Content "$2" | Select-Object -First $1'
    )
    cmd = cmd.replace(
        /\bhead\s+-n\s+(\d+)\s+([^\|;\n]+)/g,
        'Get-Content "$2" | Select-Object -First $1'
    )

    // tail -n -> Select-Object -Last
    cmd = cmd.replace(
        /\btail\s+-(\d+)\s+([^\|;\n]+)/g,
        'Get-Content "$2" | Select-Object -Last $1'
    )

    // wc -l -> Measure-Object
    cmd = cmd.replace(
        /\bwc\s+-l\s*([^\|;\n]*)/g,
        (_, file: string) => file.trim()
            ? `(Get-Content "${file.trim()}").Count`
            : '($input | Measure-Object -Line).Lines'
    )

    // sed basic replace -> not easy, just warn
    cmd = cmd.replace(
        /\bsed\s+[^\|;\n]+/g,
        'Write-Host "Use (Get-Content file) -replace pattern, replacement | Set-Content file"'
    )

    return cmd
}
```

## `src/renderer/utils/run.ts`

```ts
/* =======================================================================
   Universal run system.

   Resolution order (first hit wins):
     1. .vibe/run.json           - explicit per-project override {"command","label"}
     2. Project markers          - package.json scripts, Cargo.toml, go.mod, ...
     3. Active-file runner       - extension -> toolchain command
   Commands execute in the visible terminal pane (PowerShell on Windows), so
   toolchains must be on PATH - failures surface honestly in the terminal.
   ======================================================================= */
import { useTerminalStore } from '../store/terminal';
import { useUIStore } from '../store/ui';

export interface RunPlan {
    label: string;    // what the Run button shows ("npm run dev", "cargo run", ...)
    command: string;  // exactly what is typed into the terminal
    source: 'override' | 'project' | 'file';
}

const q = (p: string) => `"${p.replace(/"/g, '')}"`;

/* ---- platform ----------------------------------------------------------- */
// The commands run in the visible terminal, which is PowerShell on Windows and
// bash/zsh elsewhere. Everything below branches on this so a compiled-language
// "Run" produces a valid command line on Linux/macOS, not PowerShell syntax.
const IS_WIN = window.vibe.platform === 'win32';
const OPEN = IS_WIN ? 'Start-Process' : (window.vibe.platform === 'darwin' ? 'open' : 'xdg-open');

/* ---- file-level runners: extension -> command builder ------------------- */
type FileRunner = (f: string, stem: string) => string;
// Scratch path for compiled output: %TEMP%\vibe_run.exe on Windows, /tmp/vibe_run elsewhere.
const TMP = IS_WIN ? '$env:TEMP\\vibe_run' : '/tmp/vibe_run';

/** Compile-then-run: chain with && on POSIX (fail-fast) and `; &` on PowerShell,
 *  and only append .exe on Windows. `build(out)` must emit the compiler invocation
 *  that writes the executable to `out`. */
function compileRun(build: (out: string) => string): string {
    const out = IS_WIN ? `${TMP}.exe` : TMP;
    if (IS_WIN) return `${build(`"${out}"`)}; & "${out}"`;
    return `${build(`"${out}"`)} && "${out}"`;
}

const FILE_RUNNERS: Record<string, { label: string; cmd: FileRunner }> = {
    py: { label: 'python', cmd: (f) => `python ${q(f)}` },
    js: { label: 'node', cmd: (f) => `node ${q(f)}` },
    mjs: { label: 'node', cmd: (f) => `node ${q(f)}` },
    cjs: { label: 'node', cmd: (f) => `node ${q(f)}` },
    ts: { label: 'tsx', cmd: (f) => `npx tsx ${q(f)}` },
    tsx: { label: 'tsx', cmd: (f) => `npx tsx ${q(f)}` },
    jsx: { label: 'tsx', cmd: (f) => `npx tsx ${q(f)}` },
    rs: { label: 'rustc', cmd: (f) => compileRun((o) => `rustc ${q(f)} -o ${o}`) },
    go: { label: 'go run', cmd: (f) => `go run ${q(f)}` },
    c: { label: 'gcc', cmd: (f) => compileRun((o) => `gcc ${q(f)} -o ${o}`) },
    cpp: { label: 'g++', cmd: (f) => compileRun((o) => `g++ ${q(f)} -o ${o}`) },
    cc: { label: 'g++', cmd: (f) => compileRun((o) => `g++ ${q(f)} -o ${o}`) },
    java: { label: 'java', cmd: (f) => `java ${q(f)}` },              // JEP 330 single-file launch
    kt: { label: 'kotlin', cmd: (f) => {
        const jar = `${TMP}.jar`;
        const sep = IS_WIN ? '; ' : ' && ';
        return `kotlinc ${q(f)} -include-runtime -d "${jar}"${sep}java -jar "${jar}"`;
    } },
    cs: { label: 'dotnet run', cmd: () => 'dotnet run' },             // needs a csproj context
    fs: { label: 'dotnet fsi', cmd: (f) => `dotnet fsi ${q(f)}` },
    sh: { label: 'bash', cmd: (f) => `bash ${q(f)}` },
    ps1: { label: 'powershell', cmd: (f) => `powershell -ExecutionPolicy Bypass -File ${q(f)}` },
    bat: { label: 'cmd', cmd: (f) => `cmd /c ${q(f)}` },
    rb: { label: 'ruby', cmd: (f) => `ruby ${q(f)}` },
    php: { label: 'php', cmd: (f) => `php ${q(f)}` },
    lua: { label: 'lua', cmd: (f) => `lua ${q(f)}` },
    pl: { label: 'perl', cmd: (f) => `perl ${q(f)}` },
    r: { label: 'Rscript', cmd: (f) => `Rscript ${q(f)}` },
    jl: { label: 'julia', cmd: (f) => `julia ${q(f)}` },
    swift: { label: 'swift', cmd: (f) => `swift ${q(f)}` },
    dart: { label: 'dart', cmd: (f) => `dart run ${q(f)}` },
    hs: { label: 'runghc', cmd: (f) => `runghc ${q(f)}` },
    ex: { label: 'elixir', cmd: (f) => `elixir ${q(f)}` },
    exs: { label: 'elixir', cmd: (f) => `elixir ${q(f)}` },
    erl: { label: 'escript', cmd: (f) => `escript ${q(f)}` },
    clj: { label: 'clojure', cmd: (f) => `clojure -M ${q(f)}` },
    scala: { label: 'scala-cli', cmd: (f) => `scala-cli run ${q(f)}` },
    groovy: { label: 'groovy', cmd: (f) => `groovy ${q(f)}` },
    nim: { label: 'nim', cmd: (f) => `nim c -r ${q(f)}` },
    zig: { label: 'zig', cmd: (f) => `zig run ${q(f)}` },
    d: { label: 'rdmd', cmd: (f) => `rdmd ${q(f)}` },
    ml: { label: 'ocaml', cmd: (f) => `ocaml ${q(f)}` },
    f90: { label: 'gfortran', cmd: (f) => compileRun((o) => `gfortran ${q(f)} -o ${o}`) },
    f95: { label: 'gfortran', cmd: (f) => compileRun((o) => `gfortran ${q(f)} -o ${o}`) },
    v: { label: 'v', cmd: (f) => `v run ${q(f)}` },
    cr: { label: 'crystal', cmd: (f) => `crystal run ${q(f)}` },
    html: { label: 'open in browser', cmd: (f) => `${OPEN} ${q(f)}` },
    sql: { label: 'sqlite3', cmd: (f) => `sqlite3 -init ${q(f)} ":memory:"` },
};

/* ---- project-level detection -------------------------------------------- */
async function readJson(path: string): Promise<any | null> {
    try { return JSON.parse(await window.vibe.readFile(path)); } catch { return null; }
}
async function exists(path: string): Promise<boolean> {
    try { await window.vibe.readFile(path); return true; } catch { return false; }
}

async function detectProjectPlan(root: string): Promise<RunPlan | null> {
    const r = root.replace(/[\\/]+$/, '');
    let names: Set<string>;
    try { names = new Set((await window.vibe.readDir(r)).map((e) => e.name)); } catch { return null; }

    // 1. explicit override always wins
    if (names.has('.vibe')) {
        const ov = await readJson(`${r}/.vibe/run.json`);
        if (ov?.command) return { label: ov.label || ov.command, command: ov.command, source: 'override' };
    }

    // 2. ecosystem markers
    if (names.has('package.json')) {
        const pkg = await readJson(`${r}/package.json`);
        const scripts = pkg?.scripts || {};
        for (const s of ['dev', 'start', 'serve', 'build']) {
            if (scripts[s]) return { label: `npm run ${s}`, command: `npm run ${s}`, source: 'project' };
        }
    }
    if (names.has('deno.json') || names.has('deno.jsonc')) {
        const dj = await readJson(`${r}/deno.json`) ?? await readJson(`${r}/deno.jsonc`);
        const t = dj?.tasks ? Object.keys(dj.tasks)[0] : null;
        if (t) return { label: `deno task ${t}`, command: `deno task ${t}`, source: 'project' };
    }
    if (names.has('Cargo.toml')) return { label: 'cargo run', command: 'cargo run', source: 'project' };
    if (names.has('go.mod')) return { label: 'go run .', command: 'go run .', source: 'project' };
    if (names.has('manage.py')) return { label: 'django runserver', command: 'python manage.py runserver', source: 'project' };
    if (names.has('platformio.ini')) return { label: 'pio run', command: 'pio run', source: 'project' };
    if (names.has('gradlew') || names.has('gradlew.bat')) {
        return { label: 'gradle run', command: IS_WIN ? '.\\gradlew.bat run' : './gradlew run', source: 'project' };
    }
    if (names.has('pom.xml')) return { label: 'maven package', command: 'mvn -q package', source: 'project' };
    if (names.has('mix.exs')) return { label: 'mix run', command: 'mix run', source: 'project' };
    if (names.has('pubspec.yaml')) {
        const pub = await window.vibe.readFile(`${r}/pubspec.yaml`).catch(() => '');
        return pub.includes('flutter')
            ? { label: 'flutter run', command: 'flutter run', source: 'project' }
            : { label: 'dart run', command: 'dart run', source: 'project' };
    }
    for (const n of names) {
        if (n.endsWith('.sln') || n.endsWith('.csproj')) return { label: 'dotnet run', command: 'dotnet run', source: 'project' };
    }
    if (names.has('CMakeLists.txt')) {
        return { label: 'cmake build', command: 'cmake -S . -B build; cmake --build build', source: 'project' };
    }
    if (names.has('Makefile') || names.has('makefile')) return { label: 'make', command: 'make', source: 'project' };
    if (names.has('main.py')) return { label: 'python main.py', command: 'python main.py', source: 'project' };
    if (names.has('app.py')) return { label: 'python app.py', command: 'python app.py', source: 'project' };
    if (names.has('index.php')) return { label: 'php server', command: 'php -S localhost:8080', source: 'project' };
    if (names.has('Gemfile') && await exists(`${r}/config.ru`)) return { label: 'rackup', command: 'bundle exec rackup', source: 'project' };
    return null;
}

/** Resolve what "Run" should do right now. */
export async function detectRunPlan(projectRoot: string | null, activeFile: string | null): Promise<RunPlan | null> {
    if (projectRoot) {
        const proj = await detectProjectPlan(projectRoot);
        // File runner beats a generic project plan when a runnable file is focused
        // and the project plan is only a weak fallback (make/cmake with a file open).
        if (proj && proj.source === 'override') return proj;
        const filePlan = fileRunPlan(activeFile);
        return proj ?? filePlan;
    }
    return fileRunPlan(activeFile);
}

function fileRunPlan(activeFile: string | null): RunPlan | null {
    if (!activeFile) return null;
    const ext = activeFile.split('.').pop()?.toLowerCase() || '';
    const runner = FILE_RUNNERS[ext];
    if (!runner) return null;
    const stem = (activeFile.split(/[\\/]/).pop() || '').replace(/\.[^.]+$/, '');
    return { label: `${runner.label}: ${activeFile.split(/[\\/]/).pop()}`, command: runner.cmd(activeFile, stem), source: 'file' };
}

/** Prefer the focused file's runner when one exists (explicit user intent). */
export async function detectRunPlanForFile(projectRoot: string | null, activeFile: string | null): Promise<RunPlan | null> {
    const filePlan = fileRunPlan(activeFile);
    if (filePlan) {
        // override still wins over everything
        if (projectRoot) {
            const proj = await detectProjectPlan(projectRoot);
            if (proj?.source === 'override') return proj;
        }
        return filePlan;
    }
    return detectRunPlan(projectRoot, activeFile);
}

/** Type the plan's command into the visible terminal. Returns false when no terminal. */
export function executeRunPlan(plan: RunPlan): boolean {
    const termId = useTerminalStore.getState().activeTerminalId;
    if (!termId) return false;
    const root = useUIStore.getState().projectPath;
    const prefix = root ? `cd "${root}"; ` : '';
    window.vibe.sendTerminalInput(termId, prefix + plan.command + '\r');
    return true;
}

/** Scaffold .vibe/run.json so any stack on earth can be wired up. */
export async function createRunOverride(projectRoot: string): Promise<string> {
    const path = `${projectRoot.replace(/[\\/]+$/, '')}/.vibe/run.json`;
    const template = JSON.stringify({ label: 'my app', command: 'echo configure your run command here' }, null, 2);
    await window.vibe.writeFile(path, template);
    return path;
}
```

## `src/renderer/utils/slashCommands.ts`

```ts
import { uiBus } from './uiBus';
import { useUIStore } from '../store/ui';
import { useSettingsStore } from '../store/settings';
import { useAgentRunStore } from '../store/agentRun';

export interface SlashCtx {
    fill: (text: string) => void;     // put text in composer + focus (for commands needing an argument)
    send: (text: string) => void;     // run immediately
    openModel: () => void;
    note: (markdown: string) => void; // push an assistant-style info message
}

export interface SlashCommand { cmd: string; desc: string; group: string; run: (c: SlashCtx) => void | Promise<void>; }

const P = (t: string) => (c: SlashCtx) => c.send(t);           // prompt, auto-run
const F = (t: string) => (c: SlashCtx) => c.fill(t);           // prompt needing an argument

export const SLASH_COMMANDS: SlashCommand[] = [
    // ---- Actions ----
    { cmd: '/model', desc: 'Switch model', group: 'Actions', run: (c) => c.openModel() },
    { cmd: '/clear', desc: 'Start a new chat', group: 'Actions', run: () => uiBus.emit({ t: 'newChat' }) },
    { cmd: '/settings', desc: 'Open settings', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings' }) },
    { cmd: '/skills', desc: 'Manage skills', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings', section: 'skills' }) },
    { cmd: '/connectors', desc: 'Manage MCP connectors', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings', section: 'connectors' }) },
    { cmd: '/mcp', desc: 'Manage MCP connectors', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings', section: 'connectors' }) },
    { cmd: '/keys', desc: 'API keys', group: 'Actions', run: () => uiBus.emit({ t: 'openSettings', section: 'providers' }) },
    { cmd: '/schedule', desc: 'Scheduled tasks', group: 'Actions', run: () => uiBus.emit({ t: 'openSchedule' }) },
    { cmd: '/projects', desc: 'Project settings + instructions', group: 'Actions', run: () => uiBus.emit({ t: 'openProjects' }) },
    { cmd: '/memory', desc: 'Edit project instructions (VIBE.md)', group: 'Actions', run: () => uiBus.emit({ t: 'openProjects' }) },
    { cmd: '/workspace', desc: 'Toggle editor + terminal', group: 'Actions', run: () => uiBus.emit({ t: 'toggleWorkspace' }) },
    { cmd: '/palette', desc: 'Command palette', group: 'Actions', run: () => uiBus.emit({ t: 'openPalette' }) },

    // ---- Agent modes ----
    { cmd: '/goal', desc: 'Autonomous mode: don\'t stop until done', group: 'Tasks', run: F('Work autonomously until this is fully complete. Do not stop to ask questions — make reasonable decisions, handle edge cases, run the build/tests, and verify before finishing. Task: ') },
    { cmd: '/grill-me', desc: 'Interview me before building', group: 'Tasks', run: F('Before writing any code, interview me to pin down requirements. Ask a structured series of pointed questions covering scope (v1 vs later), users, tech choices, edge cases, and design preferences. Ask them, then wait for my answers. What I want to build: ') },
    { cmd: '/learn', desc: 'Save a rule to VIBE.md forever', group: 'Tasks', run: F('Append the following as a permanent project rule to VIBE.md (create the file if missing, preserve existing content): ') },

    // ---- Coding tasks (run the agent) ----
    { cmd: '/init', desc: 'Analyze the project and write VIBE.md', group: 'Tasks', run: P('Analyze this entire project and write a VIBE.md at the project root documenting: the build, run, and test commands; the architecture and key modules and how they connect; coding conventions; and anything a new contributor must know. Read the important files first, then write VIBE.md.') },
    { cmd: '/explain', desc: 'Explain how this codebase works', group: 'Tasks', run: P('Explain how this codebase works: the entry points, the overall architecture, and the main modules and how they connect. Read the key files first, then give a clear walkthrough.') },
    { cmd: '/review', desc: 'Review the code for issues', group: 'Tasks', run: P('Review this project for bugs, security issues, and performance problems. Inspect the code, then give a prioritized list with file:line references and concrete fixes.') },
    { cmd: '/fix', desc: 'Find and fix bugs; run tests', group: 'Tasks', run: P('Find bugs and errors in this project. Run the build and tests, read the failures, fix them, and verify by re-running until green.') },
    { cmd: '/test', desc: 'Write and run tests', group: 'Tasks', run: P('Write meaningful tests for the most important untested code in this project, then run them and make them pass.') },
    { cmd: '/docs', desc: 'Write/update the README', group: 'Tasks', run: P('Write or update the README for this project so a new user can install, configure, and use it. Base every claim on the actual code.') },
    { cmd: '/commit', desc: 'Stage + commit current changes', group: 'Tasks', run: P('Run git status and git diff, then stage the changes and create a git commit with a clear, conventional commit message that summarizes what changed.') },
    { cmd: '/pr', desc: 'Draft a PR description from the diff', group: 'Tasks', run: P('Run git diff against the default branch and summarize it as a pull request description: a title, a short summary, and a bullet list of the notable changes.') },
    { cmd: '/security', desc: 'Security review', group: 'Tasks', run: P('Do a security review of this codebase: injection, auth, secret handling, unsafe file/exec, and dependency risks. Report findings with severity and concrete fixes.') },
    { cmd: '/optimize', desc: 'Find and optimize hot paths', group: 'Tasks', run: P('Find the performance hot paths in this project. Reason about or measure their cost, make the optimization, and verify behavior is unchanged by running the tests.') },
    { cmd: '/summarize', desc: 'Summarize this conversation', group: 'Tasks', run: P('Summarize our conversation so far into a concise brief with the key decisions and next steps.') },
    { cmd: '/refactor', desc: 'Refactor a target (type it)', group: 'Tasks', run: F('Refactor the following for clarity and maintainability without changing behavior, then run the tests: ') },
    { cmd: '/plan', desc: 'Plan a task (type it)', group: 'Tasks', run: F('Make a concrete, step-by-step implementation plan for: ') },
    { cmd: '/web', desc: 'Web search (type a query)', group: 'Tasks', run: F('Search the web and answer, citing sources: ') },

    // ---- Diagnostics ----
    { cmd: '/doctor', desc: 'Check environment + config', group: 'Info', run: async (c) => {
        const ui = useUIStore.getState();
        const keys = useSettingsStore.getState().apiKeys as Record<string, string>;
        const setKeys = Object.entries(keys).filter(([, v]) => v).map(([k]) => k);
        let mcp = 0, skills = 0;
        try { const cfg = await window.vibe.kernel.mcpGetConfig(); mcp = Object.keys(cfg.mcpServers || {}).length; } catch {}
        try { skills = (await window.vibe.kernel.skillsList()).length; } catch {}
        c.note([
            '## VIBE doctor',
            `- **Ollama**: ${ui.ollamaConnected ? 'connected' : 'not detected (run `ollama serve`)'}`,
            `- **Project**: ${ui.projectPath || 'none open'}`,
            `- **API keys set**: ${setKeys.length ? setKeys.join(', ') : 'none'}`,
            `- **Ollama Cloud key**: ${keys.ollama ? 'set' : 'missing (needed for cloud models + web search)'}`,
            `- **MCP connectors**: ${mcp}`,
            `- **Skills installed**: ${skills}`,
        ].join('\n'));
    } },
    { cmd: '/help', desc: 'List commands', group: 'Info', run: (c) => {
        const lines = SLASH_COMMANDS.filter((x) => x.cmd !== '/help').map((x) => `- \`${x.cmd}\` — ${x.desc}`);
        c.note('## Slash commands\n' + lines.join('\n'));
    } },
];
```

## `src/renderer/utils/streamBus.ts`

```ts
type StreamChunk = { content: string; done: boolean };
type StreamHandler = (chunk: StreamChunk) => void;

class StreamBus {
    private handlers = new Set<StreamHandler>();

    subscribe(fn: StreamHandler): () => void {
        this.handlers.add(fn);
        return () => this.handlers.delete(fn);
    }

    emit(chunk: StreamChunk) {
        this.handlers.forEach(fn => fn(chunk));
    }
}

export const streamBus = new StreamBus();
```

## `src/renderer/utils/tags.ts`

```ts
export function getModelTags(modelName: string) {
    const tags: { label: string, color: string, bg: string }[] = [];
    const lower = modelName.toLowerCase();
    
    if (lower.includes('coder') || lower.includes('code')) {
        tags.push({ label: 'Coding', color: 'var(--accent)', bg: 'var(--accent-light)' });
    }
    if (lower.includes('reasoner') || lower.includes('o1') || lower.includes('r1')) {
        tags.push({ label: 'Thinking', color: 'var(--warn)', bg: 'var(--warn-light)' });
    }
    if (lower.includes('pro') || lower.includes('sonnet') || lower.includes('gpt-4') || lower.includes('v3')) {
        tags.push({ label: 'Research', color: 'var(--green)', bg: 'var(--green-light)' });
    }
    if (tags.length === 0) {
        tags.push({ label: 'General', color: 'var(--text-secondary)', bg: 'rgba(0,0,0,0.05)' });
    }
    return tags;
}
```

## `src/renderer/utils/terminal.ts`

```ts
export function cleanTerminalOutput(raw: string): string {
    return raw
        .replace(/\x1b\[[0-9;]*[mGKHFABCDJsu]/g, '')
        .replace(/\x1b\][^\x07]*\x07/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .split('\n')
        .filter(line => {
            const l = line.trim();
            if (l.length === 0) return false;
            // Remove PowerShell banner lines only
            if (l.startsWith('Windows PowerShell')) return false;
            if (l.includes('Microsoft Corporation') && l.includes('rights reserved')) return false;
            if (l.includes('aka.ms/pscore6')) return false;
            if (l.startsWith('Try the new cross-platform')) return false;
            // Remove bare PS prompt lines like "PS C:\Users\foo>"
            if (/^PS [A-Za-z]:\\[^>]*>\s*$/.test(l)) return false;
            return true;
        })
        .join('\n')
        .trim();
}
```

## `src/renderer/utils/terminalBus.ts`

```ts
/* =======================================================================
   terminalBus — a running log of the AGENT's shell activity, mirrored into
   whatever terminal pane(s) are mounted (cowork workspace, IDE).

   The agent keeps running commands in its own hidden, sentinel-parsed shell
   (reliable exit codes); this bus only records + WRITES the command + output
   into the visible xterm for display. The visible terminal stays a real
   interactive pty the user can type into — the two never cross.

   The full history is buffered, so closing/reopening the terminal (or opening
   it after the agent already ran things) replays the entire command log.
   ======================================================================= */
type Listener = (text: string) => void;

const listeners = new Set<Listener>();
let history = '';
const MAX_HISTORY = 250_000; // cap the buffer (~250 KB of scrollback)

export const terminalBus = {
    /** Record + write raw terminal text (use \r\n line endings) to every pane. */
    write(text: string): void {
        history += text;
        if (history.length > MAX_HISTORY) history = history.slice(history.length - MAX_HISTORY);
        for (const l of listeners) { try { l(text); } catch { /* ignore */ } }
    },
    /** Subscribe a terminal pane; returns an unsubscribe fn. */
    subscribe(l: Listener): () => void {
        listeners.add(l);
        return () => { listeners.delete(l); };
    },
    /** The full buffered log — replayed when a terminal mounts. */
    getHistory(): string { return history; },
    /** Clear the log. */
    clear(): void { history = ''; },
    get active(): boolean { return listeners.size > 0; },
};

export interface AgentPrompt { cwd?: string; user?: string; host?: string; root?: boolean }

/** Render an agent bash result (`$ cmd\n output \n[exit N]`) as a real
    shell-style prompt block, so each agent command looks like it was typed at a
    fresh `┌──(user㉿host)-[cwd]` / `└─#` prompt — exactly like the interactive
    shell. */
export function formatAgentBlock(content: string, meta?: AgentPrompt): string {
    const user = meta?.user || 'root';
    const host = meta?.host || 'localhost';
    const cwd = meta?.cwd || '~';
    const tag = meta?.root === false ? '$' : '#';
    // Drop the leading "$ " so the command sits right after the prompt; the
    // rest (output + [exit N]) follows on its own lines.
    const body = String(content || '').replace(/^\$ /, '').replace(/\r?\n/g, '\r\n');
    const top = `\x1b[38;5;39m┌──(\x1b[38;5;196m${user}\x1b[38;5;208m㉿\x1b[38;5;196m${host}\x1b[38;5;39m)-[\x1b[38;5;250m${cwd}\x1b[38;5;39m]\x1b[0m`;
    const bot = `\x1b[38;5;39m└─${tag}\x1b[0m `;
    return `\r\n${top}\r\n${bot}${body}\r\n`;
}
```

## `src/renderer/utils/uiBus.ts`

```ts
type UiEvent =
    | { t: 'openSettings'; section?: string }
    | { t: 'openSchedule' }
    | { t: 'openProjects' }
    | { t: 'openPalette' }
    | { t: 'openModel' }
    | { t: 'toggleWorkspace' }
    | { t: 'newChat' };

type Handler = (e: UiEvent) => void;
const handlers = new Set<Handler>();

export const uiBus = {
    emit: (e: UiEvent) => { for (const h of handlers) h(e); },
    on: (h: Handler) => { handlers.add(h); return () => { handlers.delete(h); }; },
};
export type { UiEvent };
```

## `src/shared/agent.ts`

```ts
/* =======================================================================
   VIBE Agent - shared type contract (main  renderer)

   These types cross the IPC boundary. Keep them serializable (no functions,
   no class instances). The kernel in main emits `AgentDelta` events; the
   renderer subscribes and renders them.
   ======================================================================= */

/** JSON Schema subset we send to models as tool parameter definitions. */
export interface JSONSchema {
    type?: string;
    description?: string;
    properties?: Record<string, JSONSchema>;
    items?: JSONSchema;
    required?: string[];
    enum?: unknown[];
    default?: unknown;
    [k: string]: unknown;
}

/** Multimodal message parts - one model for text, images, tool traffic, thinking. */
export type MessagePart =
    | { type: 'text'; text: string }
    | { type: 'image'; mimeType: string; dataBase64: string }
    | { type: 'thinking'; text: string }
    | { type: 'tool_use'; id: string; name: string; input: unknown }
    | { type: 'tool_result'; toolUseId: string; content: string; isError?: boolean; name?: string };

export type AgentRole = 'system' | 'user' | 'assistant' | 'tool';

export interface AgentMessage {
    role: AgentRole;
    parts: MessagePart[];
}

/** Surface presets - same kernel, different tool set + posture + layout. */
export type Surface = 'chat' | 'cowork' | 'code' | 'design';

/** Permission tiers derived from a tool's read/mutate flags. */
export type PermissionTier = 'safe' | 'mutating' | 'exec' | 'network';

export type PermissionDecision = 'allow' | 'deny' | 'ask';
export type PermissionScope = 'once' | 'session' | 'always';

/** A tool schema as advertised to the renderer / model (no executor). */
export interface ToolSchema {
    name: string;
    description: string;
    inputSchema: JSONSchema;
    tier: PermissionTier;
    source: 'builtin' | 'mcp' | 'skill';
}

/** Normalized streaming delta - every provider adapter emits this shape. */
export type AgentDelta =
    | { t: 'run_start'; runId: string; surface: Surface; model: string; sessionId?: string }
    | { t: 'text'; runId: string; v: string }
    | { t: 'thinking'; runId: string; v: string }
    | { t: 'tool_call'; runId: string; id: string; name: string; input: unknown; render: string }
    | { t: 'tool_result'; runId: string; id: string; name: string; ok: boolean; content: string; data?: unknown }
    | { t: 'status'; runId: string; v: string }
    | { t: 'permission_req'; runId: string; req: PermissionRequest }
    | { t: 'permission_resolved'; runId: string; reqId: string; decision: PermissionDecision }
    | { t: 'usage'; runId: string; inputTokens?: number; outputTokens?: number }
    | { t: 'ask_user'; runId: string; req: UserQuestionRequest }
    | { t: 'ask_user_resolved'; runId: string; reqId: string; answers: Record<string, string[]> }
    | { t: 'error'; runId: string; message: string }
    | { t: 'done'; runId: string; stopReason: StopReason };

export type StopReason = 'end_turn' | 'max_tokens' | 'tool_use' | 'stopped' | 'budget' | 'error';

/** Multiple-choice question(s) the model can pose mid-run via the ask_user tool. */
export interface UserQuestionOption { label: string; description?: string }
export interface UserQuestion { question: string; options: UserQuestionOption[]; multi?: boolean }
export interface UserQuestionRequest { id: string; runId: string; questions: UserQuestion[] }

export interface PermissionRequest {
    id: string;
    runId: string;
    toolName: string;
    tier: PermissionTier;
    render: string;           // one-line human summary ("Edit src/app.ts")
    target: string | null;    // resolved path or command, for the UI
    input: unknown;
}

export interface PermissionResolution {
    reqId: string;
    decision: Exclude<PermissionDecision, 'ask'>;
    scope: PermissionScope;
}

/** Persisted permission rule. */
export interface PermissionRule {
    tool: string;             // glob: "bash", "mcp__*", "write_file"
    target?: string;          // glob on resolved target; optional
    decision: Exclude<PermissionDecision, 'ask'>;
    scope: PermissionScope;
    createdAt: string;
}

/** Options that start a run. */
export interface RunRequest {
    sessionId: string;
    surface: Surface;
    model: string;
    projectRoot: string | null;
    input: MessagePart[];
    /** explicit tool allowlist override; if absent, surface preset decides */
    tools?: string[];
    think?: { enabled: boolean; level: 'low' | 'medium' | 'high' } | null;
    /** API keys / tokens by provider (kept in main; never persisted to renderer). */
    apiKeys?: Record<string, string>;
    ollamaApiKey?: string;
    /** true when the selected model is an Ollama Cloud model (route to ollama.com with key) */
    ollamaCloud?: boolean;
    /** true when the model is a locally-installed Ollama model */
    ollamaLocal?: boolean;
    /** auto-approve all tool permissions (used for sandboxed sub-agents) */
    autoApprove?: boolean;
    /**
     * Confine this run to projectRoot: DENY (not ask) any out-of-root target
     * even under autoApprove. Set for sandboxed sub-agents, which have no
     * interactive user to answer a force-ask and must not read outside root.
     */
    confineToRoot?: boolean;
    /**
     * Skip session persistence for this run (onPersist). Used by transient
     * runs like debate turns, which manage their own history and must not be
     * written into the chat session store.
     */
    ephemeral?: boolean;
    /** sub-agent recursion depth (0 = top level) */
    depth?: number;
    /**
     * build = execute end-to-end, never end the turn asking permission to proceed;
     * plan  = read-only run that produces a plan and waits for approval.
     */
    mode?: 'build' | 'plan';
    /** worker models the conductor may dispatch sub-tasks to (task tool `model` arg). */
    availableModels?: string[];
    /**
     * Vision fallback. When the user attaches images but `model` can't see them,
     * this vision-capable model describes the images and the description is fed
     * to the main model as text. Absent = no images, or the main model has vision.
     */
    vision?: { model: string; ollamaCloud: boolean; ollamaLocal: boolean };
}

/** Per-model routing + vision refs for a debate turn (computed in the renderer). */
export interface DebateModelRouting { ollamaCloud: boolean; ollamaLocal: boolean }
export interface DebateVisionRef { model: string; ollamaCloud: boolean; ollamaLocal: boolean }

/**
 * Payload for starting a dual-model debate. Each turn runs through the kernel,
 * so this mirrors the important RunRequest fields (message parts incl. images,
 * surface, project root, per-model routing + vision fallback).
 */
export interface DebateStartRequest {
    modelA: string;
    modelB: string;
    input: MessagePart[];
    surface?: Surface;
    projectRoot?: string | null;
    apiKeys?: Record<string, string>;
    ollamaApiKey?: string;
    maxRounds?: number;
    judgeModel?: string;
    routingA?: DebateModelRouting;
    routingB?: DebateModelRouting;
    visionA?: DebateVisionRef;
    visionB?: DebateVisionRef;
    availableModels?: string[];
    /** true = both models answer each round CONCURRENTLY (round 1 = the question,
        later rounds = each rebuts the other's PREVIOUS round), then sync.
        false (default) = sequential: A answers, then B answers seeing A. */
    simultaneous?: boolean;
    /** Optional tool allowlist override (e.g. read-only debate); omit for full surface tools. */
    tools?: string[];
}

export interface McpServerConfig {
    command?: string;         // stdio
    args?: string[];
    env?: Record<string, string>;
    url?: string;             // http/sse
    headers?: Record<string, string>;
    disabled?: boolean;
}

export interface McpConfig {
    mcpServers: Record<string, McpServerConfig>;
}

export interface SkillMeta {
    name: string;
    description: string;
    path: string;
    allowedTools?: string[];
}

export interface ScheduledTask {
    id: string;
    title: string;
    surface: Surface;
    model: string;
    projectRoot: string | null;
    prompt: string;
    /** cron expression OR ISO timestamp for one-shot */
    cron?: string;
    fireAt?: string;
    enabled: boolean;
    lastRunAt?: string;
    createdAt: string;
}

/** Session/thread record. */
export interface SessionRecord {
    id: string;
    surface: Surface;
    title: string;
    projectRoot: string | null;
    model: string;
    createdAt: string;
    updatedAt: string;
}

/** A project bucket derived from persisted sessions. */
export interface ProjectRecord {
    root: string | null;
    name: string;
    sessions: SessionRecord[];
    updatedAt: string;
}

/* ---- Live catalog types (pulled from the web) ---- */
export interface CloudModelInfo {
    name: string;
    size: number;
    modifiedAt: string;
}
export interface McpRegistryEntry {
    name: string;
    title: string;
    description: string;
    version: string;
    transport: 'stdio' | 'remote' | 'unknown';
    install: { command: string; args: string[] } | { url: string } | null;
    installed: boolean;
}
export interface SkillCatalogEntry {
    name: string;
    description: string;
    installed: boolean;
    path: string; // repo path
}
```

## `src/shared/constants.ts`

```ts
export const OLLAMA_ONLY_MODELS = new Set<string>([
  'gpt-oss-120b',
]);
```

## `src/shared/ipcContracts.test.ts`

```ts
import { IPC_CHANNEL_VALUES, IPC_CHANNELS } from './ipcContracts';
import { describe, expect, it } from 'vitest';

describe('ipc contracts', () => {
    it('has unique channel values', () => {
        const unique = new Set(IPC_CHANNEL_VALUES);
        expect(unique.size).toBe(IPC_CHANNEL_VALUES.length);
    });

    it('contains required agent channels', () => {
        expect(IPC_CHANNELS.agent.startForProject).toBe('agent:startForProject');
        expect(IPC_CHANNELS.agent.getBriefing).toBe('agent:getBriefing');
        expect(IPC_CHANNELS.agent.logAction).toBe('agent:logAction');
        expect(IPC_CHANNELS.agent.getStatus).toBe('agent:getStatus');
    });

    it('contains required window event channels', () => {
        expect(IPC_CHANNELS.window.maximizeEvent).toBe('window:maximized');
    });
});
```

## `src/shared/ipcContracts.ts`

```ts
export const IPC_CHANNELS = {
    agent: {
        startForProject: 'agent:startForProject',
        getBriefing: 'agent:getBriefing',
        logAction: 'agent:logAction',
        generateExport: 'agent:generateExport',
        setObsidianKey: 'agent:setObsidianKey',
        triggerBriefing: 'agent:triggerBriefing',
        getStatus: 'agent:getStatus',
    },
    window: {
        maximizeEvent: 'window:maximized',
    },
} as const;

// Shared data home for VIBE projects. First-run prompt + move.
export const DATA_CHANNELS = {
    get: 'data:getHome',
    set: 'data:setHome',
    pick: 'data:pickHome',
    isFirstRun: 'data:isFirstRun',
    default: 'data:defaultHome',
} as const;

// Kernel (native tool-calling agent) IPC surface
export const AGENT_CHANNELS = {
    run: 'kernel:run',
    cancel: 'kernel:cancel',
    approve: 'kernel:approve',
    answer: 'kernel:answer',
    listTools: 'kernel:listTools',
    delta: 'kernel:delta',
    createSession: 'kernel:createSession',
    listSessions: 'kernel:listSessions',
    listProjects: 'kernel:listProjects',
    getMessages: 'kernel:getMessages',
    getSession: 'kernel:getSession',
    renameSession: 'kernel:renameSession',
    deleteSession: 'kernel:deleteSession',
    sessionRewind: 'kernel:sessionRewind',
    mcpGetConfig: 'kernel:mcpGetConfig',
    mcpSaveConfig: 'kernel:mcpSaveConfig',
    mcpReload: 'kernel:mcpReload',
    skillsList: 'kernel:skillsList',
    scheduleList: 'kernel:scheduleList',
    scheduleAdd: 'kernel:scheduleAdd',
    scheduleUpdate: 'kernel:scheduleUpdate',
    scheduleRemove: 'kernel:scheduleRemove',
    scheduledFired: 'kernel:scheduledFired',
    // Live catalogs (pulled from the web)
    cloudModels: 'kernel:cloudModels',
    mcpSearch: 'kernel:mcpSearch',
    mcpAdd: 'kernel:mcpAdd',
    mcpRemove: 'kernel:mcpRemove',
    skillsCatalog: 'kernel:skillsCatalog',
    skillsInstall: 'kernel:skillsInstall',
    skillsRemove: 'kernel:skillsRemove',
} as const;

// Dual-model debate — two models argue in real-time, user can interject.
export const DEBATE_CHANNELS = {
    start: 'debate:start',
    cancel: 'debate:cancel',
    interject: 'debate:interject',
    delta: 'debate:delta',
    listModels: 'debate:listModels',
} as const;

export const IPC_CHANNEL_VALUES = [
    ...Object.values(IPC_CHANNELS.agent),
    ...Object.values(IPC_CHANNELS.window),
    ...Object.values(AGENT_CHANNELS),
    ...Object.values(DEBATE_CHANNELS),
];
```

## `src/shared/types.ts`

```ts
import type {
    AgentDelta, McpConfig, PermissionResolution, RunRequest, ScheduledTask,
    SessionRecord, Surface, ToolSchema, AgentMessage, SkillMeta, StopReason,
    McpServerConfig, CloudModelInfo, McpRegistryEntry, SkillCatalogEntry,
    DebateStartRequest, ProjectRecord,
} from './agent';

export interface FileEntry {
    name: string;
    path: string;
    isDirectory: boolean;
    isFile: boolean;
    extension?: string;
}
export interface TerminalSession {
    id: string;
    title: string;
}
export interface OllamaModel {
    name: string;
    size: number;
    modifiedAt: string;
    details: any;
}
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export interface ModelCapability {
    image?: boolean;
    vision?: boolean;
    tools?: boolean;
    contextLength?: number;
    web?: boolean;
    diff?: boolean;
    canExecute?: boolean;
    requiresApproval?: boolean;
    think?: boolean;
    thinkBudget?: 'toggle' | 'tiered';
}

export interface BackgroundAgentConfig {
    obsidianKey?: string;
    apiKeys?: Record<string, string>;
    collectorModel?: string;
    reviewerModel?: string;
}

export interface KernelAPI {
    run: (req: RunRequest) => Promise<{ stopReason: StopReason }>;
    cancel: (runId: string) => Promise<{ ok: boolean }>;
    approve: (runId: string, res: PermissionResolution) => Promise<{ ok: boolean }>;
    answer: (reqId: string, answers: Record<string, string[]>) => Promise<{ ok: boolean }>;
    listTools: (surface?: Surface) => Promise<ToolSchema[]>;
    onDelta: (cb: (d: AgentDelta) => void) => void;
    onScheduledFired: (cb: (info: { taskId: string; sessionId: string }) => void) => void;
    createSession: (opts: { surface: Surface; title?: string; projectRoot: string | null; model: string }) => Promise<SessionRecord>;
    listSessions: (surface?: Surface) => Promise<SessionRecord[]>;
    listProjects: (surface?: Surface) => Promise<ProjectRecord[]>;
    getMessages: (id: string) => Promise<AgentMessage[]>;
    getSession: (id: string) => Promise<SessionRecord | null>;
    renameSession: (id: string, title: string) => Promise<void>;
    deleteSession: (id: string) => Promise<void>;
    sessionRewind: (id: string) => Promise<{ text: string }>;
    mcpGetConfig: () => Promise<McpConfig>;
    mcpSaveConfig: (config: McpConfig) => Promise<Array<{ server: string; tools: number; error?: string }>>;
    mcpReload: () => Promise<Array<{ server: string; tools: number; error?: string }>>;
    skillsList: () => Promise<SkillMeta[]>;
    scheduleList: () => Promise<ScheduledTask[]>;
    scheduleAdd: (t: Partial<ScheduledTask>) => Promise<ScheduledTask>;
    scheduleUpdate: (id: string, patch: Partial<ScheduledTask>) => Promise<boolean>;
    scheduleRemove: (id: string) => Promise<boolean>;
    cloudModels: (ollamaKey?: string) => Promise<CloudModelInfo[]>;
    mcpSearch: (query?: string) => Promise<McpRegistryEntry[]>;
    mcpAdd: (key: string, config: McpServerConfig) => Promise<Array<{ server: string; tools: number; error?: string }>>;
    mcpRemove: (key: string) => Promise<Array<{ server: string; tools: number; error?: string }>>;
    skillsCatalog: () => Promise<SkillCatalogEntry[]>;
    skillsInstall: (name: string) => Promise<{ ok: boolean; files?: number; error?: string }>;
    skillsRemove: (name: string) => Promise<{ ok: boolean; error?: string }>;
}

export interface VibeAPI {
    /** Host OS of the Electron main process, so the renderer can pick shell syntax
     *  (bash vs PowerShell) instead of assuming Windows. */
    platform: NodeJS.Platform;

    createTerminal: (cwd?: string) => Promise<string>;
    sendTerminalInput: (id: string, data: string) => Promise<void>;
    getTerminalOutput: (id: string) => Promise<string>;
    clearTerminalOutput: (id: string) => Promise<void>;
    onTerminalData: (callback: (id: string, data: string) => void) => void;
    killTerminal: (id: string) => Promise<void>;
    resizeTerminal: (id: string, cols: number, rows: number) => Promise<void>;

    openFolder: () => Promise<string | null>;
    listDirs: (dir?: string) => Promise<{ path: string; parent: string | null; dirs: { name: string; path: string }[] }>;
    makeDir: (parent: string, name: string) => Promise<string>;
    setProjectFolder: (dir: string) => Promise<string>;
    dataHome: {
        get: () => Promise<{ path: string; chosen: boolean; default: string }>;
        isFirstRun: () => Promise<boolean>;
        default: () => Promise<string>;
        pick: () => Promise<string | null>;
        set: (path: string, move?: boolean) => Promise<{ ok: boolean; path?: string; error?: string }>;
    };
    readDir: (dirPath: string) => Promise<FileEntry[]>;
    readFile: (filePath: string) => Promise<string>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    watchFolder: (dirPath: string) => Promise<void>;
    onFolderChanged: (callback: () => void) => void;
    readMemory: (projectPath: string) => Promise<string | null>;
    writeMemory: (projectPath: string, memory: any) => Promise<boolean>;

    detectOllama: () => Promise<{ detected: boolean, version?: string }>;
    statusOllama: () => Promise<boolean>;
    listModels: () => Promise<string[]>;
    chat: (model: string, messages: ChatMessage[], apiKeys?: Record<string, string>, thinkOptions?: any) => Promise<void>;
    onChatStream: (callback: (chunk: { content: string, done: boolean }) => void) => void;
    stopGeneration: () => Promise<void>;
    getModelCapabilities: (modelName: string, opts?: { cloud?: boolean; ollamaKey?: string }) => Promise<{
        modelName: string;
        think: boolean;
        thinkBudget?: 'toggle' | 'tiered';
        vision: boolean;
        tools: boolean;
        contextLength: number;
        family: string;
        rawCapabilities: string[];
    } | null>;
    getLoadedModels: () => Promise<string[]>;
    listOpenRouterModels: (apiKeys?: Record<string, string>) => Promise<Array<{
        id: string;
        provider: 'openrouter';
        label: string;
        contextWindow: number | null;
        inputPer1M: number | null;
        outputPer1M: number | null;
        supportsTools: boolean;
        supportsVision: boolean;
    }>>;
    searchHuggingFaceModels: (query: string, apiKeys?: Record<string, string>) => Promise<Array<{
        id: string;
        likes: number;
        downloads: number;
        pipeline_tag: string;
        tags: string[];
    }>>;
    listOmniModels: (apiKeys?: Record<string, string>) => Promise<Array<{ id: string; label: string }>>;
    listOfoxModels: (apiKeys?: Record<string, string>) => Promise<Array<{ id: string; label: string }>>;
    log: (msg: string) => Promise<void>;

    startBackgroundAgents: (projectPath: string, config?: BackgroundAgentConfig) => Promise<{ success: boolean }>;
    getBriefing: () => Promise<string>;
    logAgentAction: (description: string) => Promise<void>;
    generateNotebookExport: (outputPath: string) => Promise<boolean>;
    setObsidianKey: (key: string) => Promise<void>;
    triggerBriefing: () => Promise<{ success: boolean }>;
    getAgentStatus: () => Promise<{
        collector: {
            isRunning: boolean;
            eventCount: number;
            lastEventTime: number | null;
            isDistilling: boolean;
            lastDistillTime: number | null;
        };
        reviewer: {
            isRunning: boolean;
            isSynthesizing: boolean;
            lastBriefingTime: number;
            briefingCount: number;
        };
    }>;

    obsidianPing: (apiKey: string) => Promise<boolean>;
    obsidianUpsertNote: (apiKey: string, vaultPath: string, content: string) => Promise<boolean>;
    obsidianAppendNote: (apiKey: string, vaultPath: string, content: string) => Promise<boolean>;
    obsidianUpdateProject: (apiKey: string, projectName: string, projectStructure: string, projectPath: string) => Promise<boolean>;
    obsidianLogRun: (apiKey: string, projectName: string, mission: string, model: string, steps: string[], result: string, criteraMet: string) => Promise<boolean>;
    obsidianLogDecision: (apiKey: string, projectName: string, summary: string, filesChanged: string) => Promise<boolean>;

    kernel: KernelAPI;

    /** Dual-model debate: two models argue in real-time, user can interject. */
    debate: {
        start: (req: DebateStartRequest) => Promise<{ ok: boolean; runId: string }>;
        cancel: (runId: string) => Promise<{ ok: boolean }>;
        interject: (runId: string, message: string) => Promise<{ ok: boolean; error?: string }>;
        onDelta: (cb: (d: { runId: string; type: string; round?: number; content?: string; message?: string }) => void) => void;
        listModels: (apiKeys?: Record<string, string>) => Promise<{ ok: boolean; models: string[] }>;
    };

    minimizeWindow: () => Promise<void>;
    maximizeWindow: () => Promise<void>;
    closeWindow: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onWindowMaximized: (callback: (maximized: boolean) => void) => void;
}

declare global {
    interface Window {
        vibe: VibeAPI;
    }
}
```

