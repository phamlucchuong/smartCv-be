# [Feature/Fix] Job suggestions after CV analysis — make the existing E2E flow actually work

## Overview

Requirement: after a candidate analyzes a CV, the system should generate job suggestions,
save them to the DB, and show them on the candidate web's job-suggestions page.

Investigation result: **this feature is already fully implemented in code at every layer**,
but it has **never once worked end-to-end in this environment** — hard evidence: the
`smartcv_user.candidates` collection has **43 candidates and 0 documents with a non-empty
`job_suggestions` array**. The issue is therefore not "build the feature" but "find where
the implemented chain breaks at runtime, fix it, and verify E2E".

### The implemented chain (all code exists and compiles)

1. **Trigger** — `AnalysisService.analyzeCv()` (ai_engine_service) fires
   `recommend(new JobRecommendRequest(null, cvUrl, 3), candidateId, false)` via
   `CompletableFuture.runAsync` after every full CV analysis (`AnalysisService.java:439-445`).
2. **Generate** — `recommend()` fetches active jobs (`jobClient.getActiveJobs(0, recommendBatchSize)`,
   batch default 20), calls the LLM to score/rank, and publishes
   `JobSuggestionsMessage(userId, [{jobId, matchScore, matchReason, alignedSkills}])` to
   RabbitMQ (`AnalysisService.java:138-174`, `JobSuggestionsPublisher.java`).
   ⚠️ **This step is broken at its first line** — see root cause 1: the URL
   `getActiveJobs` calls does not exist on job_service, so the LLM/publish part of this
   step has never been reached.
3. **Persist** — user-service `JobSuggestionsConsumer` (`@RabbitListener` on
   `job.suggestions.queue`) → `CandidateService.updateJobSuggestions()` → embedded
   `job_suggestions` list + `suggestions_updated_at` on the `Candidate` document
   (`Candidate.java:90-96`, `CandidateService.java:506-512`).
4. **API** — `GET /api/candidates/job-suggestions` (ROLE_CANDIDATE) enriches each stored
   `jobId` via `jobClient.getJobsByIds()` into full `EnrichedJobSuggestion` (job title,
   company, salary, skills) (`CandidateController.java:204-210`, `CandidateService.java:486-504`).
5. **Frontend** — `/_account/job-suggestions` page already uses the real generated hook
   `useGetJobSuggestions`, with search + skill filter chips and job cards
   (`frontend/apps/web-candidate/src/routes/_account/job-suggestions.tsx`); a sidebar nav
   link exists in `CandidateDashboardLayout.tsx`.

RabbitMQ names match on both sides: exchange `job.suggestions.exchange`, routing key
`job.suggestions`, queue `job.suggestions.queue`.

## Reproduction steps

1. Start infrastructure + user-service + job_service + api-gateway + ai_engine_service and
   the candidate web app; ensure an AI provider is configured and active (see prerequisite
   note in Notes — until 2026-07-04 morning the active Azure config was broken, which
   masked everything downstream).
2. Log in as a candidate, upload a CV, run a full CV analysis (with or without a jobId) and
   wait for it to complete.
3. Open `/job-suggestions` in web-candidate, and/or inspect
   `db.candidates.find({job_suggestions: {$ne: []}})` in `smartcv_user`.

## Expected behavior

- Within a short time after the analysis completes (the recommend step runs async and makes
  one extra LLM call), the candidate's `job_suggestions` array is populated in MongoDB with
  jobId + matchScore + matchReason + alignedSkills per suggested job.
- `/job-suggestions` shows those jobs as cards with real title/company/salary/skills
  (enriched server-side), newest suggestions replacing the previous set.
- Failures anywhere in the chain are visible (log at error level with cause; ideally a
  metric/log line per stage), not silently swallowed.

## Current behavior

- No candidate has ever received a suggestion: `candidates` count = 43, with non-empty
  `job_suggestions` = 0 (checked 2026-07-04).
- `/job-suggestions` renders its empty state for every user.
- No error surfaces to the user or operator. Concretely: the async trigger failure is a
  single `log.warn` with message text only (`AnalysisService.java:443`); the publisher and
  consumer catches do use `log.error` but log only `e.getMessage()` — **no stack trace, no
  stage identifier** (`JobSuggestionsPublisher.java:26`, `JobSuggestionsConsumer.java:23`).
  Additionally, a message-conversion failure would never reach the consumer's catch block at
  all, and `job.suggestions.queue` has no DLQ (unlike `payment.completed.queue`, which does).

## Root causes

