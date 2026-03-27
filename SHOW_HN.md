# Show HN: Nightfang – Four AI agents that pentest your AI before attackers do (open source)

Every AI app shipping today — chatbots, copilots, MCP-connected agents — has an attack surface that traditional security tools can't see. You can't `nmap` a language model. You can't write a static semgrep rule for a jailbreak that hasn't been invented yet. I built Nightfang because I needed something that actually thinks like an attacker — and then proves what it finds.

**It's live now.** `npx nightfang scan` works globally. v0.1.0 on npm, MIT licensed.

```bash
npx nightfang scan --target https://your-app.com/api/chat
```

**What it is:** An open-source CLI pentesting toolkit with four autonomous AI agents working in sequence. Five commands cover the full attack surface:

- **`nightfang scan`** — Probe LLM endpoints, MCP servers, and AI APIs. Four agents work in sequence: one maps the attack surface (endpoints, MCP tools, system prompts), one attacks it (47+ test cases across 7 categories covering 8/10 OWASP LLM Top 10), one re-exploits every finding to kill false positives, and one generates SARIF reports for GitHub's Security tab.

- **`nightfang audit`** — Point it at any npm package. It installs it in a sandbox, runs semgrep static analysis, then uses an AI agent for deep code review. Catches supply chain attacks that dependency scanners miss.

- **`nightfang review`** — Deep source code security review of any local repo or GitHub URL. Uses Claude Code, Codex, or Gemini CLI under the hood.

- **`nightfang history`** / **`nightfang findings`** — Persistent SQLite database tracks every scan and finding. Query across runs, filter by severity, inspect evidence.

**The key differentiator** is the verification agent. Every finding is re-exploited independently with proof before it hits the report. If it can't reproduce, it's killed as a false positive. No more triaging 200 "possible prompt injections" that turn out to be nothing.

**How it compares:**
- vs. **promptfoo** (acquired by OpenAI): Nightfang goes beyond red-teaming — it also audits packages and reviews source code. Multi-agent pipeline with verification, not a single test runner.
- vs. **garak**: Similar attack coverage for LLMs, but Nightfang adds MCP server scanning, npm auditing, source review, and eliminates false positives via re-exploitation.
- vs. **semgrep/nuclei**: These are great at what they do (static rules, template scanning), but they can't see AI-specific attack surfaces. Use them alongside Nightfang, not instead of it.

**Cost:** A deep scan runs ~$1 in LLM API calls (~10 min). Quick CI scans: $0.05, under 1 minute. Supports OpenAI, Anthropic, Ollama, and bring-your-own agent CLI (Claude Code, Codex, Gemini, OpenCode).

**About me:** I'm a security researcher with 7 published CVEs (node-forge, uptime-kuma, liquidjs, picomatch, jspdf) and the creator of OpenSOAR (open-source SOAR platform) and PhishMind (phishing analysis). Nightfang is the tool I wished existed when I was doing AI security assessments manually — so I built it.

**Try it right now:**

```bash
npx nightfang scan --target https://your-app.com/api/chat
npx nightfang audit lodash
npx nightfang review ./my-ai-app
```

Website: https://nightfang.dev
GitHub: https://github.com/peaktwilight/nightfang
npm: https://www.npmjs.com/package/nightfang
MIT licensed. Feedback, issues, and PRs welcome.
