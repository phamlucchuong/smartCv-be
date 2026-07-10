# Assessment Full Flow

**Date:** 2026-06-23  
**Scope:** backend/application_service + notification-service + frontend/web-candidate + frontend/web-recruiter  
**Priority:** High — assessment system is partially wired but missing core UX flows

---

## Current State

Assessment infrastructure (entities, endpoints, React UI for take-test) is fully built from
PR #46 + #47 + `a48def1`. However several key user flows are broken or missing:

1. **Job detail "Take test" button** — links to `/assessments` tab, NOT the actual test UI (`$jobId.tsx:533`).
2. **Timer expiry** — calls `submitAttempt`, which sets `SUBMITTED` status; no `EXPIRED` distinction.
3. **No in-app notifications** after submission — candidate and recruiter both unaware.
4. **Recruiter cannot see** which candidates completed assessment or their scores.
5. **Recruiter has no explicit "Publish" button** — only way to activate is via "assign to candidate".
6. **No submission history view** — clicking a test in `account.assessments` shows nothing extra.

---

## Pre-work Required (before any phase)

**Silent blocker — `getAssessmentsByRecruiter` filters to ACTIVE only** (`AssessmentService.java:250-251`).
The recruiter dashboard never shows DRAFT assessments, making the "Publish" button unreachable.
Fix: remove the `.filter(ACTIVE)` from `getAssessmentsByRecruiter`. Keep it only in `getAssessmentsByJob`.

---

## Scope of Work

### Phase 1 — Backend: New Endpoints

#### 1a. `PATCH /api/attempts/{attemptId}/expire` (CANDIDATE role)
- Sets `attempt.status = EXPIRED`, `attempt.submittedAt = now()`
- Runs same scoring logic as `submitAttempt`
- Publishes `assessment.submitted` event with `isExpired=true` (via Phase 2 publisher)
- New `ErrorCode`: `ATTEMPT_ALREADY_EXPIRED` (assign code 8006)

#### 1b. `PATCH /api/assessments/{id}/publish` (RECRUITER role)
- Resolves `recruiterId` from `userId` (same `resolveRecruiterId` pattern as create/update)
- Validates ownership
- Transitions `DRAFT → ACTIVE` (idempotent if already ACTIVE)
- Returns updated `AssessmentResponse`

#### 1c. `PATCH /api/assessments/{id}/deactivate` (ADMIN role)
- Sets `ACTIVE → DRAFT`
- Returns updated `AssessmentResponse`

#### 1d. `GET /api/assessments/{id}/attempts` (RECRUITER role)
- Resolves `recruiterId`, validates ownership
- Returns `List<AttemptSummaryResponse>`: `{attemptId, candidateId, status, score, result, submittedAt, startedAt}`

#### 1e. Extend `AttemptStateResponse`
- Add `score: Double` and `result: AttemptResult` fields
- These are `null` for IN_PROGRESS attempts — frontend must render `null` as `"—"`

#### 1f. Remove auto-activate from `assignToCandidate` (`AssessmentService.java:91-94`)
- The assignment flow no longer needs to force-activate; explicit `PATCH /publish` is the activation path.
- **Note:** Existing DRAFT assessments that were previously assigned will still work because `getAssessmentsByJob` already shows only ACTIVE assessments to candidates.

#### Changes in `AssessmentAttemptRepository`
Add `List<AssessmentAttempt> findByAssessmentId(String assessmentId)` for endpoint 1d.

### Phase 2 — Backend: Assessment Notifications

#### 2a. RabbitMQ config — new exchange (`RabbitMQConfig.java`)
```java
ASSESSMENT_EXCHANGE = "assessment.exchange"
ASSESSMENT_SUBMITTED_KEY = "assessment.submitted"
ASSESSMENT_SUBMITTED_QUEUE = "assessment.submitted.queue"
```
Add `@Bean` declarations for exchange, queue, and binding.

#### 2b. New message DTO `AssessmentEventMessage.java`
```java
assessmentId, assessmentTitle, attemptId,
candidateId, recruiterId, recruiterUserId,
score, result, isExpired, occurredAt
```

#### 2c. `AssessmentNotificationPublisher`
```java
public void publishAssessmentSubmitted(AssessmentAttempt attempt, Assessment assessment, String recruiterUserId)
```
Sends to `assessment.exchange` with routing key `assessment.submitted`.
Inject into `AssessmentService`. Call from both `submitAttempt` and new `expireAttempt`.

To get `recruiterUserId` from `recruiterId`: use the **existing** `userClient.resolveUserIdFromRecruiterId(recruiterId)` method.
No new `UserClient` method needed — it already exists.
The matching user-service endpoint `GET /api/internal/recruiters/{id}/user-id` also already exists.

