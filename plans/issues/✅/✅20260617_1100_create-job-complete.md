# [Feature] Complete Create Job Feature — AI Screening Backend, Job Management Actions, and Edit Flow

## Overview

The core create-job wizard at `/employer/jobs/new` is functional: controlled form state,
`useCreateJob` → `usePublishJob` chain, draft save, quota check, and query invalidation are all
working. However, three areas remain incomplete:

1. **Step 2 (AI Screening rules) is UI-only** — `qualifiedThreshold`, `rejectThreshold`,
   `autoRejectEnabled`, and `requiredTest` are managed in React state but never included in the
   API payload. The `job_service` backend `JobCreateRequest` / `Job` entity has no corresponding
   fields.
2. **Jobs list action menu is empty** — the `MoreVertical` (⋮) button in `employer.jobs.index.tsx`
   renders with no `onClick` handler and no dropdown.
3. **No job edit page** — there is no route for revisiting and modifying a saved job.

---

## Reproduction Steps

**Gap 1 — AI Screening not persisted:**
1. Navigate to `/employer/jobs/new`.
2. Complete Step 0 (basic info) and Step 1 (description).
3. On Step 2, set `Ngưỡng đạt` to 80%, `Ngưỡng từ chối` to 40%, enable "Tự động từ chối",
   select "Backend Technical Test".
4. Click "Lưu nháp" or proceed to Step 3 and click "Đăng tin".
5. Inspect the request body of `POST /api/jobs` in the network tab.
   **Observed:** `qualifiedThreshold`, `rejectThreshold`, `autoRejectEnabled`, `requiredTest` are
   absent from the payload.

**Gap 2 — Empty action menu:**
1. Navigate to `/employer/jobs`.
2. Wait for the job list to load.
3. Click the `⋮` (MoreVertical) button on any row.
   **Observed:** Nothing happens — no menu, no modal, no action.

**Gap 3 — No edit route:**
1. From `/employer/jobs`, click any job title.
   **Observed:** Navigates to `/employer/applicants` (generic applicants page). There is no
   `/employer/jobs/$id` route in the router.

---

## Expected Behavior

1. **AI Screening fields are persisted**: the four screening fields are included in
   `buildCreateJobPayload()`, accepted by `POST /api/jobs` and `PUT /api/jobs/{id}`, stored in
   MongoDB, and returned in `JobResponse`.
2. **⋮ menu provides four actions**:
   - **Edit** — navigate to the job edit page (available for DRAFT and ACTIVE jobs).
   - **Publish** — call `PATCH /api/jobs/{id}/publish` (visible for DRAFT jobs only).
   - **Close** — call `PATCH /api/jobs/{id}/close` (visible for ACTIVE jobs only).
   - **Delete** — call `DELETE /api/jobs/{id}` with recruiter ownership check.
3. **Job edit page** (`/employer/jobs/$id`) pre-populates the 4-step form with existing job data
   and submits changes via `PUT /api/jobs/{id}`.

---

## Current Behavior

- `buildCreateJobPayload()` in `frontend/apps/web-recruiter/src/lib/jobForm.ts` does not include
  `qualifiedThreshold`, `rejectThreshold`, `autoRejectEnabled`, or `requiredTest`. The `formValues`
  object at line 113 of `employer.jobs.new.tsx` also omits these four state variables.
- Backend `JobCreateRequest` / `JobUpdateRequest` / `Job` / `JobResponse` have no screening fields.
- `employer.jobs.index.tsx` line 168: `<Button size="sm" variant="ghost"><MoreVertical /></Button>`
  — no `onClick`, no dropdown.
- Job title link at line 154 goes to `/employer/applicants` (hardcoded generic route).
- Default `skills` state at line 95 of `employer.jobs.new.tsx` is pre-filled with
  `["Java", "Spring Boot", "REST API", "MySQL", "Docker"]` — irrelevant dummy data.
- Step 3 preview at line 523 hardcodes `Gói hiện tại: <strong>Pro</strong>`.
- `DELETE /api/jobs/{id}` is `@PreAuthorize("hasRole('ADMIN')")` and `JobService.deleteJob` does
  not call `assertOwner` — both the controller annotation and the service method need changes.

---

