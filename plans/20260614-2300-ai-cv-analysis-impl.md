# AI CV Analysis Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement end-to-end AI CV analysis — new `POST /ai/api/ai/analyze-cv` endpoint that scores a CV, extracts skills, generates improvement tips; seed Gemini as default active AI provider; render results in an expandable inline panel on the candidate CV page.

**Architecture:** Four sequential layers — (1) infrastructure (MongoDB seed + Docker volume), (2) user-service internal endpoints for CV lookup and result persistence, (3) ai_engine_service analysis endpoint with two parallel AI calls when a `jobId` is provided, (4) frontend panel + rewiring. Each layer depends on the previous.

**Tech Stack:** Spring Boot 3.5.14 + Spring Data MongoDB (user-service), Spring AI 1.1.5 + `CompletableFuture` (ai_engine_service), React 19 + TanStack Query v5 + Orval (frontend). Tests: JUnit 5 + Mockito + AssertJ.

**Context:**
- user-service dir: `backend/user-service/` · package: `vn.chuongpl.user_service`
- ai_engine_service dir: `backend/ai_engine_service/` · package: `vn.chuongpl.ai_engine_service`
- Run single test: `cd backend/<service> && ./mvnw test -Dtest=<TestClassName> -q`
- Compile check: `cd backend/<service> && ./mvnw compile -q`
- Frontend lint/build: `cd frontend && pnpm -F web-candidate lint` / `pnpm -F web-candidate build`
- Spec: `plans/issues/20260614_2230_ai-cv-analysis-gemini-default.md`

---

## File Map

**New files created in this plan:**

| Path | Role |
|---|---|
| `backend/docker/mongo/init/01-ai-provider-seed.js` | Seeds Gemini as active AI provider on first MongoDB init |
| `backend/ai_engine_service/src/main/java/.../dtos/request/CvFullAnalysisRequest.java` | Request DTO: `cvId` (required) + `jobId` (nullable) |
| `backend/ai_engine_service/src/main/java/.../dtos/response/CvFullAnalysisResponse.java` | Full analysis result returned to client and persisted |
| `backend/ai_engine_service/src/main/java/.../dtos/response/StrengthItem.java` | Record `{ area, detail }` |
| `backend/ai_engine_service/src/main/java/.../dtos/response/WeaknessItem.java` | Record `{ area, detail }` |
| `backend/ai_engine_service/src/main/java/.../dtos/response/ExtractJobTargetResponse.java` | AI response `{ targetPosition, targetDomain }` |
| `backend/ai_engine_service/src/main/java/.../dtos/response/CvImproveStructuredResponse.java` | AI improvement result with structured strengths/weaknesses (used internally) |
| `backend/ai_engine_service/src/main/java/.../integration/user/CvInfoResponse.java` | CV lookup result from user-service (cvId, cvUrl, filename, ownerId) |
| `backend/ai_engine_service/src/main/resources/prompts/extract_job_target.md` | AI prompt: extract target job title/domain from CV text |
| `backend/ai_engine_service/src/main/resources/prompts/improve_cv_structured.md` | AI prompt: improvement tips with structured strengths/weaknesses |
| `backend/ai_engine_service/src/test/java/.../AnalysisServiceCvFullTest.java` | Tests for new `AnalysisService` methods |
| `backend/user-service/src/main/java/.../features/candidate/dto/CvInfoResponse.java` | Response DTO for `GET /api/internal/candidates/cvs/{cvId}` |
| `backend/user-service/src/main/java/.../features/candidate/dto/CvAnalysisUpdateRequest.java` | Request DTO for `PATCH /api/internal/candidates/cvs/{cvId}/analysis` |
| `backend/user-service/src/test/java/.../CvAnalysisInternalTest.java` | Tests for new `CandidateService` + `InternalCandidateController` methods |
| `frontend/apps/web-candidate/src/components/cv/CvAnalysisPanel.tsx` | App-local inline analysis result panel component |

**Modified files:**

| Path | Change |
|---|---|
| `backend/docker-compose.yaml` | Add MongoDB init volume bind mount |
| `backend/ai_engine_service/src/main/java/.../enums/ErrorCode.java` | Add `CV_NOT_FOUND(8010)`, `USER_SERVICE_UNAVAILABLE(8011)` |
| `backend/ai_engine_service/src/main/java/.../integration/user/UserClient.java` | Add `getCvInfo()`, `updateCvAnalysis()`, private `buildInternalHeaders()` |
| `backend/ai_engine_service/src/main/java/.../features/analysis/PromptBuilder.java` | Add `buildExtractJobTargetPrompt()`, `buildImproveStructuredPrompt()` |
| `backend/ai_engine_service/src/main/java/.../features/analysis/AnalysisService.java` | Add `extractJobTarget()`, `analyzeWithText()`, `improveWithText()`, `analyzeCv()`, `computeScoreLabel()` |
| `backend/ai_engine_service/src/main/java/.../features/analysis/AnalysisController.java` | Add `POST /analyze-cv` endpoint |
| `backend/ai_engine_service/src/main/resources/application.yaml` | Remove dead `app.ai.active-provider` property |
| `backend/user-service/src/main/java/.../features/candidate/CandidateRepository.java` | Add `findByCvId(@Query)` |
| `backend/user-service/src/main/java/.../features/candidate/CandidateService.java` | Add `getCvInfo()`, `updateCvAnalysis()` |
| `backend/user-service/src/main/java/.../features/candidate/InternalCandidateController.java` | Add `GET /cvs/{cvId}` and `PATCH /cvs/{cvId}/analysis` |
| `frontend/apps/web-candidate/src/routes/_account.cv.tsx` | Replace re-analyze hook; add per-CV loading `Set`; render `CvAnalysisPanel` |
| `frontend/packages/i18n/src/locales/en/common.json` | Add 16 `cv_analysis_*` keys |
| `frontend/packages/i18n/src/locales/vi/common.json` | Add 16 `cv_analysis_*` keys (Vietnamese) |

---

## Task 1: Infrastructure — MongoDB init script

**Files:**
- Create: `backend/docker/mongo/init/01-ai-provider-seed.js`
- Modify: `backend/docker-compose.yaml`

- [ ] **Step 1.1: Create the MongoDB seed directory and script**

```bash
mkdir -p backend/docker/mongo/init
```

Create `backend/docker/mongo/init/01-ai-provider-seed.js`:

```js
// Seeds Gemini as the active AI provider on first MongoDB container initialization.
// This script only runs when the MongoDB data volume is created for the first time.
// If the volume already exists, call the admin API manually:
//   PUT /ai/api/ai/admin/providers/GEMINI (with body), then
//   PUT /ai/api/ai/admin/providers/GEMINI/activate
db = db.getSiblingDB('ai_engine_db');
if (db.ai_provider_configs.countDocuments({ active: true }) === 0) {
  db.ai_provider_configs.insertOne({
    provider: 'GEMINI',
    apiKey: process.env.GEMINI_API_KEY || 'REPLACE_WITH_GEMINI_API_KEY',
    model: 'gemini-2.0-flash',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    active: true,
    updatedAt: new Date(),
  });
  print('Seeded Gemini as active AI provider.');
} else {
  print('Active provider already exists — skipping seed.');
}
```

- [ ] **Step 1.2: Add the MongoDB init volume bind mount to docker-compose.yaml**

Find the `mongodb` service block in `backend/docker-compose.yaml` and add the bind mount under `volumes`. It should look similar to this — locate the exact existing `mongodb_data_vol:/data/db` line and add one line after it:

```yaml
      - ./docker/mongo/init:/docker-entrypoint-initdb.d:ro
```

The `mongodb` service `volumes` block should become:
```yaml
    volumes:
      - mongodb_data_vol:/data/db
      - ./docker/mongo/init:/docker-entrypoint-initdb.d:ro
```

- [ ] **Step 1.3: Commit**

```bash
git add backend/docker/mongo/init/01-ai-provider-seed.js backend/docker-compose.yaml
git commit -m "chore(infra): add Gemini default AI provider seed script"
```

---

## Task 2: user-service — DTOs

**Files:**
- Create: `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/dto/CvInfoResponse.java`
- Create: `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/dto/CvAnalysisUpdateRequest.java`

- [ ] **Step 2.1: Create the dto directory and CvInfoResponse**

```bash
mkdir -p backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/dto
```

Create `CvInfoResponse.java`:

```java
package vn.chuongpl.user_service.features.candidate.dto;

public record CvInfoResponse(
        String cvId,
        String cvUrl,
        String filename,
        String ownerId
) {}
```

- [ ] **Step 2.2: Create CvAnalysisUpdateRequest**

Create `CvAnalysisUpdateRequest.java`:

```java
package vn.chuongpl.user_service.features.candidate.dto;

import vn.chuongpl.user_service.features.candidate.CvAnalysisStatus;

public record CvAnalysisUpdateRequest(
        String analysisResult,
        CvAnalysisStatus analysisStatus
) {}
```

- [ ] **Step 2.3: Compile check**

```bash
cd backend/user-service && ./mvnw compile -q
```

Expected: BUILD SUCCESS with no errors.

- [ ] **Step 2.4: Commit**

```bash
git add backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/dto/
git commit -m "feat(user-service): add CvInfoResponse and CvAnalysisUpdateRequest DTOs"
```

---

## Task 3: user-service — CandidateRepository query + CandidateService methods (TDD)

