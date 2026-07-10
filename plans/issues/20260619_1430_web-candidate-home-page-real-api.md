# web-candidate: Home Page Real-API Integration

## Overview

The web-candidate home page (`/`) is designed to display live data — featured jobs, top companies, platform stats, and job categories — via the `HomeController` endpoints on `job-service`. The hooks are already wired in `routes/index.tsx` and the backend endpoints exist, but the app currently shows a **white screen** caused by a missing export in `@smart-cv/api`, blocking all rendering. Once unblocked, several data-display gaps remain.

---

## Blocker: White Screen (missing export)

### Symptom

```
Uncaught SyntaxError: The requested module
'/@fs/.../frontend/packages/api/src/index.ts'
does not provide an export named 'useUpdatePreferences'
(at candidatePreferences.ts:6:3)
```

The entire React app fails to mount. Every page is blank.

### Root Cause

`frontend/apps/web-candidate/src/store/candidatePreferences.ts` imports `useUpdatePreferences` from `@smart-cv/api`:

```ts
// candidatePreferences.ts:6
import { useUpdatePreferences, ... } from '@smart-cv/api'
```

The hook is generated at:
`frontend/packages/api/src/generated/user/user-controller/user-controller.ts` (line 235)

But `frontend/packages/api/src/index.ts` only re-exports a single named symbol from that file:

```ts
export { getMe as getRecruiterLoginUser } from './generated/user/user-controller/user-controller';
```

`useUpdatePreferences` is never re-exported, so ES module resolution throws at startup.

### Fix

Add `useUpdatePreferences` (and its companion types) to `index.ts`:

```ts
// in frontend/packages/api/src/index.ts
export {
  useUpdatePreferences,
  getUpdatePreferencesMutationOptions,
  updatePreferences,
} from './generated/user/user-controller/user-controller';
export type {
  UpdatePreferencesMutationResult,
  UpdatePreferencesMutationBody,
  UpdatePreferencesMutationError,
} from './generated/user/user-controller/user-controller';
```

> **Note**: Do NOT switch to `export *` — `user-controller.ts` also exports `getUser`, `updateUser`, `getMe`, `verifyEmail`, `useGetUser`, `useVerifyEmail`, `useGetMe`, etc. These collide with identically-named symbols already exported via `export * from './generated/user/candidate-controller/candidate-controller'`. Only the specific symbols needed should be added as named exports.

### Secondary type error (non-blocking in Vite dev, but should be fixed)

`candidatePreferences.ts` lines 14–15 alias two types that do not exist on `UserModels`:
```ts
// Before — wrong type names
type BackendLanguage = UserModels.PreferenceLanguage   // does not exist
type BackendTheme    = UserModels.PreferenceTheme      // does not exist

// After — correct names from generated/user/model/index.ts
type BackendLanguage = UserModels.PreferencesSettingsLanguage
type BackendTheme    = UserModels.PreferencesSettingsTheme
```

---

## Home Page Data Gaps (after unblocking)

All hooks are already called in `frontend/apps/web-candidate/src/routes/index.tsx`. The gaps are in what the UI renders with the returned data.

### Gap 1: Job Categories show raw enum strings

**File**: `index.tsx` lines 197–228

`HomeService.getCategories()` aggregates jobs by the `JobType` enum (`FULL_TIME`, `PART_TIME`, `REMOTE`, `CONTRACT`, `INTERNSHIP`) and returns that enum value as `JobCategoryResponse.name`. The UI renders `{category.name}` directly, so users see raw enum strings.

**Fix**: Add a display-name mapping in `index.tsx` (or a shared util):

```ts
const JOB_TYPE_LABELS: Record<string, string> = {
  FULL_TIME:   'Full-time',
  PART_TIME:   'Part-time',
  REMOTE:      'Remote',
  CONTRACT:    'Contract',
  INTERNSHIP:  'Internship',
}
```

Use `JOB_TYPE_LABELS[category.name ?? ''] ?? category.name` wherever the category name is rendered.

