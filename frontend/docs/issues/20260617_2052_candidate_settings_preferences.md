# Complete Candidate Settings Preferences Flow

## Overview
The candidate settings flow is partially implemented. The current web-candidate settings page can load and update notification and privacy preferences through candidate settings APIs, and account fields such as email, phone, password, and account deletion have dedicated handlers. However, the full personal settings requirement is not complete because language and light/dark mode preferences are only stored in browser localStorage through the frontend preferences store, not in the authenticated candidate settings record.

The target behavior is a complete per-candidate settings flow where each candidate can manage all settings from the settings experience, and those settings persist with the candidate account across sessions, browsers, and devices. This must include language and appearance mode in addition to the existing notification and privacy preferences.

## Reproduction steps
1. Sign in to web-candidate as a candidate.
2. Open `/settings`.
3. Toggle notification and privacy settings.
4. Toggle language or light/dark mode from the public header or candidate dashboard header.
5. Sign out, sign in as another candidate in the same browser, or sign in from another browser/device.
6. Observe whether language and theme are loaded from that candidate's persisted settings.

## Expected behavior
Candidate settings should be complete and account-scoped:

1. `/settings` should expose controls for account, notification, privacy, language, and appearance mode.
2. Notification preferences should persist to the candidate account.
3. Privacy preferences should persist to the candidate account.
4. Language preference should persist to the candidate account and hydrate `@smart-cv/i18n` on sign-in/page load.
5. Appearance preference should persist to the candidate account and hydrate the document theme on sign-in/page load.
6. Switching accounts in the same browser should not leak one candidate's language or theme preference into another candidate's session.
7. The frontend should keep localStorage only as an anonymous/pre-auth fallback or short-term cache, not as the source of truth for authenticated candidates.

## Current behavior
Notification and privacy preferences are backed by user-service settings endpoints:

1. `GET /api/candidates/settings` returns `CandidateSettings`.
2. `PUT /api/candidates/settings/notifications` persists `NotificationPreferences`.
3. `PUT /api/candidates/settings/privacy` persists `PrivacySettings`.

The settings page uses these APIs for notifications and privacy, but it has no settings section for language or appearance. The menu currently contains only account, notifications, privacy, and danger sections.

Language and theme are managed separately by `usePreferencesStore`. They are initialized from and written to `localStorage` keys `smartcv_lang`, `smartcv_theme`, and the persisted Zustand key `smartcv_preferences`. Header toggles call `toggleLanguage()` and `toggleTheme()` directly, so authenticated candidate preferences remain browser-scoped instead of account-scoped.

The backend `CandidateSettings` model currently contains only `notifications` and `privacy`. There are no fields or endpoints for language or theme/appearance.

## Impact scope
Backend:
- [ ] api-gateway
- [x] user-service
- [ ] job_service
- [ ] application_service
- [ ] ai_engine_service
- [ ] notification-service
- [ ] Infrastructure (Docker / RabbitMQ / MongoDB / Elasticsearch)

Frontend:
- [x] web-candidate
- [ ] web-recruiter
- [ ] web-admin
- [ ] packages/ui
- [x] packages/api
- [x] packages/i18n

## Related code
Frontend:

- `frontend/apps/web-candidate/src/routes/_account.settings.tsx`
  - `useGetSettings`, `useUpdateNotifications`, and `useUpdatePrivacy` are used to load and persist notification/privacy settings.
  - `SectionKey` is limited to `account | notifications | privacy | danger`.
  - `menuItems` does not include language or appearance preferences.
  - `activityStatus` is local-only today and is out of scope for this issue unless a separate product requirement is created.
- `frontend/apps/web-candidate/src/store/usePreferencesStore.ts`
  - `theme` and `language` are read from localStorage.
  - `setTheme`, `toggleTheme`, and `toggleLanguage` write only to localStorage/Zustand.
- `frontend/apps/web-candidate/src/routes/__root.tsx`
  - Public header toggles language and theme directly from local preferences.
  - `document.documentElement.classList.toggle('dark', theme === 'dark')` applies local theme.
  - `syncLanguageFromI18n` syncs local store from i18n, not from backend settings.
- `frontend/apps/web-candidate/src/components/layouts/CandidateDashboardLayout.tsx`
  - Candidate dashboard header also toggles language and theme directly from local preferences.