**Files:**
- Modify: `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/CandidateRepository.java`
- Modify: `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/CandidateService.java`
- Create: `backend/user-service/src/test/java/vn/chuongpl/user_service/CvAnalysisInternalTest.java`

- [ ] **Step 3.1: Write the failing tests**

Create `backend/user-service/src/test/java/vn/chuongpl/user_service/CvAnalysisInternalTest.java`:

```java
package vn.chuongpl.user_service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateRepository;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.candidate.CvAnalysisStatus;
import vn.chuongpl.user_service.features.candidate.CvItem;
import vn.chuongpl.user_service.features.candidate.dto.CvInfoResponse;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CvAnalysisInternalTest {

    @Mock
    CandidateRepository candidateRepository;

    @InjectMocks
    CandidateService candidateService;

    private Candidate candidate;
    private CvItem cv;

    @BeforeEach
    void setUp() {
        cv = CvItem.builder()
                .id("cv-1")
                .url("https://s3.example.com/cvs/cv.pdf")
                .filename("my-cv.pdf")
                .analysisStatus(CvAnalysisStatus.PENDING)
                .build();

        candidate = Candidate.builder()
                .id("cand-1")
                .userId("user-1")
                .cvs(new ArrayList<>(List.of(cv)))
                .build();
    }

    // ── getCvInfo ─────────────────────────────────────────────────────────────

    @Test
    void getCvInfo_returns_cv_info_with_owner() {
        when(candidateRepository.findByCvId("cv-1")).thenReturn(Optional.of(candidate));

        CvInfoResponse result = candidateService.getCvInfo("cv-1");

        assertThat(result.cvId()).isEqualTo("cv-1");
        assertThat(result.cvUrl()).isEqualTo("https://s3.example.com/cvs/cv.pdf");
        assertThat(result.filename()).isEqualTo("my-cv.pdf");
        assertThat(result.ownerId()).isEqualTo("user-1");
    }

    @Test
    void getCvInfo_throws_CV_NOT_FOUND_when_no_candidate_owns_the_cv() {
        when(candidateRepository.findByCvId("unknown")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> candidateService.getCvInfo("unknown"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.CV_NOT_FOUND));
    }

    // ── updateCvAnalysis ──────────────────────────────────────────────────────

    @Test
    void updateCvAnalysis_sets_result_and_status_then_saves() {
        when(candidateRepository.findByCvId("cv-1")).thenReturn(Optional.of(candidate));
        when(candidateRepository.save(any())).thenReturn(candidate);

        candidateService.updateCvAnalysis("cv-1", "{\"overallScore\":78}", CvAnalysisStatus.DONE);

        ArgumentCaptor<Candidate> captor = ArgumentCaptor.forClass(Candidate.class);
        verify(candidateRepository).save(captor.capture());
        CvItem updated = captor.getValue().getCvs().stream()
                .filter(c -> "cv-1".equals(c.getId()))
                .findFirst().orElseThrow();
        assertThat(updated.getAnalysisResult()).isEqualTo("{\"overallScore\":78}");
        assertThat(updated.getAnalysisStatus()).isEqualTo(CvAnalysisStatus.DONE);
    }

    @Test
    void updateCvAnalysis_throws_CV_NOT_FOUND_when_cv_absent() {
        when(candidateRepository.findByCvId("ghost")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> candidateService.updateCvAnalysis("ghost", "{}", CvAnalysisStatus.FAILED))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.CV_NOT_FOUND));
    }
}
```

- [ ] **Step 3.2: Run tests — verify they fail**

```bash
cd backend/user-service && ./mvnw test -Dtest=CvAnalysisInternalTest -q 2>&1 | tail -20
```

Expected: FAIL — `findByCvId` method not found on repository, `getCvInfo`/`updateCvAnalysis` not found on service.

- [ ] **Step 3.3: Add findByCvId to CandidateRepository**

Open `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/CandidateRepository.java` and add after the existing methods:

```java
import org.springframework.data.mongodb.repository.Query;

// ...existing methods...

@Query("{ 'cvs.id': ?0, 'deleted': false }")
Optional<Candidate> findByCvId(String cvId);
```

> Note: `CvItem.id` is stored as `id` (not `_id`) in MongoDB because it is an embedded document without `@Id`. If this query returns empty unexpectedly, try `'cvs._id'` instead.

- [ ] **Step 3.4: Add getCvInfo and updateCvAnalysis to CandidateService**

Open `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/CandidateService.java`.

Add these imports if not present:
```java
import vn.chuongpl.user_service.features.candidate.dto.CvAnalysisUpdateRequest;
import vn.chuongpl.user_service.features.candidate.dto.CvInfoResponse;
```

Add these methods to the class body (after the existing `markCvReanalyzing` method, around line 248):

```java
public CvInfoResponse getCvInfo(String cvId) {
    Candidate candidate = candidateRepository.findByCvId(cvId)
            .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
    CvItem cv = candidate.getCvs().stream()
            .filter(c -> cvId.equals(c.getId()))
            .findFirst()
            .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
    return new CvInfoResponse(cv.getId(), cv.getUrl(), cv.getFilename(), candidate.getUserId());
}

public void updateCvAnalysis(String cvId, String analysisResult, CvAnalysisStatus status) {
    Candidate candidate = candidateRepository.findByCvId(cvId)
            .orElseThrow(() -> new AppException(ErrorCode.CV_NOT_FOUND));
    candidate.getCvs().stream()
            .filter(c -> cvId.equals(c.getId()))
            .findFirst()
            .ifPresent(cv -> {
                cv.setAnalysisResult(analysisResult);
                cv.setAnalysisStatus(status);
            });
    candidateRepository.save(candidate);
}
```

- [ ] **Step 3.5: Run tests — verify they pass**

```bash
cd backend/user-service && ./mvnw test -Dtest=CvAnalysisInternalTest -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS, 4 tests passing.

- [ ] **Step 3.6: Compile check**

```bash
cd backend/user-service && ./mvnw compile -q
```

- [ ] **Step 3.7: Commit**

```bash
git add backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/CandidateRepository.java \
        backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/CandidateService.java \
        backend/user-service/src/test/java/vn/chuongpl/user_service/CvAnalysisInternalTest.java
git commit -m "feat(user-service): add getCvInfo and updateCvAnalysis service methods"
```

---

## Task 4: user-service — InternalCandidateController new endpoints (TDD)

**Files:**
- Modify: `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/InternalCandidateController.java`
- Modify: `backend/user-service/src/test/java/vn/chuongpl/user_service/CvAnalysisInternalTest.java` (add controller tests)

- [ ] **Step 4.1: Add controller tests to CvAnalysisInternalTest.java**

Add these imports at the top of `CvAnalysisInternalTest.java`:

```java
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.test.web.servlet.MockMvc;
// (controller tests are separate — add as a nested class or a new test class)
```

Actually, add a **separate** test class file: `backend/user-service/src/test/java/vn/chuongpl/user_service/InternalCandidateControllerTest.java`:

```java
package vn.chuongpl.user_service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.candidate.CvAnalysisStatus;
import vn.chuongpl.user_service.features.candidate.InternalCandidateController;
import vn.chuongpl.user_service.features.candidate.dto.CvAnalysisUpdateRequest;
import vn.chuongpl.user_service.features.candidate.dto.CvInfoResponse;

import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(InternalCandidateController.class)
class InternalCandidateControllerTest {

    @Autowired
    MockMvc mockMvc;

    @MockBean
    CandidateService candidateService;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void getCvInfo_returns_200_with_cv_data() throws Exception {
        CvInfoResponse info = new CvInfoResponse("cv-1", "https://s3.example.com/cv.pdf", "cv.pdf", "user-1");
        when(candidateService.getCvInfo("cv-1")).thenReturn(info);

        mockMvc.perform(get("/api/internal/candidates/cvs/cv-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.cvId").value("cv-1"))
                .andExpect(jsonPath("$.data.ownerId").value("user-1"));
    }

