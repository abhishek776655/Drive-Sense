# DriveSense

DriveSense is a full-stack vehicle intelligence app. It records trips from a mobile device, stores location and driving-event telemetry, and turns that data into dashboard, trip, garage, and vehicle analytics.

The repo contains:

- Expo React Native mobile app
- FastAPI backend
- PostgreSQL / TimescaleDB
- Redis
- Docker Compose local stack
- Alembic migrations
- Demo seed data

## Features

- Email/password login with JWT auth
- Garage with multiple vehicles
- Add, edit, set active, and archive vehicle flows
- Live tracking screen with GPS route capture
- Auto trip start and smarter auto trip end
- Location point ingest with speed, heading, accuracy, altitude, provider, and timestamp
- Driving event ingest for harsh braking, rapid acceleration, and overspeed
- Trip list with date, vehicle, and score filters
- Trip details with route map, speed-colored segments, score, stats, and events
- Dashboard summaries for today, this week, and all time
- Per-vehicle analytics
- Demo seed data for profile, vehicles, trips, route points, and events

## Tech Stack

### Mobile

- Expo 54
- React Native 0.81
- React 19
- TypeScript
- NativeWind
- React Navigation
- Zustand
- Axios
- Expo Location
- Expo Sensors
- react-native-maps on native
- Leaflet / react-leaflet on web

### Backend

- FastAPI
- SQLAlchemy async
- asyncpg
- Alembic
- PostgreSQL / TimescaleDB
- Redis
- JWT auth

## Repo Structure

```text
.
├── backend/                 # FastAPI app, Alembic, models, schemas, services
├── mobile-expo/             # Expo React Native app
├── infra/postgres/initdb.d/ # Postgres / Timescale init SQL
├── docs/                    # Product and technical notes
├── docker-compose.yml       # Local full-stack Docker setup
├── .env.example             # Root Docker Compose defaults
└── README.md
```

## Environment Files

Root Docker Compose env:

```bash
cp .env.example .env
```

Backend env:

```bash
cp backend/.env.example backend/.env
```

Expo app env:

```bash
cat > mobile-expo/.env <<'EOF'
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000
EOF
```

For a real phone, do not use `localhost`. Use your Mac/server LAN IP or deployed API URL:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:8000
```

For production:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.yourdomain.com
```

## Local Development With Docker

From the repo root:

```bash
docker compose up -d --build
```

Check backend health:

```bash
curl http://localhost:8000/api/v1/healthz
curl http://localhost:8000/api/v1/readyz
```

Backend API docs:

```text
http://localhost:8000/docs
```

## Database Migrations

Alembic handles database schema changes.

Run migrations:

```bash
docker compose exec backend alembic upgrade head
```

Check current migration:

```bash
docker compose exec backend alembic current
```

Check latest migration head:

```bash
docker compose exec backend alembic heads
```

Current migration:

```text
backend/alembic/versions/20260513_0001_vehicle_plate_number.py
```

It creates the `citext` extension if needed and adds `vehicles.plate_number`.

## Seed Demo Data

The seed script creates a demo account and sample driving history.

Run:

```bash
docker compose exec backend python -m app.db.seed
```

Demo login:

```text
Email: demo@drivesense.com
Password: password123
```

Seed data includes:

- 1 demo user
- 5 vehicles
- roughly 2 weeks of trips
- route/location points
- harsh brake, rapid acceleration, and overspeed events
- varied driving scores, fuel usage, costs, speed, duration, and idle time

The seed script is idempotent. Running it again updates/keeps the demo data without duplicating the same trips.

## Backend Local Development Without Docker

Start Postgres and Redis first, then:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

Run migrations locally:

```bash
cd backend
alembic upgrade head
```

Seed locally:

```bash
cd backend
python -m app.db.seed
```

## Mobile Development

Install dependencies:

```bash
cd mobile-expo
npm install
```

Start Expo:

```bash
npm start
```

Run iOS:

```bash
npm run ios
```

Run Android:

```bash
npm run android
```

Run web:

```bash
npm run web
```

Typecheck:

```bash
cd mobile-expo
npx tsc --noEmit
```

## API Overview

Base path:

```text
/api/v1
```

Important routes:

- `POST /auth/login`
- `GET /auth/me`
- `GET /dashboard`
- `GET /dashboard/events`
- `GET /vehicles`
- `POST /vehicles`
- `PUT /vehicles/{vehicle_id}`
- `DELETE /vehicles/{vehicle_id}`
- `GET /vehicles/{vehicle_id}/stats`
- `GET /trips`
- `GET /trips/{trip_id}`
- `POST /trips/start`
- `POST /trips/end`
- `POST /trips/{trip_id}/locations`
- `POST /trips/{trip_id}/events`
- `GET /healthz`
- `GET /readyz`

## Trip Lifecycle

Trip start/end is currently decided by the native mobile tracking hook:

```text
mobile-expo/src/hooks/useLiveTracking.native.ts
```

Current rules:

- Auto-start when speed reaches `2.2 m/s`
- Auto-end after `180` seconds of idle time plus a stable low-drift GPS cluster
- Locations are streamed to the backend while the trip is active
- Events are detected on the frontend for the native live path and sent to the backend

Current event thresholds:

- Overspeed: above `27.78 m/s`
- Rapid acceleration: `>= 3.0 m/s²`
- Harsh brake: `<= -3.5 m/s²`

The backend stores the telemetry and computes rollups such as distance, duration, speed, score, event counts, and dashboard summaries.

## Deployment On A Personal Linux Server

Recommended flow:

1. Push this repo to GitHub.
2. SSH into the server.
3. Install Docker and Docker Compose.
4. Clone the repo.
5. Create production env files.
6. Run Docker Compose.
7. Put Caddy or Nginx in front for HTTPS.
8. Point Expo to the public backend URL.

Example server commands:

```bash
git clone git@github.com:abhishek776655/Drive-Sense.git
cd Drive-Sense
cp .env.example .env
cp backend/.env.example backend/.env
docker compose up -d --build
docker compose exec backend alembic upgrade head
docker compose exec backend python -m app.db.seed
```

Production env reminders:

- Use a strong `JWT_SECRET_KEY`
- Keep Postgres and Redis private
- Expose the API through HTTPS
- Set `ENVIRONMENT=prod`
- Set the Expo app to the public API URL

## GitHub Remote

This repo is configured to push with the custom SSH host alias:

```bash
git@github-abhi776655:abhishek776655/Drive-Sense.git
```

This uses:

```sshconfig
Host github-abhi776655
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_abhishek776655
  IdentitiesOnly yes
```

Useful Git commands:

```bash
git status
git add .
git commit -m "Your message"
git push
```

## Common Commands

Start stack:

```bash
docker compose up -d --build
```

Stop stack:

```bash
docker compose down
```

View backend logs:

```bash
docker compose logs -f backend
```

Run migrations:

```bash
docker compose exec backend alembic upgrade head
```

Seed data:

```bash
docker compose exec backend python -m app.db.seed
```

Mobile typecheck:

```bash
cd mobile-expo
npx tsc --noEmit
```

Backend syntax check:

```bash
python3 -m py_compile backend/app/**/*.py
```

## Notes

- `backend/.env` and `mobile-expo/.env` are intentionally ignored.
- `node_modules`, Expo caches, native build output, and Python cache files are ignored.
- For iOS real-device testing, use a public API URL or a LAN IP that the phone can reach.
- Web live tracking uses a mock tracking flow; native live tracking uses device location and sensors.