#### 2d. Notification-service — new consumer (`internal/notification/consumer.go`)
```go
type AssessmentSubmittedMessage struct {
    AssessmentID    string  `json:"assessmentId"`
    AssessmentTitle string  `json:"assessmentTitle"`
    AttemptID       string  `json:"attemptId"`
    CandidateID     string  `json:"candidateId"`
    RecruiterID     string  `json:"recruiterId"`
    RecruiterUserID string  `json:"recruiterUserId"`
    Score           float64 `json:"score"`
    Result          string  `json:"result"`
    IsExpired       bool    `json:"isExpired"`
    OccurredAt      string  `json:"occurredAt"`
}
```

New `ConsumeAssessmentSubmitted()` method on `Consumer`. Must include topology setup:
```go
ch.ExchangeDeclare("assessment.exchange", "direct", true, false, ...)
ch.QueueDeclare("assessment.submitted.queue", true, false, ...)
ch.QueueBind("assessment.submitted.queue", "assessment.submitted", "assessment.exchange", ...)
```
Then consume and call `notiSvc.NotifyAssessmentSubmitted(ctx, msg)`.

New `ServiceInterface` method:
```go
NotifyAssessmentSubmitted(ctx context.Context, msg AssessmentSubmittedMessage) error
```

Implementation in `service.go`:
- **Candidate notification**: "Bạn đã nộp bài test «{title}». Kết quả: {score}/100 — {PASS/FAIL/PENDING}"
  - `notifType: ASSESSMENT_SUBMITTED`
- **Recruiter notification**: "Candidate #{candidateId[:8]} đã hoàn thành bài test «{title}». Điểm: {score}/100"
  - `notifType: ASSESSMENT_COMPLETED`
  - `receiverID: recruiterUserID`

Start consumer goroutine in `cmd/server/main.go` alongside existing consumers.

### Phase 3 — Frontend: web-candidate

#### 3a. Fix "Take test" button in `jobs/$jobId.tsx` (line 533-534)
Replace the static link to `/assessments` with a link carrying a search param:
```tsx
<Link
  to="/account/assessments"
  search={{ take: assessment.id }}
  className="shrink-0"
>
  <Button size="sm">Làm bài test</Button>
</Link>
```

Add `validateSearch` to the `_account.assessments.tsx` route definition (required by TanStack Router):
```ts
validateSearch: (search) => ({
  take: typeof search.take === 'string' ? search.take || undefined : undefined,
})
```

In `AssessmentsPage`, read `const { take } = Route.useSearch()`, then in a `useEffect`:
- If `take` is set: find existing `IN_PROGRESS` attempt for that `assessmentId` in the loaded attempts
  - Found → `setTaking({ assessmentId: take, attemptId: found.attemptId })`
  - Not found → call `startAttemptMutation.mutate({ assessmentId: take })`, on success set `taking`
  - SUBMITTED/EXPIRED → show toast "Bạn đã hoàn thành bài test này"
- Call `navigate({ search: {} })` after processing to clean the URL

#### 3b. Timer expiry calls `/expire` instead of `/submit`
In `TakeAssessmentContent` (`_account.assessments.tsx:349-358`), when `timeLeft <= 0`, call `useExpireAttempt` mutation instead of `useSubmitAttempt`.

New `useExpireAttempt` hook in `packages/api/src/assessment-manual-hooks.ts`:
```ts
export function useExpireAttempt(options?: ...) {
  return useMutation({
    mutationFn: ({ attemptId }: { attemptId: string }) =>
      apiClient.patch(`/api/attempts/${attemptId}/expire`),
    ...options,
  })
}
```

#### 3c. Submission history in `_account.assessments.tsx`
Group attempts by `assessmentId` (client-side). When clicking an `AssessmentCard`, expand or open a modal showing all past attempts:
- Each row: Ngày nộp | Trạng thái badge | Điểm (or "—" when null) | Kết quả badge
- Guard null `score`/`result` for IN_PROGRESS rows

#### 3d. i18n additions (`web-candidate.json`)
Add keys used in `_account.assessments.tsx` that are missing from the locale file:
`assessments_page_title`, `assessments_expired_label`, `assessments_history_title`,
`btn_submit_assessment`, `btn_back_to_list`, `btn_exit`, `btn_prev_question`, `btn_next_question`,
`assessment_completed`, `assessment_question_count`, `assessment_passed_desc`, `assessment_failed_desc`,
`assessment_result_pending_desc`, `page_title_assessments`.

### Phase 4 — Frontend: web-recruiter

#### 4a. "Publish" button in `employer.assessments.tsx`
Add conditionally to the action cell (room confirmed — `space-x-1.5 whitespace-nowrap` layout):
```tsx
{a.status === 'DRAFT' && (
  <Button size="sm" onClick={() => handlePublish(a.id)}>Publish</Button>
)}
```
`usePublishAssessment` in `packages/api/src/assessment-manual-hooks.ts`:
- `PATCH /api/assessments/{id}/publish`
- On success: invalidate recruiter assessment list query

