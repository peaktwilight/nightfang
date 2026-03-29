#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { VERSION } from "@pwnkit/shared";
import {
  registerScanCommand,
  registerReplayCommand,
  registerHistoryCommand,
  registerFindingsCommand,
  registerReviewCommand,
  registerAuditCommand,
} from "./commands/index.js";

const program = new Command();

program
  .name("pwnkit")
  .description("AI-powered agentic security scanner")
  .version(VERSION);

registerScanCommand(program);
registerReplayCommand(program);
registerHistoryCommand(program);
registerFindingsCommand(program);
registerReviewCommand(program);
registerAuditCommand(program);

// ── Interactive menu (Ink) ──
async function showInteractiveMenu(): Promise<void> {
  const { showInkMenu } = await import("./ui/Menu.js");
  const { action, target } = await showInkMenu();

  if (action === "history") {
    process.argv = [process.argv[0], process.argv[1], "history"];
    await program.parseAsync();
    return;
  }

  if (!target) return;

  if (action === "scan") {
    process.argv = [process.argv[0], process.argv[1], "scan", "--target", target, "--depth", "quick"];
  } else if (action === "audit") {
    process.argv = [process.argv[0], process.argv[1], "audit", target];
  } else if (action === "review") {
    process.argv = [process.argv[0], process.argv[1], "review", target];
  }

  await program.parseAsync();
}

// ── Smart target detection: pwnkit <target> auto-routes ──
function detectAndRoute(target: string): string[] | null {
  if (target.startsWith("./") || target.startsWith("/") || target === ".") {
    return ["review", target];
  }
  if (target.startsWith("https://github.com/") || target.startsWith("git@")) {
    return ["review", target];
  }
  if (target.startsWith("http://") || target.startsWith("https://")) {
    return ["scan", "--target", target];
  }
  if (/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*(@.*)?$/.test(target)) {
    return ["audit", target];
  }
  return null;
}

// ── Entry point ──
const userArgs = process.argv.slice(2);
const knownCommands = ["scan", "replay", "history", "findings", "review", "audit", "help"];

if (userArgs.length === 0) {
  showInteractiveMenu().catch((err) => {
    console.error(chalk.red(err instanceof Error ? err.message : String(err)));
    process.exit(2);
  });
} else if (userArgs.length >= 1 && !knownCommands.includes(userArgs[0]) && !userArgs[0].startsWith("-")) {
  const route = detectAndRoute(userArgs[0]);
  if (route) {
    const extraArgs = userArgs.slice(1);
    process.argv = [process.argv[0], process.argv[1], ...route, ...extraArgs];
    program.parse();
  } else {
    program.parse();
  }
} else {
  program.parse();
}
