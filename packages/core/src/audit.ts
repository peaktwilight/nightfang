import { execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import type {
  AuditConfig,
  AuditReport,
  SemgrepFinding,
  Finding,
  ScanConfig,
  RuntimeMode,
} from "@nightfang/shared";
import type { ScanEvent, ScanListener } from "./scanner.js";
import { NightfangDB } from "@nightfang/db";
import { createRuntime } from "./runtime/index.js";
import type { RuntimeType } from "./runtime/index.js";
import { ClaudeApiRuntime } from "./runtime/claude-api.js";
import { detectAvailableRuntimes, pickRuntimeForStage } from "./runtime/registry.js";
import { runAgentLoop } from "./agent/loop.js";
import { getToolsForRole } from "./agent/tools.js";
import { auditAgentPrompt } from "./audit-prompt.js";

export interface PackageAuditOptions {
  config: AuditConfig;
  onEvent?: ScanListener;
}

interface InstalledPackage {
  name: string;
  version: string;
  path: string;
  tempDir: string;
}

/**
 * Install an npm package in a temporary directory and return its path.
 */
function installPackage(
  packageName: string,
  requestedVersion: string | undefined,
  emit: ScanListener,
): InstalledPackage {
  const tempDir = join(tmpdir(), `nightfang-audit-${randomUUID().slice(0, 8)}`);
  mkdirSync(tempDir, { recursive: true });

  const spec = requestedVersion
    ? `${packageName}@${requestedVersion}`
    : `${packageName}@latest`;

  emit({
    type: "stage:start",
    stage: "discovery",
    message: `Installing ${spec}...`,
  });

  try {
    // Initialize a minimal package.json so npm install works cleanly
    execSync('npm init -y --silent 2>/dev/null || true', {
      cwd: tempDir,
      timeout: 15_000,
      stdio: "pipe",
    });

    execSync(`npm install ${spec} --ignore-scripts --no-audit --no-fund`, {
      cwd: tempDir,
      timeout: 120_000,
      stdio: "pipe",
    });
  } catch (err) {
    rmSync(tempDir, { recursive: true, force: true });
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to install ${spec}: ${msg}`);
  }

  // Resolve actual installed version from package.json
  const pkgJsonPath = join(tempDir, "node_modules", packageName, "package.json");
  if (!existsSync(pkgJsonPath)) {
    // Try scoped package path
    rmSync(tempDir, { recursive: true, force: true });
    throw new Error(
      `Package ${packageName} not found after install. Check the package name.`,
    );
  }

  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
  const installedVersion = pkgJson.version as string;
  const packagePath = join(tempDir, "node_modules", packageName);

  emit({
    type: "stage:end",
    stage: "discovery",
    message: `Installed ${packageName}@${installedVersion}`,
  });

  return {
    name: packageName,
    version: installedVersion,
    path: packagePath,
    tempDir,
  };
}

/**
 * Run semgrep security scan against the package source.
 * Returns parsed findings from SARIF/JSON output.
 */
function runSemgrepScan(
  packagePath: string,
  emit: ScanListener,
): SemgrepFinding[] {
  emit({
    type: "stage:start",
    stage: "source-analysis",
    message: "Running semgrep security scan...",
  });

  const outputFile = join(tmpdir(), `nightfang-semgrep-${randomUUID().slice(0, 8)}.json`);

  try {
    // Run semgrep with auto config (includes security rules)
    // Use --json for structured output
    execSync(
      `semgrep scan --config auto --json --no-git-ignore --timeout 60 --max-target-bytes 1000000 "${packagePath}" > "${outputFile}" 2>/dev/null`,
      {
        timeout: 300_000, // 5 min max for semgrep
        stdio: "pipe",
        env: { ...process.env, SEMGREP_SEND_METRICS: "off" },
      },
    );
  } catch {
    // Semgrep returns non-zero when it finds issues — that's fine
    // Also may not be installed — handle gracefully
  }

  let findings: SemgrepFinding[] = [];

  if (existsSync(outputFile)) {
    try {
      const raw = JSON.parse(readFileSync(outputFile, "utf-8"));
      const results = (raw.results ?? []) as Array<{
        check_id: string;
        extra: {
          message: string;
          severity: string;
          lines: string;
          metadata?: Record<string, unknown>;
        };
        path: string;
        start: { line: number };
        end: { line: number };
      }>;

      findings = results.map((r) => ({
        ruleId: r.check_id,
        message: r.extra?.message ?? "",
        severity: mapSemgrepSeverity(r.extra?.severity ?? "WARNING"),
        path: r.path,
        startLine: r.start?.line ?? 0,
        endLine: r.end?.line ?? 0,
        snippet: r.extra?.lines ?? "",
        metadata: r.extra?.metadata,
      }));
    } catch {
      // JSON parse failed — semgrep output was malformed
    }

    // Clean up temp file
    try {
      rmSync(outputFile, { force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  emit({
    type: "stage:end",
    stage: "source-analysis",
    message: `Semgrep: ${findings.length} findings`,
  });

  return findings;
}

function mapSemgrepSeverity(level: string): string {
  switch (level.toUpperCase()) {
    case "ERROR":
      return "high";
    case "WARNING":
      return "medium";
    case "INFO":
      return "low";
    default:
      return "info";
  }
}

/**
 * Run an AI agent to analyze semgrep findings and hunt for additional
 * vulnerabilities in the package source code.
 */
async function runAuditAgent(
  pkg: InstalledPackage,
  semgrepFindings: SemgrepFinding[],
  db: NightfangDB,
  scanId: string,
  config: AuditConfig,
  emit: ScanListener,
): Promise<Finding[]> {
  emit({
    type: "stage:start",
    stage: "attack",
    message: "AI agent analyzing source code...",
  });

  const maxTurns =
    config.depth === "deep" ? 25 : config.depth === "default" ? 15 : 8;

  // Resolve runtime type: auto picks best for source analysis, otherwise use configured or default to api
  let runtimeType: RuntimeType;
  if (config.runtime === "auto") {
    const available = await detectAvailableRuntimes();
    runtimeType = available.size > 0
      ? pickRuntimeForStage("source-analysis", available)
      : "api";
  } else {
    runtimeType = (config.runtime ?? "api") as RuntimeType;
  }

  // For audit, "api" means call Claude API directly to analyze code —
  // NOT send HTTP to a target URL (that's what ApiRuntime does for scan mode).
  const runtimeConfig = { type: runtimeType, timeout: config.timeout ?? 120_000 };
  const runtime =
    runtimeType === "api"
      ? new ClaudeApiRuntime(runtimeConfig)
      : createRuntime(runtimeConfig);

  const agentState = await runAgentLoop({
    config: {
      role: "audit",
      systemPrompt: auditAgentPrompt(
        pkg.name,
        pkg.version,
        pkg.path,
        semgrepFindings,
      ),
      tools: getToolsForRole("audit"),
      maxTurns,
      target: `npm:${pkg.name}@${pkg.version}`,
      scanId,
    },
    runtime,
    db,
    onTurn: (_turn, msg) => {
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

  emit({
    type: "stage:end",
    stage: "attack",
    message: `Agent complete: ${agentState.findings.length} findings, ${agentState.summary}`,
  });

  return agentState.findings;
}

/**
 * Main entry point: audit an npm package for security vulnerabilities.
 *
 * Pipeline:
 * 1. npm install <package>@latest in a temp dir
 * 2. Run semgrep with security rules
 * 3. AI agent analyzes semgrep findings + hunts for additional vulns
 * 4. Generate report with severity and PoC suggestions
 * 5. Persist to nightfang DB
 */
export async function packageAudit(
  opts: PackageAuditOptions,
): Promise<AuditReport> {
  const { config, onEvent } = opts;
  const emit: ScanListener = onEvent ?? (() => {});
  const startTime = Date.now();

  // Step 1: Install package
  const pkg = installPackage(config.package, config.version, emit);

  // Initialize DB and create scan record
  const db = new NightfangDB(config.dbPath);
  const scanConfig: ScanConfig = {
    target: `npm:${pkg.name}@${pkg.version}`,
    depth: config.depth,
    format: config.format,
    runtime: config.runtime ?? "api",
    mode: "deep",
  };
  const scanId = db.createScan(scanConfig);

  try {
    // Step 2: Semgrep scan
    const semgrepFindings = runSemgrepScan(pkg.path, emit);

    // Step 3: AI agent analysis
    const findings = await runAuditAgent(
      pkg,
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

    db.completeScan(scanId, summary);

    emit({
      type: "stage:end",
      stage: "report",
      message: `Audit complete: ${summary.totalFindings} findings (${summary.critical} critical, ${summary.high} high)`,
    });

    const report: AuditReport = {
      package: pkg.name,
      version: pkg.version,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      semgrepFindings: semgrepFindings.length,
      summary,
      findings,
    };

    return report;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.failScan(scanId, msg);
    throw err;
  } finally {
    db.close();
    // Clean up temp directory
    try {
      rmSync(pkg.tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
