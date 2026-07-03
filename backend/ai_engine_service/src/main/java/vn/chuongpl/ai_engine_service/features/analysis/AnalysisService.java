package vn.chuongpl.ai_engine_service.features.analysis;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vn.chuongpl.ai_engine_service.dtos.request.AssessmentGenerateRequest;
import vn.chuongpl.ai_engine_service.dtos.request.CvAnalyzeRequest;
import vn.chuongpl.ai_engine_service.dtos.request.CvImproveRequest;
import vn.chuongpl.ai_engine_service.dtos.request.InterviewQuestionsRequest;
import vn.chuongpl.ai_engine_service.dtos.request.JobRecommendRequest;
import vn.chuongpl.ai_engine_service.dtos.response.AssessmentGenerateResponse;
import vn.chuongpl.ai_engine_service.dtos.response.CvAnalysisResponse;
import vn.chuongpl.ai_engine_service.dtos.response.CvImprovementResponse;
import vn.chuongpl.ai_engine_service.dtos.response.InterviewQuestionsResponse;
import vn.chuongpl.ai_engine_service.dtos.response.JobRecommendationResponse;
import vn.chuongpl.ai_engine_service.dtos.response.SkillExtractionResponse;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.integration.cv.CvTextExtractor;
import vn.chuongpl.ai_engine_service.integration.job.JobClient;
import vn.chuongpl.ai_engine_service.integration.job.JobSummary;
import vn.chuongpl.ai_engine_service.integration.user.JobSuggestionsMessage;
import vn.chuongpl.ai_engine_service.integration.user.JobSuggestionsPublisher;

import vn.chuongpl.ai_engine_service.dtos.request.CvFullAnalysisRequest;
import vn.chuongpl.ai_engine_service.dtos.response.CvFullAnalysisResponse;
import vn.chuongpl.ai_engine_service.dtos.response.CvImproveStructuredResponse;
import vn.chuongpl.ai_engine_service.dtos.response.ExtractJobTargetResponse;
import vn.chuongpl.ai_engine_service.integration.user.CvInfoResponse;
import vn.chuongpl.ai_engine_service.integration.user.UserClient;

import java.util.Collections;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Slf4j
public class AnalysisService {

    private final AiModelGatewayRouter modelRouter;
    private final PromptBuilder promptBuilder;
    private final CvTextExtractor cvTextExtractor;
    private final JobClient jobClient;
    private final JobSuggestionsPublisher jobSuggestionsPublisher;
    private final UserClient userClient;

    @Value("${app.ai.recommend-batch-size:20}")
    private int recommendBatchSize;

    private final ObjectMapper mapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    public CvAnalysisResponse analyze(CvAnalyzeRequest request) {
        String cvText = cvTextExtractor.resolveCvText(request.cvText(), request.cvUrl());
        JobSummary job = jobClient.getJobById(request.jobId());
        return analyzeCvText(cvText, job);
    }

    public CvAnalysisResponse analyze(CvAnalyzeRequest request, String userId, boolean consumeQuota) {
        if (consumeQuota) {
            userClient.consumeCandidateAiCredit(userId);
        }
        return analyze(request);
    }

    public CvAnalysisResponse analyzeUploadedCv(MultipartFile file, String jobId) {
        if (jobId == null || jobId.isBlank()) {
            throw new AppException(ErrorCode.JOB_ID_REQUIRED);
        }

        String cvText = cvTextExtractor.extractFromUpload(file);
        JobSummary job = jobClient.getJobById(jobId);
        return analyzeCvText(cvText, job);
    }

    public CvAnalysisResponse analyzeUploadedCv(MultipartFile file, String jobId, String userId, boolean consumeQuota) {
        if (consumeQuota) {
            userClient.consumeCandidateAiCredit(userId);
        }
        return analyzeUploadedCv(file, jobId);
    }

