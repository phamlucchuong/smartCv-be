# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SmartCV is a job-matching platform backend built as microservices. Java services use Spring Boot 3.x + Maven; the notification service uses Go + Echo v5.

## Common Commands

### Infrastructure (required before running services)
```bash
docker compose up -d          # Start MongoDB, PostgreSQL, Redis, RabbitMQ, Elasticsearch
docker compose down           # Stop infrastructure
make compose-logs             # View infrastructure logs
```

### Running Services
```bash
make run-user                 # User Service (port 8081)
make run-gateway              # API Gateway (port 8080)
make run-job                  # Job Service (port 8082)
make run-noti                 # Notification Service (port 8084)
```

Or directly:
```bash
cd user-service && ./mvnw spring-boot:run
cd api-gateway && ./mvnw spring-boot:run
cd job_service && ./mvnw spring-boot:run
cd notification-service && go run cmd/server/main.go
```

### Building
```bash
# Java services (from service directory)
./mvnw clean install -DskipTests

# Notification service
cd notification-service && go build -v ./cmd/server
```

### Testing
```bash
# Java services (from service directory)
./mvnw test

# Run a single test class
./mvnw test -Dtest=ClassName

# Notification service
cd notification-service && go test ./... -v
```

### First-time Setup
```bash
cp .env.example .env          # Configure environment variables
bash scripts/bootstrap.sh     # Automated setup (checks prereqs, builds, starts Docker)
```

## Architecture

### Service Map

```
Client → API Gateway (8080)
              ├── /user/**      → User Service (8081)
              ├── /job/**       → Job Service (8082)
              └── /notification/** → Notification Service (8084)
```

All inter-service async events flow through **RabbitMQ**.

### Services

| Service | Language | Port | Database | Description |
|---------|----------|------|----------|-------------|
| `api-gateway` | Java/Spring Cloud Gateway | 8080 | Redis (rate limit) | JWT auth filter, routing |
| `user-service` | Java/Spring Boot 3.4.4 | 8081 | MongoDB, Redis | Auth, OTP, user profiles |
| `job_service` | Java/Spring Boot 3.5.14 | 8082 | MongoDB, Elasticsearch | Job CRUD, full-text search |
| `application_service` | Java/Spring Boot 3.4.4 | 8083 | MongoDB | Job application lifecycle, CRUD, role-based access |
| `notification-service` | Go 1.25.6/Echo v5 | 8084 | PostgreSQL, Redis | Email (SMTP), SMS (Twilio), push (Firebase) |

**Planned (not yet implemented):** Application Service (8083), AI Service (8085).

### Key Patterns

- **Authentication:** JWT tokens validated at the API Gateway via `AuthenticationFilter`; downstream services receive the authenticated user via forwarded headers. JWT introspection calls User Service.
- **OTP flow:** User Service publishes OTP events → RabbitMQ → Notification Service delivers via SMS/email; OTP codes stored in Redis with TTL.
- **Job search:** Job Service indexes documents into Elasticsearch on create/update; search queries hit Elasticsearch directly.
- **DB migrations:** User Service uses **Mongock** for MongoDB schema migrations (changesets in `changelog/` package).
- **MongoDB `_id` convention:** every document uses a **String UUID** `_id`, never ObjectId. Services assign `UUID.randomUUID().toString()` before saving (don't let Mongo auto-generate); manual inserts and scripts must set `_id` explicitly (see `scripts/seed_master.mjs`). Rationale: ids cross service boundaries as strings (REST, RabbitMQ, Elasticsearch, JWT).
- **AI provider credentials at rest:** `AiProviderConfig.apiKey`/`oauthToken` (ai_engine_service, collection `ai_provider_configs`) are AES-256-GCM encrypted before being written to Mongo — never stored plaintext. `AiCredentialCipher` (`ai_engine_service/security/`) does encrypt/decrypt using key `APP_ENCRYPTION_KEY` (base64, `openssl rand -base64 32`); format `"v1:" + base64(iv) + ":" + base64(ciphertext‖tag)`. `AiAdminService.upsert()` encrypts on write; `AiModelGatewayFactory` decrypts right before building each provider SDK client (the only place plaintext is needed). `scripts/seed_master.mjs` implements the same AES-256-GCM format in Node so both write paths (admin API and seed script) stay compatible — see `encryptCredential()` there. Values without the `v1:` prefix are treated as legacy plaintext on decrypt (backward-compatible fallback); admin API responses never return raw `apiKey`/`oauthToken`, only `configured`/`oauthConfigured` booleans.
- **DTOs:** MapStruct mappers convert between entities and request/response DTOs. Lombok `@Data`/`@Builder` used throughout.
- **Error handling:** Custom `ErrorCode` enum defines error codes; `AppException` wraps them; global `@ControllerAdvice` returns `ApiResponse<?>` wrapper.

### Package Structure (Java services)
```
features/
  <domain>/
    <Domain>Controller.java
    <Domain>Service.java
    <Domain>Repository.java
entity/
dtos/
  request/
  response/
enums/
exceptions/
config/
```

### Notification Service (Go)
Entry point: `cmd/server/main.go`. Uses Echo v5 router, GORM for PostgreSQL, go-redis, Viper for config. RabbitMQ consumer listens for user/notification events.

## Environment Configuration

Copy `.env.example` to `.env` and fill in:
- MongoDB, PostgreSQL, Redis connection strings
- RabbitMQ credentials
- JWT secret
- SMTP credentials
- Twilio Account SID/Auth Token
- Firebase service account

Services load `.env` via `java-dotenv` (Java) or `Viper` (Go).

## CI/CD

GitHub Actions workflows in `.github/workflows/` trigger on push/PR to the `dev` branch:
- `user-ci.yml` — Maven tests for `user-service/`
- `gateway-ci.yml` — Maven tests for `api-gateway/`
- `noti-ci.yml` — Go build + tests for `notification-service/`

Docker image builds are currently commented out in CI workflows.

## API Documentation

Swagger UI available at `http://localhost:{port}/{context-path}/swagger-ui.html` for Java services (e.g., `http://localhost:8081/user/swagger-ui.html`). Postman collections are in `/postman/`.

## Important

- **`@PreAuthorize` 403 debug**: `hasRole('RECRUITER')` checks for authority `ROLE_RECRUITER` in the SecurityContext. The gateway forwards the JWT `scope` claim as `X-User-Scope`; `InternalAuthFilter` splits it by space into `SimpleGrantedAuthority` objects. If `X-User-Scope` is blank (empty `roles` in user's MongoDB document, or Mongock migration didn't run), every protected endpoint returns 403. Check `[Auth] scope=` log in job_service to diagnose.


## Plan

- Always write plan content in English.
- File naming pattern (required): `YYYYMMDD-HHmm-<short-scope>.md`
  - Example: `20260523-2112-user-service-completion.md`
  - Use lowercase, hyphen-separated words, and keep the scope concise (3-7 words).
- Place new plan files under `plans/`.
- Include: scope, current assessment, phased steps, and a short execution order summary.