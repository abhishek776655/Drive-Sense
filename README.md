# DriveSense

DriveSense is a full-stack starter workspace (mobile + API + infra) prepared for:
- React Native (TypeScript) mobile app
- FastAPI (Python) backend API
- PostgreSQL + TimescaleDB
- Redis

No product features are implemented yet (this is scaffolding only).

## Repo structure

```
.
├─ mobile/          # React Native (TypeScript)
├─ backend/         # FastAPI app
├─ infra/           # Infra helpers (DB init scripts, etc.)
├─ docs/            # Project docs (placeholder)
└─ docker-compose.yml
```

## Environment files

- `./.env.example` (docker-compose defaults; optional)
- `./backend/.env.example` (backend defaults)
- `./mobile/.env.example` (placeholder for future mobile config; not wired yet)

## Quick start (Docker)

1) (Optional) copy root env defaults:

```sh
cp .env.example .env
```

2) Start services:

```sh
docker compose up --build
```

3) Verify backend:

```sh
curl http://localhost:8000/api/v1/healthz
```

## Backend (local dev, without Docker)

```sh
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

## Mobile (local dev)

From `mobile/`:

```sh
npm start
```

Then in another terminal:

```sh
npm run android
```

For iOS (macOS):

```sh
bundle install
bundle exec pod install
npm run ios
```

