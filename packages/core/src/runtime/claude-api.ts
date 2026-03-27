import type { Runtime, RuntimeConfig, RuntimeContext, RuntimeResult } from "./types.js";

/**
 * Runtime that calls the Anthropic Claude Messages API directly.
 *
 * Used by the audit agent loop — the agent needs Claude to *analyze* code,
 * not to send prompts to a target LLM endpoint (that's what ApiRuntime does).
 *
 * Requires ANTHROPIC_API_KEY env var.
 */
export class ClaudeApiRuntime implements Runtime {
  readonly type = "api" as const;
  private config: RuntimeConfig;
  private apiKey: string;
  private baseUrl: string;

  constructor(config: RuntimeConfig) {
    this.config = config;
    this.apiKey = process.env.ANTHROPIC_API_KEY ?? "";
    this.baseUrl =
      process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com";
  }

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

    // Extract system prompt from conversation if present
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
          model: "claude-sonnet-4-6",
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

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
