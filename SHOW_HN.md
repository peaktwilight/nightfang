# Show HN: Nightfang – AI agents that hack your AI before attackers do

**Title (for HN):** Show HN: Nightfang – Open-source AI agents that pentest your LLM apps automatically

---

Every AI app shipping today — chatbots, copilots, MCP-connected agents — has an attack surface that traditional security tools can't see. Prompt injection, tool poisoning, data exfiltration through chat context, system prompt theft. You can't `nmap` a language model. I built Nightfang because I needed something that actually thinks like an attacker.

Nightfang is an open-source CLI that runs four autonomous AI agents against your AI endpoints: one discovers the attack surface (endpoints, MCP tools, system prompts), one attacks it (47+ test cases covering 8/10 OWASP LLM Top 10 categories), one re-exploits every finding to kill false positives, and one generates SARIF reports that plug straight into GitHub's Security tab. One command, zero config: `npx nightfang scan --target https://your-app.com/api/chat`.

I'm a security researcher with 7 published CVEs (node-forge, uptime-kuma, liquidjs, picomatch, jspdf) and I previously built OpenSOAR, an open-source SOAR platform. The verification step is what makes Nightfang different — every finding is re-exploited with proof before it hits the report. No more triaging 200 "possible prompt injections" that turn out to be nothing. A deep scan costs about $1 in LLM API calls and takes ~10 minutes. Quick CI scans run in under a minute for $0.05.

GitHub: https://github.com/peaktwilight/nightfang
MIT licensed. Feedback, issues, and PRs welcome.
