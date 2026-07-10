# Implement real API hooks in web-recruiter signin and signup pages

## Overview

The web-recruiter auth pages are wired to real API hooks at the import level but do not actually call them.
The login page hardcodes mock tokens in cookies and navigates directly; the signup page sends the correct
register/verify/resend calls but is missing a Zustand auth store, drops the `companyName` field silently,
and has no route guard for already-authenticated users.

## Reproduction steps

1. Start web-recruiter (`pnpm -F web-recruiter dev`, port 3001).
2. Open `/login`, enter any email/password, click the continue button.
3. Observe: navigation succeeds with `smart_cv_token=mock-token` set in cookies — the real
   `POST /user/api/auth/login` endpoint is never called.
4. Open `/signup/recruiter`, fill all fields including Company Name, submit.
5. Observe: the register API IS called with `role: "RECRUITER"`, but `companyName` is never sent.
6. After OTP verification succeeds the app navigates to `/login` even though the API response already
   contains a valid `token` + `refreshToken`.

## Expected behavior

- **Login**: `useLoginCandidate` is called with the form values; on success, tokens from
  `result.data?.token` / `result.data?.refreshToken` are persisted to `smart_cv_token` /
  `smart_cv_refresh` cookies (matching the candidate app pattern) and the recruiter is
  navigated to `/employer`.
- **Signup**: `companyName` is either sent in the registration payload (requires backend
  support) or submitted to a separate profile endpoint right after OTP verification; after
  successful verification, the app auto-signs the recruiter in using the tokens returned by
  `verifyCandidateRegistration`, instead of redirecting to `/login`.
- **Route guard**: already-authenticated users who open `/login` are immediately redirected
  to `/employer`.
- **Role enforcement**: after login, the decoded JWT scope is checked; if it does not contain
  `ROLE_RECRUITER`, the user is signed out and shown an error (the backend `buildScope` method
  emits role names prefixed with `ROLE_`, e.g. `ROLE_RECRUITER`).

## Current behavior

### `frontend/apps/web-recruiter/src/routes/login.tsx`

```ts
// loginMutation declared but never called
const loginMutation = useLoginCandidate();

const loginRecruiter = async () => {
  // Temporarily bypass login hook and navigate directly
  document.cookie = `smart_cv_token=mock-token; Max-Age=86400; path=/; SameSite=Lax`;
  document.cookie = `smart_cv_refresh=mock-refresh; Max-Age=604800; path=/; SameSite=Lax`;
  toast.success(t("recruiter_login_success"));
  navigate({ to: "/employer" });
};
```

`loginMutation.isPending` is used to disable the button, but the mutation is never fired.

### `frontend/apps/web-recruiter/src/routes/signup.recruiter.tsx`

`useRegisterCandidate`, `useVerifyCandidateRegistration`, and `useResendRegistrationOtp` are
called correctly, but:
- The `RegisterRequest` model (frontend-generated) has no `companyName` field; the value collected
  in the form state is silently dropped.
- After `verifyCandidateRegistration` succeeds the page navigates to `/login` instead of
  auto-signing in. The `mutateAsync()` return value is also discarded (not assigned to a
  variable), so the tokens it contains are never accessible. Fix: capture the result and
  call `signIn(result.data.token, result.data.refreshToken)`.
  Note: `customInstance` in `axios-instance.ts` resolves to the full API envelope
  (`{ code, message, data: { token, refreshToken, authenticated } }`), so the correct access
  path is `result.data?.token` (not `result?.token`).

### Missing: Zustand auth store for web-recruiter

`web-candidate` has `src/store/useAuthStore.ts` which:
- reads initial auth state from the `smart_cv_token` cookie on mount,
- exposes `signIn(accessToken, refreshToken)` (sets cookies + decodes JWT),
- exposes `signOut()` (removes cookies, clears state).

`web-recruiter` has only `useRecruiterStore` (theme + sidebar — no auth state).
Without an equivalent auth store, login token persistence is ad-hoc and route guards cannot
check `isAuthenticated`.

## Impact scope

Backend:
- [ ] api-gateway
- [x] user-service — may need to accept `companyName` in `RegisterRequest` for RECRUITER role, or
  expose a separate endpoint to set recruiter profile immediately after registration
- [ ] job_service
- [ ] application_service
- [ ] ai_engine_service
- [ ] notification-service
- [ ] Infrastructure

Frontend:
- [ ] web-candidate
- [x] web-recruiter — `src/routes/login.tsx`, `src/routes/signup.recruiter.tsx`, new `src/store/useAuthStore.ts`
- [ ] web-admin
- [ ] packages/ui
- [ ] packages/api — `RegisterRequest` model may need `companyName?: string` (if backend is extended)
- [ ] packages/i18n

## Related code

