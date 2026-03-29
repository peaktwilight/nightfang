---
title: "how ai agents found 7 CVEs in popular npm packages"
date: "2026-03-26"
description: "i pointed Claude Opus at npm packages for three weeks. 73 findings, 7 published CVEs, 40M+ weekly downloads affected. here's how the workflow actually works."
readTime: "10 min read"
---

in early march 2026, i started a side project that i expected to last a weekend. i wanted to see if i could use an AI agent &mdash; specifically Claude Opus &mdash; to systematically audit popular npm packages for security vulnerabilities. not just run a linter. actually read source code, trace data flows, identify trust boundary violations, and produce working proof-of-concept exploits.

three weeks later, i had 73 security findings across dozens of packages, 7 published CVEs, and a workflow that had found vulnerabilities in packages with a combined download count exceeding 40 million per week.

this post is about how that workflow operates, what it found, and why it led me to build pwnkit.

## the workflow

the process is not complicated. it is, however, extremely methodical &mdash; which is exactly where AI agents excel. here's the pipeline i run for each target:

<div class="space-y-4 my-8">
  <div class="bg-night-lighter border border-white/5 rounded-lg p-5">
    <div class="text-xs font-mono text-emerald-400 mb-2">step 1: target selection</div>
    <p class="text-sm text-smoke m-0">pick a package based on download count, attack surface (does it parse untrusted input? handle crypto? process URLs?), and history of prior vulnerabilities. high downloads plus complex parsing logic is the sweet spot.</p>
  </div>
  <div class="bg-night-lighter border border-white/5 rounded-lg p-5">
    <div class="text-xs font-mono text-amber-400 mb-2">step 2: source code review</div>
    <p class="text-sm text-smoke m-0">the agent reads the source code front to back. not skimming &mdash; reading. it maps entry points, traces how user input flows through the system, identifies trust boundaries, and flags patterns that historically lead to vulnerabilities: unvalidated input, missing bounds checks, string concatenation in security-sensitive contexts.</p>
  </div>
  <div class="bg-night-lighter border border-white/5 rounded-lg p-5">
    <div class="text-xs font-mono text-blue-400 mb-2">step 3: verification</div>
    <p class="text-sm text-smoke m-0">every finding gets a working proof of concept. if the agent can't write a PoC that demonstrates the vulnerability, the finding is discarded. no maybes. no theoretical risks. working exploits or nothing.</p>
  </div>
  <div class="bg-night-lighter border border-white/5 rounded-lg p-5">
    <div class="text-xs font-mono text-purple-400 mb-2">step 4: disclosure</div>
    <p class="text-sm text-smoke m-0">responsible disclosure through GitHub Security Advisories or direct maintainer contact. full writeup, PoC code, suggested fix, 90-day timeline. then wait.</p>
  </div>
</div>

that's the entire system. no proprietary scanning engine. no signature database. just an AI agent that reads code the way a security researcher reads code &mdash; except it doesn't get tired, doesn't skip the boring parts, and can process an entire codebase in minutes.

## what it found

