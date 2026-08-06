## Why

DriveSense has early backend and mobile tests, but there is no coherent whole-app testing workflow for fast local development. A phased testing module will help developers catch regressions in shared trip, vehicle, dashboard, and API behavior before changes reach CI or end-to-end testing.

## What Changes

- Add a whole-app testing workflow for local developer feedback across the FastAPI backend and Expo mobile app.
- Establish a hybrid structure where tests stay near their owning app, with root-level commands and documentation tying the workflow together.
- Standardize backend tests on pytest while allowing existing `unittest.TestCase` tests to continue running during migration.
- Split backend tests into fast unit tests and optional Docker-backed integration tests, with integration tests excluded from the default loop.
- Keep mobile tests colocated in `__tests__` directories near components, services, stores, utilities, and hooks.
- Add shared mobile API mocking helpers for service and lightweight contract tests.
- Add local coverage commands without enforcing thresholds in Phase 1.
- Define later phases for CI, backend integration tests, and mobile/native end-to-end testing.

## Capabilities

### New Capabilities

- `testing-workflow`: Defines the local and phased testing workflow for DriveSense development across backend, mobile, coverage reporting, integration boundaries, and future CI/e2e expansion.

### Modified Capabilities

- None.

## Impact

- Affects root developer workflow documentation and commands.
- Adds backend dev/test dependencies such as pytest tooling without changing runtime backend dependencies.
- Reorganizes backend test layout under unit and integration conventions.
- Adds or extends mobile Jest test helpers and representative tests.
- Does not change production APIs, database schema, runtime behavior, or mobile app UX.
