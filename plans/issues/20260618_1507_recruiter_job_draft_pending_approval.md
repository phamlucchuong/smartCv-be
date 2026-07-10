# Recruiter Job Draft Minimal Validation and Pending Approval Flow

## Overview
The recruiter create-job flow is still optimized for direct publishing, not for incremental drafting plus moderation.

Two product rules are missing in the current implementation:

1. Saving a draft should require only `job name` (`title` in code), and should not block on the other required fields used for publish-ready jobs.
2. A recruiter-created job must not become candidate-visible immediately. The domain needs two independent state axes:
   - `moderationStatus`
     - `DRAFT`: recruiter-only, incomplete work in progress
     - `PENDING`: recruiter has submitted the job for review, waiting for admin moderation
     - `PUBLISHED`: admin-approved content revision
   - `visibilityStatus`
     - `INACTIVE`: not visible to candidates because it is draft, pending, recruiter-paused, or has been taken out of circulation
     - `ACTIVE`: visible to candidates and eligible for public job APIs
     - `EXPIRED`: no longer active because the posting deadline has passed

In addition, draft creation and later submission must reject duplicate job names created earlier by the same recruiter. The duplicate check should use the recruiter scope only, because drafts are private to the recruiter and the user confirmed the rule is not company-wide.

Today, the create flow still validates multiple publish-time required fields before allowing draft save, and backend publishing still promotes a draft directly to a single `ACTIVE` status with no separate moderation state.

## Reproduction steps
1. Sign in to `web-recruiter` as a recruiter.
2. Open `/employer/jobs/new`.
3. Enter only the job name/title, leave fields such as location, job type, description, and experience level empty.
4. Click `Lưu nháp`.
5. Observe that the UI blocks draft save because it validates both wizard step 0 and step 1 required fields.
6. Fill the remaining required fields and click `Đăng tin`.
7. Observe that the frontend calls the publish endpoint and the backend moves the job from `DRAFT` directly to `ACTIVE`.
8. Open recruiter jobs list or any candidate/public job source backed by active jobs and observe there is no moderation gate between recruiter submission and candidate visibility.
9. Create another new job for the same recruiter using a previously used title.
10. Observe that neither frontend nor backend rejects the duplicate title.

## Expected behavior
The job creation flow should support drafting and moderation as separate concerns:

1. `Lưu nháp` on the create-job page must require only `title`.
2. Draft save must still validate that `title` is unique within the same recruiter's non-deleted jobs, using trimmed, case-insensitive comparison.
3. Recruiters should be able to update their own drafts without filling publish-only required fields until they explicitly submit the job.
4. Recruiter submission from the create/edit flow must not publish directly to candidates. It should transition the job `moderationStatus` from `DRAFT` to `PENDING` and keep `visibilityStatus = INACTIVE`.
5. `PENDING` jobs must remain visible to the owning recruiter and to admins, but not to candidate/public active job endpoints.
6. Admin moderation must be the only path that transitions a submitted recruiter job from `PENDING` to `PUBLISHED`.
7. Candidate/public endpoints must expose only jobs where `moderationStatus = PUBLISHED` and `visibilityStatus = ACTIVE`.
8. Duplicate-title validation must be enforced by backend invariants, not only by frontend checks.
9. Rejected moderation should return the job from `PENDING` back to `DRAFT` with a required moderation note visible to the recruiter. This issue does not introduce a separate `REJECTED` status.
10. A recruiter must not edit a `PENDING` job in place. If they need to change it while waiting for review, they must explicitly withdraw it back to `DRAFT`, edit there, and submit again.
11. If a recruiter edits an already `PUBLISHED` job, the content revision must immediately leave candidate-visible state by transitioning to `moderationStatus = PENDING` and `visibilityStatus = INACTIVE`, requiring admin approval again before the updated revision can return to `PUBLISHED + ACTIVE`.

## Current behavior
Current frontend behavior:

1. `web-recruiter` create-job draft save calls `validateCreateJobStep(0)` and `validateCreateJobStep(1)` before persisting, so draft save requires title, location, job type, description, and experience level.
2. The create-job page persists drafts through the same create/update payload used for publish-ready jobs.
3. The publish action on recruiter create/edit screens calls `PATCH /api/jobs/{id}/publish`.
4. Recruiter jobs list treats `DRAFT` as the only unpublished state and exposes `Đăng tin` directly from a draft row.
5. No recruiter-side duplicate-title validation exists today.

