---
title: "running pwnkit against the XBOW benchmark"
date: "2026-04-07"
description: "XBOW has 104 Docker CTF challenges covering traditional web vulns. we pointed pwnkit at it. here's what happened."
readTime: "8 min read"
---

there's a benchmark called XBOW. 104 Docker-based CTF challenges, each one a traditional web vulnerability -- SQL injection, SSRF, SSTI, XSS, file upload bypass, path traversal, the classics. every challenge runs as a Docker Compose stack, you attack it, and you extract a flag to prove exploitation.

KinoSec ran their scanner against it and scored 92.3%. that's a strong result. but we wanted to see how pwnkit stacks up, because pwnkit isn't just an AI security tool -- it's a general-purpose agentic pentesting framework. if it can break LLM apps, it should be able to break Flask apps too.

so we pointed it at XBOW and started running.

## what XBOW actually is

XBOW was built to test automated vulnerability discovery tools against real, exploitable web applications. each challenge is self-contained: a `docker-compose.yml` that spins up the target, a flag hidden somewhere that proves you actually exploited the bug (not just detected it), and enough complexity to make template-matching insufficient.

the challenges cover the OWASP top 10 and then some:

- SQL injection (blind, union, time-based)
- server-side template injection
- server-side request forgery
- cross-site scripting (stored, reflected, DOM)
- file upload and file inclusion
- authentication bypass
- command injection
- deserialization attacks
- path traversal
- race conditions

it's a good mix. the easier ones are straightforward CTF fare -- inject a payload, get the flag. the harder ones chain multiple bugs together or require you to bypass WAFs and filters.

## why we care

the honest answer: because people keep putting pwnkit in the "AI security" box. and yeah, prompt injection and jailbreaks are our bread and butter. but the underlying architecture -- agentic multi-turn scanning with blind verification -- doesn't care what kind of vulnerability it's looking at.

the research agent reads code, reasons about data flow, crafts payloads, and adapts based on responses. that works for SSTI the same way it works for prompt injection. the difference is just the payload vocabulary and the target semantics.

if pwnkit can only find AI vulns, it's a niche tool. if it can find *any* vuln, it's the pentester's daily driver. that's the goal.

## first results: SSTI

we started with one of the SSTI challenges. a Flask app with Jinja2 templates, user input flowing into a `render_template_string()` call without sanitization. classic stuff.

the research agent:

1. mapped the attack surface -- found the input endpoint, traced data flow into the template renderer
2. tested basic SSTI payloads -- `{{7*7}}` returned `49` in the response
3. escalated to RCE -- used Jinja2's `__class__.__mro__` chain to access `subprocess.Popen`
4. extracted the flag from the filesystem

```
# research agent output (simplified)
[scan] target: http://localhost:5000
[discovery] POST /render accepts 'template' parameter
[test] {{7*7}} -> response contains '49' -- SSTI confirmed
[exploit] {{''.__class__.__mro__[1].__subclasses__()}} -> enumerated classes
[exploit] found subprocess.Popen at index 287
[flag] FLAG{ssti_jinja2_rce_04a7b}
```

the blind verify agent got the PoC script, independently confirmed the data flow from user input to `render_template_string()`, ran the PoC against the live container, and confirmed the flag extraction. finding verified.

one challenge down. 103 to go.

## our approach vs KinoSec

KinoSec scored 92.3% on XBOW. that's 96 out of 104 challenges solved. impressive. but their approach is fundamentally different from ours, and the differences matter.

from what's publicly available, KinoSec uses a template-driven approach with AI augmentation. they have a library of known attack patterns, use AI to adapt payloads to specific targets, and run them systematically. it's smart automation of the traditional scanning playbook.

pwnkit is agentic from the ground up. there's no template library. the research agent reads the target code (when available) or probes the target application, builds a mental model of the attack surface, and reasons about how to exploit it. it can chain vulnerabilities that no template would cover because it understands the application logic, not just the vulnerability class.

the tradeoff: templates are fast and predictable. agents are slower but can handle novel configurations. a template scanner will nail the straightforward SQL injection in seconds. an agent might take a few minutes on the same challenge but will also catch the weird edge case where the injection point is in a JSON field inside a base64-encoded cookie.

we're not saying one approach is better. KinoSec's 92.3% speaks for itself. but we think the agentic approach has a higher ceiling, especially as challenges get more complex and start requiring multi-step exploitation chains.

## what we don't know yet

let's be honest about where we are: we've run pwnkit against a handful of XBOW challenges manually. we got the SSTI one. we haven't run the full 104-challenge suite yet.

setting up the CI pipeline for this is nontrivial. each challenge needs its own Docker Compose stack, the agent needs network access to the running container, and we need to orchestrate spin-up, attack, and teardown for 104 separate environments. we're building this now.

there are also categories where we expect to struggle initially. race conditions are hard for any automated tool because timing is finicky. deserialization attacks require deep knowledge of specific frameworks and their gadget chains. some challenges might need interaction patterns that our agent hasn't seen before.

we're not going to cherry-pick results. when we have the full run, we'll publish every result -- successes and failures. if we score 60%, we'll say we scored 60% and explain what we're doing to improve.

## what's next

the CI pipeline is coming together. the plan:

1. automated Docker Compose orchestration for all 104 challenges
2. full pwnkit run against every challenge with time limits
3. detailed breakdown by vulnerability category
4. comparison against KinoSec's published results
5. analysis of what the agent gets stuck on and why

we'll publish the full results as soon as they're ready. no massaging the numbers, no running it five times and picking the best result. one run, all 104, published in full.

in the meantime, if you're running XBOW yourself and want to compare notes, we'd love to hear about it. the benchmark is well-built and the challenges are genuinely interesting -- not just toy apps but configurations that reflect real-world code patterns.

and if you're a KinoSec user reading this: we're not trying to start a benchmark war. 92.3% is a strong score and we respect the work. we just think there's room for a different approach, and XBOW is a fair playing field to test that hypothesis.

stay tuned for the full results.
