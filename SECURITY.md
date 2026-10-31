# Security policy

OrderPilot is a student project, and all its data is synthetic. There is no running app yet. We still want to hear about anything that looks wrong: an exposed key, a weak setting, or anything in this repository that should not be here.

## How to report

Use GitHub's private vulnerability reporting:

1. Open [Report a vulnerability](https://github.com/xiu2809xiu-rgb/orderpilot/security/advisories/new). You can also reach it from the repository's **Security** tab.
2. Say what you found, where it is, and how to reproduce it.
3. Say what you think the impact is.

Only the repository's maintainers can see the report.

- **Don't open a public issue, pull request or discussion** about a security problem.
- **Don't put a working key or any real personal data** in your report. Describe where it is instead.
- **If you find a real key or a client document in this repository,** report it at once, even if you are unsure.

We are a student team, so we reply as soon as we can. There is no bug bounty. Only the latest `main` is supported.

## What we scan

### Running today

| Control                                                                                                                         | What it does                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| GitHub secret scanning                                                                                                          | Finds known secret patterns in the repository                                                                   |
| GitHub push protection                                                                                                          | Blocks a push that contains a known secret pattern                                                              |
| Dependabot alerts and security updates                                                                                          | Flag vulnerable dependencies and open pull requests to fix them. The lockfile is on `main`, so they now read it |
| Private vulnerability reporting                                                                                                 | The private route described above                                                                               |
| The `Protect main` ruleset                                                                                                      | Blocks deleting `main` and force pushing to it, and requires a pull request with resolved threads               |
| Git hooks: the licence-key guard, the samples guard, secretlint, commitlint, and a pre-push guard that refuses a push to `main` | Runs on your machine after `pnpm install`                                                                       |
| `pnpm audit --audit-level high` in the verify job                                                                               | Fails a pull request on a high advisory                                                                         |
| Semgrep: the default, TypeScript, React, Node and OWASP Top 10 rules                                                            | Required check `SAST (Semgrep)`                                                                                 |
| gitleaks across the full history                                                                                                | Required check `Secret scan (gitleaks)`                                                                         |
| OSV dependency scan on the lockfile                                                                                             | Required check `Dependency scan (OSV)`                                                                          |

### Coming with later stories

None of these run yet.

| Control                                                                                 | Story |
| --------------------------------------------------------------------------------------- | ----- |
| Trivy image scan, failing on fixable HIGH or CRITICAL findings, and a Trivy config scan | P-13  |
| OWASP ZAP baseline scan of the live URL, weekly and on demand                           | P-24  |

[Security testing](docs/security/security-testing.md) says what runs where and how we triage findings.

## When the repository goes private

GitHub secret scanning, push protection and private vulnerability reporting stop for us when the repository goes private. Our own gitleaks and Semgrep scans cover both cases, which now run. This file will then be updated, including the way to report.
