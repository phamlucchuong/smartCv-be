# [Feature] Web Admin: Wire Real Auth API and Unblock Job Moderation

## Overview

The web-admin app (`apps/web-admin`, port 3002) runs on a fully stubbed authentication flow.
The sign-in page sets a hardcoded demo token (`'demo-admin-token'`) in Zustand without calling
any backend API. As a result, every request that requires `ROLE_ADMIN` authorization returns
401/403, making the already-wired job moderation page (`admin.job-moderation.tsx`) non-functional.

Four things must be fixed to unblock end-to-end admin access:
1. Add a Mongock changeset (backend) to mark the seeded admin user as `verified: true`.
2. Wire the sign-in form to `POST /user/api/auth/login` and store the resulting JWT in the `smart_cv_token` cookie.
3. Add a route guard that redirects unauthenticated users to `/signin` and verifies `ROLE_ADMIN`.
4. Decode the JWT after login to populate real user identity (id, email) in the Zustand store.

## Reproduction Steps

1. Start the gateway and user-service (`make run-gateway && make run-user`).
2. Open `http://localhost:3002/signin`.
3. Click "Login" — the app sets `token: 'demo-admin-token'` in memory and navigates to `/admin`.
4. Open `http://localhost:3002/admin/job-moderation`.
5. Observe: every request to `GET /api/jobs/admin/all`, `PATCH /api/jobs/admin/{id}/approve`, or
   `PATCH /api/jobs/admin/{id}/reject` returns **401 Unauthorized** because the token is not a
   valid JWT and no `Authorization` header is sent.
6. Refresh the page — the user remains "logged in" visually (no redirect) but the Zustand store
   resets (no persistence), so `token` is `null` again.

## Expected Behavior

- Submitting valid admin credentials calls `POST /user/api/auth/login` and writes the real JWT
  `token` to the `smart_cv_token` cookie (matching the pattern in web-candidate / web-recruiter
  so the shared Axios interceptor automatically injects the `Authorization` header).
- On page refresh the cookie is still present, so the admin stays logged in.
- Navigating to any `/admin/*` route without a valid `smart_cv_token` cookie redirects to `/signin`.
- After a successful login, `admin.job-moderation.tsx` can approve and reject jobs with no
  additional changes (the hooks are already wired to the shared Axios instance).

## Current Behavior

- `signin.tsx` ignores the email/password inputs; the `<Button>` has an `onClick` (not a
  `<form onSubmit>`) that calls `setAuth({ user: ..., token: 'demo-admin-token' })` — no HTTP call.
- The shared Axios instance (`packages/api/src/axios-instance.ts`) reads the Bearer token
  exclusively from the `smart_cv_token` cookie (`getCookie(ACCESS_COOKIE)`). A token stored only
  in Zustand is invisible to the interceptor and no `Authorization` header is ever sent.
- `admin.tsx` (the `/admin` layout route) has no `beforeLoad` guard.
- The seeded admin user (Mongock changeset `V1_001__Init_role_permission.java`) is built without
  `.verified(true)`. `User` entity defaults to `verified = false`. `AuthService.authenticated()`
  throws `USER_NOT_VERIFIED` for such accounts, so even a corrected login call would fail without
  the backend fix.

## Impact Scope

Backend:
- [x] user-service — add Mongock changeset to set `verified: true` on the seeded admin user
- [ ] api-gateway — no changes needed; JWT filter and routing already work for `ROLE_ADMIN`
- [ ] job_service — no changes needed; approve/reject endpoints are protected by `@PreAuthorize("hasRole('ADMIN')")`
- [ ] application_service
- [ ] ai_engine_service
- [ ] notification-service
- [ ] Infrastructure

Frontend:
- [x] web-admin — `signin.tsx`, `admin.tsx`, `store/auth.ts`
- [ ] web-candidate
- [ ] web-recruiter
- [ ] packages/ui
- [ ] packages/api — `useLoginCandidate` already exported; no changes needed
- [ ] packages/i18n

## Related Code

### Backend — seeded admin user (must fix)

`backend/user-service/src/main/java/.../changelog/V1_001__Init_role_permission.java`:
```java
User admin = User.builder()
    .id("admin-001")
    .email("admin@gmail.com")
    // .verified(true)  ← MISSING; entity defaults to false
    .roles(Set.of("ROLE_ADMIN"))
    .build();
```

`AuthService.authenticated()` (line ~74):
```java
if (!user.isVerified()) {
    // resends OTP and throws USER_NOT_VERIFIED
    throw new AppException(ErrorCode.USER_NOT_VERIFIED);
}
```

