---
title: Agent Techniques Reference
description: Evidence-based techniques for improving autonomous pentesting agents, with implementation details and expected impact.
---

A catalog of every technique we have evaluated for improving pwnkit's autonomous pentesting agents. Each entry includes the source evidence, expected impact, implementation status, and enough detail to ship it.

## Shipped Techniques

### 1. Early-Stop + Retry

**What:** If the agent reaches 50% of its turn budget without calling `save_finding`, abort the current attempt and retry with a fresh context and a different strategy prompt. MAPTA data shows successful exploits complete in 15-20 API calls -- if nothing has landed by halfway, the current approach is unlikely to work.

**Source:** MAPTA benchmark analysis; internal A/B testing on XBOW challenges.

**Impact:** Recovers ~15-20% of runs that would otherwise exhaust their full budget on a dead-end approach. The retry gets a clean context window and explicit instruction to try a different vector.

**Implementation:** `packages/core/src/agent/native-loop.ts` -- the `NativeAgentState` type carries `earlyStopNoProgress` and `attemptSummary` fields. The main loop checks at each turn whether `turnCount >= floor(maxTurns / 2)` and `!saveFindingCalled` and `retryCount === 0`. When triggered, the loop breaks and the caller (`packages/core/src/agentic-scanner.ts`) launches a second `runNativeAgentLoop` with `retryCount: 1`, a rewritten system prompt emphasizing a different strategy, and the remaining turn budget. Results from both attempts are merged.

**Key details:**
- Only fires for `role === "attack"` with `maxTurns >= 10` (below that, overhead is not worth it).
- The retry system prompt includes `attemptSummary` so the second attempt knows what already failed.
- `retryCount: 1` disables early-stop on the second attempt to avoid infinite retry chains.

---

### 2. Exploit Script Templates

**What:** Inject ready-made exploit script patterns directly into the system prompt so the agent can copy-paste and adapt them instead of writing from scratch. Covers blind SQLi timing extraction, SSTI-to-RCE chains (Jinja2), and multi-step auth with cookie jars.

**Source:** MAPTA benchmark (0% success on blind SQLi without templates); internal testing showing agents waste 5-8 turns reinventing timing scripts.

**Impact:** Blind SQLi goes from 0% to solvable. SSTI exploitation drops from ~6 turns of trial-and-error to 2 (detect + RCE payload). Auth chains go from frequent cookie-loss failures to reliable first-attempt success.

**Implementation:** `packages/core/src/agent/prompts.ts` -- the `shellPentestPrompt()` function includes a "Script Patterns" section with three templates:

| Template | Trigger | What it does |
|----------|---------|--------------|
| Blind SQLi timing | Any blind injection scenario | Python script with `requests` + `time.time()` to extract characters via `SLEEP`/`IF` |
| SSTI to RCE | `{{7*7}}` returns 49 | Jump straight to `__import__('os').popen('cat /flag*').read()` |
| Multi-step auth | Login form present | `curl -c /tmp/jar -b /tmp/jar` chain: login, IDOR probe, path traversal |

**Key details:**
- Templates use `$TARGET` env var (set by the runner) so they work without URL hardcoding.
- The blind SQLi template iterates positions 1-64 and ASCII 32-127, printing characters as found.
- SSTI template skips the gradual escalation (`config`, `config.items()`, etc.) and goes directly to RCE -- the detection step already confirmed the vulnerability class.

---

### 3. Loop / Oscillation Detection

**What:** Track the last 12 tool call fingerprints (name + first 100 chars of arguments). Detect two patterns: A-A-A (same command 3x in a row) and A-B-A-B (two commands alternating for 2+ cycles). When detected, inject a warning message into the conversation. Each pattern signature fires at most once to avoid warning spam.

**Source:** BoxPwnr (97.1% on XBOW). Their analysis showed agents commonly enter repeat loops that consume 30-50% of the budget.

**Impact:** Breaks loops within 1 turn of detection. Saves 3-8 turns per affected run. Estimated ~5% overall solve rate improvement.

**Implementation:** `packages/core/src/agent/native-loop.ts` -- the `LoopDetector` class.

```typescript
// Fingerprint: tool name + first 100 chars of JSON args
// Window: last 12 entries (windowSize * 2)
// Pattern 1: fp(n) === fp(n-1) === fp(n-2)
// Pattern 2: fp(n-3) === fp(n-1) && fp(n-2) === fp(n) && fp(n-3) !== fp(n-2)
```