1. **[CONFIRMED — runtime-verified] `getActiveJobs` calls a URL that does not exist on
   job_service; every `recommend()` invocation fails at its first line, regardless of AI
   provider.** `JobClient.getActiveJobs()` (`ai_engine_service/.../integration/job/JobClient.java:59-82`)
   requests `{base}/api/jobs/active?page=&size=`. `JobController` has **no** `/active`
   mapping — the bare `@GetMapping` on `/api/jobs` (JobController.java:36) is the job list,
   and `@GetMapping("/{id}")` (JobController.java:77) greedily matches `/api/jobs/active` as
   `getJobById(id="active")` → `JOB_NOT_FOUND` → HTTP 400 → client-side
   `RestClientException` → rethrown as `AppException(JOB_SERVICE_UNAVAILABLE)` → propagates
   uncaught out of `recommend()` to the async catch (`AnalysisService.java:442-443`), which
   swallows it as one warn line. **Runtime evidence (2026-07-04):** replaying JobClient's
   exact request (same `X-Gateway-Secret`/`X-User-Id` headers) against the running
   job_service returns `HTTP 400 {"ok":false,"code":2001,"message":"Job not found"}`, while
   bare `GET /api/jobs?page=0&size=1` returns jobs normally. This alone guarantees the
   0-of-43 outcome. **Recommended fix: change `JobClient`'s URL to the bare list endpoint
   (`/api/jobs?page=&size=`)** — verified: that endpoint is backed by
   `JobService.getActiveJobs()` (`JobService.java:84-93`), which already filters
   `PUBLISHED + ACTIVE + not-deleted`, so no additional filter work is needed and
   job_service stays code-untouched. Alternative (only if a dedicated route is preferred):
   add a real `/api/jobs/active` mapping in job_service delegating to the same service
   method.
2. **Silent async LLM failure at the trigger (masking cause + required hardening).** Even
   with cause 1 fixed, the recommend step needs a second LLM call; any provider error kills
   it with a single `log.warn(...)` carrying only the message text — no stack trace
   (`AnalysisService.java:439-445`). The active Azure config's wrong `deploymentName`
   (`DeploymentNotFound` on every call, fixed 2026-07-04) would have masked cause 1 anyway
   during the Azure-active period. This silent-failure pattern is why the broken URL went
   unnoticed — fixing the observability here is required, not optional.
3. **Empty/insufficient active jobs (data-side; verify after fixing cause 1).** `recommend()`
   ranks only the first `recommendBatchSize` (20) active jobs. Error handling nuance in
   `JobClient.getActiveJobs` (`JobClient.java:59-82`): `RestClientException` (outage/non-2xx)
   is **logged at error and rethrown** as `JOB_SERVICE_UNAVAILABLE`; only the generic
   `catch (Exception)` (e.g. unexpected payload shape) silently returns an empty list. An
   empty/stale ES index (has happened before in this repo) can also yield zero jobs with no
   error. Verify active job count in the test environment after cause 1 is fixed.
4. **Message conversion (demoted — verify only with runtime log evidence).** The producer
   and consumer declare different FQCNs for `JobSuggestionsMessage`, and the producer stamps
   its own class name into the `__TypeId__` header. However, decompiling the actual resolved
   `spring-amqp` jar (3.2.x) shows the default `Jackson2JsonMessageConverter` type
   precedence is `INFERRED`: because `JobSuggestionsConsumer.consume(JobSuggestionsMessage)`
   has a concrete parameter type, Spring deserializes into the **listener's own** class and
   never consults the sender's `__TypeId__`. So this mismatch is almost certainly benign as
   configured — do NOT "fix" it by setting `TypePrecedence.INFERRED` (that is already the
   default, a no-op). Only treat this as a cause if user-service logs actually show
   `ClassNotFoundException`/`MessageConversionException` for `job.suggestions.queue`.

### Committed hardening (not causes of the 0/43 symptom)

- **DLQ + rethrow for the suggestions queue.** `job.suggestions.queue` has no DLQ and the
  consumer swallows processing errors, while the analogous `payment.completed.queue` has a
  DLQ and its consumer rethrows to NACK — align the suggestions queue with that stronger
  pattern.
- **Enrichment dropping jobs.** `EnrichedJobSuggestion.job` is null when a suggested job was
  deleted/closed since suggestion time (`jobMap.get` miss); the frontend then renders an
  empty card. This presupposes non-empty suggestions, so it cannot cause the 0/43 symptom —
  it is a secondary defect that will surface once causes 1–3 are fixed. Fix **server-side**:
  filter suggestions whose job no longer resolves out of the `GET /job-suggestions` response
  (`CandidateService.getEnrichedJobSuggestions`).

## Acceptance criteria

- [ ] The `getActiveJobs` URL mismatch (cause 1) is fixed — `recommend()` receives a
      non-empty list of genuinely active jobs from job_service — with a test pinning the
      contract (either a job_service test for the new `/active` endpoint, or a `JobClient`
      test against the corrected URL, whichever fix is chosen).
- [ ] Causes 2–4 confirmed/refuted with runtime evidence (logs from a real analysis run),
      documented in the PR.
- [ ] After a candidate completes a CV analysis in a locally-running stack, their
      `job_suggestions` in MongoDB is populated without manual intervention.
- [ ] `/job-suggestions` displays those suggestions with real job data; suggestions for
      deleted/closed jobs are not shown as empty cards (server-side filter).
- [ ] A failed recommend/publish/consume step produces an error-level log that includes the
      **full stack trace** and identifies the failing stage (today: trigger warns without
      stack, publisher/consumer error with message text only).
