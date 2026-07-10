# [Feature] AI CV Analysis with Gemini as Default Provider

## Overview

Implement an end-to-end AI CV analysis flow visible on the candidate's CV page, with Google Gemini seeded as the default active AI provider.

Two analysis modes run in a single synchronous API call:

1. **Standalone quality analysis** — Analyze the CV on its own. When no explicit job is provided, extract the target position/role from the CV text and use it as the reference JD. Returns: quality/match score, skill extraction, strengths, weaknesses, and improvement tips.

2. **CV-vs-Job match analysis** — When a job is explicitly selected, compare the CV against that job's JD. Returns: matchScore, matched/missing/extra skills, summary. If no job is selected, uses the auto-extracted target position from mode 1.

The combined result is persisted in `CvItem.analysisResult` (currently never populated) and the status is set to `DONE`. The CV page renders results in an expandable inline panel below each CV card.

Gemini (`gemini-2.0-flash`) is seeded as the active provider via a MongoDB init script so the service works out-of-the-box without calling the admin API.

---

## Current Behavior

- `CvItem.analysisResult` is never populated; `analysisStatus` stays `PENDING` after upload (only async skill extraction fires via RabbitMQ).
- The frontend "Re-analyze" button calls `POST /api/candidates/cvs/{cvId}/reanalyze` on user-service, which fires RabbitMQ skill extraction — it does not call the AI analysis service and returns no analysis result.
- No active AI provider is seeded in the database on first startup; if the `ai_provider_configs` collection is empty, `AiModelGatewayRouter` has no active gateway and all analysis requests fail.
- The existing `POST /api/ai/analyze` endpoint requires a real `jobId` routed through `JobClient` — there is no way to analyze a CV against a free-text job description or auto-extracted position.

---

## Expected Behavior

### New backend endpoint: `POST /api/ai/analyze-cv`

Auth: `ROLE_CANDIDATE`. Extracts `userId` from JWT via `@AuthenticationPrincipal`. Synchronous — returns result in response body.

**Request:**
```json
{
  "cvId": "abc123",
  "jobId": "optional-job-id"
}
```

**Response (`CvFullAnalysisResponse`):**
```json
{
  "overallScore": 78,
  "scoreLabel": "Good",
  "targetPosition": "Backend Software Engineer",
  "matchScore": 78,
  "matchedSkills": ["Java", "Spring Boot", "Docker"],
  "missingSkills": ["Kubernetes", "Kafka"],
  "extraSkills": ["PHP"],
  "summary": "Strong Java backend profile with solid Spring Boot experience...",
  "strengths": [
    { "area": "Technical Skills", "detail": "Solid Java and Spring ecosystem expertise." }
  ],
  "weaknesses": [
    { "area": "Cloud / Infra", "detail": "No cloud-native orchestration experience." }
  ],
  "tips": [
    { "area": "Certifications", "suggestion": "Pursue CKA or AWS Solutions Architect.", "priority": "High" }
  ],
  "extractedSkills": ["Java", "Spring Boot", "Docker", "PHP", "MySQL"]
}
```

Note: `strengths` and `weaknesses` use structured objects `{ area, detail }` — these are **new nested DTO types**, not the existing `List<String>` used by the current `CvImprovementResponse`. Define `StrengthItem(String area, String detail)` and `WeaknessItem(String area, String detail)` as records in the `dto/` package.

Note: `overallScore` is computed in Java (not by the AI prompt) from the `matchScore` field returned by the prompt, using these thresholds: ≥85 → "Excellent", ≥70 → "Good", ≥50 → "Fair", <50 → "Poor". The `scoreLabel` field is also derived in Java using the same thresholds. The `analyze_cv.md` prompt does **not** need to be changed for `overallScore` or `scoreLabel` — both are computed server-side. When no `jobId` is provided, `overallScore == matchScore` (same underlying AI score). When a `jobId` is provided, `overallScore` is the score from the standalone (extracted-position) analysis, `matchScore` is the score from the job-JD analysis — run these two AI calls **in parallel** using `CompletableFuture` to avoid doubling latency.

### New internal user-service endpoint: `GET /api/internal/candidates/cvs/{cvId}`

