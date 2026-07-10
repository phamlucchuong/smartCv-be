# web-candidate: Homepage — Hot Jobs, New Sections, Company Navigation Fix

## Overview

Three separate but related improvements to the web-candidate homepage (`/`):

1. **Featured Jobs section** must display jobs ordered by highest applicant count (not by `createdAt`). Backend currently has no endpoint that sorts by application volume; a new cross-service endpoint or an event-maintained counter is required.
2. **Two new homepage sections** must be added — "All Jobs" and "Company List" — each with a "View All" button that opens the full grid-view listing page (`/jobs` and `/companies` respectively).
3. **Top Companies navigation bug**: clicking "View Profile" passes `recruiterId` (user UUID) as the route param for the company detail page, which expects the user-service company profile UUID — causing the page to fail and fall back to the company list layout.

---

## Reproduction Steps

### Navigation bug (Top Company → wrong page)

1. Start web-candidate dev server and backend services (`make run-job`, `make run-user`).
2. Open `http://localhost:3000`.
3. Scroll to the **Top Companies Spotlight** section.
4. Click **"View Profile"** on any company card.
5. Observe: browser navigates to `/companies/<recruiter-UUID>`, the company detail page calls `useGetById2(recruiterUUID)`, which maps to `GET /api/users/companies/<recruiter-UUID>` — the ID format is wrong, so the page 404s or falls back to the companies list layout.

---

## Expected Behavior

- **Featured Jobs**: shows up to 6 jobs with the highest application counts (hottest). A "View All" button links to `/jobs`.
- **All Jobs section (new)**: shows a preview grid (6 cards) of `GET /api/jobs` results. A "View All" button links to `/jobs`.
- **Company List section (new)**: shows a preview grid (6 cards) of companies. A "View All" button links to `/companies`.
- **All "View All" buttons**: navigate to the respective full-list page which renders results in the existing 3-column grid view.
- **Top Company card → View Profile**: navigates directly to `/companies/<correct-company-profile-UUID>` and renders the company profile page without error.

---

## Current Behavior

- **Featured Jobs**: `useGetFeaturedJobs()` calls `GET /api/home/featured-jobs`, which returns the 6 most recently published jobs sorted by `createdAt DESC` — not by applicant count.
- **All Jobs section**: does not exist on the homepage.
- **Company List section**: does not exist on the homepage.
- **Top Company "View Profile" link**: passes `company.recruiterId` (recruiter's user UUID) as the `companyId` route param. The company detail page calls `useGetById2(recruiterId)` → wrong ID → page fails or redirects to company list.

---

## Impact Scope

Backend:
- [x] job_service — new `GET /api/home/hot-jobs` endpoint + synchronous count lookup
- [x] user-service — new `GET /api/companies/by-recruiter/{recruiterId}` endpoint
- [ ] api-gateway — route must be declared public if not already
- [ ] application_service — no changes needed (synchronous approach used)

Frontend:
- [x] web-candidate — `routes/index.tsx` (add sections, fix navigation, update featured jobs hook)
- [x] packages/api — regenerate or add hooks for new endpoint
- [ ] web-recruiter
- [ ] web-admin
- [ ] packages/ui
- [ ] packages/i18n

---

## Technical Analysis

### 1. Hot Jobs — Backend Gap

**File**: `backend/job_service/src/main/java/vn/chuongpl/job_service/features/home/HomeController.java:34`
**File**: `backend/job_service/src/main/java/vn/chuongpl/job_service/features/home/HomeService.java:101`

`GET /api/home/featured-jobs` sorts by `createdAt DESC`. There is no `applicationCount` field on the `Job` entity, and application data lives in a separate `application_service` database.

**Chosen approach — synchronous cross-service call (MVP):**

`HomeService.getHotJobs()` calls `application_service` synchronously to fetch application counts per job, sorts the results by count descending, takes the top 6, and caches the response with `@Cacheable("home:hot-jobs")`. This is the correct choice for this sprint because:
- The event-based alternative (ApplicationCountChangedEvent via RabbitMQ) requires new queue/exchange declarations in both `application_service` and `job_service` — neither config has any of this infrastructure today.
- The synchronous call is lower risk, delivers the same end result, and the cache (`@Cacheable`) absorbs the latency cost.

The event-based counter can be adopted later if cache invalidation becomes a problem at scale.

**New endpoint:**
```
GET /api/home/hot-jobs
Response: ApiResponse<List<JobResponse>> (top 6 by applicationCount DESC, PUBLISHED+ACTIVE)
Caching: @Cacheable("home:hot-jobs") — same strategy as featured-jobs
```

The existing `GET /api/home/featured-jobs` can remain (top 6 by createdAt) and be used for a separate "Recently Posted" preview, or it can be repurposed. The UI currently labels it "Featured Jobs / Hottest" — rename to avoid confusion.

---

### 2. New Homepage Sections — Frontend

**File**: `frontend/apps/web-candidate/src/routes/index.tsx`

Two sections must be inserted into the JSX after the existing Featured Jobs section. Both hooks must be added to the import statement at the top of `index.tsx`:

```tsx
// Add to existing import from '@smart-cv/api' in index.tsx
import { useGetFeaturedJobs, useGetTopCompanies, useGetStats, useGetCategories,
         useGetTestimonials, useGetResources, useGetFaqs,
         useGetHotJobs,      // new: hot jobs by applicant count
         useGetActiveJobs,   // new: all jobs preview
         useGetAll3,         // new: company list preview
} from '@smart-cv/api'
```

**a) "All Jobs" preview section**

