# Testing

DriveSense uses a phased, whole-app testing workflow. Phase 1 is optimized for fast local developer feedback across the FastAPI backend and Expo mobile app.

## Setup

Install backend runtime and test dependencies:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt -r requirements-dev.txt
```

Install mobile dependencies:

```bash
cd mobile-expo
npm install
```

The root commands below assume dependencies are installed on the host. The fast test loop does not require Docker.

## Root Commands

From the repo root:

```bash
make test
make test-backend
make test-mobile
make coverage
make coverage-backend
make coverage-mobile
make test-backend-integration
make typecheck-mobile
```

`make test` runs backend fast tests and mobile Jest tests. `make coverage` generates local coverage reports for both apps without enforcing thresholds.

## Backend Tests

Backend tests run with pytest from `backend/`.

Fast unit tests live under:

```text
backend/tests/unit
```

Optional integration tests live under:

```text
backend/tests/integration
```

Integration tests must be marked with `@pytest.mark.integration`, either on each test or as a module-level `pytestmark`. The default backend command excludes this marker:

```bash
make test-backend
```

Run integration tests explicitly when Docker-backed or locally provisioned dependencies are available:

```bash
make test-backend-integration
```

New backend tests should use pytest style. Existing `unittest.TestCase` tests can remain during migration because pytest will discover and run them.

## Mobile Tests

Mobile tests stay colocated near the source modules they exercise:

```text
mobile-expo/src/components/__tests__
mobile-expo/src/services/__tests__
mobile-expo/src/store/__tests__
mobile-expo/src/utils/__tests__
mobile-expo/src/hooks/__tests__
```

Use `mobile-expo/src/testUtils/mockApiClient.ts` for service tests that need mocked backend API responses. This keeps network tests fast and avoids duplicating low-level client mocks in each test.

Lightweight contract checks in Phase 1 use mock data shaped like backend responses. They do not start the backend process.

## Coverage

Coverage is available locally:

```bash
make coverage-backend
make coverage-mobile
make coverage
```

Phase 1 does not enforce a coverage threshold. Coverage reports are for finding blind spots while the suite is still taking shape.

## Typecheck And Quality Hooks

The testing module does not add a new linting system. The mobile app has a TypeScript check:

```bash
make typecheck-mobile
```

Backend typechecking and linting can be added later as a separate quality workflow if needed.

## Phases

Phase 1: host-only fast tests, representative backend and mobile tests, shared mobile API test helpers, root Makefile commands, and testing documentation.

Phase 2: CI plus backend integration tests using Docker services or equivalent provisioned dependencies. Backend and mobile fast tests should become blocking CI checks. Coverage artifacts can be uploaded, still without a required threshold unless the team chooses one.

Phase 3: mobile/native end-to-end testing for flows such as login, vehicle selection, trip list, trip details, and live tracking.

## Fresh Developer Path

1. Install backend runtime and dev dependencies.
2. Install mobile dependencies.
3. Run `make test-backend`.
4. Run `make test-mobile`.
5. Run `make test` for the combined fast loop.
