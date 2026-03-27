import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import type { Finding, AttackResult, TargetInfo } from "@nightfang/shared";
import type { ToolDefinition, ToolCall, ToolResult, ToolContext } from "./types.js";
import { sendPrompt, extractResponseText } from "../http.js";
import type { NightfangDB } from "../db/database.js";

// ── Tool Registry ──

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  http_request: {
    name: "http_request",
    description:
      "Send an HTTP request to a target URL. Use this to probe endpoints, send attack payloads, or interact with the target.",
    parameters: {
      url: { type: "string", description: "Target URL" },
      method: {
        type: "string",
        description: "HTTP method",
        enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      },
      body: { type: "string", description: "Request body (JSON string)" },
      headers: { type: "object", description: "Additional headers as key-value pairs" },
    },
    required: ["url"],
  },

  send_prompt: {
    name: "send_prompt",
    description:
      "Send a prompt to the target LLM endpoint and get the response. This is the primary way to interact with the target.",
    parameters: {
      prompt: { type: "string", description: "The prompt to send to the target" },
      system_context: {
        type: "string",
        description: "Optional system context to include with the prompt",
      },
    },
    required: ["prompt"],
  },

  save_finding: {
    name: "save_finding",
    description:
      "Save a security finding to the database. Call this when you discover a vulnerability.",
    parameters: {
      title: { type: "string", description: "Short title for the finding" },
      description: { type: "string", description: "Detailed description of the vulnerability" },
      severity: {
        type: "string",
        description: "Severity level",
        enum: ["critical", "high", "medium", "low", "info"],
      },
      category: {
        type: "string",
        description: "Attack category",
        enum: [
          "prompt-injection",
          "jailbreak",
          "system-prompt-extraction",
          "data-exfiltration",
          "tool-misuse",
          "output-manipulation",
          "encoding-bypass",
          "multi-turn",
        ],
      },
      template_id: { type: "string", description: "ID of the attack template used" },
      evidence_request: { type: "string", description: "The request/prompt that triggered the vuln" },
      evidence_response: { type: "string", description: "The response showing the vulnerability" },
      evidence_analysis: { type: "string", description: "Your analysis of why this is a vulnerability" },
    },
    required: ["title", "severity", "category", "evidence_request", "evidence_response"],
  },

  query_findings: {
    name: "query_findings",
    description:
      "Query existing findings from the database. Use this to check what has been found so far.",
    parameters: {
      severity: {
        type: "string",
        description: "Filter by severity",
        enum: ["critical", "high", "medium", "low", "info"],
      },
      category: { type: "string", description: "Filter by attack category" },
      status: {
        type: "string",
        description: "Filter by status",
        enum: ["discovered", "confirmed", "false-positive"],
      },
      limit: { type: "number", description: "Max results to return (default 20)" },
    },
  },

  update_finding: {
    name: "update_finding",
    description:
      "Update the status of an existing finding (e.g., mark as confirmed or false-positive).",
    parameters: {
      finding_id: { type: "string", description: "ID of the finding to update" },
      status: {
        type: "string",
        description: "New status",
        enum: ["discovered", "confirmed", "false-positive"],
      },
    },
    required: ["finding_id", "status"],
  },

  read_file: {
    name: "read_file",
    description: "Read a file from the filesystem. Use for source code analysis.",
    parameters: {
      path: { type: "string", description: "Absolute file path to read" },
      max_lines: { type: "number", description: "Max lines to read (default 500)" },
    },
    required: ["path"],
  },

  run_command: {
    name: "run_command",
    description:
      "Run a shell command. Use for tools like semgrep, grep, curl, etc. Commands are sandboxed to read-only operations.",
    parameters: {
      command: { type: "string", description: "Shell command to execute" },
      cwd: { type: "string", description: "Working directory (optional)" },
      timeout: { type: "number", description: "Timeout in ms (default 30000)" },
    },
    required: ["command"],
  },

  update_target: {
    name: "update_target",
    description:
      "Update the target profile with discovered information (type, model, endpoints, system prompt).",
    parameters: {
      type: {
        type: "string",
        description: "Target type",
        enum: ["api", "chatbot", "agent", "unknown"],
      },
      model: { type: "string", description: "Detected model name" },
      system_prompt: { type: "string", description: "Extracted system prompt" },
      endpoints: { type: "string", description: "JSON array of discovered endpoints" },
      features: { type: "string", description: "JSON array of detected features" },
    },
  },

  done: {
    name: "done",
    description:
      "Signal that you have completed your task. Include a summary of what you found or did.",
    parameters: {
      summary: { type: "string", description: "Summary of completed work" },
    },
    required: ["summary"],
  },
};

