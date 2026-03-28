import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import type {
  ReviewConfig,
  ReviewReport,
  SemgrepFinding,
  Finding,
  ScanConfig,
} from "@pwnkit/shared";
import type { ScanEvent, ScanListener } from "./scanner.js";
import { reviewAgentPrompt } from "./analysis-prompts.js";
import { runAnalysisAgent } from "./agent-runner.js";
import { runSemgrepScan } from "./shared-analysis.js";

export interface SourceReviewOptions {
  config: ReviewConfig;
  onEvent?: ScanListener;
}

/**
 * Resolve the repo path: if it's a URL, clone it; if local, use as-is.
 * Returns the absolute path to the repo and whether it was cloned (needs cleanup).
 */
function resolveRepo(
  repo: string,
  emit: ScanListener,
): { repoPath: string; cloned: boolean; tempDir?: string } {
  // Check if it's a git URL (https, ssh, or git protocol)
  const isUrl =
    repo.startsWith("https://") ||
    repo.startsWith("http://") ||
    repo.startsWith("git@") ||
    repo.startsWith("git://");

  if (!isUrl) {
    // Local path
    const absPath = resolve(repo);
    if (!existsSync(absPath)) {
      throw new Error(`Repository path not found: ${absPath}`);
    }
    return { repoPath: absPath, cloned: false };
  }

  // Clone the repo
  const tempDir = join(tmpdir(), `pwnkit-review-${randomUUID().slice(0, 8)}`);
  mkdirSync(tempDir, { recursive: true });

  emit({
    type: "stage:start",
    stage: "discovery",
    message: `Cloning ${repo}...`,
  });

  try {
    execFileSync("git", ["clone", "--depth", "1", repo, `${tempDir}/repo`], {
      timeout: 120_000,
      stdio: "pipe",
    });
  } catch (err) {
    rmSync(tempDir, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to clone ${repo}: ${msg}`);
  }

  const repoPath = join(tempDir, "repo");

  emit({
    type: "stage:end",
    stage: "discovery",
    message: `Cloned ${basename(repo.replace(/\.git$/, ""))}`,
  });

  return { repoPath, cloned: true, tempDir };
}

function buildCliReviewPrompt(
  repoPath: string,
  semgrepFindings: SemgrepFinding[],
): string {
  const semgrepContext = semgrepFindings.length > 0
    ? semgrepFindings
        .slice(0, 30)
        .map((f, i) => `  ${i + 1}. [${f.severity}] ${f.ruleId} — ${f.path}:${f.startLine}: ${f.message}`)
        .join("\n")
    : "  None.";

  return `Audit the npm package at ${repoPath}.

Read the source code, look for: prototype pollution, ReDoS, path traversal, injection, unsafe deserialization, missing validation. Map data flow from untrusted input to sensitive operations. Report any security findings with severity and PoC suggestions.

Semgrep already found these leads:
${semgrepContext}

For EACH confirmed vulnerability, output a block in this exact format:

---FINDING---
title: <clear title>
severity: <critical|high|medium|low|info>
category: <prototype-pollution|redos|path-traversal|command-injection|code-injection|unsafe-deserialization|ssrf|information-disclosure|missing-validation|other>
description: <detailed description of the vulnerability, how to exploit it, and suggested PoC>
file: <path/to/file.js:lineNumber>
---END---

Output as many ---FINDING--- blocks as needed. Be precise and honest about severity.`;
}

/**
 * Run an AI agent to perform deep source code review.
 *
 * Delegates to the unified runAnalysisAgent with review-specific prompts.
 */
async function runReviewAgent(
  repoPath: string,
  semgrepFindings: SemgrepFinding[],
  db: any,
  scanId: string,
  config: ReviewConfig,
  emit: ScanListener,
): Promise<Finding[]> {
  return runAnalysisAgent({
    role: "review",
    scopePath: repoPath,
    target: `repo:${repoPath}`,
    scanId,
    config,
    db,
    emit,
    cliPrompt: buildCliReviewPrompt(repoPath, semgrepFindings),
    agentSystemPrompt: reviewAgentPrompt(repoPath, semgrepFindings),
    cliSystemPrompt: "You are a security researcher performing an authorized source code review. Be thorough and precise. Only report real, exploitable vulnerabilities.",
  });
}

/**
 * Main entry point: deep source code review of a repository.
 *
 * Pipeline:
 * 1. Clone repo (if URL) or resolve local path
 * 2. Run semgrep with security rules
 * 3. AI agent performs deep source code review
 * 4. Generate report with severity and PoC suggestions
 * 5. Persist to pwnkit DB
 */
export async function sourceReview(
  opts: SourceReviewOptions,
): Promise<ReviewReport> {
  const { config, onEvent } = opts;
  const emit: ScanListener = onEvent ?? (() => {});
  const startTime = Date.now();

  // Step 1: Resolve repo
  const { repoPath, cloned, tempDir } = resolveRepo(config.repo, emit);

  // Initialize DB and create scan record
  const db = await (async () => { try { const { pwnkitDB } = await import("@pwnkit/db"); return new pwnkitDB(config.dbPath); } catch { return null as any; } })() as any;
  const scanConfig: ScanConfig = {
    target: `repo:${config.repo}`,
    depth: config.depth,
    format: config.format,
    runtime: config.runtime ?? "api",
    mode: "deep",
  };
  const scanId = db?.createScan(scanConfig) ?? "no-db";

  try {
    // Step 2: Semgrep scan
    const semgrepFindings = runSemgrepScan(repoPath, emit);

    // Step 3: AI agent review
    const findings = await runReviewAgent(
      repoPath,
      semgrepFindings,
      db,
      scanId,
      config,
      emit,
    );

    // Step 4: Build report
    const durationMs = Date.now() - startTime;
    const summary = {
      totalAttacks: semgrepFindings.length,
      totalFindings: findings.length,
      critical: findings.filter((f) => f.severity === "critical").length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      info: findings.filter((f) => f.severity === "info").length,
    };

    db?.completeScan(scanId, summary);

    emit({
      type: "stage:end",
      stage: "report",
      message: `Review complete: ${summary.totalFindings} findings (${summary.critical} critical, ${summary.high} high)`,
    });

    return {
      repo: config.repo,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      semgrepFindings: semgrepFindings.length,
      summary,
      findings,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db?.failScan(scanId, msg);
    throw err;
  } finally {
    db?.close();
    // Clean up cloned repos
    if (cloned && tempDir) {
      try {
        rmSync(tempDir, { recursive: true, force: true });
      } catch {
        // ignore
      }
    }
  }
}
