# AI-Generated Assessment Questions

## Overview

Both `web-recruiter` and `web-candidate` have an "AI generator" dialog (`isAiDialogOpen`) that collects inputs
(job name/topic, experience level, difficulty, number of questions) and is supposed to call an AI backend to
auto-populate the assessment question list. Currently it only calls a hardcoded local mock function
(`generateMockQuestions`) and fakes a 1.2-second delay with `setTimeout`. There is no real backend endpoint.

This feature requires:
1. A new `POST /api/ai/generate-assessment` endpoint in **ai_engine_service** (port 8085).
2. A proxy endpoint `POST /api/assessments/generate-questions` in **application_service** (RECRUITER-only; see
   authorization note below).
3. A new hand-written React Query hook `useGenerateAssessmentQuestions` in `@smart-cv/api`.
4. Replacing `generateMockQuestions` + `setTimeout` with the real hook in both frontend apps
   **without changing any modal layout or styling**.

---

## Reproduction steps

1. Open `web-recruiter` → Assessments page → click "Tạo bài test" (Create Assessment).
2. Inside the form, click the "AI Generate" button.
3. Fill in job name, level, difficulty, number of questions and submit.
4. **Expected**: questions are populated from the AI backend.
5. **Actual**: `generateMockQuestions()` returns hardcoded Vietnamese Java/React/Python questions regardless
   of the inputs; the "AI" is entirely fictional. A 1.2-second `setTimeout` mimics a network call.

---

## Expected behavior

- The AI dialog submits the user inputs to a real backend endpoint.
- The backend prompts an LLM (via the existing `AiModelGatewayRouter`) and returns `N` MCQ questions
  with `text`, `options[]`, and `correctOptionIndex`.
- The generated questions replace the form's question list exactly as the mock function does today.
- Title and description are also auto-filled (same logic already exists in `handleAiConfirm`).

---

## Current behavior

`generateMockQuestions` uses keyword matching on job name (java, react, python…) and returns a fixed bank
of 6 questions. It is completely disconnected from any AI service.

---

## Impact scope

Backend:
- [ ] api-gateway *(no change — `/ai/**` already routes to port 8085)*
- [ ] user-service
- [ ] job_service
- [x] application_service *(proxy endpoint)*
- [x] ai_engine_service *(new endpoint + DTO + prompt template)*
- [ ] notification-service
- [ ] Infrastructure

Frontend:
- [x] web-candidate *(wire AI dialog — lines 92, 497–520, 994–1061)*
- [x] web-recruiter *(wire AI dialog — lines 53–418, 410–426, 1214–1312)*
- [ ] web-admin
- [ ] packages/ui
- [x] packages/api *(new hook)*
- [ ] packages/i18n

---

## Related code

### Frontend — AI dialog inputs

Both files have identical state structure:

| State variable | File (recruiter) | File (candidate) | Values |
|---|---|---|---|
| `aiJobName` | line 404 | line 498 | Free text, max 200 chars |
| `aiLevel` | line 406 | line 500 | `"Intern"` / `"Junior"` / `"Senior"` / `"Lead"` |
| `aiDifficulty` | line 405 | line 499 | Recruiter: `"Dễ"/"Trung bình"/"Khó"` · Candidate default: `"Medium"` (note: inconsistent default, irrelevant to backend — passed as-is to prompt) |
| `aiNumQuestions` | line 407 | line 501 | 1–20, parsed with `parseInt() \|\| 5` |

`handleAiConfirm`: recruiter line 410, candidate line 504.
`isAiGenerating` state: recruiter line 408, candidate line 502.

Files:
- `frontend/apps/web-recruiter/src/routes/employer.assessments.tsx`
- `frontend/apps/web-candidate/src/routes/_account.assessments.tsx`

### Frontend — API package

- New hook file: `frontend/packages/api/src/assessment-ai-hooks.ts`
- Export from: `frontend/packages/api/src/index.ts`
- Pattern to follow: `assessment-manual-hooks.ts`

### Backend — AI engine service

