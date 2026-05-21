# Garage Dashboard (React)

React port of the Vue dashboard from `D:\Vezbe\Python\APIPostgreSql\dashboard`, wired to the TypeScript API in `../api` (default **http://localhost:4000**).

## Setup

```bash
cd frontend
copy .env.example .env
npm install
```

Ensure the API is running (`cd ../api && npm run dev`) and PostgreSQL is initialized.

## Development

```bash
npm run dev
```

Open http://localhost:5173 — Vite proxies `/api` and `/uploads` to port 4000.

Default login (from API `.env`): `admin` / `admin`

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

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `http://localhost:4000` |
| `VITE_API_KEY` | (optional) |