    @Test
    void updateCvAnalysis_returns_200() throws Exception {
        CvAnalysisUpdateRequest req = new CvAnalysisUpdateRequest("{\"overallScore\":78}", CvAnalysisStatus.DONE);
        doNothing().when(candidateService).updateCvAnalysis("cv-1", req.analysisResult(), req.analysisStatus());

        mockMvc.perform(patch("/api/internal/candidates/cvs/cv-1/analysis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(req)))
                .andExpect(status().isOk());
    }
}
```

- [ ] **Step 4.2: Run tests — verify they fail**

```bash
cd backend/user-service && ./mvnw test -Dtest=InternalCandidateControllerTest -q 2>&1 | tail -20
```

Expected: FAIL — endpoints not found (404s).

- [ ] **Step 4.3: Add the two endpoints to InternalCandidateController**

Open `backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/InternalCandidateController.java` and update to:

```java
package vn.chuongpl.user_service.features.candidate;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.request.SkillMergeRequest;
import vn.chuongpl.user_service.features.candidate.dto.CvAnalysisUpdateRequest;
import vn.chuongpl.user_service.features.candidate.dto.CvInfoResponse;

@RestController
@RequestMapping("/api/internal/candidates")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class InternalCandidateController {

    CandidateService candidateService;

    @PatchMapping("/by-user/{userId}/skills")
    public ApiResponse<Void> mergeSkills(@PathVariable String userId,
                                         @RequestBody SkillMergeRequest request) {
        candidateService.mergeSkills(userId, request.getSkills());
        return ApiResponse.<Void>builder().message("Skills merged").build();
    }

    @GetMapping("/cvs/{cvId}")
    public ApiResponse<CvInfoResponse> getCvInfo(@PathVariable String cvId) {
        return ApiResponse.<CvInfoResponse>builder()
                .data(candidateService.getCvInfo(cvId))
                .message("CV info retrieved")
                .build();
    }

    @PatchMapping("/cvs/{cvId}/analysis")
    public ApiResponse<Void> updateCvAnalysis(@PathVariable String cvId,
                                               @RequestBody CvAnalysisUpdateRequest request) {
        candidateService.updateCvAnalysis(cvId, request.analysisResult(), request.analysisStatus());
        return ApiResponse.<Void>builder().message("CV analysis updated").build();
    }
}
```

- [ ] **Step 4.4: Run all tests — verify they pass**

```bash
cd backend/user-service && ./mvnw test -Dtest="CvAnalysisInternalTest,InternalCandidateControllerTest" -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS, 6 tests passing.

> Note: `@WebMvcTest` for `InternalCandidateController` requires security autoconfiguration to be permissive. If you get 401/403 responses, add `@AutoConfigureMockMvc(addFilters = false)` to the test class.

- [ ] **Step 4.5: Commit**

```bash
git add backend/user-service/src/main/java/vn/chuongpl/user_service/features/candidate/InternalCandidateController.java \
        backend/user-service/src/test/java/vn/chuongpl/user_service/InternalCandidateControllerTest.java
git commit -m "feat(user-service): add internal CV info lookup and analysis persistence endpoints"
```

---

## Task 5: ai_engine_service — Error codes + new DTOs

**Files:**
- Modify: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/enums/ErrorCode.java`
- Create: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/request/CvFullAnalysisRequest.java`
- Create: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/response/CvFullAnalysisResponse.java`
- Create: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/response/StrengthItem.java`
- Create: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/response/WeaknessItem.java`
- Create: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/response/ExtractJobTargetResponse.java`
- Create: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/response/CvImproveStructuredResponse.java`
- Create: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/integration/user/CvInfoResponse.java`

- [ ] **Step 5.1: Add two error codes to ai_engine_service ErrorCode.java**

Open `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/enums/ErrorCode.java` and add after the last entry (`PROVIDER_ACTIVE`):

```java
    CV_NOT_FOUND(8010, "CV not found"),
    USER_SERVICE_UNAVAILABLE(8011, "User service is currently unavailable");
```

- [ ] **Step 5.2: Create CvFullAnalysisRequest**

```java
// backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/request/CvFullAnalysisRequest.java
package vn.chuongpl.ai_engine_service.dtos.request;

import jakarta.validation.constraints.NotBlank;

public record CvFullAnalysisRequest(
        @NotBlank String cvId,
        String jobId  // nullable — if null, target position is extracted from CV
) {}
```

- [ ] **Step 5.3: Create StrengthItem and WeaknessItem**

```java
// .../dtos/response/StrengthItem.java
package vn.chuongpl.ai_engine_service.dtos.response;

public record StrengthItem(String area, String detail) {}
```

```java
// .../dtos/response/WeaknessItem.java
package vn.chuongpl.ai_engine_service.dtos.response;

public record WeaknessItem(String area, String detail) {}
```

- [ ] **Step 5.4: Create ExtractJobTargetResponse**

```java
// .../dtos/response/ExtractJobTargetResponse.java
package vn.chuongpl.ai_engine_service.dtos.response;

public record ExtractJobTargetResponse(String targetPosition, String targetDomain) {}
```

- [ ] **Step 5.5: Create CvImproveStructuredResponse**

```java
// .../dtos/response/CvImproveStructuredResponse.java
package vn.chuongpl.ai_engine_service.dtos.response;

import vn.chuongpl.ai_engine_service.dtos.response.CvImprovementResponse.ImprovementTip;
import java.util.List;

public record CvImproveStructuredResponse(
        List<StrengthItem> strengths,
        List<WeaknessItem> weaknesses,
        List<ImprovementTip> tips
) {}
```

- [ ] **Step 5.6: Create CvFullAnalysisResponse**

```java
// .../dtos/response/CvFullAnalysisResponse.java
package vn.chuongpl.ai_engine_service.dtos.response;

import vn.chuongpl.ai_engine_service.dtos.response.CvImprovementResponse.ImprovementTip;
import java.util.List;

public record CvFullAnalysisResponse(
        int overallScore,
        String scoreLabel,
        String targetPosition,
        int matchScore,
        List<String> matchedSkills,
        List<String> missingSkills,
        List<String> extraSkills,
        String summary,
        List<StrengthItem> strengths,
        List<WeaknessItem> weaknesses,
        List<ImprovementTip> tips,
        List<String> extractedSkills
) {}
```

- [ ] **Step 5.7: Create CvInfoResponse in integration/user**

```java
// .../integration/user/CvInfoResponse.java
package vn.chuongpl.ai_engine_service.integration.user;

public record CvInfoResponse(
        String cvId,
        String cvUrl,
        String filename,
        String ownerId
) {}
```

- [ ] **Step 5.8: Compile check**

```bash
cd backend/ai_engine_service && ./mvnw compile -q
```

Expected: BUILD SUCCESS.

- [ ] **Step 5.9: Commit**

```bash
git add backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/enums/ErrorCode.java \
        backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/ \
        backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/integration/user/CvInfoResponse.java
git commit -m "feat(ai-engine): add CV analysis DTOs and error codes"
```

---

## Task 6: ai_engine_service — New prompts + PromptBuilder methods (TDD)

**Files:**
- Create: `backend/ai_engine_service/src/main/resources/prompts/extract_job_target.md`
- Create: `backend/ai_engine_service/src/main/resources/prompts/improve_cv_structured.md`
- Modify: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/PromptBuilder.java`

- [ ] **Step 6.1: Write the failing PromptBuilder tests**

Open the existing test file (likely `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/PromptBuilderTest.java` if it exists, or create a new one at that path):

```java
package vn.chuongpl.ai_engine_service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import vn.chuongpl.ai_engine_service.features.analysis.PromptBuilder;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class PromptBuilderNewMethodsTest {

    @Autowired
    PromptBuilder promptBuilder;

    @Test
    void buildExtractJobTargetPrompt_contains_cv_text() {
        String prompt = promptBuilder.buildExtractJobTargetPrompt(
                Map.of("CV_TEXT", "John Smith, Java Developer with 5 years experience"));
        assertThat(prompt).contains("John Smith");
        assertThat(prompt).contains("targetPosition");
    }

    @Test
    void buildImproveStructuredPrompt_contains_cv_and_job_vars() {
        String prompt = promptBuilder.buildImproveStructuredPrompt(Map.of(
                "CV_TEXT", "Java Developer",
                "JOB_TITLE", "Backend Engineer",
                "JOB_DESCRIPTION", "Build APIs",
                "JOB_SKILLS", "Java, Spring Boot",
                "JOB_REQUIREMENTS", "3+ years"
        ));
        assertThat(prompt).contains("Java Developer");
        assertThat(prompt).contains("Backend Engineer");
        assertThat(prompt).contains("area");
        assertThat(prompt).contains("detail");
    }
}
```

- [ ] **Step 6.2: Run tests — verify they fail**

```bash
cd backend/ai_engine_service && ./mvnw test -Dtest=PromptBuilderNewMethodsTest -q 2>&1 | tail -15
```

Expected: FAIL — methods not found.

- [ ] **Step 6.3: Create extract_job_target.md prompt**

Create `backend/ai_engine_service/src/main/resources/prompts/extract_job_target.md`:

```markdown
# Task: Extract Target Job Title from CV

Given the full text of a candidate's CV/resume, identify the primary job title or role
the candidate is targeting.

---

## Candidate CV

{{CV_TEXT}}

---

## Instructions

1. Identify the target role from (in priority order):
   - An explicit "Objective" or "Summary" section
   - The most recent job title in the work history
   - The dominant skill cluster (e.g., mostly Java + Spring → Backend Engineer)

2. Be specific: prefer "Senior Backend Engineer" over "Software Engineer".

3. Output ONLY valid JSON. No markdown. No explanation. No trailing text.

---

## Output Format

```json
{
  "targetPosition": "Senior Backend Software Engineer",
  "targetDomain": "FinTech"
}
```

`targetPosition`: precise job title  
`targetDomain`: industry domain (e.g., "FinTech", "E-Commerce", "General Software", "Healthcare")
```

- [ ] **Step 6.4: Create improve_cv_structured.md prompt**

Create `backend/ai_engine_service/src/main/resources/prompts/improve_cv_structured.md`:

```markdown
# Task: Generate Structured CV Improvement Suggestions

Provide concrete, prioritized advice to help the candidate improve their CV specifically
for the target job.

---

## Job Details

**Title:** {{JOB_TITLE}}

**Job Description:**
{{JOB_DESCRIPTION}}

**Required Skills:**
{{JOB_SKILLS}}

**Requirements:**
- {{JOB_REQUIREMENTS}}

---

## Candidate CV

{{CV_TEXT}}

---

## Instructions

Produce three sections:

### 1. `strengths` (array of objects)
What the candidate already does well relative to this job. Be specific — name skills,
experiences, or achievements from the CV that are directly relevant. 3–5 items.
Each item: `{ "area": "category name", "detail": "specific observation from CV" }`

### 2. `weaknesses` (array of objects)
Gaps between the CV and the job requirements. Name the specific missing skill or thin area.
Do not repeat items from `strengths`. 2–5 items. Honest — do not sugarcoat.
Each item: `{ "area": "category name", "detail": "specific gap" }`

### 3. `tips` (array of ImprovementTip objects)
Ordered from highest to lowest impact. Each tip:
- `area`: one of `"Skills"`, `"Experience"`, `"Keywords"`, `"Format"`, `"Projects"`,
  `"Education"`, `"Certifications"`.
- `suggestion`: specific, actionable advice (1–3 sentences). Name exact tools, courses,
  certifications, or actions.
- `priority`: `"High"` (must fix to be competitive), `"Medium"` (would significantly help),
  or `"Low"` (nice-to-have polish).

Minimum 3 tips, maximum 7. At least one `"High"` priority if there are gaps.
Each tip must address a different `area`.

Return ONLY the JSON object below. No markdown. No explanation.

```json
{
  "strengths": [{ "area": "...", "detail": "..." }],
  "weaknesses": [{ "area": "...", "detail": "..." }],
  "tips": [{ "area": "...", "suggestion": "...", "priority": "High" }]
}
```
```

- [ ] **Step 6.5: Add the two methods to PromptBuilder**

Open `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/PromptBuilder.java` and add after `buildExtractSkillsPrompt`:

```java
public String buildExtractJobTargetPrompt(Map<String, Object> vars) {
    return apply(load("prompts/extract_job_target.md"), vars);
}

public String buildImproveStructuredPrompt(Map<String, Object> vars) {
    return apply(load("prompts/improve_cv_structured.md"), vars);
}
```

- [ ] **Step 6.6: Run tests — verify they pass**

```bash
cd backend/ai_engine_service && ./mvnw test -Dtest=PromptBuilderNewMethodsTest -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS, 2 tests passing.

- [ ] **Step 6.7: Commit**

```bash
git add backend/ai_engine_service/src/main/resources/prompts/extract_job_target.md \
        backend/ai_engine_service/src/main/resources/prompts/improve_cv_structured.md \
        backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/PromptBuilder.java \
        backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/PromptBuilderNewMethodsTest.java
git commit -m "feat(ai-engine): add extract_job_target and improve_cv_structured prompts"
```

---

## Task 7: ai_engine_service — UserClient new methods (TDD)

**Files:**
- Modify: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/integration/user/UserClient.java`
- Create: `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/UserClientTest.java`

- [ ] **Step 7.1: Write the failing tests**

Create `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/UserClientTest.java`:

```java
package vn.chuongpl.ai_engine_service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.ResponseEntity;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.integration.user.CvInfoResponse;
import vn.chuongpl.ai_engine_service.integration.user.UserClient;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserClientTest {

    @Mock
    RestTemplate restTemplate;

    UserClient userClient;

    @BeforeEach
    void setUp() {
        userClient = new UserClient(restTemplate);
        ReflectionTestUtils.setField(userClient, "baseUrl", "http://localhost:8081/user");
        ReflectionTestUtils.setField(userClient, "gatewaySecret", "test-secret");
    }

    @Test
    void getCvInfo_returns_parsed_response() {
        Map<String, Object> body = Map.of("data", Map.of(
                "cvId", "cv-1",
                "cvUrl", "https://s3.example.com/cv.pdf",
                "filename", "cv.pdf",
                "ownerId", "user-1"
        ));
        when(restTemplate.exchange(
                eq("http://localhost:8081/user/api/internal/candidates/cvs/cv-1"),
                eq(HttpMethod.GET),
                any(),
                eq(Map.class)
        )).thenReturn(ResponseEntity.ok(body));

        CvInfoResponse result = userClient.getCvInfo("cv-1");

        assertThat(result.cvId()).isEqualTo("cv-1");
        assertThat(result.cvUrl()).isEqualTo("https://s3.example.com/cv.pdf");
        assertThat(result.filename()).isEqualTo("cv.pdf");
        assertThat(result.ownerId()).isEqualTo("user-1");
    }

    @Test
    void getCvInfo_throws_CV_NOT_FOUND_on_404() {
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenThrow(HttpClientErrorException.NotFound.class);

        assertThatThrownBy(() -> userClient.getCvInfo("missing"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.CV_NOT_FOUND));
    }

    @Test
    void getCvInfo_throws_USER_SERVICE_UNAVAILABLE_on_generic_error() {
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.GET), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("connection refused"));

        assertThatThrownBy(() -> userClient.getCvInfo("cv-1"))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.USER_SERVICE_UNAVAILABLE));
    }

    @Test
    void updateCvAnalysis_calls_patch_endpoint() {
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.PATCH), any(), eq(Map.class)))
                .thenReturn(ResponseEntity.ok(Map.of()));

        userClient.updateCvAnalysis("cv-1", "{\"score\":78}", "DONE");

        verify(restTemplate).exchange(
                eq("http://localhost:8081/user/api/internal/candidates/cvs/cv-1/analysis"),
                eq(HttpMethod.PATCH),
                any(),
                eq(Map.class)
        );
    }

    @Test
    void updateCvAnalysis_silently_continues_on_error() {
        when(restTemplate.exchange(any(String.class), eq(HttpMethod.PATCH), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("timeout"));

        // Should NOT throw
        userClient.updateCvAnalysis("cv-1", "{}", "DONE");
    }
}
```

- [ ] **Step 7.2: Run tests — verify they fail**

```bash
cd backend/ai_engine_service && ./mvnw test -Dtest=UserClientTest -q 2>&1 | tail -15
```

Expected: FAIL — `getCvInfo`, `updateCvAnalysis` not found.

- [ ] **Step 7.3: Implement UserClient new methods**

Open `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/integration/user/UserClient.java` and replace its entire content with:

```java
package vn.chuongpl.ai_engine_service.integration.user;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestTemplate;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Component
@RequiredArgsConstructor
@Slf4j
public class UserClient {

