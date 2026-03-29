---
title: "why i built blind verification"
date: "2026-03-29"
description: "every security scanner drowns you in false positives. i tried three approaches before i found one that actually works."
readTime: "10 min read"
---

you run a security scan. it finds 200 "possible vulnerabilities." you spend the next four hours triaging. 190 of them are noise. the other 10 are maybes. you still have to write manual PoCs to confirm any of them.

this is the state of security tooling in 2026. and it drove me insane enough to try fixing it three times before i got it right.

## attempt 1: template-based scanning

the first version of pwnkit was simple. YAML templates. regex patterns. send a payload, check if the response matches a known-bad pattern. this is how most scanners work &mdash; nuclei, nikto, the whole ecosystem.

```yaml
# template-v1.yaml
id: ssrf-check
payloads:
  - "http://169.254.169.254/latest/meta-data/"
  - "http://localhost:6379"
matchers:
  - type: regex
    pattern: "(ami-id|instance-id|ERR wrong)"
```

it worked for the obvious stuff. but the false positive rate was brutal. a response containing the word "instance-id" in an error message? flagged. an API that returns user input in the response body? flagged. regex can't understand context. it sees patterns, not meaning.

i was spending more time triaging findings than i would have spent just pentesting manually.

## attempt 2: agentic scanning

if regex can't understand context, what if the scanner could think? i replaced the template engine with an AI agent that actually read the code, crafted payloads based on what it saw, and reasoned about responses.

this was better. way better. the agent could look at a function, understand the data flow, and craft a targeted attack. it could tell the difference between user input being reflected in an error message versus user input being passed to `exec()`.

but it had a new problem: hallucination.

the agent would find something that looked suspicious, then reason itself into a vulnerability that didn't exist. "this function *could* be vulnerable if the input isn't sanitized upstream..." then it would check upstream, find no sanitization, and report a critical finding &mdash; without noticing the WAF sitting in front of the whole thing, or the type coercion that made the payload harmless.

"could be vulnerable" is not the same as "is vulnerable." but the agent couldn't always tell the difference.

## attempt 3: single agent with proof-of-concept

okay. so make the agent prove it. don't just report a finding &mdash; write a concrete PoC that demonstrates the exploit. if you can't write a working PoC, you don't have a finding.

this killed a lot of the hallucinations. the agent had to put its money where its mouth was. no more "could be vulnerable" &mdash; either the PoC works or it doesn't.

but there was a subtler problem: **confirmation bias**.

the same agent that decided something was vulnerable was also writing the PoC. and if it already believed the vulnerability was real, it would write a PoC that *looked* convincing but didn't actually prove anything. it would test the happy path. it would assume its payload got through. it would write assertions that passed because they were testing the wrong thing.

it's the same problem that happens with human pentesters. if you're the one who found the bug, you're the worst person to verify it. you already believe it's real.

## the insight: double-blind peer review

in academia, when you submit a paper for peer review, the reviewer doesn't know who wrote it or what the author was thinking. they get the paper and nothing else. they have to independently evaluate whether the conclusions follow from the evidence.

what if i did the same thing with vulnerability verification?

the research agent does its thing &mdash; discovers attack surfaces, crafts payloads, launches multi-turn attacks, writes PoC code. one long agent session. then i take **only** the PoC code and the file path, strip out all the reasoning and context, and hand it to a completely separate verify agent.

the verify agent has no idea why the researcher thought this was vulnerable. it doesn't know the attack narrative. it gets a PoC script and a file to look at. its job: independently trace the data flow, run the PoC, and confirm whether the exploit actually works.

if it can't confirm &mdash; the finding is killed. no negotiation.

```javascript
// the pipeline

// 1. research agent: one multi-turn session
//    discovers + attacks + writes PoC
const findings = await researchAgent.run({
  target: packageDir,
  mode: "audit"
});
// Returns: [{ file, vulnerability, poc, reasoning }]

// 2. verify agents: parallel, independent, blind
//    each gets ONLY poc + file path
const verified = await Promise.all(
  findings.map(f => verifyAgent.run({
    poc: f.poc,        // just the PoC code
    filePath: f.file   // just the file path
    // NO reasoning, NO context, NO attack narrative
  }))
);

// 3. only confirmed findings make the report
const confirmed = verified.filter(v => v.status === "confirmed");
```

## pwnkit scanned itself

the best way to test a security tool is to point it at itself. so i did.

the research agent went through the pwnkit codebase and found 6 potential vulnerabilities:

- **command injection** via unsanitized package names passed to shell
- **SSRF** through target URL parameter in scan mode
- **arbitrary file read** via path traversal in review command
- **prompt injection** in LLM-powered analysis pipeline
- two more related to **input validation** edge cases

six findings. the old pwnkit would have reported all six as vulnerabilities.

the blind verify agents independently rejected **all six** as false positives.

and every rejection was correct. the code had proper mitigations in place &mdash; input sanitization, URL validation, path normalization, sandboxed execution &mdash; that the research agent missed or underestimated during its analysis. the verify agents, starting from scratch with only the PoC and file path, traced the actual data flow and found that none of the PoCs would succeed against the real code.

