# Recruiter Registration: Profile Completion & Admin Approval Flow

## Overview

After a recruiter completes OTP-verified signup, they are immediately taken to the
dashboard with an incomplete profile and `status = PENDING`. There is no guided
profile-completion step, no way to submit the profile for admin review, no blocking
screen for unapproved recruiters, and the admin employer-verification page is fully
mocked (no real API calls). Jobs can be created by any recruiter regardless of
approval status.

This issue implements the full end-to-end approval lifecycle:
1. Post-signup: guided multi-step profile completion form.
2. Submit: recruiter explicitly sends the profile for admin review.
3. Pending / Rejected gate: full-screen block on the recruiter portal until APPROVED.
4. Admin action: real approval / rejection (with rejection note) wired to the API.

---

## Reproduction steps

1. Register a recruiter account at `/signup/recruiter`.
2. Verify OTP — redirected to `/employer` (dashboard).
3. Observe: no prompt to complete company profile; profile page shows empty fields;
   `status = PENDING` but portal is fully accessible.
4. Open admin at `/admin/employer-verification` — table shows hardcoded mock data,
   Approve / Reject buttons are no-ops.

## Expected behavior

- After signup → show a mandatory profile-completion screen (not skippable).
- Recruiter fills all required fields and uploads a business license (S3).
- On submit → `status` transitions to `PENDING`; recruiter sees a "Waiting for
  approval" full-screen state on every protected route.
- Admin reviews in a real list; clicks Approve or Reject (with an optional note).
- On Approve → recruiter's status becomes `APPROVED`; portal unlocks.
- On Reject → recruiter's status becomes `REJECTED`; the portal shows the
  rejection note and a "Edit & Resubmit" button.

## Current behavior

- Recruiter can access the full portal immediately after signup.
- `admin.employer-verification.tsx` is completely hardcoded — no API calls, buttons
  do nothing.
- `RecruiterStatus.PENDING` is never transitioned by any recruiter-facing action.
- No backend endpoint to submit a profile for review.
- No rejection note field on the entity.

---

## Impact scope

Backend:
- [x] user-service

Frontend:
- [x] web-recruiter
- [x] web-admin
- [x] packages/api

---

## Related code

### user-service — already exists, needs extension

| File | Note |
|------|------|
| `features/recruiter/Recruiter.java` | Entity — has all company fields; missing `companyCity`, `rejectionNote` |
| `enums/RecruiterStatus.java` | `PENDING, APPROVED, REJECTED` — needs `DRAFT` added |
| `features/recruiter/RecruiterController.java` | `PATCH /{id}/status` (admin-only) exists; missing `POST /me/submit` |
| `features/recruiter/RecruiterService.java` | `updateStatus()` exists; `createBasicProfile()` creates with `PENDING` (must change to `DRAFT`) |
| `dtos/request/RecruiterStatusRequest.java` | Missing `rejectionNote` field |
| `dtos/response/RecruiterResponse.java` | Missing `rejectionNote`, `companyCity` fields |
| `dtos/request/RecruiterRequest.java` | Missing `companyCity` field |

### web-recruiter

| File | Note |
|------|------|
| `routes/signup.recruiter.tsx` | Currently redirects to `/employer` immediately after OTP; must redirect to `/employer/setup` instead |
| `routes/employer.verification.tsx` | Fully mocked; needs to display real status, rejection note, resubmit action |
| `routes/employer.tsx` | Route layout — needs status guard that redirects DRAFT/PENDING/REJECTED to `/employer/setup` or `/employer/pending` |
| `routes/employer.profile.tsx` | Reads `recruiter.status`; already shows APPROVED badge |

### web-admin

| File | Note |
|------|------|
| `routes/admin.employer-verification.tsx` | Fully mocked; needs real API wiring |

### packages/api

| File | Note |
|------|------|
| `generated/user/recruiter-controller/recruiter-controller.ts` | Has `updateStatus` hook; needs `submitProfile` added once swagger regenerated |

---

## Detailed implementation plan

### Phase 1 — Backend: entity and new endpoint

#### 1-a. Add `DRAFT` to `RecruiterStatus`
```java
// enums/RecruiterStatus.java
public enum RecruiterStatus {
    DRAFT,    // profile exists but not yet submitted
    PENDING,  // submitted, awaiting admin review
    APPROVED,
    REJECTED
}
```
Change `createBasicProfile()` default from `PENDING` to `DRAFT`.
Update the `Recruiter.java` `@Builder.Default` accordingly.

#### 1-b. Add missing fields to `Recruiter` entity
```java
@Field(name = "company_city")   String companyCity;      // consistent with company_* prefix
@Field(name = "rejection_note") String rejectionNote;
```

