# The one image for every mock service. Built from the repository root:
#   docker build -f docker/mock/Dockerfile --build-arg SERVICE=mock-template \
#     -t orderpilot/mock-template:local .
#
# SERVICE is a folder under services/ whose package is @orderpilot/<folder>. It
# must build to dist/main.js and answer GET /health on PORT. A mock may use the
# shared and synthetic-data packages and nothing else from the workspace, which
# is what keeps one Dockerfile enough.
#
# The base image is pinned by digest. Dependabot proposes new digests.

FROM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
# The version in the root package.json (packageManager).
RUN npm install --global --ignore-scripts pnpm@12.14.0 \
 && npm cache clean --force
WORKDIR /repo

FROM base AS build
ARG SERVICE=mock-template
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/tsconfig packages/tsconfig
COPY packages/shared packages/shared
COPY packages/synthetic-data packages/synthetic-data
COPY services/${SERVICE} services/${SERVICE}
RUN --mount=type=cache,id=orderpilot-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter "@orderpilot/${SERVICE}..." --ignore-scripts \
 && pnpm --filter "@orderpilot/${SERVICE}..." build \
 && pnpm --filter "@orderpilot/${SERVICE}" deploy --prod --legacy /out

FROM node:24.22.2-alpine@sha256:8a32c8cf649a49915a66e81e7a609223c708d0adabf288ee3f4077d765542f85 AS runtime
ENV NODE_ENV=production \
    PORT=8090
# The package managers run nothing here. A tool that is not in the image cannot
# be scanned as a finding or used by an intruder.
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
           /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg /opt/yarn-*
WORKDIR /app
COPY --from=build --chown=node:node /out/package.json ./package.json
COPY --from=build --chown=node:node /out/node_modules ./node_modules
COPY --from=build --chown=node:node /out/dist ./dist
USER node
EXPOSE 8090
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/health" || exit 1
CMD ["node", "dist/main.js"]
