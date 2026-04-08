# OpenRouter MCP Server

[![npm version](https://img.shields.io/npm/v/openrouter-mcp-server.svg)](https://www.npmjs.com/package/openrouter-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blueviolet.svg)](https://modelcontextprotocol.io)

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides **live model pricing data** directly from the [OpenRouter](https://openrouter.ai) API. Query, compare, and discover the cheapest AI models — right from your AI coding assistant.

Works with any MCP-compatible client: **Antigravity**, **Claude Desktop**, **Cursor**, and more.

---

## Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Installation](#installation)
  - [Antigravity](#antigravity)
  - [Claude Desktop](#claude-desktop)
  - [Cursor](#cursor)
  - [Other MCP Clients](#other-mcp-clients)
- [Configuration](#configuration)
- [Available Tools](#available-tools)
- [Examples](#examples)
- [Development](#development)
- [Contributing](#contributing)
- [License](#license)

---

## Features

- 🔴 **Live Pricing** — Pulls real-time data from the OpenRouter `/api/v1/models` endpoint
- ⚡ **Intelligent Caching** — 5-minute in-memory cache for fast responses without hammering the API
- 🔑 **Optional API Key** — Works without an API key for public data; pass one via environment variable for authenticated access
- 🔍 **Fuzzy Search** — Mistype a model name? Get smart suggestions instead of a cryptic error
- 📊 **Table-Formatted Comparisons** — Side-by-side model comparisons in clean markdown tables
- 🆓 **Free Model Detection** — Free-tier models are clearly flagged

---

## Quick Start

No installation required — run directly with `npx`:

```bash
npx -y openrouter-mcp-server
```

---

## Installation

### Antigravity

Add the following to your Antigravity MCP settings:

```json
{
  "mcpServers": {
    "openrouter": {
      "command": "npx",
      "args": ["-y", "openrouter-mcp-server"]
    }
  }
}
```

To pass an OpenRouter API key (optional):

```json
{
  "mcpServers": {
    "openrouter": {
      "command": "npx",
      "args": ["-y", "openrouter-mcp-server"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-key-here"
      }
    }
  }
}
```

### Claude Desktop

Add to your `claude_desktop_config.json` (found in `~/Library/Application Support/Claude/` on macOS or `%APPDATA%\Claude\` on Windows):

```json
{
  "mcpServers": {
    "openrouter": {
      "command": "npx",
      "args": ["-y", "openrouter-mcp-server"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-key-here"
      }
    }
  }
}
```

### Cursor

Add to your Cursor MCP configuration:

```json
{
  "mcpServers": {
    "openrouter": {
      "command": "npx",
      "args": ["-y", "openrouter-mcp-server"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-key-here"
      }
    }
  }
}
```

### Other MCP Clients

This server communicates over **stdio** and is compatible with any MCP client. Use `npx -y openrouter-mcp-server` as the command, or install globally:

```bash
npm install -g openrouter-mcp-server
openrouter-mcp-server
```

---

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | No | Your OpenRouter API key. The models endpoint is public, so this is optional. Providing a key may give you higher rate limits. |

---

## Available Tools

| Tool | Description |
|---|---|
| `get_model_pricing` | Get detailed pricing for a specific model by its full ID |
| `list_all_models_pricing` | Browse all available models with pricing (supports limit) |
| `compare_model_costs` | Compare multiple models side-by-side in a markdown table |
| `get_cheapest_models` | Find the cheapest models sorted by prompt or completion cost |
| `find_models_by_context_length` | Discover models with a minimum context window size |

---

## Examples

### Get pricing for a specific model

> *"How much does GPT-4o cost on OpenRouter?"*

The AI assistant calls `get_model_pricing` with `model_id: "openai/gpt-4o"` and returns:

```
Model: GPT-4o (openai/gpt-4o)
Context Length: 128,000 tokens
Prompt Cost: $0.00000250 / token
Completion Cost: $0.00001000 / token
Image Cost: $0.00361300 / token
Request Cost: FREE
```

### Compare models

> *"Compare Claude Sonnet 4 vs GPT-4o vs Gemini 2.5 Pro"*

The AI assistant calls `compare_model_costs` and returns:

```
| Model | Prompt Cost | Completion Cost | Context Length |
|-------|------------|----------------|----------------|
| openai/gpt-4o | $0.00000250 | $0.00001000 | 128,000 |
| anthropic/claude-sonnet-4 | $0.00000300 | $0.00001500 | 200,000 |
| google/gemini-2.5-pro-preview | $0.00000125 | $0.00001000 | 1,048,576 |
```

### Find cheapest models

> *"What are the 5 cheapest models?"*

The AI assistant calls `get_cheapest_models` and returns a ranked list, with free-tier models flagged with 🆓.

### Find models by context length

> *"Which models support at least 200k tokens?"*

The AI assistant calls `find_models_by_context_length` with `min_context_length: 200000`.

---

## Development

```bash
# Clone the repository
git clone https://github.com/Semicolon-D/openrouter-mcp-server.git
cd openrouter-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode (auto-rebuild on changes)
npm run dev
```

### Project Structure

```
openrouter-mcp/
├── src/
│   ├── index.ts          # MCP server + exported tool handlers
│   └── index.test.ts     # Unit tests (23 tests, 7 suites)
├── build/                # Compiled output (auto-generated)
├── package.json
├── tsconfig.json
├── README.md
├── CONTRIBUTING.md
├── LICENSE
└── .gitignore
```

---

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

This project is licensed under the [MIT License](LICENSE) — use it however you want, no strings attached.
