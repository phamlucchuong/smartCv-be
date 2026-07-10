MVN ?= mvn
MVN_RUN ?= $(MVN) -q
BACKEND := backend

# ── Backend: Tests ────────────────────────────────────────────────────────────

test-user:
	cd $(BACKEND)/user-service && $(MVN) test

test-gateway:
	cd $(BACKEND)/api-gateway && $(MVN) test

test-job:
	cd $(BACKEND)/job_service && $(MVN) test

test-application:
	cd $(BACKEND)/application_service && $(MVN) test

test-payment:
	cd $(BACKEND)/payment-service && $(MVN) test

test-ai:
	cd $(BACKEND)/ai_engine_service && $(MVN) test

test-noti:
	cd $(BACKEND)/notification-service && GOCACHE=/tmp/smartcv-go-build go test ./... -v

test-backend: test-user test-gateway test-job test-application test-payment test-ai test-noti

# ── Backend: Run individual ───────────────────────────────────────────────────

run-user:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	cd $(BACKEND)/user-service && $(MVN_RUN) spring-boot:run

run-gateway:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	cd $(BACKEND)/api-gateway && $(MVN_RUN) spring-boot:run

run-job:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	cd $(BACKEND)/job_service && $(MVN_RUN) spring-boot:run

run-application:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	cd $(BACKEND)/application_service && $(MVN_RUN) spring-boot:run

run-ai:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	cd $(BACKEND)/ai_engine_service && $(MVN_RUN) spring-boot:run

run-payment:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	cd $(BACKEND)/payment-service && $(MVN_RUN) spring-boot:run

run-noti:
	cd $(BACKEND)/notification-service && go run cmd/server/main.go

run-noti-migrated: migrate-noti
	cd $(BACKEND)/notification-service && go run cmd/server/main.go

# ── Backend: Run all (parallel, logs to backend/logs/) ───────────────────────

run-backend:
	@mkdir -p $(BACKEND)/logs
	@set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	(cd $(BACKEND)/user-service        && $(MVN_RUN) spring-boot:run 2>&1 | tee ../logs/user-service.log) & \
	(cd $(BACKEND)/api-gateway         && $(MVN_RUN) spring-boot:run 2>&1 | tee ../logs/api-gateway.log) & \
	(cd $(BACKEND)/job_service         && $(MVN_RUN) spring-boot:run 2>&1 | tee ../logs/job-service.log) & \
	(cd $(BACKEND)/application_service && $(MVN_RUN) spring-boot:run 2>&1 | tee ../logs/application-service.log) & \
	(cd $(BACKEND)/ai_engine_service   && $(MVN_RUN) spring-boot:run 2>&1 | tee ../logs/ai-engine-service.log) & \
	(cd $(BACKEND)/payment-service     && $(MVN_RUN) spring-boot:run 2>&1 | tee ../logs/payment-service.log) & \
	(cd $(BACKEND)/notification-service && go run cmd/server/main.go 2>&1 | tee ../logs/notification-service.log) & \
	echo "All services starting. Logs in $(BACKEND)/logs/ — Ctrl+C or 'make stop' to stop all."; \
	wait

stop:
	@-pkill -f "spring-boot:run" 2>/dev/null; true
	@-pkill -f "go run cmd/server/main.go" 2>/dev/null; true
	@-kill -9 $$(lsof -t -i:8080-8086) 2>/dev/null; true
	@echo "Services stopped."