    private CvAnalysisResponse analyzeCvText(String cvText, JobSummary job) {
        String prompt = promptBuilder.buildAnalyzePrompt(Map.of(
                "CV_TEXT", cvText,
                "JOB_TITLE", nvl(job.title()),
                "JOB_DESCRIPTION", nvl(job.description()),
                "JOB_SKILLS", String.join(", ", safeList(job.skills())),
                "JOB_REQUIREMENTS", String.join("\n- ", safeList(job.requirements())),
                "EXPERIENCE_LEVEL", nvl(job.experienceLevel())
        ));

        String aiContent = callAi(prompt);
        return parse(aiContent, CvAnalysisResponse.class);
    }

    public CvAnalysisResponse autoScore(String cvUrl, String jobId) {
        String cvText = cvTextExtractor.resolveCvText(null, cvUrl);
        JobSummary job = jobClient.getJobById(jobId);

        String prompt = promptBuilder.buildAnalyzePrompt(Map.of(
                "CV_TEXT", cvText,
                "JOB_TITLE", nvl(job.title()),
                "JOB_DESCRIPTION", nvl(job.description()),
                "JOB_SKILLS", String.join(", ", safeList(job.skills())),
                "JOB_REQUIREMENTS", String.join("\n- ", safeList(job.requirements())),
                "EXPERIENCE_LEVEL", nvl(job.experienceLevel())
        ));

        String aiContent = callAi(prompt);
        return parse(aiContent, CvAnalysisResponse.class);
    }

    public SkillExtractionResponse extractSkills(String cvUrl) {
        String cvText = cvTextExtractor.resolveCvText(null, cvUrl);
        String prompt = promptBuilder.buildExtractSkillsPrompt(Map.of("CV_TEXT", cvText));
        String aiContent = callAi(prompt);
        return parse(aiContent, SkillExtractionResponse.class);
    }

    public CvImprovementResponse improve(CvImproveRequest request) {
        String cvText = cvTextExtractor.resolveCvText(request.cvText(), request.cvUrl());
        JobSummary job = jobClient.getJobById(request.jobId());

        String prompt = promptBuilder.buildImprovePrompt(Map.of(
                "CV_TEXT", cvText,
                "JOB_TITLE", nvl(job.title()),
                "JOB_DESCRIPTION", nvl(job.description()),
                "JOB_SKILLS", String.join(", ", safeList(job.skills())),
                "JOB_REQUIREMENTS", String.join("\n- ", safeList(job.requirements()))
        ));

        String aiContent = callAi(prompt);
        return parse(aiContent, CvImprovementResponse.class);
    }

    public CvImprovementResponse improve(CvImproveRequest request, String userId, boolean consumeQuota) {
        if (consumeQuota) {
            userClient.consumeCandidateAiCredit(userId);
        }
        return improve(request);
    }

    public JobRecommendationResponse recommend(JobRecommendRequest request) {
        return recommend(request, null, false);
    }

    public JobRecommendationResponse recommend(JobRecommendRequest request, String candidateId, boolean consumeQuota) {
        if (consumeQuota && candidateId != null && !candidateId.isBlank()) {
            userClient.consumeCandidateAiCredit(candidateId);
        }
        String cvText = cvTextExtractor.resolveCvText(request.cvText(), request.cvUrl());
        int topK = request.topK() == null ? 5 : request.topK();

        if (topK < 1 || topK > 50) {
            throw new AppException(ErrorCode.INVALID_TOP_K);
        }

        List<JobSummary> jobs = jobClient.getActiveJobs(0, recommendBatchSize);
        String jobsJson;
        try {
            jobsJson = mapper.writeValueAsString(jobs);
        } catch (Exception e) {
            jobsJson = "[]";
        }

        String prompt = promptBuilder.buildRecommendPrompt(Map.of(
                "CV_TEXT", cvText,
                "JOBS_JSON", jobsJson
        )) + "\n\nTop-K: " + topK;

        String aiContent = callAi(prompt);
        JobRecommendationResponse response = parse(aiContent, JobRecommendationResponse.class);

        if (candidateId != null && !candidateId.isBlank() && response.recommendations() != null) {
            List<JobSuggestionsMessage.JobSuggestionItem> suggestions = response.recommendations().stream()
                    .map(r -> new JobSuggestionsMessage.JobSuggestionItem(
                            r.jobId(), r.matchScore(), r.matchReason(), r.alignedSkills()))
                    .toList();
            jobSuggestionsPublisher.publish(new JobSuggestionsMessage(candidateId, suggestions));
        }

        return response;
    }