Added to `InternalCandidateController`. Called by `ai_engine_service` to resolve the CV's URL before PDF parsing. Path variable `cvId` identifies the CV; the response includes `cvUrl`, `filename`, and `ownerId` (userId of the candidate). No auth header required beyond the standard `X-Gateway-Secret` internal header.

**Response:**
```json
{ "cvId": "abc123", "cvUrl": "https://s3.../cvs/.../file.pdf", "filename": "my-cv.pdf", "ownerId": "user-xyz" }
```

### New internal user-service endpoint: `PATCH /api/internal/candidates/cvs/{cvId}/analysis`

Added to `InternalCandidateController`. Called by `ai_engine_service` after analysis to persist the result. Updates `CvItem.analysisResult` (JSON string) and `CvItem.analysisStatus` by `cvId` using a MongoDB positional `$set` operator (not `save()`, to avoid lost-update races on the candidate document).

**Request body:**
```json
{
  "analysisResult": "{...serialized CvFullAnalysisResponse...}",
  "analysisStatus": "DONE"
}
```

Auth: Internal header (`X-Gateway-Secret` or equivalent pattern already used by `mergeSkills` in `InternalCandidateController`).

### Analysis flow — no `jobId` provided

1. Extract `userId` from JWT in the controller (`@AuthenticationPrincipal`)
2. Call `UserClient.getCvInfo(cvId)` → `{ cvId, cvUrl, filename, ownerId }` (new RestTemplate method; full URL: `{baseUrl}/api/internal/candidates/cvs/{cvId}` where `baseUrl` is the existing `${app.user-service.base-url}` property, e.g. `http://localhost:8081/user`)
3. Validate: if `ownerId != userId`, throw `AppException(FORBIDDEN)` — prevents cross-user CV analysis
4. Extract CV text: `CvTextExtractor.resolveCvText(null, cvUrl)` (already exists, uses PDFBox)
5. Call new AI method `extractJobTarget(cvText)` → `{ targetPosition, targetDomain }`
6. Call new `analyzeWithText(cvText, targetPosition)` (new overload — bypasses `JobClient`)
7. Call new `improveWithText(cvText, targetPosition)` (new overload — bypasses `JobClient`)
8. Compute `overallScore = matchScore`; compute `scoreLabel` from thresholds in Java
9. Merge into `CvFullAnalysisResponse`
10. Call `UserClient.updateCvAnalysis(cvId, serializedResult, DONE)` (new RestTemplate method; URL: `{baseUrl}/api/internal/candidates/cvs/{cvId}/analysis`)
11. Return `CvFullAnalysisResponse` directly in the HTTP response

### Analysis flow — `jobId` provided

Steps 1–3 identical. Then, in **parallel**:

4a. `jobClient.getJobById(jobId)` → JD text → `analyzeWithText(cvText, jobDescription)` → `matchScore`, skills (CompletableFuture A)
4b. `extractJobTarget(cvText)` → `targetPosition` → `analyzeWithText(cvText, targetPosition)` → standalone `overallScore` (CompletableFuture B)

5. `CompletableFuture.allOf(A, B).join()`
6. Call new `improveWithText(cvText, jobDescription)` → strengths, weaknesses, tips
7. Compute `scoreLabel` in Java from `overallScore` (≥85=Excellent, ≥70=Good, ≥50=Fair, <50=Poor)
8. Merge into `CvFullAnalysisResponse`
9–10. Same as no-jobId flow (steps 8–9)

### New overloads needed in `AnalysisService`

The existing `analyze(CvAnalyzeRequest)` and `improve(CvImproveRequest)` both call `jobClient.getJobById()` unconditionally — they cannot be called with a freetext JD. Add private overloads:

- `analyzeWithText(String cvText, String jobDescriptionText)` — builds prompt directly, bypasses JobClient
- `improveWithText(String cvText, String jobDescriptionText)` — same

These are private/package-private helpers; the public API methods remain unchanged and continue to resolve via `JobClient`.

### Gemini default seed

MongoDB init script inserts one document into `ai_engine_db.ai_provider_configs` on first container initialization:

