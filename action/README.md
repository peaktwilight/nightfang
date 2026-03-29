# pwnkit GitHub Action

Run pwnkit in CI, generate JSON + SARIF artifacts, and fail builds on a configurable severity threshold.

## Usage

```yaml
name: AI Security Scan
on: [push, pull_request]

permissions:
 contents: read
 security-events: write

jobs:
 pwnkit:
  runs-on: ubuntu-latest
  steps:
   - uses: actions/checkout@v4

   - name: Run pwnkit
    uses: peaktwilight/pwnkit/action@v1
    with:
     target: ${{ secrets.STAGING_API_URL }}
     depth: default
     runtime: api
     mode: probe
     fail-on-severity: high

   - name: Upload SARIF
    uses: github/codeql-action/upload-sarif@v3
    with:
     sarif_file: pwnkit-report/report.sarif
```

## Deep Scan Example

`deep` and `mcp` modes require a process runtime and any needed CLI to already be available on the runner.

```yaml
jobs:
 pwnkit-deep:
  runs-on: ubuntu-latest
  steps:
   - uses: actions/checkout@v4

   - name: Install Claude Code CLI
    run: npm install --global @anthropic-ai/claude-code

   - name: Run pwnkit deep scan
    uses: peaktwilight/pwnkit/action@v1
    with:
     target: ${{ secrets.STAGING_API_URL }}
     runtime: claude
     mode: deep
     repo-path: .
     timeout: 60000
     fail-on-severity: high
```

## Inputs

- `target` (required): Target URL to scan.
- `depth` (optional, default `default`): `quick`, `default`, or `deep`.
- `runtime` (optional, default `api`): `api`, `claude`, `codex`, `gemini`, ``, or `auto`.
- `mode` (optional, default `probe`): `probe`, `deep`, or `mcp`.
- `repo-path` (optional): Local repo path to analyze during `deep` mode.
- `timeout` (optional, default `30000`): Request/runtime timeout in milliseconds.
- `fail-on-severity` (optional, default `high`): `critical`, `high`, `medium`, `low`, `info`, or `none`.
- `report-dir` (optional, default `pwnkit-report`): Output directory for reports.
- `pwnkit-version` (optional, default `latest`): npm version of pwnkit-cli to install.

## Outputs

- `json-report-file`: Absolute path to generated JSON report.
- `sarif-report-file`: Absolute path to generated SARIF report.
- `total-findings`: Number of findings in the report.
