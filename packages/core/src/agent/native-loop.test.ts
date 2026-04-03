import { describe, it, expect, vi } from "vitest";
import { runNativeAgentLoop } from "./native-loop.js";
import type { NativeRuntime, NativeRuntimeResult, NativeMessage, NativeToolDef } from "../runtime/types.js";

// ── Mock runtime that returns scripted responses ──

function createMockRuntime(responses: NativeRuntimeResult[]): NativeRuntime {
  let callIndex = 0;
  return {
    type: "api" as const,
    async executeNative(
      _system: string,
      _messages: NativeMessage[],
      _tools: NativeToolDef[],
    ): Promise<NativeRuntimeResult> {
      const response = responses[callIndex] ?? responses[responses.length - 1];
      callIndex++;
      return response;
    },
    async isAvailable() {
      return true;
    },
  };
}

// ── Tests ──

describe("runNativeAgentLoop", () => {
  it("calls done tool and returns summary", async () => {
    const runtime = createMockRuntime([
      {
        content: [
          { type: "tool_use", id: "tc1", name: "done", input: { summary: "All done" } },
        ],
        stopReason: "tool_use",
        durationMs: 100,
      },
    ]);

    const state = await runNativeAgentLoop({
      config: {
        role: "discovery",
        systemPrompt: "test",
        tools: [],
        maxTurns: 5,
        target: "https://example.com",
        scanId: "test-scan",
      },
      runtime,
      db: null,
    });

    expect(state.done).toBe(true);
    expect(state.summary).toBe("All done");
    expect(state.turnCount).toBe(1);
  });

  it("enforces max turns limit", async () => {
    // Runtime always returns a tool call (never done), forcing max turns
    let turnNum = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        turnNum++;
        return {
          content: [{ type: "tool_use", id: `tc${turnNum}`, name: "update_target", input: { type: "api" } }],
          stopReason: "tool_use",
          durationMs: 50,
        };
      },
      async isAvailable() { return true; },
    };

    const state = await runNativeAgentLoop({
      config: {
        role: "attack",
        systemPrompt: "test",
        tools: [],
        maxTurns: 3,
        target: "https://example.com",
        scanId: "test-scan",
      },
      runtime,
      db: null,
    });

    expect(state.done).toBe(false);
    expect(state.turnCount).toBe(3);
    expect(state.summary).toContain("max turns");
  });

  it("requires minimum turns before early exit", async () => {
    // Runtime returns end_turn on first call (should be pushed to continue)
    let callCount = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        callCount++;
        if (callCount >= 4) {
          return {
            content: [{ type: "tool_use", id: "tc1", name: "done", input: { summary: "Done after min turns" } }],
            stopReason: "tool_use",
            durationMs: 50,
          };
        }
        return {
          content: [{ type: "text", text: "Thinking..." }],
          stopReason: "end_turn",
          durationMs: 50,
        };
      },
      async isAvailable() { return true; },
    };

    const state = await runNativeAgentLoop({
      config: {
        role: "discovery",
        systemPrompt: "test",
        tools: [],
        maxTurns: 10,
        target: "https://example.com",
        scanId: "test-scan",
      },
      runtime,
      db: null,
    });

    // Should have been pushed to continue until min turns (4), then done
    expect(state.turnCount).toBeGreaterThanOrEqual(4);
    expect(state.done).toBe(true);
  });

  it("executes tool calls and collects results", async () => {
    let turnNum = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        turnNum++;
        if (turnNum === 1) {
          return {
            content: [
              { type: "tool_use", id: "tc1", name: "update_target", input: { type: "chatbot" } },
            ],
            stopReason: "tool_use",
            durationMs: 100,
          };
        }
        return {
          content: [{ type: "tool_use", id: "tc2", name: "done", input: { summary: "Updated target" } }],
          stopReason: "tool_use",
          durationMs: 50,
        };
      },
      async isAvailable() { return true; },
    };

    const state = await runNativeAgentLoop({
      config: {
        role: "discovery",
        systemPrompt: "test",
        tools: [],
        maxTurns: 5,
        target: "https://example.com",
        scanId: "test-scan",
      },
      runtime,
      db: null,
    });

    expect(state.targetInfo.type).toBe("chatbot");
    expect(state.done).toBe(true);
    expect(state.turnCount).toBe(2);
  });

  it("saves findings via save_finding tool", async () => {
    let turnNum = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        turnNum++;
        if (turnNum === 1) {
          return {
            content: [{
              type: "tool_use",
              id: "tc1",
              name: "save_finding",
              input: {
                title: "Test XSS",
                severity: "high",
                category: "xss",
                evidence_request: "GET /test",
                evidence_response: "<script>alert(1)</script>",
              },
            }],
            stopReason: "tool_use",
            durationMs: 100,
          };
        }
        return {
          content: [{ type: "tool_use", id: "tc2", name: "done", input: { summary: "Found XSS" } }],
          stopReason: "tool_use",
          durationMs: 50,
        };
      },
      async isAvailable() { return true; },
    };

    const state = await runNativeAgentLoop({
      config: {
        role: "attack",
        systemPrompt: "test",
        tools: [],
        maxTurns: 5,
        target: "https://example.com",
        scanId: "test-scan",
      },
      runtime,
      db: null,
    });

    expect(state.findings).toHaveLength(1);
    expect(state.findings[0].title).toBe("Test XSS");
    expect(state.findings[0].severity).toBe("high");
  });

  it("handles API errors gracefully", async () => {
    const runtime = createMockRuntime([
      {
        content: [],
        stopReason: "error",
        durationMs: 100,
        error: "Rate limit exceeded",
      },
    ]);

    const state = await runNativeAgentLoop({
      config: {
        role: "discovery",
        systemPrompt: "test",
        tools: [],
        maxTurns: 5,
        target: "https://example.com",
        scanId: "test-scan",
      },
      runtime,
      db: null,
    });

    // Error breaks the loop; agent is not "done" (didn't call done tool)
    expect(state.done).toBe(false);
    expect(state.turnCount).toBe(1);
    // No findings since the loop errored before any tool execution
    expect(state.findings).toHaveLength(0);
  });

  it("tracks token usage across turns", async () => {
    let turnNum = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        turnNum++;
        if (turnNum <= 2) {
          return {
            content: [{ type: "text", text: "Working..." }],
            stopReason: "end_turn",
            usage: { inputTokens: 100, outputTokens: 50 },
            durationMs: 50,
          };
        }
        return {
          content: [{ type: "tool_use", id: "tc1", name: "done", input: { summary: "Done" } }],
          stopReason: "tool_use",
          usage: { inputTokens: 200, outputTokens: 30 },
          durationMs: 50,
        };
      },
      async isAvailable() { return true; },
    };

    const state = await runNativeAgentLoop({
      config: {
        role: "discovery",
        systemPrompt: "test",
        tools: [],
        maxTurns: 10,
        target: "https://example.com",
        scanId: "test-scan",
      },
      runtime,
      db: null,
    });

    // 2 text turns (100+50 each) + 1 done turn (200+30)
    expect(state.totalUsage.inputTokens).toBe(400);
    expect(state.totalUsage.outputTokens).toBe(130);
  });

  it("invokes onTurn callback with tool calls", async () => {
    let turnNum = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        turnNum++;
        if (turnNum === 1) {
          return {
            content: [{ type: "tool_use", id: "tc1", name: "http_request", input: { url: "https://example.com" } }],
            stopReason: "tool_use",
            durationMs: 100,
          };
        }
        return {
          content: [{ type: "tool_use", id: "tc2", name: "done", input: { summary: "Done" } }],
          stopReason: "tool_use",
          durationMs: 50,
        };
      },
      async isAvailable() { return true; },
    };

    const turnCalls: Array<{ turn: number; tools: string[] }> = [];

    await runNativeAgentLoop({
      config: {
        role: "discovery",
        systemPrompt: "test",
        tools: [],
        maxTurns: 5,
        target: "https://example.com",
        scanId: "test-scan",
      },
      runtime,
      db: null,
      onTurn: (turn, toolCalls) => {
        turnCalls.push({ turn, tools: toolCalls.map((c) => c.name) });
      },
    });

    expect(turnCalls).toHaveLength(2);
    expect(turnCalls[0].tools).toContain("http_request");
    expect(turnCalls[1].tools).toContain("done");
  });
});