```js
// backend/docker/mongo/init/01-ai-provider-seed.js
db = db.getSiblingDB('ai_engine_db');
if (db.ai_provider_configs.countDocuments({ active: true }) === 0) {
  db.ai_provider_configs.insertOne({
    provider: "GEMINI",
    apiKey: process.env.GEMINI_API_KEY || "REPLACE_WITH_GEMINI_API_KEY",
    model: "gemini-2.0-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    active: true,
    updatedAt: new Date()
  });
}
```

Note: The `docker-compose.yaml` MongoDB service currently has **no** `/docker-entrypoint-initdb.d/` volume mount. A bind mount must be added:

```yaml
services:
  mongodb:
    volumes:
      - mongodb_data_vol:/data/db
      - ./docker/mongo/init:/docker-entrypoint-initdb.d:ro   # ADD THIS
```

MongoDB init scripts only run on a **fresh** volume (first ever container start). If the data volume already exists on a developer's machine, the script is skipped — the developer must call the admin API manually (`PUT /api/ai/admin/providers/GEMINI` + `PUT /api/ai/admin/providers/GEMINI/activate`) or drop and recreate the volume.

Note: The base URL must **not** have a trailing slash — use `https://generativelanguage.googleapis.com/v1beta/openai` (consistent with `application.yaml`).

### Frontend CV page inline panel

- The "Re-analyze" button currently calls `useReanalyzeCv` (user-service hook). Replace this with a call to the new generated hook for `POST /api/ai/analyze-cv` (Orval-generated from ai_engine_service Swagger). The existing `POST /api/candidates/cvs/{cvId}/reanalyze` endpoint on user-service is left in place.
- Each CV card tracks its own in-flight state using a `Map<cvId, boolean>` (or a `Set<string>` of pending cvIds via `useState`) to avoid a single shared mutation flag incorrectly marking all cards as loading.
- While analyzing: spinner overlay on the specific CV card only; "Re-analyze" button disabled for that card.
- On mutation success: read `CvFullAnalysisResponse` **from the mutation response body** (do not rely solely on a re-fetch of the CV list, as the `PATCH /api/internal/.../analysis` write may not have propagated by the time the re-fetch lands). Optionally also invalidate `getListCvsQueryKey` for background consistency.
- The inline panel renders `cv.analysisResult` by calling `JSON.parse(cv.analysisResult)` inside the component; wrap in a try/catch — show an error fallback if the stored JSON is malformed.
- `analysisStatus === 'DONE'` with a non-null `analysisResult`: panel shown expanded by default on page load.
- `analysisStatus === 'FAILED'` (either stored or from mutation failure): show error state with a "Re-analyze" retry button. Distinguish between (a) in-flight mutation failure (reset local pending flag, show error toast) and (b) stored `FAILED` status loaded from server (show persistent error state in the panel without auto-retrying).
- Panel contents:
  - Overall score badge (color-coded: ≥85 green, ≥70 blue, ≥50 yellow, <50 red)
  - Target position chip
  - Skill tags: matched (green), missing (red), extra (gray)
  - Summary paragraph
  - Accordion for Strengths / Weaknesses / Tips

---

## Reproduction Steps

N/A — new feature. Verify the current state with:

1. Log in as a CANDIDATE, upload a PDF CV.
2. Check `GET /api/candidates/me` → `analysisStatus: PENDING`, `analysisResult: null`.
3. Call `GET /api/ai/admin/providers/active` as ADMIN → error (no active provider seeded).

---

## Impact Scope

Backend:
- [x] ai_engine_service — new `POST /api/ai/analyze-cv` endpoint; new `CvFullAnalysisRequest`, `CvFullAnalysisResponse`, `StrengthItem`, `WeaknessItem`, `ExtractJobTargetResponse` DTOs; new `extractJobTarget()`, `analyzeWithText()`, `improveWithText()` methods in `AnalysisService`; new `buildExtractJobTargetPrompt()` + `buildImproveStructuredPrompt()` in `PromptBuilder`; new prompts `extract_job_target.md` and `improve_cv_structured.md`; new `getCvInfo()` + `updateCvAnalysis()` methods in `UserClient`
- [x] user-service — new `GET /api/internal/candidates/cvs/{cvId}` and `PATCH /api/internal/candidates/cvs/{cvId}/analysis` endpoints in `InternalCandidateController`; new `CandidateRepository` query to find candidate by embedded `cvs.id`; new `CvAnalysisUpdateRequest` DTO
- [ ] api-gateway — no change needed; browser calls `POST /ai/api/ai/analyze-cv` (routed via existing `Path=/ai/**` rule with no StripPrefix)
- [ ] job_service
- [ ] application_service
- [ ] notification-service
- [x] Infrastructure — add MongoDB init script `backend/docker/mongo/init/01-ai-provider-seed.js`; add volume bind mount to `docker-compose.yaml` MongoDB service

