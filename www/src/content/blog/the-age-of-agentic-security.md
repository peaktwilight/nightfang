---
title: "the age of agentic security"
date: "2026-03-26"
description: "if AI agents can write 1,000 pull requests a week, AI agents should be testing 1,000 pull requests a week. the asymmetry is about to collapse."
readTime: "9 min read"
---

stripe recently published a post about their internal AI agents &mdash; what they call "Minions." the numbers are striking: over 1,000 pull requests per week, produced autonomously by AI agents, reviewed and merged by human engineers. these aren't toy examples. they're production changes to one of the most important financial infrastructure companies in the world.

this is the new normal. every major engineering organization is deploying AI agents to write code at scale. GitHub Copilot, Cursor, Devin, internal systems like Stripe's &mdash; the velocity of code production has fundamentally changed.

but here's the part nobody is talking about enough: the velocity of security testing hasn't changed at all.

## the asymmetry problem

consider what's happening. AI agents produce code at a rate that would have been inconceivable two years ago. a thousand PRs per week at one company. multiply that across every engineering team now using AI coding tools. the global volume of new code being written and shipped has increased by an order of magnitude.

now consider how that code gets security-tested. the answer, for most organizations, is: it mostly doesn't. some companies run static analysis in CI &mdash; tools like Semgrep or CodeQL that check for known patterns. a smaller number run periodic penetration tests, typically quarterly. an even smaller number have dedicated security engineers who manually review high-risk changes.

the math doesn't work. you can't have AI agents writing a thousand PRs per week and humans reviewing them for security at the rate of maybe twenty per week. the gap between code production and security review is growing every day.

## static analysis is necessary but not sufficient

this isn't an argument against static scanners. they catch real bugs. they belong in every CI pipeline. but they have a fundamental limitation: they match patterns, they don't understand intent.

every CVE i found during my npm audit work was in code that would pass static analysis cleanly. the node-forge certificate forgery? the code was syntactically correct, followed the library's internal conventions, and had no pattern that a linter would flag. the bug was a *logical* error &mdash; checking a property only when its container was present, rather than treating absence as a failure. you can't write a regex for that.

the mysql2 connection override? a URL parser that processes query parameters in the wrong order. the uptime kuma SSTI bypass? a fallback code path that skipped validation. the jsPDF XSS? string concatenation instead of DOM construction. each one is a semantic issue that requires understanding what the code is supposed to do, not just what it does.

this is where AI agents change the game. an LLM-powered security agent can read the code, understand the intended behavior, trace the data flow, and identify where the implementation diverges from secure design. it does what a human security researcher does &mdash; but without the throughput constraint.

## why verification changes everything

the biggest waste of time in security isn't finding vulnerabilities. it's triaging false positives. every static scanner produces a mountain of "possible" findings that turn out to be nothing. security teams spend 80% of their time proving things are *not* broken. this is why most organizations don't run aggressive scanning &mdash; the signal-to-noise ratio is too low to be actionable.

real attackers don't have this problem. they attempt to exploit something. if it works, it's real. if it doesn't, they move on. that's the workflow that should be automated.

this is why pwnkit runs an agentic pipeline, not a single scan. and it's why the verification agent is the most important piece.

<div class="grid grid-cols-2 gap-4 my-8">
  <div class="bg-night-lighter border border-white/5 rounded-lg p-4">
    <div class="text-xs font-mono text-emerald-400 mb-1">01 discover</div>
    <p class="text-sm text-smoke m-0">map the attack surface. endpoints, system prompts, tool schemas, auth flows, data flows.</p>
  </div>
  <div class="bg-night-lighter border border-white/5 rounded-lg p-4">
    <div class="text-xs font-mono text-amber-400 mb-1">02 attack</div>
    <p class="text-sm text-smoke m-0">run systematic test cases against the target. prompt injection, tool poisoning, data exfiltration, auth bypass.</p>
  </div>
  <div class="bg-night-lighter border border-white/5 rounded-lg p-4">
    <div class="text-xs font-mono text-blue-400 mb-1">03 verify</div>
    <p class="text-sm text-smoke m-0">independently re-exploit every finding. different agent, fresh context. if it can't reproduce, the finding dies.</p>
  </div>
  <div class="bg-night-lighter border border-white/5 rounded-lg p-4">
    <div class="text-xs font-mono text-purple-400 mb-1">04 report</div>
    <p class="text-sm text-smoke m-0">generate SARIF for GitHub Security, markdown for humans, JSON for automation. full evidence chains.</p>
  </div>
</div>

the verification agent doesn't trust the attack agent. it re-runs each exploit independently, with its own analysis of the target. if the attack agent says "prompt injection found" but the verification agent can't reproduce it, the finding is killed. if a finding only works with a contrived input that no real user would send, it gets flagged and downgraded.

this is what separates an agentic security tool from a scanner that produces a list of maybes. the output isn't "these 47 things might be problems." the output is "these 6 things are confirmed vulnerabilities, here's the proof for each one, and here's how to fix them."

## the stripe parallel

what stripe built with Minions is instructive. their agents don't just generate code &mdash; they operate within a structured pipeline. the agent produces a PR. a human reviews and approves. the system learns from feedback. the result is high-throughput, high-quality code production.

the same architecture applies to security testing. an AI agent produces a security assessment. a human reviews the findings. the system refines its approach based on what's confirmed versus what's noise. high-throughput, high-quality security analysis.

the critical difference is that in security, the verification step can be automated. you don't need a human to confirm that a vulnerability is real if you have a working proof of concept. the PoC *is* the confirmation. an agent that produces a working exploit has already done the verification that a human reviewer would do &mdash; and it's done it faster, more consistently, and with better documentation.

## what this means for the industry

i think we're about to see a fundamental shift in how security testing works. here's what i expect:

- **every PR gets a security review.** not a linter pass. an actual security review by an AI agent that reads the diff, understands the context, and checks for vulnerability classes that static analysis can't detect. the cost is low enough &mdash; cents per review &mdash; to run on every commit.
- **continuous pentesting replaces quarterly assessments.** instead of hiring a pentest firm once a quarter, organizations run AI agents against their own systems continuously. the agents adapt as the codebase changes. new endpoints get tested the day they ship.
- **supply chain auditing becomes table stakes.** right now, most teams blindly trust their npm dependencies. when an AI agent can audit a package in minutes for a few cents, there's no excuse for not checking what you're importing.
- **the false positive problem goes away.** verification-based scanning means every reported finding comes with proof. security teams stop spending 80% of their time on triage and start spending it on remediation.

## this is not hypothetical

i've already done this manually. three weeks with Claude Opus, auditing npm packages. 73 findings. 7 CVEs. packages with 40 million weekly downloads. the vulnerabilities were real &mdash; certificate forgery, connection hijacking, server-side template injection, PDF injection, XSS. each one verified with a working proof of concept. each one responsibly disclosed and fixed by the maintainers.

that's what an AI agent can do when pointed at source code with a security researcher's methodology. pwnkit is the open-source version of that workflow. autonomous agents. discover, attack, verify, report. point it at a target and get back confirmed findings with evidence.

the age of agentic coding is here. stripe's Minions are writing a thousand PRs a week. other companies are doing the same. the volume of code being produced by AI agents is growing exponentially.

agentic security needs to keep pace. every AI-written PR should be AI-tested for security. every dependency should be AI-audited before it enters the supply chain. every AI/LLM app and MCP server should be AI-pentested before it goes to production.

the alternative is simple: the attackers will use AI agents too. and they won't bother with responsible disclosure.

```
npx pwnkit-cli scan --target https://your-app.com/api/chat
```