```tsx
// Use existing hook
const { data: allJobsData, isLoading: isAllJobsLoading } = useGetActiveJobs({ page: 0, size: 6 })
const allJobsPreview = allJobsData?.data?.items ?? []
```

Render a 3-column job card grid (same card layout as Featured Jobs). Include:
- Section heading (e.g., "Browse All Jobs" or i18n key)
- Grid of up to 6 cards with loading skeleton
- "View All" button: `<Link to="/jobs">View All Jobs</Link>`

**b) "Company List" preview section**

```tsx
// useGetAll3 is backed by GET /api/companies (paginated)
const { data: companiesData, isLoading: isCompaniesLoading } = useGetAll3({ page: 0, size: 6 })
const companiesPreview = companiesData?.data?.items ?? []
```

Render a 3-column company card grid (same card layout as the `/companies` page). Include:
- Section heading (e.g., "Explore Companies")
- Grid of up to 6 company cards with loading skeleton
- "View All" button: `<Link to="/companies">View All Companies</Link>`

**"View All" button style** (consistent across all sections):
```tsx
<Link to="/jobs" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
  View All <ArrowRight className="h-4 w-4" />
</Link>
```

Also add a "View All" button to the existing **Featured Jobs** section:
```tsx
<Link to="/jobs" /* or /jobs?sort=hot */ ...>View All</Link>
```

---

### 3. Top Company Navigation Bug — Fix

**File**: `frontend/apps/web-candidate/src/routes/index.tsx:360`

```tsx
// CURRENT (broken)
<Link to="/companies/$companyId" params={{ companyId: company.recruiterId ?? '' }}>View Profile</Link>

// ROOT CAUSE
// TopCompanyResponse.recruiterId is the user UUID of the recruiter.
// CompanyDetailPage calls useGetById2(companyId) → GET /api/users/companies/{id}
// The user-service company entity uses its own UUID (company.id), NOT the recruiter's user UUID.
```

**Backend fix (required first):**

Extend `TopCompanyResponse` in `job_service` to include the company profile UUID fetched from `user-service`:

```java
// TopCompanyResponse.java
public class TopCompanyResponse implements Serializable {
    String recruiterId;
    String companyId;   // <-- add: user-service company profile UUID
    String name;
    String location;
    long activeJobCount;
}
```

