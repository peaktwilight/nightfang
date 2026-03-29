import chalk from "chalk";
import { VERSION } from "@pwnkit/shared";
import type { ScanDepth, OutputFormat, RuntimeMode } from "@pwnkit/shared";
import { runPipeline, createRuntime } from "@pwnkit/core";
import { formatAuditReport, formatReviewReport, formatReport } from "../formatters/index.js";
import { buildShareUrl, checkRuntimeAvailability } from "../utils.js";

export interface RunOptions {
  target: string;
  targetType?: "npm-package" | "source-code" | "url" | "web-app";
  depth: ScanDepth;
  format: OutputFormat;
  runtime: RuntimeMode;
  timeout: number;
  verbose: boolean;
  dbPath?: string;
  apiKey?: string;
  model?: string;
  packageVersion?: string;
}

export async function runUnified(opts: RunOptions): Promise<void> {
  const { target, depth, format, runtime, timeout } = opts;

  const validRuntimes = ["api", "claude", "codex", "gemini", "auto"];
  if (!validRuntimes.includes(runtime)) {
    console.error(chalk.red(`Unknown runtime '${runtime}'. Valid: ${validRuntimes.join(", ")}`));
    process.exit(2);
  }

  // Check non-auto runtime availability
  if (runtime !== "api" && runtime !== "auto") {
    const rt = createRuntime({ type: runtime, timeout });
    const available = await rt.isAvailable();
    if (!available) {
      console.error(chalk.red(`Runtime '${runtime}' not available. Is ${runtime} installed?`));
      process.exit(2);
    }
  }

  if (format === "terminal") checkRuntimeAvailability();

  // Ink TUI for terminal, silent for json/md
  let inkUI: { onEvent: (event: any) => void; setReport: (report: any) => void; waitForExit: () => Promise<void> } | null = null;
  let eventHandler: (event: any) => void = () => {};

  if (format === "terminal") {
    const { renderScanUI } = await import("../ui/renderScan.js");
    const mode = opts.targetType === "npm-package" ? "audit"
      : opts.targetType === "source-code" ? "review"
      : "scan";
    inkUI = renderScanUI({ version: VERSION, target, depth, mode });
    eventHandler = inkUI.onEvent;
  }

  try {
    const report = await runPipeline({
      target,
      targetType: opts.targetType,
      depth,
      format,
      runtime,
      onEvent: eventHandler,
      dbPath: opts.dbPath,
      apiKey: opts.apiKey,
      model: opts.model,
      timeout,
      packageVersion: opts.packageVersion,
    });

    if (inkUI) {
      inkUI.setReport(report as any);
      await inkUI.waitForExit();
    } else {
      const reportAny = report as any;
      const output = reportAny.targetType === "npm-package"
        ? formatAuditReport(reportAny, format)
        : reportAny.targetType === "source-code"
          ? formatReviewReport(reportAny, format)
          : formatReport(reportAny, format);
      console.log(output);
    }

    if (report.summary.critical > 0 || report.summary.high > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(2);
  }
}
