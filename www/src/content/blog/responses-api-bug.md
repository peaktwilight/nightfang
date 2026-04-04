---
title: "the bug that made our agent crash after 3 turns"
date: "2026-04-04"
description: "our XBOW benchmark scores were garbage. turns out the agent was crashing on every challenge because of one wrong word in our API serialization."
readTime: "5 min read"
---

we scored 33% on the XBOW benchmark last week. that's bad. that's "your agent barely works" bad. we assumed our prompts needed tuning &mdash; maybe the system prompt was too vague, maybe we weren't giving the agent enough context about the target, maybe the tool descriptions were wrong.

we spent two days rewriting prompts. tried different system messages. tweaked the tool schemas. added few-shot examples. nothing moved the number. 33%. every time.

then someone actually looked at the logs.

## the symptom

the agent was crashing. not sometimes &mdash; every single run. it would start a challenge, execute 2-3 turns of reconnaissance, and then die with this error:

```
Error: Invalid value at input[6].content[0]:
  expected "output_text", got "input_text"
```

every challenge. every run. the agent never made it past turn 3. we weren't benchmarking our agent's security skills. we were benchmarking how many challenges happened to have flags lying around in obvious places that the agent could grab in two turns before crashing.

the 33% wasn't a prompt problem. it was a "the agent doesn't work" problem.

## what XBOW actually is

for context: XBOW is a benchmark of 104 Docker-based CTF challenges. each one spins up a vulnerable service &mdash; a web app with an SQL injection, a server with a deserialization bug, a misconfigured API. the agent gets network access to the container and has to find and exploit the vulnerability to extract a flag.

these aren't toy problems. they require multi-step attacks: reconnaissance, vulnerability discovery, exploit development, flag extraction. a typical solve takes 8-15 turns. some of the harder ones need 20+.

our agent was dying at turn 3.

## the investigation

the error message was clear enough: `input[6].content[0]` had `input_text` where the API expected `output_text`. input index 6 means the 7th message in the conversation. content index 0 means the first content block in that message.

so something was wrong with how we were building the conversation history. specifically, one of the messages had its content block typed as `input_text` when it should have been `output_text`.

i opened up our Responses API serialization code &mdash; the part that converts our internal conversation format into the wire format that Azure's Responses API expects. found it in about ten seconds.

## the root cause

Azure's Responses API distinguishes between two types of text content blocks: `input_text` and `output_text`. user messages contain `input_text` blocks. assistant messages contain `output_text` blocks. this is how the API knows which text came from the user and which text the model generated.

our serialization code was sending everything as `input_text`.

```typescript
// what we had
{
  type: "input_text",
  text: block.text,
}
```

every message. user messages, assistant messages, didn't matter. all `input_text`. the API tolerated this for the first few turns because the early messages in the conversation happened to be user messages and system messages. but the moment it hit an assistant message with an `input_text` block &mdash; crash.

turn 1: user message, `input_text` &mdash; fine.
turn 2: assistant response, `input_text` &mdash; the API accepted it (probably a quirk).
turn 3: user follow-up, `input_text` &mdash; fine.
turn 3 continued: assistant response gets serialized, hits a content block validation &mdash; boom.

the API was right to reject it. we were lying about what kind of content we were sending.

## the fix

one line.

```typescript
// what we changed it to
{
  type: m.role === "assistant" ? "output_text" : "input_text",
  text: block.text,
}
```

user text is `input_text`. assistant text is `output_text`. that's it. that's the whole fix.

## the impact

the agent went from crashing at turn 3 to running 16+ turns. immediately. no prompt changes, no tool changes, no architecture changes. just the agent actually being allowed to finish its work.

XBEN-028 &mdash; Poison Inclusion, one of the medium-difficulty challenges &mdash; had been failing every single run. after the fix, the agent finds the vulnerability in 4 turns, develops an exploit in 3 more, and extracts the flag by turn 9. clean solve.

we haven't re-run the full benchmark yet, but the spot checks are night and day. challenges that were "impossible" are now straightforward. because the agent is, you know, running.

## the lesson

when your benchmark scores are bad, check if the agent is actually running before you blame the prompts.

this sounds obvious. it is obvious. we still spent two full days tuning prompts for an agent that was crashing on every single challenge. we looked at the scores, assumed the agent was trying and failing, and started optimizing the wrong thing entirely.

the failure mode was invisible because the benchmark infrastructure still reported results. the agent would do 2-3 turns of recon before crashing, and sometimes that was enough to stumble into a flag. so we got a 33% score instead of 0%, which made it look like the agent was working but bad, rather than broken.

if we'd looked at a single run log on day one, we'd have seen the error immediately. instead we spent two days in prompt-engineering hell because we trusted the aggregate number over the raw evidence.

the debugging hierarchy for agentic systems, in order:

1. is the agent running at all?
2. is the agent running for enough turns to complete the task?
3. is the agent using its tools correctly?
4. are the prompts good?

we jumped straight to step 4. don't do that.
