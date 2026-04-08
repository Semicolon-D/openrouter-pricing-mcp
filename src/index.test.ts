import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  formatCost,
  handleGetModelPricing,
  handleListAllModelsPricing,
  handleCompareModelCosts,
  handleGetCheapestModels,
  handleFindModelsByContextLength,
  TOOL_DEFINITIONS,
  type Model,
} from "./index.js";

// ─── Fixture Data ────────────────────────────────────────────────────────────

const MOCK_MODELS: Model[] = [
  {
    id: "openai/gpt-4o",
    name: "GPT-4o",
    pricing: { prompt: "0.0000025", completion: "0.00001", request: "0", image: "0.003613" },
    context_length: 128000,
  },
  {
    id: "anthropic/claude-sonnet-4",
    name: "Claude Sonnet 4",
    pricing: { prompt: "0.000003", completion: "0.000015", request: "0", image: "0.0048" },
    context_length: 200000,
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

describe("formatCost", () => {
  it("formats a normal cost", () => {
    assert.equal(formatCost("0.000003"), "$0.00000300");
  });

  it("returns FREE for zero-cost", () => {
    assert.equal(formatCost("0"), "FREE");
  });

  it("handles NaN gracefully by returning original string", () => {
    assert.equal(formatCost("N/A"), "N/A");
  });

  it("handles very small costs accurately", () => {
    assert.equal(formatCost("0.0000001"), "$0.00000010");
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
    assert.ok(text.includes("prompt cost"));
  });
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

// ─── TOOL_DEFINITIONS ───────────────────────────────────────────────────────

describe("TOOL_DEFINITIONS", () => {
  it("exports exactly 5 tools", () => {
    assert.equal(TOOL_DEFINITIONS.length, 5);
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
    ];
    const actualNames = TOOL_DEFINITIONS.map((t) => t.name);
    assert.deepEqual(actualNames, knownNames);
  });
});
