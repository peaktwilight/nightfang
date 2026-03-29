# pwnkit Architecture

## Pipeline

```
Prepare --> Analyze --> Research --> Verify --> Report
```

### Phase 1: Prepare

Detect the target type (npm package, source code, URL), install/clone/resolve it into a local scope path for analysis.

### Phase 2: Analyze

Run static analysis tools (Semgrep, npm audit) to generate leads for the AI agents. These findings are passed as context to the research agent but are not final results on their own.

### Phase 3: Research

A single AI agent session that combines discovery, attack, and PoC generation:

1. **Map** the codebase (list files, read package.json, find entry points)
2. **Analyze** deeply (trace data flow from untrusted input to dangerous sinks)
3. **Write PoCs** for each vulnerability found (concrete exploit code, not descriptions)

The research agent uses `save_finding` to record each vulnerability with:
- `evidence_request`: the file path where the vulnerability lives
- `evidence_response`: the PoC code/command that exploits it
- `evidence_analysis`: detailed explanation of the vulnerability

### Phase 4: Verify (Blind Verification)

For each finding from the research agent, an independent verify agent is spawned. All verify agents run **in parallel** via `Promise.all`.

#### Why Blind Verification

The verify agent receives ONLY:
- The file path where the vulnerability allegedly exists
- The PoC code that allegedly exploits it
- The claimed severity

It does **not** receive:
- The researcher's reasoning or description
- The vulnerability title or category
- Any context about how the finding was discovered

This double-blind design eliminates confirmation bias. The verify agent must independently read the source file, trace whether the PoC input reaches a dangerous sink, and make its own determination. If it cannot independently confirm the vulnerability, it rejects it.

A finding survives to the final report only if the blind verify agent independently confirms it.

#### Verify Agent Behavior

- **CONFIRMED**: The agent calls `save_finding` with its own independent assessment
- **REJECTED**: The agent calls `done` with `"REJECTED: [reason]"`

Verify agents always use the API runtime (cheaper and faster for small focused tasks), regardless of what runtime the research agent used.

### Phase 5: Report

Build the final report from confirmed findings, compute severity counts, and return the structured `PipelineReport`.

## Event Flow

Events are emitted throughout the pipeline via `onEvent` callbacks:

| Event Type | Stage | Description |
|---|---|---|
| `stage:start` | `prepare` | Target resolution begins |
| `stage:end` | `prepare` | Target ready |
| `stage:start` | `analyze` | Static analysis running |
| `stage:end` | `analyze` | Static analysis complete |
| `stage:start` | `research` | Research agent begins |
| `finding` | `research` | A new vulnerability discovered |
| `stage:end` | `research` | Research agent complete |
| `stage:start` | `verify` | Blind verification begins |
| `verify:result` | `verify` | Individual finding confirmed/rejected |
| `stage:end` | `verify` | All verification complete |

## Runtime Selection

The research agent can use any available runtime (Claude Code CLI, Codex, API with native tool_use). The verify agents are pinned to the API runtime for cost efficiency since they perform small, focused tasks (read one file, trace one PoC).
