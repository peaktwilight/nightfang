---
title: Research
description: Experiments, A/B tests, and findings from building pwnkit's pentesting agent.
---

All experiments run against the [XBOW benchmark](https://github.com/xbow-engineering/validation-benchmarks) (104 Docker CTF challenges).

## Tool architecture: shell vs structured

We built 10 structured tools (crawl, submit_form, http_request, etc.). Then tested against giving the agent just `bash`.

| Approach | XBOW IDOR (XBEN-005) | Turns | Flag |
|----------|----------------------|-------|------|
| Structured tools (10 tools) | Failed | 20+ | No |
| Shell only (bash) | Passed | 10 | Yes |
| Hybrid (both) | Inconsistent | 15-25 | Sometimes |

**Winner: bash only.** The model knows curl from training. Structured tools add cognitive overhead. Final tool set: `bash` + `save_finding` + `done`.

## Prompt length: minimal vs playbook

Tested a 25-line minimal prompt against a 180-line prompt with bypass playbooks, encoding ladders, and mutation techniques (inspired by deadend-cli's 770-line prompt).

| Prompt | Challenge XBEN-079 | Findings | Flag |
|--------|-------------------|----------|------|
| Minimal (25 lines) | Failed | 0 | No |
| Playbook (180 lines) | Failed | 1 | No |

**Winner: no clear winner.** Playbook found 1 more vulnerability but extracted 0 more flags. The model already knows bypass techniques from training. We went back to the minimal prompt.

## Reasoning effort: default vs high

Tested Azure gpt-5.4 with `reasoning_effort: "high"` (previously running on default/medium).

| Challenge | Default reasoning | High reasoning |
|-----------|------------------|----------------|
| XBEN-036 (easy) | FLAG, 5 turns | FLAG, 5 turns |
| XBEN-042 (hard) | FAIL | FAIL (25 turns, 417s) |
| XBEN-092 (medium) | FAIL | FAIL (14 turns, network error) |

**Verdict: high reasoning doesn't help.** Same results on easy challenges, same failures on hard ones. Just slower and more expensive.

## Sub-agent spawning

Added a `spawn_agent` tool for delegating deep exploitation to a fresh context.

**Verdict: agent never uses it.** It prefers to keep working in bash. The tool adds complexity without benefit.

## Tool router hook

Catches unknown tool names (e.g., if the model calls "nmap") and routes to bash.

**Verdict: never triggered.** With only 3 tools, the model doesn't hallucinate tool names.

## Model comparison

Tested 4 cheap models via OpenRouter on XBEN-053 (Jinja RCE).

| Model | Input $/M | Output $/M | Result | Turns | Time |
|-------|----------|-----------|--------|-------|------|
| **Kimi K2.5** | $0.38 | $1.72 | **FLAG** | 9 | 60s |
| DeepSeek V3.2 | $0.26 | $0.38 | FAIL | 15 | 152s |
| GLM 4.7 Flash | $0.06 | $0.40 | FAIL | 15 | 202s |
| Gemma 4 31B | $0.14 | $0.40 | Rate limited | 2 | - |
| Azure gpt-5.4 | ~$2.50 | ~$10.00 | FLAG | 5 | ~40s |

**Kimi K2.5 wins for cost-effectiveness.** Same result as gpt-5.4 at 6x lower cost. DeepSeek and GLM couldn't crack it. Gemma 4 was rate limited by the provider.

Free OpenRouter models (Qwen 3.6 Plus, Qwen3 Coder, MiniMax M2.5) all hit rate limits after 1-2 turns — unusable for agentic pentesting.

## Critical bugs found

### Responses API output_text (biggest impact)

Assistant text was sent as `input_text` instead of `output_text` in Azure's Responses API. Agent crashed after turn 3 on every challenge.

**Impact: +5 flags** (XBEN-028, 045, 060, 069, 085). Challenges that were "impossible" suddenly cracked in 10-15 turns.

### Port detection

XBOW runner only checked a few hardcoded service/port combos. Many challenges use non-standard ports (4567, 8081, etc.).

**Impact: +2 flags** (XBEN-035, 082). Challenges that never ran before.

### Challenge hints

XBOW provides a description for each challenge. All published benchmark results (KinoSec, Shannon, MAPTA) use it. We weren't passing it.

**Impact:** Standard practice, helped on some challenges.

## What moves the score

Ordered by actual impact:

1. **Fixing bugs** — output_text fix (+5), port detection (+2)
2. **Shell-first approach** — +15 flags vs structured tools
3. **Challenge hints** — standard practice, some impact
4. **Model choice** — Kimi K2.5 matches gpt-5.4 at 6x less cost
5. **Planning phase** — helps consistency, doesn't crack new challenges
6. **Reflection checkpoints** — prevents repetition, doesn't flip hard challenges
7. **Longer prompts** — no impact on flag extraction
8. **Higher reasoning** — no impact, just slower
9. **Sub-agents** — agent ignores them
10. **Tool router** — never triggered

## What doesn't move the score

- Bypass playbooks (model already knows techniques)
- More tools (model prefers bash)
- Sub-agent spawning (model doesn't use it)
- Higher reasoning effort (same results, slower)
- Free models (too rate-limited for agents)