New files (all under `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/`):
- `dtos/request/AssessmentGenerateRequest.java`
- `dtos/response/AssessmentGenerateResponse.java`
- `dtos/response/GeneratedQuestion.java`
- `resources/prompts/generate_assessment.md`

Changes to existing files:
- `features/analysis/AnalysisController.java` — new endpoint
- `features/analysis/AnalysisService.java` — new method
- `features/analysis/PromptBuilder.java` — new `buildAssessmentGeneratePrompt`

### Backend — Application service

New files:
- `integration/ai/AiEngineClient.java` — RestTemplate-based client (follow `UserClient.java` / `JobClient.java` pattern)

Changes:
- `features/assessment/AssessmentController.java` — new proxy endpoint
- `features/assessment/AssessmentService.java` — delegate method
- `src/main/resources/application.yaml` — new `app.ai-service.base-url` property

---

## Implementation plan

### Phase 1 — AI engine service

**1. `AssessmentGenerateRequest.java`**
```java
public record AssessmentGenerateRequest(
    @NotBlank @Size(max = 200) String jobName,
    String level,
    String difficulty,
    @Min(1) @Max(20) int numQuestions
) {}
```

**2. `GeneratedQuestion.java`**
```java
public record GeneratedQuestion(String text, List<String> options, int correctOptionIndex) {}
```

**3. `AssessmentGenerateResponse.java`**
```java
public record AssessmentGenerateResponse(List<GeneratedQuestion> questions) {}
```

**4. `resources/prompts/generate_assessment.md`**

Prompt variables: `{{JOB_NAME}}`, `{{LEVEL}}`, `{{DIFFICULTY}}`, `{{NUM_QUESTIONS}}`.
The prompt must instruct the LLM to return **strict JSON only** matching:
```json
{
  "questions": [
    {
      "text": "Question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0
    }
  ]
}
```
Include a verbatim JSON example in the prompt — the existing `parse()` helper extracts JSON from
markdown fences, so the output must be parseable. Reference `interview_questions.md` for style.
Wrap user-supplied values in quotes in the prompt to reduce prompt-injection risk
(e.g. `For the position "{{JOB_NAME}}" at level "{{LEVEL}}"...`).

**5. `PromptBuilder.java` — new method**
```java
public String buildAssessmentGeneratePrompt(Map<String, Object> vars) {
    return apply(load("prompts/generate_assessment.md"), vars);
}
```
Note: all existing `PromptBuilder` methods take `Map<String, Object>`, not `Map<String, String>`.

**6. `AnalysisService.java` — new method**
```java
public AssessmentGenerateResponse generateAssessmentQuestions(AssessmentGenerateRequest request) {
    String prompt = promptBuilder.buildAssessmentGeneratePrompt(Map.of(
        "JOB_NAME", request.jobName(),
        "LEVEL", nvl(request.level()),
        "DIFFICULTY", nvl(request.difficulty()),
        "NUM_QUESTIONS", String.valueOf(request.numQuestions())
    ));
    String aiContent = callAi(prompt);
    return parse(aiContent, AssessmentGenerateResponse.class);
}
```

**7. `AnalysisController.java` — new endpoint**
```java
@PostMapping("/generate-assessment")
@PreAuthorize("hasAnyAuthority('ROLE_RECRUITER','ROLE_ADMIN')")
public ApiResponse<AssessmentGenerateResponse> generateAssessment(
        @RequestBody @Valid AssessmentGenerateRequest request) {
    return ApiResponse.<AssessmentGenerateResponse>builder()
            .data(analysisService.generateAssessmentQuestions(request))
            .message("Assessment questions generated successfully")
            .build();
}
```

**Authorization note:** CANDIDATE is excluded. Assessment creation is a RECRUITER action; allowing candidates
to drive the AI pipeline via this endpoint is an authorization escalation with no product justification.
If the candidate app's AI dialog is ever wired to a backend, it should call `/api/ai/generate-assessment`
directly (the gateway already routes `/ai/**` to port 8085 and ai_engine_service applies its own auth).

