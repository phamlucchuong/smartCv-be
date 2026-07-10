# [Feature] Job & Company Category System

## Overview

Add a unified `category` field (fixed predefined taxonomy, e.g. "IT & Software", "Finance & Banking") to both `Job` and `Company`. Use it to:

1. **Popular Categories on Home Page** — replace the current `jobType`-based aggregation with real industry categories; link each category card to `/jobs?category=X`.
2. **Category filter in job/company listings** — add a `category` param to job search and replace the free-form `industry` dropdown on the company listing page.
3. **Related jobs by category** — change `getRelatedJobs()` to match by category first, fall back to skills.
4. **Related companies on job detail** — new section "Companies in this category" using a new endpoint `GET /api/jobs/{id}/related-companies`.
5. **Featured companies** — already implemented via application-count sort in `getTopCompanies()`; no additional backend work needed.

---

## Predefined Category Taxonomy

Use the following enum as the single source of truth (defined independently in both services — see duplication note):

| Enum value | Display name |
|---|---|
| `IT_SOFTWARE` | IT & Software |
| `FINANCE_BANKING` | Finance & Banking |
| `MARKETING` | Marketing & Advertising |
| `HEALTHCARE` | Healthcare & Pharma |
| `EDUCATION` | Education & Training |
| `MANUFACTURING` | Manufacturing & Production |
| `RETAIL` | Retail & Consumer Goods |
| `REAL_ESTATE` | Real Estate & Construction |
| `TRANSPORTATION` | Transportation & Logistics |
| `MEDIA_ENTERTAINMENT` | Media & Entertainment |
| `LEGAL_CONSULTING` | Legal & Consulting |
| `HUMAN_RESOURCES` | Human Resources |
| `AGRICULTURE` | Agriculture |
| `ENERGY_ENVIRONMENT` | Energy & Environment |
| `HOSPITALITY_TOURISM` | Hospitality & Tourism |

---

## Reproduction Steps (to verify the current state)

1. Navigate to `http://localhost:3000/` (web-candidate home page).
2. Observe "Popular Categories" section — it shows raw `jobType` enum values (FULL_TIME, PART_TIME, REMOTE, etc.), which are employment types, not industry categories.
3. Navigate to `/jobs` — the filter form has an `industry` dropdown populated dynamically from company data (inconsistent, empty when no companies loaded).
4. Open any job detail page (`/jobs/:id`) — no "companies in this category" section exists.
5. Navigate to `/companies` — `industry` filter is free-form text populated dynamically; no standardized list.
6. On the web-recruiter job creation form — no `category` field; recruiter cannot declare the job's industry category.

## Expected Behavior

1. Popular Categories on home page shows industry categories (IT & Software, Finance & Banking, etc.) with job counts.
2. Each category card links to `/jobs?category=IT_SOFTWARE` (or appropriate enum value).
3. Job listing filter includes a `category` dropdown with the predefined taxonomy.
4. Company listing filter uses the same fixed category list (replacing free-form industry).
5. Job detail page shows a "Companies in this category" section with up to 5 companies.
6. Related jobs section shows jobs in the same category first, then falls back to skill matches.
7. Recruiters can assign a category when creating/editing a job or editing their company profile.

## Current Behavior

1. Home page categories aggregate by `JobType` enum (employment type), not industry.
2. Job listing `industry` filter is client-side derived from company data — breaks when no companies are loaded; inconsistent with backend search.
3. Company listing `industry` filter is free-form; no standardized list.
4. No "Companies in this category" section on job detail.
5. `getRelatedJobs()` uses only skill matching (no category awareness).
6. Job create form and company profile form lack a category field.

---

## Impact Scope

Backend:
- [x] job_service — new enum, new field on Job/JobDocument/JobResponse, updated endpoints and repository
- [x] user-service — new field on Recruiter, updated company endpoints, new internal endpoint, migration changelog
- [x] api-gateway — route allow-list for new endpoint
- [ ] application_service — no changes needed
- [ ] ai_engine_service — no changes needed
- [ ] notification-service — no changes needed
- [ ] Infrastructure (Docker / RabbitMQ / MongoDB) — no infra changes; Elasticsearch index updated via admin re-index endpoint

Frontend:
- [x] web-candidate — home page, jobs listing, job detail, companies listing
- [x] web-recruiter — job create/edit form, company profile edit
- [x] web-admin — job moderation view, company management view
- [x] packages/api — Orval regen + manual `index.ts` export update
- [x] packages/ui — new `categories.ts` constants file + `index.ts` re-export