Current backend behavior:

1. `JobCreateRequest` marks `title`, `description`, `company`, `location`, `jobType`, and `experienceLevel` as required, so create requests cannot represent a minimal draft.
2. `JobService.createJob()` always saves a new job as `DRAFT`.
3. `JobService.publishJob()` only accepts `DRAFT` and promotes it directly to `ACTIVE`.
4. Public `GET /api/jobs`, `GET /api/jobs/{id}`, recruiter-owned reads, and Elasticsearch indexing logic all assume a single `status` field with `ACTIVE` as the publish gate, with no split between moderation and visibility.
5. `JobRepository` has no duplicate-title lookup scoped by recruiter, and `JobService` has no duplicate-title rejection on create/update/publish paths.
6. Admin job moderation UI exists only as static mock data and is not wired to job-service moderation APIs.

## Impact scope
Backend:
- [ ] api-gateway
- [ ] user-service
- [x] job_service
- [ ] application_service
- [ ] ai_engine_service
- [ ] notification-service
- [x] Infrastructure (Docker / RabbitMQ / MongoDB / Elasticsearch)

Frontend:
- [ ] web-candidate
- [x] web-recruiter
- [x] web-admin
- [ ] packages/ui
- [x] packages/api
- [ ] packages/i18n

## Related code
Frontend:

- `frontend/apps/web-recruiter/src/routes/employer.jobs.new.tsx`
  - `handleDraft()` validates both step 0 and step 1 before allowing draft save.
  - `persistDraft()` uses the same payload builder for create/update.
  - `handlePublish()` persists draft state, then calls `publishJobMutation`.
  - `handleQuotaExceededDraft()` already saves a draft when quota is exhausted, so any new draft validation rules must stay compatible with this fallback.
- `frontend/apps/web-recruiter/src/lib/jobForm.ts`
  - `validateCreateJobStep()` currently models publish-time requirements, not draft-time rules.
  - `buildCreateJobPayload()` always builds a full create payload and has no duplicate-title helper.
- `frontend/apps/web-recruiter/src/lib/jobForm.test.ts`
  - Current tests cover payload building and step validation only.
- `frontend/apps/web-recruiter/src/routes/employer.jobs.$id.tsx`
  - Edit flow assumes a draft can be published directly.
- `frontend/apps/web-recruiter/src/routes/employer.jobs.index.tsx`
  - Status filter and actions currently support `ACTIVE`, `DRAFT`, `CLOSED`, `EXPIRED`; there is no `PENDING`.
  - Draft rows expose a direct `Đăng tin` action.
- `frontend/apps/web-admin/src/routes/admin.job-moderation.tsx`
  - Page is currently static/mock and does not fetch or moderate real jobs.

Backend:

- `backend/job_service/src/main/java/vn/chuongpl/job_service/dtos/request/JobCreateRequest.java`
  - Current request contract requires multiple fields that should be optional for minimal draft creation.
- `backend/job_service/src/main/java/vn/chuongpl/job_service/dtos/request/JobUpdateRequest.java`
  - Partial update path exists but does not enforce duplicate-title checks or moderation-aware validation.
- `backend/job_service/src/main/java/vn/chuongpl/job_service/enums/JobStatus.java`
  - Current enum contains only `DRAFT`, `ACTIVE`, `CLOSED`, `EXPIRED`.
- `backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/JobService.java`
  - `createJob()` persists direct draft records.
  - `publishJob()` transitions `DRAFT -> ACTIVE` directly.
  - `getJobById()` exposes only `ACTIVE` publicly, which is correct for final visibility but assumes no intermediate moderation state.
  - `updateJob()` currently allows updates for any state except `CLOSED` and `EXPIRED`.
- `backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/JobRepository.java`
  - Missing repository query for duplicate title lookup scoped by recruiter and excluding the current job on update.
- `backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/JobController.java`
  - Current endpoints include create, update, publish, close, and admin list, but no explicit moderation transition endpoints.
- `backend/job_service/src/test/java/vn/chuongpl/job_service/features/job/JobServiceTest.java`
  - Existing tests cover draft visibility, direct publish to active, and delete behavior, but do not cover duplicate-title rejection or moderation transitions.

## Implementation notes
Backend lifecycle and validation rules should be made explicit:

1. Replace the single lifecycle field with two explicit state fields:
   - `moderationStatus`: `DRAFT | PENDING | PUBLISHED`
   - `visibilityStatus`: `INACTIVE | ACTIVE | EXPIRED`
