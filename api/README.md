# API (Node.js + TypeScript)

REST API with:
- Express + TypeScript
- PostgreSQL connection through `pg`
- user/pass auth with JWT access token
- public health endpoint (`/api/hello-world`)

## Setup

1. Copy env template:
   - `copy .env.example .env`
2. Update `DATABASE_URL` and `JWT_SECRET` in `.env`.
3. Install dependencies:
   - `npm install`
4. Initialize DB table:
   - `npm run db:init`
5. Run dev server:
   - `npm run dev`

## Endpoints

- `GET /api/hello-world` (public)
- `POST /api/auth/register` (public) body: `{ "username": "...", "password": "..." }`
- `POST /api/auth/login` (public) body: `{ "username": "...", "password": "..." }`
- `GET /api/me` (protected, requires `Authorization: Bearer <accessToken>`)
