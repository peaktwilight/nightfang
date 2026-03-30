# Vibe Coding Conversations — Engagement Targets

Found via agent-reach on 2026-03-30. Prioritized by relevance, audience size, and alignment with our tools (vibechecked, unfcked, whatdiditdo, pwnkit).

---

## Twitter — Security + Vibe Coding (HIGH PRIORITY)

These conversations directly discuss vibe coding security problems — our core value prop.

### 1. Georgia Tech Computing (@gtcomputing)
**Tweet:** "Vibe coding has its pros, and also some big cons. At least 35 new CVEs directly related to AI-generated code were disclosed in March..."
**URL:** https://x.com/gtcomputing/status/2038582875608473718
**Why:** Academic institution calling out vibe coding CVEs. Perfect credibility alignment.
**Draft reply:**
> This is exactly the problem we're tackling. Built pwnkit — an open-source agentic pentesting framework that scans AI-generated code for real vulnerabilities, then independently re-exploits each finding to kill false positives. One command: `npx pwnkit-cli review ./your-app`. Every finding verified or dropped. github.com/peaktwilight/pwnkit

### 2. Vincent Wei (@YihaoWei1021)
**Tweet:** "Vibe coding won the adoption phase. Now it has to survive production. 10% of AI-generated apps have critical security flaws. 45% have vulnerabilities."
**URL:** https://x.com/YihaoWei1021/status/2038572386484658405
**Why:** Viral-format take with strong engagement. Frames the exact problem pwnkit solves.
**Draft reply:**
> "Who reviews it before it hits prod?" — that's the right question. We built an open-source answer: `npx pwnkit-cli review ./your-app`. AI agent discovers vulns, then a separate blind verifier re-exploits each one. No templates, no static rules. Zero config. github.com/peaktwilight/pwnkit

### 3. 0xJohnG (@0xJohnG)
**Tweet:** "45% of AI-generated code contains security vulnerabilities... My rule: never ship AI-generated code that touches auth, payments, or user data without a security review agent."
**URL:** https://x.com/0xJohnG/status/2038313885049201131
**Why:** Security-minded dev with engaged audience. Already advocates for review agents — pwnkit IS that agent.
**Draft reply:**
> You're describing exactly what we built. pwnkit is an open-source security review agent — a research agent discovers vulns, then a blind verifier re-exploits each one independently. Works as a pre-commit check: `npx pwnkit-cli review ./your-app`. The agent that codes should not be the agent that reviews. github.com/peaktwilight/pwnkit

### 4. NotElonBucks (@solobillionsHQ)
**Tweet:** "scanned 5,600 vibe-coded apps: 60% had critical security vulnerabilities... The hoax isn't vibe coding. It's the assumption that 'it works' means 'it's ready.'"
**URL:** https://x.com/solobillionsHQ/status/2037996349237678231
**Why:** Data-heavy thread, high engagement. Perfect "solution exists" reply.
**Draft reply:**
> "It works" ≠ "it's ready" — exactly right. We built pwnkit to close that gap. It's an agentic pentester: discovers vulns in your codebase, then independently re-exploits every finding to kill false positives. One command, zero config: `npx pwnkit-cli review ./your-app`. Open source. github.com/peaktwilight/pwnkit

### 5. Gray Hats (@the_yellow_fall)
**Tweet:** "The NCSC warns that 'vibe coding' could collapse the SaaS market while fueling a surge in AI-generated vulnerabilities."
**URL:** https://x.com/the_yellow_fall/status/2038515072251887832
**Why:** Cybersecurity account sharing NCSC warnings. Audience is security-conscious.
**Draft reply:**
> The tooling needs to catch up to the adoption. We're working on it — pwnkit is an open-source agentic pentester. AI finds vulns, separate AI re-exploits to verify. No false positives shipped. `npx pwnkit-cli review ./your-app`. github.com/peaktwilight/pwnkit

### 6. Anatoly (@bettercalltolya)
**Tweet:** "Vibe coding made me 10x more productive... It also tried to ship security vulnerabilities into production on a regular basis. AI optimizes for 'it compiles and runs', not for 'it's secure'"
**URL:** https://x.com/bettercalltolya/status/2037165009361334778
**Why:** Thread from a builder sharing real vulns found in their own codebase. Authentic, relatable.
**Draft reply:**
> This is painfully relatable. Built pwnkit for exactly this — catches the vulns AI introduces before they hit prod. Research agent + blind verifier, so every finding is independently re-exploited. `npx pwnkit-cli review ./your-app`. Would love to hear what it finds on Rehearsy. github.com/peaktwilight/pwnkit

