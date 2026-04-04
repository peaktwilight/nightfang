---
title: "why i built pwnkit"
date: "2026-03-27"
description: "from 7 CVEs and manual pentesting to autonomous AI agents that re-exploit every finding to kill false positives."
readTime: "8 min read"
---

i've spent years breaking software. seven published CVEs across node-forge, uptime-kuma, liquidjs, picomatch, and jspdf. the pattern was always the same: find a vulnerability, write the proof of concept, write the report. repeat.

then AI happened to security.

suddenly every app had a chatbot. every developer tool had an AI copilot. MCP servers started popping up everywhere, exposing tool schemas that nobody was auditing. companies were shipping AI features as fast as they could, and the attack surface was growing faster than anyone could manually test.

## the problem i kept hitting

when i started doing AI security assessments, the tooling was... not there. the options were:

- **promptfoo** for red-teaming LLM outputs. good for eval, but it's a test runner, not a pentester. no verification, no proof of exploit.
- **garak** for LLM probing. solid attack coverage, but Python-heavy setup and no MCP or supply chain coverage.
- **semgrep + nuclei** for traditional scanning. can't see AI-specific attack surfaces at all.

none of them did what i actually needed: scan an AI endpoint, attack it systematically, *verify* that the findings are real, and give me a report i could hand to a client. i was stitching together 4-5 tools for every engagement and still writing manual PoCs for every finding.

## the insight: attackers verify, tools don't

the biggest waste of time in security isn't finding vulnerabilities. it's triaging false positives. every scanner i've used produces a mountain of "possible" findings that turn out to be nothing. you spend 80% of your time proving that things *aren't* broken.

real attackers don't have this problem. they try to exploit something. if it works, it's real. if it doesn't, they move on. that's the workflow i wanted to automate.

## autonomous agents, one pipeline

pwnkit runs autonomous agents in sequence, each specialized for a phase:

<div class="grid grid-cols-3 gap-4 my-8">
  <div class="bg-night-lighter border border-white/5 rounded-lg p-4">
    <div class="text-xs font-mono text-emerald-400 mb-1">01 research</div>
    <p class="text-sm text-smoke m-0">maps the attack surface, crafts payloads, launches multi-turn attacks, and writes PoC code &mdash; all in one agent session.</p>
  </div>
  <div class="bg-night-lighter border border-white/5 rounded-lg p-4">
    <div class="text-xs font-mono text-blue-400 mb-1">02 verify</div>
    <p class="text-sm text-smoke m-0">blind verification &mdash; gets ONLY the PoC and file path, independently reproduces each finding. can't reproduce? killed.</p>
  </div>
  <div class="bg-night-lighter border border-white/5 rounded-lg p-4">
    <div class="text-xs font-mono text-purple-400 mb-1">03 report</div>
    <p class="text-sm text-smoke m-0">SARIF for GitHub Security tab. markdown and JSON with full evidence chains. only confirmed findings.</p>
  </div>
</div>

the verification agent is what makes this different. it doesn't trust the attack agent's output. it independently re-exploits each finding, captures proof artifacts, and assigns a confidence score. if a "prompt injection" only works with a contrived input that a real user would never send, it gets flagged and downgraded.

### blind verification

most security tools report everything that "might" be a bug. pwnkit does something different.

after the research agent finds a vulnerability and writes a proof-of-concept, a separate verify agent gets ONLY the PoC code and the file path &mdash; not the reasoning. it independently traces the data flow and tries to reproduce the finding.

if it can't reproduce &rarr; the finding is killed. no false positives in the report.

this is the same principle as double-blind peer review: the reviewer doesn't know the researcher's reasoning, so they can't be biased by it.

## not just LLMs

AI security isn't just about prompt injection. the attack surface includes:

- **AI/LLM apps** &mdash; ChatGPT, Claude, Llama APIs, custom chatbots
- **MCP servers** &mdash; tool schemas, validation, auth, poisoning vectors
- **npm packages** &mdash; supply chain attacks, malicious code, dependency risk
- **source code** &mdash; AI-powered deep security review of any repo
- **web apps** &mdash; AI copilots, RAG pipelines, agent APIs

that's why pwnkit has five commands, not one. `scan` for AI/LLM apps, `audit` for packages, `review` for source code, plus `findings` and `history` to track everything.

## bring your own tools

pwnkit is an agentic harness &mdash; it doesn't come with its own AI model. you bring your own:

- **API mode:** use your own API key (OpenRouter, Anthropic, OpenAI). pay per token.
- **Claude Code CLI:** use `--runtime claude` to run scans through your Claude Code subscription.
- **Codex CLI:** use `--runtime codex` to run through Codex. great for verification and code review.

the harness orchestrates the research-verify pipeline. the model does the thinking. you choose what powers it.

## try it

pwnkit is live on npm. no config needed. one command:

```
npx pwnkit-cli scan --target https://your-app.com/api/chat
```

it's Apache 2.0 licensed, fully open source, and i'm actively building it. if you're shipping AI features and want to know what an attacker would find, give it a shot.