    private final RestTemplate restTemplate;

    @Value("${app.user-service.base-url}")
    private String baseUrl;

    @Value("${app.gateway.internal-secret}")
    private String gatewaySecret;

    public void mergeSkills(String userId, List<String> skills) {
        try {
            List<String> safeSkills = skills == null ? Collections.emptyList() : skills;
            restTemplate.exchange(
                    baseUrl + "/api/internal/candidates/by-user/" + userId + "/skills",
                    HttpMethod.PATCH,
                    new HttpEntity<>(Map.of("skills", safeSkills), buildInternalHeaders()),
                    Void.class
            );
        } catch (Exception e) {
            log.error("Failed to merge skills for userId={}: {}", userId, e.getMessage());
        }
    }

    public CvInfoResponse getCvInfo(String cvId) {
        try {
            var response = restTemplate.exchange(
                    baseUrl + "/api/internal/candidates/cvs/" + cvId,
                    HttpMethod.GET,
                    new HttpEntity<>(buildInternalHeaders()),
                    Map.class
            );
            @SuppressWarnings("unchecked")
            Map<String, Object> data = (Map<String, Object>) Objects.requireNonNull(
                    response.getBody()).get("data");
            return new CvInfoResponse(
                    (String) data.get("cvId"),
                    (String) data.get("cvUrl"),
                    (String) data.get("filename"),
                    (String) data.get("ownerId")
            );
        } catch (HttpClientErrorException.NotFound e) {
            throw new AppException(ErrorCode.CV_NOT_FOUND);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("Failed to get CV info for cvId={}: {}", cvId, e.getMessage());
            throw new AppException(ErrorCode.USER_SERVICE_UNAVAILABLE);
        }
    }

    public void updateCvAnalysis(String cvId, String analysisResultJson, String status) {
        try {
            restTemplate.exchange(
                    baseUrl + "/api/internal/candidates/cvs/" + cvId + "/analysis",
                    HttpMethod.PATCH,
                    new HttpEntity<>(
                            Map.of("analysisResult", analysisResultJson, "analysisStatus", status),
                            buildInternalHeaders()),
                    Map.class
            );
        } catch (Exception e) {
            log.warn("Failed to persist CV analysis for cvId={}: {}", cvId, e.getMessage());
        }
    }

    private HttpHeaders buildInternalHeaders() {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Gateway-Secret", gatewaySecret);
        headers.set("X-User-Id", "ai-engine");
        headers.set("X-User-Scope", "ROLE_ADMIN");
        return headers;
    }
}
```

- [ ] **Step 7.4: Run tests — verify they pass**

```bash
cd backend/ai_engine_service && ./mvnw test -Dtest=UserClientTest -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS, 5 tests passing.

- [ ] **Step 7.5: Commit**

```bash
git add backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/integration/user/UserClient.java \
        backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/UserClientTest.java
git commit -m "feat(ai-engine): add getCvInfo and updateCvAnalysis to UserClient"
```

---

## Task 8: ai_engine_service — AnalysisService new methods (TDD)

