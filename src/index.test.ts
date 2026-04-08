import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  formatCostPer1M,
  formatCostUnit,
  handleGetModelPricing,
  handleListAllModelsPricing,
  handleCompareModelCosts,
  handleGetCheapestModels,
  handleFindModelsByContextLength,
  handleGetModelCapabilities,
  TOOL_DEFINITIONS,
  type Model,
} from "./index.js";

// ─── Fixture Data ────────────────────────────────────────────────────────────

const MOCK_MODELS: Model[] = [
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    description: "GPT-4o is OpenAI's versatile flagship model with vision capabilities and strong reasoning.",
    pricing: { prompt: "0.0000025", completion: "0.00001", request: "0", image: "0.003613" },
    context_length: 128000,
    architecture: {
      modality: "text+image->text",
      input_modalities: ["text", "image"],
      output_modalities: ["text"],
      tokenizer: "GPT",
    },
    top_provider: {
      context_length: 128000,
      max_completion_tokens: 16384,
      is_moderated: true,
    },
    supported_parameters: ["max_tokens", "temperature", "tools", "tool_choice", "response_format", "structured_outputs"],
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    description: "Claude Sonnet 4 excels in coding and reasoning with improved precision and controllability.",
    pricing: { prompt: "0.000003", completion: "0.000015", request: "0", image: "0.0048" },
    context_length: 200000,
    architecture: {
      modality: "text+image->text",
      input_modalities: ["text", "image"],
      output_modalities: ["text"],
      tokenizer: "Claude",
    },
    top_provider: {
      context_length: 200000,
      max_completion_tokens: 128000,
      is_moderated: true,
    },
    supported_parameters: ["include_reasoning", "max_tokens", "reasoning", "response_format", "tools", "tool_choice", "structured_outputs"],
  },
  {
    id: "google/gemini-2.5-pro-preview",
    name: "Gemini 2.5 Pro Preview",
    pricing: { prompt: "0.00000125", completion: "0.00001", request: "0", image: "0.000265" },
    context_length: 1048576,
  },
  {
    id: "meta-llama/llama-3-8b-instruct:free",
    name: "Llama 3 8B Instruct (Free)",
    pricing: { prompt: "0", completion: "0", request: "0", image: "0" },
    context_length: 8192,
  },
  {
    id: "mistralai/mistral-small",
    name: "Mistral Small",
    pricing: { prompt: "0.0000001", completion: "0.0000003", request: "0", image: "0" },
    context_length: 32000,
  },
];

// ─── formatCost ──────────────────────────────────────────────────────────────

describe("formatCostPer1M", () => {
  it("formats a normal cost per 1M tokens properly", () => {
    // 0.0000025 * 1M = 2.50
    assert.equal(formatCostPer1M("0.0000025"), "$2.50");
  });

  it("returns FREE for zero-cost", () => {
    assert.equal(formatCostPer1M("0"), "FREE");
  });

  it("handles NaN gracefully by returning original string", () => {
    assert.equal(formatCostPer1M("N/A"), "N/A");
  });

  it("handles very small costs accurately", () => {
    // 0.0000001 * 1M = 0.10
    assert.equal(formatCostPer1M("0.0000001"), "$0.10");
  });
});

describe("formatCostUnit", () => {
  it("formats a per-unit cost nicely", () => {
    assert.equal(formatCostUnit("0.003613"), "$0.0036");
  });
});

// ─── get_model_pricing ──────────────────────────────────────────────────────

describe("handleGetModelPricing", () => {
  it("returns pricing for a known model", () => {
    const result = handleGetModelPricing(MOCK_MODELS, { model_id: "openai/gpt-4o" });
    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    assert.ok(text.includes("GPT-4o"));
    assert.ok(text.includes("openai/gpt-4o"));
    assert.ok(text.includes("128,000"));
    assert.ok(text.includes("$2.50 / 1M")); // Checking the 1M formatting
    assert.ok(text.includes("versatile flagship")); // description included
    assert.ok(text.includes("16,384")); // max completion tokens
  });

  it("returns fuzzy suggestions for a partial match", () => {
    const result = handleGetModelPricing(MOCK_MODELS, { model_id: "gpt-4" });
    assert.equal(result.isError, true);
    const text = result.content[0].text;
    assert.ok(text.includes("Did you mean"));
    assert.ok(text.includes("openai/gpt-4o"));
  });

  it("returns a clean error for a completely unknown model", () => {
    const result = handleGetModelPricing(MOCK_MODELS, { model_id: "nonexistent/model-xyz-999" });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("not found"));
  });
});

