## Context

DriveSense is a polyglot app with a FastAPI backend, Expo React Native mobile app, PostgreSQL/TimescaleDB, Redis, and Docker Compose local stack. The repo currently has one backend service test using `unittest` and one mobile component test using Jest and `@testing-library/react-native`, but it does not yet provide a single developer-facing testing workflow for running fast local checks across both apps.

This change introduces a phased testing module framed as a developer workflow capability with product quality outcomes. Phase 1 focuses on host-only fast feedback, representative tests, local coverage reporting, documentation, and root-level commands. Phase 2 will add CI and Docker-backed backend integration tests. Phase 3 will add mobile/native end-to-end coverage.

## Goals / Non-Goals

**Goals:**

- Give a fresh developer a documented, root-level way to run fast backend and mobile tests locally.
- Standardize backend test execution on pytest while preserving compatibility with existing `unittest.TestCase` tests.
- Keep backend unit tests fast by default and separate optional integration tests using both folder conventions and pytest markers.
- Keep mobile tests colocated near source files and add shared API mocking helpers for service and mock/data-based contract tests.
- Provide local coverage commands without enforcing thresholds during Phase 1.
- Add representative backend and mobile tests that prove the workflow works end to end.
- Document Phase 2 and Phase 3 boundaries so implementation stays focused.

**Non-Goals:**

- Do not add CI jobs in Phase 1.
- Do not add mobile/native end-to-end tooling in Phase 1.
- Do not require Docker for the default fast test loop.
- Do not introduce a full linting system or broad quality gate beyond testing.
- Do not change production runtime behavior, API contracts, database schema, or mobile UX.

## Decisions

### Use a hybrid test structure

Tests will stay near their owning app while root-level commands and docs make the workflow feel unified. Backend tests live under `backend/tests`, mobile tests stay colocated in `mobile-expo/src/**/__tests__`, and root `Makefile` targets orchestrate common commands.

Alternative considered: a top-level `tests/` tree. This would make the testing module visually central, but it would separate tests from the backend/mobile code they exercise and make framework-specific imports harder to maintain.

### Standardize backend on pytest

Backend tests will run through pytest, with new tests written in pytest style. Existing `unittest.TestCase` tests may remain and run under pytest during migration. Backend dev/test dependencies will live in `backend/requirements-dev.txt` so production dependencies remain focused.

Alternative considered: keeping `unittest` as the primary runner. That preserves the current single test style, but it is less ergonomic for fixtures, async testing, FastAPI clients, markers, and future database setup.

### Split backend fast and integration tests

Fast backend tests will be the default. Integration tests will live under `backend/tests/integration` and use `@pytest.mark.integration`. Default backend commands will exclude integration tests; explicit commands will run them when Docker-backed dependencies are available.

Alternative considered: using folders only or markers only. Both together make the suite easy to browse and easy to filter from commands and CI.

### Keep mobile tests colocated

Mobile tests will continue the existing colocated `__tests__` pattern for components, services, stores, utilities, and hooks. Shared test helpers will be added for API mocking so service tests can avoid repeated Axios/client mocking boilerplate.

Alternative considered: a centralized `mobile-expo/tests` directory. Colocation better fits React Native component and service maintenance and matches the repo's current mobile pattern.

### Prioritize fast developer feedback

Phase 1 will include scaffold plus representative tests, not a broad test-writing sprint. High-value targets include backend service logic and API contract smoke coverage, plus mobile services, stores, route utilities, and key UI components. Lightweight contract checks will be mock/data-based rather than full cross-process integration.

Alternative considered: broad initial coverage or immediate e2e. Those would slow the first useful feedback loop and risk making the testing module brittle before the foundation is stable.

### Add local coverage without thresholds

Coverage commands will be available locally for backend and mobile tests, but Phase 1 will not enforce thresholds. Coverage will reveal blind spots before becoming a gate.

Alternative considered: enforce thresholds immediately. Early thresholds can incentivize low-value tests before the suite has meaningful breadth.

## Risks / Trade-offs

- Pytest dependency drift from runtime requirements -> Keep pytest tooling in `backend/requirements-dev.txt` and document install commands clearly.
- Integration tests accidentally enter the fast loop -> Use both `backend/tests/integration` and `@pytest.mark.integration`, and make default commands exclude the marker.
- Mobile API mocks diverge from backend response shapes -> Add lightweight mock/data-based contract checks and document the need for stronger Phase 2 integration coverage.
- Root Makefile portability varies across developer machines -> Keep targets as thin wrappers around existing npm/python commands and document direct per-app commands as fallback.
- Phase 1 grows into CI/e2e work -> Capture CI plus backend integration tests as Phase 2 and mobile/native e2e as Phase 3 in docs and tasks.
