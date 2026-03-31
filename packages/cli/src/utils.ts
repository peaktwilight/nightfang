import { gzipSync } from "zlib";
import chalk from "chalk";
import type { ScanReport, AuditReport, ReviewReport, ScanDepth, RuntimeMode } from "@pwnkit/shared";

export interface RuntimeAvailability {
  hasApiKey: boolean;
  availableRuntimes: string[];
}

export async function getRuntimeAvailability(): Promise<RuntimeAvailability> {
  const hasApiKey = !!(
    process.env.OPENROUTER_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY
  );

  const { detectAvailableRuntimes } = await import("@pwnkit/core");
  const availableRuntimes = [...(await detectAvailableRuntimes())];

  return { hasApiKey, availableRuntimes };
}

/**
 * Check if an API key or CLI runtime is available for AI analysis.
 * Prints a warning if not — the scan will still run but without AI.
 */
export async function checkRuntimeAvailability(runtime: RuntimeMode): Promise<void> {
  const availability = await getRuntimeAvailability();
  const { hasApiKey, availableRuntimes } = availability;

  if (hasApiKey) return;

  console.log("");
  if (runtime === "api") {
    console.log(chalk.yellow("  Warning: `--runtime api` needs an API key. AI analysis may be skipped."));
  } else if (availableRuntimes.length > 0) {
    console.log(chalk.cyan(`  Using local runtime(s): ${availableRuntimes.join(", ")}`));
  } else {
    console.log(chalk.yellow("  Warning: No API key or local agent runtime detected. AI analysis will be skipped."));
  }
  console.log(chalk.gray("  API keys: OPENROUTER_API_KEY, ANTHROPIC_API_KEY, OPENAI_API_KEY"));
  console.log("");
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
