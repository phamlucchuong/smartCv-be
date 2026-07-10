# Issue: Job Detail Page — Apply/Save Integration, VND Salary, Company Logo

**File:** `frontend/apps/web-candidate/src/routes/jobs/$jobId.tsx`
**Type:** Feature
**Date:** 2026-06-20

---

## Summary

The job detail page (`/jobs/$jobId`) has four incomplete areas that need real implementations:

1. **Apply button** — currently only toggles local `useState`; no API call is made.
2. **Save/Wishlist button** — same problem; state is lost on page reload and never syncs with the backend.
3. **Salary display** — formatted with a `$` prefix (USD); should be in VND (₫).
4. **Company logo** — hero card and company-info sidebar panel both show a `<Building2>` icon placeholder; the actual logo URL is available via the company API.

---

## Current State

### Apply

```tsx
// $jobId.tsx — line 28, 116, 200, 423
const [applied, setApplied] = React.useState(false)
onClick={() => setApplied((v) => !v)   // no API call
```

### Save

```tsx
// $jobId.tsx — line 29, 107, 213
const [saved, setSaved] = React.useState(false)
onClick={() => setSaved((v) => !v)     // no API call
```

### Salary (lines 82–88, 329, 387–394)

```tsx
const salaryDisplay = `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
// Also in related-jobs cards: `$${rJob.salaryMin.toLocaleString()} - $${rJob.salaryMax.toLocaleString()}`
```

### Company logo (lines 154–156, 350–352)

```tsx
<div className="w-16 h-16 ...">
  <Building2 className="h-6 w-6 text-muted-foreground" />   // hero card placeholder
</div>
// sidebar panel also uses <Building2> — lines 350–352
```

---

## Required Changes

### 1. Apply Integration

**Goal:** clicking "Apply Now" opens a modal where the candidate confirms their uploaded CV, optionally writes a cover letter, then submits via the application service.

**Hooks (flat exports from `@smart-cv/api`):**

| Hook | Purpose |
|---|---|
| `useGetCandidateProfile()` | `GET /api/candidates/me` — returns `CandidateResponse` including `cvUrl: string` (re-export alias for `useGetMe2`) |
| `useGetMyApplicationForJob(jobId)` | `GET /api/applications/by-job/{jobId}/mine` — check if already applied (already in the generated output, exported from `@smart-cv/api`) |
| `useSubmit` | `POST /api/applications` — submit application |

> **Note — 404 handling for `useGetMyApplicationForJob`:** The backend returns a 404 when the candidate has not applied. Since the fetch function cannot be modified (it is generated), handle this at the query options level: pass `retry: false` and check `isError && (error as AxiosError).response?.status === 404` — if true, treat it as "not applied" (`applied = false`) rather than a fatal error. Do not trigger any error toast on a 404 from this specific query.

> **Note — CV data:** Candidates have a single CV stored as `cvUrl` on their profile. There is no multi-CV list endpoint. Retrieve it via `useGetCandidateProfile()` → `data?.data?.cvUrl`. If `cvUrl` is absent, the candidate has not uploaded a CV yet.

**`ApplicationCreateRequest` shape:**

```ts
{ jobId: string; cvUrl: string; coverLetter?: string }
```

**Mutation call pattern (note `data:` wrapper required):**

```ts
submitMutation.mutate({ data: { jobId, cvUrl: candidateCvUrl, coverLetter } })
```

**Implementation steps:**

1. On mount, call `useGetMyApplicationForJob(jobId)` (enabled only when `isAuthenticated && hasCandidateRole(role)`, with `retry: false`). If it returns data, set `applied = true`. **Important:** a 404 means "not applied" — treat `isError` as false, not a fatal error.
2. Add `showApplyModal: boolean` state. All three "Apply Now" button click handlers (hero card line 200, sticky bar line 116, mobile bar line 423) must open the modal — do not toggle `applied` directly.
3. Inside the modal:
   - Call `useGetCandidateProfile()` (enabled when `isAuthenticated && hasCandidateRole(role)`) to get the candidate's `cvUrl`.
   - Show a loading state while the profile is fetching.
   - If `cvUrl` is absent or empty, show a message with a link to `/cv` (the CV upload page) instead of a submit button.
   - If `cvUrl` is present, display the CV filename (derived from the URL) as a read-only confirmation — no selection needed since there is only one CV.
   - Render an optional `<textarea>` for cover letter.
   - On confirm, call `submitMutation.mutate({ data: { jobId, cvUrl: candidateCvUrl, coverLetter } })`.
   - On success: close modal, set `applied = true`.
   - On error: display the error message inside the modal without closing it.
   - Include a cancel/close button that dismisses without submitting.
4. When `applied === true`, all three Apply button placements must show the disabled "Applied" state and be non-clickable.
5. While `useGetMyApplicationForJob` is loading on page mount, keep the Apply button in its neutral (not-applied) appearance to avoid a flash, then update once the query resolves.
6. Guard for unauthenticated users or non-candidate roles: redirect to `/signin` when the Apply button is clicked (consistent with the rest of the app — no in-page prompt exists).

### 2. Save / Wishlist Integration

**Goal:** the Save button reflects actual wishlist state and syncs writes to the backend.

**Hooks (flat exports from `@smart-cv/api`):**

| Hook | Purpose |
|---|---|
| `useContains(jobId)` | `GET /api/wishlists/contains/{jobId}` — returns `boolean` |
| `useSave` | `POST /api/wishlists` with `{ jobId }` |
| `useRemove` | `DELETE /api/wishlists/{jobId}` |

**Mutation call patterns (note asymmetry — `useSave` requires `data:` wrapper, `useRemove` does not):**

```ts
// Save
saveMutation.mutate({ data: { jobId } })

