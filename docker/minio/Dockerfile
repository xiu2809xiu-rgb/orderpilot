# MinIO, built from its source at a pinned release.
#
# MinIO stopped publishing images to public registries and archived its
# repository in 2026, so there is no official image to pull. This builds the
# last tagged release from the upstream source instead of trusting a rebuild by
# someone else. The commit is checked against the tag, so a moved tag fails the
# build. The storage service speaks the S3 API only, so AWS S3 (or any other
# S3 store) replaces this with a change of endpoint. ADR 0011 has the reasoning.
#
# For development and the demo only. Upstream no longer ships fixes.

FROM golang:1.24.8-alpine3.22 AS build
ARG MINIO_TAG=RELEASE.2025-10-15T17-29-55Z
ARG MINIO_COMMIT=9e49d5e7a648f00e26f2246f4dc28e6b07f8c84a
RUN apk add --no-cache git
WORKDIR /src
RUN git clone --quiet --depth 1 --branch "${MINIO_TAG}" https://github.com/minio/minio.git . \
 && test "$(git rev-parse HEAD)" = "${MINIO_COMMIT}"
RUN CGO_ENABLED=0 go build -trimpath -ldflags "-s -w" -o /out/minio .

FROM alpine:3.22
# A fixed, unprivileged user, so the data volume is owned by it.
RUN addgroup -S -g 10001 minio && adduser -S -u 10001 -G minio minio \
 && mkdir /data && chown minio:minio /data
COPY --from=build /out/minio /usr/local/bin/minio
USER minio
VOLUME ["/data"]
EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data", "--address", ":9000", "--console-address", ":9001"]
