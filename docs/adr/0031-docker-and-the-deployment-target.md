# ADR 0031: Docker images, the compose stack and the deployment target

- **Status:** Accepted
- **Date:** 2026-11-01
- **Story:** P-13, Docker images and the IaC scan (issue 28)

## Context

Until P-13, Docker ran only the four stores (PostgreSQL, Redis, MinIO and Mailpit), and the API and the web app ran from a checkout. The Definition of Done asks for a `docker compose up --build` that works from a clean clone, P-14's end-to-end tests run against that stack, screenshots for a pull request come from a Docker build, and P-24 deploys the same images to a server. Nothing checked the Dockerfiles or what the images contain.

The brief fixes the deployment target already: Amazon Lightsail in Singapore, Caddy for HTTPS, images on GHCR (P-24). This ADR records how the images are built so that the laptop, CI and that server run the same thing.

## Decision

1. **Four Dockerfiles, all multi-stage, all non-root, each with a health check.**
   - `apps/api/Dockerfile`: the `runtime` target is the API and, with another command, the worker (`node dist/worker/worker.js`, which P-15 fills with BullMQ processors). It holds the compiled code and production dependencies from `pnpm deploy --prod`, runs as `node` (uid 1000), and has no npm, pnpm or compiler. The `migrate` target keeps the Prisma CLI to run `prisma migrate deploy` and the seed once; it never serves traffic, and it too drops the global package managers.
   - `apps/web/Dockerfile`: the production build behind `nginxinc/nginx-unprivileged` as uid 101. `apps/web/scripts/render-nginx.mjs` writes the security headers from the same source as `vite preview` ([ADR 0015](0015-csp-and-inline-styles.md)), so the two cannot drift; a Sentry DSN given at build time adds its one origin to both the bundle and the policy ([ADR 0022](0022-sentry-for-errors.md)). Deep links fall back to `index.html`, hashed assets are cached for a year as `immutable`, and `/api/` is proxied without adding a second policy to the API's answers.
   - `docker/mock/Dockerfile`: one image for every mock service, chosen by the `SERVICE` build argument. `services/mock-template` proves it; P-19's `mock-navision` is the first real one.
   - `docker/minio/Dockerfile`: MinIO built from its last tagged release, since upstream publishes no image ([ADR 0011](0011-s3-compatible-document-storage.md)). It now builds with a supported Go toolchain and takes the published fixes for the dependencies Trivy names, because upstream will never ship them.
2. **Base images are pinned by digest, and every image is hardened in compose.** Dependabot proposes new digests and minor or patch versions weekly, grouped, and the "Docker images" job scans each proposal. Our own containers run on a read-only file system with a `/tmp` tmpfs, `cap_drop: ALL` and `no-new-privileges`. Every published port is bound to 127.0.0.1. The API has no host port at all: the browser reaches it through the web container, so the stack never clashes with `pnpm dev`.
3. **One compose file for the whole stack.** The stores start first, then `migrate`, then `api` and `worker` once it has exited with 0, then `web` once the API is healthy (`/health/ready`). The worker's health check reads the age of its Redis heartbeat. Grafana's `otel-lgtm` and the mock services are profiles, off unless asked for. `pnpm stack:up` still starts only the four stores for `pnpm dev`, and CI's verify job does the same.
4. **A sealed stack for client samples.** `docker-compose.samples.yml` is its own compose project: every store in tmpfs, no named volumes, an internal network with no route out (so no document can reach an AI provider whatever a `.env` says), only the web port published on 127.0.0.1, and `samples/` mounted read-only. `.dockerignore` keeps `samples/`, every `.env` and the AI tool folders out of every build context.
5. **Two required checks in `.github/workflows/docker.yml`.**
   - "Docker images" builds every image with `docker buildx bake` from `docker-compose.yml` itself, so CI and a laptop build the same targets. Trivy then scans each image and fails on a HIGH or CRITICAL finding that has a fix. The stack is started from those images and `scripts/stack-smoke.mjs` uses it as a browser would.
   - "IaC and Dockerfile scan" runs `trivy config` over the repository. The Dockerfiles are clean at every severity, so any finding fails it.
   - Trivy is downloaded by version and checked against its SHA-256, the way gitleaks and OSV-Scanner already are, rather than run through a third-party action whose tags can move. Accepted findings go in `.trivyignore` with a reason and a review date, as `docs/security/security-testing.md` says.
   - Both run weekly too, so a new advisory against an unchanged base image surfaces.
6. **The MinIO build is cached.** BuildKit cache mounts keep the Go modules and compiled packages on a laptop, and the "Docker images" job keeps MinIO's layers in the GitHub Actions cache. The Node images are not cached in CI: they reinstall from the lockfile in about a minute, and their layers would fill the cache.
7. **The deployment target (P-24).** One Lightsail instance in Singapore (ap-southeast-1) runs these same images from GHCR, tagged with the commit SHA (`GIT_SHA`), under `infra/deploy/docker-compose.prod.yml`, with Caddy in front of the web container for HTTPS. `APP_ENV=production` there turns on the API's production rules (real secrets, secure cookies). The source-built MinIO gets no upstream fixes, so whether the live demo keeps it or points the storage service at an S3 bucket in the same region is Richie's call (item u in `docs/BUILD_REPORT.md`). Either way it is a change of endpoint and keys only, and MinIO is the default until he answers.

## Consequences

- `docker compose up --build` from a clean clone takes about two minutes once the MinIO layers are cached, and a few minutes more the first time.
- A Dockerfile, a base image or a dependency with a fixable HIGH or CRITICAL advisory now blocks a pull request. The fix is the default: a new digest, a package upgrade, or another pin in `docker/minio/Dockerfile`.
- The images run synthetic data only, and `DEMO_MODE` keeps its documented default (on in compose, refused under `APP_ENV=production`).
- `apk upgrade` in the web image makes two builds a few days apart differ slightly. Trivy holds the line on what that means for security; the digest pin still fixes everything else.
- The two new checks are required once the orchestrator applies `.github/rulesets/main.json` after this merges. Their names never change after that.

## Alternatives considered

- **Distroless runtimes.** Smaller, but they have no shell or `wget` for a health check, and the alpine images already scan clean.
- **Kubernetes or ECS for the deployment.** More moving parts and cost than a class demo needs. One VM with compose runs the same images and is what the brief names.
- **A community MinIO image.** Someone else's rebuild with no pinned source. Building the tagged release, with the commit checked, is what ADR 0011 chose.
- **Leaving the MinIO dependency findings in `.trivyignore`.** They have published fixes, so the triage rules say fix them; ignoring them would have been a silenced check.
