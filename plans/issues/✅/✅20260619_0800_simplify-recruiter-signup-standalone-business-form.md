# Simplify Recruiter Signup: Remove Company Name, Add Standalone Business Registration Form

## Overview

The current recruiter signup flow has two problems:

1. **Company name is collected during user registration** — the `/signup/recruiter` form asks for `companyName` along with personal info. Recruiters should register as a user first (personal info only), then fill in business details as a dedicated step.

2. **The business profile form (`/employer/setup`) renders inside the `DashboardLayout`** — the sidebar and nav are visible while the recruiter is still onboarding. Setup should be a standalone full-screen page (left: form, right: branding panel), visually matching `/signup/recruiter`.

## Current Behavior

1. `/signup/recruiter` shows 5 fields: company name, full name, email, phone, password.
2. After OTP verify → navigate to `/employer/setup`.
3. `/employer/setup` is a child of `employer.tsx` whose `EmployerLayoutRoute` component always renders `DashboardLayout` → sidebar and top nav are visible while the recruiter fills business info.
4. After "Submit for approval" → toast + navigate to `/employer/pending`.
5. Before APPROVED, the loader redirects to `/employer/setup` or `/employer/pending`.

## Expected Behavior

1. `/signup/recruiter` shows 4 fields: full name, email, phone, password (no company name).
2. After OTP verify → navigate to `/employer/setup`.
3. `/employer/setup` renders as a standalone full-screen split-panel page (no sidebar). Left panel: form. Right panel: branding. Same visual structure as `/signup/recruiter`.
4. A PENDING recruiter who navigates back to `/employer/setup` sees a "profile under review" notice — not an editable form.
5. A REJECTED recruiter sees the rejection note at the top, then the editable form to correct and re-submit.
6. After submitting business info → show toast `"Hồ sơ đã được gửi để phê duyệt!"` → navigate to `/employer/pending`.
7. Before APPROVED, recruiter cannot access the dashboard (existing gate unchanged).

## Reproduction Steps

1. Navigate to `http://localhost:3001/signup/recruiter`.
2. Observe "Company Name" field in the signup form.
3. Complete registration + OTP verify.
4. Observe `/employer/setup` renders with dashboard sidebar visible.

## Impact Scope

Backend:
- [ ] api-gateway
- [x] user-service — `RegisterRequest.companyName` has no `@NotBlank`. Passing null creates a DRAFT profile with no company name — already handled. **No backend code changes required.**
- [ ] job_service
- [ ] application_service
- [ ] ai_engine_service
- [ ] notification-service
- [ ] Infrastructure

Frontend:
- [ ] web-candidate
- [x] web-recruiter
- [ ] web-admin
- [ ] packages/ui
- [ ] packages/api
- [ ] packages/i18n

## Related Code — Files to Change

---

### 1. `frontend/apps/web-recruiter/src/lib/recruiterAuth.ts`

Remove `companyName` from the `RecruiterSignupValues` interface and from the returned object in `buildRecruiterRegistrationPayload`.

**Before:**
```ts
interface RecruiterSignupValues {
  companyName: string
  fullname: string
  email: string
  phone: string
  password?: string
}

export function buildRecruiterRegistrationPayload(values: RecruiterSignupValues) {
  return {
    companyName: values.companyName.trim(),
    fullname: values.fullname.trim(),
    email: values.email.trim(),
    password: values.password ?? '',
    phone: values.phone.trim(),
    preferredVerification: 'EMAIL' as const,
    role: 'RECRUITER',
  }
}
```

**After:**
```ts
interface RecruiterSignupValues {
  fullname: string
  email: string
  phone: string
  password?: string
}

export function buildRecruiterRegistrationPayload(values: RecruiterSignupValues) {
  return {
    fullname: values.fullname.trim(),
    email: values.email.trim(),
    password: values.password ?? '',
    phone: values.phone.trim(),
    preferredVerification: 'EMAIL' as const,
    role: 'RECRUITER',
  }
}
```

---

### 2. `frontend/apps/web-recruiter/src/routes/signup.recruiter.tsx`

Four separate removal points:

**a) Remove `companyName` state** (current line ~42):
```ts
// Remove this line:
const [companyName, setCompanyName] = useState("FPT Software")
```

**b) Remove `companyName` from the blank-check in `handleSignup`** (current line ~87):
```ts
// Before:
if (!companyName.trim() || !fullname.trim() || ...)
// After:
if (!fullname.trim() || ...)
```