| File | Issue |
|------|-------|
| `frontend/apps/web-recruiter/src/routes/login.tsx:24–35` | Mock bypass, `loginMutation` never called |
| `frontend/apps/web-recruiter/src/routes/login.tsx:22` | `useLoginCandidate` imported but unused |
| `frontend/apps/web-recruiter/src/routes/signup.recruiter.tsx:26–31` | `companyName` state captured but not in `RegisterRequest` |
| `frontend/apps/web-recruiter/src/routes/signup.recruiter.tsx:91–101` | `registerMutation.mutateAsync` — missing `companyName` |
| `frontend/apps/web-recruiter/src/routes/signup.recruiter.tsx:138–157` | `verifyMutation` success: navigates to `/login` instead of auto-login |
| `frontend/apps/web-recruiter/src/store/useRecruiterStore.ts` | No auth state — need a separate `useAuthStore` |
| `frontend/apps/web-candidate/src/store/useAuthStore.ts` | Reference implementation |
| `frontend/apps/web-candidate/src/routes/signin.tsx:19–24` | Reference for `beforeLoad` guard + `signIn` call pattern |
| `frontend/packages/api/src/generated/model/registerRequest.ts` | No `companyName` field |
| `backend/user-service/src/.../dtos/request/RecruiterRequest.java` | Has `companyName` — confirm whether register endpoint accepts it |

## Implementation tasks

> **Required order**: steps must be executed in sequence — the store and guard both depend on
> the packages installed in step 0.

0. **Add missing dependencies to `web-recruiter`**:
   ```
   pnpm -F web-recruiter add js-cookie jwt-decode
   pnpm -F web-recruiter add -D @types/js-cookie
   ```

1. **Create `useAuthStore` in web-recruiter** — clone from `web-candidate/src/store/useAuthStore.ts`;
   cookie names (`smart_cv_token`, `smart_cv_refresh`) and JWT decode logic are identical.

2. **Wire real login in `login.tsx`**:
   - The button's `disabled={loginMutation.isPending}` and spinner are already wired correctly;
     only the `loginRecruiter` handler body needs replacing.
   - Remove the mock-cookie block.
   - Call `loginMutation.mutateAsync({ data: { email, password } })`.
   - Extract `result.data?.token` and `result.data?.refreshToken`.
   - Validate `ROLE_RECRUITER` in decoded JWT scope (backend emits `ROLE_<RoleName>`).
   - Call `signIn(accessToken, refreshToken)` from the new auth store.
   - Navigate to `/employer`.
   - Add `beforeLoad` guard: redirect to `/employer` if `smart_cv_token` cookie exists.
     Must use `throw redirect({ to: '/employer' })` — TanStack Router silently ignores a plain
     `return redirect(...)` without `throw`.

3. **Wire real signup in `signup.recruiter.tsx`**:
   - `companyName` is not in `RegisterRequest` and adding it requires a backend change:
     add the field to `RegisterRequest.java`, pass it through `AuthService.register()`, and
     persist it via `recruiterService.createBasicProfile()`. The frontend model must then be
     regenerated. Alternatively, call `POST /api/recruiters` (the create-recruiter-profile
     endpoint, guarded by `hasRole('RECRUITER')`) *after* the `signIn` call so the JWT is
     available in the Authorization header. Do **not** attempt `PUT /api/recruiters/{id}` — no
     profile id exists at this point.
   - After `verifyMutation` succeeds: assign the result (`const result = await verifyMutation.mutateAsync(...)`)
     and call `signIn(result.data!.token!, result.data!.refreshToken!)`, then navigate to
     `/employer` directly (do not redirect to `/login`).

4. **Remove dead `VITE_MOCK_AUTH` guard in signup** (line 84–88) — **blocked on Task 3 being
   end-to-end tested**. Removing it before the real flow is verified leaves signup with no
   fallback.

## Notes

- The axios instance (`packages/api/src/axios-instance.ts`) already handles token injection,
  refresh on 401, and cookie-based persistence; the auth store is only for Zustand-level
  `isAuthenticated` state and route guards.
- `web-recruiter/package.json` lists neither `js-cookie` nor `jwt-decode` as direct
  dependencies (both are only in `web-candidate`). Both are required for the new auth store.
  Add them first, before creating the store or the route guard:
  ```
  pnpm -F web-recruiter add js-cookie jwt-decode
  pnpm -F web-recruiter add -D @types/js-cookie
  ```
  The shared axios instance uses raw `document.cookie` and is unaffected.
- `useLoginCandidate` calls `POST /user/api/auth/login` which is role-agnostic; no separate
  recruiter login endpoint is needed.
- **Pre-existing bug (out of scope but worth flagging)**: `axios-instance.ts` detects the
  recruiter app via `window.location.port === '3001'` to redirect to `/login` on 401 errors.
  This breaks in any non-dev environment where both apps share port 443. A future fix should
  use an app-level env var or the hostname instead of port.