### 7. z3n (@zench4n)
**Tweet:** "This is the hidden cost of vibe coding at scale — you're essentially trading technical debt for velocity... The real skill now isn't prompting AI to write code, it's knowing when NOT to trust it."
**URL:** https://x.com/zench4n/status/2037912835557335463
**Why:** Thoughtful take on vibe coding trust. Good segue to automated verification.
**Draft reply:**
> Right — and if you can't always know when not to trust it, automate the verification. We built unfcked (45+ code quality checks, zero config) and pwnkit (agentic security scanner that re-exploits findings). `npx unfcked ./your-project` + `npx pwnkit-cli review ./your-app`. Both open source.

---

## Twitter — Vibe Coding Frustrations (MEDIUM PRIORITY)

These are broader vibe coding conversations where our tools fit naturally.

### 8. Entro (@entrowork)
**Tweet:** "Vibe coding gets you the app. It doesn't get you the business. The hard part was never writing code."
**URL:** https://x.com/entrowork/status/2038665636759429308
**Why:** Thoughtful thread about the gap between "built" and "shipped". unfcked fits here.
**Draft reply:**
> And between "built" and "shipped" there's "doesn't embarrass you." We made unfcked — 45+ automated checks for the stuff vibe coding misses (dead deps, missing tests, console.log pollution, security flags). One command: `npx unfcked ./your-project`. Catches the last 20%. github.com/peaktwilight/unfcked

### 9. Parth Desai (@psdesai_93)
**Tweet:** "@JustJake @zo0r @devenbhooshan Was this an effect of vibe coding? Definitely seeing a spike in issues"
**URL:** https://x.com/psdesai_93/status/2038666994837225680
**Why:** Developer noticing quality issues from AI code. Direct use case.
**Draft reply:**
> The spike is real. We built unfcked to catch the stuff AI leaves behind — 45+ checks for dead deps, missing tests, console.log pollution, wrong dev deps. `npx unfcked ./your-project`. Zero config. github.com/peaktwilight/unfcked

### 10. Vasilescu David (@buildingwwdavid)
**Tweet:** "10.3% of Lovable-generated apps had critical security flaws. 45% of all AI-generated code has vulnerabilities. Vibe coding won adoption. Now it has to survive production."
**URL:** https://x.com/buildingwwdavid/status/2037559556834775103
**Why:** Frames 2026 as the year of verification. Perfectly tees up pwnkit.
**Draft reply:**
> "2026 is the year verification becomes as important as generation" — 100%. We built pwnkit for this exact moment. Agentic pentester: discovers vulns, then independently re-exploits each one. No templates, no false positives. `npx pwnkit-cli review ./your-app`. Open source. github.com/peaktwilight/pwnkit

### 11. Amitrajeet (@amitrajeet7635)
**Tweet:** "I feel vibe coding with accurate prompt and understand the requirement of the tasks required great knowledge of system architecture."
**URL:** https://x.com/amitrajeet7635/status/2038665437798637724
**Why:** Developer recognizing that vibe coding still needs expertise. whatdiditdo helps bridge the gap.
**Draft reply:**
> Exactly — and even with good prompts, you need to verify what the AI actually did. Built whatdiditdo for that: shows every file changed, lines added/removed, security flags, and an AI summary of the session. `npx whatdiditdo`. Keeps you in control. github.com/peaktwilight/whatdiditdo

### 12. GaloAndStuff (@GaloAndStuff)
**Tweet:** "Doing this thing called 'slow vibe coding' where it takes forever to make complex programs because I only use free tokens."
**URL:** https://x.com/GaloAndStuff/status/2038666049399239033
**Why:** Funny, relatable. Light-hearted reply works well here.
**Draft reply:**
> slow vibe coding needs slow vibe QA. try `npx unfcked ./your-project` between sessions — 45+ checks, zero config, no AI tokens needed. catches the stuff that piles up. github.com/peaktwilight/unfcked

---

## Reddit — Vibe Coding Discussions (MEDIUM PRIORITY)

### 13. r/ProgrammerHumor — "vibeCodingFinalBoss"
**URL:** https://reddit.com/r/ProgrammerHumor/comments/1s7vzoc/vibecodingfinalboss/
**Score:** 468 | **Comments:** 50
**Why:** High-engagement humor post. Large audience.
**Draft reply:**
> the final boss is when you let the AI cook for 20 minutes and have no idea what it changed. that's why we built whatdiditdo — one command shows every file touched, lines changed, and security flags. `npx whatdiditdo`. open source: github.com/peaktwilight/whatdiditdo

### 14. r/SideProject — "I spent months vibe coding an app. My ads failed, I'm losing hope"
**URL:** https://reddit.com/r/SideProject/comments/1s7vxve/i_spent_months_vibe_coding_an_app_my_ads_failed/
**Score:** 4 | **Comments:** 6
**Why:** Builder struggling with vibe-coded app quality. Genuine help opportunity.
**Draft reply:**
> Before giving up, try running `npx unfcked ./your-project` — it checks 45+ things AI often gets wrong (missing tests, wrong deps, console.log pollution, security issues). Zero config. Might surface easy wins that improve the app quality. Also `npx vibechecked https://your-site.com` can tell you if your landing page looks too "AI-generated." Both free and open source.

