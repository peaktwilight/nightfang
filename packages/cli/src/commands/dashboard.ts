import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { URL } from "node:url";
import type { Command } from "commander";
import chalk from "chalk";
import type { FindingTriageStatus } from "@pwnkit/shared";

type DashboardOptions = {
  dbPath?: string;
  port?: string;
  host?: string;
  noOpen?: boolean;
};

type DBFindingRow = {
  id: string;
  scanId: string;
  title: string;
  description: string;
  severity: string;
  category: string;
  status: string;
  fingerprint?: string | null;
  triageStatus?: string | null;
  triageNote?: string | null;
  timestamp: number;
  score?: number | null;
  confidence?: number | null;
  evidenceRequest: string;
  evidenceResponse: string;
  evidenceAnalysis?: string | null;
};

type DBScanRow = {
  id: string;
  target: string;
  depth: string;
  runtime: string;
  mode: string;
  status: string;
  startedAt: string;
  completedAt?: string | null;
  durationMs?: number | null;
  summary?: string | null;
};

type DBEventRow = {
  id: string;
  scanId: string;
  stage: string;
  eventType: string;
  findingId?: string | null;
  agentRole?: string | null;
  payload: string;
  timestamp: number;
};

const VALID_TRIAGE_STATUSES = new Set<FindingTriageStatus>(["new", "accepted", "suppressed"]);
const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  execFile(cmd, args, () => {});
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function text(res: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendFile(res: ServerResponse, filePath: string): void {
  const ext = extname(filePath);
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300",
  });
  res.end(readFileSync(filePath));
}

function readJson(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function normalizeTriageStatus(value?: string | null): FindingTriageStatus {
  return value && VALID_TRIAGE_STATUSES.has(value as FindingTriageStatus)
    ? value as FindingTriageStatus
    : "new";
}

function parseSummary(summary?: string | null): Record<string, number> {
  if (!summary) return {};
  try {
    return JSON.parse(summary) as Record<string, number>;
  } catch {
    return {};
  }
}

function parsePayload(payload: string): Record<string, unknown> | null {
  try {
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function summarizeScan(scan: DBScanRow) {
  const summary = parseSummary(scan.summary);
  return {
    id: scan.id,
    target: scan.target,
    depth: scan.depth,
    runtime: scan.runtime,
    mode: scan.mode,
    status: scan.status,
    startedAt: scan.startedAt,
    completedAt: scan.completedAt ?? null,
    durationMs: scan.durationMs ?? null,
    summary: {
      totalFindings: summary.totalFindings ?? 0,
      totalAttacks: summary.totalAttacks ?? 0,
      critical: summary.critical ?? 0,
      high: summary.high ?? 0,
      medium: summary.medium ?? 0,
      low: summary.low ?? 0,
      info: summary.info ?? 0,
    },
  };
}

function normalizeFinding(row: DBFindingRow) {
  return {
    ...row,
    triageStatus: normalizeTriageStatus(row.triageStatus),
  };
}

function groupFindings(rows: DBFindingRow[]) {
  const map = new Map<string, DBFindingRow[]>();
  for (const row of rows) {
    const key = row.fingerprint ?? row.id;
    const list = map.get(key) ?? [];
    list.push(normalizeFinding(row));
    map.set(key, list);
  }

  return [...map.entries()]
    .map(([fingerprint, items]) => {
      const sorted = items.sort((a, b) => b.timestamp - a.timestamp);
      const latest = sorted[0];
      return {
        fingerprint,
        latest,
        count: sorted.length,
        scanCount: new Set(sorted.map((item) => item.scanId)).size,
      };
    })
    .sort((a, b) => b.latest.timestamp - a.latest.timestamp);
}

function parseScanPath(pathname: string): { scanId: string; suffix?: "events" | "findings" } | null {
  const match = pathname.match(/^\/api\/scans\/([^/]+)(?:\/(events|findings))?$/);
  if (!match) return null;
  return {
    scanId: decodeURIComponent(match[1]),
    suffix: match[2] as "events" | "findings" | undefined,
  };
}

function parseFindingFamilyPath(pathname: string): { fingerprint: string; action?: "triage" } | null {
  const match = pathname.match(/^\/api\/finding-family\/([^/]+)(?:\/(triage))?$/);
  if (!match) return null;
  return {
    fingerprint: decodeURIComponent(match[1]),
    action: match[2] as "triage" | undefined,
  };
}

function resolveDashboardAssetDir(): string {
  const moduleDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
  const candidates = [
    join(moduleDir, "dashboard"),
    join(moduleDir, "..", "dashboard"),
    join(process.cwd(), "dist", "dashboard"),
    join(process.cwd(), "packages", "dashboard", "dist"),
  ];

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "index.html"))) {
      return candidate;
    }
  }

  throw new Error("Dashboard assets not found. Run `pnpm build` to generate the dashboard app.");
}

