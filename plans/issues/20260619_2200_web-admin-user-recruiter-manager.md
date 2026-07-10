# [Feature] Admin User Manager & Recruiter Approval Page — Pagination, Filter, Search

## Overview

The admin panel has two pages that need to be made fully functional:

1. **User Manager** (`/admin/users`): currently renders two hardcoded static rows with no API call, no pagination, no search, and no role filter. Must be replaced with a real data table driven by the existing `GET /user/api/users/all` endpoint — with pagination, keyword search (email / full name), and role filter.

2. **Recruiter Verification** (`/admin/employer-verification`): uses the real API and has a status tab filter, but hardcodes `size: 50` (no pagination) and has no search input. Must gain proper page-based pagination and a keyword search (company name / contact name).

Both features require small backend additions (keyword + role filter query params) and exporting the existing but unexported admin user hooks from `packages/api/src/index.ts`.

## Reproduction Steps

**User manager stub:**
1. Log in to web-admin (`http://localhost:3003`).
2. Navigate to `/admin/users`.
3. Observe: two hardcoded rows, no API call fires, no pagination or search.

**Recruiter verification — no pagination / search:**
1. Navigate to `/admin/employer-verification`.
2. Filter by PENDING tab.
3. Observe: all results fetched in one request with `size=50`; no next-page control; no search field.

## Expected Behavior

### User Manager
- On page load: fetch first page of users from `GET /user/api/users/all?page=1&size=10`.
- Search bar (debounced 300 ms): sends `keyword` query param; backend matches on `email` OR `fullName` (case-insensitive).
- Role filter dropdown: All / CANDIDATE / RECRUITER / ADMIN; sends `role` query param.
- Data table columns: Avatar initials | Full name | Email | Role(s) | Verified | Status (Locked / Active) | Actions.
- Actions per row: **Lock / Unlock** (PATCH `/{id}/status`); **Delete** (DELETE `/{id}`) with confirmation.
- Pagination footer: page X of Y, Previous / Next buttons; disabled when at boundary.
- Empty state message when no results.

### Recruiter Verification
- Pagination: page size 10; Previous / Next buttons; page indicator.
- Search input: sends `keyword` to `GET /user/api/recruiters?keyword=...`; backend matches on `companyName` OR `contactName`.
- Approve / Reject (with rejection note) kept as-is.

## Current Behavior

### User Manager (`admin.users.tsx`)
- Hardcoded static rows — no API integration whatsoever.
- No pagination state, no search, no role filter.

### Recruiter Verification (`admin.employer-verification.tsx`)
- Uses `RecruiterApi.useGetAll({ status, size: 50 })` — fetches up to 50 records per request.
- No page navigation controls.
- No search field.

## Impact Scope

Backend:
- [ ] api-gateway — no changes needed
- [x] user-service — add `keyword` + `role` params to user listing; add `keyword` param to recruiter listing
- [ ] job_service — no changes needed
- [ ] application_service — no changes needed
- [ ] ai_engine_service — no changes needed
- [ ] notification-service — no changes needed

Frontend:
- [ ] web-candidate — no changes needed
- [ ] web-recruiter — no changes needed
- [x] web-admin — rewrite `admin.users.tsx`; update `admin.employer-verification.tsx`
- [ ] packages/ui — no changes needed
- [x] packages/api — export admin user hooks from `index.ts`; add `keyword`/`role` to `GetAllUsersParams`; add `keyword` to `GetAllParams` (recruiter params type)
- [ ] packages/i18n — add any missing keys (search placeholder, pagination labels, confirm-delete dialog)

## Related Code

### Backend — user-service

**`UserController.java`** — `GET /api/users/all` (line 34–43):
```java
@GetMapping("/all")
@PreAuthorize("hasRole('ADMIN')")
public ApiResponse<PageResponse<UserResponse>> getAllUsers(
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "10") int size) {
    // only page + size; no keyword, no role
    return ... userService.getAllUsers(page, size) ...;
}
```
Change needed: add `@RequestParam(required=false) String keyword` and `@RequestParam(required=false) String role`.

**`UserService.java`** — `getAllUsers(page, size)`:
Uses `userRepository.findAll(pageable)` with no filtering. Must change to **MongoTemplate with `Criteria`** — a Spring Data derived query cannot reliably combine an OR keyword match on `email`/`fullName` with a nested-collection filter on `roles` (which is `Set<Role>`). Use:

