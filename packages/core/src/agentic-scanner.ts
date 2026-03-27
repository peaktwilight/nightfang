import type { ScanConfig, ScanReport, Finding } from "@nightfang/shared";
import { loadTemplates } from "@nightfang/templates";
import { createRuntime } from "./runtime/index.js";
import { NightfangDB } from "./db/database.js";
import { runAgentLoop } from "./agent/loop.js";
import { getToolsForRole } from "./agent/tools.js";
import {
  discoveryPrompt,
  attackPrompt,
  verifyPrompt,
  reportPrompt,
} from "./agent/prompts.js";
import type { ScanEvent, ScanListener } from "./scanner.js";

export interface AgenticScanOptions {
  config: ScanConfig;
  dbPath?: string;
  onEvent?: ScanListener;
}

/**
 * Run a full agentic scan with multi-turn agents, tool use, and persistent state.
 *
 * This is the "real" scan pipeline from GHO-16:
 * - Discovery Agent: probes target, maps endpoints, builds profile
 * - Attack Agent: runs attacks with adaptation and multi-turn escalation
 * - Verification Agent: replays and confirms findings
 * - Report Agent: generates summary
 *
 * All findings persist to SQLite between stages and across scans.
 */
export async function agenticScan(opts: AgenticScanOptions): Promise<ScanReport> {
  const { config, dbPath, onEvent } = opts;
  const emit = onEvent ?? (() => {});

  const db = new NightfangDB(dbPath);
  const scanId = db.createScan(config);

  const runtime = createRuntime({
    type: config.runtime ?? "api",
    timeout: config.timeout ?? 60_000,
  });

  const templates = loadTemplates(config.depth);
  const categories = [...new Set(templates.map((t) => t.category))];

  let allFindings: Finding[] = [];

  try {
    // ── Stage 1: Discovery Agent ──
    emit({ type: "stage:start", stage: "discovery", message: "Discovery agent starting..." });

    const discoveryState = await runAgentLoop({
      config: {
        role: "discovery",
        systemPrompt: discoveryPrompt(config.target),
        tools: getToolsForRole("discovery"),
        maxTurns: 8,
        target: config.target,
        scanId,
      },
      runtime,
      db,
      onTurn: (turn, msg) => {
        emit({
          type: "stage:end",
          stage: "discovery",
          message: `Discovery turn ${turn}: ${msg.content.slice(0, 100)}...`,
        });
      },
    });

    // Persist target profile
    if (discoveryState.targetInfo.type) {
      db.upsertTarget({
        url: config.target,
        type: discoveryState.targetInfo.type ?? "unknown",
        model: discoveryState.targetInfo.model,
        systemPrompt: discoveryState.targetInfo.systemPrompt,
        endpoints: discoveryState.targetInfo.endpoints,
        detectedFeatures: discoveryState.targetInfo.detectedFeatures,
      });
    }

    emit({
      type: "stage:end",
      stage: "discovery",
      message: `Discovery complete: ${discoveryState.summary}`,
    });

    // ── Stage 2: Attack Agent ──
    emit({
      type: "stage:start",
      stage: "attack",
      message: `Attack agent starting (${categories.length} categories)...`,
    });

    const attackState = await runAgentLoop({
      config: {
        role: "attack",
        systemPrompt: attackPrompt(config.target, discoveryState.targetInfo, categories),
        tools: getToolsForRole("attack"),
        maxTurns: config.depth === "deep" ? 20 : config.depth === "default" ? 12 : 6,
        target: config.target,
        scanId,
      },
      runtime,
      db,
      onTurn: (turn, msg) => {
        // Emit findings as they're discovered
        const calls = msg.toolCalls ?? [];
        for (const call of calls) {
          if (call.name === "save_finding") {
            emit({
              type: "finding",
              message: `[${call.arguments.severity}] ${call.arguments.title}`,
              data: call.arguments,
            });
          }
        }
      },
    });

    allFindings = [...attackState.findings];

    emit({
      type: "stage:end",
      stage: "attack",
      message: `Attack complete: ${attackState.findings.length} findings, ${attackState.summary}`,
    });

    // ── Stage 3: Verification Agent ──
    if (allFindings.length > 0) {
      emit({
        type: "stage:start",
        stage: "verify",
        message: `Verifying ${allFindings.length} findings...`,
      });

      const verifyState = await runAgentLoop({
        config: {
          role: "verify",
          systemPrompt: verifyPrompt(config.target, allFindings),
          tools: getToolsForRole("verify"),
          maxTurns: Math.min(allFindings.length * 3, 15),
          target: config.target,
          scanId,
        },
        runtime,
        db,
      });

      // Merge verification results — DB is source of truth
      const dbFindings = db.getFindings(scanId);
      allFindings = dbFindings.map((dbf) => ({
        id: dbf.id,
        templateId: dbf.templateId,
        title: dbf.title,
        description: dbf.description,
        severity: dbf.severity,
        category: dbf.category,
        status: dbf.status,
        evidence: {
          request: dbf.evidenceRequest,
          response: dbf.evidenceResponse,
          analysis: dbf.evidenceAnalysis ?? undefined,
        },
        timestamp: dbf.timestamp,
      }));

      emit({
        type: "stage:end",
        stage: "verify",
        message: `Verification complete: ${verifyState.summary}`,
      });
    }

    // ── Stage 4: Report ──
    emit({ type: "stage:start", stage: "report", message: "Generating report..." });

    const confirmed = allFindings.filter((f) => f.status === "confirmed").length;
    const summary = {
      totalAttacks: attackState.turnCount,
      totalFindings: allFindings.length,
      critical: allFindings.filter((f) => f.severity === "critical").length,
      high: allFindings.filter((f) => f.severity === "high").length,
      medium: allFindings.filter((f) => f.severity === "medium").length,
      low: allFindings.filter((f) => f.severity === "low").length,
      info: allFindings.filter((f) => f.severity === "info").length,
    };

    db.completeScan(scanId, summary);

    const report: ScanReport = {
      target: config.target,
      scanDepth: config.depth,
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      summary,
      findings: allFindings.filter((f) => f.status !== "false-positive"),
    };

    // Compute actual duration from DB
    const dbScan = db.getScan(scanId);
    if (dbScan) {
      report.startedAt = dbScan.startedAt;
      report.completedAt = dbScan.completedAt ?? report.completedAt;
      report.durationMs = dbScan.durationMs ?? 0;
    }

    emit({
      type: "stage:end",
      stage: "report",
      message: `Report: ${summary.totalFindings} findings (${confirmed} confirmed)`,
    });

    return report;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.failScan(scanId, msg);
    throw err;
  } finally {
    db.close();
  }
}
