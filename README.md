# PenShare 🖋️

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.19-brightgreen.svg)](https://nodejs.org/)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)]()
[![Model Context Protocol](https://img.shields.io/badge/MCP-Ready-6f42c1.svg)](https://modelcontextprotocol.io/)

> **Think on an infinite visual canvas powered completely by free, local AI CLI assistants (`agy` & `opencode`).**

**PenShare** is an open-source, privacy-first whiteboard and visual thinking workspace designed to run entirely locally. With zero cloud lock-in, zero mandatory subscription fees, and no paid API keys required, PenShare bridges free local AI command-line assistants directly to an infinite interactive canvas.

---

## 🚀 Key Features

- 🧠 **100% Free & Local AI Brain**: Directly interfaces with local CLI agents such as **Google Antigravity CLI (`agy`)** and **OpenCode CLI (`opencode`)** to generate diagrams, mind maps, notes, and code.
- 🎨 **Infinite Zoomable Canvas**: High-performance sparse-tile canvas rendering engine. Sketch ideas, annotate, draw vector geometry, and compose notes effortlessly.
- 📐 **Professional Diagrams & Math**: Native support for LaTeX math formulas, sequence diagrams, cloud architecture diagrams, and mind maps.
- ⚡ **Interactive Widgets**: AI assistants can construct live, responsive HTML/JS widgets directly on your canvas.
- 🔌 **Model Context Protocol (MCP)**: Full support for the Model Context Protocol, enabling seamless bi-directional integration with MCP clients and servers.
- 🔒 **Privacy & Offline First**: Zero telemetry, zero external cloud synchronization. All canvas sessions, drawing histories, and prompt interactions remain strictly on your local machine.
- 🖥️ **Cross-Platform Desktop & Web**: Run as a lightweight web server in any modern browser, or package as a standalone desktop application via Electron.

---

## 📋 System Requirements

- **Node.js**: `v22.19.0` or later (tested on Node 22 and Node 26)
- **Package Manager**: `npm` (included with Node.js)
- **AI CLI Assistant (optional but recommended)**:
  - [Google Antigravity CLI (`agy`)](https://github.com)
  - [OpenCode CLI (`opencode`)](https://github.com)

---

## 🛠️ Quick Start

### 1. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/KavyaNagariya/PenShare.git
cd PenShare
npm install
```

### 2. Launching PenShare

Launch the local server using `npm`:

```bash
# Start with default settings (Google Antigravity CLI brain):
npm start
```

Or execute directly using the CLI entrypoint:

```bash
# Launch with Antigravity CLI
node cli.js --agy

# Launch with OpenCode CLI
node cli.js --opencode

# Specify a custom port
node cli.js --port 3888
```

Once running, navigate your browser to:
```
http://localhost:3888
```

### 3. Diagnostics & Health Check

Verify your environment configuration and connected CLI assistants using the built-in doctor command:

```bash
# Check Antigravity CLI connectivity
node cli.js doctor --agy

# Check OpenCode CLI connectivity
node cli.js doctor --opencode
```

---

## 🧭 Architecture & Design

PenShare is built around an event-driven, local-first architecture:

```
┌────────────────────────────────────────────────────────┐
│                   PenShare Frontend                    │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │  Sparse Tile     │  │  Studio Shell & UI         │  │
│  │  Canvas Engine   │  │  Lasso / Selection / Draw  │  │
│  └────────┬─────────┘  └─────────────┬──────────────┘  │
└───────────┼──────────────────────────┼─────────────────┘
            │                          │
            ▼                          ▼
┌────────────────────────────────────────────────────────┐
│                   Local HTTP & WS Server               │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │  Session Manager │  │  MCP Transport Adapter     │  │
│  └────────┬─────────┘  └─────────────┬──────────────┘  │
└───────────┼──────────────────────────┼─────────────────┘
            │                          │
            ▼                          ▼
┌────────────────────────────────────────────────────────┐
│                   Local AI Assistants                  │
│       [ agy (Antigravity) ]   [ opencode ]             │
└────────────────────────────────────────────────────────┘
```

- **Sparse Tile Engine**: Rather than allocating huge monolithic bitmaps, PenShare uses a sparse coordinate tile representation, keeping memory footprints negligible even on massive canvas workspaces.
- **Bi-Directional Agent Activity**: Prompts written on the canvas or via the assistant panel are parsed and dispatched to local CLI workers via standard streams, returning structured visual primitives and markdown back to the canvas.
- **MCP Client/Server**: Connect your preferred external agent workflows using standard JSON-RPC over stdio or SSE.

---

## 📂 Project Structure

```
penshare/
├── cli.js                  # CLI runner and launcher entry point
├── server.js               # Local web and WebSocket server
├── desktop/                # Electron desktop wrapper and window management
├── public/                 # Client assets, styles, and web canvas scripts
│   ├── index.html          # Main application canvas interface
│   ├── app.js              # Client state orchestration
│   ├── draw.js             # Canvas drawing and stroke renderers
│   ├── selection.js        # Lasso and element selection tools
│   ├── studio-shell.js     # Workspace layout and studio navigation
│   └── cloud-mcp.js        # Model Context Protocol client handler
├── src/                    # Backend server modules and agent adapters
│   ├── architecture/       # Diagram layout and geometry engines
│   └── server/             # Server utilities, sockets, and agent subprocesses
├── scripts/                # Build and asset bundle scripts
├── test/                   # Comprehensive unit and integration test suites
└── forge.config.js         # Electron Forge desktop build configuration
```

---

## ⌨️ Canvas Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Space` + Drag / Middle Click | Pan canvas freely |
| `Ctrl` / `Cmd` + Mouse Wheel | Zoom in / Zoom out |
| `P` | Pen tool |
| `E` | Eraser tool |
| `S` | Selection / Lasso tool |
| `T` | Text / Markdown note tool |
| `Ctrl` / `Cmd` + `Z` | Undo last canvas action |
| `Ctrl` / `Cmd` + `Shift` + `Z` | Redo action |
| `Ctrl` / `Cmd` + `0` | Reset canvas zoom and center view |

---

## 🧪 Testing & Code Quality

Run tests and static analysis:

```bash
# Run unit and integration tests
npm test

# Run syntax and type checks
npm run check
```

---

## 📄 License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE).
Third-party component licenses and attributions are documented in [NOTICE](NOTICE).
