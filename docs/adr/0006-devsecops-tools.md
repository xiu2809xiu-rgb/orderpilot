# ADR 0006: The DevSecOps tools

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-6

## Context

OrderPilot will handle bank details, prices and order documents, even if only synthetic ones for now. The module marks GRS by design (M2) and best practices (M4), and the brief names the controls: Semgrep, gitleaks, OSV, Dependabot, then Trivy and ZAP.

The repository is public today, so GitHub's secret scanning, push protection and private vulnerability reporting are free. When it goes private, they stop, GitHub code scanning (SARIF upload) is no longer free either, and Actions minutes drop to 3,000 a month. Our own scans must work in both cases.

## Decision

1. **Scans on every pull request and every push to `main`**, in two workflows whose check names are fixed once required:
   - `ci.yml`, job **"Lint, typecheck, test, build"**: the samples history check, a frozen install, `pnpm audit --audit-level high`, the format check, the em-dash check, the licence-key guard, lint, typecheck, tests and build;
   - `security.yml`, three jobs:
     - **"SAST (Semgrep)"**: Semgrep with the `p/default`, `p/typescript`, `p/react`, `p/nodejs` and `p/owasp-top-ten` rule packs, failing on any finding;
     - **"Secret scan (gitleaks)"**: gitleaks over every commit in the history (a full-depth checkout), with findings redacted in the log;
     - **"Dependency scan (OSV)"**: OSV-Scanner on `pnpm-lock.yaml`, failing on any known advisory that `osv-scanner.toml` does not accept.
       The security workflow also runs weekly, on Monday morning Singapore time, so a new advisory against an unchanged lockfile still shows up.
2. **Before code reaches GitHub**, the hooks (ADR 0003) run the licence-key guard, the samples guard, secretlint and the em-dash check, and refuse any push to `main`.
3. **Why these tools:**
   - **Semgrep:** free, fast, runs anywhere, with maintained rule packs for TypeScript, React, Node and the OWASP Top 10. Its findings are readable by a student who has to fix them.
   - **gitleaks:** scans the Git history, not only the latest tree, and works the same in a public or private repository.
   - **OSV-Scanner:** reads the lockfile directly, uses the open OSV database (which includes GitHub's advisories), and supports accepted entries with a reason and an expiry date.
   - **`pnpm audit`:** a second advisory source inside the install itself, gated at high and critical.
   - **secretlint:** catches a secret in the staged files before the commit exists, which gitleaks in CI cannot.
   - **Dependabot:** alerts, security updates and weekly grouped version updates (ADR 0003).
   - **Later:** Trivy for images and IaC (P-13), OWASP ZAP against the live URL (P-24), Playwright with axe (P-14).
4. **Pinned scanners.** Actions are pinned to commit SHAs, each checked against its tag with `gh api`, and Dependabot keeps them current. The Semgrep image is pinned by digest. gitleaks and OSV-Scanner are downloaded at a fixed version and checked against their published SHA-256 before they run.
5. **Least privilege.** Both workflows grant only `contents: read`, and no checkout keeps its token. No job writes to the repository, comments or uploads to code scanning.
6. **Reports stay in the run.** Semgrep and gitleaks write SARIF, kept as a run artifact for 14 days, rather than uploaded to code scanning, which a private repository would lose.
7. **No path filters on these workflows.** A required check whose workflow never starts stays pending and blocks the merge. A heavy job that has nothing to scan may skip itself with a job-level condition; a skipped job passes its check.
8. **Superseded runs are cancelled** through `concurrency`, and the pnpm store is cached by `actions/setup-node`.
9. **Triage** follows [security testing](../security/security-testing.md): fix it, or accept or dismiss it with a reason and a review date, written where the tool reads it (`osv-scanner.toml`, `pnpm-workspace.yaml`, a `nosemgrep` comment with its reason, or `.gitleaksignore`).

## Consequences

- The same scans run whether the repository is public or private, and none of them needs a paid feature.
- Every merge waits for four checks. Each takes a minute or two today; heavy jobs can skip later to save minutes.
- Without code scanning, findings are read from the job log and the SARIF artifact, not from the Security tab.
- Pinned scanners do not update themselves. Dependabot updates the actions; the Semgrep image, gitleaks and OSV-Scanner versions are bumped by hand, with their new digests and checksums, when a review date or a missed finding calls for it.
- An accepted advisory fails the scan again after its review date, so nothing stays accepted by accident.