---

### Phase 2 — Application service proxy

**1. `src/main/resources/application.yaml`** — add:
```yaml
app:
  ai-service:
    base-url: ${AI_SERVICE_URL:http://localhost:8085/ai}
```
(following the existing `job-service` / `user-service` convention)

**2. `integration/ai/AiEngineClient.java`**

Follow the same pattern as `UserClient.java` / `JobClient.java`:
- Inject `RestTemplate` (use the existing `AppConfig`-configured `RestTemplate` bean)
- Inject `@Value("${app.ai-service.base-url}")` for the base URL
- Inject `@Value("${app.internal-secret}")` for `X-Gateway-Secret` header (required for all
  inter-service calls — see existing `UserClient` for the header injection pattern)
- Add a `generateQuestions(AssessmentGenerateRequest request)` method that `POST`s to
  `/api/ai/generate-assessment` and returns `AssessmentGenerateResponse`

**3. `AssessmentController.java` — new endpoint**
```java
@PostMapping("/api/assessments/generate-questions")
@PreAuthorize("hasRole('RECRUITER')")
public ApiResponse<AssessmentGenerateResponse> generateQuestions(
        @RequestBody @Valid AssessmentGenerateRequest request,
        @AuthenticationPrincipal String userId) {
    return ApiResponse.<AssessmentGenerateResponse>builder()
            .data(assessmentService.generateQuestions(request))
            .build();
}
```
Note: `@Valid` is required — without it, `@NotBlank`, `@Min`, `@Max`, `@Size` are silently ignored.

**4. `AssessmentService.java`** — add `generateQuestions(AssessmentGenerateRequest)` that delegates
to `AiEngineClient`.

**DTO note:** `AssessmentGenerateRequest` and `AssessmentGenerateResponse` / `GeneratedQuestion` should be
duplicated (or moved to a shared library) in application_service DTOs, since the service cannot import
from ai_engine_service. They are simple records — copy the definitions.

---

### Phase 3 — Frontend API package

Create `frontend/packages/api/src/assessment-ai-hooks.ts`:

```typescript
import { useMutation } from '@tanstack/react-query';
import type { UseMutationOptions } from '@tanstack/react-query';
import { customInstance } from './axios-instance';

export interface GeneratedQuestion {
  text: string;
  options: string[];
  correctOptionIndex: number;
}

export interface AssessmentGenerateRequest {
  jobName: string;
  level: string;
  difficulty: string;
  numQuestions: number;
}

// customInstance returns the raw ApiResponse<T> wrapper (axios .then(({data}) => data) unwraps
// only the Axios envelope, not the Spring ApiResponse wrapper). Type accordingly.
export interface AssessmentGenerateApiResponse {
  data: { questions: GeneratedQuestion[] };
  message?: string;
  code?: number;
}

export const useGenerateAssessmentQuestions = <TError = unknown, TContext = unknown>(
  options?: {
    mutation?: UseMutationOptions<
      AssessmentGenerateApiResponse,
      TError,
      AssessmentGenerateRequest,
      TContext
    >;
  },
) => {
  const { mutation: mutationOptions } = options ?? {};
  return useMutation<AssessmentGenerateApiResponse, TError, AssessmentGenerateRequest, TContext>({
    mutationFn: (request) =>
      customInstance<AssessmentGenerateApiResponse>({
        url: `/api/assessments/generate-questions`,
        method: 'POST',
        data: request,
      }),
    ...mutationOptions,
  });
};
```

Add to `frontend/packages/api/src/index.ts`:
```typescript
export * from './assessment-ai-hooks';
```

---

### Phase 4 — Wire frontend (both apps)

**Both files require the same change. Apply to:**
- `frontend/apps/web-recruiter/src/routes/employer.assessments.tsx`
- `frontend/apps/web-candidate/src/routes/_account.assessments.tsx`

**Step 1 — Import hook**
```typescript
import { useGenerateAssessmentQuestions } from '@smart-cv/api';
```