**Key details:**
- `firedPatterns` set prevents the same pattern signature from triggering twice. This is important -- repeated warnings cause the agent to fixate on the warning itself.
- The warning text instructs a "COMPLETELY DIFFERENT approach" rather than a minor variation, which testing showed is more effective at breaking the cycle.
- History is bounded to `windowSize * 2 = 12` entries to keep memory constant.

---

### 4. Context Compaction

**What:** When input tokens exceed 30k and message count exceeds 15, compress the middle of the conversation to a regex-extracted summary. Preserves: the system prompt / initial message, the last 8 messages, and any messages containing critical patterns (credentials, flags, findings). No extra LLM call -- pure regex extraction.

**Source:** BoxPwnr (60% context threshold triggers compaction); CHAP paper (NDSS 2026) documenting context window degradation in long agent sessions.

**Impact:** Prevents context window overflow that causes hallucinations and instruction-following degradation in turns 20+. BoxPwnr attributes part of their 97.1% XBOW score to this technique.

**Implementation:** `packages/core/src/agent/native-loop.ts` -- the `compactMessages()` function and supporting helpers.

| Component | Purpose |
|-----------|---------|
| `CRITICAL_PATTERNS` | 14 regexes matching credentials, flags, tokens, keys, secrets |
| `SUMMARY_EXTRACT_PATTERNS` | 13 regexes extracting URLs, IPs, HTTP status codes, file paths, error keywords |
| `isCriticalMessage()` | Tests a message against all critical patterns |
| `extractKeyFindings()` | Scans all middle messages, extracts matching lines, deduplicates, caps at 80 entries |
| `compactMessages()` | Rebuilds conversation: first message + assistant ack + summary + critical messages + tail 8 |

**Key details:**
- Only compacts once per session (`contextCompacted` flag) to avoid cascading information loss.
- Role alternation is maintained after compaction (user/assistant/user/...) to satisfy the API contract.
- The summary is inserted as a user message so the model treats it as ground truth, not its own prior reasoning.
- `save_finding` calls found in the middle are preserved verbatim in the summary (not just the regex-extracted lines).

---

## Not Yet Implemented

### 5. Context Relay / Cognitive Refresh

**What:** Full context reset with a structured handoff summary generated by an LLM call. Unlike compaction (technique 4), this starts an entirely new conversation. The current session is summarized into a structured handoff document (discovered endpoints, confirmed vulns, credentials, failed approaches), then a fresh agent session is initialized with that summary as its starting context.

**Source:** CHAP paper (NDSS 2026); Cyber-AutoAgent architecture.

**Impact:** CHAP reports this as their primary technique for solving challenges that require 40+ turns. Expected +5-10% on long-running scans.

**Implementation sketch:**
- Add a `generateHandoffSummary(state: NativeAgentState): Promise<string>` function that makes a single LLM call with the full conversation and a structured extraction prompt (endpoints, creds, findings, failed approaches, next steps).
- In `runNativeAgentLoop`, trigger at ~70% budget if `!saveFindingCalled` (later threshold than early-stop since this is more expensive).
- Start a new `runNativeAgentLoop` with the handoff summary prepended to the initial user message.
- Different from early-stop retry: this preserves accumulated knowledge via LLM summarization rather than just `attemptSummary`.

**Location:** `packages/core/src/agent/native-loop.ts` (new function + trigger logic). **Difficulty:** Medium. Requires one extra LLM call (~2k tokens) per relay.

---

### 6. Dynamic Vulnerability Playbooks

**What:** In turns 1-3, classify the target's vulnerability profile from initial recon output (curl response headers, error messages, tech stack identifiers). Then inject a focused playbook for the detected vuln class (SQLi, SSTI, IDOR, XSS, SSRF, LFI) into the conversation as a user message.

**Source:** CurriculumPT: +18 percentage points on their benchmark with curriculum-style targeted guidance.

**Impact:** Expected +10-15pp on challenges where the vuln class is identifiable from recon. Reduces wasted turns on irrelevant attack vectors.

**Implementation sketch:**
- Create `packages/core/src/agent/playbooks.ts` with a `classifyVulnType(reconOutput: string): VulnType[]` function using keyword/pattern matching (no LLM call needed).
- Detection signals: `PHPSESSID` + form fields = SQLi likely; `{{` in reflected output = SSTI; sequential IDs in URLs = IDOR; `Jinja2`/`Flask` in headers = SSTI; file parameter names = LFI.
- Each `VulnType` maps to a playbook string (similar to existing templates in `shellPentestPrompt` but more detailed and vuln-specific).
- Inject the playbook as a user message after turn 3 if classification confidence > 0.7.
- Playbooks should include: detection confirmation steps, exploitation sequence, flag extraction commands, common bypasses for WAFs/filters.

