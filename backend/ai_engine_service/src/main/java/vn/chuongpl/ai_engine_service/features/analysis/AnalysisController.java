package vn.chuongpl.ai_engine_service.features.analysis;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.chuongpl.ai_engine_service.dtos.ApiResponse;
import vn.chuongpl.ai_engine_service.dtos.request.AssessmentGenerateRequest;
import vn.chuongpl.ai_engine_service.dtos.request.CvAnalyzeRequest;
import vn.chuongpl.ai_engine_service.dtos.request.CvFullAnalysisRequest;
import vn.chuongpl.ai_engine_service.dtos.request.CvImproveRequest;
import vn.chuongpl.ai_engine_service.dtos.request.InterviewQuestionsRequest;
import vn.chuongpl.ai_engine_service.dtos.request.JobRecommendRequest;
import vn.chuongpl.ai_engine_service.dtos.response.AssessmentGenerateResponse;
import vn.chuongpl.ai_engine_service.dtos.response.CvAnalysisResponse;
import vn.chuongpl.ai_engine_service.dtos.response.CvFullAnalysisResponse;
import vn.chuongpl.ai_engine_service.dtos.response.CvImprovementResponse;
import vn.chuongpl.ai_engine_service.dtos.response.InterviewQuestionsResponse;
import vn.chuongpl.ai_engine_service.dtos.response.JobRecommendationResponse;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AnalysisController {

    private final AnalysisService analysisService;

    @PostMapping("/analyze")
    @PreAuthorize("hasAnyAuthority('ROLE_CANDIDATE','ROLE_ADMIN')")
    public ApiResponse<CvAnalysisResponse> analyze(@RequestBody @Valid CvAnalyzeRequest request,
                                                   @AuthenticationPrincipal String userId,
                                                   Authentication authentication) {
        return ApiResponse.<CvAnalysisResponse>builder()
                .data(analysisService.analyze(request, userId, !isAdmin(authentication)))
                .message("Analyze CV successfully")
                .build();
    }

    @PostMapping(value = "/analyze-upload-test", consumes = "multipart/form-data")
    @PreAuthorize("hasAnyAuthority('ROLE_CANDIDATE','ROLE_ADMIN')")
    public ApiResponse<CvAnalysisResponse> analyzeUploadTest(@RequestParam("file") MultipartFile file,
                                                             @RequestParam("jobId") String jobId,
                                                             @AuthenticationPrincipal String userId,
                                                             Authentication authentication) {
        return ApiResponse.<CvAnalysisResponse>builder()
                .data(analysisService.analyzeUploadedCv(file, jobId, userId, !isAdmin(authentication)))
                .message("Analyze uploaded CV successfully")
                .build();
    }

    @PostMapping("/improve")
    @PreAuthorize("hasAnyAuthority('ROLE_CANDIDATE','ROLE_ADMIN')")
    public ApiResponse<CvImprovementResponse> improve(@RequestBody @Valid CvImproveRequest request,
                                                      @AuthenticationPrincipal String userId,
                                                      Authentication authentication) {
        return ApiResponse.<CvImprovementResponse>builder()
                .data(analysisService.improve(request, userId, !isAdmin(authentication)))
                .message("Improve CV successfully")
                .build();
    }

    @PostMapping("/recommend")
    @PreAuthorize("hasAnyAuthority('ROLE_CANDIDATE','ROLE_ADMIN')")
    public ApiResponse<JobRecommendationResponse> recommend(@RequestBody @Valid JobRecommendRequest request,
                                                            @AuthenticationPrincipal String userId,
                                                            Authentication authentication) {
        return ApiResponse.<JobRecommendationResponse>builder()
                .data(analysisService.recommend(request, userId, !isAdmin(authentication)))
                .message("Recommend jobs successfully")
                .build();
    }

    @PostMapping("/interview-questions")
    @PreAuthorize("hasAnyAuthority('ROLE_RECRUITER','ROLE_ADMIN')")
    public ApiResponse<InterviewQuestionsResponse> interviewQuestions(
            @RequestBody @Valid InterviewQuestionsRequest request,
            @AuthenticationPrincipal String userId,
            Authentication authentication) {
        return ApiResponse.<InterviewQuestionsResponse>builder()
                .data(analysisService.generateInterviewQuestions(request, userId, !isAdmin(authentication)))
                .message("Interview questions generated successfully")
                .build();
    }

    @PostMapping("/generate-assessment")
    @PreAuthorize("hasAnyAuthority('ROLE_RECRUITER','ROLE_CANDIDATE','ROLE_ADMIN')")
    public ApiResponse<AssessmentGenerateResponse> generateAssessment(
            @RequestBody @Valid AssessmentGenerateRequest request,
            @AuthenticationPrincipal String userId,
            Authentication authentication) {
        return ApiResponse.<AssessmentGenerateResponse>builder()
                .data(analysisService.generateAssessmentQuestions(
                        request,
                        userId,
                        hasRole(authentication, "ROLE_RECRUITER"),
                        hasRole(authentication, "ROLE_CANDIDATE"),
                        !isAdmin(authentication)))
                .message("Assessment questions generated successfully")
                .build();
    }

    @PostMapping("/analyze-cv")
    @PreAuthorize("hasAuthority('ROLE_CANDIDATE')")
    public ApiResponse<CvFullAnalysisResponse> analyzeCv(
            @RequestBody @Valid CvFullAnalysisRequest request,
            @AuthenticationPrincipal String userId,
            Authentication authentication) {
        return ApiResponse.<CvFullAnalysisResponse>builder()
                .data(analysisService.analyzeCv(request, userId, !isAdmin(authentication)))
                .message("CV analyzed successfully")
                .build();
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> "ROLE_ADMIN".equals(authority.getAuthority()));
    }

    private boolean hasRole(Authentication authentication, String role) {
        return authentication != null && authentication.getAuthorities().stream()
                .anyMatch(authority -> role.equals(authority.getAuthority()));
    }
}
