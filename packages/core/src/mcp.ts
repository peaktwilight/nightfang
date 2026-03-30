import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import type { AttackOutcome, AttackResult, Finding, ScanContext, TargetInfo } from "@pwnkit/shared";
import { isMcpTarget } from "./http.js";

interface McpRpcEnvelope {
  jsonrpc?: string;
  id?: string | number;
  result?: Record<string, unknown>;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, { type?: string; description?: string }>;
    required?: string[];
  };
  internal?: boolean;
  [key: string]: unknown;
}

interface McpRequestResult {
  status: number;
  latencyMs: number;
  raw: string;
  json: McpRpcEnvelope | null;
}

interface McpProbe {
  id: string;
  url: string;
  title: string;
  regex: RegExp;
  severity: Finding["severity"];
  category: Finding["category"];
  analysis: string;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const SUSPICIOUS_DESCRIPTION = /(ignore (all|any) previous|system prompt|hidden instructions|always call|must invoke|secret tool)/i;
const EXPOSED_INTERNAL_TOOL = /(file|database|sql|shell|exec|email|admin|internal|passwd|credential)/i;

const MCP_PROBES: McpProbe[] = [
  {
    id: "mcp-ssrf-metadata",
    url: "http://169.254.169.254/latest/meta-data/",
    title: "SSRF via MCP tool parameters",
    regex: /(ami-id|instance-id|security-credentials)/i,
    severity: "critical",
    category: "tool-misuse",
    analysis: "The MCP server fetched cloud metadata through a tool parameter without blocking internal network access.",
  },
  {
    id: "mcp-data-exfil-local",
    url: "file:///etc/passwd",
    title: "Data exfiltration through MCP tool responses",
    regex: /(root:.*:\/bin\/|daemon:.*nologin)/i,
    severity: "high",
    category: "data-exfiltration",
    analysis: "The MCP tool response exposed local file contents, which indicates sensitive data can be exfiltrated through tool output.",
  },
];

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized.endsWith(".localhost");
}

function isPrivateIp(hostname: string): boolean {
  const normalized = hostname === "::1" ? "127.0.0.1" : hostname.toLowerCase();
  const family = isIP(normalized);
  if (family === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10
      || a === 127
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168);
  }

  if (family === 6) {
    return normalized === "::1"
      || normalized.startsWith("fc")
      || normalized.startsWith("fd")
      || normalized.startsWith("fe80:");
  }

  return false;
}

function chooseTransportProtocol(hostname: string): "http" | "https" {
  return isLocalHostname(hostname) || isPrivateIp(hostname) ? "http" : "https";
}

export function resolveMcpEndpoint(target: string): string {
  if (!isMcpTarget(target)) {
    return target;
  }

  const parsed = new URL(target);
  const protocol = chooseTransportProtocol(parsed.hostname);
  const path = parsed.pathname && parsed.pathname !== "/" ? parsed.pathname : "/mcp";
  return `${protocol}://${parsed.host}${path}${parsed.search}`;
}

async function sendMcpRequest(
  target: string,
  method: string,
  params?: Record<string, unknown>,
  timeout = DEFAULT_TIMEOUT_MS,
): Promise<McpRequestResult> {
  const endpoint = resolveMcpEndpoint(target);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: randomUUID(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    const raw = await response.text();
    let json: McpRpcEnvelope | null = null;
    try {
      json = JSON.parse(raw) as McpRpcEnvelope;
    } catch {
      json = null;
    }

    return {
      status: response.status,
      latencyMs: Date.now() - startedAt,
      raw,
      json,
    };
  } finally {
    clearTimeout(timer);
  }
}

function extractMcpText(response: McpRequestResult): string {
  const content = response.json?.result?.content;
  if (Array.isArray(content)) {
    const text = content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return typeof item.text === "string" ? item.text : JSON.stringify(item.text);
        }
        return JSON.stringify(item);
      })
      .join("\n");

    if (text) return text;
  }

  if (response.json?.error?.message) {
    return response.json.error.message;
  }

  return response.raw;
}

function toolHasUrlParameter(tool: McpTool): boolean {
  const properties = tool.inputSchema?.properties ?? {};
  return Object.keys(properties).some((key) => /url|uri|href|endpoint/i.test(key))
    || /fetch|request|browse|open|url|http/i.test(tool.name)
    || /url|http|https|fetch/i.test(tool.description ?? "");
}

function toolLooksSensitive(tool: McpTool): boolean {
  if (tool.internal === true) return true;
  return EXPOSED_INTERNAL_TOOL.test(tool.name) || EXPOSED_INTERNAL_TOOL.test(tool.description ?? "");
}

function createAttackResult(
  templateId: string,
  payloadId: string,
  outcome: AttackOutcome,
  request: string,
  response: string,
  latencyMs: number,
  error?: string,
): AttackResult {
  return {
    templateId,
    payloadId,
    outcome,
    request,
    response,
    latencyMs,
    timestamp: Date.now(),
    error,
  };
}

