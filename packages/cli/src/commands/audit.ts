import type { Command } from "commander";
import chalk from "chalk";
import { VERSION } from "@pwnkit/shared";
import type { ScanDepth, OutputFormat, RuntimeMode } from "@pwnkit/shared";
import { createRuntime, packageAudit } from "@pwnkit/core";
import { formatAuditReport } from "../formatters/index.js";
import { createpwnkitSpinner } from "../spinner.js";
import { createEventHandler } from "../event-handler.js";
import { buildShareUrl, checkRuntimeAvailability } from "../utils.js";

export function registerAuditCommand(program: Command): void {
  program
    .command("audit")
    .description("Audit an npm package for security vulnerabilities")
    .argument("<package>", "npm package name (e.g. lodash, express)")
    .option("--version <version>", "Specific version to audit (default: latest)")
    .option("--depth <depth>", "Audit depth: quick, default, deep", "default")
    .option("--format <format>", "Output format: terminal, json, md", "terminal")
    .option("--runtime <runtime>", "Runtime: auto, claude, codex, gemini, opencode, api", "auto")
    .option("--db-path <path>", "Path to SQLite database")
    .option("--api-key <key>", "API key for LLM provider (or set OPENROUTER_API_KEY / ANTHROPIC_API_KEY / OPENAI_API_KEY)")
    .option("--model <model>", "LLM model to use (or set PWNKIT_MODEL)")
    .option("--verbose", "Show detailed output", false)
    .option("--timeout <ms>", "AI agent timeout in milliseconds", "600000")
    .action(async (packageName: string, opts: Record<string, string | boolean>) => {
      const depth = (opts.depth as ScanDepth) ?? "default";
      const format = (opts.format === "md" ? "markdown" : opts.format) as OutputFormat;
      const runtime = opts.runtime as RuntimeMode;
      const verbose = opts.verbose as boolean;

      const validRuntimes = ["api", "claude", "codex", "gemini", "opencode", "auto"];
      if (!validRuntimes.includes(runtime)) {
        console.error(
          chalk.red(`Unknown runtime '${runtime}'. Valid: ${validRuntimes.join(", ")}`)
        );
        process.exit(2);
      }

      if (runtime !== "api" && runtime !== "auto") {
        const rt = createRuntime({
          type: runtime,
          timeout: parseInt(opts.timeout as string, 10),
        });
        const available = await rt.isAvailable();
        if (!available) {
          console.error(
            chalk.red(
              `Runtime '${runtime}' not available. Is ${runtime} installed?`
            )
          );
          process.exit(2);
        }
      }

      // ── Banner ──
      if (format === "terminal") {
        console.log("");
        console.log(
          chalk.red.bold("  \u25C6 pwnkit audit") + chalk.gray(` v${VERSION}`)
        );
        console.log("");
        console.log(
          `  ${chalk.gray("Package:")} ${chalk.white.bold(packageName)}${opts.version ? chalk.gray(`@${opts.version}`) : ""}`
        );
        console.log(
          `  ${chalk.gray("Depth:")}   ${chalk.white(depth)}`
        );
        if (runtime !== "api") {
          console.log(
            `  ${chalk.gray("Runtime:")} ${chalk.white(runtime)}`
          );
        }
        console.log("");
      }

      if (format === "terminal") checkRuntimeAvailability();

      const spinner = format === "terminal" ? createpwnkitSpinner("Initializing audit...") : null;

      const eventHandler = createEventHandler({ format, spinner });

      try {
        const report = await packageAudit({
          config: {
            package: packageName,
            version: opts.version as string | undefined,
            depth,
            format,
            runtime,
            timeout: parseInt(opts.timeout as string, 10),
            verbose,
            dbPath: opts.dbPath as string | undefined,
            apiKey: opts.apiKey as string | undefined,
            model: opts.model as string | undefined,
          },
          onEvent: eventHandler,
        });

        const output = formatAuditReport(report, format);
        console.log(output);

        // Print shareable report URL
        if (format === "terminal") {
          console.log(
            `\n  ${chalk.gray("Share this report:")} ${chalk.cyan(buildShareUrl(report))}\n`
          );
        }

        // Exit with non-zero if critical/high findings
        if (report.summary.critical > 0 || report.summary.high > 0) {
          process.exit(1);
        }
      } catch (err) {
        spinner?.fail("Audit failed");
        console.error(
          chalk.red(err instanceof Error ? err.message : String(err))
        );
        process.exit(2);
      }
    });
}
