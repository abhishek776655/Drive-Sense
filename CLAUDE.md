# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend

```bash
# Fast unit tests (no Docker required)
make test-backend

# Integration tests (requires running Docker stack)
make test-backend-integration

# Single test
cd backend && python -m pytest tests/unit/test_driving_score_service.py

# Coverage
make coverage-backend

# Run locally without Docker
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Migrations
docker compose exec backend alembic upgrade head
docker compose exec backend alembic revision --autogenerate -m "description"

# Seed demo data (idempotent)
docker compose exec backend python -m app.db.seed
```

### Mobile

```bash
# All mobile tests
make test-mobile

# Single test file
cd mobile-expo && npm test -- src/components/__tests__/TripRouteInsightsCard.test.tsx

# Typecheck
make typecheck-mobile

# Start Expo dev server
cd mobile-expo && npm start

# Platform-specific
npm run ios / npm run android / npm run web
```

### Full stack

```bash
docker compose up -d --build
make test          # backend unit + mobile jest
make coverage      # both coverage reports
```

## Architecture

### Backend (`backend/app/`)

FastAPI with async SQLAlchemy (`asyncpg`) and Alembic migrations. All DB access is async. Config lives in `core/config.py` as a pydantic-settings `Settings` class with `@lru_cache`; inject with `Depends(get_settings)`.

Layer order: `routers/` → `services/` → `models/` (SQLAlchemy ORM). Schemas in `schemas/` are Pydantic models for request/response. Services are the only layer that touches the DB session.

Key services:
- `trip_service.py` — start/end trips, rollup stats (distance, score, duration)
- `driving_score_service.py` — computes per-trip score from event severity
- `driving_event_detection_service.py` — threshold logic for harsh brake / rapid accel / overspeed
- `location_ingestion_service.py` — bulk-insert route points (TimescaleDB hypertable)
- `trip_insight_service.py` — narrative insights from trip telemetry

Tests: `backend/tests/unit/` for pure logic (no DB). Integration tests under `backend/tests/integration/` must carry `@pytest.mark.integration`; they are excluded from `make test-backend` by default. `asyncio_mode = auto` in `pytest.ini` so async test functions work without decorators.

### Mobile (`mobile-expo/src/`)

Expo 54 / React Native 0.81. TypeScript throughout.

**Platform split**: files with `.native.ts` / `.web.ts` suffixes are resolved automatically by Metro/Expo. Live tracking (`hooks/useLiveTracking.native.ts`) uses real device GPS and sensors on native; `hooks/useMockLiveTracking.ts` drives the web experience.

**Theme**: custom `AppTheme` context in `theme/appTheme.tsx`. Use `useAppTheme()` to access colors and typography — do not rely on NativeWind class names for colors/fonts since the design system is token-based. Theme persists to AsyncStorage; Nunito font family throughout.

**State**: Zustand stores in `store/`. Currently `dashboardStore.ts` and `vehiclePreferencesStore.ts`. Stores are self-contained (fetch + cache + error state).

**API layer**: Axios client in `services/apiClient.ts`. Bearer token pulled from AsyncStorage on every request. 401 responses outside the login route trigger `authExpiredHandler` which resets auth state in `AppRoot.tsx`. Always use `getApiErrorMessage(error)` to extract user-facing error strings.

**Navigation**: 5-tab bottom nav (Home → Trips → Live → Garage → Profile), each tab has its own stack navigator under `navigation/`. The `AppSidebarProvider` wraps the tab navigator for the profile/settings slide-out.

**Tests**: colocated `__tests__/` directories beside the modules they test. Use `testUtils/mockApiClient.ts` to mock Axios for service-layer tests; don't recreate the mock inline per-file.

### Environment

Backend reads from `backend/.env` (copy from `backend/.env.example`). Required vars: `POSTGRES_*`, `REDIS_URL`, `JWT_SECRET_KEY`. Mobile reads `EXPO_PUBLIC_API_BASE_URL`; defaults to the deployed production API if unset.

### Trip lifecycle

Auto-start at `2.2 m/s`. Auto-end after `180 s` idle + stable GPS cluster. Event thresholds: overspeed `> 27.78 m/s`, rapid accel `≥ 3.0 m/s²`, harsh brake `≤ -3.5 m/s²`. These constants live in `hooks/useLiveTracking.native.ts`; matching backend thresholds are in `services/driving_event_detection_service.py`.
