# kaomoji-mcp

> CLI-safe kaomoji for AI Agents at key interaction points

[![npm version](https://img.shields.io/npm/v/kaomoji-mcp)](https://www.npmjs.com/package/kaomoji-mcp)
[![License: GPL v3](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that gives AI agents expressive kaomoji (ASCII emoticons) at key moments — thinking, celebrating, and apologizing. All kaomoji are CLI-safe: no full-width characters, no decorative Unicode, no rendering surprises in any terminal.

```
Searching for auth middleware
(..)

All tests passed! (^o^)/
```

---

## Table of Contents

- [Why kaomoji-mcp?](#why-kaomoji-mcp)
- [Tools, Prompts & Resources](#tools-prompts--resources)
- [Installation](#installation)
- [Quickstart](#quickstart)
- [Configuration by Client](#configuration-by-client)
  - [Claude Desktop](#claude-desktop)
  - [Claude Code (CLI)](#claude-code-cli)
  - [Cursor](#cursor)
  - [VS Code + GitHub Copilot](#vs-code--github-copilot)
  - [Windsurf](#windsurf)
  - [Zed](#zed)
  - [Continue.dev](#continuedev)
  - [Cline / Roo Cline](#cline--roo-cline)
  - [Smithery](#smithery)
- [Development](#development)
- [Running Tests](#running-tests)

---

## Why kaomoji-mcp?

Modern AI agents work through multiple sub-tasks before delivering an answer. Without visual indicators, the user sees nothing until the final response. **kaomoji-mcp** solves this by asking the agent to:

- Show a **thinking kaomoji** before each sub-task so the user can follow progress in real time
- Show a **celebration kaomoji** when a task completes successfully
- Show an **apology kaomoji** when results are not found or an error occurs

Because all characters are ASCII / half-width compatible, they render correctly in every terminal, IDE panel, and chat interface.

---

## Tools, Prompts & Resources

### Tools

| Tool | When to call | Key parameter |
|------|-------------|---------------|
| `thinking_kaomoji` | **Before** each sub-task or reasoning phase | `phase` (string, max 80 chars); optional `mcp_server` |
| `celebrate_kaomoji` | **After** a task completes successfully | `intensity`: `"subtle"` / `"moderate"` / `"intense"` |
| `apologize_kaomoji` | On no-results, error, or user dissatisfaction | `reason`: `"not_found"` / `"error"` / `"dissatisfied"` |

**`thinking_kaomoji`** — Progress indicator. Call once per sub-task. Accepts an optional `mcp_server` parameter to show which external MCP server is being delegated to:

```
**Reading project files** [filesystem]
(._.)
```

**`celebrate_kaomoji`** — Completion signal. Choose intensity to match the moment:
- `subtle` — gentle fix, formal context → `(^-^)`
- `moderate` — regular task done → `(^o^)/`
- `intense` — major breakthrough → `\(^∀^)/`

**`apologize_kaomoji`** — Failure signal. The `reason` field classifies the situation:
- `not_found` — search returned no results
- `error` — unexpected error occurred
- `dissatisfied` — user expressed unhappiness

### Prompt

| Prompt | Description |
|--------|-------------|
| `react_with_kaomoji` | Full behavior guide — load this prompt to give the agent detailed rules about when and how to use all three tools |

### Resource

| URI | MIME | Description |
|-----|------|-------------|
| `kaomoji://catalog` | `application/json` | Full kaomoji database with all scenes, intensities, states, reasons, fallback strings, and bilingual tags |

---

## Installation

### Requirements

- **Node.js ≥ 20**

### Option A — npx (no install, always latest)

No installation needed. Just reference the package in your MCP client config (see below) and the agent runtime will fetch it automatically.

```
npx kaomoji-mcp
```

### Option B — Global install

```bash
npm install -g kaomoji-mcp
kaomoji-mcp   # starts the stdio server
```

### Option C — Local project clone

```bash
git clone https://github.com/frankunderwood-w/kaomoji_mcp_server.git
cd kaomoji-mcp
npm install
npm run build
node build/index.js   # starts the stdio server
```

### Option D — Local project by npm
```bash
mkdir my-project && cd my-project
npm init -y
npm install kaomoji-mcp
```

---

## Quickstart

Once configured, your MCP-compatible agent will automatically receive the server instructions on connection and will know to call the tools at the right moments. You can also explicitly load the behavior guide by requesting the `react_with_kaomoji` prompt in your system prompt.

---

## Configuration by Client

All configurations below launch the server over **stdio** transport. Replace `node /absolute/path/to/build/index.js` with `npx kaomoji-mcp` if you prefer to use the npm package directly.

---

### Claude Desktop

**Config file location:**
- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "kaomoji": {
      "command": "npx",
      "args": ["-y", "kaomoji-mcp"]
    }
  }
}
```

Or, if you cloned the repo locally:

```json
{
  "mcpServers": {
    "kaomoji": {
      "command": "node",
      "args": ["/absolute/path/to/kaomoji-mcp/build/index.js"]
    }
  }
}
```

Restart Claude Desktop after saving. The server should appear under **Settings → Developer → MCP Servers**.

---

### Claude Code (CLI)

Add the server to your project or user configuration:

```bash
# Project-scoped (adds to .claude/mcp.json)
claude mcp add kaomoji -- npx -y kaomoji-mcp

# Or global
claude mcp add --global kaomoji -- npx -y kaomoji-mcp
```

Or edit `.claude/mcp.json` manually:

```json
{
  "mcpServers": {
    "kaomoji": {
      "command": "npx",
      "args": ["-y", "kaomoji-mcp"]
    }
  }
}
```

---

### Cursor

**Config file location (global):** `~/.cursor/mcp.json`  
**Config file location (project):** `<project-root>/.cursor/mcp.json`

```json
{
  "mcpServers": {
    "kaomoji": {
      "command": "npx",
      "args": ["-y", "kaomoji-mcp"]
    }
  }
}
```

Or via the Cursor UI: **Settings → Cursor Settings → MCP** → click **+ Add new MCP server** and enter the command above.

---

### VS Code + GitHub Copilot

VS Code 1.99+ supports MCP servers natively when the **GitHub Copilot** extension is active.

**Option 1 — Workspace config** (`.vscode/mcp.json`):

```json
{
  "servers": {
    "kaomoji": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "kaomoji-mcp"]
    }
  }
}
```

**Option 2 — User settings** (`settings.json`):

```json
{
  "mcp": {
    "servers": {
      "kaomoji": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "kaomoji-mcp"]
      }
    }
  }
}
```

Open the Copilot Chat panel in **Agent mode** and the server will be available automatically.

---

### Windsurf

**Config file location:** `~/.codeium/windsurf/mcp_config.json`

```json
{
  "mcpServers": {
    "kaomoji": {
      "command": "npx",
      "args": ["-y", "kaomoji-mcp"]
    }
  }
}
```

Or via the Windsurf UI: **Windsurf Settings → Cascade → MCP Servers** → click the **+** button.

---

### Zed

**Config file location:** `~/.config/zed/settings.json`

```json
{
  "context_servers": {
    "kaomoji": {
      "command": {
        "path": "npx",
        "args": ["-y", "kaomoji-mcp"]
      }
    }
  }
}
```

---

### Continue.dev

**Config file location:** `~/.continue/config.json` (global) or `.continue/config.json` (project)

```json
{
  "mcpServers": [
    {
      "name": "kaomoji",
      "command": "npx",
      "args": ["-y", "kaomoji-mcp"]
    }
  ]
}
```

---

### Cline / Roo Cline

In VS Code, open the Cline extension sidebar → click the **MCP Servers** icon → **Edit MCP Settings**.

```json
{
  "mcpServers": {
    "kaomoji": {
      "command": "npx",
      "args": ["-y", "kaomoji-mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

---

### Smithery

This server is deployable on [Smithery](https://smithery.ai/). The `smithery.ts` entry point exposes a `configSchema` (empty — no configuration required) and a `createServer` factory.

To deploy or install via Smithery CLI:

```bash
npx @smithery/cli install kaomoji-mcp
```

---

## Development

```bash
# Clone and install
git clone https://github.com/frankunderwood-w/kaomoji_mcp_server.git
cd kaomoji-mcp
npm install

# Compile TypeScript → build/
npm run build

# Watch mode (recompiles on save)
npm run dev

# Type-check without emitting
npm run type:check
```

### Project Structure

```
src/
├── index.ts              # stdio entry point (CLI / npx)
├── smithery.ts           # Smithery deployment entry point
├── create-server.ts      # Server factory + SERVER_INSTRUCTIONS
├── tools/
│   ├── celebrate-kaomoji.ts
│   ├── thinking-kaomoji.ts
│   └── apologize-kaomoji.ts
├── prompts/
│   └── react-with.ts     # react_with_kaomoji prompt
├── resources/
│   └── catalog.ts        # kaomoji://catalog resource
└── data/
    ├── loader.ts          # cached JSON loader
    └── kaomoji.json       # CLI-safe kaomoji database (75+ entries)
```

---

## Running Tests

```bash
# Run all tests once
npm test

# Watch mode
npm run test:watch
```

The test suite covers:

| Suite | File | What it tests |
|-------|------|---------------|
| Data loader | `tests/data/loader.test.ts` | JSON loading, schema shape, caching |
| CLI-safe validation | `tests/data/cli-safe.test.ts` | No full-width / decorative Unicode in database |
| `celebrate_kaomoji` | `tests/tools/celebrate.test.ts` | Randomness, intensity, fallback, `_instruction` field |
| `thinking_kaomoji` | `tests/tools/thinking.test.ts` | Phase names, `mcp_server` param, length limits |
| `apologize_kaomoji` | `tests/tools/apologize.test.ts` | Reason codes, fallback, `_instruction` field |
| Integration | `tests/integration/server.test.ts` | Full server: tool list, prompt, resource, end-to-end calls |

All tests use **in-memory MCP transport** — no network or stdio required.

---

## License

This project is licensed under the [GNU General Public License v3.0](LICENSE).