### 15. r/vibecoding — "Distribution won't save a product nobody actually needs"
**URL:** https://reddit.com/r/vibecoding/comments/1s7wtl5/distribution_wont_save_a_product_nobody_actually/
**Score:** 2 | **Comments:** 0
**Why:** r/vibecoding is a niche community. Early post, can drive discussion.
**Draft reply:**
> Agree — but there's also a middle ground: the product works but has obvious quality issues that kill trust. We built unfcked to catch the "last 20%" — missing tests, dead deps, security flags. `npx unfcked ./your-project`. Distribution matters, but polish matters too.

### 16. r/G2dotcom — "Vibe coding is a real thing now - has anyone here actually shipped something with it?"
**URL:** https://reddit.com/r/G2dotcom/comments/1s7wre8/vibe_coding_is_a_real_thing_now_has_anyone_here/
**Score:** 3 | **Comments:** 0
**Why:** Open question about vibe coding tools. Perfect for sharing our stack.
**Draft reply:**
> Yes — we shipped 3 tools entirely vibe-coded, then used them to check themselves: vibechecked (roasts AI-generated landing pages), unfcked (45+ code quality checks), and whatdiditdo (shows what your AI agent changed). All `npx` one-liners, all open source. Blog post about the process: pwnkit.com/blog/i-vibe-coded-3-tools-for-the-vibe-coding-era

### 17. r/ClaudeAI — "With Claude throttling sessions, I rebuilt my workflow so each new session starts exactly where the last one left off"
**URL:** https://reddit.com/r/ClaudeAI/comments/1s7wgjk/with_claude_throttling_sessions_i_rebuilt_my/
**Score:** 1 | **Comments:** 2
**Why:** Workflow-focused discussion. whatdiditdo helps with context recovery.
**Draft reply:**
> Related tool that might help: `npx whatdiditdo` — shows what changed in your last AI session (files touched, lines added/removed, AI summary). Useful when you start a new session and need to quickly understand what the previous one did. Open source: github.com/peaktwilight/whatdiditdo

### 18. r/iosapps — "I spent months vibe coding an app. My ads failed, I'm losing hope"
**URL:** https://reddit.com/r/iosapps/comments/1s7vzop/i_spent_months_vibe_coding_an_app_my_ads_failed/
**Score:** 0 | **Comments:** 13
**Why:** Active discussion, genuine pain point. Cross-post of the SideProject thread.
**Draft reply:**
> Before you give up, run `npx vibechecked https://your-app-site.com` — it'll tell you honestly if your landing page looks AI-generated (and what to fix). Also `npx unfcked ./your-project` catches code quality issues AI misses. Both free. Sometimes the product is fine but the presentation kills conversion.

---

## Twitter — CLI/Dev Tool Builders (LOWER PRIORITY — peer network)

### 19. omo (@sebiomo_)
**Tweet:** "npx secure-repo init — Drops SECURITY.md + AUTH.md + API.md into any repo. One command."
**URL:** https://x.com/sebiomo_/status/2029539567313834344
**Why:** Building in the same space (security + AI + CLI). Potential collab/cross-promo.
**Draft reply:**
> Nice — secure-repo for prevention, pwnkit for detection. We built an agentic pentester that scans codebases and re-exploits every finding to kill false positives. Would be cool to pair them: `npx secure-repo init` then `npx pwnkit-cli review ./` to verify. github.com/peaktwilight/pwnkit

### 20. Kevin Poireault (@kpoireault) — Infosecurity Magazine
**Tweet:** "Vibe coding tools are flooding software with new vulnerabilities, Georgia Tech researchers have warned."
**URL:** https://x.com/kpoireault/status/2037214110773874709
**Why:** Tech journalist covering vibe coding security. Pitch opportunity for coverage.
**Draft reply:**
> Great piece. We're building open-source tooling to address exactly this — pwnkit is an agentic pentester that discovers vulns in AI-generated code, then independently re-exploits each finding to eliminate false positives. Zero config, one command. Would love to share more if you're covering the solution space. github.com/peaktwilight/pwnkit

---

## Engagement Notes

- **Tone:** Be helpful, not salesy. Lead with the problem acknowledgment, tool mention second.
- **Never reply to all 20 at once** — space out over 3-5 days to look organic.
- **Prioritize:** Security-focused tweets (#1-#6) first, they have the highest conversion potential.
- **Track:** Note which replies get engagement and double down on that angle.
- **Reddit:** Be genuinely helpful. Don't just drop links — answer the question first.