function resolveAssetPath(assetDir: string, pathname: string): string | null {
  const trimmed = pathname === "/" ? "/index.html" : pathname;
  const candidate = normalize(join(assetDir, trimmed));
  if (!candidate.startsWith(assetDir)) return null;
  if (!existsSync(candidate)) return null;
  return candidate;
}

async function handleApiRequest(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
  dbPath: string | undefined,
): Promise<boolean> {
  const { pwnkitDB } = await import("@pwnkit/db");

  if (pathname === "/api/dashboard") {
    const db = new pwnkitDB(dbPath);
    try {
      const scans = db.listScans(100) as DBScanRow[];
      const findings = db.listFindings({ limit: 5000 }) as DBFindingRow[];
      json(res, 200, {
        scans: scans.map(summarizeScan),
        groups: groupFindings(findings),
      });
    } finally {
      db.close();
    }
    return true;
  }

  if (pathname === "/api/scans") {
    const db = new pwnkitDB(dbPath);
    try {
      const scans = db.listScans(100) as DBScanRow[];
      json(res, 200, { scans: scans.map(summarizeScan) });
    } finally {
      db.close();
    }
    return true;
  }

  const scanPath = parseScanPath(pathname);
  if (scanPath) {
    const db = new pwnkitDB(dbPath);
    try {
      const scan = db.getScan(scanPath.scanId) as DBScanRow | undefined;
      if (!scan) {
        json(res, 404, { error: "Scan not found" });
        return true;
      }

      if (scanPath.suffix === "events") {
        const events = (db.getEvents(scanPath.scanId) as DBEventRow[]).map((event) => ({
          ...event,
          payload: parsePayload(event.payload),
        }));
        json(res, 200, { scan: summarizeScan(scan), events });
        return true;
      }

      if (scanPath.suffix === "findings") {
        const findings = (db.getFindings(scanPath.scanId) as DBFindingRow[]).map(normalizeFinding);
        json(res, 200, {
          scan: summarizeScan(scan),
          findings,
          groups: groupFindings(findings),
        });
        return true;
      }

      json(res, 200, { scan: summarizeScan(scan) });
    } finally {
      db.close();
    }
    return true;
  }

  const familyPath = parseFindingFamilyPath(pathname);
  if (familyPath) {
    const db = new pwnkitDB(dbPath);
    try {
      if (req.method === "POST" && familyPath.action === "triage") {
        const body = (await readJson(req)) as { triageStatus?: string; triageNote?: string };
        db.updateFindingTriageByFingerprint(
          familyPath.fingerprint,
          normalizeTriageStatus(body.triageStatus),
          typeof body.triageNote === "string" ? body.triageNote : undefined,
        );
        json(res, 200, { ok: true });
        return true;
      }

      const rows = (db.getRelatedFindings(familyPath.fingerprint) as DBFindingRow[]).map(normalizeFinding);
      if (rows.length === 0) {
        json(res, 404, { error: "Not found" });
        return true;
      }

      json(res, 200, {
        fingerprint: familyPath.fingerprint,
        latest: rows[0],
        rows,
      });
    } finally {
      db.close();
    }
    return true;
  }

  return false;
}

export function registerDashboardCommand(program: Command): void {
  program
    .command("dashboard")
    .description("Run a local mission-control dashboard for scans and findings")
    .option("--db-path <path>", "Path to SQLite database")
    .option("--port <port>", "Port to bind", "48123")
    .option("--host <host>", "Host to bind", "127.0.0.1")
    .option("--no-open", "Do not auto-open a browser")
    .action(async (opts: DashboardOptions) => {
      const host = opts.host ?? "127.0.0.1";
      const port = parseInt(opts.port ?? "48123", 10);
      if (!Number.isInteger(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid port: ${opts.port ?? "48123"}`);
      }

      const assetDir = resolveDashboardAssetDir();

      const server = createServer(async (req, res) => {
        const requestUrl = new URL(req.url ?? "/", `http://${host}:${port}`);

        try {
          if (requestUrl.pathname.startsWith("/api/")) {
            const handled = await handleApiRequest(req, res, requestUrl.pathname, opts.dbPath);
            if (!handled) json(res, 404, { error: "Not found" });
            return;
          }

          const explicitAsset = resolveAssetPath(assetDir, requestUrl.pathname);
          if (explicitAsset) {
            sendFile(res, explicitAsset);
            return;
          }

          if (extname(requestUrl.pathname)) {
            json(res, 404, { error: "Asset not found" });
            return;
          }

          sendFile(res, join(assetDir, "index.html"));
        } catch (err) {
          json(res, 500, { error: err instanceof Error ? err.message : String(err) });
        }
      });

      server.listen(port, host, () => {
        const url = `http://${host}:${port}`;
        console.log(chalk.red.bold("  \u25C6 pwnkit") + chalk.gray(" dashboard"));
        console.log(chalk.gray(`  ${url}`));
        console.log(chalk.gray("  Ctrl+C to stop"));
        if (!opts.noOpen) openBrowser(url);
      });

      process.once("SIGINT", () => {
        server.close(() => process.exit(0));
      });
    });
}