## Impact Scope

Backend:
- [ ] api-gateway
- [ ] user-service
- [x] job_service — add 4 screening fields; add `GET /api/jobs/my/{id}` endpoint; extend DELETE to RECRUITER with ownership check
- [ ] application_service
- [ ] ai_engine_service
- [ ] notification-service
- [ ] Infrastructure (Docker / RabbitMQ / MongoDB / Elasticsearch)

Frontend:
- [ ] web-candidate
- [x] web-recruiter — action menu, edit page, form wiring, UX fixes
- [ ] web-admin
- [ ] packages/ui
- [x] packages/api — regenerate after Swagger update; extend `CreateJobPayload` type
- [ ] packages/i18n

---

## Related Code

### Backend: job_service changes

#### 1. Add AI screening fields to DTOs and entity

**`backend/job_service/src/main/java/vn/chuongpl/job_service/dtos/request/JobCreateRequest.java`**

Add four optional fields (all nullable — service layer applies defaults):
```java
private Integer qualifiedThreshold;  // percent 1–100, default 70
private Integer rejectThreshold;     // percent 1–100, default 50
private Boolean autoRejectEnabled;   // default false
private String requiredTest;         // null means no required test
```

**`backend/job_service/src/main/java/vn/chuongpl/job_service/dtos/request/JobUpdateRequest.java`**

Add the same four fields (consistent with the existing `NullValuePropertyMappingStrategy.IGNORE`
mapper — null values are ignored on update).

**`backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/Job.java`** (MongoDB `@Document`)

Add the same four fields. Apply defaults in `JobService.createJob` after the mapper call:
```java
// after: Job job = jobMapper.toJob(request);
if (job.getQualifiedThreshold() == null) job.setQualifiedThreshold(70);
if (job.getRejectThreshold() == null)    job.setRejectThreshold(50);
if (job.getAutoRejectEnabled() == null)  job.setAutoRejectEnabled(false);
// requiredTest stays null if not provided
```

**`backend/job_service/src/main/java/vn/chuongpl/job_service/dtos/response/JobResponse.java`**

Add the same four fields so all endpoints expose them.

**`backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/JobMapper.java`**

MapStruct auto-maps fields with identical names — no explicit mappings needed. Verify the mapper
compiles after adding the fields.

#### 2. Add recruiter-scoped "get my job by ID" endpoint

The existing `GET /api/jobs/{id}` (`JobService.getJobById`) only serves **ACTIVE** jobs and
returns `JOB_NOT_FOUND` for DRAFT, CLOSED, or EXPIRED jobs. The edit page must be able to load
DRAFT jobs, so a new recruiter-scoped endpoint is required.

Add to **`JobController.java`**:
```java
@GetMapping("/my/{id}")
@PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
public ApiResponse<JobResponse> getMyJobById(
    @PathVariable String id,
    @AuthenticationPrincipal String userId,
    Authentication authentication
) {
    boolean isAdmin = authentication.getAuthorities().stream()
        .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    return ApiResponse.<JobResponse>builder()
        .data(jobService.getMyJobById(id, userId, isAdmin))
        .build();
}
```

Add to **`JobService.java`**:
```java
public JobResponse getMyJobById(String id, String userId, boolean isAdmin) {
    Job job = jobRepository.findByIdAndDeletedFalse(id)
        .orElseThrow(() -> new AppException(ErrorCode.JOB_NOT_FOUND));
    assertOwner(job, userId, isAdmin);
    return jobMapper.toJobResponse(job);
}
```

This endpoint returns any status of job as long as the caller is the owner (or admin).
After deploying this endpoint and running `pnpm generate:api`, a `useGetMyJobById(id)` hook will
be available in `@smart-cv/api`. The edit page (`employer.jobs.$id.tsx`) must use this hook, not
`useGetJobById`.

---

#### 3. Extend DELETE to RECRUITER with ownership check

The current code has two separate problems:

**Problem A — controller annotation**

Change the `@PreAuthorize` annotation and add user identity parameters, following the same pattern
as `updateJob`, `publishJob`, and `closeJob` (which use `@AuthenticationPrincipal` + `Authentication`):

