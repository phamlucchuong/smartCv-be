# Fix CI lint errors — backend Java + all 3 frontend apps

## Overview

CI quality-gate workflows fail on lint for backend Java services and all 3 React apps.
This issue tracks every violation across all affected files so they can be fixed in one pass.

**Hard failures (exit code 1, block CI):**
- Backend: 6 UnusedImports violations across 4 services
- Frontend `web-candidate`: 11 ESLint errors
- Frontend `web-recruiter`: 2 ESLint errors
- Frontend `web-admin`: 1 ESLint error

**Warnings (correctness bugs, fix alongside errors):**
- Frontend `web-candidate`: 2 warnings
- Frontend `web-recruiter`: 2 warnings
- Frontend `web-admin`: 1 warning

---

## Reproduction steps

```bash
# Backend — run per service
cd backend/<service>
./mvnw checkstyle:check \
  -Dcheckstyle.config.location=../tools/checkstyle/checkstyle.xml \
  -Dcheckstyle.consoleOutput=true

# Frontend
cd frontend
pnpm -F web-candidate lint
pnpm -F web-recruiter lint
pnpm -F web-admin lint
```

---

## Part 1 — Backend Java (Checkstyle: UnusedImports)

**Rule:** `UnusedImports` — import present in file but the imported symbol never referenced.  
**Fix for all:** delete the offending import line. IntelliJ: `Ctrl+Alt+O` (Optimize Imports).

| Service | File | Line | Import to delete |
|---------|------|------|-----------------|
| `api-gateway` | `src/test/java/vn/chuongpl/api_gateway/configuration/GatewayJwtUtilsTest.java` | 5 | `import com.nimbusds.jose.Payload;` |
| `job_service` | `src/main/java/vn/chuongpl/job_service/dtos/request/JobCreateRequest.java` | 4 | `import jakarta.validation.constraints.NotNull;` |
| `job_service` | `src/test/java/vn/chuongpl/job_service/features/job/RelatedJobsServiceTest.java` | 22 | `import static org.mockito.ArgumentMatchers.any;` |
| `application_service` | `src/test/java/vn/chuongpl/application_service/features/assessment/AssessmentServiceTest.java` | 11 | `import vn.chuongpl.application_service.dtos.response.AssessmentResultResponse;` |
| `application_service` | `src/test/java/vn/chuongpl/application_service/features/assessment/AssessmentServiceTest.java` | 14 | `import vn.chuongpl.application_service.dtos.response.AttemptStateResponse;` |
| `ai_engine_service` | `src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java` | 17 | `import vn.chuongpl.ai_engine_service.integration.job.JobSummary;` |

`user-service` has no Checkstyle violations.

---

## Part 2 — Frontend `web-recruiter`

### 2-A — ERROR · `employer.applicants.$id.tsx:30`

**Rule:** `@typescript-eslint/no-unused-vars`

`STATUS_COLUMNS` const is declared but only referenced via `typeof` (line 37) — no runtime usage.

**Fix:** Replace with explicit union type and remove the const:
```ts
// Remove:
const STATUS_COLUMNS = ["PENDING", "REVIEWING", "ACCEPTED", "REJECTED", "WITHDRAWN"] as const;
// Replace line 37 with:
type ApplicationStatus = "PENDING" | "REVIEWING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN";
```

---

### 2-B — ERROR · `employer.assessments.tsx:1321`

**Rule:** `@typescript-eslint/no-explicit-any`

```ts
interface CandidateInfoCellProps {
  applications: any[];  // ← error
}
```

**Fix:**
```ts
import type { ApplicationModels } from "@smart-cv/api";

interface CandidateInfoCellProps {
  applications: ApplicationModels.ApplicationDetailResponse[];
}
```

---

### 2-C — WARNING · `employer.assessments.tsx:72`

**Rule:** `react-hooks/exhaustive-deps`

`const jobs = jobsData?.data ?? []` creates new array ref every render, breaking `useMemo` at line 169.

**Fix:**
```ts
const jobs = React.useMemo(() => jobsData?.data ?? [], [jobsData?.data]);
```

---

### 2-D — WARNING · `employer.settings.tsx:36` + `hooks/usePushNotifications.ts:59`

**Rule:** `react-hooks/exhaustive-deps`

`initPushSubscription` is a plain `async function` (recreated every render) missing from `useEffect` deps.

**Fix — Step 1:** In `apps/web-recruiter/src/hooks/usePushNotifications.ts`:
```ts
const initPushSubscription = React.useCallback(async (): Promise<void> => {
  // existing body unchanged
}, []);
```

**Fix — Step 2:** In `employer.settings.tsx`:
```ts
React.useEffect(() => {
  initPushSubscription().then(() => {
    setPushEnabled(localStorage.getItem('smartcv_fcm_token') !== null);
  });
}, [initPushSubscription]);
```

---

## Part 3 — Frontend `web-candidate`

### 3-A — ERROR · `_account.job-suggestions.tsx` and `_account.wishlists.tsx`

**Rule:** `@typescript-eslint/no-explicit-any`

Both files cast `job` to `any` to access `.openings`:
```ts
(job as any)?.openings   // ×3 occurrences in job-suggestions.tsx line 109
(job as any).openings    // ×3 occurrences in wishlists.tsx line 108
```

**Fix:** `openings` exists on the generated `JobResponse` type. Remove the cast:
```ts
job?.openings   // job is already typed as JobResponse
```
Verify the variable is typed as `JobResponse` from `@smart-cv/api`; add explicit type annotation if not inferred.

---

### 3-B — ERROR · `jobs/$jobId.tsx:94`

