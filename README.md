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

## Run it (Docker)
```sh
cp .env.example .env     # set JWT_SECRET, SECRET_KEY, POSTGRES_PASSWORD
# VPS: SITE_ADDRESS=snakes.example.com and PUBLIC_URL=https://snakes.example.com (Caddy gets the TLS cert)
docker compose up -d --build
```
- `web`: Caddy serves the SolidJS build and proxies `/api/*` to `api`
- `api`: NestJS on Bun. Applies migrations and TimescaleDB setup on boot (`MIGRATE_ON_BOOT`)
- `db`: TimescaleDB (Postgres 17). `readings` is a hypertable with compression after 2 days and
  raw retention of `READINGS_RETENTION_DAYS`. The `readings_5m` continuous aggregate is kept forever.

LAN polling of Herpstat `/RAWSTATUS` only works when the API can reach the units. In Docker, set
`HERPSTAT_SCAN_SUBNETS=192.168.1` so network scans hit your LAN, not the container network.

## Dev
```sh
docker compose up -d db        # TimescaleDB on :5433
bun install
bun run db:migrate             # or just start the API (migrates on boot)
bun run dev:api                # :3000
bun run dev:web                # :5173
bun run db:generate            # after editing apps/api/src/db/schema.ts
```