```java
public PageResponse<UserResponse> getAllUsers(int page, int size, String keyword, String role) {
    Criteria criteria = new Criteria();
    List<Criteria> parts = new ArrayList<>();
    if (keyword != null && !keyword.isBlank()) {
        parts.add(new Criteria().orOperator(
            Criteria.where("email").regex(keyword, "i"),
            Criteria.where("fullName").regex(keyword, "i")
        ));
    }
    if (role != null && !role.isBlank()) {
        parts.add(Criteria.where("roles.id").is(role.toUpperCase()));
    }
    if (!parts.isEmpty()) criteria.andOperator(parts.toArray(new Criteria[0]));
    Pageable pageable = PageRequest.of(page > 0 ? page - 1 : 0, size);
    Query q = Query.query(criteria).with(pageable);
    List<User> items = mongoTemplate.find(q, User.class);
    long total = mongoTemplate.count(Query.query(criteria), User.class);
    // wrap into existing PageResponse pattern
}
```

Inject `MongoTemplate mongoTemplate` into `UserService` (already available in the Spring context via `spring-boot-starter-data-mongodb`).

**`UserRepository.java`** — `findByRolesIn(roles, pageable)` exists for role filter only; no keyword search. No new derived query methods needed — MongoTemplate handles it all.

**Recruiter listing** — `GET /api/recruiters` (in `RecruiterController`):
Add `@RequestParam(required=false) String keyword` and pass to `RecruiterService.getAll(page, size, status, keyword)`. Both `companyName` and `contactName` are stored directly on the `Recruiter` MongoDB document (confirmed in `Recruiter.java` lines 28 and 90) — a simple regex Criteria query on the `Recruiter` collection is sufficient, no cross-collection join needed.

### Frontend — `packages/api/src/index.ts`

Currently the file selectively re-exports from `user-controller.ts`. The following are generated but **not exported**:

| Symbol | Purpose |
|--------|---------|
| `useGetAllUsers` | Query hook — paginated user list |
| `getAllUsers` | Raw fetch function |
| `GetAllUsersParams` | Query params type |
| `useUpdateUserStatus` | Mutation — lock/unlock |
| `updateUserStatus` | Raw fetch |
| `useUpdateUserRoles` | Mutation — change roles |
| `updateUserRoles` | Raw fetch |
| `useDeleteUser` | Mutation — soft delete |
| `deleteUser` | Raw fetch |

Add to `index.ts`:
```ts
export {
  useGetAllUsers,
  getAllUsers,
  useUpdateUserStatus,
  updateUserStatus,
  useUpdateUserRoles,
  updateUserRoles,
  useDeleteUser,
  deleteUser,
} from './generated/user/user-controller/user-controller';
export type { GetAllUsersParams, GetAllParams } from './generated/user/model';
```

After the backend adds `keyword` + `role` to the user endpoint, add those fields to `GetAllUsersParams` in the generated model file (`getAllUsersParams.ts`):
```ts
export type GetAllUsersParams = {
  page?: number;
  size?: number;
  keyword?: string;   // add
  role?: string;      // add
};
```

For the recruiter endpoint, the params type is **`GetAllParams`** (file: `packages/api/src/generated/user/model/getAllParams.ts`). It already has `page`, `size`, and `status` — only add `keyword`:
```ts
export type GetAllParams = {
  page?: number;
  size?: number;
  status?: GetAllStatus;
  keyword?: string;   // add
};
```

### Frontend — `apps/web-admin/src/routes/admin.users.tsx`

**Complete rewrite.** Key implementation points:

```tsx
// State
const [page, setPage] = useState(1)
const [keyword, setKeyword] = useState('')
const [debouncedKeyword, setDebouncedKeyword] = useState('')
const [role, setRole] = useState<string | undefined>()
const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

// Debounce keyword (300 ms)
useEffect(() => {
  const t = setTimeout(() => setDebouncedKeyword(keyword), 300)
  return () => clearTimeout(t)
}, [keyword])

// Query
const { data, isLoading, refetch } = useGetAllUsers({
  page,
  size: 10,
  keyword: debouncedKeyword || undefined,
  role: role || undefined,
})
const users = data?.data?.items ?? []
const totalPages = data?.data?.totalPages ?? 1

// Mutations
const lockMutation = useUpdateUserStatus({ mutation: { onSuccess: () => { toast.success(...); refetch() } } })
const deleteMutation = useDeleteUser({ mutation: { onSuccess: () => { toast.success(...); refetch(); setDeleteTarget(null) } } })
```

