package vn.chuongpl.ai_engine_service.features.analysis;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.ai_engine_service.dtos.request.CvAnalyzeRequest;
import vn.chuongpl.ai_engine_service.dtos.response.CvAnalysisResponse;
import vn.chuongpl.ai_engine_service.integration.cv.CvTextExtractor;
import vn.chuongpl.ai_engine_service.integration.job.JobClient;
import vn.chuongpl.ai_engine_service.integration.job.JobSummary;
import vn.chuongpl.ai_engine_service.integration.user.JobSuggestionsPublisher;
import vn.chuongpl.ai_engine_service.integration.user.UserClient;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AnalysisServiceDeterministicAnalyzeTest {

    @Mock AiModelGatewayRouter modelRouter;
    @Mock PromptBuilder promptBuilder;
    @Mock CvTextExtractor cvTextExtractor;
    @Mock JobClient jobClient;
    @Mock JobSuggestionsPublisher jobSuggestionsPublisher;
    @Mock UserClient userClient;
    @Mock StructuredProfileExtractionService structuredProfileExtractionService;
    @Mock DeterministicCvScoringService deterministicCvScoringService;

    @InjectMocks AnalysisService analysisService;

    @Test
    void analyze_uses_structured_extraction_and_deterministic_scoring() {
        JobSummary job = new JobSummary("job-1", "Backend Engineer", "Acme", "Build APIs",
                List.of("Java", "Spring Boot"), List.of("3+ years"), "Mid");
        StructuredCvProfile cvProfile = new StructuredCvProfile(
                new StructuredCvProfile.CandidateProfile(List.of("Backend Engineer"), "Mid", List.of("FinTech"), 4),
                new StructuredCvProfile.SkillProfile(List.of("Java", "Spring Boot"), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()),
                List.of(), List.of(), List.of(), List.of()
        );
        StructuredJobRequirements jobRequirements = new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo("Backend Engineer", "Mid", "FinTech", "Full-time"),
                new StructuredJobRequirements.RequirementProfile(List.of("Java"), List.of(), List.of(), List.of("Spring Boot"),
                        List.of(), List.of(), List.of(), List.of(), 3),
                List.of(), List.of()
        );
        CvAnalysisResponse expected = new CvAnalysisResponse(
                88, "Excellent", List.of("Java", "Spring Boot"), List.of(), List.of(),
                "Strong match", null, null
        );

        when(cvTextExtractor.resolveCvText("cv text", null)).thenReturn("cv text");
        when(jobClient.getJobById("job-1")).thenReturn(job);
        when(structuredProfileExtractionService.extractCvProfile("cv text")).thenReturn(cvProfile);
        when(structuredProfileExtractionService.extractJobRequirements(job)).thenReturn(jobRequirements);
        when(deterministicCvScoringService.score(cvProfile, jobRequirements)).thenReturn(expected);

        CvAnalysisResponse result = analysisService.analyze(new CvAnalyzeRequest("cv text", null, "job-1"));

        assertThat(result).isEqualTo(expected);
        verify(structuredProfileExtractionService).extractCvProfile("cv text");
        verify(structuredProfileExtractionService).extractJobRequirements(eq(job));
        verify(deterministicCvScoringService).score(cvProfile, jobRequirements);
    }
}
