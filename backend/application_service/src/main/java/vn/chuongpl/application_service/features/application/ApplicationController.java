package vn.chuongpl.application_service.features.application;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.application_service.dtos.ApiResponse;
import vn.chuongpl.application_service.dtos.PageResponse;
import vn.chuongpl.application_service.dtos.request.AiScoreUpdateRequest;
import vn.chuongpl.application_service.dtos.request.ApplicationCreateRequest;
import vn.chuongpl.application_service.dtos.request.ApplicationStatusUpdateRequest;
import vn.chuongpl.application_service.dtos.response.ApplicationDetailResponse;
import vn.chuongpl.application_service.dtos.response.ApplicationResponse;

import java.util.List;

@RestController
@RequestMapping("/api/applications")
@RequiredArgsConstructor
public class ApplicationController {

    final ApplicationService applicationService;
    final ApplicationAggregateService applicationAggregateService;

    @GetMapping("/top-jobs")
    public ApiResponse<List<TopJobCountDto>> getTopJobs(
            @RequestParam(defaultValue = "6") int limit) {
        return ApiResponse.<List<TopJobCountDto>>builder()
                .data(applicationAggregateService.getTopJobsByApplicationCount(limit))
                .build();
    }

    @PostMapping
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<ApplicationResponse> submit(@Valid @RequestBody ApplicationCreateRequest request,
                                                   @AuthenticationPrincipal String userId) {
        return ApiResponse.<ApplicationResponse>builder()
                .message("Application submitted successfully")
                .data(applicationService.submit(request, userId))
                .build();
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<PageResponse<ApplicationResponse>> getMyApplications(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<PageResponse<ApplicationResponse>>builder()
                .data(applicationService.getMyApplications(userId, page, size))
                .build();
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<Object> getById(@PathVariable String id,
                                       @AuthenticationPrincipal String userId,
                                       Authentication authentication) {
        boolean isAdmin = hasRole(authentication, "ROLE_ADMIN");
        boolean isRecruiter = hasRole(authentication, "ROLE_RECRUITER");
        return ApiResponse.builder()
                .data(applicationService.getById(id, userId, isAdmin, isRecruiter))
                .build();
    }

    @GetMapping("/job/{jobId}")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<PageResponse<ApplicationDetailResponse>> getByJobId(@PathVariable String jobId,
                                                                            @RequestParam(defaultValue = "1") int page,
                                                                            @RequestParam(defaultValue = "10") int size,
                                                                            @AuthenticationPrincipal String userId,
                                                                            Authentication authentication) {
        boolean isAdmin = hasRole(authentication, "ROLE_ADMIN");
        return ApiResponse.<PageResponse<ApplicationDetailResponse>>builder()
                .data(applicationService.getByJobId(jobId, userId, isAdmin, page, size))
                .build();
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<ApplicationDetailResponse> updateStatus(@PathVariable String id,
                                                               @Valid @RequestBody ApplicationStatusUpdateRequest request,
                                                               @AuthenticationPrincipal String userId,
                                                               Authentication authentication) {
        boolean isAdmin = hasRole(authentication, "ROLE_ADMIN");
        return ApiResponse.<ApplicationDetailResponse>builder()
                .message("Application status updated")
                .data(applicationService.updateStatus(id, request, userId, isAdmin))
                .build();
    }

    @PatchMapping("/{id}/withdraw")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<ApplicationResponse> withdraw(@PathVariable String id,
                                                     @AuthenticationPrincipal String userId) {
        return ApiResponse.<ApplicationResponse>builder()
                .message("Application withdrawn")
                .data(applicationService.withdraw(id, userId))
                .build();
    }

    @GetMapping("/by-job/{jobId}/mine")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<ApplicationResponse> getMyApplicationForJob(@PathVariable String jobId,
                                                                    @AuthenticationPrincipal String userId) {
        return ApiResponse.<ApplicationResponse>builder()
                .data(applicationService.getMyApplicationForJob(userId, jobId))
                .build();
    }

    @GetMapping("/recruiter")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<PageResponse<ApplicationDetailResponse>> getMyJobsApplications(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "50") int size,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<PageResponse<ApplicationDetailResponse>>builder()
                .data(applicationService.getByRecruiterId(userId, page, size))
                .build();
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<ApplicationDetailResponse>> getAll(@RequestParam(defaultValue = "1") int page,
                                                                       @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.<PageResponse<ApplicationDetailResponse>>builder()
                .data(applicationService.getAll(page, size))
                .build();
    }

    @PatchMapping("/{id}/ai-score")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> updateAiScore(@PathVariable String id,
                                           @RequestBody AiScoreUpdateRequest request) {
        applicationService.updateAiScore(id, request);
        return ApiResponse.<Void>builder().build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable String id) {
        applicationService.delete(id);
        return ApiResponse.<Void>builder().message("Application deleted").build();
    }

    private boolean hasRole(Authentication auth, String role) {
        return auth.getAuthorities().stream().anyMatch(a -> a.getAuthority().equals(role));
    }
}
