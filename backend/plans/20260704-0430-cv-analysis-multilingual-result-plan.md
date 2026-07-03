# CV Analysis Multilingual Result Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CV analysis result (`summary`, `strengths`, `weaknesses`, `tips`) genuinely bilingual (EN/VI) end-to-end, and have the frontend display exactly one language at a time based on the app's existing language preference.

**Architecture:** Backend already has bilingual DTO fields (`summaryVi`, `detailVi`, `suggestionVi`) and LLM prompts that produce them; the work is (1) restoring/completing backend population of these fields across all analysis paths — including the deterministic, non-LLM scoring path which never had Vietnamese support — and (2) making the two frontend components that render analysis results actually read the `*Vi` fields instead of ignoring them.

**Tech Stack:** Java 21 / Spring Boot (`ai_engine_service`), JUnit 5 + Mockito + AssertJ, React 19 + TypeScript (`web-candidate`), Zustand (`usePreferencesStore`).

## Global Constraints

- Spec: `backend/plans/20260704-0411-cv-analysis-multilingual-result.md` — read it before starting; this plan implements it task-by-task.
- One language shown at a time (ternary select), never both simultaneously.
- Language source is `usePreferencesStore.language` (`'EN' | 'VI'`) — no browser `Accept-Language`/`navigator.language` auto-detection work (explicitly out of scope per spec).
- No new LLM calls — the deterministic scoring path's Vietnamese summary is built in Java, same cost profile as today.
- Backend commands run from `backend/ai_engine_service/`. Prefix all Bash commands with `rtk` per repo convention.
- Frontend commands run from repo root using `pnpm -F web-candidate <cmd>`.
- Commit messages: English, Conventional Commits (`feat(ai-engine): ...`, `fix(web-candidate): ...`), no AI tool name.

---

### Task 1: Restore `summaryVi` on `CvAnalysisResponse` and implement the deterministic Vietnamese summary

**Files:**
- Modify: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/response/CvAnalysisResponse.java`
- Modify: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/DeterministicCvScoringService.java`
- Modify: `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisServiceDeterministicAnalyzeTest.java:54-57`
- Modify: `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java:266-271`
- Test: `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/features/analysis/DeterministicCvScoringServiceTest.java`

