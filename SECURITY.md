# Security policy

OrderPilot is a student project, and all its data is synthetic. There is no running app yet. We still want to hear about anything that looks wrong: an exposed key, a weak setting, or anything in this repository that should not be here.

## How to report

The repository is private, so GitHub's private vulnerability reporting is not available. Tell Richie, the repository's owner, directly instead: in person, or in a private message. If he is away, tell Angelyn (`angelynnmr` on GitHub), who owns security (area 4).

1. Say what you found, where it is, and how to reproduce it.
2. Say what you think the impact is.

- **Don't open an issue, pull request or discussion** about a security problem. Everyone with access to the repository can read those.
- **Don't put a working key or any real personal data** in your report. Describe where it is instead.
- **If you find a real key or a client document in this repository,** report it at once, even if you are unsure.

We are a student team, so we reply as soon as we can. There is no bug bounty. Only the latest `main` is supported.

## What we scan

### Running today

| Control                                                                                                                         | What it does                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Dependabot alerts and security updates                                                                                          | Flag vulnerable dependencies and open pull requests to fix them. The lockfile is on `main`, so they now read it |
| The `Protect main` ruleset                                                                                                      | Blocks deleting `main` and force pushing to it, and requires a pull request with resolved threads               |
| Git hooks: the licence-key guard, the samples guard, secretlint, commitlint, and a pre-push guard that refuses a push to `main` | Runs on your machine after `pnpm install`                                                                       |
| `pnpm audit --audit-level high` in the verify job                                                                               | Fails a pull request on a high advisory                                                                         |
| Semgrep: the default, TypeScript, React, Node and OWASP Top 10 rules                                                            | Required check `SAST (Semgrep)`                                                                                 |
| gitleaks across the full history                                                                                                | Required check `Secret scan (gitleaks)`                                                                         |
| OSV dependency scan on the lockfile                                                                                             | Required check `Dependency scan (OSV)`                                                                          |
| Trivy over every image we build, failing on fixable HIGH or CRITICAL findings                                                   | Required check `Docker images`                                                                                  |
| Trivy config over every Dockerfile                                                                                              | Required check `IaC and Dockerfile scan`                                                                        |

### Coming with later stories

None of these run yet. Until the second one does, Dependabot proposes new versions of the pulled images monthly, and nothing scans them.

| Control                                                            | Story |
| ------------------------------------------------------------------ | ----- |
| OWASP ZAP baseline scan of the live URL, weekly and on demand      | P-24  |
| Trivy over the images the stack pulls (PostgreSQL, Redis, Mailpit) | P-24  |

[Security testing](docs/security/security-testing.md) says what runs where and how we triage findings.

## Two-step sign-in

A person can turn on two-step verification in Settings, Account ([ADR 0068](docs/adr/0068-two-step-sign-in-with-an-authenticator-app.md)). It adds a six-digit code from an authenticator app after the email and password. What it does and does not guard:

- **It guards the email and password sign-in only.** The demo role buttons skip it, so a shared demo account is never locked by one visitor's phone. A demo session cannot turn it on for an account whose role can manage users.
- **A code works once, one step either side of the clock.** Five wrong codes end a sign-in. Ten wrong codes in 15 minutes lock the code entry, and the third lock in a row lasts 24 hours. A recovery code still works during a lock.
- **The secret is sealed under `JWT_SECRET`,** so it is only as strong as that secret. With the public default of `.env.example` the seal is obfuscation, not protection. Production has no password sign-in, so two-step guards the local and demo stacks today.
- **Never in a log:** a code, a secret, a setup key or a recovery code is never written to the audit trail, a log line, an error or a URL. Recovery codes are stored as hashes and shown once.
- **A System admin can reset another person's two-step** (not their own), except in production. The reset ends that person's sessions and is audited. It removes the second step, so in production the route refuses, with an audited refusal, until a person is told when their two-step is reset (issue 390).
- **Not built:** making it compulsory for a role, "remember this device", codes by email or SMS, passkeys.

## Since the repository went private

Richie made the repository private on 5 Nov 2026 ([ADR 0040](docs/adr/0040-what-going-private-changed.md)).

- **Stopped:** GitHub secret scanning, push protection, private vulnerability reporting and repository security advisories. GitHub offers them on a personal account's private repository only with paid security products.
- **Still running:** everything in the table above. gitleaks reads the full history on every pull request and secretlint runs before every commit, so a key is still caught before it reaches `main`. The ruleset stays enforced, because the account is on GitHub Pro. A finding that is a made-up value in a test is listed in `.gitleaksignore` by its commit, file, rule and line, with the reason and a date to look again, never by a pattern that would hide a real key.
- **If the repository goes public again,** for example for the final, switch secret scanning, push protection and private vulnerability reporting back on in the settings, and put the reporting route above back.