**Location:** New file `packages/core/src/agent/playbooks.ts`, integration in `native-loop.ts`. **Difficulty:** Low-Medium. Mostly prompt engineering + pattern matching.

---

### 7. EGATS Attack Tree Search

**What:** Maintain an external JSON attack tree where each node represents an attack path (e.g., "SQLi on /search?q=", "SSTI on /render") with a promise score. Use UCB (Upper Confidence Bound) selection to balance exploration of untried paths vs. exploitation of promising ones. Prune nodes when estimated difficulty > 0.8 after 3 failed attempts.

**Source:** EGATS paper; meta-analysis showing +9pp on XBOW with tree-based search.

**Impact:** Expected +5-9pp. Most impactful on targets with large attack surfaces where the agent currently picks paths randomly.

**Implementation sketch:**
```typescript
interface AttackNode {
  id: string;
  path: string;           // e.g., "SQLi > /search > UNION"
  parentId: string | null;
  attempts: number;
  successes: number;
  difficulty: number;      // 0-1, updated after each attempt
  pruned: boolean;
  children: string[];
}

interface AttackTree {
  nodes: Record<string, AttackNode>;
  rootIds: string[];
}

function selectNext(tree: AttackTree): AttackNode {
  // UCB1: score = successes/attempts + C * sqrt(ln(totalAttempts) / attempts)
  // C = 1.4 (standard exploration constant)
  // Return unpruned node with highest UCB score
}
```

- Store tree in `/tmp/attack-tree.json` (readable by bash tool for debugging).
- After each tool call batch, update the current node's attempt count and difficulty estimate.
- Prune rule: `difficulty > 0.8 && attempts >= 3`.
- Inject the selected node's path into the next turn's user message as the recommended focus.

**Location:** New file `packages/core/src/agent/attack-tree.ts`, integration in `native-loop.ts` main loop. **Difficulty:** High. Requires mapping tool call results back to tree nodes.

---

### 8. Evidence-Gated Branching

**What:** Before committing turns to exploitation, verify preconditions: does the endpoint exist? Is auth required? Is the parameter actually injectable? Structure the agent's approach as: recon (2-3 turns) -> precondition checks (1-2 turns) -> exploitation (remaining turns). Don't waste turns on UNION SELECT if the parameter is not even reflected in the response.

**Source:** MAPTA framework. Their analysis shows agents waste 30-40% of turns on exploitation attempts where preconditions are not met.

**Impact:** Expected +5-8pp by redirecting wasted exploitation turns to viable attack paths.

**Implementation sketch:**
- Add a precondition check phase to `buildContinuePrompt()` at ~20% budget. Inject a message: "Before exploiting, confirm: (1) endpoint responds, (2) parameter is reflected/processed, (3) no WAF blocking. List confirmed preconditions, then proceed."
- Alternatively, implement as a structured check in the loop: after turn 3, parse the conversation for confirmed endpoints and inject a "precondition summary" message.
- Lighter version: add precondition language to the `shellPentestPrompt` attack instructions (e.g., "Before running a SQLi UNION chain, first confirm the parameter is injectable with `' OR 1=1--` and check for SQL error messages").

**Location:** `packages/core/src/agent/prompts.ts` (prompt changes) or `native-loop.ts` (structured check). **Difficulty:** Low for prompt-only version, Medium for structured check.

---

### 9. Self-Rewriting Prompts

**What:** Every 20 turns, the agent pauses to analyze what has worked and what has failed in the current session, then rewrites its own system prompt guidance. Protected critical sections (authorization scope, tool definitions, output format) cannot be modified. Only the strategy/approach sections are rewritable.

**Source:** Cyber-AutoAgent. Jumped from 46% to 84% on their benchmark.

**Impact:** Expected +10-15pp on long sessions (30+ turns). Less impactful on short sessions where early-stop + retry handles the strategy pivot.

**Implementation sketch:**
- Split the system prompt into `PROTECTED` and `REWRITABLE` sections using delimiters.
- At turn 20 (and every 20 turns after), inject a meta-prompt: "Analyze your last 20 turns. What worked? What failed? Rewrite your attack strategy. Output a JSON block with key `revised_strategy`."
- Parse the agent's response for the JSON block, splice it into the `REWRITABLE` section, and continue.
- Guard rails: max rewrite length (500 tokens), regex validation that protected sections are unchanged, rollback if the rewrite is empty or malformed.