---

## Related Code

### Backend — job_service

| File | What changes |
|---|---|
| `backend/job_service/src/main/java/vn/chuongpl/job_service/enums/JobCategory.java` | **New** — enum with 15 values listed above; add a comment `// Keep in sync with user-service JobCategory enum` |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/Job.java` | Add `JobCategory category` field |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/JobDocument.java` | Add `@Field(type = FieldType.Keyword) String category` (String, not enum — ES stores the `.name()` value) |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/dtos/response/JobResponse.java` | Add `JobCategory category` field |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/dtos/request/JobCreateRequest.java` | Add `JobCategory category` |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/dtos/request/JobUpdateRequest.java` | Add `JobCategory category` |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/JobMapper.java` | In `toDocument()`: add `@Mapping(target = "category", expression = "java(job.getCategory() == null ? null : job.getCategory().name())")` (enum → String). In `toJobResponse(JobDocument)`: add `@Mapping(target = "category", expression = "java(doc.getCategory() == null ? null : vn.chuongpl.job_service.enums.JobCategory.valueOf(doc.getCategory()))")` (String → enum). In `toJobResponse(Job)`: plain field mapping works without annotation. |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/dtos/request/JobSearchRequest.java` | Add `JobCategory category` |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/integration/elasticsearch/JobIndexService.java:78` | Add `TermQuery` filter on `category` field when `request.getCategory() != null`: `TermQuery.of(t -> t.field("category").value(request.getCategory().name()))._toQuery()` |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/features/home/HomeService.java:82–89` | Change `Aggregation.group("jobType")` → `Aggregation.group("category")`; add `and("category").ne(null)` to the existing match `Criteria` so jobs without a category are excluded from the aggregation (prevents a null-named category appearing in results); update cache key from `home:categories` → `home:categories-v2` to avoid stale Redis hits |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/JobRepository.java` | Add two new Spring Data derived query methods: `findTop5ByCategoryAndModerationStatusAndVisibilityStatusAndIdNotAndDeletedFalse(JobCategory, JobModerationStatus, JobVisibilityStatus, String)` (for related-by-category); the existing `findTop5ByModerationStatusAndVisibilityStatusAndSkillsInAndIdNotAndDeletedFalse` is kept as the skill fallback |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/JobService.java:305` | Update `getRelatedJobs()`: (1) find top 5 jobs by same category using the new repository method; (2) if fewer than 5 found, fill remaining slots with the skill-matched query (existing); deduplicate by ID before returning. Add new method `getRelatedCompanies(String jobId)`: look up the job's `category`, call `userServiceClient.getCompaniesByCategory(category.name(), 5)`, return the result (empty list if job has no category). |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/features/job/JobController.java` | New endpoint `GET /{id}/related-companies` → calls `jobService.getRelatedCompanies(id)` — no auth required (public). New endpoint `POST /admin/jobs/reindex` (`@PreAuthorize("hasRole('ADMIN')")`) → iterates all non-deleted `Job` documents and calls `jobIndexService.indexJob()` for each; returns count of re-indexed documents. |
| `backend/job_service/src/main/java/vn/chuongpl/job_service/integration/userservice/UserServiceClient.java` | New method `getCompaniesByCategory(String category, int limit)` — calls user-service internal endpoint `GET /user/api/internal/recruiters/by-category?category={category}&limit={limit}` |

### Backend — user-service