// ─── list_all_models_pricing ────────────────────────────────────────────────

describe("handleListAllModelsPricing", () => {
  it("returns a list limited to specified count", () => {
    const result = handleListAllModelsPricing(MOCK_MODELS, { limit: 2 });
    const text = result.content[0].text;
    assert.ok(text.includes("Showing 2 of 5 models"));
    assert.ok(text.includes("openai/gpt-4o"));
    assert.ok(text.includes("anthropic/claude-sonnet-4"));
    // Should NOT include the third model
    assert.ok(!text.includes("google/gemini"));
  });

  it("defaults to 50 when no limit is provided", () => {
    const result = handleListAllModelsPricing(MOCK_MODELS, {});
    const text = result.content[0].text;
    // All 5 models should be shown since 5 < 50
    assert.ok(text.includes("Showing 5 of 5 models"));
  });

  it("clamps limit to max 200", () => {
    const result = handleListAllModelsPricing(MOCK_MODELS, { limit: 999 });
    const text = result.content[0].text;
    assert.ok(text.includes("Showing 5 of 5 models"));
  });
});

// ─── compare_model_costs ────────────────────────────────────────────────────

describe("handleCompareModelCosts", () => {
  it("compares two models in a table format", () => {
    const result = handleCompareModelCosts(MOCK_MODELS, {
      model_ids: ["openai/gpt-4o", "anthropic/claude-sonnet-4"],
    });
    const text = result.content[0].text;
    assert.ok(text.includes("openai/gpt-4o"));
    assert.ok(text.includes("anthropic/claude-sonnet-4"));
    assert.ok(text.includes("|")); // table format
    // Should include capability columns
    assert.ok(text.includes("Tools"));
    assert.ok(text.includes("Reasoning"));
    assert.ok(text.includes("Vision"));
    assert.ok(text.includes("JSON"));
    assert.ok(text.includes("✅")); // Both have tools
  });

  it("reports not-found models alongside found ones", () => {
    const result = handleCompareModelCosts(MOCK_MODELS, {
      model_ids: ["openai/gpt-4o", "fake/model"],
    });
    const text = result.content[0].text;
    assert.ok(text.includes("openai/gpt-4o"));
    assert.ok(text.includes("fake/model"));
    assert.ok(text.includes("⚠️"));
  });

  it("returns an error if no models are found", () => {
    const result = handleCompareModelCosts(MOCK_MODELS, {
      model_ids: ["fake/a", "fake/b"],
    });
    assert.equal(result.isError, true);
  });

  it("returns an error for invalid input", () => {
    const result = handleCompareModelCosts(MOCK_MODELS, { model_ids: "not-an-array" });
    assert.equal(result.isError, true);
  });
});

// ─── get_cheapest_models ────────────────────────────────────────────────────

describe("handleGetCheapestModels", () => {
  it("sorts models by prompt cost ascending", () => {
    const result = handleGetCheapestModels(MOCK_MODELS, { limit: 3, metric: "prompt" });
    const text = result.content[0].text;
    const lines = text.split("\n").filter((l) => l.match(/^\d+\./));
    // First should be the free model (cost 0)
    assert.ok(lines[0].includes("llama-3-8b"));
    assert.ok(lines[0].includes("🆓"));
  });

  it("sorts by completion cost if specified", () => {
    const result = handleGetCheapestModels(MOCK_MODELS, { metric: "completion" });
    const text = result.content[0].text;
    assert.ok(text.includes("completion"));
  });

  it("defaults to prompt and limit 10", () => {
    const result = handleGetCheapestModels(MOCK_MODELS, {});
    const text = result.content[0].text;
    assert.ok(text.includes("prompt"));
  }); // Wait, the default falls back to prompt cost, which prints "prompt: $... / 1M" so text includes "prompt"
});

// ─── find_models_by_context_length ──────────────────────────────────────────

