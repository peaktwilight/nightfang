import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, desc, and, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import type { Finding, AttackResult, TargetInfo, ScanConfig } from "@nightfang/shared";
import * as schema from "./schema.js";
import { findingStatuses, type FindingStatusDB } from "./schema.js";

const DEFAULT_DB_DIR = join(homedir(), ".nightfang");
const DEFAULT_DB_PATH = join(DEFAULT_DB_DIR, "nightfang.db");

export class NightfangDB {
  private sqlite: Database.Database;
  private db: ReturnType<typeof drizzle>;

  constructor(dbPath?: string) {
    const path = dbPath ?? DEFAULT_DB_PATH;
    if (!dbPath) {
      mkdirSync(DEFAULT_DB_DIR, { recursive: true });
    }
    this.sqlite = new Database(path);
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.pragma("foreign_keys = ON");
    this.db = drizzle(this.sqlite, { schema });

    // Auto-create tables (idempotent)
    this.sqlite.exec(SCHEMA_SQL);

    // Migrations — add columns that may not exist in older DBs
    this.migrate();
  }

  private migrate(): void {
    // Add score column to findings if it doesn't exist (v0.1 → v0.2)
    const cols = this.sqlite
      .prepare("PRAGMA table_info(findings)")
      .all() as { name: string }[];
    if (!cols.some((c) => c.name === "score")) {
      this.sqlite.exec("ALTER TABLE findings ADD COLUMN score INTEGER");
    }
  }

  // ── Scans ──

  createScan(config: ScanConfig): string {
    const id = randomUUID();
    this.db.insert(schema.scans).values({
      id,
      target: config.target,
      depth: config.depth,
      runtime: config.runtime ?? "api",
      mode: config.mode ?? "probe",
      status: "running",
      startedAt: new Date().toISOString(),
    }).run();
    return id;
  }

  completeScan(scanId: string, summary: Record<string, unknown>): void {
    const scan = this.db
      .select({ startedAt: schema.scans.startedAt })
      .from(schema.scans)
      .where(eq(schema.scans.id, scanId))
      .get();
    const durationMs = scan
      ? Date.now() - new Date(scan.startedAt).getTime()
      : 0;
    this.db
      .update(schema.scans)
      .set({
        status: "completed",
        completedAt: new Date().toISOString(),
        durationMs,
        summary: JSON.stringify(summary),
      })
      .where(eq(schema.scans.id, scanId))
      .run();
  }

  failScan(scanId: string, error: string): void {
    this.db
      .update(schema.scans)
      .set({
        status: "failed",
        completedAt: new Date().toISOString(),
        summary: JSON.stringify({ error }),
      })
      .where(eq(schema.scans.id, scanId))
      .run();
  }

  getScan(scanId: string) {
    return this.db
      .select()
      .from(schema.scans)
      .where(eq(schema.scans.id, scanId))
      .get();
  }

  listScans(limit = 20) {
    return this.db
      .select()
      .from(schema.scans)
      .orderBy(desc(schema.scans.startedAt))
      .limit(limit)
      .all();
  }

  // ── Targets ──

