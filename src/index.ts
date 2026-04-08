
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Pricing {
  prompt: string;
  completion: string;
  request: string;
  image: string;
}

export interface Model {
  id: string;
  name: string;
  pricing: Pricing;
  context_length: number;
  architecture?: {
    modality?: string;
  };
}

// ─── Cache ───────────────────────────────────────────────────────────────────

let cachedModels: Model[] = [];
let lastFetchTime = 0;
const CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function _resetCache(): void {
  cachedModels = [];
  lastFetchTime = 0;
}

export async function getModels(
  fetchFn: () => Promise<Model[]> = fetchModelsFromAPI
): Promise<Model[]> {
  const now = Date.now();
  if (cachedModels.length > 0 && now - lastFetchTime < CACHE_DURATION_MS) {
    return cachedModels;
  }

  try {
    cachedModels = await fetchFn();
    lastFetchTime = now;
    return cachedModels;
  } catch (error: any) {
    if (cachedModels.length > 0) {
      return cachedModels;
    }
    throw new Error(`Error fetching models from OpenRouter: ${error.message}`);
  }
}

async function fetchModelsFromAPI(): Promise<Model[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Use API key if provided (optional — the models endpoint is public)
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  return data.data as Model[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function formatCost(costStr: string): string {
  const cost = parseFloat(costStr);
  if (isNaN(cost)) return costStr;
  if (cost === 0) return "FREE";
  return `$${cost.toFixed(8)}`;
}

// ─── Tool Handlers ───────────────────────────────────────────────────────────

export function handleGetModelPricing(models: Model[], args: Record<string, unknown>) {
  const modelId = String(args.model_id ?? "");
  const model = models.find((m) => m.id === modelId);

  if (!model) {
    // Attempt fuzzy match
    const fuzzy = models.filter((m) =>
      m.id.toLowerCase().includes(modelId.toLowerCase())
    );
    if (fuzzy.length > 0) {
      const suggestions = fuzzy.slice(0, 5).map((m) => m.id).join("\n  ");
      return {
        content: [
          {
            type: "text" as const,
            text: `Model "${modelId}" not found. Did you mean one of these?\n  ${suggestions}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: "text" as const, text: `Model "${modelId}" not found.` }],
      isError: true,
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: [
          `Model: ${model.name} (${model.id})`,
          `Context Length: ${model.context_length?.toLocaleString() ?? "N/A"} tokens`,
          `Prompt Cost: ${formatCost(model.pricing.prompt)} / token`,
          `Completion Cost: ${formatCost(model.pricing.completion)} / token`,
          `Image Cost: ${formatCost(model.pricing.image)} / token`,
          `Request Cost: ${formatCost(model.pricing.request)}`,
        ].join("\n"),
      },
    ],
  };
}

export function handleListAllModelsPricing(models: Model[], args: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 200);
  const results = models.slice(0, limit);

  const formatted = results
    .map(
      (m, i) =>
        `${i + 1}. ${m.id} — Prompt: ${formatCost(m.pricing.prompt)}, Completion: ${formatCost(m.pricing.completion)}`
    )
    .join("\n");

  return {
    content: [
      {
        type: "text" as const,
        text: `Showing ${results.length} of ${models.length} models:\n\n${formatted}`,
      },
    ],
  };
}

export function handleCompareModelCosts(models: Model[], args: Record<string, unknown>) {
  const modelIds = args.model_ids as string[];
  if (!Array.isArray(modelIds) || modelIds.length === 0) {
    return {
      content: [{ type: "text" as const, text: "model_ids must be a non-empty array of strings." }],
      isError: true,
    };
  }

  const found: Model[] = [];
  const notFound: string[] = [];

  for (const id of modelIds) {
    const m = models.find((model) => model.id === id);
    if (m) found.push(m);
    else notFound.push(id);
  }

  if (found.length === 0) {
    return {
      content: [{ type: "text" as const, text: `None of the specified models were found: ${notFound.join(", ")}` }],
      isError: true,
    };
  }

  const header = `| Model | Prompt Cost | Completion Cost | Context Length |`;
  const separator = `|-------|------------|----------------|----------------|`;
  const rows = found.map(
    (m) =>
      `| ${m.id} | ${formatCost(m.pricing.prompt)} | ${formatCost(m.pricing.completion)} | ${m.context_length?.toLocaleString() ?? "N/A"} |`
  );

  let text = `${header}\n${separator}\n${rows.join("\n")}`;
  if (notFound.length > 0) {
    text += `\n\n⚠️ Models not found: ${notFound.join(", ")}`;
  }

  return {
    content: [{ type: "text" as const, text }],
  };
}

export function handleGetCheapestModels(models: Model[], args: Record<string, unknown>) {
  const limit = Math.min(Math.max(Number(args.limit) || 10, 1), 100);
  const metric = String(args.metric) === "completion" ? "completion" : "prompt";

  const sorted = [...models]
    .filter((m) => {
      const val = parseFloat(m.pricing[metric]);
      return !isNaN(val) && val >= 0;
    })
    .sort((a, b) => parseFloat(a.pricing[metric]) - parseFloat(b.pricing[metric]));

  const results = sorted.slice(0, limit);
  const formatted = results
    .map(
      (m, i) =>
        `${i + 1}. ${m.id} — ${metric}: ${formatCost(m.pricing[metric])}${parseFloat(m.pricing[metric]) === 0 ? " 🆓" : ""}`
    )
    .join("\n");

  return {
    content: [
      {
        type: "text" as const,
        text: `Top ${results.length} cheapest models by ${metric} cost:\n\n${formatted}`,
      },
    ],
  };
}

export function handleFindModelsByContextLength(models: Model[], args: Record<string, unknown>) {
  const minContext = Number(args.min_context_length);
  if (!minContext || minContext <= 0) {
    return {
      content: [{ type: "text" as const, text: "min_context_length must be a positive number." }],
      isError: true,
    };
  }

  const limit = Math.min(Math.max(Number(args.limit) || 20, 1), 100);

  const matching = models
    .filter((m) => m.context_length >= minContext)
    .sort((a, b) => b.context_length - a.context_length);

  const results = matching.slice(0, limit);

  const formatted = results
    .map(
      (m, i) =>
        `${i + 1}. ${m.id} — Context: ${m.context_length.toLocaleString()} tokens, Prompt: ${formatCost(m.pricing.prompt)}`
    )
    .join("\n");

  return {
    content: [
      {
        type: "text" as const,
        text: `Found ${matching.length} models supporting >= ${minContext.toLocaleString()} tokens (showing top ${results.length}):\n\n${formatted}`,
      },
    ],
  };
}

// ─── Tool Definitions ────────────────────────────────────────────────────────

export const TOOL_DEFINITIONS = [
  {
    name: "get_model_pricing",
    description:
      "Get pricing details for a specific OpenRouter model by its full ID (e.g. google/gemini-2.5-pro-preview). Includes prompt, completion, image, and request costs.",
    inputSchema: {
      type: "object" as const,
      properties: {
        model_id: {
          type: "string",
          description: "The full ID of the model (e.g. openai/gpt-4o, anthropic/claude-sonnet-4)",
        },
      },
      required: ["model_id"],
    },
  },
  {
    name: "list_all_models_pricing",
    description:
      "List all OpenRouter models and their pricing. Useful to discover available models and browse prices.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Limit the number of results returned (default: 50, max: 200)",
        },
      },
      required: [],
    },
  },
  {
    name: "compare_model_costs",
    description:
      "Compare costs between multiple OpenRouter models side-by-side in a table format.",
    inputSchema: {
      type: "object" as const,
      properties: {
        model_ids: {
          type: "array",
          items: { type: "string" },
          description: "Array of model IDs to compare (e.g. [\"openai/gpt-4o\", \"anthropic/claude-sonnet-4\"])",
        },
      },
      required: ["model_ids"],
    },
  },
  {
    name: "get_cheapest_models",
    description:
      "Find the most cost-effective OpenRouter models, sorted by price. Free models are flagged with 🆓.",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of results to return (default: 10, max: 100)",
        },
        metric: {
          type: "string",
          description: "Which metric to sort by: 'prompt' or 'completion' (default: 'prompt')",
          enum: ["prompt", "completion"],
        },
      },
      required: [],
    },
  },
  {
    name: "find_models_by_context_length",
    description:
      "Find models that support at least a specific context window size (e.g., models with >= 128000 tokens).",
    inputSchema: {
      type: "object" as const,
      properties: {
        min_context_length: {
          type: "number",
          description: "Minimum context length required in tokens",
        },
        limit: {
          type: "number",
          description: "Number of results (default: 20, max: 100)",
        },
      },
      required: ["min_context_length"],
    },
  },
];

// ─── Server Setup ────────────────────────────────────────────────────────────

const HANDLER_MAP: Record<string, (models: Model[], args: Record<string, unknown>) => any> = {
  get_model_pricing: handleGetModelPricing,
  list_all_models_pricing: handleListAllModelsPricing,
  compare_model_costs: handleCompareModelCosts,
  get_cheapest_models: handleGetCheapestModels,
  find_models_by_context_length: handleFindModelsByContextLength,
};

export function createServer(): Server {
  const server = new Server(
    { name: "openrouter-pricing-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOL_DEFINITIONS,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = HANDLER_MAP[name];
    if (!handler) {
      throw new Error(`Unknown tool: ${name}`);
    }
    const models = await getModels();
    return handler(models, (args ?? {}) as Record<string, unknown>);
  });

  return server;
}