here are some of the highlights. each of these has a full writeup on [doruk.ch](https://doruk.ch) with technical details, PoCs, and disclosure timelines.

<div class="space-y-6 my-8">
  <div class="border border-white/5 rounded-lg p-5">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-white font-semibold m-0">node-forge &mdash; certificate forgery</h3>
      <span class="text-xs font-mono bg-red-500/10 text-red-400 px-2 py-1 rounded">CVE-2026-33896</span>
    </div>
    <p class="text-sm text-smoke m-0 mb-2">32 million weekly downloads. the core certificate chain verification logic had a conditional check that only validated <code class="text-white bg-white/5 px-1.5 py-0.5 rounded text-xs">basicConstraints</code> when the extension was present. when absent &mdash; which is normal for end-entity certificates &mdash; any certificate could act as a CA. one conditional. a billion yearly downloads. certificate forgery for any domain.</p>
    <a href="https://doruk.ch/blog/node-forge-certificate-forgery" class="text-xs text-crimson hover:text-crimson-light transition-colors">read the full writeup &rarr;</a>
  </div>
  <div class="border border-white/5 rounded-lg p-5">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-white font-semibold m-0">mysql2 &mdash; connection override + 3 more</h3>
      <span class="text-xs font-mono bg-red-500/10 text-red-400 px-2 py-1 rounded">4 findings</span>
    </div>
    <p class="text-sm text-smoke m-0 mb-2">5 million weekly downloads. URL query parameters could override the host, disable TLS, and enable multi-statement queries. plus prototype pollution, geometry parsing DoS, and an out-of-bounds read in packet framing. four vulnerabilities that chain together: redirect the connection, then crash the client. the maintainer shipped all four fixes in 24 hours.</p>
    <a href="https://doruk.ch/blog/mysql2-connection-override" class="text-xs text-crimson hover:text-crimson-light transition-colors">read the full writeup &rarr;</a>
  </div>
  <div class="border border-white/5 rounded-lg p-5">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-white font-semibold m-0">uptime kuma / liquidjs &mdash; SSTI bypass</h3>
      <span class="text-xs font-mono bg-red-500/10 text-red-400 px-2 py-1 rounded">CVE-2026-33130</span>
    </div>
    <p class="text-sm text-smoke m-0 mb-2">a previously "patched" SSTI vulnerability was still exploitable. the entire security boundary &mdash; three separate mitigations &mdash; was bypassed by removing two quote characters from the payload. the root cause was in LiquidJS's <code class="text-white bg-white/5 px-1.5 py-0.5 rounded text-xs">require.resolve()</code> fallback, which had no path containment checks. four independent researchers found the same bug through different vectors.</p>
    <a href="https://doruk.ch/blog/uptime-kuma-ssti-bypass" class="text-xs text-crimson hover:text-crimson-light transition-colors">read the full writeup &rarr;</a>
  </div>
  <div class="border border-white/5 rounded-lg p-5">
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-white font-semibold m-0">jsPDF &mdash; PDF injection + XSS</h3>
      <span class="text-xs font-mono bg-red-500/10 text-red-400 px-2 py-1 rounded">CVE-2026-31898 / CVE-2026-31938</span>
    </div>
    <p class="text-sm text-smoke m-0 mb-2">arbitrary PDF object injection via unsanitized annotation color parameters. plus HTML injection through <code class="text-white bg-white/5 px-1.5 py-0.5 rounded text-xs">document.write()</code> in output methods &mdash; CVSS 9.6 Critical. another researcher reported first; i independently found the same issues and contributed defense-in-depth hardening to the fixes.</p>
    <a href="https://doruk.ch/blog/jspdf-pdf-injection-xss" class="text-xs text-crimson hover:text-crimson-light transition-colors">read the full writeup &rarr;</a>
  </div>
</div>

## why ai agents are good at this

the common thread across all of these findings is that they're not sophisticated. a missing conditional check. an unfiltered URL parameter. a fallback code path with no validation. a string concatenation where there should be DOM construction. these aren't zero-days requiring months of reverse engineering. they're the kind of bugs that exist because nobody sat down and read the code carefully enough.

that's precisely what AI agents are good at. the tedious, methodical work of reading every function, tracing every input, checking every assumption. a human researcher gets fatigued after a few hours of source review. an AI agent processes the entire codebase with the same level of attention on the last file as the first.

the key insight: the agent doesn't need to be creative. it needs to be thorough. creativity helps for novel attack classes, but the vast majority of real-world vulnerabilities are variants of known patterns &mdash; missing validation, improper access control, trust boundary violations. an agent that systematically checks for those patterns across an entire codebase will find things that humans miss through fatigue or oversight.

## 73 findings, 7 CVEs &mdash; the numbers

after three weeks of running this workflow across popular npm packages, i had accumulated:

- **73 total findings** across dozens of packages
- **7 published CVEs** in node-forge, mysql2, Uptime Kuma, LiquidJS, jsPDF, and picomatch
- **40M+ weekly downloads** affected across the vulnerable packages
- **every finding verified** with a working proof of concept

not every finding became a CVE. some were lower severity, some were in packages with smaller install bases, some were reported but not yet disclosed. but every single one was verified with a working exploit before it was reported. no theoretical risks. no "this might be a problem." working code or it didn't count.

## from manual workflow to pwnkit

the workflow worked. but it was manual. i had to set up each audit, configure the agent, manage the output, track findings, write reports. the workflow was repeatable, but it required me at the controls.

the obvious next step: automate the workflow so anyone can run it.

that's what pwnkit is. the same agentic pipeline &mdash; discover, attack, verify, report &mdash; packaged as an open-source CLI tool. point it at an npm package, an LLM endpoint, an MCP server, or a source code repository. it runs autonomous AI agents in sequence, each specialized for a phase of the security assessment. the verification agent independently re-exploits every finding. if it can't reproduce, the finding is killed.

the 7 CVEs were the proof that this approach works. pwnkit is the tool that makes it accessible.

```
npx pwnkit-cli audit --package node-forge
```

if you're shipping software that depends on open-source packages &mdash; and you almost certainly are &mdash; the question isn't whether these vulnerabilities exist in your dependency tree. they do. the question is whether you find them before someone else does.
