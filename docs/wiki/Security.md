# Security

The full policy is [SECURITY.md](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/SECURITY.md).

## How to report

Use GitHub's private vulnerability reporting: open [Report a vulnerability](https://github.com/xiu2809xiu-rgb/orderpilot/security/advisories/new). Only the repository's maintainers can see the report.

- Don't open a public issue, pull request or discussion about a security problem.
- Don't put a working key or any real personal data in your report. Describe where it is instead.
- If you find a real key or a client document in this repository, report it at once, even if you are unsure.

## What runs today

- GitHub secret scanning and push protection.
- Dependabot alerts and security updates.
- Private vulnerability reporting.
- The `Protect main` ruleset, which blocks deleting `main` and force pushing to it, and requires a pull request with resolved threads. [`.github/rulesets/main.json`](https://github.com/xiu2809xiu-rgb/orderpilot/blob/main/.github/rulesets/main.json) mirrors it.

## What later stories bring

None of these run yet.

| Control                                                                                 | Story |
| --------------------------------------------------------------------------------------- | ----- |
| Git hooks: the licence-key guard, the samples guard and a secretlint scan               | P-5   |
| `pnpm audit --audit-level high` in the verify job                                       | P-6   |
| Semgrep: the default, TypeScript, React, Node and OWASP Top 10 rules                    | P-6   |
| gitleaks across the full history                                                        | P-6   |
| OSV dependency scan on the lockfile                                                     | P-6   |
| Trivy image scan, failing on fixable HIGH or CRITICAL findings, and a Trivy config scan | P-13  |
| OWASP ZAP baseline scan of the live URL, weekly and on demand                           | P-24  |

## The rules for everyone

- Synthetic data only. Spectra's documents never go into Git, the board or the team chat.
- Licence keys live only in `apps/web/.env.local`, and AI keys only in the root `.env`. Richie puts them there himself. Never print, echo or ask for a key in chat.
- Never claim the prototype is PDPA compliant.