    public InterviewQuestionsResponse generateInterviewQuestions(InterviewQuestionsRequest request) {
        if ((request.cvText() == null || request.cvText().isBlank())
                && (request.cvUrl() == null || request.cvUrl().isBlank())) {
            throw new AppException(ErrorCode.CV_TEXT_REQUIRED);
        }

        String cvText = cvTextExtractor.resolveCvText(request.cvText(), request.cvUrl());
        JobSummary job = jobClient.getJobById(request.jobId());

        String prompt = promptBuilder.buildInterviewQuestionsPrompt(Map.of(
                "CV_TEXT", cvText,
                "JOB_TITLE", nvl(job.title()),
                "JOB_DESCRIPTION", nvl(job.description()),
                "JOB_SKILLS", String.join(", ", safeList(job.skills())),
                "JOB_REQUIREMENTS", String.join("\n- ", safeList(job.requirements()))
        ));

        String aiContent = callAi(prompt);
        return parse(aiContent, InterviewQuestionsResponse.class);
    }

    public InterviewQuestionsResponse generateInterviewQuestions(InterviewQuestionsRequest request, String userId, boolean consumeQuota) {
        if (consumeQuota) {
            userClient.consumeRecruiterAiCredit(userId);
        }
        return generateInterviewQuestions(request);
    }

    public AssessmentGenerateResponse generateAssessmentQuestions(AssessmentGenerateRequest request) {
        String prompt = promptBuilder.buildAssessmentGeneratePrompt(Map.of(
                "JOB_NAME", request.jobName(),
                "LEVEL", nvl(request.level()),
                "DIFFICULTY", nvl(request.difficulty()),
                "NUM_QUESTIONS", String.valueOf(request.numQuestions()),
                "JOB_DESCRIPTION", nvl(request.jobDescription()),
                "JOB_SKILLS", nvl(request.jobSkills()),
                "JOB_REQUIREMENTS", nvl(request.jobRequirements())
        ));
        String aiContent = callAi(prompt);
        return parse(aiContent, AssessmentGenerateResponse.class);
    }

    public AssessmentGenerateResponse generateAssessmentQuestions(
            AssessmentGenerateRequest request,
            String userId,
            boolean recruiterRole,
            boolean candidateRole,
            boolean consumeQuota) {
        if (consumeQuota && userId != null && !userId.isBlank()) {
            if (recruiterRole) {
                userClient.consumeRecruiterAiCredit(userId);
            } else if (candidateRole) {
                userClient.consumeCandidateAiCredit(userId);
            }
        }
        return generateAssessmentQuestions(request);
    }

    private String callAi(String prompt) {
        try {
            return modelRouter.call(promptBuilder.systemPrompt(), prompt);
        } catch (AppException e) {
            throw e;
        } catch (Exception e) {
            log.error("AI call failed: {}", e.getMessage());
            throw new AppException(ErrorCode.AI_PROCESSING_FAILED);
        }
    }

    private <T> T parse(String raw, Class<T> clazz) {
        try {
            String normalized = extractJson(raw);
            if (clazz == CvAnalysisResponse.class) {
                JsonNode payload = mapper.readTree(normalized);
                normalizeSkillArrays(payload, "matchedSkills");
                normalizeSkillArrays(payload, "missingSkills");
                normalizeSkillArrays(payload, "extraSkills");
                return clazz.cast(mapper.treeToValue(payload, CvAnalysisResponse.class));
            }
            return mapper.readValue(normalized, clazz);
        } catch (Exception e) {
            log.error("Failed to parse AI response: {}. Cause: {}", raw, e.getMessage(), e);
            throw new AppException(ErrorCode.AI_PROCESSING_FAILED);
        }
    }