### Gap 2: Hero banner badge text is hardcoded

**File**: `index.tsx` lines 90–91

```tsx
<div>... 50,000+ việc làm</div>   {/* hardcoded */}
<div>... 200+ doanh nghiệp</div>  {/* hardcoded */}
```

Note: the Platform Stats cards below (lines 169–188) already use `stats?.activeJobs`, `stats?.activeCompanies`, and `stats?.remoteJobs` dynamically — the `stats` hook is wired, only the hero banner badge text remains hardcoded.

Replace with dynamic values, e.g.:

```tsx
<div><CheckCircle2 .../> {stats ? `${stats.activeJobs.toLocaleString()}+ việc làm` : '...'}</div>
<div><CheckCircle2 .../> {stats ? `${stats.activeCompanies.toLocaleString()}+ doanh nghiệp` : '...'}</div>
```

### Gap 3: No loading or empty states

When any hook is in flight, its section renders nothing (or 0). No skeleton loaders are shown for:
- Featured Jobs grid
- Top Companies grid
- Stats cards
- Categories grid

**Fix — step 1**: All seven hook call sites currently destructure only `data`. Extend each to also destructure `isLoading`:

```ts
// Before
const { data: featuredJobsData } = useGetFeaturedJobs()

// After
const { data: featuredJobsData, isLoading: isFeaturedJobsLoading } = useGetFeaturedJobs()
```

Apply the same pattern to all 7 hooks (`useGetTopCompanies`, `useGetStats`, `useGetCategories`, `useGetTestimonials`, `useGetResources`, `useGetFaqs`).

**Fix — step 2**: There is no `Skeleton` component in `@smart-cv/ui`. Use inline `animate-pulse` Tailwind divs as placeholders. Example for the jobs grid:

```tsx
{isFeaturedJobsLoading ? (
  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className="animate-pulse rounded-2xl border border-border p-5 h-48 bg-muted/30" />
    ))}
  </div>
) : paginatedJobs.length === 0 ? (
  <p className="text-muted-foreground text-sm">No featured jobs available right now.</p>
) : (
  /* existing job card grid */
)}
```

Apply equivalent loading and empty-state handling to the Top Companies, Stats cards, and Categories sections.

### Gap 4: Search bar has no navigation

**File**: `index.tsx` lines 149–163

The search `<form>` captures input values but the "Search Jobs" submit does nothing — there is no `onSubmit` handler and no `<Link>` navigation.

**Prerequisite**: A jobs listing route does not exist yet. The route tree only has `/jobs/$jobId` (job detail). Before wiring up the search, create `frontend/apps/web-candidate/src/routes/jobs/index.tsx` with a `validateSearch` schema:

```ts
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const jobsSearchSchema = z.object({
  q: z.string().optional(),
  location: z.string().optional(),
})

export const Route = createFileRoute('/jobs/')({
  validateSearch: jobsSearchSchema,
  component: JobsPage,
})

function JobsPage() {
  const { q, location } = Route.useSearch()
  // TODO: render job listing using useGetActiveJobs({ keyword: q, location })
  return <div>Jobs page — q={q} location={location}</div>
}
```

The TanStack Router Vite plugin auto-regenerates `routeTree.gen.ts` on file save.

**Fix**: Attach an `onSubmit` handler in `index.tsx`:

```tsx
import { useNavigate } from '@tanstack/react-router'

const navigate = useNavigate()

function handleSearch(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault()
  const fd = new FormData(e.currentTarget)
  navigate({ to: '/jobs/', search: { q: fd.get('q') as string || undefined, location: fd.get('location') as string || undefined } })
}
```

Update the `<form>` to use `onSubmit={handleSearch}` and add `name="q"` / `name="location"` to the two `<Input>` elements.

---

## Reproduction Steps

