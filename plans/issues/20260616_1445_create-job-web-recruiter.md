# [Feature] Implement Create Job Feature in web-recruiter

## Overview

The "New Job" wizard at `/employer/jobs/new` (`employer.jobs.new.tsx`) is entirely mocked — every input field is uncontrolled, the preview step displays hardcoded strings, and the "Đăng tin" button only fires a toast then navigates away with zero API calls. The job list page (`employer.jobs.index.tsx`) reads from `JOBS` mock data instead of the real `GET /job/api/jobs/my` endpoint.

The backend is fully implemented:
- `POST /job/api/jobs` — creates a job in `DRAFT` status
- `PATCH /job/api/jobs/{id}/publish` — transitions `DRAFT` → `ACTIVE`, Elasticsearch-indexes and publishes a RabbitMQ `JOB_CREATED` event
- `GET /job/api/jobs/my` — returns paginated list of the recruiter's own jobs (all statuses)

All three endpoints require `ROLE_RECRUITER` or `ROLE_ADMIN` JWT (enforced by API Gateway + `@PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")`).

---

## Reproduction Steps

1. Log in as a recruiter at `/login`.
2. Navigate to `/employer/jobs`.
3. Click "Đăng tin mới" → `/employer/jobs/new`.
4. Fill in any values and advance through all 4 wizard steps.
5. Click "Đăng tin" on step 4.

**Observed:** `toast.success("Đăng tin thành công")` fires, router navigates to `/employer/jobs`. No network request is made. No job is created.

---

## Expected Behavior

1. Form fields are controlled (tracked in React state).
2. **"Lưu nháp"** button: calls `POST /job/api/jobs` → saves as `DRAFT`; invalidates jobs list query; navigates to `/employer/jobs`.
3. **"Đăng tin"** button (step 4): calls `POST /job/api/jobs` → receives job `id` → calls `PATCH /job/api/jobs/{id}/publish` → job becomes `ACTIVE` and is Elasticsearch-indexed; invalidates jobs list query; navigates to `/employer/jobs`.
4. `/employer/jobs` list page fetches from `GET /job/api/jobs/my` (real API, not mock).
5. The quota display in the preview step shows the real remaining `quotaJobPost` from the recruiter's profile (`GET /user/api/recruiters/me`).

---

## Current Behavior

- All inputs in steps 0–2 use `defaultValue` (uncontrolled), so React state never changes.
- Step 3 preview hard-codes "Backend Java Developer", "FPT Software", "Ho Chi Minh City".
- "Đăng tin" handler: `toast.success(...); navigate({ to: "/employer/jobs" })` — no API call.
- "Lưu nháp" button: renders but does nothing.
- `employer.jobs.index.tsx` renders `JOBS` from `src/lib/mock-data.ts`.
- Quota row shows "Còn lại 12/20 tin" (hardcoded).

---

## Impact Scope

Backend:
- [ ] api-gateway
- [ ] user-service
- [ ] job_service
- [ ] application_service
- [ ] ai_engine_service
- [ ] notification-service
- [ ] Infrastructure (Docker / RabbitMQ / MongoDB / Elasticsearch)

Frontend:
- [ ] web-candidate
- [x] web-recruiter — primary scope
- [ ] web-admin
- [ ] packages/ui
- [x] packages/api — one new wrapper file for the recruiter profile endpoint (see §5)
- [ ] packages/i18n

---

## Related Code

### 1. Wizard page — form state
`frontend/apps/web-recruiter/src/routes/employer.jobs.new.tsx`

Replace the `F`, `S`, `T` helper components that use `defaultValue` (uncontrolled) with controlled `value`/`onChange` props. Add `useState` for every mapped field.

**Field mapping — Step 0 (Thông tin cơ bản):**

| UI label | State key | Backend field | Constraint |
|---|---|---|---|
| Vị trí | `title` | `title` | `@NotBlank` |
| Địa điểm | `location` | `location` | `@NotBlank` |
| Loại hình | `jobType` | `jobType` | `@NotNull`, enum |
| Hạn nộp hồ sơ | `deadline` | `deadline` | optional, strictly future |
| Lương tối thiểu (VND) | `salaryMin` | `salaryMin` | `number`, only when `!isNegotiable` |
| Lương tối đa (VND) | `salaryMax` | `salaryMax` | `number`, only when `!isNegotiable` |

**Field mapping — Step 1 (Mô tả công việc):**

| UI label | State key | Backend field | Constraint |
|---|---|---|---|
| Mô tả | `description` | `description` | `@NotBlank` |
| Yêu cầu (textarea) | `requirementsText` | `requirements` | `string[]` — split by newline on submit |
| Quyền lợi (textarea) | `benefitsText` | `benefits` | `string[]` — split by newline on submit |
| Kinh nghiệm | `experienceLevel` | `experienceLevel` | `@NotNull`, enum |
| Kỹ năng yêu cầu (tags) | `skills` | `skills` | already managed with `useState` |