Add both to `RecruiterRequest`, `RecruiterResponse`, and update `RecruiterMapper`.
Use `companyCity` (not `city`) everywhere — keep consistent with the existing
`companyAddress`, `companySize`, etc. naming.

#### 1-c. Add `rejectionNote` to `RecruiterStatusRequest`
```java
String rejectionNote;   // optional; stored when status = REJECTED
```
In `RecruiterService.updateStatus()`, save `rejectionNote` on the entity when
status is set to `REJECTED`. Clear it when status transitions to `PENDING` or
`APPROVED`.

#### 1-d. New endpoint: `POST /api/recruiters/me/submit`
```java
@PostMapping("/me/submit")
@PreAuthorize("hasRole('RECRUITER')")
public ApiResponse<RecruiterResponse> submitForApproval(@AuthenticationPrincipal String userId) {
    return ApiResponse.<RecruiterResponse>builder()
        .data(recruiterService.submitForApproval(userId))
        .build();
}
```
`RecruiterService.submitForApproval(userId)`:
- Load recruiter by userId, throw if not found.
- Only allow transition from `DRAFT` or `REJECTED` → `PENDING`.
- Validate required fields: `companyName`, `taxCode`, `companyAddress`, `companyCity`,
  `industry`, `companyType`, `companySize`, `businessLicenseUrl`. Throw
  `AppException(ErrorCode.RECRUITER_PROFILE_INCOMPLETE)` if any are blank/null.
- Clear `rejectionNote`, set `status = PENDING`, save.

Add `RECRUITER_PROFILE_INCOMPLETE` to `ErrorCode` enum.

#### 1-e. S3 upload endpoint for business license
New endpoint `POST /api/recruiters/me/business-license`. Follow the same structure
as `CandidateController.uploadAvatar()` (multipart upload via `S3Service`). Store
the result URL in `businessLicenseUrl`.

Server-side constraints (must enforce in the endpoint, not just on the frontend):
- **Content-type**: accept only `application/pdf` and `image/jpeg`/`image/png`.
  Reject with 400 if MIME type does not match.
- **Size limit**: max 10 MB. Spring multipart config handles this via
  `spring.servlet.multipart.max-file-size`.
- **S3 key**: fixed as `recruiters/{userId}/business-license` (no user-controlled
  filename component, no path traversal risk).

#### 1-f. Lock profile edits while PENDING
In `RecruiterService.update()`, when `isAdmin == false`, add a guard:
```java
if (recruiter.getStatus() == RecruiterStatus.PENDING) {
    throw new AppException(ErrorCode.RECRUITER_PROFILE_LOCKED);
}
```
Add `RECRUITER_PROFILE_LOCKED` to `ErrorCode`. Admin can still edit at any time.
This prevents a recruiter from mutating their submitted profile while an admin is
mid-review.

#### 1-g. Restrict `rejectionNote` from the public `GET /{id}` endpoint
`GET /api/recruiters/{id}` is unauthenticated. Once `rejectionNote` is on
`RecruiterResponse`, it would be publicly readable. Add a separate
`RecruiterPublicResponse` DTO that omits `rejectionNote` (and any other sensitive
fields), and use it for the public `GET /{id}` and `GET /user/{userId}` endpoints.
The authenticated `GET /me` and admin `GET` list continue to return the full response.

#### 1-h. Enforce approval in job-service
`JobService.createJob()` currently does not validate recruiter approval status —
a PENDING recruiter can call `POST /api/jobs` directly and bypass the frontend.

Add a call to user-service inside `JobService.createJob()`:
```java
// Pseudo-code — use the existing RecruiterClient or RestTemplate
RecruiterProfileResponse profile = recruiterClient.getProfile(recruiterId);
if (profile.getStatus() != RecruiterStatus.APPROVED) {
    throw new AppException(ErrorCode.RECRUITER_NOT_APPROVED);
}
```
Add `RECRUITER_NOT_APPROVED` to job-service's `ErrorCode`.
The user-service endpoint `GET /api/recruiters/user/{userId}` already exists
(unauthenticated) and returns `status`. Call it from job-service with the
internal gateway secret header.

### Phase 2 — Frontend: recruiter portal

#### 2-a. Profile setup route `/employer/setup`
New file: `routes/employer.setup.tsx`.

A single-page (or stepper) form with all required profile fields:

| Section | Fields |
|---------|--------|
| Company info | Company name (pre-filled from signup), Tax ID, Address, City/Province, Company type (STARTUP / TNHH / CP / AGENCY / OUTSOURCING / PRODUCT), Founded year, Company size (1-10, 11-50, 51-200, 201-500, 500+), Industry |
| About | Company description |
| Legal | Business license PDF upload (calls S3 upload endpoint; displays uploaded filename) |
| Online presence | Website, LinkedIn URL |
| HR contact | Contact name, Contact email, Contact phone (pre-filled from user account) |

On submit:
1. `PUT /api/recruiters/{id}` — save all profile fields.
2. `POST /api/recruiters/me/submit` — transition to PENDING.
3. Redirect to `/employer/pending`.

This route is accessible regardless of approval status (needed for REJECTED → edit → resubmit flow).

#### 2-b. Pending / Rejected gate route `/employer/pending`
New file: `routes/employer.pending.tsx`.

Full-screen state page:
- **PENDING state**: Clock icon, "Your profile is under review" message, company
  name, submitted-at date. No action buttons.
- **REJECTED state**: Warning icon, "Your application was rejected" heading, display
  `rejectionNote` in a highlighted box, "Edit & Resubmit" button (→ `/employer/setup`).

#### 2-c. Route guard via TanStack Router `loader`
In TanStack Router, redirects must happen in `beforeLoad` or `loader` (before
render), not inside a component body — doing `navigate()` after a hook resolves
causes a render flash and a stale history entry.

Use `ensureQueryData` in the route `loader` and throw `redirect()`:

```ts
// employer.tsx route definition
export const Route = createFileRoute('/employer')({
  loader: async ({ context }) => {
    const recruiter = await context.queryClient.ensureQueryData(getGetMe1QueryOptions())
    const status = recruiter?.data?.status
    const pathname = context.router.state.location.pathname

    const isGatePath =
      pathname === '/employer/setup' || pathname === '/employer/pending'

    if (!isGatePath) {
      if (status === 'DRAFT') throw redirect({ to: '/employer/setup', replace: true })
      if (status === 'PENDING' || status === 'REJECTED')
        throw redirect({ to: '/employer/pending', replace: true })
    }
    return recruiter
  },
  component: EmployerLayout,
})
```

Use `replace: true` so pressing Back from `/employer/pending` does not return to
the blocked route (which would immediately re-redirect).

**Why `isGatePath` is still needed**: `employer.setup` and `employer.pending` are
children of `employer.tsx` in TanStack Router's file-based tree, so the parent
loader runs for those paths too. Without the exemption, the loader would redirect
`/employer/setup → /employer/setup` indefinitely.

The component itself renders a full-screen spinner while the query resolves:
```tsx
function EmployerLayout() {
  const { data: me, isLoading } = RecruiterApi.useGetMe1()
  if (isLoading) return <FullScreenSpinner />
  return <Outlet />
}
```

#### 2-d. Update `signup.recruiter.tsx`
Change the post-OTP redirect from `navigate({ to: '/employer' })` to
`navigate({ to: '/employer/setup', replace: true })`.

Remove the `RecruiterApi.create()` call that was added in the previous fix — the
setup page will call `useGetMe1()` which auto-creates the profile with status
`DRAFT` (after backend change 1-a). The explicit create call is no longer needed.

**Atomicity requirement**: backend change 1-a (DRAFT default) and this frontend
change must be deployed together. If the backend is updated first and the frontend
still calls `RecruiterApi.create()`, the status will be set correctly. If the
frontend is updated first (removing the call), the auto-create in `getMe` will
use whatever the current default is — ensure backend ships first.

#### 2-e. Prevent re-submit for APPROVED recruiter in `/employer/setup`
The setup page is accessible to all statuses, but the "Submit for review" button
must be disabled (or hidden) when `recruiter.status === 'APPROVED'`. Show a
read-only banner: "Your profile is verified — contact support to make changes."
The backend `submitForApproval` will reject APPROVED status with a 4xx, but the
frontend should prevent the attempt entirely.

#### 2-f. Update `employer.verification.tsx`
Connect to real API:
- Load `RecruiterApi.useGetMe1()`.
- Display actual status badge.
- If `REJECTED`: show `rejectionNote` and an "Edit & Resubmit" button.
- If `APPROVED`: show verification checkmark and all submitted fields (read-only).
- Remove all hardcoded placeholder values.

### Phase 3 — Frontend: admin portal

#### 3-a. Wire `admin.employer-verification.tsx` to real API

**Backend changes required first:**

`RecruiterController.getAll()` currently accepts only `page` and `size` params.
Add an optional `status` query param:
```java
@GetMapping
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<PageResponse<RecruiterResponse>> getAll(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int size,
        @RequestParam(required = false) RecruiterStatus status) {
    return ApiResponse.<PageResponse<RecruiterResponse>>builder()
            .data(recruiterService.getAll(page, size, status))
            .build();
}
```

