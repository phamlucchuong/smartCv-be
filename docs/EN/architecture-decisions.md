# Architecture Decisions

## 2026/06/18: Two-axis job state machine (moderationStatus × visibilityStatus)

- **Background**: The original job entity had a single `status` field (`DRAFT | ACTIVE | CLOSED | EXPIRED`). This conflated two independent concerns: whether a job has passed admin moderation, and whether it is currently visible to candidates. Recruiters needed to be able to temporarily hide a published job without un-publishing it.

- **Rejected options**:
  - Flat enum with all state combinations (e.g. `DRAFT_INACTIVE`, `PENDING_INACTIVE`, `PUBLISHED_ACTIVE`, …): combinatorial explosion, hard to add new transitions without touching every consumer.
  - Single `moderationStatus` only: cannot represent a recruiter-paused published job without re-entering the moderation queue.

- **Decision**: Replace `status` with two independent enums:
  - `moderationStatus`: `DRAFT | PENDING | PUBLISHED` — controls admin review lifecycle.
  - `visibilityStatus`: `INACTIVE | ACTIVE | EXPIRED` — controls candidate-facing visibility.
  - Candidate/public APIs filter on `moderationStatus = PUBLISHED AND visibilityStatus = ACTIVE`.
  - Admin rejection returns the job to `DRAFT` (no separate `REJECTED` state) with a `moderationNote`. Resubmit clears the note.

- **Impact**: `job_service` Job entity, JobService state transitions, JobController endpoints, Elasticsearch indexing (ES index only on `PUBLISHED + ACTIVE`), and all frontend job list/edit/admin views updated. Existing `status` field removed from the entity.

---

## 2026/06/18: Hand-written hooks for new PATCH endpoints in packages/api

- **Background**: Orval generates React Query hooks from the OpenAPI spec. New transition endpoints (`/submit`, `/withdraw`, `/approve`, `/reject`, etc.) were added to `job_service` but the swagger was not regenerated, so Orval didn't know about them.

- **Rejected options**:
  - Regenerate swagger and run `pnpm generate:api` every time a backend endpoint is added: requires the backend to be running locally during frontend development.
  - Inline the API calls in each component: duplicates HTTP logic and loses the TanStack Query caching/invalidation benefit.

- **Decision**: Hand-write hooks in `packages/api/src/job-moderation-hooks.ts` using the same `customInstance` as Orval-generated code. A `createIdMutationHook` factory reduces boilerplate for the common `PATCH /{id}` pattern. Export from `packages/api/src/index.ts`.

- **Impact**: Pattern is established for future endpoints that can't wait for a swagger regeneration cycle. Generated files remain authoritative for documented endpoints; `*-hooks.ts` files are the extension point.

---

## 2026/06/20: Cross-service hot-jobs ranking via synchronous call (MVP)

- **Background**: The web-candidate homepage needs to display "hottest" jobs ranked by application count. Application counts live in `application_service`; job details live in `job_service`. Two approaches were considered: (1) synchronous cross-service call at render time, and (2) event-driven counter maintained on the Job document via RabbitMQ.

- **Rejected options**:
  - **Event-driven counter** (`applicationCreated` event → job_service increments `applicationCount` on the Job document): cleaner long-term, but the required RabbitMQ exchange/queue bindings did not exist in either service at the time. Adding exchange configuration, consumer, and retry logic would have doubled the scope.

- **Decision**: `job_service` calls `GET /application/api/applications/top-jobs?limit=N` on `application_service` via a new `ApplicationServiceClient` using the existing `X-Gateway-Secret` internal header. `HomeService.getHotJobs()` is cached with `@Cacheable("home:hot-jobs")`. If the call fails or returns no IDs, it falls back to recent jobs sorted by `createdAt`. The fallback query is inlined (not delegated to `getFeaturedJobs()`) to avoid Spring's `@Cacheable` self-invocation bypass.

- **Impact**: `application_service` gains a `/top-jobs` aggregation endpoint. `job_service` gains `ApplicationServiceClient`. Homepage renders applicant-ranked jobs. Cache TTL controls staleness. A future event-driven upgrade can replace the client call without changing the `getHotJobs()` API contract.

---

## 2026/06/20: Company ID disambiguation for Top Companies navigation

- **Background**: `job_service` aggregates top companies from the `jobs` collection and returns `recruiterId` (the user-service account UUID). The company detail page (`/companies/$companyId`) calls `GET /api/companies/{id}` which looks up by MongoDB document `_id` — a different UUID. Passing `recruiterId` as the route param caused a 404 / fallback to company list.

- **Rejected options**:
  - Store MongoDB `_id` of the Recruiter document inside the Job document: requires data duplication and synchronization.
  - Change `CompanyController.getById` to accept either type of ID: overloaded ID semantics are error-prone.

- **Decision**: `user-service` gains `GET /api/companies/by-recruiter/{userId}` which resolves a user UUID to the company profile. `job_service`'s `HomeService.getTopCompanies()` calls `UserServiceClient.getCompanyId(recruiterId)` after the aggregation and populates a new `companyId` field on `TopCompanyResponse`. Frontend uses `company.companyId` for the route param.

- **Impact**: Top Companies "View Profile" now navigates to the correct company profile page. `TopCompanyResponse` carries both `recruiterId` and `companyId` to keep the distinction explicit.