- [ ] `job.suggestions.queue` gets a DLQ + consumer rethrow-on-failure, matching the
      existing `payment.completed.queue` pattern (so poison/failed messages become visible
      instead of being acked-and-forgotten).
- [ ] Converter regression test (unit-level, matching user-service's Mockito-only test
      conventions — no `@SpringBootTest`/Testcontainers): instantiate the
      `Jackson2JsonMessageConverter` bean as configured in `RabbitMQConfig`, build an AMQP
      `Message` whose JSON body is a suggestions payload and whose `__TypeId__` header is a
      **foreign, non-resolvable FQCN** (e.g. the producer's
      `vn.chuongpl.ai_engine_service.integration.user.JobSuggestionsMessage`), set
      `MessageProperties.setInferredArgumentType(JobSuggestionsMessage.class)` (mirroring
      what `@RabbitListener` does), call `converter.fromMessage(...)`, and assert the result
      is user-service's own `JobSuggestionsMessage` with fields intact (locks in the
      INFERRED-precedence behavior cause 4 relies on; calling `consumer.consume()` directly
      would bypass the converter and prove nothing).
- [ ] Existing unit tests for `AnalysisService` recommend/publish behavior still pass.

## Impact scope

Backend:
- [ ] api-gateway
- [x] user-service
- [x] job_service (cause 1 fix lands here **if** the "add `/api/jobs/active` endpoint" option is chosen; otherwise the fix is a JobClient URL change in ai_engine_service and job_service stays code-untouched — plus data/index verification per cause 3)
- [ ] application_service
- [x] ai_engine_service
- [x] Infrastructure (Docker / RabbitMQ / MongoDB / Elasticsearch)

Frontend:
- [x] web-candidate (E2E verification surface only — the page is already fully wired to the real API; **no code change expected**)
- [ ] web-recruiter
- [ ] web-admin
- [ ] packages/ui
- [ ] packages/api (only if endpoint response shape changes → regenerate)
- [ ] packages/i18n

## Related code

- `backend/ai_engine_service/.../features/analysis/AnalysisService.java:138-174, 439-445` — recommend + async trigger
- `backend/ai_engine_service/.../integration/job/JobClient.java:59-82` — **broken `/api/jobs/active` call (cause 1)** + two-tier catch behavior
- `backend/job_service/.../features/job/JobController.java:36` (bare list GET), `:77` (greedy `/{id}` that swallows `/active`)
- `backend/ai_engine_service/.../integration/user/JobSuggestionsPublisher.java`, `JobSuggestionsMessage.java`
- `backend/ai_engine_service/.../config/RabbitMQConfig.java:51-62` — exchange/key + converter
- `backend/user-service/.../integration/ai/JobSuggestionsConsumer.java`, `JobSuggestionsMessage.java`
- `backend/user-service/.../configuration/RabbitMQConfig.java:51-53` (name constants), `:73-84` (queue/exchange/binding beans), `:222-225` (converter); DLQ reference pattern at `:199-205` (`payment.completed.queue`)
- `backend/user-service/.../features/candidate/Candidate.java:90-96` — embedded storage
- `backend/user-service/.../features/candidate/CandidateService.java:486-512` — enrich + update
- `backend/user-service/.../features/candidate/CandidateController.java:204-210` — GET endpoint
- `frontend/apps/web-candidate/src/routes/_account/job-suggestions.tsx` — page (real hook already wired)
- `frontend/packages/api/src/generated/user/candidate-controller/candidate-controller.ts` — `useGetJobSuggestions`

## Notes

- **Assumptions taken while filing (user was away; revise if wrong):**
  - Keep the existing route name `/job-suggestions` (request said `/job-suggests`; the page,
    nav link, and i18n keys already exist under the current name — renaming is out of scope).
  - Scope is "make the existing implemented flow work and verifiable E2E", not a rebuild.
- Prerequisite fixed separately on 2026-07-04: active Azure OpenAI config had a wrong
  `deploymentName` (DeploymentNotFound on every LLM call) — any E2E verification before that
  fix would have failed at the trigger stage regardless of the leads above.
- Related past issue for ES/job data drift: see memory/README note "empty search results =
  stale jobs index" — relevant to cause 3.
- Suggested storage semantics (already implemented): each new analysis **replaces** the
  previous suggestion set (`setJobSuggestions`), it does not append. Keep unless product
  wants history.
- `PaymentEventConsumer` shares the same cross-service FQCN-mismatch pattern as cause 4; per
  the same INFERRED-precedence reasoning it should also work as configured. If investigation
  unexpectedly finds it broken at runtime, **file a separate issue** — fixing it is out of
  scope here.
- Out of scope (noted, not required): the page's filter chips are hardcoded
  (React/TypeScript/Next.js/Node.js) instead of derived from the suggestions' actual skills
  (`job-suggestions.tsx:44-50`). Pure UI polish, unrelated to the empty-suggestions bug —
  file separately if wanted.
