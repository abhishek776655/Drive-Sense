## ADDED Requirements

### Requirement: Root test workflow
The system SHALL provide root-level local commands that run backend fast tests, mobile tests, all fast tests, backend coverage, mobile coverage, and combined coverage workflows.

#### Scenario: Developer runs all fast tests locally
- **WHEN** a developer runs the documented root command for all fast tests on a host with backend and mobile test dependencies installed
- **THEN** the command runs the backend fast test suite and the mobile Jest suite without requiring Docker

#### Scenario: Developer runs app-specific tests locally
- **WHEN** a developer runs a documented root command for backend-only or mobile-only tests
- **THEN** only the selected app's fast tests run

#### Scenario: Developer runs coverage locally
- **WHEN** a developer runs a documented coverage command
- **THEN** coverage output is generated for the selected backend, mobile, or combined workflow without enforcing a minimum threshold

### Requirement: Backend pytest workflow
The system SHALL use pytest as the backend test runner while continuing to support existing `unittest.TestCase` tests during migration.

#### Scenario: Existing backend unittest tests run under pytest
- **WHEN** a developer runs the backend fast test command
- **THEN** existing backend `unittest.TestCase` tests are discovered and executed by pytest

#### Scenario: New backend tests use pytest conventions
- **WHEN** a developer adds a new backend unit test
- **THEN** the documented convention guides them to place it under the backend unit test structure and write it in pytest style

#### Scenario: Backend test dependencies are installed explicitly
- **WHEN** a developer follows the backend testing setup documentation
- **THEN** runtime dependencies and dev/test dependencies are installed from separate requirements files

### Requirement: Backend test separation
The system SHALL separate backend fast unit tests from optional integration tests using both directory structure and pytest markers.

#### Scenario: Default backend command excludes integration tests
- **WHEN** a developer runs the default backend fast test command
- **THEN** tests marked `integration` are not executed

#### Scenario: Integration tests are explicitly runnable
- **WHEN** a developer runs the documented backend integration test command
- **THEN** only or specifically integration-marked tests run according to the documented command

#### Scenario: Integration tests are easy to identify
- **WHEN** a developer browses backend tests
- **THEN** optional integration tests are located under an integration test directory and marked with `@pytest.mark.integration`

### Requirement: Mobile colocated test workflow
The system SHALL keep mobile tests colocated near the source modules they exercise.

#### Scenario: Component tests remain colocated
- **WHEN** a developer adds or updates a mobile component test
- **THEN** the documented convention guides them to use a nearby `__tests__` directory under the relevant source area

#### Scenario: Service and store tests remain colocated
- **WHEN** a developer adds or updates tests for mobile services, stores, utilities, or hooks
- **THEN** the documented convention guides them to use colocated `__tests__` directories near those modules

### Requirement: Shared mobile API test helpers
The system SHALL provide shared mobile test helpers for mocked API calls and mock/data-based contract checks.

#### Scenario: Mobile service test uses shared API mock helper
- **WHEN** a mobile service test needs to simulate backend API responses
- **THEN** it can use a shared helper instead of duplicating low-level client mocking in each test

#### Scenario: Contract shape is checked without a live backend
- **WHEN** a lightweight contract test verifies mobile handling of backend-shaped data
- **THEN** the test uses mock data or fixtures and does not require the backend process to run

### Requirement: Testing documentation
The system SHALL document the testing module structure, setup, commands, phase boundaries, and representative test patterns.

#### Scenario: Fresh developer follows testing docs
- **WHEN** a fresh developer opens the testing documentation
- **THEN** they can install required dependencies and run representative backend and mobile fast tests locally

#### Scenario: Phase boundaries are documented
- **WHEN** a developer reads the testing documentation
- **THEN** Phase 1 is defined as local fast tests and representative coverage, Phase 2 as CI plus backend integration tests, and Phase 3 as mobile/native end-to-end testing

### Requirement: Representative Phase 1 coverage
The system SHALL include representative backend and mobile tests that prove the testing workflow works across high-risk, high-reuse logic.

#### Scenario: Backend representative tests cover service logic
- **WHEN** a developer runs backend fast tests
- **THEN** representative tests exercise backend service or contract logic such as trip insights, scoring, event detection, auth, vehicle, or trip behavior

#### Scenario: Mobile representative tests cover app logic
- **WHEN** a developer runs mobile tests
- **THEN** representative tests exercise mobile components, services, stores, route utilities, or API data handling
