# EngageHUB

Social media management platform built with React (Vite) and Node.js (Express). This repository is organized as a monorepo with separate frontend and backend packages.

## Project structure

```txt
engagehub/
├── frontend/          # React + Vite SPA (port 5173)
├── backend/           # Express API (port 4000)
├── package.json       # Root scripts (run both apps)
├── README.md
└── .gitignore
```

### Frontend (`frontend/`)

- `src/` — React components, pages, hooks, context, services
- `src/config/api.js` — centralized API base URL (`VITE_API_URL`)
- `vite.config.js`, `tailwind.config.js`, `postcss.config.js`
- `index.html`, `vercel.json`

### Backend (`backend/`)

- `index.js` — Express app and auth routes
- `start.js` — env loading and server bootstrap
- `routes/`, `controllers/`, `services/`, `models/`, `config/`, `utils/`, `jobs/`
- `public/uploads/` — hosted media for social platforms
- `scripts/` — OAuth and integration debug utilities

## Prerequisites

- Node.js 18+
- MongoDB (Atlas or local)
- OAuth credentials for the social platforms you connect (see `backend/.env.example`)

## Installation

From the repository root:

```bash
npm run install:all
```

Or install each package separately:

```bash
npm install
cd frontend && npm install
cd ../backend && npm install
```

## Environment setup

### Backend

Copy the example file and fill in your secrets:

```bash
cp backend/.env.example backend/.env
```

Required variables include `MONGODB_URI`, `JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `APP_BASE_URL`, and `CLIENT_BASE_URL`. OAuth redirect URIs must match your API host (local: `http://localhost:4000`, production: your Render/Railway URL).

### Frontend

Copy the example file:

```bash
cp frontend/.env.example frontend/.env
```

Default local API URL:

```env
VITE_API_URL=http://localhost:4000
```

Use the API origin only — do **not** append `/api`.

For production builds (Vercel/Netlify), set `VITE_API_URL` to your deployed API, e.g. `https://engagehub.onrender.com`.

## Running locally

### Both frontend and backend

From the repo root:

```bash
npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:4000

### Frontend only

```bash
cd frontend
npm run dev
```

### Backend only

```bash
cd backend
npm run dev
```

## Production scripts

| Command | Location | Description |
|---------|----------|-------------|
| `npm run build` | root | Build frontend for static hosting |
| `npm run build` | frontend | Vite production build → `frontend/dist` |
| `npm start` | backend | Start Express API |

## Deployment

### Frontend (Vercel / Netlify)

1. Set the project root to `frontend/` (or deploy from that directory).
2. Build command: `npm run build`
3. Output directory: `dist`
4. Environment variable: `VITE_API_URL=https://your-api.example.com`

`vercel.json` is included for SPA routing.

### Backend (Render / Railway / VPS)

1. Set the project root to `backend/`.
2. Start command: `npm start`
3. Set all variables from `backend/.env.example` in the host dashboard.
4. Ensure `APP_BASE_URL` matches your API URL and OAuth redirect URIs are registered with each provider.
5. Set `CLIENT_BASE_URL` to your frontend URL for CORS.

### CORS

The API allows requests from `CLIENT_BASE_URL` (default `http://localhost:5173`). Update this in production when the SPA is hosted on a different domain.

## Debug utilities

From `backend/`:

```bash
npm run debug:meta-oauth
npm run debug:google-business-post
```

## Health check

```bash
curl http://localhost:4000/api/health
```

## License

Private — all rights reserved.
