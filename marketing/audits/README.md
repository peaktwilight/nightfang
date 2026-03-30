# Popular npm package audit batch

Date: 2026-03-30

Batch command pattern:

```bash
node dist/index.js audit <package> --format json --runtime codex --timeout 600000
```

Raw outputs:

- `marketing/audits/express.json`
- `marketing/audits/lodash.json`
- `marketing/audits/axios.json`
- `marketing/audits/next.json`
- `marketing/audits/fastify.json`

## Results

All five packages scanned clean in this batch.

| Package | Version scanned | npm audit advisories | Semgrep findings | Agent-confirmed findings | Takeaway |
| --- | --- | ---: | ---: | ---: | --- |
| express | 5.2.1 | 0 | 0 | 0 | Clean run on latest package version. |
| lodash | 4.17.23 | 0 | 0 | 0 | No current signal worth publishing as a vuln story. |
| axios | 1.14.0 | 0 | 0 | 0 | Latest release scanned without findings. |
| next | 16.2.1 | 0 | 0 | 0 | Clean batch result; no blog-worthy issue from this run. |
| fastify | 5.8.4 | 0 | 0 | 0 | No advisories or source-analysis hits in this pass. |

## Content angle

This batch is useful as proof that pwnkit can run fast, repeatable audits against mainstream npm packages without fabricating findings.

It is not strong enough on its own for a vuln-disclosure post or high-signal launch thread. The honest framing is:

- pwnkit scanned current versions of five popular npm packages
- the batch produced zero advisories and zero confirmed findings
- the tool is willing to return a clean report when there is no credible issue

If marketing wants a stronger story, the next batch should target packages with larger parser surfaces, custom URL handling, archive extraction, template evaluation, or prior CVE history.
