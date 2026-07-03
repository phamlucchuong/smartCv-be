package vn.chuongpl.ai_engine_service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.ai_engine_service.dtos.request.CvFullAnalysisRequest;
import vn.chuongpl.ai_engine_service.dtos.request.AssessmentGenerateRequest;
import vn.chuongpl.ai_engine_service.dtos.response.AssessmentGenerateResponse;
import vn.chuongpl.ai_engine_service.dtos.response.CvFullAnalysisResponse;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.features.analysis.AnalysisService;
import vn.chuongpl.ai_engine_service.features.analysis.PromptBuilder;
import vn.chuongpl.ai_engine_service.integration.cv.CvTextExtractor;
import vn.chuongpl.ai_engine_service.integration.job.JobClient;
import vn.chuongpl.ai_engine_service.integration.user.CvInfoResponse;
import vn.chuongpl.ai_engine_service.integration.user.JobSuggestionsPublisher;
import vn.chuongpl.ai_engine_service.integration.user.UserClient;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import org.mockito.quality.Strictness;
import org.mockito.junit.jupiter.MockitoSettings;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
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
        when(promptBuilder.systemPrompt()).thenReturn("You are an HR expert.");
        doNothing().when(userClient).consumeCandidateAiCredit(anyString());
    }

    @Test
    void analyzeCv_no_jobId_returns_full_analysis() throws Exception {
        CvInfoResponse cvInfo = new CvInfoResponse(CV_ID, CV_URL, "cv.pdf", USER_ID);
        when(userClient.getCvInfo(CV_ID)).thenReturn(cvInfo);
        when(cvTextExtractor.resolveCvText(null, CV_URL)).thenReturn(CV_TEXT);

        when(promptBuilder.buildExtractJobTargetPrompt(any())).thenReturn("extract prompt");
        when(modelRouter.call(anyString(), eq("extract prompt")))
                .thenReturn("{\"targetPosition\":\"Backend Engineer\",\"targetDomain\":\"Tech\"}");

        when(promptBuilder.buildAnalyzePrompt(any())).thenReturn("analyze prompt");
        when(modelRouter.call(anyString(), eq("analyze prompt")))
                .thenReturn("{\"matchScore\":78,\"scoreLabel\":\"Good\",\"matchedSkills\":[\"Java\"],"
                        + "\"missingSkills\":[\"Kubernetes\"],\"extraSkills\":[\"PHP\"],\"summary\":\"Good match\"}");

        when(promptBuilder.buildImproveStructuredPrompt(any())).thenReturn("improve prompt");
        when(modelRouter.call(anyString(), eq("improve prompt")))
                .thenReturn("{\"strengths\":[{\"area\":\"Tech\",\"detail\":\"Java expert\"}],"
                        + "\"weaknesses\":[{\"area\":\"Cloud\",\"detail\":\"No K8s\"}],"
                        + "\"tips\":[{\"area\":\"Skills\",\"suggestion\":\"Learn K8s\",\"priority\":\"High\"}]}");

        doNothing().when(userClient).updateCvAnalysis(anyString(), anyString(), anyString());

        CvFullAnalysisResponse result = analysisService.analyzeCv(
                new CvFullAnalysisRequest(CV_ID, null), USER_ID, true);

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
    void analyzeCv_accepts_skill_objects_from_llm_response() {
        CvInfoResponse cvInfo = new CvInfoResponse(CV_ID, CV_URL, "cv.pdf", USER_ID);
        when(userClient.getCvInfo(CV_ID)).thenReturn(cvInfo);
        when(cvTextExtractor.resolveCvText(null, CV_URL)).thenReturn(CV_TEXT);

        when(promptBuilder.buildExtractJobTargetPrompt(any())).thenReturn("extract prompt");
        when(modelRouter.call(anyString(), eq("extract prompt")))
                .thenReturn("{\"targetPosition\":\"Back-end Developer Intern\",\"targetDomain\":\"Tech\"}");

        when(promptBuilder.buildAnalyzePrompt(any())).thenReturn("analyze prompt");
        when(modelRouter.call(anyString(), eq("analyze prompt")))
                .thenReturn("{\"jobTitle\":\"Back-end Developer Intern\",\"matchScore\":78,\"scoreLabel\":\"Good\","
                        + "\"summary\":\"Strong internship-level match\","
                        + "\"matchedSkills\":[{\"skill\":\"Java\",\"evidence\":\"Built APIs\"}],"
                        + "\"missingSkills\":[],"
                        + "\"extraSkills\":[{\"skill\":\"React.js\",\"evidence\":\"Frontend project\"}],"
                        + "\"recommendations\":[{\"priority\":\"high\",\"area\":\"Impact\",\"advice\":\"Add metrics\"}]}");

        when(promptBuilder.buildImproveStructuredPrompt(any())).thenReturn("improve prompt");
        when(modelRouter.call(anyString(), eq("improve prompt")))
                .thenReturn("{\"strengths\":[],\"weaknesses\":[],\"tips\":[]}");

        doNothing().when(userClient).updateCvAnalysis(anyString(), anyString(), anyString());

        CvFullAnalysisResponse result = analysisService.analyzeCv(
                new CvFullAnalysisRequest(CV_ID, null), USER_ID, true);

        assertThat(result.matchScore()).isEqualTo(78);
        assertThat(result.matchedSkills()).containsExactly("Java");
        assertThat(result.extraSkills()).containsExactly("React.js");
        assertThat(result.extractedSkills()).containsExactly("Java", "React.js");
    }

    @Test
    void analyzeCv_accepts_actual_llm_payload_with_wrapping_text() {
        CvInfoResponse cvInfo = new CvInfoResponse(CV_ID, CV_URL, "cv.pdf", USER_ID);
        when(userClient.getCvInfo(CV_ID)).thenReturn(cvInfo);
        when(cvTextExtractor.resolveCvText(null, CV_URL)).thenReturn(CV_TEXT);

        when(promptBuilder.buildExtractJobTargetPrompt(any())).thenReturn("extract prompt");
        when(modelRouter.call(anyString(), eq("extract prompt")))
                .thenReturn("{\"targetPosition\":\"Back-end Developer Intern\",\"targetDomain\":\"Tech\"}");

        when(promptBuilder.buildAnalyzePrompt(any())).thenReturn("analyze prompt");
        when(modelRouter.call(anyString(), eq("analyze prompt")))
                .thenReturn("""
                        Here is the analysis result:
                        {
                          "jobTitle": "Back-end Developer Intern",
                          "matchScore": 78,
                          "scoreLabel": "Good",
                          "summary": "This is a strong internship-level match. You already show hands-on back-end experience with Golang, Java, .NET, SQL Server, PostgreSQL, Git, and API development through multiple projects, which aligns well with a back-end intern role. The main gap is that the job description is very sparse, so your biggest improvement lever is to make your back-end impact clearer with concise metrics, architecture details, and stronger evidence of testing, deployment, or teamwork.",
                          "matchedSkills": [
                            {
                              "skill": "Back-end development",
                              "evidence": "Multiple projects where you built APIs, database logic, authentication, and server-side features."
                            },
                            {
                              "skill": "Golang",
                              "evidence": "Listed in technical skills and used in the Dental Smile project."
                            }
                          ],
                          "missingSkills": [],
                          "extraSkills": [
                            {
                              "skill": "React.js",
                              "evidence": "Listed in technical skills and used in projects, but not required for a back-end intern role."
                            },
                            {
                              "skill": "Spring Boot",
                              "evidence": "Used in the IT Jobs project."
                            },
                            {
                              "skill": "Postman",
                              "evidence": "Listed in technical skills."
                            }
                          ],
                          "recommendations": [
                            {
                              "priority": "high",
                              "area": "CV positioning",
                              "advice": "Move your strongest back-end stack to the top of the CV."
                            },
                            {
                              "priority": "medium",
                              "area": "Experience clarity",
                              "advice": "Clarify your role in each project, including Women’s Shop."
                            }
                          ]
                        }
                        """);

        when(promptBuilder.buildImproveStructuredPrompt(any())).thenReturn("improve prompt");
        when(modelRouter.call(anyString(), eq("improve prompt")))
                .thenReturn("{\"strengths\":[],\"weaknesses\":[],\"tips\":[]}");

        doNothing().when(userClient).updateCvAnalysis(anyString(), anyString(), anyString());

        CvFullAnalysisResponse result = analysisService.analyzeCv(
                new CvFullAnalysisRequest(CV_ID, null), USER_ID, true);

        assertThat(result.matchScore()).isEqualTo(78);
        assertThat(result.matchedSkills()).containsExactly("Back-end development", "Golang");
        assertThat(result.extraSkills()).containsExactly("React.js", "Spring Boot", "Postman");
        assertThat(result.extractedSkills()).containsExactly(
                "Back-end development", "Golang", "React.js", "Spring Boot", "Postman");
    }

    @Test
    void analyzeCv_throws_UNAUTHORIZED_when_user_does_not_own_cv() {
        CvInfoResponse cvInfo = new CvInfoResponse(CV_ID, CV_URL, "cv.pdf", "other-user");
        when(userClient.getCvInfo(CV_ID)).thenReturn(cvInfo);

        assertThatThrownBy(() -> analysisService.analyzeCv(
                new CvFullAnalysisRequest(CV_ID, null), USER_ID, true))
                .isInstanceOf(AppException.class)
                .satisfies(ex -> assertThat(((AppException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.UNAUTHORIZED));
    }

    @Test
    void computeScoreLabel_returns_correct_labels() {
        assertThat(analysisService.computeScoreLabel(85)).isEqualTo("Excellent");
        assertThat(analysisService.computeScoreLabel(84)).isEqualTo("Good");
        assertThat(analysisService.computeScoreLabel(70)).isEqualTo("Good");
        assertThat(analysisService.computeScoreLabel(69)).isEqualTo("Fair");
        assertThat(analysisService.computeScoreLabel(50)).isEqualTo("Fair");
        assertThat(analysisService.computeScoreLabel(49)).isEqualTo("Poor");
    }

    @Test
    void generateAssessmentQuestions_consumesRecruiterQuotaBeforeCallingAi() {
        AssessmentGenerateRequest request = new AssessmentGenerateRequest(
                "Java Developer", "Junior", "Medium", 5, "desc", "Java", "REST");
        when(promptBuilder.buildAssessmentGeneratePrompt(any())).thenReturn("assessment prompt");
        when(modelRouter.call(anyString(), eq("assessment prompt")))
                .thenReturn("{\"questions\":[]}");

        AssessmentGenerateResponse result = analysisService.generateAssessmentQuestions(
                request, USER_ID, true, false, true);

        assertThat(result.questions()).isEmpty();
        verify(userClient).consumeRecruiterAiCredit(USER_ID);
        verify(userClient, never()).consumeCandidateAiCredit(anyString());
    }

    @Test
    void generateAssessmentQuestions_consumesCandidateQuotaBeforeCallingAi() {
        AssessmentGenerateRequest request = new AssessmentGenerateRequest(
                "Java Developer", "Junior", "Medium", 5, "desc", "Java", "REST");
        when(promptBuilder.buildAssessmentGeneratePrompt(any())).thenReturn("assessment prompt");
        when(modelRouter.call(anyString(), eq("assessment prompt")))
                .thenReturn("{\"questions\":[]}");

        AssessmentGenerateResponse result = analysisService.generateAssessmentQuestions(
                request, USER_ID, false, true, true);

        assertThat(result.questions()).isEmpty();
        verify(userClient).consumeCandidateAiCredit(USER_ID);
    }
}