**Rule:** `@typescript-eslint/no-unused-vars`

`catch (e)` — `e` is never used.

**Fix:**
```ts
// Before
} catch (e) {
// After (TypeScript 4.0+)
} catch {
```

---

### 3-C — ERROR · `jobs/$jobId.tsx:149, 156, 782`

**Rule:** `react-hooks/no-direct-mutation-state` / setState called synchronously inside `useEffect` body without condition.

Three `useEffect` hooks call `setState` unconditionally on mount:
- Line 149: `setApplied(true)`
- Line 156: `setSaved(Boolean(containsData.data))`
- Line 782: `setSelectedCvUrl(defaultCv.url)`

**Fix:** Derive state from existing query data instead of syncing via `useEffect`:
```ts
// Line 149/156 — replace useState + useEffect with derived value
const isApplied = Boolean(appliedData?.data);
const isSaved = Boolean(containsData?.data);

// Line 782 — initialise with useMemo or useState initializer
const [selectedCvUrl, setSelectedCvUrl] = useState(
  () => cvsData?.data?.find(cv => cv.isDefault)?.url ?? ""
);
```

---

### 3-D — ERROR · `signin.tsx:107`

**Rule:** `@typescript-eslint/no-explicit-any`

```ts
err as any
```

**Fix:** Type as `AxiosError` or use a type guard:
```ts
import type { AxiosError } from "axios";

const axiosErr = err as AxiosError;
if (axiosErr.response?.status === 401) { ... }
```

---

### 3-E — WARNING · `_account.settings.tsx:209`

**Rule:** `react-hooks/exhaustive-deps`

Same `initPushSubscription` missing-dep pattern as `web-recruiter`.

**Fix — Step 1:** In `apps/web-candidate/src/hooks/usePushNotifications.ts`, wrap `initPushSubscription` in `useCallback`.

**Fix — Step 2:** In `_account.settings.tsx`:
```ts
}, [initPushSubscription]);
```

---

### 3-F — WARNING · `jobs/$jobId.tsx:775`

**Rule:** `react-hooks/exhaustive-deps`

`const cvList = cvsData?.data ?? []` creates new array ref every render.

**Fix:**
```ts
const cvList = React.useMemo(() => cvsData?.data ?? [], [cvsData?.data]);
```

---

## Part 4 — Frontend `web-admin`

### 4-A — ERROR · `src/components/layouts/AdminLayout.tsx:233`

**Rule:** `@typescript-eslint/no-explicit-any`

```ts
navigate({ to: '/profile' as any })
```

**Fix:** Use the proper TanStack Router route type:
```ts
navigate({ to: '/profile' })
```
If TypeScript complains about the route not being typed, add `'/profile'` to the router's route tree or use `as Route` cast with the correct route type.

---

### 4-B — WARNING · `src/routes/admin.settings.tsx:28`

**Rule:** `react-hooks/exhaustive-deps`

Same `initPushSubscription` missing-dep pattern.

**Fix — Step 1:** In `apps/web-admin/src/hooks/usePushNotifications.ts`, wrap `initPushSubscription` in `useCallback`.

**Fix — Step 2:** In `admin.settings.tsx`:
```ts
}, [initPushSubscription]);
```

---

## Impact scope

Backend:
- [x] api-gateway
- [ ] user-service
- [x] job_service
- [x] application_service
- [x] ai_engine_service
- [ ] notification-service

Frontend:
- [x] web-candidate
- [x] web-recruiter
- [x] web-admin
- [ ] packages/ui
- [ ] packages/api
- [ ] packages/i18n

---

## Related code

| File | Line | Fix |
|------|------|-----|
| `backend/api-gateway/src/test/.../GatewayJwtUtilsTest.java` | 5 | Delete unused import |
| `backend/job_service/src/main/.../JobCreateRequest.java` | 4 | Delete unused import |
| `backend/job_service/src/test/.../RelatedJobsServiceTest.java` | 22 | Delete unused import |
| `backend/application_service/src/test/.../AssessmentServiceTest.java` | 11, 14 | Delete 2 unused imports |
| `backend/ai_engine_service/src/test/.../AnalysisServiceCvFullTest.java` | 17 | Delete unused import |
| `frontend/apps/web-recruiter/src/routes/employer.applicants.$id.tsx` | 30, 37 | Union type replaces const |
| `frontend/apps/web-recruiter/src/routes/employer.assessments.tsx` | 72, 1321 | useMemo + typed prop |
| `frontend/apps/web-recruiter/src/hooks/usePushNotifications.ts` | 59 | useCallback |
| `frontend/apps/web-recruiter/src/routes/employer.settings.tsx` | 36 | Add dep |
| `frontend/apps/web-candidate/src/routes/_account.job-suggestions.tsx` | 109 | Remove any cast |
| `frontend/apps/web-candidate/src/routes/_account.wishlists.tsx` | 108 | Remove any cast |
| `frontend/apps/web-candidate/src/routes/jobs/$jobId.tsx` | 94, 149, 156, 775, 782 | Multiple fixes |
| `frontend/apps/web-candidate/src/routes/signin.tsx` | 107 | AxiosError type |
| `frontend/apps/web-candidate/src/hooks/usePushNotifications.ts` | — | useCallback |
| `frontend/apps/web-candidate/src/routes/_account.settings.tsx` | 209 | Add dep |
| `frontend/apps/web-admin/src/components/layouts/AdminLayout.tsx` | 233 | Remove any cast |
| `frontend/apps/web-admin/src/hooks/usePushNotifications.ts` | — | useCallback |
| `frontend/apps/web-admin/src/routes/admin.settings.tsx` | 28 | Add dep |