| File | What changes |
|---|---|
| `backend/user-service/src/main/java/vn/chuongpl/user_service/enums/JobCategory.java` | **New** — same 15-value enum (duplicated; add comment `// Keep in sync with job-service JobCategory enum`) |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/features/recruiter/Recruiter.java` | Add `@Field("category") JobCategory category` field; keep existing `industry` String field — it is NOT removed here (see Notes on lifecycle) |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/dtos/request/RecruiterRequest.java` | Add `JobCategory category` |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/features/company/CompanyResponse.java` | Add `String category` field (serialised enum name for JSON); update `from(Recruiter r)` to set `category = r.getCategory() == null ? null : r.getCategory().name()` |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/features/company/CompanyService.java:31` | `getAll()`: add `String category` param; when non-null, validate via `JobCategory.valueOf(category)` (throw `AppException(ErrorCode.INVALID_CATEGORY)` on `IllegalArgumentException`) and add `.and("category").is(JobCategory.valueOf(category))` to the Criteria; keep the existing `industry` param unchanged for backward compat |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/features/company/CompanyController.java:23` | Add `@RequestParam(required = false) String category` to `getAll()`; pass it through to `companyService.getAll()` |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/features/company/CompanyService.java` | New method `getByCategory(String category, int limit)`: validates and converts to `JobCategory` enum, queries `findByCategoryAndStatusAndDeletedFalse(category, APPROVED)` limited to `limit` results, maps to `CompanyResponse` list |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/features/recruiter/RecruiterRepository.java` | Add new derived query method: `findTop5ByCategoryAndIdNotAndStatusAndDeletedFalse(JobCategory, String, RecruiterStatus)` for `getRelatedCompanies()`; add `findByCategoryAndStatusAndDeletedFalse(JobCategory, RecruiterStatus, org.springframework.data.domain.Pageable)` for `getByCategory()` |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/features/company/CompanyService.java:71` | `getRelatedCompanies()`: switch from `findTop5ByIndustryAndIdNotAndStatusAndDeletedFalse(industry, ...)` to `findTop5ByCategoryAndIdNotAndStatusAndDeletedFalse(category, ...)` |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/features/recruiter/InternalRecruiterController.java` | New endpoint `GET /api/internal/recruiters/by-category?category={category}&limit={limit}` → calls `companyService.getByCategory(category, limit)`; secured with the existing internal-auth filter |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/dtos/response/RecruiterResponse.java` | Add `String category` field (serialised enum name); update the factory/mapping method that constructs `RecruiterResponse` from `Recruiter` to include `category = r.getCategory() == null ? null : r.getCategory().name()`. This ensures the web-recruiter form can display the saved category value on reload. |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/enums/ErrorCode.java` | Add `INVALID_CATEGORY(4XX, "Invalid job category value")` constant (use next available HTTP-4xx code) |
| `backend/user-service/src/main/java/vn/chuongpl/user_service/configuration/changelog/V1_015__Migrate_industry_to_category.java` | **New Mongock changelog** — iterates all `Recruiter` documents with `category == null` and a non-blank `industry`; maps known strings to nearest `JobCategory` enum value (e.g. "Công nghệ thông tin" / "Technology" / "IT" → `IT_SOFTWARE`); unmapped values leave `category` as `null`. |

### Backend — api-gateway

| File | What changes |
|---|---|
| `backend/api-gateway/src/main/resources/application.yaml` | Add `GET /job/api/jobs/**/related-companies` to the public allow-list (no auth required) |

### Frontend — packages/ui

| File | What changes |
|---|---|
| `frontend/packages/ui/src/lib/categories.ts` | **New** — defines `JOB_CATEGORY_LABELS: Record<string, string>` mapping all 15 enum string keys to display names (e.g. `{ IT_SOFTWARE: 'IT & Software', ... }`). Also export a `JOB_CATEGORY_OPTIONS` array (`{ value: string; label: string }[]`) for use in `<Select>` components. All consumer apps import from `@smart-cv/ui` — no copy-paste per file. |
| `frontend/packages/ui/src/index.ts` | Add `export { JOB_CATEGORY_LABELS, JOB_CATEGORY_OPTIONS } from './lib/categories'` so consumer apps can import via `@smart-cv/ui`. |

### Frontend — packages/api

| File | What changes |
|---|---|
| Re-run Orval (`pnpm -F @smart-cv/api generate`) after backend OpenAPI spec is updated | Regenerates all files under `packages/api/src/generated/` including `JobCategory` enum type, updated `JobResponse`/`CompanyResponse` types, and new `useGetRelatedCompanies` hook |
| `frontend/packages/api/src/index.ts` | Add explicit export for `JobCategory` type: `export type { JobCategory } from './generated/job/model'` (it will not be re-exported automatically by existing wildcard). Also export `useGetRelatedCompanies` and its companion types when generated. |

### Frontend — web-candidate

> **Dependency note:** The `category` param changes to `useSearchJobs()` and `useGetAll3()` require the Orval-regenerated types to be committed first. Do not attempt these frontend changes before the backend OpenAPI update and regen step is merged.

| File | What changes |
|---|---|
| `frontend/apps/web-candidate/src/routes/index.tsx:40–46` | Replace inline `JOB_TYPE_LABELS` map with import of `JOB_CATEGORY_LABELS` from `@smart-cv/ui` |
| `frontend/apps/web-candidate/src/routes/index.tsx:391–396` | Category cards: use `JOB_CATEGORY_LABELS[category.name]` for display; wrap card in `<Link to="/jobs" search={{ category: category.name }}>` |
| `frontend/apps/web-candidate/src/routes/jobs/index.tsx:13` | Add `category?: string` to route search schema |
| `frontend/apps/web-candidate/src/routes/jobs/index.tsx:208` | Add `<Select name="category">` dropdown using `JOB_CATEGORY_OPTIONS` from `@smart-cv/ui`; pass `category` to `useSearchJobs()` params |
| `frontend/apps/web-candidate/src/routes/jobs/index.tsx:111–123` | Remove client-side dynamic industry derivation from company data; replace with fixed category list from `@smart-cv/ui` |
| `frontend/apps/web-candidate/src/routes/companies/index.tsx:18` | Replace free-form `industry` `<Select>` with `JOB_CATEGORY_OPTIONS` from `@smart-cv/ui`; pass selected value as `category` param to `useGetAll3()` (requires Orval regen) |
| `frontend/apps/web-candidate/src/routes/jobs/$jobId.tsx` | New "Companies in this category" section below related jobs; call `useGetRelatedCompanies(jobId)` and render up to 5 `HomeCompanyCard` (or equivalent) cards |

### Frontend — web-recruiter

| File | What changes |
|---|---|
| Job create/edit form | Add `category` `<Select>` field using `JOB_CATEGORY_OPTIONS` from `@smart-cv/ui`; wire to `JobCreateRequest.category` / `JobUpdateRequest.category` |
| Company profile edit form | Add `category` `<Select>` field using `JOB_CATEGORY_OPTIONS` from `@smart-cv/ui` alongside the existing `industry` free-text input (do not remove `industry`); wire to `RecruiterRequest.category` |

### Frontend — web-admin

| File | What changes |
|---|---|
| Job moderation view | Display `category` field using `JOB_CATEGORY_LABELS[job.category]` from `@smart-cv/ui` |
| Company management/detail view | Display `category` field using `JOB_CATEGORY_LABELS[company.category]` from `@smart-cv/ui` |

---

## Elasticsearch Re-index

Adding `category` as a new keyword field to `JobDocument` requires re-indexing existing ES documents. New/updated jobs will be indexed automatically by `JobIndexService.indexJob()`. For existing jobs:

- Add a new admin-only endpoint `POST /api/admin/jobs/reindex` (auth: `ROLE_ADMIN`) in `JobController` that iterates all non-deleted `Job` documents from MongoDB and calls `jobIndexService.indexJob()` for each. This is a one-time operation and must NOT run at startup (would block startup under load). This endpoint is already listed in the `JobController.java` Related Code row above.

---

## Notes

- **Featured companies**: `getTopCompanies()` in `HomeService` already sorts by total application count — the "featured companies" requirement is fully satisfied with no additional backend work. `TopCompanyResponse` does not need a `category` field in this issue; displaying category on Top Company cards is deferred to a follow-up if needed.
- **`industry` field lifecycle**: The `industry` String field on `Recruiter` is kept permanently as a display/legacy field. It is NOT removed. A follow-up issue should be filed to deprecate and eventually remove it once all recruiters have been migrated to `category`. Do not remove it in this issue's scope.
- **Cache key**: `home:categories` → `home:categories-v2` avoids stale Redis hits when the grouping field changes. Old keys expire per the configured TTL automatically.
- **Orval regen is a commit**: Generated files in `packages/api/src/generated/` are checked in. The regen must be committed as part of the backend-api PR before the frontend PR can land.
- **`industry` filter backward compat**: `GET /api/companies` keeps the existing `industry` param unchanged; `category` is a new additional param. No breaking change.
- **Duplicated enum sync risk**: `JobCategory` is defined independently in both `job_service` and `user_service` (no shared library). Both files must be updated whenever a new category is added. Add a comment in each file referencing the other: `// Keep in sync with <other-service>/enums/JobCategory.java`.
- **`CompanyService.getAll()` category validation**: The `category` param arrives as a raw `String` from HTTP. Call `JobCategory.valueOf(category)` inside a try/catch; throw `AppException(ErrorCode.INVALID_CATEGORY)` (add this error code to `ErrorCode` enum) on invalid input to avoid a 500.
- **`V1_015__Migrate_industry_to_category.java`**: V1_013 and V1_014 are already taken by `Set_package_categories` and `Add_platform_fee_overdue_sent_at` respectively. V1_015 is the correct next sequence number.