**c) Remove the Company Name input group** (the `<div>` containing the `<Building2>` icon input). Also remove the `Building2` import from `lucide-react` if it's only used there.

**d) Remove the entire `RecruiterApi.create(...)` try/catch block** from `handleOtpSubmit` (the block that calls `RecruiterApi.create({ userId, companyName: companyName.trim() })`). Also remove the `useAuthStore.getState().userId` line immediately preceding it, since it's only used by that block.

**e) Update the call to `buildRecruiterRegistrationPayload(...)`** — remove `companyName` from the argument:
```ts
// Before:
buildRecruiterRegistrationPayload({ companyName, fullname, email, phone, password })
// After:
buildRecruiterRegistrationPayload({ fullname, email, phone, password })
```

---

### 3. `frontend/apps/web-recruiter/src/routes/-recruiterAuth.test.ts` (or similar test file)

This test file contains a test `"includes companyName in the registration payload"` that passes `companyName` to `buildRecruiterRegistrationPayload` and asserts it appears in the output. After removing `companyName` from `RecruiterSignupValues`, this test will fail TypeScript compilation. Update the test:
- Remove `companyName` from the input object.
- Remove the `companyName` assertion from the expected output.

---

### 4. `frontend/apps/web-recruiter/src/routes/employer.tsx`

The `EmployerLayoutRoute` component currently always renders `DashboardLayout`. Add a path-based guard to return a bare `<Outlet />` for gate paths. **All hooks must be called unconditionally before any conditional return** (Rules of Hooks).

`GATE_PATHS` is already defined at module scope as `["/employer/setup", "/employer/pending"]` — `/employer/setup` is already included. No change to that constant.

```tsx
import {
  createFileRoute,
  redirect,       // keep — used in beforeLoad
  Outlet,         // add
  useRouterState, // add
} from "@tanstack/react-router";

function EmployerLayoutRoute() {
  // All hooks unconditionally at the top
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { t } = useTranslation();
  const { data } = RecruiterApi.useGetMe1();
  const recruiter = data?.data;

  // Conditional render AFTER all hooks
  const isGatePath = GATE_PATHS.some((p) => pathname.startsWith(p));
  if (isGatePath) {
    return <Outlet />;
  }

  const nav: NavItem[] = [
    // ... existing nav items, unchanged ...
  ];

  return (
    <DashboardLayout
      role="employer"
      nav={nav}
      userName={recruiter?.contactName ?? recruiter?.fullName ?? ""}
      userRole={recruiter?.companyName ?? ""}
    />
  );
}
```

Note: `RecruiterApi.useGetMe1()` is still called for gate paths (hook is unconditional), but TanStack Query deduplicates and caches the request — the result is simply unused when `isGatePath` is true.

After this change, both `/employer/setup` and `/employer/pending` render without the `DashboardLayout` wrapper. `employer.pending.tsx`'s existing full-screen content will now display correctly (without a sidebar around it).

---

### 5. `frontend/apps/web-recruiter/src/routes/employer.setup.tsx`

Redesign to a standalone full-screen split-panel layout matching `signup.recruiter.tsx`. The form field logic, mutations (`useUpdate`, `useSubmitForApproval`, `useUploadBusinessLicense`), and submit error handling remain equivalent to the current implementation.

**Key additions to the component body:**
```tsx
const status = recruiter?.status   // derive status from recruiter
const isApproved = status === 'APPROVED'
```

**Status-based content branching** (after `isLoading` check):

| Status | Content rendered |
|--------|-----------------|
| `undefined` / `null` (loading complete, no data) | Loading spinner (fallback) |
| `'PENDING'` | "Profile under review" notice + link to `/employer/pending` |
| `'DRAFT'` | Full editable form |
| `'REJECTED'` | Rejection note (red alert) + full editable form below |
| `'APPROVED'` | Amber "contact support" banner + disabled form + "Về trang quản lý" link |

