// ── Scan Configuration ──

export type ScanDepth = "quick" | "default" | "deep";
export type OutputFormat = "terminal" | "json" | "markdown";
export type RuntimeMode = "api" | "claude" | "codex" | "gemini" | "opencode" | "auto";
export type ScanMode = "probe" | "deep" | "mcp";

export interface ScanConfig {
  target: string;
  depth: ScanDepth;
  format: OutputFormat;
  runtime?: RuntimeMode;
  mode?: ScanMode;
  repoPath?: string;
  apiKey?: string;
  model?: string;
  templateFilter?: string[];
  maxConcurrency?: number;
  timeout?: number;
  verbose?: boolean;
}

// ── Attack Templates ──

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type AttackCategory =
  | "prompt-injection"
  | "jailbreak"
  | "system-prompt-extraction"
  | "data-exfiltration"
  | "tool-misuse"
  | "output-manipulation"
  | "encoding-bypass"
  | "multi-turn"
  // Source-code audit categories (nightfang audit)
  | "prototype-pollution"
  | "path-traversal"
  | "command-injection"
  | "code-injection"
  | "regex-dos"
  | "unsafe-deserialization"
  | "information-disclosure"
  | "ssrf"
  | "sql-injection"
  | "xss";

export interface AttackTemplate {
  id: string;
  name: string;
  category: AttackCategory;
  description: string;
  severity: Severity;
  owaspLlmTop10?: string;
  depth: ScanDepth[];
  payloads: AttackPayload[];
  detection: DetectionRules;
  metadata?: Record<string, unknown>;
}

export interface AttackPayload {
  id: string;
  prompt: string;
  systemContext?: string;
  multiTurn?: string[];
  description?: string;
}

export interface DetectionRules {
  vulnerablePatterns: string[];
  safePatterns?: string[];
  customCheck?: string;
}

// ── Scan Context (shared agent memory) ──

export interface ScanContext {
  config: ScanConfig;
  target: TargetInfo;
  findings: Finding[];
  attacks: AttackResult[];
  startedAt: number;
  completedAt?: number;
}

export interface TargetInfo {
  url: string;
  type: "api" | "chatbot" | "agent" | "unknown";
  endpoints?: string[];
  systemPrompt?: string;
  model?: string;
  detectedFeatures?: string[];
}

// ── Findings ──

export type FindingStatus = "discovered" | "confirmed" | "false-positive";

export interface Finding {
  id: string;
  templateId: string;
  title: string;
  description: string;
  severity: Severity;
  category: AttackCategory;
  status: FindingStatus;
  evidence: Evidence;
  timestamp: number;
}

export interface Evidence {
  request: string;
  response: string;
  analysis?: string;
}

// ── Attack Results ──

export type AttackOutcome = "vulnerable" | "safe" | "error" | "inconclusive";

export interface AttackResult {
  templateId: string;
  payloadId: string;
  outcome: AttackOutcome;
  request: string;
  response: string;
  latencyMs: number;
  timestamp: number;
  error?: string;
}

// ── Pipeline Stages ──

export type PipelineStage = "discovery" | "source-analysis" | "attack" | "verify" | "report";

export interface StageResult<T = unknown> {
  stage: PipelineStage;
  success: boolean;
  data: T;
  durationMs: number;
  error?: string;
}

// ── Report ──

export interface ScanReport {
  target: string;
  scanDepth: ScanDepth;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: ReportSummary;
  findings: Finding[];
}

export interface ReportSummary {
  totalAttacks: number;
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
}

// ── Package Audit (nightfang audit) ──

export interface AuditConfig {
  package: string;
  version?: string;
  depth: ScanDepth;
  format: OutputFormat;
  runtime?: RuntimeMode;
  timeout?: number;
  verbose?: boolean;
  dbPath?: string;
}

export interface SemgrepFinding {
  ruleId: string;
  message: string;
  severity: string;
  path: string;
  startLine: number;
  endLine: number;
  snippet: string;
  metadata?: Record<string, unknown>;
}

export interface NpmAuditFinding {
  name: string;
  severity: Severity;
  title: string;
  range?: string;
  source?: number | string;
  url?: string;
  via: string[];
  fixAvailable: boolean | string;
}

export interface AuditReport {
  package: string;
  version: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  semgrepFindings: number;
  npmAuditFindings: NpmAuditFinding[];
  summary: ReportSummary;
  findings: Finding[];
}

// ── Source Code Review (nightfang review) ──

export interface ReviewConfig {
  repo: string;
  depth: ScanDepth;
  format: OutputFormat;
  runtime?: RuntimeMode;
  timeout?: number;
  verbose?: boolean;
  dbPath?: string;
}

export interface ReviewReport {
  repo: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  semgrepFindings: number;
  summary: ReportSummary;
  findings: Finding[];
}
