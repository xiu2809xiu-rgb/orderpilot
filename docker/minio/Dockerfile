# MinIO, built from its source at a pinned release.
#
# MinIO stopped publishing images to public registries and archived its
# repository in 2026, so there is no official image to pull. This builds the
# last tagged release from the upstream source instead of trusting a rebuild by
# someone else. The commit is checked against the tag, so a moved tag fails the
# build. The storage service speaks the S3 API only, so AWS S3 (or any other
# S3 store) replaces this with a change of endpoint. ADR 0011 has the reasoning.
#
# For development and the demo only. Upstream no longer ships fixes, so the Go
# toolchain is newer than the one the release was cut with: the standard
# library's own fixes still reach the binary.
#
# The build is slow (a few minutes) the first time. Two BuildKit caches keep the
# Go modules and the compiled packages, so a rebuild after a cache miss on the
# clone (a new base digest, say) takes seconds, and CI keeps the layers between
# runs (the "Docker images" job). Base images are pinned by digest.

FROM golang:1.27.4-alpine3.24@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS build
ARG MINIO_TAG=RELEASE.2025-10-15T17-29-55Z
ARG MINIO_COMMIT=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a
RUN apk add --no-cache git
WORKDIR /src
RUN git clone --quiet --depth 1 --branch "${MINIO_TAG}" https://github.com/minio/minio.git . \
 && test "$(git rev-parse HEAD)" = "${MINIO_COMMIT}"
# The release's own dependencies have published fixes that upstream will never
# take, and the "Docker images" job fails on a fixable HIGH or CRITICAL. These
# are the lowest versions with the fixes that agree with each other; go.sum is
# checked against the Go checksum database as they download. When Trivy names
# another, add it here. `tidy -e` adds the new modules' imports and skips an
# upstream test-only package that no longer exists: tests are not built here.
ARG DEPENDENCY_FIXES="\
github.com/apache/thrift@v0.24.0 \
github.com/buger/jsonparser@v1.1.2 \
github.com/go-jose/go-jose/v4@v4.1.6 \
github.com/klauspost/compress@v1.18.7 \
github.com/prometheus/prometheus@v0.311.3 \
github.com/rabbitmq/amqp091-go@v1.13.0 \
go.opentelemetry.io/otel/sdk@v1.44.0 \
golang.org/x/crypto@v0.58.0 \
golang.org/x/net@v0.62.0 \
google.golang.org/grpc@v1.83.2"
RUN --mount=type=cache,id=orderpilot-go-mod,target=/go/pkg/mod \
    --mount=type=cache,id=orderpilot-go-build,target=/root/.cache/go-build \
    GOTOOLCHAIN=local go get ${DEPENDENCY_FIXES} \
 && GOTOOLCHAIN=local go mod tidy -e \
 && CGO_ENABLED=0 GOTOOLCHAIN=local go build -trimpath -ldflags "-s -w" -o /out/minio .

FROM alpine:3.24.3@sha256:be2656061b536c1883c4034790e21d0a09c5aaaf51968b89368a3c0371ea2c9a
# A fixed, unprivileged user, so the data volume is owned by it.
RUN addgroup -S -g 10001 minio && adduser -S -u 10001 -G minio minio \
 && mkdir /data && chown minio:minio /data
COPY --from=build /out/minio /usr/local/bin/minio
USER minio
VOLUME ["/data"]
EXPOSE 9000 9001
# The same probe compose uses. busybox wget is in the base image.
HEALTHCHECK --interval=5s --timeout=3s --start-period=5s --retries=20 \
  CMD wget -q -O /dev/null http://127.0.0.1:9000/minio/health/live || exit 1
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--address", ":9000", "--console-address", ":9001"]
