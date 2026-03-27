# Contributing to Nightfang

We love contributions! Here's how to get started.

## Development Setup

```bash
git clone https://github.com/peaktwilight/nightfang.git
cd nightfang
pnpm install
pnpm -r build
```

## Running Tests

```bash
# Start test targets
pnpm vulnerable &
pnpm safe &

# Run tests
pnpm --filter @nightfang/test-targets test
```

## Adding Attack Templates

Templates live in `templates/`. Create a new YAML file:

```yaml
id: your-template-id
name: Your Template Name
category: prompt-injection
severity: high
description: What this tests for
payloads:
  - id: payload-01
    prompt: "Your attack prompt here"
detection:
  - pattern: "regex pattern for vulnerable response"
    confidence: 0.9
```

## Submitting Changes

1. Fork the repo
2. Create a branch (`git checkout -b feat/my-feature`)
3. Commit your changes
4. Push and open a PR

All PRs need to pass CI checks before merging.