```java
// Before
@DeleteMapping("/{id}")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<Void> deleteJob(@PathVariable String id) {

// After
@DeleteMapping("/{id}")
@PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
public ApiResponse<Void> deleteJob(
    @PathVariable String id,
    @AuthenticationPrincipal String userId,
    Authentication authentication
) {
    boolean isAdmin = authentication.getAuthorities().stream()
        .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
    jobService.deleteJob(id, userId, isAdmin);
    return ApiResponse.<Void>builder().build();
}
```

**Problem B — service method does not call `assertOwner`**

The current `JobService.deleteJob` signature is `public void deleteJob(String id)` with no
ownership check. Update the method to accept user context and add the ownership guard:

```java
public void deleteJob(String id, String userId, boolean isAdmin) {
    Job job = jobRepository.findByIdAndDeletedFalse(id)
        .orElseThrow(() -> new AppException(ErrorCode.JOB_NOT_FOUND));
    assertOwner(job, userId, isAdmin);  // throws JOB_NOT_OWNER (2002) if not owner/admin
    // existing soft-delete logic (mark deleted, save)...
}
```

Note: the existing `if (job.isDeleted())` guard is redundant because `findByIdAndDeletedFalse`
already excludes deleted jobs. Keep or remove it as desired.

---

### Frontend: packages/api

**Step 1 — Verify generated hooks and types exist.** Before writing code that imports them, confirm:
```bash
grep -n "useCloseJob\|useDeleteJob\|useUpdateJob\|useGetMyJobById" frontend/packages/api/src/generated/job/job-controller/job-controller.ts
```
Also confirm the `useUpdateJob` `data` parameter type name (it may be `JobUpdateRequest` or a
different generated name):
```bash
grep -n "useUpdateJob" frontend/packages/api/src/generated/job/job-controller/job-controller.ts
```
If any hook is missing, run `pnpm generate:api` from the `frontend/` directory after the backend
Swagger is updated.

**Step 2 — Regenerate after backend changes.**
```bash
cd frontend && pnpm generate:api
```
This updates `packages/api/src/generated/job/model/` to include the four new screening fields in
`JobCreateRequest`, `JobUpdateRequest`, and `JobResponse`.

**Step 3 — Extend `frontend/apps/web-recruiter/src/lib/jobForm.ts`**

`CreateJobPayload` is a hand-written type (not generated). It must remain compatible with both the
generated `JobCreateRequest` (used by `useCreateJob`) and `JobUpdateRequest` (used by
`useUpdateJob`). Since both DTOs will have the same four optional fields, a single payload type
works for both mutation calls.

Add to **`CreateJobFormValues`**:
```ts
qualifiedThreshold: number
rejectThreshold: number
autoRejectEnabled: boolean
requiredTest: string   // "Không" is the sentinel for "no required test"
```

Add to **`CreateJobPayload`**:
```ts
qualifiedThreshold: number
rejectThreshold: number
autoRejectEnabled: boolean
requiredTest?: string   // omit when value is "Không"
```

Update **`buildCreateJobPayload()`**:
```ts
qualifiedThreshold: values.qualifiedThreshold,
rejectThreshold: values.rejectThreshold,
autoRejectEnabled: values.autoRejectEnabled,
requiredTest: values.requiredTest === "Không" ? undefined : values.requiredTest,
```

---

### Frontend: employer.jobs.new.tsx

**1. Wire screening state into `formValues`** (line 113). The four state variables already exist;
add them to the `formValues` object so `buildCreateJobPayload` receives them:
```ts
const formValues = {
  // ...existing fields...
  qualifiedThreshold,
  rejectThreshold,
  autoRejectEnabled,
  requiredTest,
};
```

**2. Remove hardcoded default skills** (line 95):
```ts
// Before
const [skills, setSkills] = useState<string[]>(["Java", "Spring Boot", "REST API", "MySQL", "Docker"]);
// After
const [skills, setSkills] = useState<string[]>([]);
```

**3. Fix hardcoded plan label** (line 523). The recruiter profile does not expose a plan name.
Replace `Gói hiện tại: <strong>Pro</strong>` with a neutral display, e.g.:
```tsx
<div>Quota còn lại: <strong>{isProfileLoading ? "..." : quotaRemaining} tin</strong></div>
```