**Fields to remove from the UI** (no backend equivalent):
- "Phòng ban" (department)
- "Hình thức" (Onsite/Remote/Hybrid) — `jobType: REMOTE` covers the remote case
- "Số lượng tuyển" (number of openings)
- "Trách nhiệm" (responsibilities) textarea — merge into `description` or remove

**`company` field (hidden — auto-populated):**
Required by backend (`@NotBlank`), not shown in the form. Auto-populate from the recruiter's profile (see §3). Do not show as an editable field.

**Enum values — replace existing incorrect dropdown strings:**

For `jobType` ("Loại hình"), the existing options `["Full-time", "Part-time", "Internship", "Bootcamp", "Hybrid"]` are wrong. Replace with the backend enum keys and Vietnamese labels:

| Displayed label | Value sent to API |
|---|---|
| Full-time | `FULL_TIME` |
| Part-time | `PART_TIME` |
| Remote | `REMOTE` |
| Hợp đồng | `CONTRACT` |
| Thực tập | `INTERNSHIP` |

For `experienceLevel` ("Kinh nghiệm"), the existing options `["1-3 năm", "3-5 năm", "5+ năm"]` are wrong. Replace with:

| Displayed label | Value sent to API |
|---|---|
| Thực tập sinh | `INTERN` |
| Junior | `JUNIOR` |
| Middle | `MIDDLE` |
| Senior | `SENIOR` |
| Lead | `LEAD` |

**Deadline field:**
Add `<input type="date" min={tomorrow}>` (where `tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]`).
- The deadline is **optional** — submission without a deadline is valid.
- If set, the backend's `publishJob` enforces that `deadline.isAfter(LocalDate.now())` — i.e., strictly after today; today's date itself is rejected. Set `min` to tomorrow's date.
- Show a validation error if `publishJob` returns error code `JOB_STATUS_INVALID`.

**Salary in negotiable mode:**
When `isNegotiable` is `true`, omit `salaryMin` and `salaryMax` from the request body (send `undefined`, not `0` or `null`).

**Client-side validation before submission:**
- `title`, `description`, `location`: non-empty strings.
- `jobType`, `experienceLevel`: must have a selected value (not empty string), since both are `@NotNull` on the backend.
- If any required field is missing, show an inline error and block navigation to the next step.

### 2. Wizard page — submit handlers
`frontend/apps/web-recruiter/src/routes/employer.jobs.new.tsx`

**Build the payload:**
```tsx
const payload: JobCreateRequest = {
  title,
  description,
  company: companyName, // from recruiter profile, see §3
  location,
  jobType: jobType as JobCreateRequestJobType,
  experienceLevel: experienceLevel as JobCreateRequestExperienceLevel,
  salaryMin: isNegotiable ? undefined : salaryMin,
  salaryMax: isNegotiable ? undefined : salaryMax,
  skills,
  requirements: requirementsText.split('\n').filter(Boolean),
  benefits: benefitsText.split('\n').filter(Boolean),
  deadline: deadline || undefined,
}
```

**"Đăng tin" (step 4 — create + publish):**
```tsx
const { mutateAsync: createJob, isPending: isCreating } = useCreateJob()
const { mutateAsync: publishJob, isPending: isPublishing } = usePublishJob()

const handlePublish = async () => {
  try {
    const created = await createJob({ data: payload })
    const jobId = created?.data?.id
    if (!jobId) throw new Error('No job id returned')
    await publishJob({ id: jobId })
    queryClient.invalidateQueries({ queryKey: ['/job/api/jobs/my'], exact: false })
    toast.success('Đăng tin thành công')
    navigate({ to: '/employer/jobs' })
  } catch {
    toast.error('Đăng tin thất bại')
  }
}
```

Import `useCreateJob` and `usePublishJob` from `@smart-cv/api/generated/job/job-controller/job-controller` — these hooks produce `/api/jobs` URLs which the shared axios interceptor (`getPrefixedUrl`) rewrites to `/job/api/jobs` automatically (see §5).

**"Lưu nháp":**
```tsx
const handleDraft = async () => {
  try {
    await createJob({ data: payload })
    queryClient.invalidateQueries({ queryKey: ['/job/api/jobs/my'], exact: false })
    toast.success('Đã lưu nháp')
    navigate({ to: '/employer/jobs' })
  } catch {
    toast.error('Lưu nháp thất bại')
  }
}
```

Wire `isCreating || isPublishing` to disable/show loading on both buttons.

**`publishJob` ownership guard:**
`publishJob` also validates that the job belongs to the caller (`assertOwner`). This should not occur in normal flow (the recruiter just created the job), but handle the error case gracefully.

### 3. Recruiter profile (for `company` field and quota)

Endpoint: `GET /user/api/recruiters/me` — requires JWT.

`RecruiterResponse` (from `packages/api/src/generated/user/model/recruiterResponse.ts`) has `companyName?: string` and `quotaJobPost?: number`.