Frontend:
- [x] web-candidate — `src/routes/_account.cv.tsx` (replace re-analyze call with new hook, per-CV mutation tracking, inline result panel)
- [x] web-candidate — new `src/components/cv/CvAnalysisPanel.tsx` (intentionally app-local, not added to `@smart-cv/ui`)
- [ ] web-recruiter
- [ ] web-admin
- [x] packages/api — regenerate Orval client after ai_engine_service Swagger is updated with new endpoint + DTOs. Command: `pnpm generate:api` from `frontend/`. Prerequisite: ai_engine_service must be running (spec is fetched live by `fetch-specs.mjs`)
- [ ] packages/ui
- [x] packages/i18n — add keys to `packages/i18n/src/locales/en/common.json` and `vi/common.json` (not `web-candidate.json`)

---

## Related Code

| Location | What |
|---|---|
| `backend/ai_engine_service/.../features/analysis/AnalysisService.java` | Existing `analyze()`, `improve()`, `extractSkills()` methods; add new overloads and `extractJobTarget()` |
| `backend/ai_engine_service/.../features/analysis/AnalysisController.java` | Add new `POST /analyze-cv` endpoint |
| `backend/ai_engine_service/.../features/analysis/PromptBuilder.java` | Add `buildExtractJobTargetPrompt()` and `buildImproveStructuredPrompt(Map<String, Object> vars)` |
| `backend/ai_engine_service/.../features/analysis/dto/` | Add `CvFullAnalysisRequest`, `CvFullAnalysisResponse`, `StrengthItem`, `WeaknessItem`, and `ExtractJobTargetResponse` |
| `backend/ai_engine_service/src/main/resources/prompts/analyze_cv.md` | No change needed — `overallScore` and `scoreLabel` are computed server-side in Java |
| `backend/ai_engine_service/src/main/resources/prompts/improve_cv.md` | **Do not modify** — changing output schema would break existing `POST /api/ai/improve` and `CvImprovementResponse`; use separate `improve_cv_structured.md` instead |
| `backend/ai_engine_service/.../integration/user/UserClient.java` | RestTemplate-based (not Feign); add `getCvInfo(cvId)` and `updateCvAnalysis(cvId, body)` methods |
| `backend/user-service/.../features/candidate/CvItem.java` | `analysisResult` (String) and `analysisStatus` (CvAnalysisStatus) already present |
| `backend/user-service/.../features/candidate/InternalCandidateController.java` | Add two new internal endpoints |
| `backend/user-service/.../features/candidate/CandidateService.java` | Add `getCvInfo(cvId)` and `updateCvAnalysis(cvId, result, status)` methods |
| `backend/user-service/.../features/candidate/CandidateRepository.java` | Add `@Query("{ 'cvs._id': ?0 }") Optional<Candidate> findByCvId(String cvId)` — use explicit `@Query` annotation rather than derived method name to guarantee correct BSON path matching |
| `backend/docker-compose.yaml` | Add MongoDB volume bind mount for init scripts |
| `frontend/apps/web-candidate/src/routes/_account.cv.tsx` | Replace re-analyze hook, per-CV mutation tracking, render `CvAnalysisPanel` |
| `frontend/packages/i18n/src/locales/en/common.json` | Add analysis panel i18n keys |
| `frontend/packages/i18n/src/locales/vi/common.json` | Same, Vietnamese |

---

## New Files to Create

### Backend