#### 4b. Candidate attempts panel
Add "Xem kết quả" button per assessment row. Opens a dialog calling `useGetAssessmentAttempts(assessmentId)`:
```ts
export function useGetAssessmentAttempts(assessmentId: string, options?: ...) {
  return useQuery({
    queryKey: ['assessment-attempts', assessmentId],
    queryFn: () => apiClient.get(`/api/assessments/${assessmentId}/attempts`),
    ...options,
  })
}
```
Dialog table: CandidateId (8 chars) | Trạng thái | Điểm | Kết quả | Ngày nộp. Sort by score desc.

#### 4c. i18n additions (`web-recruiter.json`)
Add: `publish_assessment`, `view_results`, `col_candidate`, `col_status`, `col_score`, `col_result`, `col_submitted_at`.

---

## Publish Policy Decision

**Chosen:** Recruiter self-publishes immediately (DRAFT → ACTIVE), admin can deactivate afterward.

**Rationale:**
- Matches existing auto-activation behavior — publishing is not a new trust model.
- Assessments are internal to the recruiter's own job; candidates only see ACTIVE assessments for jobs they browse.
- Admin oversight via deactivation keeps the platform safe without adding recruiter friction.
- Consistent with job flow philosophy (lower-risk content → direct activation acceptable).

---

## Files to Change

### Backend — application_service
| File | Change |
|------|--------|
| `AssessmentController.java` | Add `/expire`, `/publish`, `/deactivate`, `/{id}/attempts` endpoints |
| `AssessmentService.java` | Add `expireAttempt`, `publishAssessment`, `deactivateAssessment`, `getAssessmentAttempts`; remove ACTIVE filter from `getAssessmentsByRecruiter`; remove auto-activate from `assignToCandidate`; inject `AssessmentNotificationPublisher` |
| `AssessmentAttemptRepository.java` | Add `findByAssessmentId(String assessmentId)` |
| `AttemptStateResponse.java` | Add `score: Double`, `result: AttemptResult` |
| `AttemptSummaryResponse.java` | New DTO |
| `AssessmentEventMessage.java` | New message class |
| `AssessmentNotificationPublisher.java` | New publisher |
| `RabbitMQConfig.java` | Add assessment exchange/queue/binding |
| `ErrorCode.java` | Add `ATTEMPT_ALREADY_EXPIRED` (8006) |

### Backend — user-service
No changes needed — `GET /api/internal/recruiters/{id}/user-id` already exists.

### Backend — notification-service
| File | Change |
|------|--------|
| `internal/notification/consumer.go` | Add `AssessmentSubmittedMessage`, `ConsumeAssessmentSubmitted` (with topology setup) |
| `internal/notification/service.go` | Add `NotifyAssessmentSubmitted` to interface + implementation |
| `cmd/server/main.go` | Start `ConsumeAssessmentSubmitted` goroutine |

### Frontend — web-candidate
| File | Change |
|------|--------|
| `apps/web-candidate/src/routes/jobs/$jobId.tsx` | Fix "Take test" button (line 533) |
| `apps/web-candidate/src/routes/_account.assessments.tsx` | Add `validateSearch`, read `?take` param, call expire mutation, add history view |
| `apps/web-candidate/src/locales/web-candidate.json` | Add missing i18n keys |

### Frontend — web-recruiter
| File | Change |
|------|--------|
| `apps/web-recruiter/src/routes/employer.assessments.tsx` | Add publish button, add attempts results panel |
| `apps/web-recruiter/src/locales/web-recruiter.json` | Add missing i18n keys |

### Shared
| File | Change |
|------|--------|
| `packages/api/src/assessment-manual-hooks.ts` | Add `useExpireAttempt`, `usePublishAssessment`, `useGetAssessmentAttempts` |

(`packages/api/src/index.ts` already exports `assessment-manual-hooks.ts` — no change needed)

---

## Execution Order

1. **Pre-work** — remove ACTIVE filter from `getAssessmentsByRecruiter` (1 line fix, can be in its own commit)
2. **Phase 1** — backend endpoints + `AttemptStateResponse` extension
3. **Phase 2** — RabbitMQ config, publisher, notification-service consumer
4. **Phase 3** — web-candidate: fix take-test nav, expire flow, history view, i18n
5. **Phase 4** — web-recruiter: publish button, results panel, i18n

Suggested branches:
- `feat/assessment-backend-endpoints-notifications` (Pre-work + Phase 1 + 2)
- `feat/assessment-candidate-flow` (Phase 3)
- `feat/assessment-recruiter-publish-results` (Phase 4)
