# The API image, built from the repository root:
#   docker build -f apps/api/Dockerfile --target runtime -t orderpilot/api:local .
#
# Targets:
#   runtime  the API, and the worker with another command. Production
#            dependencies only, no package manager and no compiler, as the
#            unprivileged "node" user (uid 1000).
#   migrate  the migrations and the seed, for the compose stack. It keeps the
#            Prisma CLI, so it is never what serves traffic.
#
# The base image is pinned by digest. Dependabot proposes new digests.

FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS base
ENV CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    PNPM_HOME=/pnpm \
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
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
COPY packages/synthetic-data/package.json packages/synthetic-data/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN --mount=type=cache,id=orderpilot-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@orderpilot/api..." --ignore-scripts

FROM deps AS build
COPY packages/tsconfig packages/tsconfig
COPY packages/shared packages/shared
COPY packages/synthetic-data packages/synthetic-data
COPY apps/api apps/api
# The install skipped scripts because the root one wires Git hooks. Prisma's
# own steps run here: the engines for migrate, the client, then the compile.
RUN --mount=type=cache,id=orderpilot-pnpm-store,target=/pnpm/store \
    pnpm rebuild --filter "@orderpilot/api..." prisma @prisma/engines esbuild \
 && pnpm --filter @orderpilot/api build

# The compiled API, the compiled workspace packages and the production
# dependencies, and nothing else.
FROM build AS deploy
RUN pnpm --filter @orderpilot/api deploy --prod --legacy /out

FROM node:24.22.0-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS runtime
ARG GIT_SHA=unknown
ENV NODE_ENV=production \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    API_HOST=0.0.0.0 \
    API_PORT=3000 \
    GIT_SHA=${GIT_SHA}
# The package managers run nothing here. A tool that is not in the image cannot
# be scanned as a finding or used by an intruder.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
WORKDIR /app
COPY --from=deploy --chown=node:node /out/package.json ./package.json
COPY --from=deploy --chown=node:node /out/node_modules ./node_modules
COPY --from=deploy --chown=node:node /out/dist ./dist
USER node
EXPOSE 3000
# Ready, not only alive: the container is healthy while the database, Redis and
# storage answer. The worker overrides this in compose.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=5 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${API_PORT}/health/ready" || exit 1
CMD ["node", "dist/main.js"]

# One shot: migrate, then the seed, which is safe to run again.
FROM build AS migrate
ENV NODE_ENV=production
WORKDIR /repo/apps/api
RUN chown -R node:node /repo/apps/api/prisma
USER node
CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/database/seed/seed.js"]