2. Separate the concepts of:
   - `save draft`
   - `submit for moderation`
   - `approve/reject` from admin
3. Keep candidate/public visibility gated strictly on `moderationStatus = PUBLISHED` plus `visibilityStatus = ACTIVE`.
4. Draft creation should accept a minimal payload with only:
   - required: `title`
   - optional for draft: `description`, `company`, `location`, `jobType`, `experienceLevel`, and the remaining fields
5. Use separate transition endpoints rather than overloading current `publish` semantics.
   - Recruiter endpoint: `PATCH /api/jobs/{id}/submit` for `moderationStatus DRAFT -> PENDING`
   - Recruiter endpoint: `PATCH /api/jobs/{id}/withdraw` for `moderationStatus PENDING -> DRAFT`
   - Recruiter endpoint: `PATCH /api/jobs/{id}/deactivate` for `visibilityStatus ACTIVE -> INACTIVE` when recruiter manually hides a published job after it has been approved
   - Recruiter endpoint: `PATCH /api/jobs/{id}/activate` for `visibilityStatus INACTIVE -> ACTIVE` when recruiter reopens an already published job that is still valid and not expired
   - Admin endpoint: `PATCH /api/jobs/admin/{id}/approve` for `moderationStatus PENDING -> PUBLISHED` and `visibilityStatus -> ACTIVE` when the job is eligible to be shown
   - Admin endpoint: `PATCH /api/jobs/admin/{id}/reject` for `moderationStatus PENDING -> DRAFT`, with a required moderation note and `visibilityStatus = INACTIVE`
   - Deprecate or replace recruiter/admin use of `PATCH /api/jobs/{id}/publish`; do not keep one endpoint name representing two different transitions
6. Publish-ready validation should move to the submit/moderation boundary instead of create-draft boundary.
   - At minimum, recruiter submission from `moderationStatus DRAFT` to `PENDING` must enforce the fields currently needed for a real job posting.
   - The same submit-time validation must run again even if the draft was created or updated earlier, so concurrent or non-UI writes cannot bypass the rule.
7. Enforce unique job title per recruiter on backend create, draft update, and submit paths.
   - Normalize by `trim` and case-insensitive comparison.
   - Exclude soft-deleted jobs from the duplicate check.
   - Exclude the current job id when updating an existing draft/pending job without changing its normalized title.
8. Decide and document the error contract for duplicate title explicitly in `job_service`.
   - Add a dedicated `ErrorCode` instead of overloading `JOB_STATUS_INVALID`.
   - Frontend should surface a field-level title error when this code is returned.
9. Lock edit permissions by moderation/visibility combination:
   - `DRAFT + INACTIVE`: recruiter may update freely, subject to duplicate-title validation
   - `PENDING + INACTIVE`: recruiter may not edit content directly; recruiter may only view or withdraw back to `DRAFT + INACTIVE`
   - `PUBLISHED + ACTIVE`: recruiter may deactivate/reactivate visibility separately, but any content edit must create an updated revision state of `PENDING + INACTIVE` until reapproved
   - `PUBLISHED + INACTIVE`: recruiter may reactivate if still eligible, or edit content which again keeps the revision in `PENDING + INACTIVE`
10. Persist moderation note/history on the job so a recruiter can see why a `PENDING` job was returned to `DRAFT`.
   - Minimum requirement: last moderation note, reviewer id, and reviewed timestamp
   - The returned-to-draft recruiter view must expose this note on jobs list and edit page
   - On recruiter resubmit (`DRAFT -> PENDING`), clear the active rejection note from the visible current-state fields and move it to history so stale rejection reasons are not shown as if they still apply to the pending revision
   - On admin approve (`PENDING -> ACTIVE`), clear the visible current-state moderation note fields while preserving history/audit data
11. Relax the create/update draft contracts explicitly rather than relying on implicit status-aware bean validation.
   - `JobCreateRequest` should be adjusted for minimal draft persistence
   - `JobUpdateRequest` should remain partial for draft editing
   - Submit/approve/reject transitions should have dedicated request/response contracts where needed
12. Add admin moderation endpoints in `job_service` for at least:
   - list/filter jobs by moderation status
   - approve `PENDING -> PUBLISHED`
   - reject `PENDING -> DRAFT` with moderation note
