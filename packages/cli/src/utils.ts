import { gzipSync } from "zlib";
import chalk from "chalk";
import type { ScanReport, AuditReport, ReviewReport, ScanDepth } from "@pwnkit/shared";

/**
 * Check if an API key or CLI runtime is available for AI analysis.
 * Prints a warning if not — the scan will still run but without AI.
 */
export function checkRuntimeAvailability(): void {
  const hasApiKey = !!(
    process.env.OPENROUTER_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  if (!hasApiKey) {
    console.log("");
    console.log(chalk.yellow("  Warning: No API key set. AI agent analysis will be skipped."));
    console.log(chalk.gray("  Set one of:"));
    console.log(chalk.gray("    export OPENROUTER_API_KEY=sk-or-..."));
    console.log(chalk.gray("    export ANTHROPIC_API_KEY=sk-ant-..."));
    console.log(chalk.gray("    export OPENAI_API_KEY=sk-..."));
    console.log("");
  }
}

/**
 * Encode a report as a base64url-encoded gzipped JSON string for use in a share URL.
 */
export function buildShareUrl(report: ScanReport | AuditReport | ReviewReport): string {
  const json = JSON.stringify(report);
  const compressed = gzipSync(Buffer.from(json, "utf-8"));
  const b64 = compressed.toString("base64url");
  return `https://pwnkit.com/r#${b64}`;
}

export function depthLabel(depth: ScanDepth): string {
  switch (depth) {
    case "quick":
      return "~5 probes";
    case "default":
      return "~50 probes";
    case "deep":
      return "full coverage";
  }
}