function createFinding(
  templateId: string,
  title: string,
  description: string,
  severity: Finding["severity"],
  category: Finding["category"],
  request: string,
  response: string,
  analysis: string,
): Finding {
  return {
    id: randomUUID(),
    templateId,
    title,
    description,
    severity,
    category,
    status: "confirmed",
    evidence: {
      request,
      response,
      analysis,
    },
    timestamp: Date.now(),
  };
}

export async function listMcpTools(
  target: string,
  timeout?: number,
): Promise<{ tools: McpTool[]; response: McpRequestResult }> {
  const response = await sendMcpRequest(target, "tools/list", undefined, timeout);
  if (!response.json) {
    throw new Error(`MCP tools/list returned non-JSON response from ${resolveMcpEndpoint(target)}`);
  }

  if (response.json.error) {
    throw new Error(response.json.error.message ?? "MCP tools/list failed");
  }

  const tools = Array.isArray(response.json.result?.tools)
    ? (response.json.result?.tools as McpTool[])
    : [];

  return { tools, response };
}

export async function callMcpTool(
  target: string,
  toolName: string,
  args: Record<string, unknown>,
  timeout?: number,
): Promise<{ response: McpRequestResult; text: string }> {
  const response = await sendMcpRequest(
    target,
    "tools/call",
    { name: toolName, arguments: args },
    timeout,
  );

  return {
    response,
    text: extractMcpText(response),
  };
}

export async function discoverMcpTarget(target: string, timeout?: number): Promise<TargetInfo> {
  const { tools } = await listMcpTools(target, timeout);
  return {
    url: target,
    type: "mcp",
    endpoints: [resolveMcpEndpoint(target)],
    detectedFeatures: [
      "mcp",
      "tool-use",
      ...(tools.some(toolHasUrlParameter) ? ["url-fetching"] : []),
    ],
  };
}

export async function runMcpSecurityChecks(
  ctx: ScanContext,
): Promise<{ results: AttackResult[]; findings: Finding[] }> {
  const results: AttackResult[] = [];
  const findings: Finding[] = [];
  const timeout = ctx.config.timeout ?? DEFAULT_TIMEOUT_MS;
  const { tools, response } = await listMcpTools(ctx.config.target, timeout);
  const serializedTools = JSON.stringify(tools, null, 2);

  const exposedTools = tools.filter(toolLooksSensitive);
  results.push(
    createAttackResult(
      "mcp-tool-enumeration",
      "tools-list",
      exposedTools.length > 0 ? "vulnerable" : "safe",
      "tools/list",
      serializedTools,
      response.latencyMs,
    ),
  );

  if (exposedTools.length > 0) {
    findings.push(
      createFinding(
        "mcp-tool-enumeration",
        "Unauthorized MCP tool exposure",
        "The MCP server discloses internal or high-risk tools through tools/list, which exposes capabilities that should not be visible to untrusted clients.",
        "high",
        "tool-misuse",
        "tools/list",
        serializedTools,
        `Exposed tools: ${exposedTools.map((tool) => tool.name).join(", ")}`,
      ),
    );
  }

  const suspiciousDescriptions = tools.filter((tool) => SUSPICIOUS_DESCRIPTION.test(tool.description ?? ""));
  if (suspiciousDescriptions.length > 0) {
    findings.push(
      createFinding(
        "mcp-description-injection",
        "Prompt injection in MCP tool descriptions",
        "One or more MCP tool descriptions contain instruction-like content that could steer an agent into unsafe tool use.",
        "high",
        "prompt-injection",
        "tools/list",
        serializedTools,
        `Suspicious descriptions detected on: ${suspiciousDescriptions.map((tool) => tool.name).join(", ")}`,
      ),
    );
  }

  const urlTool = tools.find(toolHasUrlParameter);
  if (!urlTool) {
    return { results, findings };
  }

  for (const probe of MCP_PROBES) {
    const { response: callResponse, text } = await callMcpTool(
      ctx.config.target,
      urlTool.name,
      { url: probe.url },
      timeout,
    );

    const vulnerable = probe.regex.test(text);
    results.push(
      createAttackResult(
        probe.id,
        urlTool.name,
        vulnerable ? "vulnerable" : "safe",
        JSON.stringify({ tool: urlTool.name, arguments: { url: probe.url } }),
        text,
        callResponse.latencyMs,
        callResponse.json?.error?.message,
      ),
    );

    if (vulnerable) {
      findings.push(
        createFinding(
          probe.id,
          probe.title,
          `The MCP tool ${urlTool.name} accepted a high-risk URL and returned sensitive content instead of enforcing network or filesystem restrictions.`,
          probe.severity,
          probe.category,
          JSON.stringify({ tool: urlTool.name, arguments: { url: probe.url } }),
          text,
          probe.analysis,
        ),
      );
    }
  }

  return { results, findings };
}