**Files:**
- Modify: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisService.java`
- Create: `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java`

- [ ] **Step 8.1: Write the failing tests**

Create `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java`:

```java
package vn.chuongpl.ai_engine_service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.ai_engine_service.dtos.request.CvFullAnalysisRequest;
import vn.chuongpl.ai_engine_service.dtos.response.CvFullAnalysisResponse;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.features.analysis.AnalysisService;
import vn.chuongpl.ai_engine_service.features.analysis.PromptBuilder;
import vn.chuongpl.ai_engine_service.integration.cv.CvTextExtractor;
import vn.chuongpl.ai_engine_service.integration.job.JobClient;
import vn.chuongpl.ai_engine_service.integration.job.JobSummary;
import vn.chuongpl.ai_engine_service.integration.user.CvInfoResponse;
import vn.chuongpl.ai_engine_service.integration.user.JobSuggestionsPublisher;
import vn.chuongpl.ai_engine_service.integration.user.UserClient;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AnalysisServiceCvFullTest {

    @Mock AiModelGatewayRouter modelRouter;
    @Mock PromptBuilder promptBuilder;
    @Mock CvTextExtractor cvTextExtractor;
    @Mock JobClient jobClient;
    @Mock JobSuggestionsPublisher jobSuggestionsPublisher;
    @Mock UserClient userClient;

    @InjectMocks AnalysisService analysisService;

    private static final String CV_TEXT = "John Smith, Java Developer, 5 years Spring Boot";
    private static final String CV_URL = "https://s3.example.com/cv.pdf";
    private static final String CV_ID = "cv-1";
    private static final String USER_ID = "user-1";

    @BeforeEach
    void setUp() {
        // System prompt default
        when(promptBuilder.systemPrompt()).thenReturn("You are an HR expert.");
    }

    @Test
    void analyzeCv_no_jobId_returns_full_analysis() throws Exception {
        // Arrange
        CvInfoResponse cvInfo = new CvInfoResponse(CV_ID, CV_URL, "cv.pdf", USER_ID);
        when(userClient.getCvInfo(CV_ID)).thenReturn(cvInfo);
        when(cvTextExtractor.resolveCvText(null, CV_URL)).thenReturn(CV_TEXT);

        // extract target: prompt + AI call
        when(promptBuilder.buildExtractJobTargetPrompt(any())).thenReturn("extract prompt");
        when(modelRouter.call(anyString(), eq("extract prompt")))
                .thenReturn("{\"targetPosition\":\"Backend Engineer\",\"targetDomain\":\"Tech\"}");

        // analyze: prompt + AI call
        when(promptBuilder.buildAnalyzePrompt(any())).thenReturn("analyze prompt");
        when(modelRouter.call(anyString(), eq("analyze prompt")))
                .thenReturn("{\"matchScore\":78,\"scoreLabel\":\"Good\",\"matchedSkills\":[\"Java\"],"
                        + "\"missingSkills\":[\"Kubernetes\"],\"extraSkills\":[\"PHP\"],\"summary\":\"Good match\"}");

        // improve: prompt + AI call
        when(promptBuilder.buildImproveStructuredPrompt(any())).thenReturn("improve prompt");
        when(modelRouter.call(anyString(), eq("improve prompt")))
                .thenReturn("{\"strengths\":[{\"area\":\"Tech\",\"detail\":\"Java expert\"}],"
                        + "\"weaknesses\":[{\"area\":\"Cloud\",\"detail\":\"No K8s\"}],"
                        + "\"tips\":[{\"area\":\"Skills\",\"suggestion\":\"Learn K8s\",\"priority\":\"High\"}]}");

        doNothing().when(userClient).updateCvAnalysis(anyString(), anyString(), anyString());

        // Act
        CvFullAnalysisResponse result = analysisService.analyzeCv(
                new CvFullAnalysisRequest(CV_ID, null), USER_ID);

        // Assert
        assertThat(result.overallScore()).isEqualTo(78);
        assertThat(result.scoreLabel()).isEqualTo("Good");
        assertThat(result.targetPosition()).isEqualTo("Backend Engineer");
        assertThat(result.matchScore()).isEqualTo(78);
        assertThat(result.matchedSkills()).containsExactly("Java");
        assertThat(result.strengths()).hasSize(1);
        assertThat(result.strengths().get(0).area()).isEqualTo("Tech");
        assertThat(result.weaknesses()).hasSize(1);
        assertThat(result.tips()).hasSize(1);
        assertThat(result.tips().get(0).priority()).isEqualTo("High");
        verify(userClient).updateCvAnalysis(eq(CV_ID), anyString(), eq("DONE"));
    }

    @Test
    void analyzeCv_throws_UNAUTHORIZED_when_user_does_not_own_cv() {
        CvInfoResponse cvInfo = new CvInfoResponse(CV_ID, CV_URL, "cv.pdf", "other-user");
        when(userClient.getCvInfo(CV_ID)).thenReturn(cvInfo);

        assertThatThrownBy(() -> analysisService.analyzeCv(
                new CvFullAnalysisRequest(CV_ID, null), USER_ID))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    @Test
    void analyzeCv_with_jobId_uses_job_description_for_matchScore() throws Exception {
        CvInfoResponse cvInfo = new CvInfoResponse(CV_ID, CV_URL, "cv.pdf", USER_ID);
        when(userClient.getCvInfo(CV_ID)).thenReturn(cvInfo);
        when(cvTextExtractor.resolveCvText(null, CV_URL)).thenReturn(CV_TEXT);

        when(promptBuilder.buildExtractJobTargetPrompt(any())).thenReturn("extract prompt");
        when(modelRouter.call(anyString(), eq("extract prompt")))
                .thenReturn("{\"targetPosition\":\"Backend Engineer\",\"targetDomain\":\"Tech\"}");

        JobSummary job = new JobSummary("job-1", "Backend Engineer", "Acme", "Build APIs",
                List.of("Java", "Kubernetes"), List.of("3+ years"), "Mid");
        when(jobClient.getJobById("job-1")).thenReturn(job);

        // job analysis returns 85
        when(promptBuilder.buildAnalyzePrompt(any())).thenReturn("analyze prompt");
        when(modelRouter.call(anyString(), eq("analyze prompt")))
                .thenReturn("{\"matchScore\":85,\"scoreLabel\":\"Excellent\",\"matchedSkills\":[\"Java\"],"
                        + "\"missingSkills\":[],\"extraSkills\":[],\"summary\":\"Excellent match\"}");

        when(promptBuilder.buildImproveStructuredPrompt(any())).thenReturn("improve prompt");
        when(modelRouter.call(anyString(), eq("improve prompt")))
                .thenReturn("{\"strengths\":[{\"area\":\"Tech\",\"detail\":\"Java\"}],"
                        + "\"weaknesses\":[],\"tips\":[{\"area\":\"Skills\","
                        + "\"suggestion\":\"Good\",\"priority\":\"Low\"}]}");

        doNothing().when(userClient).updateCvAnalysis(anyString(), anyString(), anyString());

        CvFullAnalysisResponse result = analysisService.analyzeCv(
                new CvFullAnalysisRequest(CV_ID, "job-1"), USER_ID);

        assertThat(result.matchScore()).isEqualTo(85);
        // overallScore comes from standalone analysis (second CompletableFuture)
        // Both futures return 85 in this test since we stub all calls to return the same response
        assertThat(result.scoreLabel()).isIn("Excellent", "Good"); // depends on overallScore
    }

    @Test
    void computeScoreLabel_returns_correct_labels() {
        // Test the helper method through analyzeCv by observing the output scoreLabel
        // Verify thresholds: >=85=Excellent, >=70=Good, >=50=Fair, <50=Poor
        // (Indirect verification via analyzeCv — tested above for 78=Good and 85=Excellent)
        // Direct test of boundary:
        assertThat(analysisService.computeScoreLabel(85)).isEqualTo("Excellent");
        assertThat(analysisService.computeScoreLabel(84)).isEqualTo("Good");
        assertThat(analysisService.computeScoreLabel(70)).isEqualTo("Good");
        assertThat(analysisService.computeScoreLabel(69)).isEqualTo("Fair");
        assertThat(analysisService.computeScoreLabel(50)).isEqualTo("Fair");
        assertThat(analysisService.computeScoreLabel(49)).isEqualTo("Poor");
    }
}
```

- [ ] **Step 8.2: Run tests — verify they fail**

```bash
cd backend/ai_engine_service && ./mvnw test -Dtest=AnalysisServiceCvFullTest -q 2>&1 | tail -20
```

Expected: FAIL — `analyzeCv`, `computeScoreLabel`, `UserClient userClient` field not found.

- [ ] **Step 8.3: Add UserClient field and new methods to AnalysisService**

Open `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisService.java`.

**Add import** at top:
```java
import vn.chuongpl.ai_engine_service.dtos.request.CvFullAnalysisRequest;
import vn.chuongpl.ai_engine_service.dtos.response.CvFullAnalysisResponse;
import vn.chuongpl.ai_engine_service.dtos.response.CvImproveStructuredResponse;
import vn.chuongpl.ai_engine_service.dtos.response.ExtractJobTargetResponse;
import vn.chuongpl.ai_engine_service.dtos.response.StrengthItem;
import vn.chuongpl.ai_engine_service.dtos.response.WeaknessItem;
import vn.chuongpl.ai_engine_service.integration.user.CvInfoResponse;
import vn.chuongpl.ai_engine_service.integration.user.UserClient;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;
```

**Add `userClient` field** after `jobSuggestionsPublisher`:
```java
private final UserClient userClient;
```

**Add new public and private methods** at the end of the class, before the closing `}`:

```java
public CvFullAnalysisResponse analyzeCv(CvFullAnalysisRequest request, String userId) {
    // 1. Resolve CV and verify ownership
    CvInfoResponse cvInfo = userClient.getCvInfo(request.cvId());
    if (!cvInfo.ownerId().equals(userId)) {
        throw new AppException(ErrorCode.UNAUTHORIZED);
    }

    // 2. Extract CV text
    String cvText = cvTextExtractor.resolveCvText(null, cvInfo.cvUrl());

    // 3. Extract target position (always needed)
    ExtractJobTargetResponse target = extractJobTarget(cvText);
    String targetPosition = target.targetPosition();

    CvAnalysisResponse matchAnalysis;
    int overallScore;
    CvImproveStructuredResponse improvement;

    if (request.jobId() != null) {
        // Fetch job description, then run job-match and standalone analyses in parallel
        JobSummary job = jobClient.getJobById(request.jobId());
        String jd = nvl(job.description());
        String jTitle = nvl(job.title());
        String jSkills = String.join(", ", safeList(job.skills()));
        String jReqs = String.join("\n- ", safeList(job.requirements()));

        CompletableFuture<CvAnalysisResponse> jobFuture = CompletableFuture.supplyAsync(
                () -> analyzeWithText(cvText, jd, jTitle, jSkills, jReqs));
        CompletableFuture<CvAnalysisResponse> standaloneFuture = CompletableFuture.supplyAsync(
                () -> analyzeWithText(cvText, targetPosition, targetPosition, "", ""));

        CompletableFuture.allOf(jobFuture, standaloneFuture).join();
        matchAnalysis = jobFuture.join();
        overallScore = standaloneFuture.join().matchScore();
        improvement = improveWithText(cvText, jd, jTitle, jSkills, jReqs);
    } else {
        // No job — use extracted target position for everything
        matchAnalysis = analyzeWithText(cvText, targetPosition, targetPosition, "", "");
        overallScore = matchAnalysis.matchScore();
        improvement = improveWithText(cvText, targetPosition, targetPosition, "", "");
    }

    // 4. Compute score label and build extractedSkills from analysis
    String scoreLabel = computeScoreLabel(overallScore);
    List<String> extractedSkills = Stream.concat(
            safeList(matchAnalysis.matchedSkills()).stream(),
            safeList(matchAnalysis.extraSkills()).stream()
    ).distinct().toList();

    CvFullAnalysisResponse response = new CvFullAnalysisResponse(
            overallScore,
            scoreLabel,
            targetPosition,
            matchAnalysis.matchScore(),
            safeList(matchAnalysis.matchedSkills()),
            safeList(matchAnalysis.missingSkills()),
            safeList(matchAnalysis.extraSkills()),
            matchAnalysis.summary(),
            safeList(improvement.strengths()),
            safeList(improvement.weaknesses()),
            safeList(improvement.tips()),
            extractedSkills
    );

    // 5. Persist analysis result (best-effort — do not fail the response)
    try {
        userClient.updateCvAnalysis(request.cvId(), mapper.writeValueAsString(response), "DONE");
    } catch (Exception e) {
        log.warn("Failed to persist CV analysis for cvId={}: {}", request.cvId(), e.getMessage());
    }

    return response;
}