**4. Error code 2003 handler** (line 253). `JOB_STATUS_INVALID` (code 2003) can be thrown for
reasons other than an expired deadline (e.g., attempting to publish a non-DRAFT job). The current
handler unconditionally sets a deadline field error, which is misleading. Update to check the
error message or show a generic publish failure toast instead:
```ts
// Before
if (error.response?.data?.code === 2003) {
  setErrors((current) => ({ ...current, deadline: "Hạn nộp phải sau ngày hôm nay để đăng tin" }));
  setStep(0);
}
// After — keep the deadline error only if message specifically mentions deadline
if (error.response?.data?.code === 2003) {
  const message = error.response?.data?.message ?? "";
  if (message.toLowerCase().includes("deadline") || message.includes("hạn")) {
    setErrors((current) => ({ ...current, deadline: "Hạn nộp phải sau ngày hôm nay để đăng tin" }));
    setStep(0);
  }
}
```

---

### Frontend: employer.jobs.index.tsx

**1. Implement MoreVertical dropdown**

Add `JobActionsMenu` as an inline component at the bottom of the file:

```tsx
function JobActionsMenu({ job, onMutated }: { job: JobResponse; onMutated: () => void }) {
  const [open, setOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const navigate = useNavigate();
  const publishMutation = usePublishJob();
  const closeMutation = useCloseJob();
  const deleteMutation = useDeleteJob();

  const run = async (action: () => Promise<unknown>) => {
    setIsPending(true);
    setOpen(false);
    try {
      await action();
      onMutated();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } };
      toast.error(e.response?.data?.message ?? "Thao tác thất bại");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="relative">
      <Button size="sm" variant="ghost" disabled={isPending} onClick={() => setOpen((o) => !o)}>
        <MoreVertical className="size-4" />
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-44 rounded-md border border-border bg-popover shadow-md p-1 text-sm">
          <button
            className="w-full text-left px-3 py-1.5 rounded hover:bg-secondary"
            onClick={() => {
              setOpen(false);
              navigate({ to: "/employer/jobs/$id", params: { id: job.id! } });
            }}
          >
            Chỉnh sửa
          </button>
          {job.status === "DRAFT" && (
            <button
              className="w-full text-left px-3 py-1.5 rounded hover:bg-secondary"
              onClick={() => run(() => publishMutation.mutateAsync({ id: job.id! }))}
            >
              Đăng tin
            </button>
          )}
          {job.status === "ACTIVE" && (
            <button
              className="w-full text-left px-3 py-1.5 rounded hover:bg-secondary text-warning"
              onClick={() => run(() => closeMutation.mutateAsync({ id: job.id! }))}
            >
              Đóng tin
            </button>
          )}
          <button
            className="w-full text-left px-3 py-1.5 rounded hover:bg-secondary text-danger"
            onClick={() => {
              if (!window.confirm("Xóa tin này? Hành động không thể hoàn tác.")) return;
              run(() => deleteMutation.mutateAsync({ id: job.id! }));
            }}
          >
            Xóa
          </button>
        </div>
      )}
    </div>
  );
}
```

Note: `window.confirm` is used for delete confirmation. `packages/ui` provides a `Dialog`
component (`packages/ui/src/components/ui/dialog.tsx`) but no pre-built `AlertDialog`. Use
`window.confirm` for now; replace with a composed `Dialog`-based confirmation in a UX polish pass.

Wire it into the table row, passing `onMutated` to trigger list refresh:
```tsx
// In EmployerJobsPage, add:
const invalidate = () =>
  queryClient.invalidateQueries({ queryKey: ["/api/jobs/my"], exact: false });

// In table row's action cell:
<td className="py-3 px-4 text-right">
  <JobActionsMenu job={job} onMutated={invalidate} />
</td>
```

**2. Fix job title link** (line 154):
```tsx
// Before
<Link to="/employer/applicants" className="font-medium hover:text-primary">
// After
<Link to="/employer/jobs/$id" params={{ id: job.id! }} className="font-medium hover:text-primary">
```

---

### Frontend: new route employer.jobs.$id.tsx

Create `frontend/apps/web-recruiter/src/routes/employer.jobs.$id.tsx`.

