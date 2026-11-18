# MySnakes

Multi-user reptile collection manager with first-class **Herpstat SpyderWeb** and **Govee** sensor support.

```
apps/api       NestJS on Bun · Postgres via Drizzle
apps/web       SolidJS + Vite
packages/shared  zod schemas + types shared by both
```

## How data gets in
- **Herpstat SpyderWeb (fw 5.1+)** pushes status to a webhook. Name a unit in Settings and you get a webhook URL (`POST /webhook/:userId/:webhookId`, where `userId` is the owner's internal id) and an API key. Paste both into the Herpstat under *ADMIN → Show Advanced Status Integration Options*. Each webhook belongs to one user and one Herpstat, and a unit can have several (`POST /devices/:id/webhooks`); keys can be rotated or webhooks removed from the unit's **Webhooks** menu. The API accepts the key in `?key=`, an `X-API-Key` / Bearer header, or a body field (`apikey`). Every raw upload is stored in `raw_uploads`, and `GET /devices/:id/raw-uploads` returns the 20 most recent, so `apps/api/src/herpstat/herpstat-parser.ts` can be tuned to the real payload.
- **Govee WiFi thermo-hygrometers**: each collection owner adds their own Govee API key. It is encrypted at rest, and the server polls Govee's cloud every 5 minutes.

## Tenancy
A **home** ("collection") is the ownership boundary. Users belong to homes as `owner` or `member`. Every query is scoped through `AccessService`.

## Config
Each app has its own `.env` (copy from `.env.example`, where every variable is documented):
- `apps/api/.env`: server URLs, `POSTGRES_*`, secrets, Discord app. Bun loads it on start.
- `apps/web/.env`: `VITE_API_URL`, baked into the build.

## Deploy
```sh
cp apps/api/.env.example apps/api/.env   # set NODE_ENV=production, URLs, POSTGRES_*, secrets, Discord
cp apps/web/.env.example apps/web/.env   # set VITE_API_URL to the API's public URL
bun run db:up                            # database only
bun install
bun run build                            # -> apps/web/dist
bun run start                            # API on $PORT
```
- **API**: NestJS on Bun. Applies migrations and TimescaleDB setup on boot. With
  `NODE_ENV=production` it refuses to start with the placeholder `JWT_SECRET`/`POSTGRES_ENCRYPTION_KEY`
  (generate them with `openssl rand -hex 32`). Run it under any process manager (pm2, systemd).
- **Web**: `apps/web/dist` is a static SPA. Serve it from any web server with a fallback to `index.html`
  for client-side routes. `WEB_URL` in `apps/api/.env` must be the origin it's served from.
- **DB**: TimescaleDB (Postgres 17) on `127.0.0.1:5433`. Compose creates it from `POSTGRES_USER`/`POSTGRES_PASS`/
  `POSTGRES_NAME` in `apps/api/.env`. `readings` is a hypertable with compression after 2 days and 14 days of
  raw retention. The `readings_5m` continuous aggregate is kept forever.

## Dev
```sh
cp apps/api/.env.example apps/api/.env   # dev defaults work as-is
cp apps/web/.env.example apps/web/.env
bun run db:up                  # TimescaleDB on :5433
bun install
bun run db:migrate             # or just start the API (migrates on boot)
bun run dev:api                # :3000
bun run dev:web                # :5173
bun run db:create add_thing    # new apps/api/src/db/migrations/NNNN_add_thing.ts
bun run db:revert              # run the last applied migration's down()
```

Each migration in `apps/api/src/db/migrations` exports `up(sql)` and `down(sql)`. Write both by hand
alongside your changes to `schema.ts`. Applied migrations are tracked in the `schema_migrations` table.