Fix: add a new Mongock changeset (e.g. `V1_004__Verify_admin_user.java`) that calls
`db.getCollection("users").updateOne({ email: "admin@gmail.com" }, { $set: { verified: true } })`.
Do **not** modify `V1_001` directly — that changeset may have already run in deployed environments.

### Backend — auth endpoint (no changes)

`POST /user/api/auth/login` (via API gateway at `localhost:8080`):
- Request: `AuthRequest { email: string, password: string }` — field is **`email`**, not `username`
- Response: `AuthResponse { token: string, refreshToken: string, authenticated: boolean }` — field is **`token`**, not `accessToken`
- The `buildScope()` method emits `ROLE_ADMIN` in the JWT scope for admin users; the gateway
  forwards it as `X-User-Scope`; downstream `@PreAuthorize("hasRole('ADMIN')")` guards work.

### Frontend — hook (no changes needed)

`useLoginCandidate` from `@smart-cv/api` (generated `packages/api/src/generated/auth/auth.ts`):
```ts
// Calls POST /user/api/auth/login — the same generic login endpoint used by all roles
// "Candidate" in the name is a naming artifact; web-recruiter already uses this hook for recruiter login
export const useLoginCandidate = (...)
```

### Frontend — Axios interceptor (explains cookie requirement)

`packages/api/src/axios-instance.ts`:
```ts
instance.interceptors.request.use((config) => {
  const token = getCookie(ACCESS_COOKIE)  // reads 'smart_cv_token' cookie
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})
```
The token **must** be written to the `smart_cv_token` cookie after login, not just Zustand state.
Otherwise `useGetAdminJobs`, `useApproveJob`, `useRejectJob` go out without an `Authorization` header.

### Frontend — job moderation hooks (already wired, no changes)

```ts
// admin.job-moderation.tsx already uses these hooks:
useGetAdminJobs({ moderationStatus? })  // GET /api/jobs/admin/all
useApproveJob()                          // PATCH /api/jobs/admin/{id}/approve
useRejectJob()                           // PATCH /api/jobs/admin/{id}/reject — body: { note }
```

## Implementation Plan

### Step 0 — Backend: verify admin user (Mongock changeset)

Add `V1_004__Verify_admin_user.java` in user-service `changelog/`:
```java
@ChangeUnit(id = "V1_004__Verify_admin_user", order = "004", author = "system")
public class V1_004__Verify_admin_user {
    @Execution
    public void execute(MongoDatabase db) {
        db.getCollection("users")
          .updateOne(Filters.eq("email", "admin@gmail.com"),
                     Updates.set("verified", true));
    }

    @RollbackExecution
    public void rollback(MongoDatabase db) {
        db.getCollection("users")
          .updateOne(Filters.eq("email", "admin@gmail.com"),
                     Updates.set("verified", false));
    }
}
```

### Step 1 — Frontend: install dependencies

```bash
pnpm -F web-admin add js-cookie jwt-decode
pnpm -F web-admin add -D @types/js-cookie
```

### Step 2 — Frontend: update auth store (`store/auth.ts`)

Remove the non-persistent store. Keep Zustand for display state only; cookies handle auth transport:

```ts
import { create } from 'zustand'
import Cookies from 'js-cookie'
import { jwtDecode } from 'jwt-decode'

const ACCESS_COOKIE = 'smart_cv_token'
const REFRESH_COOKIE = 'smart_cv_refresh'

interface AuthUser { id: string; email: string }

interface AuthState {
  user: AuthUser | null
  setAuth: (payload: { token: string; refreshToken: string }) => void
  clearAuth: () => void
}

function initUser(): AuthUser | null {
  try {
    const token = Cookies.get(ACCESS_COOKIE)
    if (!token) return null
    const decoded = jwtDecode<{ sub: string; email: string }>(token)
    return { id: decoded.sub, email: decoded.email }
  } catch {
    return null
  }
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: initUser(),
  setAuth: ({ token, refreshToken }) => {
    Cookies.set(ACCESS_COOKIE, token, { sameSite: 'strict' })
    Cookies.set(REFRESH_COOKIE, refreshToken, { sameSite: 'strict' })
    try {
      const decoded = jwtDecode<{ sub: string; email: string }>(token)
      set({ user: { id: decoded.sub, email: decoded.email } })
    } catch {
      set({ user: null })
    }
  },
  clearAuth: () => {
    Cookies.remove(ACCESS_COOKIE)
    Cookies.remove(REFRESH_COOKIE)
    set({ user: null })
  },
}))
```

Note: The existing `auth.test.ts` tests use `useAuthStore.setState(initialState, true)` to reset
the store. After this change, also call `Cookies.remove('smart_cv_token')` and
`Cookies.remove('smart_cv_refresh')` in `beforeEach`/`afterEach` to avoid cookie pollution
between test cases.

### Step 3 — Frontend: wire sign-in form (`signin.tsx`)