<div class="bg-night-lighter border border-white/5 rounded-lg p-5 my-8">
  <div class="flex items-center gap-3 mb-3">
    <div class="w-2 h-2 rounded-full bg-emerald-400"></div>
    <span class="text-sm font-mono text-emerald-400">verification result</span>
  </div>
  <div class="grid grid-cols-3 gap-4 text-center">
    <div>
      <div class="text-2xl font-bold text-white">6</div>
      <div class="text-xs text-ash mt-1">reported by research</div>
    </div>
    <div>
      <div class="text-2xl font-bold text-crimson">0</div>
      <div class="text-xs text-ash mt-1">confirmed by verify</div>
    </div>
    <div>
      <div class="text-2xl font-bold text-emerald-400">6</div>
      <div class="text-xs text-ash mt-1">correct rejections</div>
    </div>
  </div>
</div>

## why blind matters

you might wonder: why not just have the same agent verify its own findings? or pass the reasoning along so the verify agent has more context?

because context is exactly how bias propagates. if the verify agent reads "i believe this is a command injection because the package name flows into a shell command," it's going to look for ways to confirm that narrative. it's going to focus on the shell command and might miss the sanitization step three functions up the call stack.

by making it blind, i force the verify agent to build its own understanding from the ground up. it has to:

- read the PoC code and understand what it's trying to exploit
- open the target file and trace the data flow independently
- determine if the PoC would actually succeed against the real code
- return a structured verdict: confirmed or rejected, with evidence

if the research agent missed a sanitization function, the verify agent will find it. if the PoC makes assumptions about the runtime environment, the verify agent will catch that. two independent analyses are exponentially harder to fool than one.

## parallel, cheap, fast

the verify agents run in parallel &mdash; one per finding. if the research agent reports 8 vulnerabilities, 8 verify agents spin up simultaneously. each one is a short, focused session. they don't need multi-turn conversations or tool access. they read code, trace data flow, and output a verdict.

```typescript
// structured output via --json-schema (Claude Code)
// or --output-schema (Codex)

interface VerifyResult {
  finding_id: string;
  status: "confirmed" | "rejected";
  confidence: number;       // 0-100
  evidence: string;         // what the agent found
  data_flow_trace: string;  // source -> sink analysis
  rejection_reason?: string;// why it's a false positive
}
```

the structured output schema means i get machine-parseable results from every verify agent. no regex parsing of natural language. no "let me summarize my findings" that might miss details. just a typed verdict i can pipe straight into the report.

and because pwnkit is runtime-agnostic, this works with whatever you're running:

- **Claude Code** &mdash; `--runtime claude` with `--json-schema`
- **Codex** &mdash; `--runtime codex` with `--output-schema`
- **Gemini, OpenCode, or any API** &mdash; same pipeline, different backend

## the pipeline, end to end

<div class="bg-night-lighter border border-white/5 rounded-lg p-5 my-8">
  <div class="space-y-4 font-mono text-sm">
    <div class="flex items-start gap-3">
      <span class="text-emerald-400 shrink-0 mt-0.5">01</span>
      <div>
        <div class="text-white">research agent</div>
        <div class="text-ash text-xs mt-1">one multi-turn session. reads code, maps attack surface, crafts payloads, launches attacks, writes PoC for every finding.</div>
      </div>
    </div>
    <div class="border-l border-white/10 ml-3 h-4"></div>
    <div class="flex items-start gap-3">
      <span class="text-blue-400 shrink-0 mt-0.5">02</span>
      <div>
        <div class="text-white">strip context</div>
        <div class="text-ash text-xs mt-1">extract only PoC code + file path from each finding. discard reasoning, attack narrative, confidence scores.</div>
      </div>
    </div>
    <div class="border-l border-white/10 ml-3 h-4"></div>
    <div class="flex items-start gap-3">
      <span class="text-blue-400 shrink-0 mt-0.5">03</span>
      <div>
        <div class="text-white">verify agents (parallel)</div>
        <div class="text-ash text-xs mt-1">N agents spin up simultaneously. each gets one PoC + one file. independently traces data flow, confirms or rejects.</div>
      </div>
    </div>
    <div class="border-l border-white/10 ml-3 h-4"></div>
    <div class="flex items-start gap-3">
      <span class="text-purple-400 shrink-0 mt-0.5">04</span>
      <div>
        <div class="text-white">report generation</div>
        <div class="text-ash text-xs mt-1">only confirmed findings appear. SARIF for GitHub, markdown + JSON with full evidence chains.</div>
      </div>
    </div>
  </div>
</div>

## why this matters

false positives aren't just annoying. they're actively harmful.

every false positive erodes trust in the tool. after the third time a developer triages a "critical" finding that turns out to be nothing, they stop looking at the reports. the real vulnerability that comes next gets ignored because the signal-to-noise ratio trained them to ignore it.

blind verification doesn't just reduce false positives. it makes every confirmed finding *trustworthy*. when pwnkit reports a vulnerability, it means two independent AI agents &mdash; one attacking, one verifying &mdash; both agree it's real. the verify agent has traced the data flow from source to sink and confirmed the PoC works. that's a finding you can act on.

it's the same principle that makes peer review work in science. the same principle behind adversarial testing. the same principle behind separation of duties in security. you don't let the person who writes the check also approve the check.

## try it

blind verification is built into every pwnkit command. you don't have to configure it &mdash; it runs automatically. audit a package:

```
npx pwnkit-cli audit your-package
```

the research agent will find what it finds. the verify agents will kill what doesn't hold up. you get only the real stuff.
