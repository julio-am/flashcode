# syntax=docker/dockerfile:1.7
#
# The FlashCode app image: the Next.js site, the grading worker and the
# migration script all run from it (see deploy/compose.yml). The sandbox that
# actually runs submissions is a separate image, runner/Dockerfile.
#
#   docker build -t flashcode-app .

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
# npm goes through a TLS-intercepting proxy in some build environments. If a
# "proxy_ca" build secret is given, trust it; otherwise this is a no-op.
RUN --mount=type=secret,id=proxy_ca,required=false \
    --mount=type=cache,target=/root/.npm \
    if [ -s /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
# The whole tree, dev dependencies included: the worker and the migration
# script run through tsx.
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0"]
