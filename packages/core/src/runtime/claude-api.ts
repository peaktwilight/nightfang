import type {
  Runtime,
  NativeRuntime,
  RuntimeConfig,
  RuntimeContext,
  RuntimeResult,
  NativeMessage,
  NativeToolDef,
  NativeRuntimeResult,
  NativeContentBlock,
} from "./types.js";

const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6";
const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4";
const DEFAULT_OPENAI_MODEL = "gpt-4o";

type ApiProvider = "openrouter" | "anthropic" | "openai";

/**
 * Detect which API provider to use based on available keys.
 * Priority: OPENROUTER_API_KEY -> ANTHROPIC_API_KEY -> OPENAI_API_KEY
 */
function detectProvider(configApiKey?: string): {
  provider: ApiProvider;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
} {
  // If an explicit API key is passed via config, try to guess the provider from the key prefix
  if (configApiKey) {
    if (configApiKey.startsWith("sk-or-")) {
      return {
        provider: "openrouter",
        apiKey: configApiKey,
        baseUrl: "https://openrouter.ai/api/v1",
        defaultModel: DEFAULT_OPENROUTER_MODEL,
      };
    }
    if (configApiKey.startsWith("sk-ant-")) {
      return {
        provider: "anthropic",
        apiKey: configApiKey,
        baseUrl: "https://api.anthropic.com",
        defaultModel: DEFAULT_ANTHROPIC_MODEL,
      };
    }
    // Assume OpenAI-compatible for other keys
    return {
      provider: "openai",
      apiKey: configApiKey,
      baseUrl: "https://api.openai.com/v1",
      defaultModel: DEFAULT_OPENAI_MODEL,
    };
  }

  // Check env vars in priority order
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    return {
      provider: "openrouter",
      apiKey: openrouterKey,
      baseUrl: "https://openrouter.ai/api/v1",
      defaultModel: DEFAULT_OPENROUTER_MODEL,
    };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return {
      provider: "anthropic",
      apiKey: anthropicKey,
      baseUrl: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
      defaultModel: DEFAULT_ANTHROPIC_MODEL,
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    return {
      provider: "openai",
      apiKey: openaiKey,
      baseUrl: "https://api.openai.com/v1",
      defaultModel: DEFAULT_OPENAI_MODEL,
    };
  }

  // No key found — default to Anthropic (will fail at runtime with helpful message)
  return {
    provider: "anthropic",
    apiKey: "",
    baseUrl: process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com",
    defaultModel: DEFAULT_ANTHROPIC_MODEL,
  };
}

/**
 * Runtime that calls LLM APIs directly.
 *
 * Supports multiple providers with automatic detection:
 * - OpenRouter (OPENROUTER_API_KEY) — access many models through one API
 * - Anthropic (ANTHROPIC_API_KEY) — direct Claude API access
 * - OpenAI (OPENAI_API_KEY) — direct OpenAI API access
 *
 * Priority: OPENROUTER_API_KEY -> ANTHROPIC_API_KEY -> OPENAI_API_KEY
 *
 * Model can be overridden with NIGHTFANG_MODEL env var or --model flag.
 *
 * Supports two modes:
 * - Legacy: single-prompt execute() for backward compat with existing agent loop
 * - Native: structured multi-turn messages with tool_use for the new agent loop
 */
