## 1. Backend Test Foundation

- [x] 1.1 Add `backend/requirements-dev.txt` with pytest, async/API test, and coverage tooling.
- [x] 1.2 Add backend pytest configuration for test discovery, markers, and default warning behavior.
- [x] 1.3 Reorganize the existing backend trip insight test under `backend/tests/unit`.
- [x] 1.4 Add `backend/tests/integration` structure and ensure integration tests are marked with `@pytest.mark.integration`.
- [x] 1.5 Add or update representative backend fast tests for high-risk service or contract logic.

## 2. Mobile Test Foundation

- [x] 2.1 Keep existing mobile component tests colocated and document the colocated `__tests__` convention.
- [x] 2.2 Add shared mobile API mock/test helper utilities for service tests.
- [x] 2.3 Add representative mobile tests for services, stores, route utilities, or API data handling.
- [x] 2.4 Add lightweight mock/data-based contract checks for backend-shaped data consumed by mobile services.

## 3. Root Workflow

- [x] 3.1 Add a root `Makefile` with backend fast test, mobile test, all fast test, backend coverage, mobile coverage, combined coverage, and backend integration targets.
- [x] 3.2 Ensure default fast test targets run on the host without Docker.
- [x] 3.3 Ensure backend integration targets are explicit and reserved for Docker-backed or locally provisioned integration dependencies.

## 4. Documentation

- [x] 4.1 Add `docs/testing.md` covering setup, dependency installation, test structure, and command usage.
- [x] 4.2 Document Phase 1, Phase 2, and Phase 3 boundaries.
- [x] 4.3 Document coverage reporting as local-only with no Phase 1 threshold enforcement.
- [x] 4.4 Document typecheck or quality hooks only where already available or trivially scriptable.

## 5. Verification

- [x] 5.1 Run backend fast tests through the new root command.
- [x] 5.2 Run mobile tests through the new root command.
- [x] 5.3 Run local coverage commands and confirm they report results without threshold failures.
- [x] 5.4 Confirm a fresh developer path is documented from dependency install to passing representative tests.
