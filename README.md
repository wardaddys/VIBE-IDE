# VIBE IDE

**Agent-first integrated development environment.**

VIBE is a standalone Electron desktop application that combines a world-class code editor (Monaco), an integrated terminal, and an autonomous AI agent layer. It is built from the ground up to empower developers with AI-driven automation while maintaining full control over the development process.

![VIBE IDE Logo](https://raw.githubusercontent.com/wardaddys/VIBE-IDE/main/index.html) *[Replace with real logo URL when available]*

## 🚀 Key Features

- **Model Agnostic:** Seamlessly switch between local models via Ollama (free, offline) and cloud models (Claude, GPT, Gemini).
- **Autonomous Agent Loop:** A sophisticated `PLAN → EXECUTE → OBSERVE → DECIDE` loop that handles complex tasks like code refactoring, terminal operations, and error correction.
- **Wave-based Swarm Execution:** Orchestrate multiple specialist agents (Architect, Coder, etc.) in parallel waves based on their dependencies.
- **Reasoning Token Parsing:** Built-in support for models like DeepSeek-R1, displaying structured thought processes in collapsible UI blocks.
- **Tiered Thinking Budget:** Custom controls for thinking-enabled models, allowing you to balance reasoning depth with response speed.
- **Project Memory:** Persistent session context stored in `.vibe/memory.json`, allowing agents to pick up exactly where they left off.
- **Premium UI:** A stunning glass-morphism interface with mesh gradient backgrounds, designed for maximum focus and visual appeal.

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Core** | Electron, Node.js |
| **Frontend** | React 18, TypeScript, Vite |
| **Editor** | Monaco Editor |
| **Terminal** | xterm.js, node-pty |
| **State** | Zustand |
| **AI** | Ollama API, Cloud Proxy |

## 📐 Design Philosophy

VIBE is built with a "Premium Product" mindset:
- **Glassmorphism:** Frosted glass panels with backdrop blur and soft shadows.
- **Dynamic Backgrounds:** Multi-layer radial gradients (blue + cyan + warm orange).
- **Modern Typography:** DM Sans for UI and JetBrains Mono for code.
- **Micro-animations:** Subtle transitions and interactive elements for a premium feel.

## 📦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Ollama](https://ollama.com/) (for local models)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/wardaddys/VIBE-IDE.git
   cd VIBE-IDE
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## 🏗 Project Roadmap

- [x] **Phase 0:** Foundation (Electron + Monaco + Terminal)
- [x] **Phase 1:** Agent Core (MCP tools, loop, Mission Control)
- [ ] **Phase 2:** Model Router (Token proxy, credit system)
- [ ] **Phase 3:** Workstation (VM viewer, browser preview, serial monitor)

## 📄 License & Credits

Author: **Muhammad Saeed**  
Digital creator and software engineer based in Pakistan.

*VIBE IDE — Empowering the next generation of autonomous development.*
