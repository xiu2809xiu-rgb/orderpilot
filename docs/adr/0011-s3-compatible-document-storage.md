# ADR 0011: S3-compatible document storage

- **Status:** Accepted
- **Date:** 2026-10-31
- **Story:** P-9

## Context

The product stores customer POs, proforma invoices, packing lists, AWB and BL scans, and later the generated PDFs. They are files, not rows. Production would use AWS S3 or similar; a laptop and the demo need something local that behaves the same. Whatever we choose for the local store must not leak into the code.

## Decision

1. **The code speaks the S3 API only.** `ObjectStorage` is an abstract class with `put`, `get`, `head`, `delete` (plus `ensureBucket` and `ping`). `S3ObjectStorage` implements it with the AWS SDK for JavaScript v3 and is the only file that imports the SDK. Services ask for `ObjectStorage`.
2. **MinIO is the local store**, run by Docker Compose beside PostgreSQL and Redis. Moving to AWS S3 is a configuration change: drop `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE`, set the region, keys and bucket. No code changes.
3. **MinIO is built from its source, pinned.** MinIO no longer publishes images to public registries and archived its repository in 2026. `docker/minio/Dockerfile` clones the last tagged release, checks the commit against the tag (a moved tag fails the build), compiles it with Go, and runs it as an unprivileged user in a small Alpine image. We chose this over an image rebuilt by a third party, whom we would have to trust with every document. The image is for laptops, CI and the demo; upstream no longer ships fixes, so it must not hold anything real.
4. **Keys are validated before they reach the store.** No empty, absolute, `.`, `..` or empty segments, no backslash or control characters, at most 1 024 bytes. Keys are paths such as `documents/2026/11/<uuid>.pdf`; the caller builds them from ids, never from a file name.
5. **Missing is `null`, not an error.** `head` and `get` answer `null` for an absent object; `delete` of one is a no-op, as S3 does.
6. **The bucket is created on start** when `S3_CREATE_BUCKET=true` (the local default) and by the seed. Where the bucket belongs to infrastructure code, it is `false` and the readiness check (`/health/ready`, check `storage`) shows when it is missing.
7. **Documents are read whole** into memory (`get` returns a `Buffer`). The upload limit (P-18) keeps that safe; streaming can be added to the same interface when a feature needs it.

## Consequences

- The first `docker compose up --build` compiles MinIO, which takes a few minutes; later starts use the cached image. CI builds it in the background while other steps run. Caching that build is on the backlog (P-13).
- The live demo should use AWS S3 or a maintained S3 store, not this image (backlog, P-24).
- Pre-signed URLs, multipart upload, encryption at rest and a virus-scan hook are not in this story. The interface is small enough to add them where a feature needs them.

## Alternatives considered

- **A pinned image from a community fork of MinIO.** Quicker to start, but it puts a third party between us and every stored document, and the repository is public: the supply-chain rules for this project favour building from the upstream source.
- **SeaweedFS or another S3 server.** Also behind the S3 API, so the code would not change. MinIO was the brief's choice and the most widely documented; because the API is the contract, swapping later is a Compose change.
- **Files in PostgreSQL (`bytea`) or on local disk.** Neither drops into AWS S3 later without code changes.
