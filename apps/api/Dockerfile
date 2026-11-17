# Build context: repo root (see docker-compose.yml)
FROM oven/bun:1.4.2-slim
WORKDIR /app
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN bun install --frozen-lockfile --production --filter api
COPY packages/shared packages/shared
COPY apps/api apps/api
WORKDIR /app/apps/api
ENV NODE_ENV=production PORT=3000
EXPOSE 3000
USER bun
CMD ["bun", "src/main.ts"]
