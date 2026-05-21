# Parking API (TypeScript + Express)

This API is a TypeScript port of the Python backend in `D:\Vezbe\Python\APIPostgreSql\app`.
Routes are mounted at root (`/health`, `/auth/login`, `/garages`, `/tickets`, ...).

## Project layout

Source code under `src/` is split into three layers:

| Layer | Folder | Role |
|-------|--------|------|
| Routes | `routes/` | HTTP only: read `req`, call a service, send `res`, forward errors to middleware |
| Services | `services/` | Business rules, validation, transactions, mapping rows to API shapes |
| Repositories | `repositories/` | SQL and database access (no Express types) |

Shared helpers live in `utils/` (pagination, query parsing, Postgres error codes). Domain examples: `routes/tickets.ts` → `services/ticketsQueryService.ts` + `services/tickets.ts` → `repositories/ticketsRepository.ts`.

## Setup

1. Copy env file:
   - `copy .env.example .env`
2. Install dependencies:
   - `npm install`
3. Apply the database schema (pick one):
   - **From this repo (empty PostgreSQL database):** create an empty database (for example `createdb garaza` or via pgAdmin), set `DATABASE_URL` in `.env`, then run `npm run db:init`. This executes [`db/schema.sql`](db/schema.sql) and stamps `alembic_version` at `c2559069f3b5` so it matches the Python Alembic chain head.
   - **From the Python repo:** if the database already exists and you use Alembic there, from `D:\Vezbe\Python\APIPostgreSql` run `alembic upgrade head` against the same `DATABASE_URL`. Do not run `db:init` on a database that already has tables from Alembic unless you intend to replace the schema.
4. Run server:
   - `npm run dev`

## Database from this repo

- `npm run db:init` requires `DATABASE_URL` and applies [`db/schema.sql`](db/schema.sql) to the **existing** database (it does not run `CREATE DATABASE`).
- After a successful init, `GET /health` should return `database: "connected"`.
- For a database initialized only via this script, `alembic upgrade head` in the Python project should effectively no-op at the stamped revision.

### Demo data (timeline / dashboard)

`npm run db:seed-timeline` runs [`scripts/seed-timeline-demo.js`](scripts/seed-timeline-demo.js). It creates random vehicles and **closed** tickets over the last 30 days for `garage_id = 1` (plates prefixed with `BZ` for easy cleanup).

**Before running:**

1. `DATABASE_URL` in `.env` (same as the API).
2. At least one row in `vehicle_types`.
3. At least one active row in `parking_spot` for garage `1` (edit `GARAGE_ID` in the script if needed).

Safe to re-run; it only inserts new rows (it does not truncate existing data).

## Authentication

- If `API_KEY` is empty, requests are open.
- If `API_KEY` is set, all non-public routes require either:
  - `X-API-Key: <API_KEY>`
  - `Authorization: Bearer <token>`
- Public routes: `GET /`, `GET /health`, `POST /auth/login`, `GET /uploads/*`.

## Main endpoints

- `GET /`
- `GET /health`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `/garages`
- `/vehicle-types`
- `/vehicles`
- `/spots`
- `/tickets`
- `/payments`
- `GET /dashboard/analytics`
- `POST /upload/ticket-image`