**Location:** `packages/core/src/agent/native-loop.ts` (new reflection checkpoint in main loop). **Difficulty:** Medium. The tricky part is parsing the rewrite reliably from the agent's output.

---

### 10. Best-of-N Racing

**What:** Launch 2-3 agent instances in parallel with different strategy prompts (aggressive/broad spray, methodical/sequential, creative/unusual vectors). Take the first flag found. Cancel remaining agents.

**Source:** Pass@8 vs Pass@1 gap analysis across multiple benchmarks. The gap is consistently 15-25pp, meaning many challenges are solvable but not reliably -- parallelism converts probabilistic success into reliable success.

**Impact:** Expected +5-8 flags at 3x cost. Most cost-effective technique per additional flag if budget allows.

**Implementation sketch:**
```typescript
async function raceAgents(
  configs: NativeAgentConfig[],  // 2-3 configs with different systemPrompts
  runtime: NativeRuntime,
  db: pwnkitDB,
): Promise<NativeAgentState> {
  const controller = new AbortController();
  const promises = configs.map(cfg =>
    runNativeAgentLoop({ config: cfg, runtime, db, signal: controller.signal })
  );
  // Return first that finds a flag
  const winner = await Promise.race(
    promises.map(p => p.then(s => {
      if (s.findings.length > 0) { controller.abort(); return s; }
      throw new Error("no findings");
    }))
  ).catch(() => Promise.all(promises).then(states =>
    states.reduce((best, s) => s.findings.length > best.findings.length ? s : best)
  ));
  return winner;
}
```

- Requires adding `AbortSignal` support to `runNativeAgentLoop`.
- Strategy prompts: (1) "Start with the most common vulnerability class for this tech stack", (2) "Systematically test every input field in order", (3) "Focus on unusual vectors: race conditions, parameter pollution, encoding bypasses".

**Location:** New file `packages/core/src/agent/race.ts`, called from `agentic-scanner.ts`. **Difficulty:** Medium. Main complexity is abort signal propagation and result merging.

---

### 11. Progress Handoff Between Attempts

**What:** When retrying (after early-stop or failure), inject the prior attempt's structured findings into the new session: discovered credentials, confirmed endpoints, response patterns, and explicitly failed approaches. This is BoxPwnr's `{{ progress_content }}` template variable.

**Source:** BoxPwnr. Their retry mechanism injects prior progress, which they credit for converting ~20% of retries into successes.

**Impact:** Expected +3-5pp improvement on retry success rate. Currently our retry includes only `attemptSummary` (a one-line description). Structured progress would be significantly richer.

**Implementation sketch:**
- Extend `NativeAgentState.attemptSummary` from a string to a structured object:
  ```typescript
  interface AttemptProgress {
    discoveredEndpoints: string[];
    credentials: Array<{ username: string; password: string; endpoint: string }>;
    confirmedVulns: string[];        // e.g., "SQLi on /search?q="
    failedApproaches: string[];      // e.g., "UNION SELECT on /login -- WAF blocked"
    techStack: string[];             // e.g., ["Flask", "SQLite", "Jinja2"]
  }
  ```
- Populate this by parsing tool call history (regex extraction from bash outputs and http responses).
- In the retry system prompt, render this as a structured "Prior Attempt Results" section.

**Location:** `packages/core/src/agent/native-loop.ts` (extraction logic), `packages/core/src/agentic-scanner.ts` (injection into retry prompt). **Difficulty:** Low-Medium. Mostly regex extraction from existing conversation data.

---

### 12. External Working Memory

**What:** The agent writes its plan, discovered credentials, and current state to `/tmp/plan.json` via bash commands. At reflection checkpoints (every 5-10 turns), the file is read back and injected into the conversation. This prevents the "credential forgetting" problem where the agent discovers a password early, then fails to use it 15 turns later because it has scrolled out of the effective context window.

**Source:** TermiAgent. Their ablation shows -67% success rate without external working memory.

**Impact:** Expected +10-15pp on challenges requiring multi-step exploitation with credentials or session tokens.

