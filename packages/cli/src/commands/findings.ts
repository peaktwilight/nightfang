import type { Command } from "commander";
import chalk from "chalk";
import type { FindingTriageStatus } from "@pwnkit/shared";

type FindingsListOptions = {
  dbPath?: string;
  scan?: string;
  severity?: string;
  category?: string;
  status?: string;
  triage?: string;
  limit?: string;
  all?: boolean;
};

type FindingRow = {
  id: string;
  scanId: string;
  title: string;
  severity: string;
  category: string;
  status: string;
  fingerprint?: string | null;
  triageStatus?: string | null;
  triageNote?: string | null;
  timestamp: number;
  score?: number | null;
  templateId: string;
  description: string;
  evidenceRequest: string;
  evidenceResponse: string;
  evidenceAnalysis?: string | null;
};

function withFindingsListOptions(command: Command): Command {
  return command
    .option("--db-path <path>", "Path to SQLite database")
    .option("--scan <scanId>", "Filter by scan ID")
    .option("--severity <severity>", "Filter by severity: critical, high, medium, low, info")
    .option("--category <category>", "Filter by attack category")
    .option("--status <status>", "Filter by status: discovered, verified, confirmed, scored, reported, false-positive")
    .option("--triage <triage>", "Filter by triage: new, accepted, suppressed")
    .option("--limit <n>", "Max findings/groups to show", "50")
    .option("--all", "Show raw finding rows instead of grouped fingerprints", false);
}

function resolveFindingByPrefix(rows: FindingRow[], id: string): FindingRow | undefined {
  const exact = rows.find((row) => row.id === id);
  if (exact) return exact;
  const matches = rows.filter((row) => row.id.startsWith(id));
  if (matches.length > 1) {
    throw new Error(`Finding prefix '${id}' is ambiguous.`);
  }
  return matches[0];
}

function triageColor(status?: string | null) {
  switch (status) {
    case "accepted":
      return chalk.green;
    case "suppressed":
      return chalk.gray;
    default:
      return chalk.cyan;
  }
}

function severityColor(severity: string) {
  return severity === "critical" ? chalk.red.bold
    : severity === "high" ? chalk.redBright
    : severity === "medium" ? chalk.yellow
    : severity === "low" ? chalk.blue
    : chalk.gray;
}

function statusColor(status: string) {
  return status === "reported" ? chalk.green
    : status === "scored" ? chalk.cyan
    : status === "verified" ? chalk.yellow
    : status === "false-positive" ? chalk.strikethrough.gray
    : chalk.white;
}