public String computeScoreLabel(int score) {
    if (score >= 85) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Fair";
    return "Poor";
}

private ExtractJobTargetResponse extractJobTarget(String cvText) {
    String prompt = promptBuilder.buildExtractJobTargetPrompt(Map.of("CV_TEXT", nvl(cvText)));
    String json = callAi(prompt);
    return parse(json, ExtractJobTargetResponse.class);
}

private CvAnalysisResponse analyzeWithText(String cvText, String jobDescription,
        String jobTitle, String jobSkills, String jobRequirements) {
    String prompt = promptBuilder.buildAnalyzePrompt(Map.of(
            "CV_TEXT", nvl(cvText),
            "JOB_TITLE", nvl(jobTitle),
            "JOB_DESCRIPTION", nvl(jobDescription),
            "JOB_SKILLS", nvl(jobSkills),
            "JOB_REQUIREMENTS", nvl(jobRequirements),
            "EXPERIENCE_LEVEL", ""
    ));
    String json = callAi(prompt);
    return parse(json, CvAnalysisResponse.class);
}

private CvImproveStructuredResponse improveWithText(String cvText, String jobDescription,
        String jobTitle, String jobSkills, String jobRequirements) {
    String prompt = promptBuilder.buildImproveStructuredPrompt(Map.of(
            "CV_TEXT", nvl(cvText),
            "JOB_TITLE", nvl(jobTitle),
            "JOB_DESCRIPTION", nvl(jobDescription),
            "JOB_SKILLS", nvl(jobSkills),
            "JOB_REQUIREMENTS", nvl(jobRequirements)
    ));
    String json = callAi(prompt);
    return parse(json, CvImproveStructuredResponse.class);
}

private <T> List<T> safeList(List<T> values) {
    return values == null ? Collections.emptyList() : values;
}
```

> Note: The `safeList` method signature is being changed from `List<String>` to generic `List<T>`. Remove the old `private List<String> safeList(List<String> values)` method and keep only the new generic version.

- [ ] **Step 8.4: Run tests — verify they pass**

```bash
cd backend/ai_engine_service && ./mvnw test -Dtest=AnalysisServiceCvFullTest -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS, 4 tests passing.

- [ ] **Step 8.5: Run full test suite to check for regressions**

```bash
cd backend/ai_engine_service && ./mvnw test -q 2>&1 | tail -15
```

Expected: BUILD SUCCESS, all tests passing.

- [ ] **Step 8.6: Commit**

```bash
git add backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisService.java \
        backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java
git commit -m "feat(ai-engine): add analyzeCv full-analysis method with parallel AI calls"
```

---

## Task 9: ai_engine_service — AnalysisController new endpoint (TDD)

**Files:**
- Modify: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisController.java`

- [ ] **Step 9.1: Add controller test to existing or new test file**

Create `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisControllerCvFullTest.java`:

```java
package vn.chuongpl.ai_engine_service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.web.servlet.MockMvc;
import vn.chuongpl.ai_engine_service.dtos.request.CvFullAnalysisRequest;
import vn.chuongpl.ai_engine_service.dtos.response.*;
import vn.chuongpl.ai_engine_service.features.analysis.AnalysisController;
import vn.chuongpl.ai_engine_service.features.analysis.AnalysisService;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnalysisController.class)
class AnalysisControllerCvFullTest {

    @Autowired MockMvc mockMvc;
    @MockBean AnalysisService analysisService;
    @Autowired ObjectMapper objectMapper;

    @Test
    @WithMockUser(username = "user-1", authorities = "ROLE_CANDIDATE")
    void analyzeCv_returns_200_with_analysis_data() throws Exception {
        CvFullAnalysisResponse response = new CvFullAnalysisResponse(
                78, "Good", "Backend Engineer", 78,
                List.of("Java"), List.of("Kubernetes"), List.of("PHP"),
                "Good match.", List.of(new StrengthItem("Tech", "Java expert")),
                List.of(new WeaknessItem("Cloud", "No K8s")),
                List.of(new CvImprovementResponse.ImprovementTip("Skills", "Learn K8s", "High")),
                List.of("Java", "PHP")
        );
        when(analysisService.analyzeCv(any(CvFullAnalysisRequest.class), eq("user-1")))
                .thenReturn(response);

        mockMvc.perform(post("/api/ai/analyze-cv")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new CvFullAnalysisRequest("cv-1", null))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.overallScore").value(78))
                .andExpect(jsonPath("$.data.scoreLabel").value("Good"))
                .andExpect(jsonPath("$.data.targetPosition").value("Backend Engineer"));
    }

    @Test
    void analyzeCv_returns_401_for_unauthenticated() throws Exception {
        mockMvc.perform(post("/api/ai/analyze-cv")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cvId\":\"cv-1\"}"))
                .andExpect(status().isUnauthorized());
    }
}
```

- [ ] **Step 9.2: Run tests — verify they fail**

```bash
cd backend/ai_engine_service && ./mvnw test -Dtest=AnalysisControllerCvFullTest -q 2>&1 | tail -15
```

Expected: FAIL — endpoint not found.

- [ ] **Step 9.3: Add the endpoint to AnalysisController**

Open `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisController.java`.

Add imports:
```java
import vn.chuongpl.ai_engine_service.dtos.request.CvFullAnalysisRequest;
import vn.chuongpl.ai_engine_service.dtos.response.CvFullAnalysisResponse;
```

Add the new endpoint method after the existing `interviewQuestions` method:

```java
@PostMapping("/analyze-cv")
@PreAuthorize("hasAuthority('ROLE_CANDIDATE')")
public ApiResponse<CvFullAnalysisResponse> analyzeCv(@RequestBody @Valid CvFullAnalysisRequest request,
                                                      @AuthenticationPrincipal String userId) {
    return ApiResponse.<CvFullAnalysisResponse>builder()
            .data(analysisService.analyzeCv(request, userId))
            .message("CV analyzed successfully")
            .build();
}
```

- [ ] **Step 9.4: Run tests — verify they pass**

```bash
cd backend/ai_engine_service && ./mvnw test -Dtest=AnalysisControllerCvFullTest -q 2>&1 | tail -10
```

Expected: BUILD SUCCESS, 2 tests passing.

- [ ] **Step 9.5: Run full ai_engine_service test suite**

```bash
cd backend/ai_engine_service && ./mvnw test -q 2>&1 | tail -15
```

Expected: BUILD SUCCESS, all tests passing.

- [ ] **Step 9.6: Commit**

```bash
git add backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisController.java \
        backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisControllerCvFullTest.java