1. Start web-candidate dev server (`pnpm -F web-candidate dev`).
2. Open `http://localhost:3000` in the browser.
3. Observe: white screen; browser console shows `SyntaxError: ... does not provide an export named 'useUpdatePreferences'`.
4. After fixing the export: navigate to `/` again.
5. Observe: Featured Jobs grid, Top Companies, Stats cards are all empty or show 0 because backend services are not returning data visible in the UI.
6. Start backend services (`make compose-up && make run-job`); create at least one PUBLISHED/ACTIVE job in the system.
7. Reload — stats appear but category names display as `FULL_TIME` / `REMOTE` raw strings.

## Expected Behavior

- App loads without white screen.
- Home page renders live counts in hero section and stats cards from `GET /job/api/home/stats`.
- Featured Jobs grid shows the 6 most recently published jobs from `GET /job/api/home/featured-jobs`.
- Top Companies grid shows companies aggregated from published jobs via `GET /job/api/home/top-companies`.
- Job Categories display friendly names (Full-time, Remote, etc.) derived from the `jobType` aggregation.
- Skeleton placeholders appear while any section is loading.
- Search form navigates to job listing page with query params.

## Current Behavior

- White screen; app does not render at all.
- After hypothetical fix of the export: sections render empty; categories show raw enum strings; hero stats remain hardcoded.

---

## Impact Scope

Backend:
- [x] job_service — `HomeController` + `HomeService` already implemented; no backend changes needed
- [ ] api-gateway — no changes needed

Frontend:
- [x] web-candidate — `routes/index.tsx`, `store/candidatePreferences.ts`
- [x] packages/api — `src/index.ts` (missing export)
- [ ] web-recruiter
- [ ] web-admin
- [ ] packages/ui
- [ ] packages/i18n

---

## Related Code

| File | Relevance |
|------|-----------|
| `frontend/apps/web-candidate/src/store/candidatePreferences.ts:6` | Imports `useUpdatePreferences` → triggers white screen |
| `frontend/packages/api/src/index.ts:12` | Missing `useUpdatePreferences` re-export |
| `frontend/packages/api/src/generated/user/user-controller/user-controller.ts:235` | Hook definition |
| `frontend/apps/web-candidate/src/routes/index.tsx:1–423` | Home page — all hooks wired, data-display gaps here |
| `frontend/packages/api/src/generated/job/home-controller/home-controller.ts` | Generated hooks for all `/api/home/*` endpoints |
| `backend/job_service/src/main/java/.../home/HomeController.java` | `@GetMapping("/api/home/...")` — all endpoints implemented |
| `backend/job_service/src/main/java/.../home/HomeService.java` | `getCategories()` groups by `jobType` enum — source of raw strings |
| `frontend/packages/api/src/axios-instance.ts:56–57` | Prefixes `/api/home` URLs with `/job` before gateway |
| `backend/api-gateway/src/main/resources/application.yaml:105` | `GET /job/api/home/**` listed as public route — no auth needed |

## Notes

- `useGetSettings` and `getGetSettingsQueryKey` (also used in `candidatePreferences.ts`) are correctly exported via `export * from './generated/user/candidate-controller/candidate-controller'` — only `useUpdatePreferences` is missing.
- Testimonials, Resources, and FAQs are static lists hardcoded in `HomeService` on the backend — they will render correctly once the white screen is fixed.
- The following sections in `index.tsx` are intentionally static and have no backend API to source them (no changes required):
  - **Hot tech tags** (line 159) — hardcoded `['React', 'Node.js', 'Python', 'Docker', 'Go', 'Kubernetes']`
  - **Salary Insights cards** (lines 330–354) — hardcoded salary ranges for 2026; no salary endpoint exists
  - **"Most Requested Skills" badges** (line 347) — hardcoded skill list
  - **"Avg response time: 36h"** (line 181) — `HomeStatsResponse` has no such field; intentionally static
  - **AI match hero card** (lines 41, 99–137) — decorative demo card; requires AI service endpoint (not yet implemented)
- The companion issue `frontend/docs/issues/20260617_2052_candidate_settings_preferences.md` covers the broader settings/preferences feature; the missing export is a side-effect of that work being partially integrated.