  upsertTarget(info: TargetInfo): string {
    const existing = this.db
      .select({ id: schema.targets.id })
      .from(schema.targets)
      .where(eq(schema.targets.url, info.url))
      .get();

    if (existing) {
      this.db
        .update(schema.targets)
        .set({
          type: info.type,
          model: info.model ?? null,
          systemPrompt: info.systemPrompt ?? null,
          detectedFeatures: info.detectedFeatures
            ? JSON.stringify(info.detectedFeatures)
            : null,
          endpoints: info.endpoints ? JSON.stringify(info.endpoints) : null,
          lastSeenAt: new Date().toISOString(),
        })
        .where(eq(schema.targets.id, existing.id))
        .run();
      return existing.id;
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    this.db.insert(schema.targets).values({
      id,
      url: info.url,
      type: info.type,
      model: info.model ?? null,
      systemPrompt: info.systemPrompt ?? null,
      detectedFeatures: info.detectedFeatures
        ? JSON.stringify(info.detectedFeatures)
        : null,
      endpoints: info.endpoints ? JSON.stringify(info.endpoints) : null,
      firstSeenAt: now,
      lastSeenAt: now,
    }).run();
    return id;
  }

  getTarget(url: string) {
    return this.db
      .select()
      .from(schema.targets)
      .where(eq(schema.targets.url, url))
      .get();
  }

  // ── Findings ──

  saveFinding(scanId: string, finding: Finding): void {
    this.db
      .insert(schema.findings)
      .values({
        id: finding.id,
        scanId,
        templateId: finding.templateId,
        title: finding.title,
        description: finding.description,
        severity: finding.severity,
        category: finding.category,
        status: finding.status,
        evidenceRequest: finding.evidence.request,
        evidenceResponse: finding.evidence.response,
        evidenceAnalysis: finding.evidence.analysis ?? null,
        timestamp: finding.timestamp,
      })
      .onConflictDoUpdate({
        target: schema.findings.id,
        set: {
          status: finding.status,
          evidenceRequest: finding.evidence.request,
          evidenceResponse: finding.evidence.response,
          evidenceAnalysis: finding.evidence.analysis ?? null,
        },
      })
      .run();
  }

  getFinding(findingId: string) {
    return this.db
      .select()
      .from(schema.findings)
      .where(eq(schema.findings.id, findingId))
      .get();
  }

  getFindings(scanId: string) {
    return this.db
      .select()
      .from(schema.findings)
      .where(eq(schema.findings.scanId, scanId))
      .orderBy(schema.findings.severity, schema.findings.timestamp)
      .all();
  }

  listFindings(opts?: {
    scanId?: string;
    severity?: string;
    category?: string;
    status?: string;
    limit?: number;
  }) {
    const conditions = [];
    if (opts?.scanId) conditions.push(eq(schema.findings.scanId, opts.scanId));
    if (opts?.severity) conditions.push(eq(schema.findings.severity, opts.severity));
    if (opts?.category) conditions.push(eq(schema.findings.category, opts.category));
    if (opts?.status) conditions.push(eq(schema.findings.status, opts.status));

    const query = this.db
      .select()
      .from(schema.findings)
      .orderBy(desc(schema.findings.timestamp))
      .limit(opts?.limit ?? 100);

    if (conditions.length > 0) {
      return query.where(and(...conditions)).all();
    }
    return query.all();
  }

  /** Alias for listFindings — backward compat with core agent tools */
  queryFindings(opts?: {
    scanId?: string;
    severity?: string;
    category?: string;
    status?: string;
    limit?: number;
  }) {
    return this.listFindings(opts);
  }

  updateFindingStatus(findingId: string, status: string): void {
    this.db
      .update(schema.findings)
      .set({ status })
      .where(eq(schema.findings.id, findingId))
      .run();
  }

  // ── Status Pipeline: discovered → verified → scored → reported ──

  transitionFindingStatus(findingId: string, newStatus: FindingStatusDB): void {
    const finding = this.getFinding(findingId);
    if (!finding) throw new Error(`Finding ${findingId} not found`);

    const currentIdx = findingStatuses.indexOf(finding.status as FindingStatusDB);
    const newIdx = findingStatuses.indexOf(newStatus);

    // Allow "false-positive" from any state; otherwise enforce forward-only pipeline
    if (newStatus !== "false-positive" && newIdx <= currentIdx) {
      throw new Error(
        `Cannot transition from '${finding.status}' to '${newStatus}'. ` +
        `Pipeline: ${findingStatuses.join(" → ")}`
      );
    }

    this.db
      .update(schema.findings)
      .set({ status: newStatus })
      .where(eq(schema.findings.id, findingId))
      .run();
  }

  scoreFinding(findingId: string, score: number): void {
    if (score < 0 || score > 100) throw new Error("Score must be 0-100");
    this.db
      .update(schema.findings)
      .set({ score, status: "scored" })
      .where(eq(schema.findings.id, findingId))
      .run();
  }

  // ── Attack Results ──

  saveAttackResult(scanId: string, result: AttackResult): void {
    const id = randomUUID();
    this.db.insert(schema.attackResults).values({
      id,
      scanId,
      templateId: result.templateId,
      payloadId: result.payloadId,
      outcome: result.outcome,
      request: result.request,
      response: result.response,
      latencyMs: result.latencyMs,
      timestamp: result.timestamp,
      error: result.error ?? null,
    }).run();
  }

  getAttackResults(scanId: string) {
    return this.db
      .select()
      .from(schema.attackResults)
      .where(eq(schema.attackResults.scanId, scanId))
      .orderBy(schema.attackResults.timestamp)
      .all();
  }

  // ── Utilities ──

  close(): void {
    this.sqlite.close();
  }

  transaction<T>(fn: () => T): T {
    return this.sqlite.transaction(fn)();
  }

  /** Get summary stats across all findings */
  getStats() {
    const rows = this.sqlite
      .prepare(
        `SELECT severity, COUNT(*) as count FROM findings GROUP BY severity`
      )
      .all() as { severity: string; count: number }[];
    const stats: Record<string, number> = {};
    for (const row of rows) stats[row.severity] = row.count;
    return {
      total: rows.reduce((sum, r) => sum + r.count, 0),
      critical: stats["critical"] ?? 0,
      high: stats["high"] ?? 0,
      medium: stats["medium"] ?? 0,
      low: stats["low"] ?? 0,
      info: stats["info"] ?? 0,
    };
  }
}

// ── Raw SQL for table creation (idempotent, used on init) ──

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS scans (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  depth TEXT NOT NULL,
  runtime TEXT NOT NULL DEFAULT 'api',
  mode TEXT NOT NULL DEFAULT 'probe',
  status TEXT NOT NULL DEFAULT 'running',
  startedAt TEXT NOT NULL,
  completedAt TEXT,
  durationMs INTEGER,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS targets (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'unknown',
  model TEXT,
  systemPrompt TEXT,
  detectedFeatures TEXT,
  endpoints TEXT,
  firstSeenAt TEXT NOT NULL,
  lastSeenAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  scanId TEXT NOT NULL REFERENCES scans(id),
  templateId TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'discovered',
  score INTEGER,
  evidenceRequest TEXT NOT NULL,
  evidenceResponse TEXT NOT NULL,
  evidenceAnalysis TEXT,
  timestamp INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS attack_results (
  id TEXT PRIMARY KEY,
  scanId TEXT NOT NULL REFERENCES scans(id),
  templateId TEXT NOT NULL,
  payloadId TEXT NOT NULL,
  outcome TEXT NOT NULL,
  request TEXT NOT NULL,
  response TEXT NOT NULL,
  latencyMs INTEGER NOT NULL,
  timestamp INTEGER NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_findings_scanId ON findings(scanId);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);
CREATE INDEX IF NOT EXISTS idx_findings_category ON findings(category);
CREATE INDEX IF NOT EXISTS idx_findings_status ON findings(status);
CREATE INDEX IF NOT EXISTS idx_attack_results_scanId ON attack_results(scanId);
CREATE INDEX IF NOT EXISTS idx_targets_url ON targets(url);
`;
