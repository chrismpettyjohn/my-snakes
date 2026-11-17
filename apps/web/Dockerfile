# Build context: repo root (see docker-compose.yml)
FROM oven/bun:1.4.2-slim AS build
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --filter web
COPY packages/shared packages/shared
COPY apps/web apps/web
WORKDIR /app/apps/web
# Same-origin by default: Caddy proxies /api/* to the API container.
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN bunx vite build

FROM caddy:2.9-alpine
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/web/dist /srv
