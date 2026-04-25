# Parking API (TypeScript + Express)

This API is a TypeScript port of the Python backend in `D:\Vezbe\Python\APIPostgreSql\app`.
Routes are mounted at root (`/health`, `/auth/login`, `/garages`, `/tickets`, ...).

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