In `HomeService.getTopCompanies()`, after aggregating by `recruiterId`, call the user-service internal API (or use an event-populated cache) to resolve `recruiterId → company.id`. The user-service already has `GET /api/users/companies` endpoints; add `GET /api/users/companies/by-recruiter/{recruiterId}` if a batch-lookup endpoint does not exist.

**Frontend fix (after backend fix):**

```tsx
// AFTER FIX
<Link to="/companies/$companyId" params={{ companyId: company.companyId ?? '' }}>View Profile</Link>
```

Orval re-generation will pick up the new `companyId` field automatically if the OpenAPI spec is updated.

**Alternative (frontend-only, no backend change):**

If modifying the backend is out-of-scope for this sprint, add a `GET /api/users/companies/by-recruiter/{recruiterId}` endpoint and update the `CompanyDetailPage` to support lookup-by-recruiterId as a fallback, redirecting to the canonical company profile URL once the company UUID is resolved.

---

### 4. New Hook (after Orval regeneration)

For the hot-jobs endpoint, Orval will auto-generate `useGetHotJobs()` once the OpenAPI spec is updated. Until then, a manual hook can be added to `packages/api/src/index.ts`:

```ts
export { useGetHotJobs } from './generated/job/home-controller/home-controller'
```

---

## Implementation Setup (Git Workflow)

Before starting implementation, the developer must:

1. Stash or record the 2 currently modified files on `feat/admin-user-recruiter-manager`:
   - `frontend/apps/web-candidate/src/routes/_account.profile.tsx`
   - `frontend/packages/api/src/index.ts`

2. Pull latest `dev` branch:
   ```bash
   git fetch origin dev
   git checkout dev
   git pull origin dev
   ```

3. Create a new feature branch from `dev`:
   ```bash
   git checkout -b feat/web-candidate-homepage-hotjobs-sections
   ```

4. Cherry-pick or re-apply the 2 stashed files onto the new branch (the changes from the previous issue that are already done but not yet committed to a release branch).

5. Implement backend changes (job_service, user-service if needed).

6. Run Orval to regenerate API hooks:
   ```bash
   pnpm --filter @smart-cv/api orval
   ```

7. Implement frontend changes in `routes/index.tsx`.

8. Test:
   ```bash
   make run-job && make run-user && pnpm -F web-candidate dev
   ```

---

## Related Code

| File | Relevance |
|------|-----------|
| `frontend/apps/web-candidate/src/routes/index.tsx:340–360` | Top Companies section — navigation bug here |
| `frontend/apps/web-candidate/src/routes/index.tsx:55–57` | `useGetTopCompanies()` call |
| `frontend/apps/web-candidate/src/routes/jobs/index.tsx` | "All Jobs" destination page (already exists) |
| `frontend/apps/web-candidate/src/routes/companies.tsx` | "Company List" destination page (already exists) |
| `frontend/packages/api/src/generated/job/home-controller/home-controller.ts` | Generated hooks; will get `useGetHotJobs` after Orval regen |
| `backend/job_service/.../home/HomeController.java:34` | Add `GET /api/home/hot-jobs` here |
| `backend/job_service/.../home/HomeService.java:101` | Implement `getHotJobs()` here |
| `backend/job_service/.../home/TopCompanyResponse.java` | Add `companyId` field |
| `backend/user-service/.../company/CompanyController.java` | Add `GET /api/users/companies/by-recruiter/{recruiterId}` if needed |
| `frontend/apps/web-candidate/src/routes/_account.profile.tsx` | Modified file to carry over to new branch |
| `frontend/packages/api/src/index.ts` | Modified file to carry over to new branch |

## Notes

- This issue is a continuation of `20260619_1430_web-candidate-home-page-real-api.md`; the basic API wiring (white screen fix, loading states, search form navigation) may already be partially done in the 2 stashed files.
- `useGetAll3()` (the company list hook) is backed by a paginated endpoint. The preview section passes `{ page: 0, size: 6 }` so only the first 6 companies load — no client-side slicing needed.
- All section headings and "View All" button text should use i18n keys from `@smart-cv/i18n` (candidate namespace).
