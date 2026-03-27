import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

// ── Finding status pipeline: discovered → verified → scored → reported ──

export const findingStatuses = [
  "discovered",
  "verified",
  "scored",
  "reported",
  "false-positive",
] as const;
export type FindingStatusDB = (typeof findingStatuses)[number];

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
    score: integer("score"), // CVSS-like 0-100 score, set during "scored" stage
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
