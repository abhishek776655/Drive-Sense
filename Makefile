PYTHON ?= python3

.PHONY: test test-backend test-backend-integration test-mobile coverage coverage-backend coverage-mobile typecheck typecheck-mobile

test: test-backend test-mobile

test-backend:
	cd backend && $(PYTHON) -m pytest -m "not integration"

test-backend-integration:
	cd backend && $(PYTHON) -m pytest -m integration tests/integration

test-mobile:
	cd mobile-expo && npm test -- --runInBand

coverage: coverage-backend coverage-mobile

coverage-backend:
	cd backend && $(PYTHON) -m pytest -m "not integration" --cov=app --cov-report=term-missing

coverage-mobile:
	cd mobile-expo && npm test -- --runInBand --coverage

typecheck: typecheck-mobile

typecheck-mobile:
	cd mobile-expo && npm run typecheck
