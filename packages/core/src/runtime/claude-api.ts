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

const DEFAULT_MODEL = "claude-sonnet-4-6";

/**
 * Runtime that calls the Anthropic Claude Messages API directly.
 *
 * Supports two modes:
 * - Legacy: single-prompt execute() for backward compat with existing agent loop
 * - Native: structured multi-turn messages with tool_use for the new agent loop
 *
 * Requires ANTHROPIC_API_KEY env var.
 */
export class ClaudeApiRuntime implements Runtime, NativeRuntime {
  readonly type = "api" as const;
  private config: RuntimeConfig;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.apiKey = config.apiKey ?? process.env.ANTHROPIC_API_KEY ?? "";
    this.baseUrl =
      process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
    this.model = config.model ?? DEFAULT_MODEL;
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
