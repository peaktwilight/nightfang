---
title: Commands
description: Complete reference for all pwnkit CLI commands.
---

All commands are available via `npx pwnkit-cli <command>`. You can also skip the subcommand and let auto-detect figure it out (see [Getting Started](/getting-started/)).

## scan

Probe AI/LLM apps or web apps for vulnerabilities.

```bash
# Scan an LLM API
npx pwnkit-cli scan --target https://api.example.com/chat

# Scan a traditional web app
npx pwnkit-cli scan --target https://example.com --mode web

# Deep scan with Claude Code CLI
npx pwnkit-cli scan --target https://api.example.com/chat --depth deep --runtime claude
```

**Key flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--target <url>` | The URL to scan | (required) |
| `--mode <mode>` | Scan mode: `llm` or `web` | `llm` |
| `--depth <depth>` | Scan depth: `quick`, `default`, `deep` | `default` |
| `--runtime <rt>` | Runtime: `api`, `claude`, `codex`, `gemini`, `auto` | `api` |
| `--verbose` | Show animated attack replay | `false` |

## audit

Install and security-audit any npm package with static analysis and AI review.

```bash
npx pwnkit-cli audit express@4.18.2
npx pwnkit-cli audit react --depth deep --runtime claude
```

The package is installed in a sandbox, scanned with semgrep, and then reviewed by an AI agent that traces data flow and looks for supply-chain vulnerabilities.

**Key flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `<package>` | Package name (with optional version) | (required) |
| `--depth` | Scan depth: `quick`, `default`, `deep` | `default` |
| `--runtime` | Runtime to use | `api` |

## review

Deep source code security review of a local repo or GitHub URL.

```bash
# Review a local directory
npx pwnkit-cli review ./my-ai-app

# Review a GitHub repo (cloned automatically)
npx pwnkit-cli review https://github.com/user/repo

# Diff-aware review against a base branch
npx pwnkit-cli review ./my-repo --diff-base origin/main --changed-only
```

**Key flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `<path-or-url>` | Local path or GitHub URL | (required) |
| `--depth` | Scan depth | `default` |
| `--runtime` | Runtime to use | `api` |
| `--diff-base <ref>` | Base branch for diff-aware review | (none) |
| `--changed-only` | Only review changed files | `false` |

## resume

Resume a persisted review or audit scan by its scan ID.

```bash
npx pwnkit-cli resume <scan-id>
```

Useful when a long-running deep scan was interrupted or when you want to continue where a previous run left off.

## dashboard

Open the local verification workbench for board-based triage, evidence review, and scan provenance.

```bash
npx pwnkit-cli dashboard
npx pwnkit-cli dashboard --port 48123
```

The dashboard provides a Kanban-style board for triaging findings, reviewing evidence, and tracking active scans. It runs entirely locally.

**Key flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--port <port>` | Port to serve the dashboard on | `48120` |

## history

Browse past scans with status, depth, findings count, and duration.

```bash
npx pwnkit-cli history
npx pwnkit-cli history --limit 20
```

**Key flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--limit <n>` | Number of scans to show | `10` |

## findings

Query, filter, and inspect verified findings across all scans. Findings are persisted in a local SQLite database.

```bash
# List all findings
npx pwnkit-cli findings list

# Filter by severity
npx pwnkit-cli findings list --severity critical

# Filter by category and status
npx pwnkit-cli findings list --category prompt-injection --status confirmed

# Inspect a specific finding with full evidence
npx pwnkit-cli findings show NF-001

# Triage findings
npx pwnkit-cli findings accept <finding-id> --note "confirmed and tracked"
npx pwnkit-cli findings suppress <finding-id> --note "known test fixture"
npx pwnkit-cli findings reopen <finding-id>
```

**Finding lifecycle:** `discovered` -> `verified` -> `confirmed` -> `scored` -> `reported` (or `false-positive` if verification fails).

**Subcommands:**

| Subcommand | Description |
|------------|-------------|
| `list` | List findings with optional filters |
| `show <id>` | Show a finding with full evidence |
| `accept <id>` | Accept a finding as confirmed |
| `suppress <id>` | Suppress a finding (known false positive or accepted risk) |
| `reopen <id>` | Reopen a previously suppressed finding |