**Implementation sketch:**
- Add to `shellPentestPrompt`: "After discovering ANY credential, endpoint, or important finding, write it to /tmp/plan.json using bash. Format: `echo '{\"creds\": [...], \"endpoints\": [...], \"plan\": \"...\"}' > /tmp/plan.json`"
- In `native-loop.ts`, at every 5th turn, inject a user message: "Review your working memory. Run: `cat /tmp/plan.json` and update your plan based on current progress."
- The agent naturally maintains this file through bash -- no new tools or infrastructure needed.
- Alternative (lower-effort): at reflection checkpoints, automatically run `cat /tmp/plan.json` via the tool executor and inject the result. This ensures the memory is always refreshed even if the agent forgets to read it.

**Location:** `packages/core/src/agent/prompts.ts` (prompt addition), `packages/core/src/agent/native-loop.ts` (reflection checkpoint injection). **Difficulty:** Low. Leverages existing bash tool.

---

### 13. RAG from Prior Solves

**What:** Build a patterns database from successful exploit runs. When starting a new challenge, match the target's characteristics (tech stack, response patterns, endpoint structure) against prior solutions using keyword overlap. Inject the top 3 matching prior solutions as hints in the system prompt.

**Source:** General RAG-for-agents literature; internal observation that agents re-derive the same exploit chains across similar challenges.

**Impact:** Expected +5-10pp on benchmarks with recurring vulnerability patterns (XBOW has many similar challenges). Diminishing returns as the agent's base capability improves.

**Implementation sketch:**
- Create `packages/core/src/agent/patterns-db.ts`:
  ```typescript
  interface SolvePattern {
    id: string;
    techStack: string[];         // ["Flask", "Jinja2", "SQLite"]
    vulnTypes: string[];         // ["SSTI", "SQLi"]
    keyPayloads: string[];       // ["{{7*7}}", "' UNION SELECT..."]
    exploitChain: string;        // "Detect SSTI via {{7*7}} -> escalate to RCE -> cat /flag"
    turnCount: number;
    keywords: string[];          // for matching
  }
  ```
- After each successful scan (flag extracted), persist a `SolvePattern` to SQLite.
- On new scan start, run `matchPatterns(reconOutput: string): SolvePattern[]` using TF-IDF or simple keyword overlap scoring against the patterns DB.
- Inject top 3 matches into the system prompt: "Similar challenges were solved with these approaches: ..."

**Location:** New file `packages/core/src/agent/patterns-db.ts`, integration in `agentic-scanner.ts` (before attack phase). **Difficulty:** Medium. Requires a persistence layer and matching algorithm. Could start with a simple JSON file and keyword overlap before investing in proper vector search.

---

## Summary Table

| # | Technique | Status | Expected Impact | Difficulty | Primary File |
|---|-----------|--------|----------------|------------|--------------|
| 1 | Early-Stop + Retry | Shipped | +15-20% recovery | -- | `native-loop.ts`, `agentic-scanner.ts` |
| 2 | Exploit Script Templates | Shipped | Blind SQLi: 0% to solvable | -- | `prompts.ts` |
| 3 | Loop/Oscillation Detection | Shipped | +5% (saves 3-8 turns) | -- | `native-loop.ts` |
| 4 | Context Compaction | Shipped | Prevents 20+ turn degradation | -- | `native-loop.ts` |
| 5 | Context Relay | Not impl | +5-10% on long scans | Medium | `native-loop.ts` |
| 6 | Dynamic Playbooks | Not impl | +10-15pp | Low-Medium | New: `playbooks.ts` |
| 7 | EGATS Attack Tree | Not impl | +5-9pp | High | New: `attack-tree.ts` |
| 8 | Evidence-Gated Branching | Not impl | +5-8pp | Low | `prompts.ts` |
| 9 | Self-Rewriting Prompts | Not impl | +10-15pp (long sessions) | Medium | `native-loop.ts` |
| 10 | Best-of-N Racing | Not impl | +5-8 flags (3x cost) | Medium | New: `race.ts` |
| 11 | Progress Handoff | Not impl | +3-5pp on retries | Low-Medium | `native-loop.ts`, `agentic-scanner.ts` |
| 12 | External Working Memory | Not impl | +10-15pp | Low | `prompts.ts`, `native-loop.ts` |
| 13 | RAG from Prior Solves | Not impl | +5-10pp | Medium | New: `patterns-db.ts` |

**Recommended implementation order** (highest impact per effort): 12 (Working Memory) > 8 (Evidence-Gated) > 6 (Playbooks) > 11 (Progress Handoff) > 5 (Context Relay) > 9 (Self-Rewriting) > 10 (Racing) > 13 (RAG) > 7 (Attack Tree).