**Step 2 — Instantiate mutation (near other hooks)**
```typescript
const generateMutation = useGenerateAssessmentQuestions();
```

**Step 3 — Replace `handleAiConfirm`**
```typescript
const handleAiConfirm = (e: React.FormEvent) => {
  e.preventDefault();
  if (!aiJobName.trim()) {
    toast.error('Vui lòng nhập tên công việc');
    return;
  }
  generateMutation.mutate(
    { jobName: aiJobName, level: aiLevel, difficulty: aiDifficulty, numQuestions: aiNumQuestions },
    {
      onSuccess: (response) => {
        const questions = response.data?.questions ?? [];
        if (questions.length === 0) {
          toast.error('AI không tạo được câu hỏi. Vui lòng thử lại.');
          return;
        }
        const mapped: Question[] = questions.slice(0, aiNumQuestions).map((q) => ({
          id: crypto.randomUUID(),
          text: q.text,
          type: 'MCQ' as const,
          options: q.options,
          correctOptionIndex: q.correctOptionIndex,
        }));
        setQuestions(mapped);
        setTitle(`Bài test ${aiJobName} - Trình độ ${aiLevel}`);
        setDescription(
          `Bài test tự động tạo bằng AI cho vị trí ${aiJobName} (${aiLevel}) với độ khó ${aiDifficulty}.`,
        );
        setIsAiDialogOpen(false);
        toast.success('Đã tạo câu hỏi bằng AI thành công!');
      },
      onError: () => {
        toast.error('Không thể tạo câu hỏi bằng AI. Vui lòng thử lại.');
      },
    },
  );
};
```

**Critical:** `response.data.questions` is correct — `customInstance` returns the Spring `ApiResponse<T>`
wrapper as `data`, so the actual payload is at `response.data`. Do **not** write `response.questions`.

**Step 4 — Replace `isAiGenerating` with `generateMutation.isPending`**

In the JSX (no layout changes):
- `disabled={isAiGenerating}` → `disabled={generateMutation.isPending}`
- `{isAiGenerating ? 'Đang tạo bằng AI...' : 'Xác nhận tạo'}` → `{generateMutation.isPending ? 'Đang tạo bằng AI...' : 'Xác nhận tạo'}`

**Step 5 — Fix `numQuestions` parsing (both files)**

Replace:
```typescript
onChange={(e) => setAiNumQuestions(parseInt(e.target.value) || 5)}
```
With:
```typescript
onChange={(e) => setAiNumQuestions(Math.max(1, Math.min(20, parseInt(e.target.value) || 5)))}
```
This prevents negative values and values > 20 from reaching the backend.

**Step 6 — Delete dead code**

Remove the `generateMockQuestions` function entirely (recruiter: lines 53–292; candidate: lines 92–290).
Remove `isAiGenerating` state and `setIsAiGenerating` calls.

---

## Notes

- **Gateway routing:** No changes needed. `/api/assessments/**` is already forwarded by `getPrefixedUrl` to
  `/application/api/assessments/...` → application_service port 8083. The AI service endpoint
  `/api/ai/generate-assessment` is reached via the ai_engine_service directly from application_service
  (internal call, not through the gateway).
- **DTO duplication:** `AssessmentGenerateRequest` / `AssessmentGenerateResponse` / `GeneratedQuestion`
  must exist in both ai_engine_service and application_service. Java microservices cannot share classes
  across services; copy the records.
- **Prompt injection mitigation:** Quote user-supplied values in the prompt template and cap `jobName` at
  200 chars with `@Size(max=200)`. Full sanitization is beyond scope but the caps reduce the attack surface.
- **Rate limiting:** The AI generation endpoint is significantly more expensive than CRUD operations.
  Adding a dedicated per-user rate limit (e.g., 2 req/min, keyed on `X-User-Id`) in the gateway's
  `ai-service` route is recommended but out of scope for this issue.
- **Related issues:** `20260623_1530_assessment-candidate-flow-recruiter-publish.md`,
  `20260623_1630_assessment-manager-real-api-wiring.md`.
