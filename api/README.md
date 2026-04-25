# Parking API (TypeScript + Express)

This API is a TypeScript port of the Python backend in `D:\Vezbe\Python\APIPostgreSql\app`.
Routes are mounted at root (`/health`, `/auth/login`, `/garages`, `/tickets`, ...).

## Setup

1. Copy env file:
   - `copy .env.example .env`
2. Install dependencies:
   - `npm install`
3. Ensure database schema is migrated using the Python repo Alembic migrations:
   - from `D:\Vezbe\Python\APIPostgreSql`: `alembic upgrade head`
4. Run server:
   - `npm run dev`

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
