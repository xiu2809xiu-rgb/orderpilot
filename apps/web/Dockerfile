# The web image, built from the repository root:
#   docker build -f apps/web/Dockerfile -t orderpilot/web:local .
#
# nginx serves the production build as the unprivileged uid 101, sends the same
# security headers as `vite preview` and hands /api/ to the API.
#
# Base images are pinned by digest. Dependabot proposes new digests.

FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
# The version in the root package.json (packageManager).
RUN npm install --global --ignore-scripts pnpm@12.14.0 \
 && npm cache clean --force
WORKDIR /repo

# Dependencies first, from the manifests only, so a source change does not
# install again. The BuildKit cache keeps the pnpm store between builds.
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN --mount=type=cache,id=orderpilot-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@orderpilot/web..." --ignore-scripts

FROM deps AS build
# Sentry stays out of the bundle and out of the policy unless a DSN is given.
ARG VITE_SENTRY_DSN=
ARG API_UPSTREAM=api:3000
COPY packages/tsconfig packages/tsconfig
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN VITE_SENTRY_DSN="${VITE_SENTRY_DSN}" pnpm --filter @orderpilot/web build \
 && VITE_SENTRY_DSN="${VITE_SENTRY_DSN}" API_UPSTREAM="${API_UPSTREAM}" \
    node apps/web/scripts/render-nginx.mjs /out/nginx

FROM nginxinc/nginx-unprivileged:1.30.6-alpine3.24@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03 AS runtime
# Upstream rebuilds its images days after Alpine ships a fix, so the packages are
# brought up to date here. The "Docker images" job fails on what this misses.
USER root
RUN apk upgrade --no-cache
COPY --from=build /out/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /out/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
# Straight to nginx: the base image's entry scripts try to edit /etc/nginx, and
# the compose stack runs with a read-only file system.
ENTRYPOINT ["nginx", "-g", "daemon off;"]
