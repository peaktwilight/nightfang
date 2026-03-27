#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { VERSION } from "@nightfang/shared";
import type {
  ScanDepth,
  OutputFormat,
  RuntimeMode,
  ScanMode,
} from "@nightfang/shared";
import { scan, agenticScan, createRuntime } from "@nightfang/core";
import { formatReport } from "./formatters/index.js";
import { renderProgressBar } from "./formatters/terminal.js";

const program = new Command();

program
  .name("nightfang")
  .description("AI-powered red-teaming toolkit for LLM applications")
  .version(VERSION);

program
  .command("scan")
  .description("Run security scan against an LLM endpoint")
  .requiredOption("--target <url>", "Target API endpoint URL")
  .option("--depth <depth>", "Scan depth: quick, default, deep", "default")
  .option("--format <format>", "Output format: terminal, json, md", "terminal")
  .option("--runtime <runtime>", "Runtime: api, claude, codex", "api")
  .option("--mode <mode>", "Scan mode: probe, deep, mcp", "probe")
  .option("--repo <path>", "Path to target repo for deep scan source analysis")
  .option("--timeout <ms>", "Request timeout in milliseconds", "30000")
  .option("--agentic", "Use multi-turn agentic scan with tool use and SQLite persistence", false)
  .option("--db-path <path>", "Path to SQLite database (default: ~/.nightfang/nightfang.db)")
  .option("--verbose", "Show detailed output", false)
  .action(async (opts) => {
    const depth = opts.depth as ScanDepth;
    const format = (opts.format === "md" ? "markdown" : opts.format) as OutputFormat;
    const runtime = opts.runtime as RuntimeMode;
    const mode = opts.mode as ScanMode;
    const verbose = opts.verbose as boolean;

    // Deep and MCP modes require a process runtime
    if (mode !== "probe" && runtime === "api") {
      console.error(
        chalk.red(`Mode '${mode}' requires --runtime claude or --runtime codex`)
      );
      process.exit(2);
    }

    // Check runtime availability
    if (runtime !== "api") {
      const rt = createRuntime({
        type: runtime,
        timeout: parseInt(opts.timeout, 10),
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
        chalk.red.bold("  ◆ nightfang") + chalk.gray(` v${VERSION}`)
      );
      console.log("");
      console.log(
        `  ${chalk.gray("Target:")}  ${chalk.white.bold(opts.target)}`
      );
      console.log(
        `  ${chalk.gray("Depth:")}   ${chalk.white(depth)} ${chalk.gray(`(${depthLabel(depth)})`)}`
      );
      if (runtime !== "api") {
        console.log(
          `  ${chalk.gray("Runtime:")} ${chalk.white(runtime)}`
        );
      }
      if (mode !== "probe") {
        console.log(
          `  ${chalk.gray("Mode:")}    ${chalk.white(mode)}`
        );
      }
      console.log("");
    }

    const spinner = format === "terminal" ? ora({ spinner: "dots" }) : null;
    let attackTotal = 0;
    let attacksDone = 0;

    const scanConfig = {
      target: opts.target,
      depth,
      format,
      runtime,
      mode,
      repoPath: opts.repo,
      timeout: parseInt(opts.timeout, 10),
      verbose,
    };

    const eventHandler = (event: { type: string; stage?: string; message: string; data?: unknown }) => {
          if (format !== "terminal") return;

          switch (event.type) {
            case "stage:start":
              if (event.stage === "attack") {
                // Extract template count from message for progress bar
                const match = event.message.match(/(\d+)/);
                if (match) attackTotal = parseInt(match[1], 10);
                attacksDone = 0;
                spinner?.start(
                  `  ${chalk.gray("Running attacks")} ${renderProgressBar(0, attackTotal || 1)}`
                );
              } else {
                spinner?.start(`  ${chalk.gray(event.message)}`);
              }
              break;

            case "attack:end":
              attacksDone++;
              if (spinner && attackTotal > 0) {
                spinner.text = `  ${chalk.gray("Running attacks")} ${renderProgressBar(attacksDone, attackTotal)}`;
              }
              break;

            case "stage:end":
              if (event.stage === "attack") {
                spinner?.succeed(
                  `  ${chalk.gray("Attacks complete")} ${renderProgressBar(attackTotal, attackTotal)}`
                );
              } else if (
                event.stage === "discovery" ||
                event.stage === "verify"
              ) {
                spinner?.succeed(`  ${chalk.green("✓")} ${chalk.gray(event.message)}`);
              } else {
                spinner?.succeed(`  ${chalk.gray(event.message)}`);
              }
              break;

            case "finding":
              if (verbose) {
                console.log(
                  `    ${chalk.yellow("⚡")} ${chalk.yellow(event.message)}`
                );
              }
              break;

            case "error":
              spinner?.fail(`  ${chalk.red("✗")} ${chalk.red(event.message)}`);
              break;
          }
        };

    try {
      const report = opts.agentic
        ? await agenticScan({
            config: scanConfig,
            dbPath: opts.dbPath,
            onEvent: eventHandler,
          })
        : await scan(scanConfig, eventHandler);

      const output = formatReport(report, format);
      console.log(output);

      // Exit with non-zero if critical/high findings
      if (report.summary.critical > 0 || report.summary.high > 0) {
        process.exit(1);
      }
    } catch (err) {
      spinner?.fail(`  ${chalk.red("✗ Scan failed")}`);
      console.error(
        chalk.red(err instanceof Error ? err.message : String(err))
      );
      process.exit(2);
    }
  });

// ── History command ──
program
  .command("history")
  .description("Show past scan history from the SQLite database")
  .option("--db-path <path>", "Path to SQLite database")
  .option("--limit <n>", "Number of scans to show", "10")
  .action(async (opts) => {
    const { NightfangDB } = await import("@nightfang/core");
    const db = new NightfangDB(opts.dbPath);
    const scans = db.listScans(parseInt(opts.limit, 10));
    db.close();

    if (scans.length === 0) {
      console.log(chalk.gray("No scan history found."));
      return;
    }

    console.log("");
    console.log(chalk.red.bold("  ◆ nightfang") + chalk.gray(" scan history"));
    console.log("");

    for (const scan of scans) {
      const status =
        scan.status === "completed"
          ? chalk.green("done")
          : scan.status === "failed"
            ? chalk.red("fail")
            : chalk.yellow("run");
      const summary = scan.summary ? JSON.parse(scan.summary) : null;
      const findings = summary?.totalFindings ?? "?";
      const duration = scan.durationMs ? `${(scan.durationMs / 1000).toFixed(1)}s` : "-";

      console.log(
        `  ${status} ${chalk.white(scan.target)} ${chalk.gray(`[${scan.depth}]`)} ${chalk.gray(duration)} ${chalk.yellow(`${findings} findings`)} ${chalk.gray(scan.startedAt)}`
      );
    }
    console.log("");
  });

function depthLabel(depth: ScanDepth): string {
  switch (depth) {
    case "quick":
      return "~5 probes";
    case "default":
      return "~50 probes";
    case "deep":
      return "full coverage";
  }
}

program.parse();