- `frontend/packages/api/src/generated/user/candidate-controller/candidate-controller.ts`
  - Generated hooks exist for settings, notification updates, and privacy updates only.
- `frontend/packages/api/src/generated/user/model/candidateSettings.ts`
  - Generated candidate settings type contains only `notifications` and `privacy`.
- `frontend/packages/i18n/src/i18n.ts`
  - i18n registers `LanguageDetector`, but `lng: 'vi'` currently forces Vietnamese as the default; authenticated preference hydration is not wired.

Backend:

- `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/settings/CandidateSettings.java`
  - Contains only `NotificationPreferences notifications` and `PrivacySettings privacy`.
- `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/CandidateController.java`
  - Provides `GET /settings`, `PUT /settings/notifications`, and `PUT /settings/privacy`.
- `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/CandidateService.java`
  - `getSettings`, `updateNotificationPreferences`, and `updatePrivacySettings` persist only the existing nested settings objects.
- `backend/user-service/src/test/java/vn/chuongpl/user_service/service/CandidateSettingsServiceTest.java`
  - Tests cover default settings plus notification/privacy persistence; no language/theme coverage exists.

## Implementation notes
Backend should extend candidate settings as the source of truth for authenticated candidates:

1. Add a `preferences` model under `CandidateSettings`.
   - Use Java enums exposed as OpenAPI string enums.
   - `language`: supported enum values `EN`, `VI`; canonical default `VI`.
   - `theme`: supported enum values `LIGHT`, `DARK`; default `LIGHT` to match current `usePreferencesStore` fallback.
   - Unsupported non-null values such as `FR` or `SYSTEM` must be rejected by request validation with the existing API error response pattern and an HTTP 400-class status. `null` or omitted fields are treated as no-op preserves, not invalid input.
2. Add `PUT /api/candidates/settings/preferences` for partial preference updates with request body `{ language?: EN | VI, theme?: LIGHT | DARK }`.
   - Request DTO name: `PreferencesSettingsRequest`.
   - Response DTO/model name: `PreferencesSettings`.
   - OpenAPI operationId should be stable and descriptive, for example `updatePreferences`.
   - The endpoint must use `@AuthenticationPrincipal String userId`.
   - The endpoint must update only the authenticated candidate's settings.
   - The endpoint must not require clients to send notification or privacy fields.
   - Omitted or `null` `language` and `theme` fields must preserve the existing stored values; a single-field header shortcut update must not reset the other preference to its default.
   - The endpoint must return `ApiResponse<PreferencesSettings>` so Orval generates a narrow mutation result type for preference reconciliation.
3. Keep `GET /api/candidates/settings` as the hydration source and include `preferences` in `CandidateSettings`.
4. Preserve default behavior for existing candidate documents by supplying defaults when `settings`, `notifications`, `privacy`, or `preferences` are missing.
5. Add service tests for default language/theme and preference persistence.
6. Add controller/API tests for `ROLE_CANDIDATE` authorization and authenticated-candidate scoping for `PUT /settings/preferences`.
7. Regenerate/update the OpenAPI contract and frontend generated API package.
   - Frontend root script is `pnpm gen:api:user`; package-local script is `pnpm -F @smart-cv/api generate:user`.
   - Those scripts run `scripts/fetch-specs.mjs`, which fetches user, job, application, and AI specs before Orval runs. Either start all spec-producing services required by that script, or add/use a user-service-only generation path that writes `openapi/live/user-service.json` and runs Orval for `userService` without requiring unrelated service specs.
   - The user-service spec source must be Springdoc from the updated backend, normally `http://localhost:8081/user/v3/api-docs`, saved to `frontend/packages/api/openapi/live/user-service.json` when using cached generation.
   - Commit the generated `frontend/packages/api/src/generated/user/**` changes and any checked-in OpenAPI spec file that the repo expects for reproducible generation.

Frontend should treat backend settings as canonical for authenticated users:

1. Add a settings section or account subsection for language and appearance.
2. On unauthenticated pages, continue using localStorage fallback for language/theme.
3. Resolve the current split default by making `VI` the canonical language default across backend, `usePreferencesStore`, and `@smart-cv/i18n`.
   - If `smartcv_lang` is missing, `usePreferencesStore` should initialize to `VI`.
   - Migrate persisted Zustand preferences deterministically. If `smartcv_lang` exists and is `en` or `vi`, trust it as the legacy explicit local language. If `smartcv_lang` is absent, ignore pre-versioned `smartcv_preferences.language` and normalize language to `VI`. Add a preferences schema version and explicit local-choice marker going forward so future migrations can distinguish defaults from user choices.
   - `@smart-cv/i18n` should continue to boot in Vietnamese unless an authenticated backend preference or explicit local anonymous preference overrides it.
   - Map backend `EN`/`VI` to i18n `en`/`vi`.
   - Apply the same deterministic migration policy to theme. If `smartcv_theme` exists and is `light` or `dark`, trust it as the legacy explicit local theme. If `smartcv_theme` is absent, ignore pre-versioned `smartcv_preferences.theme` and normalize theme to `LIGHT`/frontend `light`. The new preferences schema version and explicit local-choice marker must cover both language and theme.
4. Introduce a single authenticated preferences hydrator/ownership state in web-candidate, rather than having `__root.tsx` and `CandidateDashboardLayout` independently reconcile server-backed preferences.
   - The hydrator should track whether preferences are anonymous-local, authenticated-loading, authenticated-loaded, or authenticated-error.
   - The hydrator should live in shared web-candidate state or a shared hook used by `__root.tsx`, `CandidateDashboardLayout`, and `/settings`.
   - Hydrator ownership must be keyed by the authenticated candidate identity from `useAuthStore.userId` / token subject. If the user id changes, reset authenticated preference state and refetch before treating preferences as server-backed.
   - Header/dashboard/settings toggles must use this hydrator so pre-hydration toggles do not accidentally persist or overwrite the wrong candidate's server preferences.
   - While status is `authenticated-loading`, language/theme controls should be disabled or non-persisting loading controls. Do not queue or send preference mutations until the authenticated user identity and settings have resolved to `authenticated-loaded`; if settings load fails, controls may update only the local visible session under `authenticated-error` and must not persist to backend.
   - React Query settings/preference cache must be user-scoped or removed on sign-in/sign-out. The current generated `getSettings` query key is static, so the implementation must prevent a newly signed-in candidate from hydrating from the previous candidate's cached `/api/candidates/settings` data.
5. On authenticated app load, fetch `GET /api/candidates/settings` before treating localStorage as final.
6. When authenticated settings resolve, hydrate `usePreferencesStore`, `i18n.changeLanguage`, and the document `dark` class from backend `preferences`.
   - Map backend `LIGHT`/`DARK` to the existing frontend store values `light`/`dark`.
   - Map frontend `light`/`dark` back to backend `LIGHT`/`DARK` for mutations.
   - Authenticated backend preferences should update in-memory UI state only and must not overwrite anonymous localStorage keys (`smartcv_lang`, `smartcv_theme`, `smartcv_preferences`). Anonymous preferences may continue to use localStorage. On sign-out, restore anonymous local preferences if present; otherwise restore canonical defaults `VI` and `LIGHT`.
7. If authenticated settings fetch fails, keep the current local fallback for the visible session and show/log an error state according to existing frontend patterns; do not persist local fallback back to the account automatically.
8. When the user changes language/theme from `/settings` or from header shortcuts, call `PUT /api/candidates/settings/preferences` for authenticated users, then update local UI state optimistically with rollback/toast on failure.
9. On sign-out, reset authenticated preference ownership so the next anonymous session or candidate sign-in does not reuse the previous candidate's server-backed preference as an account setting.
10. On signing in as another candidate in the same browser, backend settings for the new candidate must override any previous local or prior-account preference values after settings load.
11. Add Vitest coverage in `web-candidate` for authenticated settings hydration, header/settings preference mutations, rollback on mutation failure, and sign-out/account-switch isolation.
   - Update `frontend/apps/web-candidate/vite.config.ts` coverage include beyond `src/store/**/*.ts` so route/layout/shared preference hydration code is counted.
   - If component-level tests are used for headers/settings, add the required React Testing Library or equivalent test setup; otherwise implement the preference hydrator as testable shared logic and cover the route/layout integrations at the highest practical level available in the app.
   - Include a test that verifies cached settings from candidate A are not used to hydrate candidate B after sign-out/sign-in.

## Notes
The feature is not implemented fully as of 2026-06-17. Notification and privacy persistence exist, but language and light/dark mode are browser-local only and are not included in `CandidateSettings`.