**Interfaces:**
- Produces: `CvAnalysisResponse` record gains a `String summaryVi` field (positioned right after `summary`, matching `analyze_cv.md`'s existing JSON field order). Canonical constructor becomes `CvAnalysisResponse(int matchScore, String scoreLabel, List<String> matchedSkills, List<String> missingSkills, List<String> extraSkills, String summary, String summaryVi, ScoreBreakdownResponse breakdown, ScoreEvidenceResponse evidence)`.
- Produces: `DeterministicCvScoringService.score(...)` now populates `summaryVi` with a Vietnamese-language summary built purely in Java (no LLM call).

- [ ] **Step 1: Write the failing tests**

Open `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/features/analysis/DeterministicCvScoringServiceTest.java` and add these two test methods inside the `DeterministicCvScoringServiceTest` class, after the existing `score_applies_cap_when_must_have_coverage_is_too_low` test (before the closing `}` of the class):

```java
    @Test
    void score_returns_vietnamese_summary_alongside_english_summary() {
        StructuredCvProfile cvProfile = new StructuredCvProfile(
                new StructuredCvProfile.CandidateProfile(List.of("Backend Engineer"), "Mid", List.of("FinTech"), 4),
                new StructuredCvProfile.SkillProfile(
                        List.of("Java", "REST API", "Spring Boot", "Docker", "PostgreSQL"),
                        List.of("Git", "Postman"),
                        List.of("Spring Boot"),
                        List.of("PostgreSQL"),
                        List.of("AWS"),
                        List.of("Communication"),
                        List.of("English")
                ),
                List.of(new StructuredCvProfile.ExperienceItem(
                        "Backend Engineer",
                        "ABC",
                        36,
                        List.of("Built APIs"),
                        List.of("Reduced latency"),
                        List.of("Java", "Spring Boot", "REST API", "PostgreSQL", "Docker")
                )),
                List.of("BSc Computer Science"),
                List.of("AWS Certified Developer"),
                List.of(new StructuredCvProfile.ProjectItem("Payments", "Payment APIs", List.of("Java", "Docker")))
        );

        StructuredJobRequirements jobRequirements = new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo("Backend Engineer", "Mid", "FinTech", "Full-time"),
                new StructuredJobRequirements.RequirementProfile(
                        List.of("Java", "REST API"),
                        List.of("Docker"),
                        List.of("Git"),
                        List.of("Spring Boot"),
                        List.of("PostgreSQL"),
                        List.of("AWS"),
                        List.of("English"),
                        List.of(),
                        3
                ),
                List.of("Build backend APIs"),
                List.of()
        );

        CvAnalysisResponse response = scoringService.score(cvProfile, jobRequirements);

        assertThat(response.summaryVi()).isNotBlank();
        assertThat(response.summaryVi()).startsWith("Điểm ");
        assertThat(response.summaryVi()).contains("Java", "REST API");
        assertThat(response.summaryVi()).isNotEqualTo(response.summary());
    }

    @Test
    void score_translates_applied_score_caps_into_vietnamese_summary() {
        StructuredCvProfile cvProfile = new StructuredCvProfile(
                new StructuredCvProfile.CandidateProfile(List.of("Backend Engineer"), "Junior", List.of("E-Commerce"), 1),
                new StructuredCvProfile.SkillProfile(
                        List.of("JavaScript"),
                        List.of("Git"),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of("English")
                ),
                List.of(new StructuredCvProfile.ExperienceItem(
                        "Frontend Intern",
                        "XYZ",
                        12,
                        List.of("Built UI"),
                        List.of(),
                        List.of("JavaScript")
                )),
                List.of(),
                List.of(),
                List.of()
        );

        StructuredJobRequirements jobRequirements = new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo("Backend Engineer", "Mid", "FinTech", "Full-time"),
                new StructuredJobRequirements.RequirementProfile(
                        List.of("Java", "Spring Boot", "REST API"),
                        List.of("Docker"),
                        List.of("Git"),
                        List.of(),
                        List.of("PostgreSQL"),
                        List.of(),
                        List.of("English"),
                        List.of(),
                        3
                ),
                List.of(),
                List.of()
        );

        CvAnalysisResponse response = scoringService.score(cvProfile, jobRequirements);

        assertThat(response.summaryVi()).contains("Giới hạn điểm áp dụng");
        assertThat(response.summaryVi()).doesNotContain("capped");
    }
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend/ai_engine_service && rtk ./mvnw test -Dtest=DeterministicCvScoringServiceTest -q`
Expected: compile FAILURE — `cannot find symbol: method summaryVi()` (the record has no such field/accessor yet).

- [ ] **Step 3: Add `summaryVi` to the `CvAnalysisResponse` record**

Replace the full contents of `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/response/CvAnalysisResponse.java`:

```java
package vn.chuongpl.ai_engine_service.dtos.response;

import java.util.List;

public record CvAnalysisResponse(
        int matchScore,
        String scoreLabel,
        List<String> matchedSkills,
        List<String> missingSkills,
        List<String> extraSkills,
        String summary,
        String summaryVi,
        ScoreBreakdownResponse breakdown,
        ScoreEvidenceResponse evidence
) {
}
```

- [ ] **Step 4: Fix the two other constructor call sites so the module compiles**

In `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisServiceDeterministicAnalyzeTest.java`, find:

```java
        CvAnalysisResponse expected = new CvAnalysisResponse(
                88, "Excellent", List.of("Java", "Spring Boot"), List.of(), List.of(),
                "Strong match", null, null
        );
```

Replace with:

```java
        CvAnalysisResponse expected = new CvAnalysisResponse(
                88, "Excellent", List.of("Java", "Spring Boot"), List.of(), List.of(),
                "Strong match", "Kết quả phù hợp", null, null
        );
```

In `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java`, find:

```java
        when(deterministicCvScoringService.score(eq(cvProfile), eq(requirements))).thenReturn(
                new vn.chuongpl.ai_engine_service.dtos.response.CvAnalysisResponse(
                        84, "Good", List.of("Java"), List.of("Docker"), List.of("Git"),
                        "Deterministic score from O*NET requirements", null, null
                )
        );
```

Replace with:

```java
        when(deterministicCvScoringService.score(eq(cvProfile), eq(requirements))).thenReturn(
                new vn.chuongpl.ai_engine_service.dtos.response.CvAnalysisResponse(
                        84, "Good", List.of("Java"), List.of("Docker"), List.of("Git"),
                        "Deterministic score from O*NET requirements",
                        "Điểm số xác định dựa trên yêu cầu O*NET", null, null
                )
        );
```

(This fixture value — `"Điểm số xác định dựa trên yêu cầu O*NET"` — is asserted on in Task 2, after `AnalysisService` is wired to propagate it.)

- [ ] **Step 5: Implement the Vietnamese summary builder in `DeterministicCvScoringService`**

In `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/DeterministicCvScoringService.java`, add the import (after the existing `java.util.regex.Pattern` import):

```java
import java.util.stream.Collectors;
```

Replace the `score()` method's summary/return section — find:

```java
        List<String> experienceSignals = collectExperienceSignals(cvProfile, jobIndex, cvSkills);
        String yearsSummary = buildYearsSummary(cvProfile, jobRequirements);
        String summary = buildSummary(finalScore, matchedMustHave, missingMustHave, matchedNiceToHave, yearsSummary, appliedCaps);

        return new CvAnalysisResponse(
                finalScore,
                scoreLabel(finalScore),
                matchedMustHave,
                missingMustHave,
                extraSkills,
                summary,
                new ScoreBreakdownResponse(skillScore, experienceScore, seniorityScore, domainScore, bonusScore, List.copyOf(appliedCaps)),
                new ScoreEvidenceResponse(
                        matchedMustHave,
                        missingMustHave,
                        matchedNiceToHave,
                        experienceSignals,
                        yearsSummary,
                        List.copyOf(concerns)
                )
        );
    }
```

Replace with:

```java
        List<String> experienceSignals = collectExperienceSignals(cvProfile, jobIndex, cvSkills);
        String yearsSummary = buildYearsSummary(cvProfile, jobRequirements);
        String yearsSummaryVi = buildYearsSummaryVi(cvProfile, jobRequirements);
        String summary = buildSummary(finalScore, matchedMustHave, missingMustHave, matchedNiceToHave, yearsSummary, appliedCaps);
        String summaryVi = buildSummaryVi(finalScore, matchedMustHave, missingMustHave, matchedNiceToHave, yearsSummaryVi, appliedCaps);

        return new CvAnalysisResponse(
                finalScore,
                scoreLabel(finalScore),
                matchedMustHave,
                missingMustHave,
                extraSkills,
                summary,
                summaryVi,
                new ScoreBreakdownResponse(skillScore, experienceScore, seniorityScore, domainScore, bonusScore, List.copyOf(appliedCaps)),
                new ScoreEvidenceResponse(
                        matchedMustHave,
                        missingMustHave,
                        matchedNiceToHave,
                        experienceSignals,
                        yearsSummary,
                        List.copyOf(concerns)
                )
        );
    }
```

Then add three new private methods right after the existing `buildSummary(...)` method (find its closing `}` — it currently ends with `return summary.toString().trim(); }` around line 211 — insert the new methods immediately after that closing brace):

```java
    private String buildYearsSummaryVi(StructuredCvProfile cvProfile, StructuredJobRequirements jobRequirements) {
        int candidateYears = experienceYears(cvProfile);
        int minYears = minYears(jobRequirements);
        if (minYears <= 0) {
            return candidateYears > 0
                    ? "Ứng viên có khoảng " + candidateYears + " năm kinh nghiệm."
                    : "Tin tuyển dụng không nêu rõ số năm kinh nghiệm tối thiểu.";
        }
        return "Ứng viên có khoảng " + candidateYears + " năm kinh nghiệm so với mức tối thiểu yêu cầu là "
                + minYears + " năm.";
    }

    private String buildSummaryVi(int finalScore, List<String> matchedMustHave, List<String> missingMustHave,
                                  List<String> matchedNiceToHave, String yearsSummaryVi, List<String> appliedCaps) {
        StringBuilder summary = new StringBuilder();
        summary.append("Điểm ").append(finalScore).append("/100. ");
        if (!matchedMustHave.isEmpty()) {
            summary.append("Kỹ năng bắt buộc đã đáp ứng: ").append(String.join(", ", matchedMustHave)).append(". ");
        }
        if (!missingMustHave.isEmpty()) {
            summary.append("Kỹ năng bắt buộc còn thiếu: ").append(String.join(", ", missingMustHave)).append(". ");
        }
        if (!matchedNiceToHave.isEmpty()) {
            summary.append("Có thêm kỹ năng cộng điểm: ").append(String.join(", ", matchedNiceToHave)).append(". ");
        }
        summary.append(yearsSummaryVi).append(' ');
        if (!appliedCaps.isEmpty()) {
            summary.append("Giới hạn điểm áp dụng: ").append(
                    appliedCaps.stream().map(this::translateCap).collect(Collectors.joining(" ")));
        }
        return summary.toString().trim();
    }

    private String translateCap(String capMessage) {
        if (capMessage.contains("no must-have requirement was matched")) {
            return "Điểm bị giới hạn ở mức 35 vì không có yêu cầu bắt buộc nào được đáp ứng.";
        }
        if (capMessage.contains("must-have skill coverage is below 40%")) {
            return "Điểm bị giới hạn ở mức 55 vì tỷ lệ đáp ứng kỹ năng bắt buộc dưới 40%.";
        }
        if (capMessage.contains("experience is less than half of the stated minimum")) {
            return "Điểm bị giới hạn ở mức 65 vì số năm kinh nghiệm chưa bằng một nửa mức tối thiểu yêu cầu.";
        }
        return capMessage;
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `cd backend/ai_engine_service && rtk ./mvnw test -Dtest=DeterministicCvScoringServiceTest,AnalysisServiceDeterministicAnalyzeTest,AnalysisServiceCvFullTest -q`
Expected: PASS, all tests green (no output after the command besides Maven's own logging — RTK filters to failures only).

- [ ] **Step 7: Commit**

```bash
cd /home/chuongpl/projects/smartCv
rtk git add backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/dtos/response/CvAnalysisResponse.java backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/DeterministicCvScoringService.java backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisServiceDeterministicAnalyzeTest.java backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/features/analysis/DeterministicCvScoringServiceTest.java
rtk git commit -m "feat(ai-engine): add Vietnamese summary to CvAnalysisResponse"
```

---

### Task 2: Wire `summaryVi` through `AnalysisService.analyzeCv()` and confirm strengths/weaknesses/tips survive parsing

**Files:**
- Modify: `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisService.java:405`
- Modify: `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java`

**Interfaces:**
- Consumes: `CvAnalysisResponse.summaryVi()` (Task 1).
- Produces: `CvFullAnalysisResponse.summaryVi()` now carries a real value on every analysis path (LLM-only path, deterministic/JD path, O*NET path) instead of always `""`.

- [ ] **Step 1: Write the failing tests**

In `backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java`, find the `analyzeCv_no_jobId_returns_full_analysis` test. Replace its "analyze prompt" mock:

```java
        when(promptBuilder.buildAnalyzePrompt(any())).thenReturn("analyze prompt");
        when(modelRouter.call(anyString(), eq("analyze prompt")))
                .thenReturn("{\"matchScore\":78,\"scoreLabel\":\"Good\",\"matchedSkills\":[\"Java\"],"
                        + "\"missingSkills\":[\"Kubernetes\"],\"extraSkills\":[\"PHP\"],\"summary\":\"Good match\"}");
```

with:

```java
        when(promptBuilder.buildAnalyzePrompt(any())).thenReturn("analyze prompt");
        when(modelRouter.call(anyString(), eq("analyze prompt")))
                .thenReturn("{\"matchScore\":78,\"scoreLabel\":\"Good\",\"matchedSkills\":[\"Java\"],"
                        + "\"missingSkills\":[\"Kubernetes\"],\"extraSkills\":[\"PHP\"],\"summary\":\"Good match\","
                        + "\"summaryVi\":\"Kết quả phù hợp tốt\"}");
```

and its "improve prompt" mock:

```java
        when(promptBuilder.buildImproveStructuredPrompt(any())).thenReturn("improve prompt");
        when(modelRouter.call(anyString(), eq("improve prompt")))
                .thenReturn("{\"strengths\":[{\"area\":\"Tech\",\"detail\":\"Java expert\"}],"
                        + "\"weaknesses\":[{\"area\":\"Cloud\",\"detail\":\"No K8s\"}],"
                        + "\"tips\":[{\"area\":\"Skills\",\"suggestion\":\"Learn K8s\",\"priority\":\"High\"}]}");
```

with:

```java
        when(promptBuilder.buildImproveStructuredPrompt(any())).thenReturn("improve prompt");
        when(modelRouter.call(anyString(), eq("improve prompt")))
                .thenReturn("{\"strengths\":[{\"area\":\"Tech\",\"detail\":\"Java expert\",\"detailVi\":\"Thành thạo Java\"}],"
                        + "\"weaknesses\":[{\"area\":\"Cloud\",\"detail\":\"No K8s\",\"detailVi\":\"Chưa biết K8s\"}],"
                        + "\"tips\":[{\"area\":\"Skills\",\"suggestion\":\"Learn K8s\",\"suggestionVi\":\"Học K8s\",\"priority\":\"High\"}]}");
```

Then add these assertions right before the test method's closing `verify(userClient).updateCvAnalysis(eq(CV_ID), anyString(), eq("DONE"));` line:

```java
        assertThat(result.summaryVi()).isEqualTo("Kết quả phù hợp tốt");
        assertThat(result.strengths().get(0).detailVi()).isEqualTo("Thành thạo Java");
        assertThat(result.weaknesses().get(0).detailVi()).isEqualTo("Chưa biết K8s");
        assertThat(result.tips().get(0).suggestionVi()).isEqualTo("Học K8s");
```

Now find `analyzeCv_no_jobId_prefers_onet_requirements_when_available` and add this assertion right after the existing `assertThat(result.matchScore()).isEqualTo(84);` line:

```java
        assertThat(result.summaryVi()).isEqualTo("Điểm số xác định dựa trên yêu cầu O*NET");
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd backend/ai_engine_service && rtk ./mvnw test -Dtest=AnalysisServiceCvFullTest -q`
Expected: FAIL on the new `assertThat(result.summaryVi())` assertions (both tests) — actual value is `""` because `AnalysisService.java` still hardcodes it. The `detailVi`/`suggestionVi` assertions are expected to already PASS (they document existing-correct behavior, not new behavior) — if any of them fail, that indicates strengths/weaknesses/tips parsing was broken by something other than what this plan assumed; stop and investigate before continuing.

- [ ] **Step 3: Fix the production code**

In `backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisService.java`, find (around line 396-412):

```java
        CvFullAnalysisResponse response = new CvFullAnalysisResponse(
                overallScore,
                scoreLabel,
                targetPosition,
                matchAnalysis.matchScore(),
                safeList(matchAnalysis.matchedSkills()),
                safeList(matchAnalysis.missingSkills()),
                safeList(matchAnalysis.extraSkills()),
                matchAnalysis.summary(),
                "",
                safeList(improvement.strengths()),
                safeList(improvement.weaknesses()),
                safeList(improvement.tips()),
                extractedSkills,
                matchAnalysis.breakdown(),
                matchAnalysis.evidence()
        );
```

Replace with:

```java
        CvFullAnalysisResponse response = new CvFullAnalysisResponse(
                overallScore,
                scoreLabel,
                targetPosition,
                matchAnalysis.matchScore(),
                safeList(matchAnalysis.matchedSkills()),
                safeList(matchAnalysis.missingSkills()),
                safeList(matchAnalysis.extraSkills()),
                matchAnalysis.summary(),
                matchAnalysis.summaryVi(),
                safeList(improvement.strengths()),
                safeList(improvement.weaknesses()),
                safeList(improvement.tips()),
                extractedSkills,
                matchAnalysis.breakdown(),
                matchAnalysis.evidence()
        );
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd backend/ai_engine_service && rtk ./mvnw test -Dtest=AnalysisServiceCvFullTest -q`
Expected: PASS.

- [ ] **Step 5: Run the full backend test suite**

Run: `cd backend/ai_engine_service && rtk ./mvnw test -q`
Expected: PASS, no regressions elsewhere.

- [ ] **Step 6: Commit**

```bash
cd /home/chuongpl/projects/smartCv
rtk git add backend/ai_engine_service/src/main/java/vn/chuongpl/ai_engine_service/features/analysis/AnalysisService.java backend/ai_engine_service/src/test/java/vn/chuongpl/ai_engine_service/AnalysisServiceCvFullTest.java
rtk git commit -m "fix(ai-engine): stop discarding summaryVi in full CV analysis response"
```

---

### Task 3: Frontend — `$jobId.tsx` shows the Vietnamese strengths/weaknesses/tips when the app language is VI

**Files:**
- Modify: `frontend/apps/web-candidate/src/routes/jobs/$jobId.tsx`

**Interfaces:**
- Consumes: `AiModels.StrengthItem.detailVi?`, `AiModels.WeaknessItem.detailVi?`, `AiModels.ImprovementTip.suggestionVi?` (already present in `packages/api/src/generated/ai/model/*.ts` — no swagger regen needed), and the existing `lang` variable (`const lang = usePreferencesStore((s) => s.language)` at line 115) already in scope inside `CvJobAnalysisResult`.
- Produces: no new exports — this task only changes what's rendered.

- [ ] **Step 1: Apply the three edits**

Find (inside `CvJobAnalysisResult`, the strengths list item):

```tsx
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-900/80 dark:text-muted-foreground">{s.detail}</p>
```

Replace with:

```tsx
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-900/80 dark:text-muted-foreground">{lang === 'VI' && s.detailVi ? s.detailVi : s.detail}</p>
```

Find (weaknesses list item):

```tsx
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-muted-foreground">{w.detail}</p>
```

Replace with:

```tsx
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-muted-foreground">{lang === 'VI' && w.detailVi ? w.detailVi : w.detail}</p>
```

Find (improvement tip):

```tsx
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-muted-foreground">{tip.suggestion}</p>
```

Replace with:

```tsx
                    <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-muted-foreground">{lang === 'VI' && tip.suggestionVi ? tip.suggestionVi : tip.suggestion}</p>
```

- [ ] **Step 2: Typecheck**

Run: `pnpm -F web-candidate exec tsc --noEmit`
Expected: no new errors (the `*Vi` fields are optional strings on the generated types, so `s.detailVi`/`w.detailVi`/`tip.suggestionVi` type-check without further changes).

- [ ] **Step 3: Commit**

```bash
cd /home/chuongpl/projects/smartCv
rtk git add frontend/apps/web-candidate/src/routes/jobs/\$jobId.tsx
rtk git commit -m "fix(web-candidate): show Vietnamese strengths/weaknesses/tips on job CV analysis"
```

---

### Task 4: Frontend — `CvAnalysisPanel.tsx` gets language awareness and full bilingual rendering

**Files:**
- Modify: `frontend/apps/web-candidate/src/components/cv/CvAnalysisPanel.tsx`

**Interfaces:**
- Consumes: `usePreferencesStore` from `frontend/apps/web-candidate/src/store/usePreferencesStore.ts` (same store Task 3's file already uses); the raw JSON persisted by `AnalysisService.analyzeCv()` (Task 2) already contains `summaryVi`/`detailVi`/`suggestionVi` once parsed with `JSON.parse`.
- Produces: no new exports — this task only changes what's rendered.

- [ ] **Step 1: Add the `usePreferencesStore` import**

Find (top of file):

```tsx
import { useTranslation } from '@smart-cv/i18n'
import { Button, cn } from '@smart-cv/ui'
import type { UserModels } from '@smart-cv/api'
```

Replace with:

```tsx
import { useTranslation } from '@smart-cv/i18n'
import { Button, cn } from '@smart-cv/ui'
import type { UserModels } from '@smart-cv/api'
import { usePreferencesStore } from '../../store/usePreferencesStore'
```

- [ ] **Step 2: Extend the local result interfaces with the `*Vi` fields**

Find:

```tsx
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

interface CvFullAnalysisResult {
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
```

Replace with:

```tsx
interface StrengthItem {
  area: string
  detail: string
  detailVi?: string
}

interface WeaknessItem {
  area: string
  detail: string
  detailVi?: string
}

interface ImprovementTip {
  area: string
  suggestion: string
  suggestionVi?: string
  priority: 'High' | 'Medium' | 'Low'
}

interface CvFullAnalysisResult {
  overallScore: number
  scoreLabel: string
  targetPosition: string
  matchScore: number
  matchedSkills: string[]
  missingSkills: string[]
  extraSkills: string[]
  summary: string
  summaryVi?: string
  strengths: StrengthItem[]
  weaknesses: WeaknessItem[]
  tips: ImprovementTip[]
  extractedSkills: string[]
}
```

- [ ] **Step 3: Read the language preference inside the component**

Find:

```tsx
export function CvAnalysisPanel({ analysisResultJson, analysisStatus, onRetry }: CvAnalysisPanelProps) {
  const { t } = useTranslation()
```

Replace with:

```tsx
export function CvAnalysisPanel({ analysisResultJson, analysisStatus, onRetry }: CvAnalysisPanelProps) {
  const { t } = useTranslation()
  const lang = usePreferencesStore((s) => s.language)
```

- [ ] **Step 4: Render the Vietnamese summary when applicable**

Find:

```tsx
            {analysis.summary && (
              <p className="mt-2 text-sm text-slate-600 dark:text-muted-foreground leading-relaxed">
                {analysis.summary}
              </p>
            )}
```

Replace with:

```tsx
            {analysis.summary && (
              <p className="mt-2 text-sm text-slate-600 dark:text-muted-foreground leading-relaxed">
                {lang === 'VI' && analysis.summaryVi ? analysis.summaryVi : analysis.summary}
              </p>
            )}
```

- [ ] **Step 5: Render the Vietnamese strengths/weaknesses/tips when applicable**

Find:

```tsx
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-900/80 dark:text-muted-foreground">{s.detail}</p>
```

Replace with:

```tsx
                    <p className="mt-0.5 text-xs leading-relaxed text-emerald-900/80 dark:text-muted-foreground">{lang === 'VI' && s.detailVi ? s.detailVi : s.detail}</p>
```

Find:

```tsx
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-muted-foreground">{w.detail}</p>
```

Replace with:

```tsx
                    <p className="mt-0.5 text-xs leading-relaxed text-amber-900/80 dark:text-muted-foreground">{lang === 'VI' && w.detailVi ? w.detailVi : w.detail}</p>
```

Find:

```tsx
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-muted-foreground">{tip.suggestion}</p>
```

Replace with:

```tsx
                  <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-muted-foreground">{lang === 'VI' && tip.suggestionVi ? tip.suggestionVi : tip.suggestion}</p>
```

- [ ] **Step 6: Typecheck**

Run: `pnpm -F web-candidate exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
cd /home/chuongpl/projects/smartCv
rtk git add frontend/apps/web-candidate/src/components/cv/CvAnalysisPanel.tsx
rtk git commit -m "fix(web-candidate): show Vietnamese CV analysis summary and details in CvAnalysisPanel"
```

---

### Task 5: End-to-end manual verification

**Files:** none (verification only).

**Interfaces:**
- Consumes: everything from Tasks 1-4.

- [ ] **Step 1: Start infrastructure and services**

```bash
cd /home/chuongpl/projects/smartCv
make compose-up
make run-user &
make run-job &
make run-gateway &
cd backend/ai_engine_service && rtk ./mvnw spring-boot:run &
```

Wait for all services to report ready in their logs before continuing.

- [ ] **Step 2: Start the candidate frontend**

```bash
cd /home/chuongpl/projects/smartCv
make fe-dev-candidate
```

- [ ] **Step 3: Exercise the deterministic path (JD-based) and confirm the language toggle**

In the browser: log in as a candidate, open a job detail page, upload/select a CV, click "Analyze CV for this Job" (this exercises `DeterministicCvScoringService` from Task 1 — the path that previously never had a Vietnamese summary). Once the result appears:
- With the app language set to VI (default), confirm the summary text is in Vietnamese and starts with "Điểm ".
- Toggle the app language to EN via the language switcher and confirm the summary switches to the English text — never both languages shown at once.
- Confirm strengths/weaknesses/tips text also switches language with the toggle.

- [ ] **Step 4: Exercise the CV management page (`CvAnalysisPanel.tsx`)**

Navigate to the candidate's own CV management/dashboard page where a previously-analyzed CV's result is shown (the `analysisResultJson` persisted by `AnalysisService.analyzeCv()`). Confirm the same language-switching behavior for summary, strengths, weaknesses, and tips as Step 3.

- [ ] **Step 5: Exercise the no-Job LLM path**

Trigger a CV analysis with no `jobId` and no O*NET-resolvable target role (or confirm via backend logs that `analyzeWithText` / `analyze_cv.md` was used rather than the deterministic scorer). Confirm the summary text also switches language correctly — this exercises the restoration from Task 1/2 of the LLM-driven `summaryVi` path.

- [ ] **Step 6: Report results**

If any step shows English text when VI is selected (or vice versa), or shows both languages simultaneously, stop and diagnose before considering this plan complete — do not proceed to any follow-up work.