⚠️ The generated hook `useGetMe1` in `packages/api/src/generated/user/recruiter-controller/recruiter-controller.ts` calls `/api/recruiters/me`. **This URL is NOT covered by the `getPrefixedUrl` interceptor** (only `/api/users*` and `/api/auth*` are rewritten for the user service — not `/api/recruiters*`). Calling `useGetMe1` through the gateway will return 404. Use the manual wrapper hook instead (see §5).

Usage in `employer.jobs.new.tsx`:
```tsx
const { data: profileData } = useGetRecruiterProfile()
const companyName = profileData?.data?.companyName ?? ''
const quotaRemaining = profileData?.data?.quotaJobPost ?? 0
```

Show `quotaRemaining` on the step 3 preview. Block publish if `quotaRemaining === 0` with a toast redirecting to `/employer/billing`.

### 4. Job list page
`frontend/apps/web-recruiter/src/routes/employer.jobs.index.tsx`

- Remove `import { JOBS } from "@/lib/mock-data"`.
- Use `useGetMyJobs` from `@smart-cv/api/generated/job/job-controller/job-controller` (same interceptor rewrite applies, works correctly).
- Derive total count from `data?.data?.total`.
- Map `JobResponse` fields to table columns. The existing mock table has columns `applicants`, `qualified`, and `mode` which **do not exist in `JobResponse`**. Replace or remove them:
  - "Ứng viên" → show `0` or remove until the application service provides counts
  - "Đạt yêu cầu" → show `0` or remove
  - "Ngưỡng match" → remove (not in `JobResponse`)
  - Keep: title (link), location, `jobType`, `status` (`StatusBadge`), `createdAt` formatted
- Add a loading skeleton and an error state.
- Invalidation happens in the wizard page after create/publish (see §2).

### 5. Gateway URL prefix handling

The shared axios instance at `packages/api/src/axios-instance.ts` has a `getPrefixedUrl` interceptor that rewrites outgoing request URLs before they hit the gateway:

| Input URL pattern | Rewritten to |
|---|---|
| `/api/jobs*` | `/job/api/jobs*` |
| `/api/home*` | `/job/api/home*` |
| `/api/users*`, `/api/auth*`, `/api/candidates*`, etc. | `/user/api/...` |
| `/api/applications*`, `/api/assessments*` | `/application/api/...` |

**Implication for job hooks:** The generated hooks in `packages/api/src/generated/job/job-controller/job-controller.ts` use paths like `/api/jobs`, `/api/jobs/my`, `/api/jobs/{id}/publish` — the interceptor rewrites all of these correctly. **Use these hooks directly; no wrapper is needed for job endpoints.**

**Implication for recruiter profile:** `/api/recruiters/me` is NOT in the interceptor rewrite rules. A direct call to `useGetMe1` will fail with 404. Create a single wrapper hook:

```ts
// packages/api/src/recruiter/recruiterProfile.ts
import { useQuery } from '@tanstack/react-query'
import { customInstance } from '../axios-instance'
import type { ApiResponseRecruiterResponse } from '../generated/user/model'

export const useGetRecruiterProfile = () =>
  useQuery({
    queryKey: ['/user/api/recruiters/me'],
    queryFn: ({ signal }) =>
      customInstance<ApiResponseRecruiterResponse>({
        url: '/user/api/recruiters/me',
        method: 'GET',
        signal,
      }),
  })
```

After creating the file, add an export to `packages/api/src/index.ts`:
```ts
export * from './recruiter/recruiterProfile'
```

Then import in the route:
```tsx
import { useGetRecruiterProfile } from '@smart-cv/api'
```

`customInstance` resolves to `Promise<T>` by stripping the Axios envelope (`.then(({ data }) => data)`), so `T` is the raw response body. The API always wraps in `ApiResponse { code, message, data }`, making the access path `profileData?.data?.companyName`.

### 6. Query invalidation

After any successful create or publish, invalidate using:
```ts
queryClient.invalidateQueries({ queryKey: ['/job/api/jobs/my'], exact: false })
```

Use `exact: false` to match `useGetMyJobs` entries regardless of their `params` argument. Do **not** use `getGetMyJobsQueryKey()` from the generated file — that helper returns `['/api/jobs/my', ...]` (without `/job` prefix), which is a different cache key from what `useGetMyJobs` uses after the interceptor rewrites the URL.

### 7. Auth store — userId available
`frontend/apps/web-recruiter/src/store/useAuthStore.ts`

`useAuthStore` already exposes `isAuthenticated`, `userId`, `signIn`, `signOut`. The JWT cookie is sent automatically by axios (cookie-based), so no manual header injection is needed.

---

## Notes

- The quota display is informational only. The backend's `publishJob` does **not** deduct quota — that is handled by a separate `consumeJobQuota` call in user-service, triggered outside this flow. Show `quotaJobPost` to guide the recruiter but do not enforce a blocking gate.
- The AI Screening threshold UI (step 2) and "Bài kiểm tra bắt buộc" have no backend fields — keep them as local UX state, defer integration to a later issue.
- CORS for port 3001 is already allowed in the gateway default config.