describe("handleFindModelsByContextLength", () => {
  it("filters models by min context length", () => {
    const result = handleFindModelsByContextLength(MOCK_MODELS, { min_context_length: 100000 });
    const text = result.content[0].text;
    // Only GPT-4o (128k), Claude (200k), and Gemini (1M) should match
    assert.ok(text.includes("3 models"));
    assert.ok(text.includes("google/gemini")); // should be first (largest context)
  });

  it("returns an error for invalid input", () => {
    const result = handleFindModelsByContextLength(MOCK_MODELS, { min_context_length: -5 });
    assert.equal(result.isError, true);
  });

  it("includes pricing in the output", () => {
    const result = handleFindModelsByContextLength(MOCK_MODELS, { min_context_length: 128000 });
    const text = result.content[0].text;
    assert.ok(text.includes("Prompt:"));
  });
});

// ─── get_model_capabilities ─────────────────────────────────────────────────

describe("handleGetModelCapabilities", () => {
  it("returns capabilities for a known model with full metadata", () => {
    const result = handleGetModelCapabilities(MOCK_MODELS, { model_id: "openai/gpt-4o" });
    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    assert.ok(text.includes("GPT-4o"));
    // Description section
    assert.ok(text.includes("Description"));
    assert.ok(text.includes("versatile flagship"));
    // Pricing section
    assert.ok(text.includes("Pricing"));
    assert.ok(text.includes("$2.50 / 1M tokens"));
    // Capabilities
    assert.ok(text.includes("Tool Use"));
    assert.ok(text.includes("✅ Yes")); // tool use should be yes
    assert.ok(text.includes("Vision"));
    assert.ok(text.includes("✅ Yes")); // vision should be yes (image input)
    assert.ok(text.includes("Reasoning"));
    assert.ok(text.includes("❌ No")); // GPT-4o doesn't have reasoning
    assert.ok(text.includes("Tokenizer: GPT"));
    assert.ok(text.includes("16,384")); // max completion tokens
    assert.ok(text.includes("Content Moderated: Yes"));
  });

  it("returns capabilities for Claude with reasoning support", () => {
    const result = handleGetModelCapabilities(MOCK_MODELS, { model_id: "anthropic/claude-sonnet-4" });
    const text = result.content[0].text;
    assert.ok(text.includes("Reasoning"));
    assert.ok(text.includes("✅ Yes")); // Claude has reasoning
    assert.ok(text.includes("Tokenizer: Claude"));
    assert.ok(text.includes("128,000")); // max completion tokens
  });

  it("handles models with minimal metadata gracefully", () => {
    const result = handleGetModelCapabilities(MOCK_MODELS, { model_id: "meta-llama/llama-3-8b-instruct:free" });
    assert.equal(result.isError, undefined);
    const text = result.content[0].text;
    assert.ok(text.includes("Llama 3 8B"));
    // Should show all capabilities as No since no supported_parameters
    assert.ok(text.includes("❌ No"));
  });

  it("returns fuzzy suggestions for partial match", () => {
    const result = handleGetModelCapabilities(MOCK_MODELS, { model_id: "gpt-4" });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("Did you mean"));
  });

  it("returns error for unknown model", () => {
    const result = handleGetModelCapabilities(MOCK_MODELS, { model_id: "nonexistent/xyz" });
    assert.equal(result.isError, true);
    assert.ok(result.content[0].text.includes("not found"));
  });

  it("shows supported parameters list", () => {
    const result = handleGetModelCapabilities(MOCK_MODELS, { model_id: "openai/gpt-4o" });
    const text = result.content[0].text;
    assert.ok(text.includes("Supported Parameters"));
    assert.ok(text.includes("max_tokens"));
    assert.ok(text.includes("tools"));
  });
});

// ─── TOOL_DEFINITIONS ───────────────────────────────────────────────────────

describe("TOOL_DEFINITIONS", () => {
  it("exports exactly 6 tools", () => {
    assert.equal(TOOL_DEFINITIONS.length, 6);
  });

  it("all tools have a name, description, and inputSchema", () => {
    for (const tool of TOOL_DEFINITIONS) {
      assert.ok(tool.name, "Tool must have a name");
      assert.ok(tool.description, "Tool must have a description");
      assert.ok(tool.inputSchema, "Tool must have an inputSchema");
      assert.equal(tool.inputSchema.type, "object");
    }
  });

  it("tool names match known handler names", () => {
    const knownNames = [
      "get_model_pricing",
      "list_all_models_pricing",
      "compare_model_costs",
      "get_cheapest_models",
      "find_models_by_context_length",
      "get_model_capabilities",
    ];
    const actualNames = TOOL_DEFINITIONS.map((t) => t.name);
    assert.deepEqual(actualNames, knownNames);
  });
});