`RecruiterRepository` currently only has `findAllByDeletedFalse(Pageable)`. Add:
```java
Page<Recruiter> findAllByStatusAndDeletedFalse(RecruiterStatus status, Pageable pageable);
```

`RecruiterService.getAll()` must be overloaded (or the existing method updated) to
branch on whether `status` is null:
```java
public PageResponse<RecruiterResponse> getAll(int page, int size, RecruiterStatus status) {
    Pageable pageable = PageRequest.of(Math.max(page - 1, 0), Math.max(size, 10),
            Sort.by(Sort.Direction.DESC, "createdAt"));
    Page<Recruiter> recruiters = status != null
            ? recruiterRepository.findAllByStatusAndDeletedFalse(status, pageable)
            : recruiterRepository.findAllByDeletedFalse(pageable);
    // ... same mapping as before
}
```

**Frontend (after backend + Orval regen):**
- Use `RecruiterApi.useGetAll({ status, page, size })` with a status filter query param.
- Add status filter tab: All / Pending / Approved / Rejected.
- Table columns: Company name, Contact name, Registered date, Tax ID, Status badge,
  Business license (link to URL), Actions.
- **Approve** button → calls `RecruiterApi.useUpdateStatus()` with
  `{ status: 'APPROVED' }`.
- **Reject** button → opens a dialog with a text area for rejection note; on confirm
  calls `RecruiterApi.useUpdateStatus()` with `{ status: 'REJECTED', rejectionNote }`.

Note: `RecruiterApi.useUpdateStatus()` is already generated by Orval from the
existing `PATCH /{id}/status` endpoint; only the request body schema needs updating
(adding `rejectionNote`).

#### 3-b. `RecruiterStatusRequest` in swagger

After backend changes, regenerate `pnpm -F @smart-cv/api generate:user` to pick up
the new `rejectionNote` field in `RecruiterStatusRequest`.

---

## API changes summary

| Method | Path | Auth | Change |
|--------|------|------|--------|
| `POST` | `/api/recruiters/me/submit` | RECRUITER | **New** — transition DRAFT/REJECTED → PENDING |
| `POST` | `/api/recruiters/me/business-license` | RECRUITER | **New** — S3 PDF upload |
| `PATCH` | `/api/recruiters/{id}/status` | ADMIN | **Modified** — accepts `rejectionNote` in body |
| `GET` | `/api/recruiters` | ADMIN | **Modified** — add optional `?status=PENDING\|APPROVED\|REJECTED` query param; backend needs new `findAllByStatusAndDeletedFalse` repository method |

---

## Acceptance criteria

- [ ] New recruiter after signup sees profile setup form at `/employer/setup`, cannot skip it.
- [ ] All required fields are validated before submit (frontend + backend).
- [ ] Business license PDF uploads to S3 and URL is stored on the recruiter entity.
- [ ] `POST /me/submit` transitions `DRAFT` → `PENDING`; returns 4xx if required fields are missing.
- [ ] Recruiter with `PENDING` status sees blocking screen on every `employer/*` route except `/setup` and `/pending`.
- [ ] Recruiter with `REJECTED` status sees blocking screen with the admin's rejection note.
- [ ] Admin can see a real paginated list of recruiters filtered by status.
- [ ] Admin can approve a recruiter; status becomes `APPROVED`; recruiter portal unlocks immediately (TanStack Query refetches).
- [ ] Admin can reject with a note; status becomes `REJECTED`; recruiter sees the note.
- [ ] `APPROVED` recruiter can post jobs as before.
- [ ] Non-APPROVED recruiter is rejected with 4xx when calling `POST /api/jobs` directly (backend enforces this, not just frontend).

## Notes

- `companyCity` vs `city` naming — the entity uses snake_case field names for MongoDB
  (`company_city`). Keep the pattern consistent with other `company_*` fields.
- The business license S3 upload follows the same pattern as candidate CV upload in
  `CandidateController.uploadCv()` — reference that implementation.
- The current `RecruiterService.getMe()` auto-creates a basic profile if missing
  (added in previous fix). After this issue, it should create with `DRAFT` status
  instead of `PENDING`.
- `employer.verification.tsx` currently shows hardcoded "Verified" state — do not
  confuse it with the new `/employer/pending` route. `verification.tsx` becomes
  the long-form company info display for an already-approved recruiter. The gate
  page for PENDING/REJECTED is the new `employer.pending.tsx`.
