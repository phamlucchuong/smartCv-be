# Assessment: Candidate Take-Flow, Recruiter Publish & Attempt Dashboard

## Overview

Multiple gaps in the assessment feature need to be closed before it is production-ready:

1. **"Take test" button on the job-detail page navigates to the generic `/assessments` tab instead of launching the assessment immediately.** The candidate lands on their assessment list but never auto-enters the test they clicked.
2. **`EXPIRED` status exists in `AttemptStatus` but is never set.** When the frontend timer reaches zero it calls `submitAttempt`, but there is no server-side timeout enforcement. A timed-out attempt must be forcefully submitted with a distinct `OVERTIME` result so recruiters can distinguish it from a voluntary submit.
3. **No in-app notification is fired when a candidate completes an attempt.** The notification service's `CreateNotification` path is already used for application-status events; assessment completion is not wired.
4. **Recruiters have no way to view attempts / candidate scores for their assessments.** There is no backend endpoint to list attempts by assessment, no frontend table, and no score column.
5. **Assessments are always created with status `DRAFT` and never formally published.** The `AssessmentStatus` enum only has `DRAFT` and `ACTIVE`. `assignToCandidate` silently promotes `DRAFT → ACTIVE` as a side effect. A recruiter needs an explicit Publish action so they control when a test is visible to candidates.
6. **Publish decision analysis**: should recruiter self-publish, or does an admin approve?

---

## Reproduction Steps

### Bug 1 – "Take test" navigates to wrong page
1. Log in as a candidate.
2. Open any job-detail page that has an associated assessment (via `GET /api/assessments/job/{jobId}`).
3. Click **"Làm bài test"**.
4. **Actual**: browser navigates to `/assessments` (the generic list) with no test loaded.
5. **Expected**: browser opens the assessment take-UI immediately for that specific assessment.

### Bug 2 – Timer expiry does not set OVERTIME
1. Start an assessment with a 1-minute time limit.
2. Let the timer reach zero without answering.
3. **Actual**: `submitAttempt` is called; attempt is stored with `status=SUBMITTED`, `result` is graded normally.
4. **Expected**: attempt is stored with `status=SUBMITTED` (or a new `EXPIRED`) and `result=OVERTIME`.

---

## Expected Behavior

| Feature | Expected |
|---|---|
| "Take test" on job-detail | Navigates to `/assessments?assessmentId={id}&autoStart=true` (or a dedicated route) and auto-opens the take-UI for that assessment |
| Timer expiry | Backend stores `result = OVERTIME` (new enum value) when attempt is force-submitted; frontend timer expiry path passes a `?overtimeFlag` or calls a separate endpoint |
| Save progress button | Already implemented via `POST /api/attempts/{attemptId}/answers`; frontend should show a persistent "Lưu bài" button that calls this endpoint on demand in addition to auto-save |
| Candidate notification on submit | In-app push notification fires to the candidate when their attempt is submitted (both voluntary and forced) |
| Recruiter notification on submit | In-app push notification fires to the recruiter who owns the assessment when any candidate submits |
| Recruiter attempt dashboard | `GET /api/assessments/{id}/attempts` returns all attempts for one assessment; recruiter sees candidate ID, score, result, submitted-at |
| Publish button | Explicit `PATCH /api/assessments/{id}/publish` endpoint; changes `DRAFT → ACTIVE`; replaces the silent side-effect inside `assignToCandidate` |
| Assessment visibility rule | Only `ACTIVE` assessments are returned to candidates via `getAssessmentsByJob` (already partially true, see below) |

---

## Current Behavior

| Area | State |
|---|---|
| `jobs/$jobId.tsx` line 533 | `<Link to="/assessments">` — discards assessment context |
| `AttemptResult` enum | `PASS`, `FAIL`, `PENDING` — no `OVERTIME` |
| `AttemptStatus` enum | `IN_PROGRESS`, `SUBMITTED`, `EXPIRED` — `EXPIRED` never set by backend |
| `AssessmentService.submitAttempt` | Grades MCQ, sets `PASS`/`FAIL`/`PENDING`, no overtime path |
| `AssessmentService.assignToCandidate` | Auto-promotes `DRAFT → ACTIVE` as side effect (no explicit publish) |
| `AssessmentStatus` enum | `DRAFT`, `ACTIVE` — no `PUBLISHED` or explicit state machine |
| `NotificationPublisher` | Only handles application events; zero assessment events |
| `AssessmentAttemptRepository` | Only `findByCandidateId`, `findByCandidateIdAndAssessmentIdAndStatus` — no `findByAssessmentId` |
| Recruiter UI | Shows DRAFT/ACTIVE badge; no attempt list, no score table |
| Candidate UI `_account.assessments.tsx` | Lists attempts correctly; no previous-submission history when clicking a card |

