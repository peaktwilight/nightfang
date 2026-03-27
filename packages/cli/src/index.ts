#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { VERSION } from "@nightfang/shared";
import type { ScanDepth, OutputFormat, RuntimeMode, ScanMode } from "@nightfang/shared";
import { scan, createRuntime } from "@nightfang/core";
import { formatReport } from "./formatters/index.js";

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
      const rt = createRuntime({ type: runtime, timeout: parseInt(opts.timeout, 10) });
      const available = await rt.isAvailable();
      if (!available) {
        console.error(
          chalk.red(`Runtime '${runtime}' not available. Is ${runtime} installed?`)
        );
        process.exit(2);
      }
    }

    // Banner
    if (format === "terminal") {
      console.log("");
      console.log(chalk.red.bold("  NIGHTFANG") + chalk.gray(" v" + VERSION));
      console.log(chalk.gray("  AI Red-Teaming Toolkit"));
      if (runtime !== "api") {
        console.log(chalk.gray(`  Runtime: ${runtime}`));
      }
      if (mode !== "probe") {
        console.log(chalk.gray(`  Mode: ${mode}`));
      }
      console.log("");
    }

    const spinner = format === "terminal" ? ora() : null;

    try {
      const report = await scan(
        {
          target: opts.target,
          depth,
          format,
          runtime,
          mode,
          repoPath: opts.repo,
          timeout: parseInt(opts.timeout, 10),
          verbose,
        },
        (event) => {
          if (format !== "terminal") return;

          switch (event.type) {
            case "stage:start":
              spinner?.start(chalk.gray(event.message));
              break;
            case "stage:end":
              if (event.stage === "attack" || event.stage === "verify") {
                spinner?.succeed(event.message);
              } else {
                spinner?.succeed(chalk.gray(event.message));
              }
              break;
            case "finding":
              if (verbose) {
                console.log(`  ${chalk.yellow("!")} ${event.message}`);
              }
              break;
            case "error":
              spinner?.fail(chalk.red(event.message));
              break;
          }
        }
      );

      const output = formatReport(report, format);
      console.log(output);

      // Exit with non-zero if critical/high findings
      if (report.summary.critical > 0 || report.summary.high > 0) {
        process.exit(1);
      }
    } catch (err) {
      spinner?.fail(chalk.red("Scan failed"));
      console.error(
        chalk.red(err instanceof Error ? err.message : String(err))
      );
      process.exit(2);
    }
  });

program.parse();
