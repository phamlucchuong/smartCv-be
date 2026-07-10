# CV analysis result: multilingual (EN/VI) display fix

## Scope

The "analyze CV" feature (ai_engine_service `/analyze-cv/full`) already has a partial
EN/VI multilingual design baked into its DTOs and LLM prompts, but three independent
breakages mean the end user never sees a Vietnamese analysis result even when the app's
language is set to Vietnamese. This plan makes the whole result (summary, strengths,
weaknesses, tips) genuinely bilingual and wires the frontend to switch between the two
languages based on the app's existing language preference — one language shown at a
time, not both simultaneously.

Out of scope: browser `Accept-Language` / `navigator.language` auto-detection
(`frontend/packages/i18n/src/i18n.ts` hardcodes `lng: 'vi'` as the app default,
overriding the installed `LanguageDetector`) — that is a separate, broader concern
affecting the whole app's first-visit UX, not specific to CV analysis, and is left
untouched by this plan.

## Current assessment

Investigated end-to-end (backend Java + frontend TS) before writing this plan. Three
independent breakage points:

1. **`CvAnalysisResponse.summaryVi` was silently dropped.** Commit `900fa03` removed
   `summaryVi` from the `CvAnalysisResponse` record, but `analyze_cv.md` (the prompt
   used by the no-Job/no-O*NET path, `AnalysisService.analyzeWithText`) still instructs
   the LLM to produce it. Because `ObjectMapper` has
   `FAIL_ON_UNKNOWN_PROPERTIES=false`, the LLM's `summaryVi` value is silently discarded
   during parse — never a crash, just silently lost.
2. **The most-used analysis path never had a Vietnamese summary at all.** When a
   candidate analyzes their CV against a specific Job (`jobId` present) or via the
   O*NET fallback, `matchAnalysis` comes from `DeterministicCvScoringService.score()` —
   pure Java string concatenation (`buildSummary()`), English-only by construction, no
   LLM call involved. There has never been a Vietnamese counterpart for this path.