---

## Impact Scope

Backend:
- [ ] api-gateway — no change
- [ ] user-service — no change
- [x] application_service — new endpoints, new enum values, notification publishing, repository query
- [ ] ai_engine_service — no change
- [x] notification-service — new RabbitMQ consumer + `CreateNotification` calls for assessment events
- [ ] Infrastructure (Docker / RabbitMQ / MongoDB) — new RabbitMQ queue/exchange for assessment events

Frontend:
- [x] web-candidate — `jobs/$jobId.tsx` navigation fix; `_account.assessments.tsx` history drawer; overtimeFlag on timer expiry
- [x] web-recruiter — `employer.assessments.tsx` publish button; attempt dashboard table
- [ ] web-admin — no change in this scope (see analysis below)
- [ ] packages/ui
- [x] packages/api — regenerate after new endpoints; or add hand-written hooks

---

## Detailed Scope by Feature

### F0 — Pre-work: Show DRAFT assessments to recruiter (application_service)

`AssessmentService.getAssessmentsByRecruiter` (line 249–260) filters `status == ACTIVE`:
```java
return assessmentRepository.findByRecruiterId(recruiterId).stream()
        .filter(a -> a.getStatus() == AssessmentStatus.ACTIVE)  // ← drops DRAFT
        ...
```
This endpoint is the one called by candidate-facing URLs; the recruiter dashboard uses `getRecruiterAssessments` which already returns all statuses. No change needed.

However, `getRecruiterAssessments` does NOT strip `correctOptionIndex` from questions — that is a security gap. Recruiters see the correct answers when fetching their own assessments. This is acceptable (they authored the questions), but confirm with the team.

No code change required for F0 — the correct method (`getRecruiterAssessments`) is already used by the recruiter dashboard. Document the two methods clearly:

| Method | Caller | Filters |
|---|---|---|
| `getRecruiterAssessments(userId)` | Recruiter dashboard | None (all statuses) |
| `getAssessmentsByRecruiter(recruiterId)` | `GET /api/assessments/recruiter/{recruiterId}` (public) | ACTIVE only |

---

### F1 — Fix "Làm bài test" navigation (web-candidate, `jobs/$jobId.tsx`)

**Current code** (line 533):
```tsx
<Link to="/assessments" className="shrink-0">
  <Button size="sm">Làm bài test</Button>
</Link>
```
**Fix**: Pass the `assessmentId` so the candidate's assessment list can auto-open the take-UI:
```tsx
<Link to="/assessments" search={{ assessmentId: assessment.id }} className="shrink-0">
```
In `_account.assessments.tsx`:
1. Add `validateSearch: z.object({ assessmentId: z.string().optional() })` to the route definition (TanStack Router requires a declared schema before `Route.useSearch()` works).
2. Read `const { assessmentId } = Route.useSearch()` and if present, call `startAttempt`/`getAttemptState` and open `TakeAssessment` immediately on mount.

Also applies to `companies/$companyId.tsx` — the same Link is inside the `AssessmentPreviewCard` component (~line 421). That component receives `assessment` as a prop, so pass `assessment.id` as a search param.

---

### F2 — OVERTIME result on timer expiry

**Backend** (`application_service`):
- Add `OVERTIME` to `AttemptResult` enum.
- Extend `AssessmentService.submitAttempt` to accept `boolean overtime`; if `true`, skip MCQ scoring and set `result = OVERTIME`. Update all callers and the corresponding test (`submitAttempt_shouldGradeMcqQuestionsAndSetPassResult` and related tests in `AssessmentServiceTest.java`) to pass `false` for normal submission.
- `AttemptStatus.EXPIRED` already exists in the enum but is never set. Do not remove it (breaks serialisation of any future data). Keep as-is; it remains a dead value.