logs:
	@tail -f $(BACKEND)/logs/*.log

# ── Backend: Migrations ───────────────────────────────────────────────────────

migrate-user:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	timeout 45s sh -c 'cd $(BACKEND)/user-service && $(MVN_RUN) spring-boot:run \
	  -Dspring-boot.run.arguments="--server.port=0 --spring.main.web-application-type=none"' \
	|| [ $$? -eq 124 ]

migrate-job:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	timeout 45s sh -c 'cd $(BACKEND)/job_service && $(MVN_RUN) spring-boot:run \
	  -Dspring-boot.run.arguments="--server.port=0 --spring.main.web-application-type=none \
	  --app.search.enabled=false --spring.data.elasticsearch.repositories.enabled=false"' \
	|| [ $$? -eq 124 ]

migrate-noti:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	if [ -z "$$PSQL_DSN" ]; then \
	  echo "PSQL_DSN is required in $(BACKEND)/.env"; \
	  exit 1; \
	fi; \
	if command -v migrate >/dev/null 2>&1; then \
	  migrate -source file://$$(pwd)/$(BACKEND)/notification-service/migrations -database "$$PSQL_DSN" up; \
	else \
	  docker run --rm --network host \
	    -v "$$(pwd)/$(BACKEND)/notification-service/migrations:/migrations:ro" \
	    migrate/migrate \
	    -source file:///migrations \
	    -database "$$PSQL_DSN" \
	    up; \
	fi

migrate-noti-version:
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	if [ -z "$$PSQL_DSN" ]; then \
	  echo "PSQL_DSN is required in $(BACKEND)/.env"; \
	  exit 1; \
	fi; \
	if command -v migrate >/dev/null 2>&1; then \
	  migrate -source file://$$(pwd)/$(BACKEND)/notification-service/migrations -database "$$PSQL_DSN" version; \
	else \
	  docker run --rm --network host \
	    -v "$$(pwd)/$(BACKEND)/notification-service/migrations:/migrations:ro" \
	    migrate/migrate \
	    -source file:///migrations \
	    -database "$$PSQL_DSN" \
	    version; \
	fi

migrate-noti-force:
	@if [ -z "$(VERSION)" ]; then \
	  echo "Usage: make migrate-noti-force VERSION=<version>"; \
	  exit 1; \
	fi
	set -a; [ -f $(BACKEND)/.env ] && . $(BACKEND)/.env; set +a; \
	if [ -z "$$PSQL_DSN" ]; then \
	  echo "PSQL_DSN is required in $(BACKEND)/.env"; \
	  exit 1; \
	fi; \
	if command -v migrate >/dev/null 2>&1; then \
	  migrate -source file://$$(pwd)/$(BACKEND)/notification-service/migrations -database "$$PSQL_DSN" force $(VERSION); \
	else \
	  docker run --rm --network host \
	    -v "$$(pwd)/$(BACKEND)/notification-service/migrations:/migrations:ro" \
	    migrate/migrate \
	    -source file:///migrations \
	    -database "$$PSQL_DSN" \
	    force $(VERSION); \
	fi

migrate-all: migrate-user migrate-job migrate-noti

# ── Infrastructure ────────────────────────────────────────────────────────────

compose-up:
	docker compose -f $(BACKEND)/docker-compose.yaml up -d

compose-down:
	docker compose -f $(BACKEND)/docker-compose.yaml down

compose-build:
	docker compose -f $(BACKEND)/docker-compose.yaml build

compose-logs:
	docker compose -f $(BACKEND)/docker-compose.yaml logs -f

compose-restart:
	docker compose -f $(BACKEND)/docker-compose.yaml restart

# ── Frontend ──────────────────────────────────────────────────────────────────

fe-install:
	cd frontend && pnpm install

fe-dev:
	cd frontend && pnpm dev

fe-dev-candidate:
	cd frontend && pnpm -F web-candidate dev

fe-dev-recruiter:
	cd frontend && pnpm -F web-recruiter dev

fe-dev-admin:
	cd frontend && pnpm -F web-admin dev

fe-build:
	cd frontend && pnpm build

fe-lint:
	cd frontend && pnpm lint

fe-generate-api:
	cd frontend && pnpm generate:api

# ── Combined ──────────────────────────────────────────────────────────────────

test: test-backend
	cd frontend && pnpm lint && pnpm build

setup:
	bash $(BACKEND)/scripts/bootstrap.sh
	cd frontend && pnpm install