| File | Purpose |
|---|---|
| `ai_engine_service/.../features/analysis/dto/CvFullAnalysisRequest.java` | `String cvId` (required), `String jobId` (nullable) |
| `ai_engine_service/.../features/analysis/dto/CvFullAnalysisResponse.java` | Full combined response (see JSON schema above) |
| `ai_engine_service/.../features/analysis/dto/StrengthItem.java` | Record: `String area`, `String detail` |
| `ai_engine_service/.../features/analysis/dto/WeaknessItem.java` | Record: `String area`, `String detail` |
| `ai_engine_service/.../features/analysis/dto/ExtractJobTargetResponse.java` | Record: `String targetPosition`, `String targetDomain` |
| `ai_engine_service/src/main/resources/prompts/extract_job_target.md` | Prompt: extract target job title from CV text |
| `ai_engine_service/src/main/resources/prompts/improve_cv_structured.md` | Prompt: structured improvement (strengths/weaknesses as `{ area, detail }` objects); used only by `improveWithText()` — `improve_cv.md` unchanged |
| `user_service/.../features/candidate/dto/CvAnalysisUpdateRequest.java` | `String analysisResult`, `CvAnalysisStatus analysisStatus` |
| `user_service/.../features/candidate/dto/CvInfoResponse.java` | `String cvId`, `String cvUrl`, `String filename`, `String ownerId` |
| `backend/docker/mongo/init/01-ai-provider-seed.js` | Seed active Gemini config on fresh DB |

### Frontend

| File | Purpose |
|---|---|
| `web-candidate/src/components/cv/CvAnalysisPanel.tsx` | Inline analysis result panel; parses `analysisResult` JSON string |

---

## Prompt Spec: `extract_job_target.md`

**System persona:** You are an expert HR consultant and career coach with 15+ years experience.

**Task:** Given the full text of a CV/resume, identify the primary job title or role the candidate is targeting.

**Rules:**
- Infer from the most recent job title, summary/objective section, or dominant skill cluster.
- Output ONLY valid JSON, no markdown, no explanatory text.
- Schema: `{ "targetPosition": "string", "targetDomain": "string" }`
  - `targetPosition`: precise job title (e.g., "Senior Backend Engineer", "Product Manager")
  - `targetDomain`: industry domain (e.g., "FinTech", "E-Commerce", "General Software")

## `analyze_cv.md` — no changes needed

`overallScore` and `scoreLabel` are computed server-side in Java from the `matchScore` returned by the prompt. No prompt modification required.

## New prompt: `improve_cv_structured.md`

