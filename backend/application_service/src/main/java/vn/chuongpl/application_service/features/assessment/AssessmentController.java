package vn.chuongpl.application_service.features.assessment;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.Valid;
import vn.chuongpl.application_service.dtos.ApiResponse;
import vn.chuongpl.application_service.dtos.request.AssessmentAnswerRequest;
import vn.chuongpl.application_service.dtos.request.AssessmentCreateRequest;
import vn.chuongpl.application_service.dtos.request.AssessmentGenerateRequest;
import vn.chuongpl.application_service.dtos.response.AssessmentGenerateResponse;
import vn.chuongpl.application_service.dtos.response.AssessmentResponse;
import vn.chuongpl.application_service.dtos.response.AssessmentResultResponse;
import vn.chuongpl.application_service.dtos.response.AttemptStateResponse;
import vn.chuongpl.application_service.dtos.response.AttemptSummaryResponse;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class AssessmentController {

    AssessmentService assessmentService;

    // ── Recruiter endpoints ────────────────────────────────────────────────────

    @PostMapping("/api/assessments")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<AssessmentResponse> createAssessment(
            @RequestBody AssessmentCreateRequest request,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<AssessmentResponse>builder()
                .data(assessmentService.createAssessment(request, userId))
                .build();
    }

    @GetMapping("/api/assessments")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<List<AssessmentResponse>> getRecruiterAssessments(Authentication authentication) {
        String userId = (String) authentication.getPrincipal();
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .toList();
        return ApiResponse.<List<AssessmentResponse>>builder()
                .data(assessmentService.getRecruiterAssessments(userId, roles))
                .build();
    }

    @PutMapping("/api/assessments/{id}")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('CANDIDATE')")
    public ApiResponse<AssessmentResponse> updateAssessment(
            @PathVariable String id,
            @RequestBody AssessmentCreateRequest request,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<AssessmentResponse>builder()
                .data(assessmentService.updateAssessment(id, request, userId))
                .build();
    }

    @DeleteMapping("/api/assessments/{id}")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('CANDIDATE')")
    public ApiResponse<Void> deleteAssessment(
            @PathVariable String id,
            @AuthenticationPrincipal String userId) {
        assessmentService.deleteAssessment(id, userId);
        return ApiResponse.<Void>builder().message("Assessment deleted").build();
    }

    @PatchMapping("/api/assessments/{id}/assign")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<Void> assignToCandidate(
            @PathVariable String id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal String userId) {
        assessmentService.assignToCandidate(id, body.get("candidateId"), userId);
        return ApiResponse.<Void>builder().message("Assessment assigned").build();
    }

    // ── Candidate self-test endpoints ─────────────────────────────────────────

    @PostMapping("/api/assessments/self")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<AssessmentResponse> createSelfAssessment(
            @RequestBody AssessmentCreateRequest request,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<AssessmentResponse>builder()
                .data(assessmentService.createSelfAssessment(request, userId))
                .build();
    }

    @GetMapping("/api/assessments/self")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<List<AssessmentResponse>> getMySelfAssessments(
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<List<AssessmentResponse>>builder()
                .data(assessmentService.getMySelfAssessments(userId))
                .build();
    }

    // ── Candidate endpoints ────────────────────────────────────────────────────

    @GetMapping("/api/assessments/my")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<List<AttemptStateResponse>> getMyAssessments(@AuthenticationPrincipal String userId) {
        return ApiResponse.<List<AttemptStateResponse>>builder()
                .data(assessmentService.getMyAssessments(userId))
                .build();
    }

    @GetMapping("/api/assessments/{id}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<AssessmentResponse> getAssessment(@PathVariable String id) {
        return ApiResponse.<AssessmentResponse>builder()
                .data(assessmentService.getAssessment(id))
                .build();
    }

    @PostMapping("/api/assessments/{id}/start")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Map<String, String>> startAttempt(
            @PathVariable String id,
            @AuthenticationPrincipal String userId) {
        String attemptId = assessmentService.startAttempt(id, userId);
        return ApiResponse.<Map<String, String>>builder()
                .data(Map.of("attemptId", attemptId))
                .build();
    }

    @GetMapping("/api/attempts/{attemptId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<AttemptStateResponse> getAttemptState(
            @PathVariable String attemptId,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<AttemptStateResponse>builder()
                .data(assessmentService.getAttemptState(attemptId, userId))
                .build();
    }

    @PostMapping("/api/attempts/{attemptId}/answers")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> saveAnswers(
            @PathVariable String attemptId,
            @RequestBody AssessmentAnswerRequest request,
            @AuthenticationPrincipal String userId) {
        assessmentService.saveAnswers(attemptId, request, userId);
        return ApiResponse.<Void>builder().message("Answers saved").build();
    }

    @PostMapping("/api/attempts/{attemptId}/submit")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> submitAttempt(
            @PathVariable String attemptId,
            @RequestParam(defaultValue = "false") boolean overtime,
            @AuthenticationPrincipal String userId) {
        assessmentService.submitAttempt(attemptId, userId, overtime);
        return ApiResponse.<Void>builder().message("Assessment submitted").build();
    }

    @GetMapping("/api/attempts/{attemptId}/result")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<AssessmentResultResponse> getResult(
            @PathVariable String attemptId,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<AssessmentResultResponse>builder()
                .data(assessmentService.getResult(attemptId, userId))
                .build();
    }

    @PatchMapping("/api/assessments/{id}/publish")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<AssessmentResponse> publishAssessment(
            @PathVariable String id,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<AssessmentResponse>builder()
                .data(assessmentService.publishAssessment(id, userId))
                .build();
    }

    @GetMapping("/api/assessments/{id}/attempts")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<List<AttemptSummaryResponse>> getAttemptsByAssessment(
            @PathVariable String id,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<List<AttemptSummaryResponse>>builder()
                .data(assessmentService.getAttemptsByAssessment(id, userId))
                .build();
    }

    @GetMapping("/api/attempts/candidate/{candidateId}")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<List<AttemptSummaryResponse>> getAttemptsByCandidate(
            @PathVariable String candidateId,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<List<AttemptSummaryResponse>>builder()
                .data(assessmentService.getAttemptsByCandidate(candidateId, userId))
                .build();
    }

    @DeleteMapping("/api/attempts/{attemptId}")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('CANDIDATE')")
    public ApiResponse<Void> deleteAttempt(
            @PathVariable String attemptId,
            @AuthenticationPrincipal String userId) {
        assessmentService.deleteAttempt(attemptId, userId);
        return ApiResponse.<Void>builder().message("Attempt deleted").build();
    }

    @GetMapping("/api/assessments/job/{jobId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<List<AssessmentResponse>> getAssessmentsByJob(@PathVariable String jobId) {
        return ApiResponse.<List<AssessmentResponse>>builder()
                .data(assessmentService.getAssessmentsByJob(jobId))
                .build();
    }

    @GetMapping("/api/assessments/recruiter/{recruiterId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<List<AssessmentResponse>> getAssessmentsByRecruiter(@PathVariable String recruiterId) {
        return ApiResponse.<List<AssessmentResponse>>builder()
                .data(assessmentService.getAssessmentsByRecruiter(recruiterId))
                .build();
    }

    @PostMapping("/api/assessments/generate-questions")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('CANDIDATE')")
    public ApiResponse<AssessmentGenerateResponse> generateQuestions(
            @RequestBody @Valid AssessmentGenerateRequest request) {
        return ApiResponse.<AssessmentGenerateResponse>builder()
                .data(assessmentService.generateQuestions(request))
                .build();
    }
}
