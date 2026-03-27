import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { mkdirSync } from "node:fs";
import type { Finding, AttackResult, TargetInfo, ScanConfig } from "@nightfang/shared";
import type { DBScan, DBFinding, DBTarget, DBAttackResult } from "./schema.js";
import { SCHEMA_SQL } from "./schema.js";

const DEFAULT_DB_DIR = join(homedir(), ".nightfang");
const DEFAULT_DB_PATH = join(DEFAULT_DB_DIR, "nightfang.db");

export class NightfangDB {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const path = dbPath ?? DEFAULT_DB_PATH;
    if (!dbPath) {
      mkdirSync(DEFAULT_DB_DIR, { recursive: true });
    }
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(SCHEMA_SQL);
  }

  // ── Scans ──

  createScan(config: ScanConfig): string {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO scans (id, target, depth, runtime, mode, status, startedAt)
         VALUES (?, ?, ?, ?, ?, 'running', datetime('now'))`
      )
      .run(id, config.target, config.depth, config.runtime ?? "api", config.mode ?? "probe");
    return id;
  }

  completeScan(scanId: string, summary: Record<string, unknown>): void {
    const scan = this.db.prepare(`SELECT startedAt FROM scans WHERE id = ?`).get(scanId) as
      | { startedAt: string }
      | undefined;
    const durationMs = scan
      ? Date.now() - new Date(scan.startedAt + "Z").getTime()
      : 0;
    this.db
      .prepare(
        `UPDATE scans SET status = 'completed', completedAt = datetime('now'),
         durationMs = ?, summary = ? WHERE id = ?`
      )
      .run(durationMs, JSON.stringify(summary), scanId);
  }

  failScan(scanId: string, error: string): void {
    this.db
      .prepare(
        `UPDATE scans SET status = 'failed', completedAt = datetime('now'),
         summary = ? WHERE id = ?`
      )
      .run(JSON.stringify({ error }), scanId);
  }

  getScan(scanId: string): DBScan | undefined {
    return this.db.prepare(`SELECT * FROM scans WHERE id = ?`).get(scanId) as DBScan | undefined;
  }

  listScans(limit = 20): DBScan[] {
    return this.db
      .prepare(`SELECT * FROM scans ORDER BY startedAt DESC LIMIT ?`)
      .all(limit) as DBScan[];
  }

  // ── Targets ──

  upsertTarget(info: TargetInfo): string {
    const existing = this.db
      .prepare(`SELECT id FROM targets WHERE url = ?`)
      .get(info.url) as { id: string } | undefined;

    if (existing) {
      this.db
        .prepare(
          `UPDATE targets SET type = ?, model = ?, systemPrompt = ?,
           detectedFeatures = ?, endpoints = ?, lastSeenAt = datetime('now')
           WHERE id = ?`
        )
        .run(
          info.type,
          info.model ?? null,
          info.systemPrompt ?? null,
          info.detectedFeatures ? JSON.stringify(info.detectedFeatures) : null,
          info.endpoints ? JSON.stringify(info.endpoints) : null,
          existing.id
        );
      return existing.id;
    }

    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO targets (id, url, type, model, systemPrompt, detectedFeatures, endpoints)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        info.url,
        info.type,
        info.model ?? null,
        info.systemPrompt ?? null,
        info.detectedFeatures ? JSON.stringify(info.detectedFeatures) : null,
        info.endpoints ? JSON.stringify(info.endpoints) : null
      );
    return id;
  }

  getTarget(url: string): DBTarget | undefined {
    return this.db.prepare(`SELECT * FROM targets WHERE url = ?`).get(url) as DBTarget | undefined;
  }

  // ── Findings ──

  saveFinding(scanId: string, finding: Finding): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO findings
         (id, scanId, templateId, title, description, severity, category, status,
          evidenceRequest, evidenceResponse, evidenceAnalysis, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        finding.id,
        scanId,
        finding.templateId,
        finding.title,
        finding.description,
        finding.severity,
        finding.category,
        finding.status,
        finding.evidence.request,
        finding.evidence.response,
        finding.evidence.analysis ?? null,
        finding.timestamp
      );
  }

  getFindings(scanId: string): DBFinding[] {
    return this.db
      .prepare(`SELECT * FROM findings WHERE scanId = ? ORDER BY severity, timestamp`)
      .all(scanId) as DBFinding[];
  }

  queryFindings(opts?: {
    scanId?: string;
    severity?: string;
    category?: string;
    status?: string;
    limit?: number;
  }): DBFinding[] {
    const clauses: string[] = [];
    const params: unknown[] = [];

    if (opts?.scanId) {
      clauses.push("scanId = ?");
      params.push(opts.scanId);
    }
    if (opts?.severity) {
      clauses.push("severity = ?");
      params.push(opts.severity);
    }
    if (opts?.category) {
      clauses.push("category = ?");
      params.push(opts.category);
    }
    if (opts?.status) {
      clauses.push("status = ?");
      params.push(opts.status);
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = opts?.limit ?? 100;
    params.push(limit);

    return this.db
      .prepare(`SELECT * FROM findings ${where} ORDER BY timestamp DESC LIMIT ?`)
      .all(...params) as DBFinding[];
  }

  updateFindingStatus(findingId: string, status: string): void {
    this.db.prepare(`UPDATE findings SET status = ? WHERE id = ?`).run(status, findingId);
  }

  // ── Attack Results ──

  saveAttackResult(scanId: string, result: AttackResult): void {
    const id = randomUUID();
    this.db
      .prepare(
        `INSERT INTO attack_results
         (id, scanId, templateId, payloadId, outcome, request, response, latencyMs, timestamp, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        scanId,
        result.templateId,
        result.payloadId,
        result.outcome,
        result.request,
        result.response,
        result.latencyMs,
        result.timestamp,
        result.error ?? null
      );
  }

  getAttackResults(scanId: string): DBAttackResult[] {
    return this.db
      .prepare(`SELECT * FROM attack_results WHERE scanId = ? ORDER BY timestamp`)
      .all(scanId) as DBAttackResult[];
  }

  // ── Utilities ──

  close(): void {
    this.db.close();
  }

  /** Run inside a transaction for batch operations */
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