Table columns: avatar initials (colored circle) | fullName | email | roles (badge list) | verified (checkmark/dash) | status (Active/Locked badge) | actions (Lock/Unlock button, Delete button).

Delete confirmation: a `Dialog` that shows the user's name and requires the admin to click "Confirm delete".

Reset `page` to 1 whenever `keyword` or `role` changes.

### Frontend — `apps/web-admin/src/routes/admin.employer-verification.tsx`

Minimal changes to the existing component:

1. Add `page` state: `const [page, setPage] = useState(1)`.
2. Add `keyword` state with 300 ms debounce.
3. Replace `RecruiterApi.useGetAll({ status: statusFilter, size: 50 })` with `RecruiterApi.useGetAll({ status: statusFilter, page, size: 10, keyword: debouncedKeyword || undefined })`.
4. Read `totalPages` from response and render Previous / Next pagination controls.
5. Add search input above the tab bar, styled consistently with the user manager search.
6. Reset `page` to 1 on `statusFilter` or `keyword` change.

### i18n keys to add

The following keys are confirmed missing from `packages/i18n/src/locales/en/common.json` and `vi/common.json`. Add all of them (EN + VI):

| Key | EN value | VI value |
|-----|----------|----------|
| `admin_search_users_placeholder` | "Search by name or email" | "Tìm theo tên hoặc email" |
| `admin_search_recruiters_placeholder` | "Search by company or contact" | "Tìm theo công ty hoặc người liên hệ" |
| `admin_filter_role_all` | "All roles" | "Tất cả vai trò" |
| `admin_role_admin` | "Admin" | "Quản trị" |
| `admin_col_verified` | "Verified" | "Đã xác thực" |
| `admin_action_delete` | "Delete" | "Xóa" |
| `admin_confirm_delete_title` | "Delete user" | "Xóa người dùng" |
| `admin_confirm_delete_desc` | "This action cannot be undone. Delete {{name}}?" | "Hành động này không thể hoàn tác. Xóa {{name}}?" |
| `admin_page_of` | "Page {{page}} of {{total}}" | "Trang {{page}} / {{total}}" |
| `admin_pagination_prev` | "Previous" | "Trước" |
| `admin_pagination_next` | "Next" | "Tiếp" |

Note: `admin_role_candidate` and `admin_role_employer` already exist — do not duplicate them.

## Implementation Order

1. **Backend (user-service):** add `keyword` + `role` to `GET /api/users/all`; add `keyword` to `GET /api/recruiters`. Run existing tests.
2. **packages/api:** export admin user hooks; add `keyword`/`role` to `GetAllUsersParams`; add `keyword` to recruiter params.
3. **packages/i18n:** add missing translation keys (EN + VI).
4. **web-admin `admin.users.tsx`:** rewrite with real API, pagination, search, role filter, lock/unlock, delete.
5. **web-admin `admin.employer-verification.tsx`:** add pagination state + controls, add search input.
6. **Lint + build** for `web-admin`; smoke-test with backend running.

## Notes

- **`useDeleteUser` uses `userID` (capital D):** `deleteMutation.mutate({ userID: id })`. The generated variable name has a capital D — do not use lowercase `userId`.
- **`useUpdateUserStatus` uses `userId` (lowercase d):** `lockMutation.mutate({ userId: id, data: { locked: true } })`. This is different from the delete hook — lowercase `userId` here, capital `userID` for delete.
- The `useUpdateUserStatus` request body is `UserStatusRequest { locked: boolean }` — pass `{ locked: true }` to lock, `{ locked: false }` to unlock.
- The recruiter `useGetAll` is namespaced under `RecruiterApi` in the existing code; keep this pattern — do not change the import style.
- Pagination in the backend uses 1-based page index (Spring `Pageable` is 0-based internally; both `UserService` and `RecruiterService` convert with `page > 0 ? page - 1 : 0`).
- Do not navigate away or clear search when a lock/delete action succeeds — `refetch()` is sufficient.