**Frontend** (`_account.assessments.tsx`, `TakeAssessmentContent`):
- Timer expiry is at line 364: `if (timeLeft <= 0) { handleSubmitRef.current(); return }`. Extend `handleSubmitRef` to carry an `overtime` flag.
- `useSubmitAttempt` currently has no request body. Add a hand-written mutation in `packages/api/src/assessment-manual-hooks.ts` (the file already exists — add to it, don't create a new file) for the extended endpoint, or extend `useSubmitAttempt` options.

---

### F3 — In-app notifications on attempt submission

**application_service** — New RabbitMQ event:
1. Add `ASSESSMENT_EXCHANGE = "assessment.exchange"` (type: `"direct"`) and `ASSESSMENT_SUBMITTED_QUEUE = "assessment.submitted.queue"` to `RabbitMQConfig`; declare queue and binding using the same `Queue`/`Binding` bean pattern as existing application events.
2. Create `AssessmentEventMessage` with fields: `attemptId`, `assessmentId`, `candidateId`, `candidateUserId`, `recruiterId`, `recruiterUserId`, `assessmentTitle`, `score`, `result`, `overtime`, `occurredAt`.
   - **Pre-resolve `recruiterUserId` in `application_service` before publishing**: call `userClient.resolveUserIdFromRecruiterId(recruiterId)` inside `AssessmentService.submitAttempt` and embed it in the message. The notification-service is Go with no HTTP client to user-service — it must receive `recruiterUserId` directly in the event payload.
3. Create a dedicated `AssessmentNotificationPublisher` bean (following the pattern of existing `NotificationPublisher`) — do not reuse `NotificationPublisher` because it is coupled to `application.exchange`.
4. Inject `AssessmentNotificationPublisher` into `AssessmentService`; call it at the end of `submitAttempt`.

**notification-service** (Go) — New consumer + handler:
1. `consumer.go`: add `ListenAssessmentEvents()` — binds to `assessment.submitted.queue` on `assessment.exchange` (type `"direct"`). Follow the `ListenApplicationEvents` pattern.
2. `service.go`: add `HandleAssessmentSubmitted(ctx context.Context, msg AssessmentEventMessage)`:
   - Candidate: `s.CreateNotification(ctx, msg.CandidateUserID, "USER", "Bài kiểm tra đã được nộp", ..., "ASSESSMENT_SUBMITTED", data)` with FCM push.
   - Recruiter: `s.CreateNotification(ctx, msg.RecruiterUserID, "RECRUITER", "Ứng viên đã nộp bài kiểm tra", ..., "ASSESSMENT_SUBMITTED", data)` with FCM push.
   - `CreateNotification` actual signature: `(ctx context.Context, receiverID, receiverType, title, body, notifType string, data datatypes.JSON) error` — there is no `IsRead` parameter (hardcoded `false`).
3. `server.go:Start()`: add `go func() { s.consumer.ListenAssessmentEvents() }()` block alongside existing consumer goroutines.

**Frontend notification data** (so the click navigates correctly):
```json
{
  "type": "ASSESSMENT_SUBMITTED",
  "layout": "/employer/assessments",
  "layout_candidate": "/assessments",
  "assessmentId": "...",
  "attemptId": "..."
}
```

---

### F4 — Recruiter attempt dashboard

**Backend** (`application_service`):
- `AssessmentAttemptRepository`: add `List<AssessmentAttempt> findByAssessmentId(String assessmentId)`.
- `AssessmentController`: add `GET /api/assessments/{id}/attempts` (`@PreAuthorize("hasRole('RECRUITER')")`).
- `AssessmentService.getAttemptsByAssessment(assessmentId, userId)`: verify recruiter owns assessment, return list of `AttemptStateResponse` extended with `score` and `result`.
- **Response DTO**: extend `AttemptStateResponse` to include `score: Double` and `result: AttemptResult`, or create a new `AttemptSummaryResponse`.

**Frontend** (`employer.assessments.tsx`):
- Add `useGetAttemptsByAssessment` and `usePublishAssessment` to the existing file `packages/api/src/assessment-manual-hooks.ts` (do not create a new file).
- In the recruiter assessment card, add a "Xem kết quả" button that opens a modal/panel listing candidates.
- Columns: Candidate ID (first 8 chars), Score, Result (PASS / FAIL / PENDING / OVERTIME), Submitted At.

---

### F5 — Recruiter Publish button

**Backend** (`application_service`):
- Add `PATCH /api/assessments/{id}/publish` (`@PreAuthorize("hasRole('RECRUITER')")`).
- `AssessmentService.publishAssessment(id, userId)`: verify ownership; if status is `DRAFT`, set `ACTIVE`; if already `ACTIVE`, no-op (idempotent). Throw `ASSESSMENT_NOT_FOUND` if not found; `UNAUTHORIZED` if wrong recruiter.
- Remove the silent `DRAFT → ACTIVE` promotion from `assignToCandidate` — that side-effect hides state transitions.

**Frontend** (`employer.assessments.tsx`):
- Show **"Công bố"** button only when `a.status === "DRAFT"`.
- On click, call `PATCH /api/assessments/{id}/publish`; invalidate `getGetRecruiterAssessmentsQueryKey()`.
- Show **"Đang hoạt động"** badge when `a.status === "ACTIVE"` (already done) — no change needed.

---

## Design Decision: Should Recruiter Self-Publish or Admin Approve?

### Analysis

| Criterion | Recruiter Self-Publish | Admin Approve |
|---|---|---|
| Speed | Instant; recruiter can assign immediately | Delay; admin workload scales with number of assessments |
| Quality control | Recruiter is accountable; bad assessments harm their own hiring | Admin catches malicious/biased questions (e.g. discriminatory questions) |
| Scope | Assessments are internal to a recruiter's job postings; candidates are already pre-screened by application | Public-facing or cross-company assessments need oversight |
| Precedent in this codebase | Jobs require admin moderation (`DRAFT → PENDING → PUBLISHED`) because they are public | Assessments are private: only assigned candidates can see them |
| Complexity | One endpoint, done | Requires admin queue UI, new status (`PENDING_APPROVAL`), notification to admin |

### Recommendation

**Recruiter self-publish** (no admin approval) for now, with the following rationale:
- Assessments are not public. They are only visible to candidates explicitly assigned by the recruiter via `assignToCandidate`. The risk of harmful content reaching unintended users is minimal.
- The existing admin pipeline (`JOB_MODERATION`) was designed for publicly visible listings. Reusing that pipeline for private assessments adds friction without proportionate benefit.
- If admin oversight is needed in the future, adding a `PENDING` state is a non-breaking additive change.

**If admin approval is preferred** (counter-argument): add `AssessmentStatus.PENDING_APPROVAL` between `DRAFT` and `ACTIVE`; recruiter clicks Publish → sets `PENDING_APPROVAL`; admin sees a moderation queue and approves/rejects. Implement the same moderation event flow already in place for jobs. This adds ~1 sprint of work.

**Decision to confirm with the team before implementation.**

---

## Related Code

| File | Relevance |
|---|---|
| `backend/application_service/src/.../AssessmentController.java` | All assessment/attempt endpoints |
| `backend/application_service/src/.../AssessmentService.java` | Business logic; `submitAttempt`, `assignToCandidate` |
| `backend/application_service/src/.../AssessmentStatus.java` | `DRAFT`, `ACTIVE` |
| `backend/application_service/src/.../AttemptStatus.java` | `IN_PROGRESS`, `SUBMITTED`, `EXPIRED` (unused) |
| `backend/application_service/src/.../AttemptResult.java` | `PASS`, `FAIL`, `PENDING` — add `OVERTIME` |
| `backend/application_service/src/.../AssessmentAttemptRepository.java` | Missing `findByAssessmentId` |
| `backend/application_service/src/.../NotificationPublisher.java` | Application events only; no assessment events |
| `backend/application_service/src/.../RabbitMQConfig.java` | No assessment exchange/queues |
| `backend/notification-service/internal/notification/service.go` | `CreateNotification`, `HandleRecruiterApproved` pattern to follow |
| `backend/notification-service/internal/notification/consumer.go` | `ListenApplicationEvents` pattern to follow |
| `frontend/apps/web-candidate/src/routes/jobs/$jobId.tsx` line 533 | `<Link to="/assessments">` — missing `assessmentId` param |
| `frontend/apps/web-candidate/src/routes/companies/$companyId.tsx` line 421 | Same issue |
| `frontend/apps/web-candidate/src/routes/_account.assessments.tsx` | Full take-UI; needs `useSearch()` handling + overtime path |
| `frontend/apps/web-recruiter/src/routes/employer.assessments.tsx` | Lines 449/454 status badge; needs Publish button + attempt modal |
| `frontend/packages/api/src/generated/application/assessment-controller/assessment-controller.ts` | Regenerate after new endpoints |

---

## Notes

- `getAssessmentsByJob` in `AssessmentService` already filters by `status == ACTIVE`, so unpublished (DRAFT) assessments are invisible to candidates. The Publish button makes this explicit.
- `assignToCandidate` currently auto-promotes DRAFT → ACTIVE as a side effect. After F5 this promotion is removed; recruiter must publish before assigning.
- `application_service/integration/user/UserClient.java` exposes `resolveUserIdFromRecruiterId(recruiterId)`. Call it in `AssessmentService.submitAttempt` and embed `recruiterUserId` in `AssessmentEventMessage`. The notification-service (Go) has no HTTP client and must not add one.
- Frontend i18n keys needed (follow existing `_desc` suffix convention for message strings): `assessment_overtime_desc`, `assessment_publish_confirm_desc`, `assessment_attempts_label`, `assessment_score_label`.
- `assessment-manual-hooks.ts` already exists in `packages/api/src/` — add all new hand-written hooks there.
- `server.go:Start()` registers all consumers via `go func` blocks; new `ListenAssessmentEvents` must be added there or it is dead code.