Convert the existing `<Button onClick>` pattern to a real `<form onSubmit>`:

```tsx
import { useLoginCandidate } from '@smart-cv/api'
import { useAuthStore } from '@/store/auth'
import { useState } from 'react'

function SigninPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const loginMutation = useLoginCandidate()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      const res = await loginMutation.mutateAsync({
        data: {
          email: fd.get('email') as string,     // ← field name is 'email', not 'username'
          password: fd.get('password') as string,
        },
      })
      const token = res.data?.token ?? ''        // ← field name is 'token', not 'accessToken'
      const refreshToken = res.data?.refreshToken ?? ''
      if (!token) throw new Error('No token received')
      setAuth({ token, refreshToken })
      navigate({ to: '/admin' })
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      setError(msg ?? 'Invalid credentials')
    }
  }

  return (
    <form onSubmit={handleSubmit} ...>
      {/* Add name="email" to the email input, name="password" to the password input */}
      <input name="email" type="email" defaultValue="admin@gmail.com" ... />
      <input name="password" type="password" defaultValue="admin123" ... />
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loginMutation.isPending} className="w-full h-11">
        {loginMutation.isPending ? 'Signing in…' : t('login')}
      </Button>
    </form>
  )
}
```

Key points:
- Wrap content in `<form onSubmit={handleSubmit}>` (currently no `<form>` tag exists).
- Add `name="email"` and `name="password"` to the existing `<input>` elements.
- `AuthRequest` field is **`email`** (not `username`).
- `AuthResponse` token field is **`token`** (not `accessToken` or `accessToken`).
- Disable the button while pending to prevent double-submit.
- Show error message for wrong credentials / network failure.

Also add a reverse guard to prevent authenticated users from seeing the sign-in page:
```tsx
export const Route = createFileRoute('/signin')({
  beforeLoad: () => {
    const token = Cookies.get('smart_cv_token')
    if (token) throw redirect({ to: '/admin' })
  },
  component: SigninPage,
})
```

### Step 4 — Frontend: add route guard (`admin.tsx`)

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import Cookies from 'js-cookie'
import { jwtDecode } from 'jwt-decode'
import { AdminLayout } from '@/components/layouts/AdminLayout'

export const Route = createFileRoute('/admin')({
  beforeLoad: () => {
    const token = Cookies.get('smart_cv_token')
    if (!token) throw redirect({ to: '/signin' })
    try {
      const { scope } = jwtDecode<{ scope: string }>(token)
      if (!scope?.includes('ROLE_ADMIN')) throw redirect({ to: '/signin' })
    } catch {
      throw redirect({ to: '/signin' })
    }
  },
  component: AdminLayout,
})
```

TanStack Router v1 propagates `beforeLoad` from the `/admin` parent to all child routes
(`/admin/job-moderation`, `/admin/users`, etc.) automatically — no per-page guard needed.

### Step 5 — Verify end-to-end

After all changes:
1. Restart user-service to pick up the new Mongock changeset (Mongock runs on startup).
2. Open `http://localhost:3002/signin`.
3. Submit with `admin@gmail.com` / `admin123` (or the password set in the DB).
4. Confirm you land on `/admin` and the `smart_cv_token` cookie is present in DevTools.
5. Open `http://localhost:3002/admin/job-moderation` — job list should load, approve/reject should return 200.
6. Refresh the page — still logged in.
7. Clear the cookie or use an incognito tab — confirm redirect to `/signin`.

## Notes

- **`useLoginCandidate` naming**: Despite the "Candidate" name, this hook calls `POST /user/api/auth/login`
  — the generic login endpoint shared by all roles. Web-recruiter already uses it for recruiter login.
  No separate admin-specific login hook is needed.
- **Admin account credentials**: The seeded account is `admin@gmail.com`. The password is set in the
  Mongock seed script. If it is bcrypt-hashed with a known value (e.g. `admin123`), use that. Otherwise
  check the seed script or reset via the user-service.
- **Zustand persist not used**: Unlike what naive implementations might reach for, the `persist`
  middleware is not used here. Cookies are the auth transport (matching the shared Axios interceptor);
  Zustand holds display state only and is initialised from the cookie on load.
- **Other stubbed admin pages**: `admin.users.tsx`, `admin.rbac.tsx`, `admin.index.tsx` (hardcoded KPIs),
  `admin.audit-logs.tsx`, `admin.packages.tsx`, `admin.payments.tsx`, and `admin.ai-config.tsx` remain
  stubbed — they are out of scope for this issue.
- **Zustand v5 compatibility**: The store uses `create<AuthState>()((set) => ...)` (curried form
  required by v5 when type inference is needed). No `persist` middleware means no v5 persist
  typing concerns.