**Full layout structure:**
```tsx
<div className="min-h-screen grid lg:grid-cols-2 bg-background">
  {/* Left panel — form */}
  <div className="flex flex-col px-6 lg:px-16 py-10">
    {/* SmartCV logo at top */}
    <Link to="/" className="flex items-center gap-2">
      <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="size-4" />
      </div>
      <span className="font-bold text-lg">SmartCV</span>
    </Link>

    {/* Loading state */}
    {isLoading || !status ? (
      <div className="flex-1 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    ) : status === 'PENDING' ? (
      /* PENDING notice — cannot re-submit while under review */
      <div className="flex-1 flex items-center justify-center">
        <div className="max-w-md w-full text-center space-y-4">
          <Clock className="size-12 mx-auto text-primary" />
          <p className="text-lg font-semibold">Hồ sơ đang chờ phê duyệt</p>
          <p className="text-sm text-muted-foreground">
            Quản trị viên sẽ xem xét trong 1–2 ngày làm việc.
          </p>
          <Link to="/employer/pending" className={buttonVariants()}>Xem trạng thái</Link>
        </div>
      </div>
    ) : (
      /* DRAFT / REJECTED / APPROVED — show form */
      <div className="flex-1 flex items-center">
        <div className="w-full max-w-lg mx-auto py-8">
          <h1 className="text-3xl font-bold">Hoàn thiện hồ sơ công ty</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Điền đầy đủ để được phê duyệt đăng tuyển dụng.
          </p>

          {/* APPROVED banner */}
          {isApproved && (
            <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <AlertCircle className="size-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-amber-800">
                  Tài khoản đã được xác minh. Để thay đổi, liên hệ{" "}
                  <a href="mailto:support@smartcv.vn" className="underline font-medium">
                    support@smartcv.vn
                  </a>.
                </p>
                <Link to="/employer" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2")}>
                  Về trang quản lý
                </Link>
              </div>
            </div>
          )}

          {/* REJECTED banner */}
          {status === 'REJECTED' && recruiter?.rejectionNote && (
            <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">Hồ sơ bị từ chối:</p>
              <p className="text-sm mt-1">{recruiter.rejectionNote}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Same sections as current implementation */}
            {/* Company info, Business license, HR contact */}
            {/* All fields disabled when isApproved */}
            {/* Submit button hidden when isApproved */}
          </form>
        </div>
      </div>
    )}
  </div>

  {/* Right panel — branding (hidden on mobile) */}
  <div className="hidden lg:flex items-center justify-center bg-gradient-to-br from-primary via-brand-blue to-ai p-12 text-primary-foreground">
    <div className="max-w-md space-y-3">
      <h2 className="text-3xl font-bold leading-tight">
        Bắt đầu tuyển dụng cùng SmartCV
      </h2>
      <p className="opacity-90">
        Kết nối với hàng ngàn ứng viên tiềm năng. Hồ sơ được xem xét trong 1–2 ngày làm việc.
      </p>
    </div>
  </div>
</div>
```

**Client-side validation before `submitMutation.mutateAsync()`:**

Check all required fields in `form` state are non-empty: `companyName`, `taxCode`, `companyAddress`, `companyCity`, `companySize`, `companyType`, `industry`. Also check that `recruiter?.businessLicenseUrl` is non-null (server-confirmed upload) — this is the source of truth. If `uploadLicenseMutation.isPending` is true when the user hits submit, disable the submit button (already handled by the current disable condition `uploadLicenseMutation.isPending`). If validation fails, call `toast.error(...)` with the specific missing field and `return` before calling the mutations.

**REJECTED re-submit:** Uses the same `submitMutation` (`POST /api/recruiters/me/submit`). The backend `submitForApproval()` already allows re-submission from REJECTED status (transitions REJECTED → PENDING). The existing `businessLicenseUrl` is preserved on the profile record — the recruiter does not need to re-upload unless they want to change it.

**`companyName` field starts empty for new sign-ups** — this is intentional. The field is required (frontend validation + backend code 5004).

---

## Notes

### Backend Profile Creation — No Change Needed

The recruiter profile is created in two backend places, both idempotent:
1. `AuthService.register()` — calls `createBasicProfile(userId, companyName)`. After this change, `companyName` is null in the payload, so a DRAFT profile is created with no company name.
2. `AuthService.verifyRegistration()` — also calls `createBasicProfile(userId)` (no companyName). If a profile already exists, this returns immediately (idempotency guard).

After OTP verify, the frontend stores the access token cookie **before** `navigate({ to: "/employer/setup" })` — no token timing race.

### Cache Invalidation

After submit succeeds and the page navigates to `/employer/pending`, `employer.pending.tsx` calls `useGetMe1()` which fetches fresh data and reflects the new PENDING status. No explicit `queryClient.invalidateQueries()` is needed.

### i18n

No i18n changes required. The `recruiter_company_name` key remains in locale files (reused by the setup form's company name field label). New text on the setup page uses hardcoded Vietnamese strings, consistent with the current implementation.