    private void normalizeSkillArrays(JsonNode payload, String fieldName) {
        if (!(payload instanceof com.fasterxml.jackson.databind.node.ObjectNode objectNode)) {
            return;
        }

        JsonNode field = objectNode.get(fieldName);
        if (field == null || !field.isArray()) {
            return;
        }

        List<String> normalized = new ArrayList<>();
        field.forEach(item -> {
            String value = extractSkillName(item);
            if (value != null && !value.isBlank()) {
                normalized.add(value);
            }
        });
        objectNode.set(fieldName, mapper.valueToTree(normalized));
    }

    private String extractSkillName(JsonNode item) {
        if (item == null || item.isNull()) {
            return null;
        }
        if (item.isTextual()) {
            return item.asText();
        }
        JsonNode skill = item.get("skill");
        if (skill != null && skill.isTextual()) {
            return skill.asText();
        }
        JsonNode name = item.get("name");
        if (name != null && name.isTextual()) {
            return name.asText();
        }
        return null;
    }

    private String extractJson(String raw) {
        String trimmed = raw == null ? "" : raw.trim();
        if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
            trimmed = trimmed.replaceFirst("^```json", "").replaceFirst("^```", "");
            trimmed = trimmed.substring(0, trimmed.lastIndexOf("```"));
        }

        String candidate = trimmed.trim();
        int objectStart = candidate.indexOf('{');
        int objectEnd = candidate.lastIndexOf('}');
        if (objectStart >= 0 && objectEnd > objectStart) {
            return candidate.substring(objectStart, objectEnd + 1).trim();
        }

        int arrayStart = candidate.indexOf('[');
        int arrayEnd = candidate.lastIndexOf(']');
        if (arrayStart >= 0 && arrayEnd > arrayStart) {
            return candidate.substring(arrayStart, arrayEnd + 1).trim();
        }

        return candidate;
    }

    private String nvl(String value) {
        return value == null ? "" : value;
    }

    private <T> List<T> safeList(List<T> values) {
        return values == null ? Collections.emptyList() : values;
    }

    public CvFullAnalysisResponse analyzeCv(CvFullAnalysisRequest request, String userId, boolean consumeQuota) {
        CvInfoResponse cvInfo = userClient.getCvInfo(request.cvId());
        if (!cvInfo.ownerId().equals(userId)) {
            throw new AppException(ErrorCode.UNAUTHORIZED);
        }
        if (consumeQuota) {
            userClient.consumeCandidateAiCredit(userId);
        }

        String cvText = cvTextExtractor.resolveCvText(null, cvInfo.cvUrl());

        ExtractJobTargetResponse target = extractJobTarget(cvText);
        String targetPosition = target.targetPosition();

        CvAnalysisResponse matchAnalysis;
        int overallScore;
        CvImproveStructuredResponse improvement;

        if (request.jobId() != null) {
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
            matchAnalysis = analyzeWithText(cvText, targetPosition, targetPosition, "", "");
            overallScore = matchAnalysis.matchScore();
            improvement = improveWithText(cvText, targetPosition, targetPosition, "", "");
        }

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
                matchAnalysis.summaryVi(),
                safeList(improvement.strengths()),
                safeList(improvement.weaknesses()),
                safeList(improvement.tips()),
                extractedSkills
        );

        try {
            userClient.updateCvAnalysis(request.cvId(), mapper.writeValueAsString(response), "DONE");
        } catch (Exception e) {
            log.warn("Failed to persist CV analysis for cvId={}: {}", request.cvId(), e.getMessage());
        }

        final String cvUrl = cvInfo.cvUrl();
        final String candidateId = userId;
        CompletableFuture.runAsync(() -> {
            try {
                recommend(new JobRecommendRequest(null, cvUrl, 3), candidateId, false);
            } catch (Exception e) {
                log.warn("Job recommendation failed for userId={}: {}", candidateId, e.getMessage());
            }
        });

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
        return parse(callAi(prompt), ExtractJobTargetResponse.class);
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
        return parse(callAi(prompt), CvAnalysisResponse.class);
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
        return parse(callAi(prompt), CvImproveStructuredResponse.class);
    }
}