3. **`CvFullAnalysisResponse.summaryVi` is hardcoded to `""`.** `AnalysisService.java`
   line ~405 sets it to a literal empty string — a stopgap patched in during an earlier
   unrelated fix (this branch didn't compile because of finding #1) so the build would
   pass. Regardless of #1/#2 being fixed, this line currently discards whatever value
   would otherwise flow through.
4. **`strengths`/`weaknesses`/`tips` are fine end-to-end on the backend** —
   `StrengthItem`, `WeaknessItem`, `ImprovementTip` still carry `detailVi`/
   `suggestionVi`, the `improve_cv_structured.md` prompt (always LLM-driven, on every
   analysis path) instructs the model to fill both languages, and nothing strips these
   fields during parsing. The break here is entirely on the frontend.
5. **Frontend never renders any `*Vi` field except the top-level summary**, and even
   that one is broken today because of #3.
   - `apps/web-candidate/src/routes/jobs/$jobId.tsx` (`CvJobAnalysisResult`) already
     branches on `lang` for `summary`/`summaryVi` (the *only* correct precedent in the
     codebase), but its strengths/weaknesses/tips sections render `.detail`/
     `.suggestion` unconditionally — no Vietnamese ever shown regardless of `lang`.
   - `apps/web-candidate/src/components/cv/CvAnalysisPanel.tsx` (used on the
     candidate's own CV management page, a second independent render path for the
     same backend JSON) is worse: it locally redeclares `CvFullAnalysisResult`,
     `StrengthItem`, `WeaknessItem`, `ImprovementTip` interfaces that omit `summaryVi`/
     `detailVi`/`suggestionVi` entirely (TypeScript erases fields the backend JSON
     actually contains), and the component never imports `usePreferencesStore` at all
     — it has no language signal to branch on.
- App-wide language state: `usePreferencesStore.language` (`'EN' | 'VI'`, Zustand,
  defaults to `'VI'`, persisted to `localStorage`, synced with the authenticated user's
  saved preference). This is the single existing source of truth every other piece of
  UI text in the app already uses — the design reuses it rather than introducing a new
  mechanism.

## Phase 1 — Backend: restore and complete the bilingual summary

**Files:** `dtos/response/CvAnalysisResponse.java`,
`features/analysis/DeterministicCvScoringService.java`,
`features/analysis/AnalysisService.java`,
`src/test/.../DeterministicCvScoringServiceTest.java` (new or existing),
`src/test/.../AnalysisServiceDeterministicAnalyzeTest.java`.

1. Add `String summaryVi` back to the `CvAnalysisResponse` record (after `summary`, to
   match `analyze_cv.md`'s existing JSON field order/name — no prompt change needed,
   the model already emits `summaryVi` correctly, it was just being discarded).
2. In `DeterministicCvScoringService`, add `buildSummaryVi(...)` mirroring
   `buildSummary(...)` field-for-field (same score/matched/missing/nice-to-have/years/
   caps inputs), producing the same content in Vietnamese sentence templates. No new
   LLM call — deterministic, same cost profile as today.
3. Wire `buildSummaryVi()`'s result into the `CvAnalysisResponse` constructor call in
   `DeterministicCvScoringService.score()`.
4. Update the test constructor call site
   (`AnalysisServiceDeterministicAnalyzeTest.java:54`) for the new record shape.
5. In `AnalysisService.analyzeCv()`, replace the hardcoded `""` with
   `matchAnalysis.summaryVi()`.
6. TDD: write a failing test asserting `buildSummaryVi()` produces a non-blank
   Vietnamese string containing the score and matched/missing skill names, watch it
   fail (method doesn't exist / returns blank), then implement.
7. Regression test: assert `AnalysisService.analyzeCv()` (job-based, deterministic
   path) returns a non-blank `summaryVi` in the resulting `CvFullAnalysisResponse` —
   this is the test that would have caught breakage point #3.

## Phase 2 — Backend: confirm strengths/weaknesses/tips survive parsing

**Files:** existing `AnalysisService` tests (add one assertion, no new prompt/DTO
changes expected).

1. Add or extend a test around `improveWithText(...)` / `analyzeCv(...)` asserting that
   when the mocked LLM response includes `detailVi`/`suggestionVi` values, the parsed
   `CvImproveStructuredResponse` retains them (guards against a future accidental field
   removal, same class of bug as breakage #1).

## Phase 3 — Frontend: `$jobId.tsx` — show the right language for strengths/weaknesses/tips

**File:** `apps/web-candidate/src/routes/jobs/$jobId.tsx`, function
`CvJobAnalysisResult`.

1. Apply the same pattern already used for `summary` (line ~1311) to each of the three
   sections:
   - strengths (~1423): `lang === 'VI' && s.detailVi ? s.detailVi : s.detail`
   - weaknesses (~1438): `lang === 'VI' && w.detailVi ? w.detailVi : w.detail`
   - tips (~1474): `lang === 'VI' && tip.suggestionVi ? tip.suggestionVi : tip.suggestion`
2. The `&& x.detailVi` / `&& tip.suggestionVi` guard keeps the existing English-only
   fallback behavior if a particular item is ever missing its Vietnamese translation
   (defensive, matches the existing `summary` precedent — never show a blank string).

## Phase 4 — Frontend: `CvAnalysisPanel.tsx` — bring the second render path up to parity

**File:** `apps/web-candidate/src/components/cv/CvAnalysisPanel.tsx`.

1. Extend the locally-declared interfaces to include the Vietnamese fields:
   `CvFullAnalysisResult.summaryVi?: string`, `StrengthItem.detailVi?: string`,
   `WeaknessItem.detailVi?: string`, `ImprovementTip.suggestionVi?: string`.
2. Import `usePreferencesStore` and read `language` the same way `$jobId.tsx` does.
3. Apply the identical ternary pattern from Phase 3 to this component's summary,
   strengths, weaknesses, and tips rendering (lines ~143-145, ~218, ~234, ~260).

## Verification

- Backend: `./mvnw test` in `ai_engine_service` — full suite green, including new/
  updated tests from Phases 1-2.
- Frontend: no test runner configured (per `frontend/CLAUDE.md`) — verify manually.
  Start `pnpm -F web-candidate dev`, run a CV analysis both with a `jobId` (exercises
  the deterministic path, the main gap this plan closes) and without (exercises the
  LLM `analyze_cv.md` path), toggle the app's language switcher, and confirm the
  summary/strengths/weaknesses/tips text actually changes language in both
  `$jobId.tsx`'s analysis panel and the candidate's CV management page
  (`CvAnalysisPanel.tsx`) — without both languages ever appearing at once.

## Execution order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Verification. Phases 1-2 (backend) can be
fully tested in isolation before touching the frontend; Phases 3-4 depend on Phase 1
actually populating `summaryVi` (there's nothing to display otherwise) but are
otherwise independent of each other and could be done in either order.
