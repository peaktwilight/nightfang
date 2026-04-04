import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runNativeAgentLoop } from "./native-loop.js";
import { detectPlaybooks, buildPlaybookInjection, PLAYBOOKS } from "./playbooks.js";
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

  it("triggers early stop for attack role at 50% budget when no save_finding called", async () => {
    let turnNum = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        turnNum++;
        return {
          content: [{ type: "tool_use", id: `tc${turnNum}`, name: "http_request", input: { url: "https://example.com" } }],
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
        maxTurns: 20,
        target: "https://example.com",
        scanId: "test-scan",
        retryCount: 0,
      },
      runtime,
      db: null,
    });

    // Should stop at turn 10 (50% of 20)
    expect(state.earlyStopNoProgress).toBe(true);
    expect(state.turnCount).toBe(10);
    expect(state.summary).toContain("Early stop");
    expect(state.attemptSummary).toContain("http_request");
  });

  it("does NOT early stop when save_finding is called before halfway", async () => {
    let turnNum = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        turnNum++;
        if (turnNum === 3) {
          return {
            content: [{
              type: "tool_use",
              id: `tc${turnNum}`,
              name: "save_finding",
              input: {
                title: "Found XSS",
                severity: "high",
                category: "xss",
                evidence_request: "GET /x",
                evidence_response: "<script>",
              },
            }],
            stopReason: "tool_use",
            durationMs: 50,
          };
        }
        if (turnNum >= 12) {
          return {
            content: [{ type: "tool_use", id: `tc${turnNum}`, name: "done", input: { summary: "Done with findings" } }],
            stopReason: "tool_use",
            durationMs: 50,
          };
        }
        return {
          content: [{ type: "tool_use", id: `tc${turnNum}`, name: "http_request", input: { url: "https://example.com" } }],
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
        maxTurns: 20,
        target: "https://example.com",
        scanId: "test-scan",
        retryCount: 0,
      },
      runtime,
      db: null,
    });

    expect(state.earlyStopNoProgress).toBe(false);
    expect(state.done).toBe(true);
    expect(state.turnCount).toBe(12);
    expect(state.findings).toHaveLength(1);
  });

  it("does NOT early stop on retry attempts (retryCount > 0)", async () => {
    let turnNum = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        turnNum++;
        if (turnNum >= 15) {
          return {
            content: [{ type: "tool_use", id: `tc${turnNum}`, name: "done", input: { summary: "Exhausted" } }],
            stopReason: "tool_use",
            durationMs: 50,
          };
        }
        return {
          content: [{ type: "tool_use", id: `tc${turnNum}`, name: "http_request", input: { url: "https://example.com" } }],
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
        maxTurns: 20,
        target: "https://example.com",
        scanId: "test-scan",
        retryCount: 1,
      },
      runtime,
      db: null,
    });

    // Should NOT early stop — retryCount=1 means this is already a retry
    expect(state.earlyStopNoProgress).toBe(false);
    expect(state.done).toBe(true);
    expect(state.turnCount).toBe(15);
  });

  it("does NOT early stop for non-attack roles", async () => {
    let turnNum = 0;
    const runtime: NativeRuntime = {
      type: "api" as const,
      async executeNative() {
        turnNum++;
        if (turnNum >= 12) {
          return {
            content: [{ type: "tool_use", id: `tc${turnNum}`, name: "done", input: { summary: "Done" } }],
            stopReason: "tool_use",
            durationMs: 50,
          };
        }
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
        role: "discovery",
        systemPrompt: "test",
        tools: [],
        maxTurns: 20,
        target: "https://example.com",
        scanId: "test-scan",
        retryCount: 0,
      },
      runtime,
      db: null,
    });

    expect(state.earlyStopNoProgress).toBe(false);
    expect(state.done).toBe(true);
    expect(state.turnCount).toBe(12);
  });
});

// ── Playbook detection tests ──

describe("detectPlaybooks", () => {
  it("detects SQLi from SQL error messages", () => {
    const texts = [
      'Error: You have an error in your SQL syntax near \'"\' at line 1',
      "SELECT * FROM users WHERE id = 1",
    ];
    const types = detectPlaybooks(texts);
    expect(types).toContain("sqli");
  });

  it("detects SSTI from template syntax", () => {
    const texts = [
      "Response: Hello {{user.name}}, welcome!",
      "Using Jinja2 template engine",
    ];
    const types = detectPlaybooks(texts);
    expect(types).toContain("ssti");
  });

  it("detects IDOR from URL patterns with IDs", () => {
    const texts = [
      "Found endpoint: /api/users/1",
      "GET /profile?id=42 returned user data with user_id field",
    ];
    const types = detectPlaybooks(texts);
    expect(types).toContain("idor");
  });

  it("requires at least 2 pattern matches to trigger", () => {
    // Only one pattern match — should not trigger
    const texts = ["some random text with the word password in it"];
    const types = detectPlaybooks(texts);
    // auth_bypass requires 2+ matches; "password" alone is just 1
    expect(types).not.toContain("sqli");
    expect(types).not.toContain("ssti");
  });

  it("returns at most 3 playbook types", () => {
    const texts = [
      "SQL syntax error in SELECT query from information_schema",
      "{{7*7}} returned 49 in Jinja2 template",
      "/api/users/1 with user_id and owner_id",
      "<script>alert(1)</script> reflected with onerror handler and innerHTML",
      "webhook callback url with proxy and redirect",
      "file path include traversal ../../etc/passwd /proc/self",
      "login auth password session jwt bearer unauthorized 401 403",
      "exec system popen subprocess child_process shell ping",
    ];
    const types = detectPlaybooks(texts);
    expect(types.length).toBeLessThanOrEqual(3);
  });

  it("returns empty array when no patterns match", () => {
    const texts = ["Everything looks normal here", "No vulnerabilities found"];
    const types = detectPlaybooks(texts);
    expect(types).toHaveLength(0);
  });
});

describe("buildPlaybookInjection", () => {
  it("returns empty string for empty types", () => {
    expect(buildPlaybookInjection([])).toBe("");
  });

  it("includes playbook content for detected types", () => {
    const result = buildPlaybookInjection(["sqli", "idor"]);
    expect(result).toContain("SQLi Playbook");
    expect(result).toContain("IDOR Playbook");
    expect(result).toContain("Dynamic Playbook Injection");
  });

  it("skips unknown types gracefully", () => {
    const result = buildPlaybookInjection(["sqli", "unknown_type"]);
    expect(result).toContain("SQLi Playbook");
    expect(result).not.toContain("unknown_type");
  });
});

describe("PLAYBOOKS registry", () => {
  it("contains all expected vulnerability types", () => {
    const expectedTypes = ["sqli", "ssti", "idor", "xss", "ssrf", "lfi", "auth_bypass", "command_injection"];
    for (const t of expectedTypes) {
      expect(PLAYBOOKS[t]).toBeDefined();
      expect(PLAYBOOKS[t].length).toBeGreaterThan(50);
    }
  });
});
