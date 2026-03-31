import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core";

// ── Finding status pipeline: discovered → verified → confirmed → scored → reported ──

export const findingStatuses = [
  "discovered",
  "verified",
  "confirmed",
  "scored",
  "reported",
  "false-positive",
] as const;
export type FindingStatusDB = (typeof findingStatuses)[number];

export const findingTriageStatuses = ["new", "accepted", "suppressed"] as const;
export type FindingTriageStatusDB = (typeof findingTriageStatuses)[number];

// ── Tables ──

export const scans = sqliteTable("scans", {
  id: text("id").primaryKey(),
  target: text("target").notNull(),
  depth: text("depth").notNull(),
  runtime: text("runtime").notNull().default("api"),
  mode: text("mode").notNull().default("probe"),
  status: text("status").notNull().default("running"),
  startedAt: text("startedAt").notNull(),
  completedAt: text("completedAt"),
  durationMs: integer("durationMs"),
  summary: text("summary"), // JSON-encoded ReportSummary
});

export const targets = sqliteTable(
  "targets",
  {
    id: text("id").primaryKey(),
    url: text("url").notNull().unique(),
    type: text("type").notNull().default("unknown"),
    model: text("model"),
    systemPrompt: text("systemPrompt"),
    detectedFeatures: text("detectedFeatures"), // JSON array
    endpoints: text("endpoints"), // JSON array
    firstSeenAt: text("firstSeenAt").notNull(),
    lastSeenAt: text("lastSeenAt").notNull(),
  },
  (table) => [index("idx_targets_url").on(table.url)]
);

export const findings = sqliteTable(
  "findings",
  {
    id: text("id").primaryKey(),
    scanId: text("scanId")
      .notNull()
      .references(() => scans.id),
    templateId: text("templateId").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull(),
    category: text("category").notNull(),
    status: text("status").notNull().default("discovered"),
    fingerprint: text("fingerprint"),
    triageStatus: text("triageStatus").notNull().default("new"),
    triageNote: text("triageNote"),
    triagedAt: text("triagedAt"),
    score: integer("score"), // CVSS-like 0-100 score, set during "scored" stage
    confidence: real("confidence"), // 0.0-1.0 agent-assessed confidence
    cvssVector: text("cvssVector"), // CVSS vector string
    cvssScore: real("cvssScore"), // CVSS numeric score (0-10)
    evidenceRequest: text("evidenceRequest").notNull(),
    evidenceResponse: text("evidenceResponse").notNull(),
    evidenceAnalysis: text("evidenceAnalysis"),
    timestamp: integer("timestamp").notNull(),
  },
  (table) => [
    index("idx_findings_scanId").on(table.scanId),
    index("idx_findings_severity").on(table.severity),
    index("idx_findings_category").on(table.category),
    index("idx_findings_status").on(table.status),
    index("idx_findings_fingerprint").on(table.fingerprint),
    index("idx_findings_triageStatus").on(table.triageStatus),
  ]
);

export const attackResults = sqliteTable(
  "attack_results",
  {
    id: text("id").primaryKey(),
    scanId: text("scanId")
      .notNull()
      .references(() => scans.id),
    templateId: text("templateId").notNull(),
    payloadId: text("payloadId").notNull(),
    outcome: text("outcome").notNull(),
    request: text("request").notNull(),
    response: text("response").notNull(),
    latencyMs: integer("latencyMs").notNull(),
    timestamp: integer("timestamp").notNull(),
    error: text("error"),
  },
  (table) => [index("idx_attack_results_scanId").on(table.scanId)]
);

// ── Verdicts (multi-agent consensus on findings) ──

export const verdicts = sqliteTable(
  "verdicts",
  {
    id: text("id").primaryKey(),
    findingId: text("findingId")
      .notNull()
      .references(() => findings.id),
    agentRole: text("agentRole").notNull(),
    model: text("model").notNull().default(""),
    verdict: text("verdict").notNull(), // TRUE_POSITIVE | FALSE_POSITIVE | UNSURE
    confidence: real("confidence").notNull().default(0),
    reasoning: text("reasoning").notNull().default(""),
    timestamp: integer("timestamp").notNull(),
  },
  (table) => [index("idx_verdicts_findingId").on(table.findingId)]
);

// ── Pipeline Events (immutable audit trail) ──

export const pipelineEvents = sqliteTable(
  "pipeline_events",
  {
    id: text("id").primaryKey(),
    scanId: text("scanId")
      .notNull()
      .references(() => scans.id),
    stage: text("stage").notNull(),
    eventType: text("eventType").notNull(),
    findingId: text("findingId"),
    agentRole: text("agentRole"),
    payload: text("payload").notNull().default("{}"), // JSON
    timestamp: integer("timestamp").notNull(),
  },
  (table) => [
    index("idx_events_scanId").on(table.scanId),
    index("idx_events_stage").on(table.stage),
    index("idx_events_findingId").on(table.findingId),
  ]
);

// ── Agent Sessions (resumable agent state) ──

export const agentSessions = sqliteTable(
  "agent_sessions",
  {
    id: text("id").primaryKey(),
    scanId: text("scanId")
      .notNull()
      .references(() => scans.id),
    agentRole: text("agentRole").notNull(),
    turnCount: integer("turnCount").notNull().default(0),
    messages: text("messages").notNull().default("[]"), // JSON serialized conversation
    toolContext: text("toolContext").notNull().default("{}"), // JSON serialized context
    status: text("status").notNull().default("running"), // running | paused | completed | failed
    createdAt: text("createdAt").notNull(),
    updatedAt: text("updatedAt").notNull(),
  },
  (table) => [
    index("idx_sessions_scanId").on(table.scanId),
    index("idx_sessions_role").on(table.agentRole),
  ]
);