Copy `improve_cv.md` as the base. The existing prompt uses these template variables (populated by `PromptBuilder`): `{{JOB_TITLE}}`, `{{JOB_DESCRIPTION}}`, `{{JOB_SKILLS}}`, `{{JOB_REQUIREMENTS}}`. When called from `improveWithText(cvText, jobDescriptionText)` without a real job object, populate:
- `JOB_TITLE` = extracted `targetPosition` string
- `JOB_DESCRIPTION` = same `targetPosition` string (or the jobId-flow's JD text)
- `JOB_SKILLS` = empty string `""`
- `JOB_REQUIREMENTS` = empty string `""`

Change only the output schema — replace `List<String>` for `strengths` and `weaknesses` with structured objects:

```json
{
  "strengths": [{ "area": "string", "detail": "string" }],
  "weaknesses": [{ "area": "string", "detail": "string" }],
  "tips": [{ "area": "string", "suggestion": "string", "priority": "High|Medium|Low" }]
}
```

Add a corresponding `buildImproveStructuredPrompt(Map<String, Object> vars)` method to `PromptBuilder`. This prompt is used exclusively by `improveWithText()`. The original `improve_cv.md` (used by the public `POST /api/ai/improve` endpoint) is left unchanged.

---

## i18n Keys (add to `common.json` — both `en` and `vi`)

```json
"cv_analysis_score": "Quality Score",
"cv_analysis_target_position": "Target Position",
"cv_analysis_match_score": "Job Match",
"cv_analysis_matched_skills": "Matched Skills",
"cv_analysis_missing_skills": "Missing Skills",
"cv_analysis_extra_skills": "Extra Skills",
"cv_analysis_summary": "Summary",
"cv_analysis_strengths": "Strengths",
"cv_analysis_weaknesses": "Weaknesses",
"cv_analysis_tips": "Improvement Tips",
"cv_analysis_analyzing": "Analyzing...",
"cv_analysis_reanalyze": "Re-analyze",
"cv_analysis_retry": "Retry",
"cv_analysis_failed": "Analysis failed. Please retry.",
"cv_analysis_score_excellent": "Excellent",
"cv_analysis_score_good": "Good",
"cv_analysis_score_fair": "Fair",
"cv_analysis_score_poor": "Poor"
```

---

## Implementation Notes

- **Synchronous vs async:** The new `POST /api/ai/analyze-cv` is synchronous. The existing `CvScoringConsumer` (RabbitMQ, fires on job applications) is unchanged.
- **PDF text extraction:** `CvTextExtractor.resolveCvText(null, cvUrl)` already exists at `ai_engine_service/.../integration/cv/CvTextExtractor.java` — reuse it directly.
- **API gateway routing:** The gateway routes `Path=/ai/**` with no `StripPrefix` filter. The ai_engine_service has `server.servlet.context-path: /ai`. A browser request to `/ai/api/ai/analyze-cv` is forwarded verbatim; the service receives it correctly at `/api/ai/analyze-cv` within its context path. **No gateway route change is needed.** The browser-facing URL for the new endpoint is `POST /ai/api/ai/analyze-cv` (not `/api/ai/analyze-cv`).
- **Gemini model:** `gemini-2.0-flash`. `GeminiModelGateway` already uses the OpenAI-compatible endpoint via `OpenAiChatModel` — no new Spring AI dependencies needed.
- **MongoDB init scripts:** Named `01-ai-provider-seed.js` (no pre-existing numbered scripts for MongoDB). MongoDB init only runs on a fresh volume; document this limitation in the PR description for dev onboarding.
- **Dead config:** `app.ai.active-provider: ${AI_ACTIVE_PROVIDER:groq}` in `application.yaml` is now unused (the DB-driven router ignores it). Remove it as part of this feature.
- **`CvAnalysisPanel` is intentionally app-local** to `web-candidate` — do not add to `@smart-cv/ui`. Prop interface: `interface CvAnalysisPanelProps { analysisResultJson: string | null | undefined; analysisStatus: CvItemAnalysisStatus | undefined; onRetry: () => void; }` — the component calls `JSON.parse(analysisResultJson)` internally inside a try/catch. If parsing fails (malformed JSON), treat it identically to `analysisStatus === 'FAILED'`: show the error state with the Retry button.
- **Per-CV loading state:** Use `const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())` in the CV page. In `onMutate`: `setAnalyzingIds(prev => new Set(prev).add(cvId))`. In `onSettled` (not `onSuccess` — ensures cleanup even on error): `setAnalyzingIds(prev => { const next = new Set(prev); next.delete(cvId); return next; })`.
- **Mutation response vs re-fetch:** On mutation `onSuccess`, read `CvFullAnalysisResponse` from the mutation response and splice it back into the CV list cache:
  ```ts
  queryClient.setQueryData(getListCvsQueryKey(), (old: ListCvsResponse | undefined) => {
    if (!old?.data) return old;
    return {
      ...old,
      data: old.data.map(cv =>
        cv.id === cvId
          ? { ...cv, analysisResult: JSON.stringify(response), analysisStatus: 'DONE' }
          : cv
      ),
    };
  });
  ```
  Also call `queryClient.invalidateQueries({ queryKey: getListCvsQueryKey() })` for background consistency. (Verify the exact shape of `ListCvsResponse` from the generated Orval types before writing this updater.)

> ⚠️ **Orval regeneration prerequisite:** `pnpm generate:api` (run from `frontend/`) fetches live OpenAPI specs from running services. **ai_engine_service must be running** before regenerating, or the generated client will be stale/missing the new endpoint. After regeneration, confirm the new hook name and `CvFullAnalysisRequest` input type in `packages/api/src/generated/` before wiring it up in the CV page.

---

## Notes

- Related completed plan: `plans/issues/✅/✅20260612-1000-ai-multi-provider-db-config.md` — the multi-provider gateway this feature builds on.
- `CvItem.analysisResult` and `analysisStatus` are already in the Java model and generated TypeScript types — no schema migration needed.
- The existing `POST /api/candidates/cvs/{cvId}/reanalyze` (user-service) endpoint is left in place; the frontend simply stops calling it for this flow.
