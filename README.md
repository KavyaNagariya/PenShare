<div align="center">

<img src="./public/penshare-mark.png" width="96" alt="PenShare logo" />

# PenShare

*Think on an infinite visual canvas powered by free, local AI CLI assistants*

[![Node.js Version](https://img.shields.io/badge/Node.js->=22.19-3c873a?style=flat-square)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square)]()
[![Model Context Protocol](https://img.shields.io/badge/MCP-Ready-6f42c1?style=flat-square)](https://modelcontextprotocol.io/)

[Overview](#overview) • [Features](#features) • [Prerequisites](#prerequisites) • [Quick Start](#quick-start) • [Usage](#usage) • [Architecture](#architecture) • [Canvas Controls](#canvas-controls) • [Testing](#testing)

</div>

---

## Overview

**PenShare** is an open-source, local-first visual canvas and whiteboard workspace. It bridges free, local AI command-line assistants directly to an infinite, interactive drawing surface. 

Designed for brainstorming, architecture design, and technical problem-solving, PenShare requires no cloud subscriptions, no external telemetry, and no paid API keys. It runs directly on top of installed local CLI agents such as **Google Antigravity CLI (`agy`)** and **OpenCode CLI (`opencode`)**.

> [!TIP]
> PenShare runs completely offline on your local machine. Your notes, sketches, and AI interaction traces never leave your computer.

---

## Features

- **Local CLI Brain** - Directly interfaces with local command-line assistants (`agy`, `opencode`) via standard streams.
- **Infinite Zoomable Canvas** - High-performance sparse-tile engine allows smooth zooming, panning, and unbounded freehand sketching.
- **Architecture & Sequence Diagrams** - Built-in layout engines for cloud architectures, UML sequence diagrams, and flowcharts.
- **LaTeX Math Rendering** - Typeset mathematical formulas and equations directly alongside hand-drawn annotations.
- **Sandboxed Interactive Widgets** - Local assistants can generate responsive, live HTML/JS widgets rendered in an isolated sandbox.
- **Model Context Protocol (MCP)** - Full support for the Model Context Protocol, enabling bi-directional tool execution and discovery.
- **Desktop & Web Environments** - Run as a lightweight local web service in any browser or package as a standalone desktop app via Electron.

---

## Prerequisites

- **Node.js**: `v22.19.0` or higher
- **npm**: `v10.0.0` or higher
- **Local AI Assistant** *(optional but recommended)*:
  - [Google Antigravity CLI (`agy`)](https://github.com)
  - [OpenCode CLI (`opencode`)](https://github.com)

---

## Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/KavyaNagariya/PenShare.git
cd PenShare
npm install
```

### 2. Launch PenShare

Start the application with default settings:

```bash
npm start
```

Or specify your preferred CLI assistant provider:

```bash
# Launch with Google Antigravity CLI
node cli.js --agy

# Launch with OpenCode CLI
node cli.js --opencode

# Specify a custom port
node cli.js --port 3888
```

Open your browser at `http://localhost:3888`.

> [!NOTE]
> Ensure your chosen CLI (`agy` or `opencode`) is in your system `PATH` and authenticated.

---

## Usage

### Environment Diagnostics

Before beginning a session, you can run the built-in diagnostic tool to verify CLI availability and system configuration:

```bash
# Check Google Antigravity CLI integration
node cli.js doctor --agy

# Check OpenCode CLI integration
node cli.js doctor --opencode
```

### CLI Options

| Flag | Description | Default |
| :--- | :--- | :--- |
| `--agy` | Connect to Google Antigravity CLI | `true` |
| `--opencode` | Connect to OpenCode CLI | `false` |
| `--port <number>` | Custom HTTP/WebSocket port | `3888` |
| `doctor` | Run configuration and connectivity diagnostics | — |

---

## Architecture

PenShare is built around an event-driven, local-first topology:

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

- **Sparse Tile Rendering Engine** - Allocates canvas tiles on demand based on viewport coordinates, avoiding massive bitmap allocation.
- **Bi-Directional Agent Loop** - Transmits canvas selections and prompts to local CLI subprocesses and streams structured visual elements back.
- **MCP Client/Server Bridge** - Enables external agents and IDE extensions to inspect canvas state and invoke canvas manipulation tools.

---

## Canvas Controls

| Shortcut | Action |
| :--- | :--- |
| `Space` + Drag / Middle Mouse | Pan canvas freely |
| `Ctrl` / `Cmd` + Mouse Wheel | Zoom in and out |
| `P` | Pen / Sketching tool |
| `E` | Eraser tool |
| `S` | Selection / Lasso tool |
| `T` | Text / Markdown note tool |
| `Ctrl` / `Cmd` + `Z` | Undo action |
| `Ctrl` / `Cmd` + `Shift` + `Z` | Redo action |
| `Ctrl` / `Cmd` + `0` | Reset canvas view and zoom to 100% |

---

## Testing

Run the test suite and static code validation:

```bash
# Run unit and integration tests
npm test

# Run syntax and static analysis checks
npm run check
```