export class ClaudeApiRuntime implements Runtime, NativeRuntime {
  readonly type = "api" as const;
  private config: RuntimeConfig;
  private provider: ApiProvider;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: RuntimeConfig) {
    this.config = config;
    const detected = detectProvider(config.apiKey);
    this.provider = detected.provider;
    this.apiKey = detected.apiKey;
    this.baseUrl = detected.baseUrl;
    this.model =
      config.model ??
      process.env.NIGHTFANG_MODEL ??
      detected.defaultModel;
  }

  // ── Legacy Runtime interface (single-prompt) ──

  async execute(
    prompt: string,
    context?: RuntimeContext,
  ): Promise<RuntimeResult> {
    const start = Date.now();

    if (!this.apiKey) {
      return {
        output: "",
        exitCode: 1,
        timedOut: false,
        durationMs: Date.now() - start,
        error:
          "ANTHROPIC_API_KEY not set. Export it to use the audit agent:\n  export ANTHROPIC_API_KEY=sk-ant-...",
      };
    }

    const systemPrompt = context?.systemPrompt ?? "";

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeout || 120_000,
    );

    try {
      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 8192,
          ...(systemPrompt ? { system: systemPrompt } : {}),
          messages: [{ role: "user", content: prompt }],
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const body = await res.text();

      if (!res.ok) {
        return {
          output: "",
          exitCode: 1,
          timedOut: false,
          durationMs: Date.now() - start,
          error: `Anthropic API error ${res.status}: ${body.slice(0, 500)}`,
        };
      }

      const json = JSON.parse(body);
      const text =
        json.content
          ?.filter((b: { type: string }) => b.type === "text")
          .map((b: { text: string }) => b.text)
          .join("\n") ?? "";

      return {
        output: text,
        exitCode: 0,
        timedOut: false,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      const timedOut = msg.includes("abort") || msg.includes("timeout");
      return {
        output: "",
        exitCode: 1,
        timedOut,
        durationMs: Date.now() - start,
        error: timedOut
          ? "Claude API request timed out"
          : `Claude API error: ${msg}`,
      };
    }
  }

  // ── Native Runtime interface (structured messages + tool_use) ──

  async executeNative(
    system: string,
    messages: NativeMessage[],
    tools: NativeToolDef[],
  ): Promise<NativeRuntimeResult> {
    const start = Date.now();

    if (!this.apiKey) {
      return {
        content: [{ type: "text", text: "" }],
        stopReason: "error",
        durationMs: Date.now() - start,
        error: "ANTHROPIC_API_KEY not set.",
      };
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      this.config.timeout || 120_000,
    );

    try {
      // Convert messages to API format
      const apiMessages = messages.map((m) => ({
        role: m.role,
        content: m.content.map((block) => {
          if (block.type === "text") return { type: "text", text: block.text };
          if (block.type === "tool_use") {
            return { type: "tool_use", id: block.id, name: block.name, input: block.input };
          }
          if (block.type === "tool_result") {
            return {
              type: "tool_result",
              tool_use_id: block.tool_use_id,
              content: block.content,
              ...(block.is_error ? { is_error: true } : {}),
            };
          }
          return block;
        }),
      }));

      const body: Record<string, unknown> = {
        model: this.model,
        max_tokens: 8192,
        system,
        messages: apiMessages,
      };

      if (tools.length > 0) {
        body.tools = tools;
      }

      const res = await fetch(`${this.baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timer);

      const responseText = await res.text();

      if (!res.ok) {
        return {
          content: [{ type: "text", text: "" }],
          stopReason: "error",
          durationMs: Date.now() - start,
          error: `Anthropic API error ${res.status}: ${responseText.slice(0, 500)}`,
        };
      }

      const json = JSON.parse(responseText);

      // Parse content blocks
      const content: NativeContentBlock[] = (json.content ?? []).map(
        (block: Record<string, unknown>) => {
          if (block.type === "text") {
            return { type: "text", text: block.text as string };
          }
          if (block.type === "tool_use") {
            return {
              type: "tool_use",
              id: block.id as string,
              name: block.name as string,
              input: block.input as Record<string, unknown>,
            };
          }
          return { type: "text", text: JSON.stringify(block) };
        },
      );

      const stopReason = json.stop_reason === "tool_use" ? "tool_use" as const
        : json.stop_reason === "max_tokens" ? "max_tokens" as const
        : "end_turn" as const;

      return {
        content,
        stopReason,
        usage: json.usage
          ? {
              inputTokens: json.usage.input_tokens ?? 0,
              outputTokens: json.usage.output_tokens ?? 0,
            }
          : undefined,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      const timedOut = msg.includes("abort") || msg.includes("timeout");
      return {
        content: [{ type: "text", text: "" }],
        stopReason: "error",
        durationMs: Date.now() - start,
        error: timedOut
          ? "Claude API request timed out"
          : `Claude API error: ${msg}`,
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
