---
title: Benchmark
description: Run benchmarks, understand the challenge format, and compare results.
---

pwnkit ships a built-in benchmark suite for measuring detection accuracy across vulnerability categories. Each challenge hides a `FLAG{...}` behind a real vulnerability — the scanner must exploit the vulnerability to extract the flag.

## Running benchmarks

```bash
# Baseline (no API key, deterministic checks only)
pnpm bench

# Quick subset
pnpm bench:quick

# Full agentic pipeline with AI analysis
pnpm bench --agentic --runtime auto
```

The benchmark spins up test targets (vulnerable servers), runs pwnkit against them, and checks whether each flag was captured.

## Challenge format

Each benchmark challenge is a self-contained vulnerable application with:

- A specific vulnerability category (e.g., CORS misconfiguration, prompt injection)
- A hidden `FLAG{...}` string that can only be extracted by exploiting the vulnerability
- A deterministic or agentic detection path

The scanner passes a challenge if it extracts the flag. This is a binary, objective metric — no subjective severity scoring.

## Vulnerability categories

The benchmark covers 10 challenges across 9 categories:

| Category | Challenge | Detection Method |
|----------|-----------|-----------------|
| CORS Misconfiguration | Misconfigured `Access-Control-Allow-Origin` | Deterministic |
| Sensitive Path Exposure | Exposed `.git/config` | Deterministic |
| SSRF via MCP Tool | Server-side request forgery through MCP tool call | Deterministic |
| Prompt Injection | Direct prompt injection to override system instructions | Agentic (AI required) |
| System Prompt Extraction | Tricking the model into revealing its system prompt | Agentic (AI required) |
| PII Data Leakage | Extracting personally identifiable information | Agentic (AI required) |
| Encoding Bypass | Using encoding tricks to bypass content filters | Agentic (AI required) |
| DAN Jailbreak | "Do Anything Now" style jailbreak attacks | Agentic (AI required) |
| Multi-Turn Escalation | Gradually escalating privileges over multiple turns | Agentic (AI required) |
| Indirect Prompt Injection | Injection via data the model retrieves (not user input) | Agentic (AI required) |

## Baseline results

Running the benchmark without an API key (deterministic checks only):

| Category | Result |
|----------|--------|
| CORS Misconfiguration | Pass |
| Sensitive Path (.git/config) | Pass |
| SSRF via MCP Tool | Pass |
| Prompt Injection | Fail (needs AI) |
| System Prompt Extraction | Fail (needs AI) |
| PII Data Leakage | Fail (needs AI) |
| Encoding Bypass | Fail (needs AI) |
| DAN Jailbreak | Fail (needs AI) |
| Multi-Turn Escalation | Fail (needs AI) |
| Indirect Prompt Injection | Fail (needs AI) |

**Baseline detection: 30%** — web and MCP deterministic checks work out of the box. The remaining 70% requires AI-powered agentic analysis.

## Comparison with other tools

### vs XBOW

The [XBOW benchmark](https://github.com/xbow-engineering/validation-benchmarks) consists of 104 CTF challenges focused on traditional web vulnerabilities (SQLi, XSS, SSRF, auth bypass). pwnkit's benchmark focuses on AI/LLM-specific attack surfaces that XBOW does not cover: prompt injection, jailbreaks, system prompt extraction, encoding bypasses, and multi-turn escalation.

The two benchmarks are complementary. XBOW tests classic web security; pwnkit tests the AI-specific attack surface.

### vs KinoSec

KinoSec focuses on LLM red-teaming with template-based probes. pwnkit's agentic approach adapts its attacks based on model responses rather than running a fixed set of templates. The benchmark captures this difference: challenges like multi-turn escalation and encoding bypass require adaptive strategies that template runners cannot perform.

## Adding custom challenges

Benchmark challenges live in the `test-targets` package. Each challenge is a small HTTP server with a planted vulnerability. To add a new challenge:

1. Create a new server file in `test-targets/` with a hidden `FLAG{...}`
2. Register the challenge in the benchmark configuration
3. Run `pnpm bench` to verify detection