git commit -m "feat(ai-engine): expose POST /api/ai/analyze-cv endpoint"
```

---

## Task 10: ai_engine_service — Remove dead config

**Files:**
- Modify: `backend/ai_engine_service/src/main/resources/application.yaml`

- [ ] **Step 10.1: Remove the dead active-provider property**

Open `backend/ai_engine_service/src/main/resources/application.yaml` and remove the line:

```yaml
app:
  ai:
    active-provider: ${AI_ACTIVE_PROVIDER:groq}
```

Only remove the `active-provider` line (and its parent keys if they become empty). The `recommend-batch-size` property under `app.ai` (if present) should be kept.

- [ ] **Step 10.2: Compile check**

```bash
cd backend/ai_engine_service && ./mvnw compile -q
```

- [ ] **Step 10.3: Commit**

```bash
git add backend/ai_engine_service/src/main/resources/application.yaml
git commit -m "chore(ai-engine): remove unused app.ai.active-provider config property"
```

---

## Task 11: Frontend — i18n keys

**Files:**
- Modify: `frontend/packages/i18n/src/locales/en/common.json`
- Modify: `frontend/packages/i18n/src/locales/vi/common.json`

- [ ] **Step 11.1: Add keys to English common.json**

Open `frontend/packages/i18n/src/locales/en/common.json` and add these 16 keys at the end of the JSON object (before the closing `}`):

```json
  "cv_analysis_score": "Quality Score",
  "cv_analysis_target_position": "Target Position",
  "cv_analysis_match_score": "Job Match",
  "cv_analysis_matched_skills": "Matched Skills",
  "cv_analysis_missing_skills": "Missing Skills",
  "cv_analysis_extra_skills": "Other Skills",
  "cv_analysis_summary": "Summary",
  "cv_analysis_strengths": "Strengths",
  "cv_analysis_weaknesses": "Areas to Improve",
  "cv_analysis_tips": "Improvement Tips",
  "cv_analysis_analyzing": "Analyzing...",
  "cv_analysis_reanalyze": "Re-analyze",
  "cv_analysis_retry": "Retry",
  "cv_analysis_failed": "Analysis failed. Please try again.",
  "cv_analysis_score_excellent": "Excellent",
  "cv_analysis_score_good": "Good",
  "cv_analysis_score_fair": "Fair",
  "cv_analysis_score_poor": "Poor"
```

- [ ] **Step 11.2: Add keys to Vietnamese common.json**

Open `frontend/packages/i18n/src/locales/vi/common.json` and add the same 16 keys with Vietnamese values:

```json
  "cv_analysis_score": "Điểm chất lượng",
  "cv_analysis_target_position": "Vị trí mục tiêu",
  "cv_analysis_match_score": "Độ phù hợp",
  "cv_analysis_matched_skills": "Kỹ năng phù hợp",
  "cv_analysis_missing_skills": "Kỹ năng còn thiếu",
  "cv_analysis_extra_skills": "Kỹ năng khác",
  "cv_analysis_summary": "Tóm tắt",
  "cv_analysis_strengths": "Điểm mạnh",
  "cv_analysis_weaknesses": "Điểm cần cải thiện",
  "cv_analysis_tips": "Gợi ý cải thiện",
  "cv_analysis_analyzing": "Đang phân tích...",
  "cv_analysis_reanalyze": "Phân tích lại",
  "cv_analysis_retry": "Thử lại",
  "cv_analysis_failed": "Phân tích thất bại. Vui lòng thử lại.",
  "cv_analysis_score_excellent": "Xuất sắc",
  "cv_analysis_score_good": "Tốt",
  "cv_analysis_score_fair": "Khá",
  "cv_analysis_score_poor": "Cần cải thiện"
```

- [ ] **Step 11.3: Commit**

```bash
git add frontend/packages/i18n/src/locales/en/common.json \
        frontend/packages/i18n/src/locales/vi/common.json
git commit -m "feat(i18n): add CV analysis panel translation keys (en + vi)"
```

---

## Task 12: Frontend — Regenerate Orval API client

> ⚠️ **Prerequisite:** `ai_engine_service` must be running before executing this task.

**Files:**
- Regenerated: `frontend/packages/api/src/generated/ai/`

- [ ] **Step 12.1: Start ai_engine_service**

```bash
make run-gateway  # (required for routing)
make run-noti     # (if RabbitMQ consumers are needed)
# In a separate terminal:
cd backend/ai_engine_service && ./mvnw spring-boot:run
```

Or use `make compose-up` to start all infrastructure, then start ai_engine_service.

- [ ] **Step 12.2: Regenerate AI client**

```bash
cd frontend && pnpm generate:api:ai
```

Expected: No errors. `packages/api/src/generated/ai/analysis-controller/analysis-controller.ts` should now contain a new hook (likely `useAnalyzeCv` or `usePostApiAiAnalyzeCv`) for the `POST /api/ai/analyze-cv` endpoint.

- [ ] **Step 12.3: Verify the new hook exists**

```bash
grep -n "analyze-cv\|analyzeCv\|AnalyzeCv" frontend/packages/api/src/generated/ai/analysis-controller/analysis-controller.ts | head -10
```

Note the exact hook name (e.g., `useAnalyzeCv`) — you'll need it in Task 14.

- [ ] **Step 12.4: Commit generated files**

```bash
git add frontend/packages/api/src/generated/
git commit -m "chore(api): regenerate Orval client with analyze-cv endpoint"
```

---

## Task 13: Frontend — CvAnalysisPanel component

**Files:**
- Create: `frontend/apps/web-candidate/src/components/cv/CvAnalysisPanel.tsx`

- [ ] **Step 13.1: Create the component directory and file**

```bash
mkdir -p frontend/apps/web-candidate/src/components/cv
```

Create `frontend/apps/web-candidate/src/components/cv/CvAnalysisPanel.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  cn,
} from '@smart-cv/ui'
import type { CvItemAnalysisStatus } from '@smart-cv/api'

interface StrengthItem {
  area: string
  detail: string
}

interface WeaknessItem {
  area: string
  detail: string
}

interface ImprovementTip {
  area: string
  suggestion: string
  priority: 'High' | 'Medium' | 'Low'
}

interface CvFullAnalysisResponse {
  overallScore: number
  scoreLabel: string
  targetPosition: string
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  extraSkills: string[]
  summary: string
  strengths: StrengthItem[]
  weaknesses: WeaknessItem[]
  tips: ImprovementTip[]
  extractedSkills: string[]
}