// Remove
removeMutation.mutate({ jobId })
```

**Implementation steps:**

1. Call `useContains(jobId)` (enabled only when `isAuthenticated && hasCandidateRole(role)`). Initialise `saved` from the response once it resolves.
2. While `useContains` is loading, disable the Save button (show neutral state) to prevent a state flash.
3. Replace `setSaved` toggles with an async handler:
   - If `!saved` → call `saveMutation.mutate({ data: { jobId } })` → on success set `saved = true`.
   - If `saved` → call `removeMutation.mutate({ jobId })` → on success set `saved = false`.
4. Disable the button while the mutation is in flight.
5. On error: revert optimistic state.
6. Both the hero card Save button (line ~218) and the sticky bar Save button (line 107) must use this handler.
7. Guard for unauthenticated users or non-candidate roles: redirect to `/signin` when the Save button is clicked.

### 3. Salary Display in VND

**Goal:** replace `$` with `₫` and use VND locale formatting everywhere on the page.

**Helper function to add at the top of the file:**

```ts
function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)
}
```

**Locations to update:**

1. **`salaryDisplay` variable** (lines 82–88) — all branches of the conditional:
   ```ts
   // Before (range)
   `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
   // After (range)
   `${formatVnd(job.salaryMin)} - ${formatVnd(job.salaryMax)}`

   // Before (min-only: "From $X")
   `From $${job.salaryMin.toLocaleString()}`
   // After
   `From ${formatVnd(job.salaryMin)}`

   // Before (max-only: "Up to $X")
   `Up to $${job.salaryMax!.toLocaleString()}`
   // After
   `Up to ${formatVnd(job.salaryMax!)}`
   ```

2. **Related jobs cards** (lines 387–394) — apply the same three-branch replacement for `rJob.salaryMin` / `rJob.salaryMax`.

3. The overview sidebar row (line 328) and mobile sticky bar (line 413) reuse `salaryDisplay`, so they are fixed automatically by step 1.

4. **`DollarSign` icon** — three locations to replace with `<Coins>` or `<Banknote>` from `lucide-react` (or remove entirely if no suitable icon exists), to avoid rendering a dollar-sign glyph next to a VND value:
   - Line 178: hero card salary badge — `<DollarSign className="h-3.5 w-3.5" />` inline next to `{salaryDisplay}`
   - Line ~328: sidebar overview data array — `icon: DollarSign` in the salary row object
   - Line 388: related-jobs salary badge — `<DollarSign className="h-3 w-3" />` inside the salary span

### 4. Company Logo

**Goal:** display the recruiter's company logo in the hero card and the sidebar company-info panel.

**How to get the logo:**

`JobResponse.recruiterId` is the recruiter's user ID (not the company document's `_id`). Use `useGetByRecruiterId` — it calls `GET /api/companies/by-recruiter/{userId}`:

```ts
import { useGetByRecruiterId } from '@smart-cv/api'

const { data: companyData } = useGetByRecruiterId(job.recruiterId ?? '', {
  query: { enabled: !!job.recruiterId },
})
const logoUrl = companyData?.data?.logoUrl
```

Do NOT use `useGetById3` here — that calls `GET /api/companies/{id}` which expects a company `_id`, not a recruiter user ID.

**Locations to update:**

1. **Hero card** (lines 154–156)
2. **Sidebar company panel** (lines 350–352)

```tsx
// Pattern for both places
{logoUrl ? (
  <img src={logoUrl} alt={job.company ?? 'Company logo'} className="w-full h-full object-contain rounded-lg" />
) : (
  <Building2 className="h-5 w-5 text-muted-foreground" />
)}
```

While `useGetByRecruiterId` is loading, keep showing the `<Building2>` placeholder (no layout shift).

---

## Auth Guards

All four features (apply check, save check, apply mutation, save mutation) must be enabled only for authenticated candidates:

```ts
import { hasCandidateRole, useAuthStore } from '../../store/useAuthStore'
const { isAuthenticated, role } = useAuthStore()
// condition: isAuthenticated && hasCandidateRole(role)
```

---

## Acceptance Criteria

- [ ] Clicking "Apply Now" when not logged in (or logged in as a non-candidate) redirects to `/signin`.
- [ ] Clicking "Apply Now" when logged in as a candidate opens a CV confirmation modal.
- [ ] Clicking the Save button when not logged in (or logged in as a non-candidate) redirects to `/signin`.
- [ ] Modal shows a loading state while the candidate profile is fetching.
- [ ] Modal shows a link to `/cv` when the candidate has no CV uploaded (`cvUrl` is absent).
- [ ] Modal displays the candidate's CV and the submit button is enabled only when a CV exists.
- [ ] Modal includes a cancel/close button that does not submit.
- [ ] On successful application, all three Apply button placements (hero card, sticky bar, mobile bar) show "Applied" and are non-clickable.
- [ ] On page load, if the candidate already applied, the Apply button initialises in "Applied" state (from `useGetMyApplicationForJob`).
- [ ] The Save button reflects the actual wishlist state on page load (from `useContains`).
- [ ] Save button is disabled while `useContains` is loading to prevent a state flash.
- [ ] Clicking Save toggles wishlist state and persists it via the wishlist API.
- [ ] Salary is displayed in VND format (`₫`) everywhere on the page, including related-job cards, overview sidebar, and mobile sticky bar.
- [ ] Company logo appears in hero card and sidebar company panel when available; `<Building2>` shown as fallback.
- [ ] No layout shift in company logo areas while the company fetch is in progress.

---

## Files to Change

| File | Change |
|---|---|
| `apps/web-candidate/src/routes/jobs/$jobId.tsx` | All four features above |

No backend changes required — all necessary endpoints already exist and all hooks are already exported from `@smart-cv/api`.
