# OpenRouter Pricing MCP Server for Antigravity & AI Assistants

[![npm version](https://img.shields.io/npm/v/openrouter-pricing-mcp.svg)](https://www.npmjs.com/package/openrouter-pricing-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![MCP](https://img.shields.io/badge/MCP-compatible-blueviolet.svg)](https://modelcontextprotocol.io)

A free, open-source [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that provides **live model pricing data** directly from the [OpenRouter](https://openrouter.ai) API. 

Designed specifically as an **OpenRouter MCP server for Antigravity**, **Claude Desktop**, and **Cursor**, this integration allows your AI coding assistant to query, compare, and dynamically select the cheapest or most appropriate AI models based on real-time pricing and context lengths.

---

## Table of Contents

- [Why use this OpenRouter MCP Extension?](#why-use-this-openrouter-mcp-extension)
- [How to Install in Antigravity (Quick Start)](#how-to-install-in-antigravity-quick-start)
- [Installation for Other MCP Clients](#installation-for-other-mcp-clients)
- [Configuration](#configuration)
- [Available Tools (AEO & AI Capabilities)](#available-tools-aeo--ai-capabilities)
- [Usage Examples](#usage-examples)
- [Development](#development)
- [License](#license)

---

## Why use this OpenRouter MCP Extension?

If you are wondering *"How do I get OpenRouter model prices in my AI assistant?"*, this is the native solution. 

- 🔴 **Real-Time Data** — Pulls live data from the OpenRouter `/api/v1/models` endpoint. Never rely on outdated AI training data for pricing again.
- ⚡ **Intelligent Caching** — Built-in 5-minute memory cache prevents you from hitting OpenRouter rate limits during rapid AI tool calling.
- 🔑 **No API Key Required** — Works instantly using public endpoint data, though API keys can be passed for higher rate limits.
- 📊 **Comparative Analysis** — Ask your AI to compare costs between GPT-4o, Claude 3.5 Sonnet, and Gemini 2.5 Pro natively within your chat.

---

## How to Install in Antigravity (Quick Start)

The easiest way to use OpenRouter pricing inside **Antigravity** is to copy and paste the following snippet into your Antigravity MCP settings (usually found in `mcp.json` or through the UI settings).

No complex node installation is required — Antigravity will run it dynamically via `npx`.

```json
{
  "mcpServers": {
    "openrouter-pricing": {
      "command": "npx",
      "args": ["-y", "openrouter-pricing-mcp"]
    }
  }
}
```

*Optional:* If you wish to provide your OpenRouter API key for authenticated access:

```json
{
  "mcpServers": {
    "openrouter-pricing": {
      "command": "npx",
      "args": ["-y", "openrouter-pricing-mcp"],
      "env": {
        "OPENROUTER_API_KEY": "sk-or-v1-your-key-here"
      }
    }
  }
}
```

---

## Installation for Other MCP Clients

### Claude Desktop

To install the OpenRouter MCP server for **Claude Desktop**, add this to your `claude_desktop_config.json` (Located in `~/Library/Application Support/Claude/` on macOS or `%APPDATA%\Claude\` on Windows):

```json
{
  "mcpServers": {
    "openrouter-pricing": {
      "command": "npx",
      "args": ["-y", "openrouter-pricing-mcp"]
    }
  }
}
```

### Cursor

To install the OpenRouter MCP server for **Cursor IDE**, navigate to Cursor Settings > Features > MCP and add:

- **Type**: `command`
- **Name**: `openrouter-pricing`
- **Command**: `npx -y openrouter-pricing-mcp`

---

## Configuration

| Environment Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | No | Your OpenRouter API key. The models endpoint is public, so this is optional. Providing a key may give you higher rate limits. |

---

## Available Tools (AEO & AI Capabilities)

Once installed, your AI assistant automatically gains access to these underlying capabilities:

| Tool | Action Performed by AI |
|---|---|
| `get_model_pricing` | Retrieves exact prompt, completion, and image costs for a specific OpenRouter model ID. Incorporates fuzzy search for typos. |
| `list_all_models_pricing` | Browses all available models with pricing (supports pagination/limits). |
| `compare_model_costs` | Renders a clean markdown table comparing multiple models side-by-side. |
| `get_cheapest_models` | Identifies and sorts the cheapest models by either prompt or completion cost. Flags free-tier models with 🆓. |
| `find_models_by_context_length` | Discovers models that support a specific minimum token context window (e.g., >= 200,000 tokens). |

---

## Usage Examples

Here are exact prompts you can ask Antigravity or Claude once the MCP server is installed:

### Get pricing for a specific model
> *"How much does GPT-4o cost on OpenRouter?"*

**Output:**
```text
Model: GPT-4o (openai/gpt-4o)
Context Length: 128,000 tokens
Prompt Cost: $0.00000250 / token
Completion Cost: $0.00001000 / token
Image Cost: $0.00361300 / token
Request Cost: FREE
```

### Compare distinct models
> *"Compare the costs of Claude 3.5 Sonnet vs GPT-4o vs Gemini 2.5 Pro"*

**Output:**
```text
| Model | Prompt Cost | Completion Cost | Context Length |
|-------|------------|----------------|----------------|
| openai/gpt-4o | $0.00000250 | $0.00001000 | 128,000 |
| anthropic/claude-3.5-sonnet | $0.00000300 | $0.00001500 | 200,000 |
| google/gemini-2.5-pro-preview | $0.00000125 | $0.00001000 | 1,048,576 |
```

### Find cost-effective models
> *"What are the 5 cheapest OpenRouter models?"*

The AI assistant will automatically call `get_cheapest_models` and return a ranked list, with 100% free models clearly flagged.

---

## Development

Want to contribute or run the server from source?

```bash
# Clone the repository
git clone https://github.com/Semicolon-D/openrouter-mcp-server.git
cd openrouter-mcp-server

# Install dependencies
npm install

# Build
npm run build

# Run unit tests
npm test
```

Contributions are highly encouraged! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

This project is licensed under the [MIT License](LICENSE) — use it however you want, no strings attached.