13. On admin approval, default `visibilityStatus` to `ACTIVE` only when the job is still within deadline and not manually deactivated by recruiter-side business rules. If it is already ineligible, approval should result in `PUBLISHED + INACTIVE`.
14. When a job leaves candidate-visible state (`PUBLISHED + ACTIVE`) for any other combination, remove it from Elasticsearch and publish the downstream event needed so candidate-facing consumers stop treating it as public immediately.
15. Ensure Elasticsearch indexing and RabbitMQ job-created/job-updated behavior happen only when a job becomes candidate-visible (`PUBLISHED + ACTIVE`), not merely when it becomes `PENDING` or `PUBLISHED + INACTIVE`.
16. Review `/api/jobs/my`, `/api/jobs/admin/all`, `/api/jobs/{id}`, `/api/jobs/by-recruiter/{recruiterId}`, and search/index flows so each endpoint sees the correct state subset.

Frontend expectations should align with the new backend state machine:

1. On `web-recruiter` create-job page:
   - `Lưu nháp` validates only `title`
   - duplicate title error is shown inline on `title`
   - duplicate title error clears immediately when `title` changes
   - successful save keeps the job private to the recruiter
   - when backend rejects draft save because of duplicate title, including quota-fallback draft-save paths, the UI should keep the user on the form and map the error to the `title` field instead of showing only a generic toast
2. Recruiter submission action text should reflect review workflow, for example `Gửi duyệt` rather than `Đăng tin`.
3. Recruiter jobs list must display both moderation and visibility clearly:
   - moderation state: `DRAFT`, `PENDING`, `PUBLISHED`
   - visibility state: `ACTIVE`, `INACTIVE`, `EXPIRED`
4. Recruiter actions by status should be explicit:
   - `DRAFT + INACTIVE`: edit, submit for review, delete
   - `PENDING + INACTIVE`: view details, withdraw to draft
   - `PUBLISHED + ACTIVE`: deactivate, edit content which transitions the revision to `PENDING + INACTIVE`
   - `PUBLISHED + INACTIVE`: reactivate when eligible, or edit content which remains `PENDING + INACTIVE` until reapproved
   - if the edit-triggered `PUBLISHED -> PENDING` transition fails, the edit form must not open in editable mode and the current public job should remain unchanged in the UI
   - if the transition succeeds, recruiter list/detail views must refresh immediately so the job no longer appears as candidate-visible
5. A returned-to-draft job must show the latest admin rejection note in the list/detail/edit experience so the recruiter knows what to fix.
6. `web-admin` job moderation page should stop using mock rows and consume real moderation APIs.
   - Required states: loading, empty list, filtered list by status, approve pending row, reject pending row with required note, disabled/pending mutation state, and post-mutation refresh/removal
7. `packages/api` must be regenerated after the job-service OpenAPI contract changes.
8. Moderation note history must remain visible in admin detail/history UI even after the current visible rejection note is cleared by resubmit or approve.
   - Recruiter-facing minimum: latest rejection note is visible when the job is back in `DRAFT`
   - Admin-facing minimum: prior rejection notes remain inspectable for audit/history
9. Frontend automated coverage should include:
   - draft-save validation requiring only `title`
   - duplicate-title backend error mapping to the `title` field
   - duplicate-title error clearing when `title` changes
   - recruiter list rendering/filtering for moderation and visibility state combinations
   - withdraw flow from `PENDING -> DRAFT`
   - returned-to-draft moderation note rendering
   - admin approve and reject flows
   - recruiter deactivate/reactivate visibility flows for published jobs
   - published-job edit flow changing the job to `PENDING + INACTIVE` before reapproval

## Notes
- User-confirmed business rule: duplicate title is scoped to the same recruiter, not company-wide.
- User-confirmed visibility rule: drafts are visible only to the owning recruiter.
- User-confirmed moderation rule: recruiter-created jobs should enter `PENDING`, and only admin approval should move them to `PUBLISHED`.
- User-confirmed visibility rule: `ACTIVE` is not the moderation result; it is the recruiter/runtime visibility state after a job has already been published.
- User-confirmed edit rule: when a recruiter edits a published job, the updated content must return to `PENDING` and wait for admin approval again.
- Chosen status design for this issue: no standalone `REJECTED` status; admin rejection returns the job to `DRAFT` with a moderation note.
- This issue intentionally combines draft-save validation and moderation-state changes because implementing only the frontend draft relaxation would leave the publish path semantically incorrect.
