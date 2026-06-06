# Garage Dashboard (React)

React port of the Vue dashboard from `D:\Vezbe\Python\APIPostgreSql\dashboard`, wired to the TypeScript API in `../api_nodejs` (default **http://localhost:4000**).

## Setup

```bash
cd frontend_react
copy .env.example .env
npm install
```

Ensure the API is running (`cd ../api_nodejs && npm run dev`) and PostgreSQL is initialized.

## Development

```bash
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` to port 4000.

Ticket images are served by the static fileserver in `APIPostgreSql/fileserver/storage` (port **9009**). Start it from that folder with `npm run dev` before viewing images.

Default login (from API `api_nodejs/.env`): `admin` / `admin`

## Structure (mirrors Vue dashboard)

```
src/
  api/           HTTP client and endpoint modules
  components/
    dashboard/   Dashboard widgets and modals
    ui/          Shared UI (ButtonIn, Modal, …)
  composables/   Hooks (polling, garage data, timeline chart)
  constants/
  contexts/
  locales/       en.json, sr.json
  router/
  services/
  styles/
  utils/
  views/         Login, Dashboard, Garage detail
```

## Environment

| Variable | Typical dev value |
|----------|-------------------|
| `VITE_API_URL` | `/api` (Vite proxy to port 4000) or `http://localhost:4000` |
| `VITE_API_KEY` | Same as `API_KEY` in `api_nodejs/.env` if the API requires it before login |
| `VITE_FILESERVER_URL` | `http://localhost:9009` (Vite static server for uploaded ticket images) |

Restart `npm run dev` after changing `.env`.