function groupFindings(rows: FindingRow[]): Array<{
  fingerprint: string;
  latest: FindingRow;
  count: number;
  scans: number;
}> {
  const groups = new Map<string, FindingRow[]>();
  for (const row of rows) {
    const key = row.fingerprint ?? row.id;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  return [...groups.entries()]
    .map(([fingerprint, items]) => {
      const sorted = items.sort((a, b) => b.timestamp - a.timestamp);
      return {
        fingerprint,
        latest: sorted[0],
        count: sorted.length,
        scans: new Set(sorted.map((item) => item.scanId)).size,
      };
    })
    .sort((a, b) => b.latest.timestamp - a.latest.timestamp);
}

async function renderFindingsList(opts: FindingsListOptions): Promise<void> {
  const { pwnkitDB } = await import("@pwnkit/db");
  const db = new pwnkitDB(opts.dbPath);
  const rows = db.listFindings({
    scanId: opts.scan,
    severity: opts.severity,
    category: opts.category,
    status: opts.status,
    triageStatus: opts.triage,
    limit: opts.all ? parseInt(opts.limit ?? "50", 10) : 1000,
  }) as FindingRow[];
  db.close();

  if (rows.length === 0) {
    console.log(chalk.gray("No findings found."));
    return;
  }

  console.log("");
  console.log(chalk.red.bold("  \u25C6 pwnkit") + chalk.gray(opts.all ? ` findings (${rows.length})` : ` finding groups (${groupFindings(rows).length})`));
  console.log("");

  if (opts.all) {
    for (const f of rows.slice(0, parseInt(opts.limit ?? "50", 10))) {
      console.log(
        `  ${severityColor(f.severity)(f.severity.padEnd(8))} ${statusColor(f.status)(f.status.padEnd(14))} ${triageColor(f.triageStatus)(String(f.triageStatus ?? "new").padEnd(10))} ${chalk.white(f.title)}`
      );
      console.log(
        `  ${chalk.gray(f.id.slice(0, 8))}  ${chalk.gray(f.category)}  ${chalk.gray(`scan:${f.scanId.slice(0, 8)}`)}  ${chalk.gray(`fp:${(f.fingerprint ?? f.id).slice(0, 10)}`)}`
      );
      console.log("");
    }
    return;
  }

  for (const group of groupFindings(rows).slice(0, parseInt(opts.limit ?? "50", 10))) {
    const f = group.latest;
    console.log(
      `  ${severityColor(f.severity)(f.severity.padEnd(8))} ${statusColor(f.status)(f.status.padEnd(14))} ${triageColor(f.triageStatus)(String(f.triageStatus ?? "new").padEnd(10))} ${chalk.white(f.title)}`
    );
    console.log(
      `  ${chalk.gray(`fp:${group.fingerprint.slice(0, 10)}`)}  ${chalk.gray(f.category)}  ${chalk.gray(`${group.count} hits / ${group.scans} scans`)}  ${chalk.gray(`latest:${f.scanId.slice(0, 8)}`)}`
    );
    if (f.triageNote) {
      console.log(`  ${chalk.gray("note:")} ${chalk.dim(f.triageNote)}`);
    }
    console.log("");
  }
}

async function mutateTriage(
  id: string,
  triageStatus: FindingTriageStatus,
  triageNote: string | undefined,
  dbPath?: string,
): Promise<void> {
  const { pwnkitDB } = await import("@pwnkit/db");
  const db = new pwnkitDB(dbPath);
  try {
    const rows = db.listFindings({ limit: 5000 }) as FindingRow[];
    const finding = resolveFindingByPrefix(rows, id);
    if (!finding) {
      throw new Error(`Finding '${id}' not found.`);
    }
    db.updateFindingTriage(finding.id, triageStatus, triageNote);
    const related = finding.fingerprint ? db.getRelatedFindings(finding.fingerprint) as FindingRow[] : [finding];
    console.log(
      `${chalk.green("Updated")} ${chalk.white(related.length.toString())} ${chalk.gray("findings in family")} ${chalk.gray(`fp:${(finding.fingerprint ?? finding.id).slice(0, 10)}`)} ${chalk.gray(`→ ${triageStatus}`)}`
    );
  } finally {
    db.close();
  }
}

export function registerFindingsCommand(program: Command): void {
  const findingsCmd = withFindingsListOptions(
    program
      .command("findings")
      .description("Browse and manage persisted findings")
  ).action(async (opts: FindingsListOptions) => {
    await renderFindingsList(opts);
  });

  withFindingsListOptions(
    findingsCmd
      .command("list")
      .description("List findings from the database")
  ).action(async (opts: FindingsListOptions) => {
    await renderFindingsList(opts);
  });

  findingsCmd
    .command("show")
    .description("Show detailed information about a finding")
    .argument("<id>", "Finding ID (full or prefix)")
    .option("--db-path <path>", "Path to SQLite database")
    .action(async (id: string, opts) => {
      const { pwnkitDB } = await import("@pwnkit/db");
      const db = new pwnkitDB(opts.dbPath);

      try {
        const all = db.listFindings({ limit: 5000 }) as FindingRow[];
        const finding = resolveFindingByPrefix(all, id);
        if (!finding) {
          throw new Error(`Finding '${id}' not found.`);
        }

        const related = finding.fingerprint ? db.getRelatedFindings(finding.fingerprint) as FindingRow[] : [finding];

        console.log("");
        console.log(chalk.red.bold("  \u25C6 pwnkit") + chalk.gray(" finding detail"));
        console.log("");

        console.log(`  ${chalk.white.bold(finding.title)}`);
        console.log(`  ${severityColor(finding.severity)(finding.severity.toUpperCase())} ${chalk.gray("\u2502")} ${chalk.white(finding.status)} ${chalk.gray("\u2502")} ${triageColor(finding.triageStatus)(String(finding.triageStatus ?? "new"))} ${chalk.gray("\u2502")} ${chalk.gray(finding.category)}`);
        if (finding.score != null) {
          console.log(`  ${chalk.gray("Score:")} ${chalk.cyan(String(finding.score) + "/100")}`);
        }
        console.log("");
        console.log(`  ${chalk.gray("ID:")}         ${finding.id}`);
        console.log(`  ${chalk.gray("Scan:")}       ${finding.scanId}`);
        console.log(`  ${chalk.gray("Template:")}   ${finding.templateId}`);
        console.log(`  ${chalk.gray("Fingerprint:")} ${(finding.fingerprint ?? finding.id)}`);
        console.log(`  ${chalk.gray("Family size:")} ${related.length}`);
        console.log(`  ${chalk.gray("Time:")}       ${new Date(finding.timestamp).toISOString()}`);
        if (finding.triageNote) {
          console.log(`  ${chalk.gray("Triage:")}     ${finding.triageNote}`);
        }
        console.log("");
        console.log(`  ${chalk.gray("Description:")}`);
        console.log(`  ${finding.description}`);
        console.log("");
        console.log(`  ${chalk.gray("Evidence \u2014 Request:")}`);
        console.log(`  ${chalk.dim(finding.evidenceRequest)}`);
        console.log("");
        console.log(`  ${chalk.gray("Evidence \u2014 Response:")}`);
        console.log(`  ${chalk.dim(finding.evidenceResponse)}`);
        if (finding.evidenceAnalysis) {
          console.log("");
          console.log(`  ${chalk.gray("Evidence \u2014 Analysis:")}`);
          console.log(`  ${chalk.dim(finding.evidenceAnalysis)}`);
        }
        if (related.length > 1) {
          console.log("");
          console.log(`  ${chalk.gray("Related Findings:")}`);
          for (const row of related.slice(0, 20)) {
            console.log(`  ${chalk.gray(row.id.slice(0, 8))} ${chalk.gray(`scan:${row.scanId.slice(0, 8)}`)} ${chalk.white(row.status)} ${triageColor(row.triageStatus)(String(row.triageStatus ?? "new"))}`);
          }
        }
        console.log("");
      } catch (err) {
        console.error(chalk.red(err instanceof Error ? err.message : String(err)));
        process.exit(1);
      } finally {
        db.close();
      }
    });

  findingsCmd
    .command("accept")
    .description("Mark a finding family as accepted")
    .argument("<id>", "Finding ID (full or prefix)")
    .option("--db-path <path>", "Path to SQLite database")
    .option("--note <text>", "Optional triage note")
    .action(async (id: string, opts) => {
      await mutateTriage(id, "accepted", opts.note as string | undefined, opts.dbPath as string | undefined);
    });

  findingsCmd
    .command("suppress")
    .description("Suppress a finding family across duplicate occurrences")
    .argument("<id>", "Finding ID (full or prefix)")
    .option("--db-path <path>", "Path to SQLite database")
    .option("--note <text>", "Suppression reason")
    .action(async (id: string, opts) => {
      await mutateTriage(id, "suppressed", opts.note as string | undefined, opts.dbPath as string | undefined);
    });

  findingsCmd
    .command("reopen")
    .description("Reset a finding family back to new")
    .argument("<id>", "Finding ID (full or prefix)")
    .option("--db-path <path>", "Path to SQLite database")
    .option("--note <text>", "Optional triage note")
    .action(async (id: string, opts) => {
      await mutateTriage(id, "new", opts.note as string | undefined, opts.dbPath as string | undefined);
    });
}
