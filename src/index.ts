import { Server } from "@modelcontextprotocol/sdk/server/index.js";
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
  description?: string;
  pricing: Pricing;
  context_length: number;
  architecture?: {
    modality?: string;
    input_modalities?: string[];
    output_modalities?: string[];
    tokenizer?: string;
    instruct_type?: string | null;
  };
  top_provider?: {
    context_length?: number;
    max_completion_tokens?: number | null;
    is_moderated?: boolean;
  };
  supported_parameters?: string[];
  knowledge_cutoff?: string | null;
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

const currencyFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

export function formatCostPer1M(costStr: string): string {
  const cost = parseFloat(costStr);
  if (isNaN(cost)) return costStr;
  if (cost === 0) return "FREE";
  return currencyFormat.format(cost * 1_000_000);
}

export function formatCostUnit(costStr: string): string {
  const cost = parseFloat(costStr);
  if (isNaN(cost)) return costStr;
  if (cost === 0) return "FREE";
  return currencyFormat.format(cost);
}

// ─── Tool Handlers ───────────────────────────────────────────────────────────

export function handleGetModelCapabilities(models: Model[], args: Record<string, unknown>) {
  const modelId = String(args.model_id ?? "");
  const model = models.find((m) => m.id === modelId);

  if (!model) {
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

  const inputModalities = model.architecture?.input_modalities ?? [];
  const outputModalities = model.architecture?.output_modalities ?? [];
  const supportedParams = model.supported_parameters ?? [];
  const maxCompletionTokens = model.top_provider?.max_completion_tokens;
  const isModerated = model.top_provider?.is_moderated;
  const tokenizer = model.architecture?.tokenizer;
  const knowledgeCutoff = model.knowledge_cutoff;

  // Derive capability flags from supported_parameters
  const hasToolUse = supportedParams.includes("tools") || supportedParams.includes("tool_choice");
  const hasReasoning = supportedParams.includes("reasoning") || supportedParams.includes("include_reasoning");
  const hasStructuredOutput = supportedParams.includes("structured_outputs") || supportedParams.includes("response_format");
  const hasVision = inputModalities.includes("image");
  const hasAudioInput = inputModalities.includes("audio");
  const hasAudioOutput = outputModalities.includes("audio");
  const hasImageOutput = outputModalities.includes("image");

  const lines: string[] = [
    `Model: ${model.name} (${model.id})`,
  ];

  if (model.description) {
    lines.push(``, `── Description ──`, model.description);
  }

  lines.push(
    ``,
    `── Pricing ──`,
    `Prompt: ${formatCostPer1M(model.pricing.prompt)} / 1M tokens`,
    `Completion: ${formatCostPer1M(model.pricing.completion)} / 1M tokens`,
    model.pricing.image ? `Image: ${formatCostUnit(model.pricing.image)} / image` : "",
    model.pricing.request ? `Request: ${formatCostUnit(model.pricing.request)} / request` : "",
    ``,
    `── Context & Limits ──`,
    `Context Length: ${model.context_length?.toLocaleString() ?? "N/A"} tokens`,
  );

  if (maxCompletionTokens != null) {
    lines.push(`Max Completion Tokens: ${maxCompletionTokens.toLocaleString()}`);
  }

  lines.push(
    ``,
    `── Modalities ──`,
    `Input: ${inputModalities.length > 0 ? inputModalities.join(", ") : "text"}`,
    `Output: ${outputModalities.length > 0 ? outputModalities.join(", ") : "text"}`,
    ``,
    `── Capabilities ──`,
    `🔧 Tool Use (Function Calling): ${hasToolUse ? "✅ Yes" : "❌ No"}`,
    `🧠 Reasoning / Thinking: ${hasReasoning ? "✅ Yes" : "❌ No"}`,
    `📋 Structured Output (JSON): ${hasStructuredOutput ? "✅ Yes" : "❌ No"}`,
    `👁️ Vision (Image Input): ${hasVision ? "✅ Yes" : "❌ No"}`,
    `🎤 Audio Input: ${hasAudioInput ? "✅ Yes" : "❌ No"}`,
    `🔊 Audio Output: ${hasAudioOutput ? "✅ Yes" : "❌ No"}`,
    `🎨 Image Generation: ${hasImageOutput ? "✅ Yes" : "❌ No"}`,
  );

  if (tokenizer) {
    lines.push(``, `── Technical Details ──`);
    lines.push(`Tokenizer: ${tokenizer}`);
  }
  if (isModerated != null) {
    if (!tokenizer) lines.push(``, `── Technical Details ──`);
    lines.push(`Content Moderated: ${isModerated ? "Yes" : "No"}`);
  }
  if (knowledgeCutoff) {
    lines.push(`Knowledge Cutoff: ${knowledgeCutoff}`);
  }

  if (supportedParams.length > 0) {
    lines.push(``, `── Supported Parameters ──`, supportedParams.join(", "));
  }

  // Filter out empty strings from conditional pushes
  const filteredLines = lines.filter((l, i) => !(l === "" && i > 0 && lines[i - 1] === ""));

  return {
    content: [
      {
        type: "text" as const,
        text: filteredLines.join("\n"),
      },
    ],
  };
}

export function handleGetModelPricing(models: Model[], args: Record<string, unknown>) {
  const modelId = String(args.model_id ?? "");
  const model = models.find((m) => m.id === modelId);

  if (!model) {
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

  const pricingLines = [
    `Model: ${model.name} (${model.id})`,
  ];

  if (model.description) {
    pricingLines.push(``, model.description);
  }

  pricingLines.push(
    ``,
    `Context Length: ${model.context_length?.toLocaleString() ?? "N/A"} tokens`,
    `Prompt Cost: ${formatCostPer1M(model.pricing.prompt)} / 1M tokens`,
    `Completion Cost: ${formatCostPer1M(model.pricing.completion)} / 1M tokens`,
    `Image Cost: ${formatCostUnit(model.pricing.image ?? "0")} / image`,
    `Request Cost: ${formatCostUnit(model.pricing.request ?? "0")} / request`,
  );

  if (model.top_provider?.max_completion_tokens) {
    pricingLines.push(`Max Completion Tokens: ${model.top_provider.max_completion_tokens.toLocaleString()}`);
  }

  return {
    content: [
      {
        type: "text" as const,
        text: pricingLines.join("\n"),
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
        `${i + 1}. ${m.id} — Prompt: ${formatCostPer1M(m.pricing.prompt)}/1M, Completion: ${formatCostPer1M(m.pricing.completion)}/1M`
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

  // Helper to derive capability flags
  function getCapFlags(m: Model) {
    const params = m.supported_parameters ?? [];
    const inp = m.architecture?.input_modalities ?? [];
    return {
      tools: params.includes("tools") || params.includes("tool_choice") ? "✅" : "❌",
      reasoning: params.includes("reasoning") || params.includes("include_reasoning") ? "✅" : "❌",
      vision: inp.includes("image") ? "✅" : "❌",
      json: params.includes("structured_outputs") || params.includes("response_format") ? "✅" : "❌",
    };
  }

  const header = `| Model | Prompt/1M | Completion/1M | Context | Tools | Reasoning | Vision | JSON |`;
  const separator = `|-------|----------|--------------|---------|-------|-----------|--------|------|`;
  const rows = found.map((m) => {
    const caps = getCapFlags(m);
    return `| ${m.id} | ${formatCostPer1M(m.pricing.prompt)} | ${formatCostPer1M(m.pricing.completion)} | ${m.context_length?.toLocaleString() ?? "N/A"} | ${caps.tools} | ${caps.reasoning} | ${caps.vision} | ${caps.json} |`;
  });

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
        `${i + 1}. ${m.id} — ${metric}: ${formatCostPer1M(m.pricing[metric])}/1M${parseFloat(m.pricing[metric]) === 0 ? " 🆓" : ""}`
    )
    .join("\n");

  return {
    content: [
      {
        type: "text" as const,
        text: `Top ${results.length} cheapest models by ${metric} cost (per 1M tokens):\n\n${formatted}`,
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
        `${i + 1}. ${m.id} — Context: ${m.context_length.toLocaleString()} tokens, Prompt: ${formatCostPer1M(m.pricing.prompt)}/1M`
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
      "Get pricing details and description for a specific OpenRouter model by its full ID (e.g. google/gemini-2.5-pro-preview). Includes prompt, completion, image, and request costs formatted per 1M tokens, plus model description and max output length.",
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
      "Compare costs and capabilities between multiple OpenRouter models side-by-side in a table format. Shows pricing, context length, and key capability flags (tools, reasoning, vision, JSON output).",
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
  {
    name: "get_model_capabilities",
    description:
      "Get a comprehensive model card for a specific OpenRouter model. Includes description, pricing, context limits, input/output modalities, capability flags (tool use, reasoning, vision, structured output, audio), technical details, and all supported parameters.",
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
];

// ─── Server Setup ────────────────────────────────────────────────────────────

const HANDLER_MAP: Record<string, (models: Model[], args: Record<string, unknown>) => any> = {
  get_model_pricing: handleGetModelPricing,
  list_all_models_pricing: handleListAllModelsPricing,
  compare_model_costs: handleCompareModelCosts,
  get_cheapest_models: handleGetCheapestModels,
  find_models_by_context_length: handleFindModelsByContextLength,
  get_model_capabilities: handleGetModelCapabilities,
};

export function createServer(): Server {
  const server = new Server(
    { name: "openrouter-pricing-mcp", version: "1.2.0" },
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
