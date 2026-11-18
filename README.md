# MySnakes

Multi-user reptile collection manager with first-class **Herpstat SpyderWeb** and **Govee** sensor support.

```
apps/api       NestJS on Bun · Postgres via Drizzle
apps/web       SolidJS + Vite
packages/shared  zod schemas + types shared by both
```

## How data gets in
- **Herpstat SpyderWeb (fw 5.1+)** pushes status to the API. Add a unit in Settings, then paste its upload URL and API key into the Herpstat under *ADMIN → Show Advanced Status Integration Options*. The API accepts the key in the URL path, in `?key=`, in an `X-API-Key` / Bearer header, or as a body field (`apikey`). Every raw upload is stored in `raw_uploads`, and `GET /devices/:id/raw-uploads` returns the 20 most recent, so `apps/api/src/herpstat/ingest/herpstat-parser.ts` can be tuned to the real payload.
- **Govee WiFi thermo-hygrometers**: each collection owner adds their own Govee API key. It is encrypted at rest, and the server polls Govee's cloud every `GOVEE_POLL_SECONDS`.

## Tenancy
A **home** ("collection") is the ownership boundary. Users belong to homes as `owner` or `member`. Every query is scoped through `AccessService`.

## Config
Each app has its own `.env` (copy from `.env.example`, where every variable is documented):
- `apps/api/.env`: database, secrets, `PORT`, public URLs, polling. Bun loads it on start.
- `apps/web/.env`: `VITE_API_URL`, baked into the build.

## Deploy
```sh
cp apps/api/.env.example apps/api/.env   # set NODE_ENV=production, secrets, PORT, URLs
cp apps/web/.env.example apps/web/.env   # set VITE_API_URL to the API's public URL
docker compose up -d                     # database only
bun install
bun run build                            # -> apps/web/dist
bun run start                            # API on $PORT
```
- **API**: NestJS on Bun. Applies migrations and TimescaleDB setup on boot (`MIGRATE_ON_BOOT`). With
  `NODE_ENV=production` it refuses to start with the placeholder `JWT_SECRET`/`SECRET_KEY`
  (generate them with `openssl rand -hex 32`). Run it under any process manager (pm2, systemd).
- **Web**: `apps/web/dist` is a static SPA. Serve it from any web server with a fallback to `index.html`
  for client-side routes. `CORS_ORIGIN` in `apps/api/.env` must list the origin it's served from.
- **DB**: TimescaleDB (Postgres 17) on `127.0.0.1:5433`. `POSTGRES_PASSWORD` in `apps/api/.env` must match
  `DATABASE_URL`. `readings` is a hypertable with compression after 2 days and raw retention of
  `READINGS_RETENTION_DAYS`. The `readings_5m` continuous aggregate is kept forever.

LAN polling of Herpstat `/RAWSTATUS` only works when the API can reach the units (set
`HERPSTAT_SCAN_SUBNETS=192.168.1` to scan a specific LAN).

## Dev
```sh
cp apps/api/.env.example apps/api/.env   # dev defaults work as-is
cp apps/web/.env.example apps/web/.env
docker compose up -d           # TimescaleDB on :5433
bun install
bun run db:migrate             # or just start the API (migrates on boot)
bun run dev:api                # :3000
bun run dev:web                # :5173
bun run db:generate            # after editing apps/api/src/db/schema.ts
```