**Route conflict note**: TanStack Router resolves static segments before dynamic ones, so
`/employer/jobs/new` continues to match the `employer.jobs.new.tsx` route correctly.
`/employer/jobs/$id` only matches when `$id` is not the literal string `"new"`.

**State initialization from fetched data**

Use `useGetMyJobById(id)` (the new recruiter-scoped endpoint, see backend §2 above) — NOT
`useGetJobById`, which only returns ACTIVE jobs and will return 404 for DRAFT jobs.

After `pnpm generate:api`, the generated hook name will be `useGetMyJobById` (Orval derives it
from the operationId or method path). Verify the exact name after regeneration.

Use `useEffect` to sync form state once the query returns:

```tsx
const { data, isLoading, isError } = useGetMyJobById(id);
const job = data?.data;

// Initialize form state with empty/default values
const [title, setTitle] = useState("");
const [location, setLocation] = useState("");
// ...all other state variables with empty defaults...
const [qualifiedThreshold, setQualifiedThreshold] = useState(70);
const [rejectThreshold, setRejectThreshold] = useState(50);
const [autoRejectEnabled, setAutoRejectEnabled] = useState(false);
const [requiredTest, setRequiredTest] = useState("Không");
const [initialized, setInitialized] = useState(false);

useEffect(() => {
  if (!job || initialized) return;
  setTitle(job.title ?? "");
  setLocation(job.location ?? "");
  setJobType(job.jobType ?? "");
  setExperienceLevel(job.experienceLevel ?? "");
  setDeadline(job.deadline ?? "");
  setSalaryMin(job.salaryMin != null ? String(job.salaryMin) : "");
  setSalaryMax(job.salaryMax != null ? String(job.salaryMax) : "");
  setIsNegotiable(job.salaryMin == null && job.salaryMax == null);  // use == null, not !value (0 is falsy but not null)
  setDescription(job.description ?? "");
  // JobResponse returns arrays; join to multiline text for the textarea fields
  setRequirementsText((job.requirements ?? []).join("\n"));
  setBenefitsText((job.benefits ?? []).join("\n"));
  setSkills(job.skills ?? []);
  setQualifiedThreshold(job.qualifiedThreshold ?? 70);
  setRejectThreshold(job.rejectThreshold ?? 50);
  setAutoRejectEnabled(job.autoRejectEnabled ?? false);
  setRequiredTest(job.requiredTest ?? "Không");
  setInitialized(true);
}, [job, initialized]);
```

Key transformation: `JobResponse.requirements` and `JobResponse.benefits` are `string[]` but the
form state uses multiline textarea strings — join them with `"\n"` on load; `buildCreateJobPayload`
splits them back to arrays on submit.

**Loading and error states**

```tsx
if (isLoading) return <div className="max-w-4xl mx-auto"><div className="h-96 animate-pulse rounded-xl bg-muted" /></div>;
if (isError) return <div className="max-w-4xl mx-auto card-surface p-6 text-sm text-danger">Không thể tải tin tuyển dụng.</div>;
```

**Read-only guard for CLOSED/EXPIRED**

After loading, if `job.status === "CLOSED" || job.status === "EXPIRED"`, render a read-only
banner at the top of the form and disable all inputs and action buttons:
```tsx
const isReadOnly = job?.status === "CLOSED" || job?.status === "EXPIRED";
```

Pass `isReadOnly` to the form inputs to add `disabled` where applicable, or overlay the entire
form with a translucent banner:
```tsx
{isReadOnly && (
  <div className="card-surface p-4 text-sm text-warning border border-warning/30">
    Tin tuyển dụng này đã {job.status === "CLOSED" ? "đóng" : "hết hạn"} và không thể chỉnh sửa.
  </div>
)}
```

**Submit handlers**

The edit page always uses `updateJobMutation` (`PUT /api/jobs/{id}`), never `createJobMutation`.
The `draftJobId` concept does not apply — `id` comes from the route param:

```tsx
const updateJobMutation = useUpdateJob();
const publishJobMutation = usePublishJob();

const handleSave = async () => {
  if (!validateCurrentStep()) return; // reuse same validation logic
  try {
    // buildCreateJobPayload returns CreateJobPayload (hand-written type).
    // Cast to the generated JobUpdateRequest type — all fields are optional in JobUpdateRequest
    // so the cast is safe. Verify after regeneration that no new required fields were added.
    await updateJobMutation.mutateAsync({ id, data: buildCreateJobPayload(formValues) as JobUpdateRequest });
    toast.success("Đã lưu thay đổi");
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    toast.error(e.response?.data?.message ?? "Lưu thất bại");
  }
};

const handlePublish = async () => {
  try {
    await updateJobMutation.mutateAsync({ id, data: buildCreateJobPayload(formValues) as JobUpdateRequest });
    await publishJobMutation.mutateAsync({ id });
    await queryClient.invalidateQueries({ queryKey: ["/api/jobs/my"], exact: false });
    toast.success("Đăng tin thành công");
    navigate({ to: "/employer/jobs" });
  } catch (err: unknown) {
    const e = err as { response?: { data?: { message?: string } } };
    toast.error(e.response?.data?.message ?? "Đăng tin thất bại");
  }
};
```

Show "Lưu thay đổi" button at all steps (not just step 3). Show "Đăng tin" button only on step 3
and only when `job.status === "DRAFT"`.

**Form body reuse**

The 4-step form JSX in `NewJob` is ~500 lines. Rather than duplicating it verbatim in `EditJob`,
extract the step content into a single `JobFormStepContent` component that accepts all controlled
state as props. The caller (`NewJob` or `EditJob`) owns the state and passes values + setters down.

Minimal prop interface:
```ts
type JobFormStepContentProps = {
  step: number;
  // step 0 fields
  title: string; onTitleChange: (v: string) => void; errors: CreateJobFormErrors & { deadline?: string };
  location: string; onLocationChange: (v: string) => void;
  jobType: string; onJobTypeChange: (v: string) => void;
  deadline: string; onDeadlineChange: (v: string) => void;
  isNegotiable: boolean; onIsNegotiableChange: (v: boolean) => void;
  salaryMin: string; onSalaryMinChange: (v: string) => void;
  salaryMax: string; onSalaryMaxChange: (v: string) => void;
  // step 1 fields
  description: string; onDescriptionChange: (v: string) => void;
  requirementsText: string; onRequirementsTextChange: (v: string) => void;
  benefitsText: string; onBenefitsTextChange: (v: string) => void;
  experienceLevel: string; onExperienceLevelChange: (v: string) => void;
  skills: string[]; onSkillsChange: (v: string[]) => void;
  // step 2 fields
  qualifiedThreshold: number; onQualifiedThresholdChange: (v: number) => void;
  rejectThreshold: number; onRejectThresholdChange: (v: number) => void;
  autoRejectEnabled: boolean; onAutoRejectEnabledChange: (v: boolean) => void;
  requiredTest: string; onRequiredTestChange: (v: string) => void;
  // step 3 (preview) — renders a summary of the whole form, so it reads props from all earlier
  // steps (title, location, jobType, salary, skills, deadline, etc.) directly. No additional
  // step-3-specific props are needed beyond these three.
  companyName: string;
  isProfileLoading: boolean;
  quotaRemaining: number;
};
```

This is verbose but fully typed. Alternative: pass a single `state` object + `onStateChange`
dispatcher — acceptable if the team prefers it, but less discoverable.

---

## Notes

- `requiredTest` is stored as a plain `String` (assessment name). A future issue should link it
  to an actual assessment entity from `application_service`; for now a string is sufficient.
- After the backend adds the screening fields, Orval regeneration is required (`pnpm generate:api`)
  **before** frontend type-checking against the new `JobCreateRequest` / `JobUpdateRequest` will
  pass. The TypeScript build will error until regeneration is done.
- `buildCreateJobPayload` returns `CreateJobPayload` (a hand-written type). After regeneration,
  verify that `CreateJobPayload` remains assignable to the generated `JobCreateRequest` and
  `JobUpdateRequest` types. If the generated types add required fields beyond what `CreateJobPayload`
  covers, update the hand-written type accordingly.
- Closing the MoreVertical dropdown when clicking outside is not specified; implement basic
  toggle-on-click as shown. Add a click-outside listener in a later UX polish pass.