interface CvAnalysisPanelProps {
  analysisResultJson: string | null | undefined
  analysisStatus: CvItemAnalysisStatus | undefined
  onRetry: () => void
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400'
  if (score >= 70) return 'text-blue-600 dark:text-blue-400'
  if (score >= 50) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

function priorityBadgeVariant(priority: string): string {
  if (priority === 'High') return 'bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-200'
  if (priority === 'Medium') return 'bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-200'
  return 'bg-slate-50 dark:bg-slate-900/20 text-slate-500 border-slate-200'
}

export function CvAnalysisPanel({ analysisResultJson, analysisStatus, onRetry }: CvAnalysisPanelProps) {
  const { t } = useTranslation()

  // Parse the stored JSON — treat malformed JSON the same as FAILED status
  let analysis: CvFullAnalysisResponse | null = null
  let parseError = false
  if (analysisResultJson) {
    try {
      analysis = JSON.parse(analysisResultJson) as CvFullAnalysisResponse
    } catch {
      parseError = true
    }
  }

  if (analysisStatus === 'FAILED' || parseError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-950/10 p-6 text-center">
        <p className="text-sm text-rose-600 dark:text-rose-400">{t('cv_analysis_failed')}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t('cv_analysis_retry')}
        </Button>
      </div>
    )
  }

  if (!analysis) return null

  return (
    <div className="mt-4 space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
      {/* Score + Target Position */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-baseline gap-1">
          <span className={cn('text-4xl font-bold tabular-nums', scoreColor(analysis.overallScore))}>
            {analysis.overallScore}
          </span>
          <span className="text-sm text-muted-foreground">/ 100</span>
          <span className={cn('ml-2 text-sm font-medium', scoreColor(analysis.overallScore))}>
            · {analysis.scoreLabel}
          </span>
        </div>
        <Badge variant="outline" className="text-xs">
          {t('cv_analysis_target_position')}: {analysis.targetPosition}
        </Badge>
      </div>

      {/* Summary */}
      {analysis.summary && (
        <p className="text-sm text-muted-foreground leading-relaxed">{analysis.summary}</p>
      )}

      {/* Skills */}
      <div className="space-y-2">
        {analysis.matchedSkills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {analysis.matchedSkills.map((s) => (
              <Badge key={s} className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 text-xs">
                ✓ {s}
              </Badge>
            ))}
          </div>
        )}
        {analysis.missingSkills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {analysis.missingSkills.map((s) => (
              <Badge key={s} className="bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 border-rose-200 text-xs">
                ✗ {s}
              </Badge>
            ))}
          </div>
        )}
        {analysis.extraSkills?.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {analysis.extraSkills.map((s) => (
              <Badge key={s} variant="secondary" className="text-xs">
                {s}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Accordion: Strengths / Weaknesses / Tips */}
      <Accordion type="multiple" className="w-full">
        {analysis.strengths?.length > 0 && (
          <AccordionItem value="strengths">
            <AccordionTrigger className="text-sm font-medium">
              {t('cv_analysis_strengths')} ({analysis.strengths.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {analysis.strengths.map((s, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{s.area}:</span>{' '}
                    <span className="text-muted-foreground">{s.detail}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        {analysis.weaknesses?.length > 0 && (
          <AccordionItem value="weaknesses">
            <AccordionTrigger className="text-sm font-medium">
              {t('cv_analysis_weaknesses')} ({analysis.weaknesses.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-2">
                {analysis.weaknesses.map((w, i) => (
                  <li key={i} className="text-sm">
                    <span className="font-medium text-amber-600 dark:text-amber-400">{w.area}:</span>{' '}
                    <span className="text-muted-foreground">{w.detail}</span>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}

        {analysis.tips?.length > 0 && (
          <AccordionItem value="tips">
            <AccordionTrigger className="text-sm font-medium">
              {t('cv_analysis_tips')} ({analysis.tips.length})
            </AccordionTrigger>
            <AccordionContent>
              <ul className="space-y-3">
                {analysis.tips.map((tip, i) => (
                  <li key={i} className="text-sm space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{tip.area}</span>
                      <span className={cn('px-1.5 py-0.5 rounded text-xs border', priorityBadgeVariant(tip.priority))}>
                        {tip.priority}
                      </span>
                    </div>
                    <p className="text-muted-foreground">{tip.suggestion}</p>
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        )}
      </Accordion>
    </div>
  )
}
```

- [ ] **Step 13.2: Lint check**

```bash
cd frontend && pnpm -F web-candidate lint 2>&1 | tail -20
```

Expected: No errors. Fix any lint issues before continuing.

- [ ] **Step 13.3: Commit**

```bash
git add frontend/apps/web-candidate/src/components/cv/CvAnalysisPanel.tsx
git commit -m "feat(web-candidate): add CvAnalysisPanel inline analysis result component"
```

---

## Task 14: Frontend — CV page rewiring

**Files:**
- Modify: `frontend/apps/web-candidate/src/routes/_account.cv.tsx`

- [ ] **Step 14.1: Add imports to _account.cv.tsx**

Open `frontend/apps/web-candidate/src/routes/_account.cv.tsx` and add these imports near the top (after existing imports):

```tsx
import { CvAnalysisPanel } from '../components/cv/CvAnalysisPanel'
// Import the new Orval-generated hook (verify exact name from Task 12 Step 12.3):
import { useAnalyzeCv } from '@smart-cv/api'
// (Replace 'useAnalyzeCv' with the actual hook name if different)
```

- [ ] **Step 14.2: Add per-CV loading state**

Inside the `MyCVPage` component, add the following `useState` after the existing state declarations:

```tsx
const [analyzingIds, setAnalyzingIds] = useState<Set<string>>(new Set())
```

- [ ] **Step 14.3: Replace the re-analyze mutation**

Find the existing `reanalyzeMutation` (which calls `useReanalyzeCv` or similar). Replace it with:

```tsx
const analyzeCvMutation = useAnalyzeCv({
  mutation: {
    onMutate: ({ cvId }: { cvId: string }) => {
      setAnalyzingIds((prev) => new Set(prev).add(cvId))
    },
    onSuccess: (response, { cvId }) => {
      // Update the CV's analysisResult directly in cache from the mutation response
      queryClient.setQueryData(getListCvsQueryKey(), (old: any) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((cv: any) =>
            cv.id === cvId
              ? {
                  ...cv,
                  analysisResult: JSON.stringify(response?.data),
                  analysisStatus: 'DONE',
                }
              : cv,
          ),
        }
      })
      queryClient.invalidateQueries({ queryKey: getListCvsQueryKey() })
    },
    onError: (_error, { cvId }) => {
      toast.error(t('cv_analysis_failed'))
      queryClient.setQueryData(getListCvsQueryKey(), (old: any) => {
        if (!old?.data) return old
        return {
          ...old,
          data: old.data.map((cv: any) =>
            cv.id === cvId ? { ...cv, analysisStatus: 'FAILED' } : cv,
          ),
        }
      })
    },
    onSettled: (_data, _error, { cvId }: { cvId: string }) => {
      setAnalyzingIds((prev) => {
        const next = new Set(prev)
        next.delete(cvId)
        return next
      })
    },
  },
})
```

- [ ] **Step 14.4: Update the re-analyze button handler**

Find the button or handler that previously called `reanalyzeMutation.mutate(...)` and update it to:

```tsx
// Replace old handler with:
const handleReanalyze = (cvId: string) => {
  analyzeCvMutation.mutate({ cvId })
}
```

Update the re-analyze button to show a spinner while analyzing:

```tsx
<Button
  size="sm"
  variant="outline"
  disabled={analyzingIds.has(cv.id ?? '')}
  onClick={() => handleReanalyze(cv.id ?? '')}
>
  {analyzingIds.has(cv.id ?? '') ? t('cv_analysis_analyzing') : t('cv_analysis_reanalyze')}
</Button>
```

- [ ] **Step 14.5: Render CvAnalysisPanel below the selected CV card**

Find the section where the selected CV's detail is rendered. After the existing CV card content, add:

```tsx
<CvAnalysisPanel
  analysisResultJson={selectedCv?.analysisResult}
  analysisStatus={selectedCv?.analysisStatus}
  onRetry={() => selectedCv?.id && handleReanalyze(selectedCv.id)}
/>
```

Where `selectedCv` is the currently selected/active CV item. If the CV page uses a different pattern (e.g., iterates all CVs), render the panel for each CV conditionally:

```tsx
{/* After each CV card: */}
{cv.analysisStatus === 'DONE' && cv.analysisResult && (
  <CvAnalysisPanel
    analysisResultJson={cv.analysisResult}
    analysisStatus={cv.analysisStatus}
    onRetry={() => handleReanalyze(cv.id ?? '')}
  />
)}
{cv.analysisStatus === 'FAILED' && (
  <CvAnalysisPanel
    analysisResultJson={null}
    analysisStatus={cv.analysisStatus}
    onRetry={() => handleReanalyze(cv.id ?? '')}
  />
)}
```

- [ ] **Step 14.6: Lint and build check**

```bash
cd frontend && pnpm -F web-candidate lint 2>&1 | tail -20
cd frontend && pnpm -F web-candidate build 2>&1 | tail -20
```

Expected: No TypeScript or lint errors. Fix any before committing.

- [ ] **Step 14.7: Commit**

```bash
git add frontend/apps/web-candidate/src/routes/_account.cv.tsx
git commit -m "feat(web-candidate): wire re-analyze button to AI analyze-cv endpoint with inline panel"
```

---

## Final Verification

- [ ] **Run all backend tests**

```bash
cd backend/user-service && ./mvnw test -q 2>&1 | tail -5
cd backend/ai_engine_service && ./mvnw test -q 2>&1 | tail -5
```

Both: BUILD SUCCESS.

- [ ] **Run frontend build**

```bash
cd frontend && pnpm -F web-candidate build 2>&1 | tail -5
```

Expected: Build succeeded.

- [ ] **Run code-reviewer skill**

Invoke the `code-reviewer` skill (`/code-review`) on the completed changes and address any findings.

---

## Self-Review Checklist

**Spec coverage:**
- [x] MongoDB seed script + docker volume mount (Task 1)
- [x] user-service internal GET CV info endpoint (Task 4)
- [x] user-service internal PATCH analysis endpoint (Task 4)
- [x] ai_engine_service DTOs (Task 5)
- [x] extract_job_target.md prompt (Task 6)
- [x] improve_cv_structured.md prompt (Task 6)
- [x] PromptBuilder new methods (Task 6)
- [x] UserClient getCvInfo + updateCvAnalysis (Task 7)
- [x] AnalysisService: extractJobTarget, analyzeWithText, improveWithText, analyzeCv (Task 8)
- [x] Parallel CompletableFuture for jobId flow (Task 8, Step 8.3)
- [x] AnalysisController POST /analyze-cv (Task 9)
- [x] Remove dead app.ai.active-provider config (Task 10)
- [x] i18n keys en + vi (Task 11)
- [x] Orval regeneration (Task 12)
- [x] CvAnalysisPanel component (Task 13)
- [x] CV page rewiring + per-CV loading Set + cache update from mutation response (Task 14)

**Placeholder scan:** None found — all steps contain actual code.

**Type consistency:**
- `CvFullAnalysisRequest` record fields: `cvId` (String), `jobId` (String nullable) — used consistently in Tasks 5, 8, 9
- `CvFullAnalysisResponse` record matches the JSON schema in the spec
- `StrengthItem` / `WeaknessItem` used as `{ area, detail }` consistently in Tasks 5, 8, 13
- `CvImproveStructuredResponse` uses `List<StrengthItem>`, `List<WeaknessItem>`, `List<ImprovementTip>` — consistent with Tasks 5 and 8
- `CvInfoResponse` (ai_engine_service) vs `CvInfoResponse` (user-service): **different packages** — no conflict
- `computeScoreLabel` is `public` in Task 8 (required for direct test in Step 8.1)
