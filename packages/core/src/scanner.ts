import type { ScanConfig, ScanContext, ScanReport } from "@nightfang/shared";
import { loadTemplates } from "@nightfang/templates";
import { createScanContext, finalize } from "./context.js";
import { createRuntime } from "./runtime/index.js";
import { runDiscovery } from "./stages/discovery.js";
import { runAttacks } from "./stages/attack.js";
import { runVerification } from "./stages/verify.js";
import { generateReport } from "./stages/report.js";

export type ScanEventType =
  | "stage:start"
  | "stage:end"
  | "attack:start"
  | "attack:end"
  | "finding"
  | "error";

export interface ScanEvent {
  type: ScanEventType;
  stage?: string;
  message: string;
  data?: unknown;
}

export type ScanListener = (event: ScanEvent) => void;

export async function scan(
  config: ScanConfig,
  onEvent?: ScanListener
): Promise<ScanReport> {
  const emit = onEvent ?? (() => {});
  const ctx: ScanContext = createScanContext(config);

  // Create runtime based on config
  const runtime = createRuntime({
    type: config.runtime ?? "api",
    timeout: config.timeout ?? 30_000,
  });

  // Stage 1: Discovery
  emit({ type: "stage:start", stage: "discovery", message: "Probing target..." });
  const discovery = await runDiscovery(ctx);
  emit({
    type: "stage:end",
    stage: "discovery",
    message: discovery.success
      ? `Target identified as ${ctx.target.type} (${discovery.durationMs}ms)`
      : `Discovery failed: ${discovery.error}`,
    data: discovery,
  });

  // Stage 2: Attack
  const templates = loadTemplates(config.depth);
  emit({
    type: "stage:start",
    stage: "attack",
    message: `Running ${templates.length} templates...`,
  });

  const attackResult = await runAttacks(ctx, templates, runtime);
  emit({
    type: "stage:end",
    stage: "attack",
    message: `Executed ${attackResult.data.payloadsRun} payloads across ${attackResult.data.templatesRun} templates (${attackResult.durationMs}ms)`,
    data: attackResult,
  });

  // Stage 3: Verify
  emit({ type: "stage:start", stage: "verify", message: "Verifying findings..." });
  const verifyResult = await runVerification(ctx);
  emit({
    type: "stage:end",
    stage: "verify",
    message: `${verifyResult.data.confirmed} confirmed, ${verifyResult.data.findings.length} total findings (${verifyResult.durationMs}ms)`,
    data: verifyResult,
  });

  // Emit individual findings
  for (const finding of verifyResult.data.findings) {
    emit({
      type: "finding",
      message: `[${finding.severity.toUpperCase()}] ${finding.title}`,
      data: finding,
    });
  }

  // Stage 4: Report
  emit({ type: "stage:start", stage: "report", message: "Generating report..." });
  finalize(ctx);
  const reportResult = await generateReport(ctx);
  emit({
    type: "stage:end",
    stage: "report",
    message: `Report generated (${reportResult.durationMs}ms)`,
    data: reportResult,
  });

  return reportResult.data;
}