// ── Allowed commands for run_command (safety) ──

const ALLOWED_COMMAND_PREFIXES = [
  "grep",
  "rg",
  "find",
  "ls",
  "cat",
  "head",
  "tail",
  "wc",
  "semgrep",
  "codeql",
  "curl",
  "jq",
  "file",
  "stat",
];

function isCommandAllowed(cmd: string): boolean {
  const trimmed = cmd.trim();
  return ALLOWED_COMMAND_PREFIXES.some(
    (prefix) => trimmed.startsWith(prefix + " ") || trimmed === prefix
  );
}

// ── Tool Executor ──

export class ToolExecutor {
  private db: NightfangDB | null;
  private ctx: ToolContext;

  constructor(ctx: ToolContext, db: NightfangDB | null = null) {
    this.ctx = ctx;
    this.db = db;
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    try {
      switch (call.name) {
        case "http_request":
          return await this.httpRequest(call.arguments);
        case "send_prompt":
          return await this.sendPromptTool(call.arguments);
        case "save_finding":
          return this.saveFinding(call.arguments);
        case "query_findings":
          return this.queryFindings(call.arguments);
        case "update_finding":
          return this.updateFinding(call.arguments);
        case "read_file":
          return this.readFile(call.arguments);
        case "run_command":
          return this.runCommand(call.arguments);
        case "update_target":
          return this.updateTarget(call.arguments);
        case "done":
          return this.markDone(call.arguments);
        default:
          return { success: false, output: null, error: `Unknown tool: ${call.name}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: null, error: msg };
    }
  }

  private async httpRequest(args: Record<string, unknown>): Promise<ToolResult> {
    const url = args.url as string;
    const method = (args.method as string) ?? "POST";
    const body = args.body as string | undefined;
    const headers = (args.headers as Record<string, string>) ?? {};

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        body: body ?? undefined,
        signal: controller.signal,
      });

      clearTimeout(timer);
      const text = await res.text();
      return {
        success: true,
        output: {
          status: res.status,
          headers: Object.fromEntries(res.headers.entries()),
          body: text.slice(0, 10_000), // cap response size
        },
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async sendPromptTool(args: Record<string, unknown>): Promise<ToolResult> {
    const prompt = args.prompt as string;

    try {
      const res = await sendPrompt(this.ctx.target, prompt, { timeout: 30_000 });
      const text = extractResponseText(res.body);
      return { success: true, output: { response: text, raw: res.body } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: null, error: msg };
    }
  }

  private saveFinding(args: Record<string, unknown>): ToolResult {
    const finding: Finding = {
      id: randomUUID(),
      templateId: (args.template_id as string) ?? "manual",
      title: (args.title as string) ?? "Untitled finding",
      description: (args.description as string) ?? "",
      severity: (args.severity as Finding["severity"]) ?? "medium",
      category: (args.category as Finding["category"]) ?? "prompt-injection",
      status: "discovered",
      evidence: {
        request: (args.evidence_request as string) ?? "",
        response: (args.evidence_response as string) ?? "",
        analysis: args.evidence_analysis as string | undefined,
      },
      timestamp: Date.now(),
    };

    this.ctx.findings.push(finding);
    if (this.db) {
      this.db.saveFinding(this.ctx.scanId, finding);
    }

    return { success: true, output: { findingId: finding.id, message: "Finding saved" } };
  }

  private queryFindings(args: Record<string, unknown>): ToolResult {
    if (this.db) {
      const results = this.db.queryFindings({
        scanId: this.ctx.scanId,
        severity: args.severity as string | undefined,
        category: args.category as string | undefined,
        status: args.status as string | undefined,
        limit: (args.limit as number) ?? 20,
      });
      return { success: true, output: results };
    }

    // Fallback to in-memory
    let results = [...this.ctx.findings];
    if (args.severity) results = results.filter((f) => f.severity === args.severity);
    if (args.category) results = results.filter((f) => f.category === args.category);
    if (args.status) results = results.filter((f) => f.status === args.status);
    return { success: true, output: results.slice(0, (args.limit as number) ?? 20) };
  }

  private updateFinding(args: Record<string, unknown>): ToolResult {
    const id = args.finding_id as string;
    const status = args.status as string;

    const finding = this.ctx.findings.find((f) => f.id === id);
    if (finding) {
      finding.status = status as Finding["status"];
    }
    if (this.db) {
      this.db.updateFindingStatus(id, status);
    }

    return { success: true, output: { message: `Finding ${id} updated to ${status}` } };
  }

  private readFile(args: Record<string, unknown>): ToolResult {
    const path = args.path as string;
    const maxLines = (args.max_lines as number) ?? 500;

    const content = readFileSync(path, "utf-8");
    const lines = content.split("\n");
    const truncated = lines.length > maxLines;
    const output = lines.slice(0, maxLines).join("\n");

    return {
      success: true,
      output: { content: output, totalLines: lines.length, truncated },
    };
  }

  private runCommand(args: Record<string, unknown>): ToolResult {
    const command = args.command as string;
    const cwd = args.cwd as string | undefined;
    const timeout = (args.timeout as number) ?? 30_000;

    if (!isCommandAllowed(command)) {
      return {
        success: false,
        output: null,
        error: `Command not allowed. Permitted prefixes: ${ALLOWED_COMMAND_PREFIXES.join(", ")}`,
      };
    }

    try {
      const output = execSync(command, {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024, // 1MB
        encoding: "utf-8",
      });
      return { success: true, output: output.slice(0, 10_000) };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, output: null, error: msg.slice(0, 2_000) };
    }
  }

  private updateTarget(args: Record<string, unknown>): ToolResult {
    if (args.type) this.ctx.targetInfo.type = args.type as TargetInfo["type"];
    if (args.model) this.ctx.targetInfo.model = args.model as string;
    if (args.system_prompt) this.ctx.targetInfo.systemPrompt = args.system_prompt as string;
    if (args.endpoints) {
      try {
        this.ctx.targetInfo.endpoints = JSON.parse(args.endpoints as string);
      } catch {
        /* ignore parse errors */
      }
    }
    if (args.features) {
      try {
        this.ctx.targetInfo.detectedFeatures = JSON.parse(args.features as string);
      } catch {
        /* ignore parse errors */
      }
    }

    if (this.db) {
      this.db.upsertTarget({
        url: this.ctx.target,
        type: this.ctx.targetInfo.type ?? "unknown",
        ...this.ctx.targetInfo,
      } as TargetInfo);
    }

    return { success: true, output: { message: "Target profile updated", target: this.ctx.targetInfo } };
  }

  private markDone(args: Record<string, unknown>): ToolResult {
    return {
      success: true,
      output: { done: true, summary: (args.summary as string) ?? "Task completed" },
    };
  }
}

// ── Helper: get tools for a specific agent role ──

export function getToolsForRole(role: string): ToolDefinition[] {
  const common = ["query_findings", "done"];

  const roleTools: Record<string, string[]> = {
    discovery: ["send_prompt", "http_request", "update_target", ...common],
    attack: ["send_prompt", "http_request", "save_finding", "read_file", "run_command", ...common],
    verify: ["send_prompt", "http_request", "update_finding", ...common],
    report: [...common],
  };

  const toolNames = roleTools[role] ?? Object.keys(TOOL_DEFINITIONS);
  return toolNames
    .map((name) => TOOL_DEFINITIONS[name])
    .filter((t): t is ToolDefinition => t !== undefined);
}
