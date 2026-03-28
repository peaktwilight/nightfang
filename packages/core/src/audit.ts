import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import type {
  AuditConfig,
  AuditReport,
  NpmAuditFinding,
  SemgrepFinding,
  Finding,
  ScanConfig,
  Severity,
} from "@pwnkit/shared";
import type { ScanEvent, ScanListener } from "./scanner.js";
import { auditAgentPrompt } from "./analysis-prompts.js";
import { runAnalysisAgent } from "./agent-runner.js";
import { bufferToString, runSemgrepScan } from "./shared-analysis.js";

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
  const tempDir = join(tmpdir(), `pwnkit-audit-${randomUUID().slice(0, 8)}`);
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
    execFileSync("npm", ["init", "-y", "--silent"], {
      cwd: tempDir,
      timeout: 15_000,
      stdio: "pipe",
    });

    execFileSync("npm", ["install", spec, "--ignore-scripts", "--no-audit", "--no-fund"], {
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

function runNpmAudit(
  projectDir: string,
  emit: ScanListener,
): NpmAuditFinding[] {
  emit({
    type: "stage:start",
    stage: "discovery",
    message: "Running npm audit...",
  });

  let rawOutput = "";

  try {
    rawOutput = execSync("npm audit --json", {
      cwd: projectDir,
      timeout: 120_000,
      stdio: "pipe",
    }).toString("utf-8");
  } catch (err) {
    const stdout =
      err && typeof err === "object" && "stdout" in err
        ? (err.stdout as Buffer | string | undefined)
        : undefined;
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? (err.stderr as Buffer | string | undefined)
        : undefined;

    rawOutput = bufferToString(stdout) || bufferToString(stderr) || "";
  }

  const findings = parseNpmAuditOutput(rawOutput);

  emit({
    type: "stage:end",
    stage: "discovery",
    message: `npm audit: ${findings.length} advisories`,
  });

  return findings;
}

function parseNpmAuditOutput(rawOutput: string): NpmAuditFinding[] {
  if (!rawOutput.trim()) {
    return [];
  }

  try {
    const raw = JSON.parse(rawOutput) as {
      vulnerabilities?: Record<
        string,
        {
          name?: string;
          severity?: string;
          via?: Array<string | Record<string, unknown>>;
          range?: string;
          fixAvailable?: boolean | { name?: string; version?: string } | string;
        }
      >;
    };

    return Object.entries(raw.vulnerabilities ?? {}).map(([pkgName, vuln]) => {
      const via = (vuln.via ?? []).map((entry) => {
        if (typeof entry === "string") {
          return entry;
        }

        const source = typeof entry.source === "number" ? `GHSA:${entry.source}` : null;
        const title = typeof entry.title === "string" ? entry.title : null;
        const name = typeof entry.name === "string" ? entry.name : null;

        return [name, title, source].filter(Boolean).join(" - ") || "unknown advisory";
      });

      const firstObjectVia = (vuln.via ?? []).find(
        (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
      );

      return {
        name: vuln.name ?? pkgName,
        severity: normalizeSeverity(vuln.severity),
        title:
          (typeof firstObjectVia?.title === "string" && firstObjectVia.title) ||
          via[0] ||
          "npm audit advisory",
        range: vuln.range,
        source:
          typeof firstObjectVia?.source === "number" || typeof firstObjectVia?.source === "string"
            ? (firstObjectVia.source as number | string)
            : undefined,
        url: typeof firstObjectVia?.url === "string" ? firstObjectVia.url : undefined,
        via,
        fixAvailable: formatFixAvailable(vuln.fixAvailable),
      };
    });
  } catch {
    return [];
  }
}

function normalizeSeverity(value: string | undefined): Severity {
  switch ((value ?? "").toLowerCase()) {
    case "critical":
      return "critical";
    case "high":
      return "high";
    case "moderate":
    case "medium":
      return "medium";
    case "low":
      return "low";
    default:
      return "info";
  }
}

function formatFixAvailable(
  fixAvailable: boolean | { name?: string; version?: string } | string | undefined,
): boolean | string {
  if (typeof fixAvailable === "string" || typeof fixAvailable === "boolean") {
    return fixAvailable;
  }

  if (fixAvailable && typeof fixAvailable === "object") {
    const next = [fixAvailable.name, fixAvailable.version].filter(Boolean).join("@");
    return next || true;
  }

  return false;
}

function buildCliAuditPrompt(
  pkg: InstalledPackage,
  semgrepFindings: SemgrepFinding[],
  npmAuditFindings: NpmAuditFinding[],
): string {
  const semgrepContext = semgrepFindings.length > 0
    ? semgrepFindings
        .slice(0, 30)
        .map((f, i) => `  ${i + 1}. [${f.severity}] ${f.ruleId} — ${f.path}:${f.startLine}: ${f.message}`)
        .join("\n")
    : "  None.";

  const npmContext = npmAuditFindings.length > 0
    ? npmAuditFindings
        .slice(0, 30)
        .map((f, i) => `  ${i + 1}. [${f.severity}] ${f.name}: ${f.title}`)
        .join("\n")
    : "  None.";

  return `Audit the npm package at ${pkg.path} (${pkg.name}@${pkg.version}).

Read the source code, look for: prototype pollution, ReDoS, path traversal, injection, unsafe deserialization, missing validation. Map data flow from untrusted input to sensitive operations. Report any security findings with severity and PoC suggestions.

Semgrep already found these leads:
${semgrepContext}

npm audit found these advisories:
${npmContext}

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
 * Recursively collect source file paths from a directory.
 * Skips node_modules, .git, and binary/image files.
 */
function collectSourceFiles(dir: string, maxFiles = 50): string[] {
  const files: string[] = [];
  const SOURCE_EXTS = new Set([
    ".js", ".mjs", ".cjs", ".ts", ".mts", ".cts",
    ".jsx", ".tsx", ".json", ".yml", ".yaml",
  ]);

  function walk(d: string) {
    if (files.length >= maxFiles) return;
    let entries: string[];
    try {
      entries = readdirSync(d);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (files.length >= maxFiles) return;
      if (entry === "node_modules" || entry === ".git") continue;
      const full = join(d, entry);
      try {
        const st = statSync(full);
        if (st.isDirectory()) {
          walk(full);
        } else if (st.isFile() && st.size < 200_000) {
          const ext = full.slice(full.lastIndexOf("."));
          if (SOURCE_EXTS.has(ext)) {
            files.push(full);
          }
        }
      } catch {
        // skip unreadable
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Build a prompt that includes the actual source code for direct API analysis.
 */
function buildDirectApiAuditPrompt(
  pkg: InstalledPackage,
  semgrepFindings: SemgrepFinding[],
  npmAuditFindings: NpmAuditFinding[],
): string {
  const sourceFiles = collectSourceFiles(pkg.path);
  const sourceBlocks: string[] = [];
  let totalChars = 0;
  const MAX_CHARS = 150_000; // stay well within context window

  for (const filePath of sourceFiles) {
    if (totalChars >= MAX_CHARS) break;
    try {
      const content = readFileSync(filePath, "utf-8");
      const rel = relative(pkg.path, filePath);
      const block = `--- FILE: ${rel} ---\n${content}\n--- END FILE ---`;
      totalChars += block.length;
      sourceBlocks.push(block);
    } catch {
      // skip unreadable files
    }
  }

  const semgrepContext = semgrepFindings.length > 0
    ? semgrepFindings
        .slice(0, 30)
        .map((f, i) => `  ${i + 1}. [${f.severity}] ${f.ruleId} — ${f.path}:${f.startLine}: ${f.message}`)
        .join("\n")
    : "  None.";

  const npmContext = npmAuditFindings.length > 0
    ? npmAuditFindings
        .slice(0, 30)
        .map((f, i) => `  ${i + 1}. [${f.severity}] ${f.name}: ${f.title}`)
        .join("\n")
    : "  None.";

  return `You are a security researcher performing an authorized source code audit of the npm package "${pkg.name}@${pkg.version}".

## Semgrep findings:
${semgrepContext}

## npm audit advisories:
${npmContext}

## Source code:

${sourceBlocks.join("\n\n")}

## Instructions

Analyze the source code above for security vulnerabilities. Look for:
- Prototype pollution (object merge/extend without hasOwnProperty checks, __proto__ access)
- ReDoS (regex with nested quantifiers, user input in new RegExp())
- Path traversal (user-supplied paths without normalization)
- Command/code injection (exec/eval with user input)
- Unsafe deserialization
- SSRF (HTTP requests with user-controlled URLs)
- Information disclosure (hardcoded credentials, debug modes)
- Missing input validation

For EACH confirmed vulnerability, output a block in this exact format:

---FINDING---
title: <clear title>
severity: <critical|high|medium|low|info>
category: <prototype-pollution|redos|path-traversal|command-injection|code-injection|unsafe-deserialization|ssrf|information-disclosure|missing-validation|other>
description: <detailed description of the vulnerability, how to exploit it, and suggested PoC>
file: <path/to/file.js:lineNumber>
---END---

Output as many ---FINDING--- blocks as needed. If there are no real vulnerabilities, output none.
Be precise and honest about severity — only report real, exploitable issues.`;
}

/**
 * Run an AI agent to analyze semgrep findings and hunt for additional
 * vulnerabilities in the package source code.
 *
 * Delegates to the unified runAnalysisAgent with audit-specific prompts.
 */
async function runAuditAgent(
  pkg: InstalledPackage,
  semgrepFindings: SemgrepFinding[],
  npmAuditFindings: NpmAuditFinding[],
  db: any,
  scanId: string,
  config: AuditConfig,
  emit: ScanListener,
): Promise<Finding[]> {
  return runAnalysisAgent({
    role: "audit",
    scopePath: pkg.path,
    target: `npm:${pkg.name}@${pkg.version}`,
    scanId,
    config,
    db,
    emit,
    cliPrompt: buildCliAuditPrompt(pkg, semgrepFindings, npmAuditFindings),
    agentSystemPrompt: auditAgentPrompt(
      pkg.name,
      pkg.version,
      pkg.path,
      semgrepFindings,
      npmAuditFindings,
    ),
    cliSystemPrompt: "You are a security researcher performing an authorized npm package audit. Be thorough and precise. Only report real, exploitable vulnerabilities.",
    directApiPrompt: buildDirectApiAuditPrompt(pkg, semgrepFindings, npmAuditFindings),
  });
}

/**
 * Main entry point: audit an npm package for security vulnerabilities.
 *
 * Pipeline:
 * 1. npm install <package>@latest in a temp dir
 * 2. Run semgrep with security rules
 * 3. AI agent analyzes semgrep findings + hunts for additional vulns
 * 4. Generate report with severity and PoC suggestions
 * 5. Persist to pwnkit DB
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
  const db = await (async () => { try { const { pwnkitDB } = await import("@pwnkit/db"); return new pwnkitDB(config.dbPath); } catch { return null as any; } })() as any;
  const scanConfig: ScanConfig = {
    target: `npm:${pkg.name}@${pkg.version}`,
    depth: config.depth,
    format: config.format,
    runtime: config.runtime ?? "api",
    mode: "deep",
  };
  const scanId = db?.createScan(scanConfig) ?? "no-db";

  try {
    // Step 2: npm audit + Semgrep scan
    const npmAuditFindings = runNpmAudit(pkg.tempDir, emit);
    const semgrepFindings = runSemgrepScan(pkg.path, emit, { noGitIgnore: true });

    // Step 3: AI agent analysis
    const findings = await runAuditAgent(
      pkg,
      semgrepFindings,
      npmAuditFindings,
      db,
      scanId,
      config,
      emit,
    );

    // Step 4: Build report
    const durationMs = Date.now() - startTime;
    const summary = {
      totalAttacks: semgrepFindings.length + npmAuditFindings.length,
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
      message: `Audit complete: ${summary.totalFindings} findings (${npmAuditFindings.length} npm advisories, ${semgrepFindings.length} semgrep findings)`,
    });

    const report: AuditReport = {
      package: pkg.name,
      version: pkg.version,
      startedAt: new Date(startTime).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs,
      semgrepFindings: semgrepFindings.length,
      npmAuditFindings,
      summary,
      findings,
    };

    return report;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db?.failScan(scanId, msg);
    throw err;
  } finally {
    db?.close();
    // Clean up temp directory
    try {
      rmSync(pkg.tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
