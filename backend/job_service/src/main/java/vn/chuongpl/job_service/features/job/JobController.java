package vn.chuongpl.job_service.features.job;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.job_service.dtos.ApiResponse;
import vn.chuongpl.job_service.dtos.PageResponse;
import vn.chuongpl.job_service.dtos.request.JobCreateRequest;
import vn.chuongpl.job_service.dtos.request.JobRejectRequest;
import vn.chuongpl.job_service.dtos.request.JobSearchRequest;
import vn.chuongpl.job_service.dtos.request.JobUpdateRequest;
import vn.chuongpl.job_service.dtos.response.JobResponse;
import vn.chuongpl.job_service.integration.userservice.UserServiceClient;

import java.util.Arrays;
import java.util.List;

@RestController
@RequestMapping("/api/jobs")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class JobController {
    JobService jobService;

    @PostMapping
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<JobResponse> createJob(@Valid @RequestBody JobCreateRequest request,
                                              @AuthenticationPrincipal String userId) {
        return ApiResponse.<JobResponse>builder().data(jobService.createJob(request, userId)).build();
    }

    @GetMapping
    public ApiResponse<PageResponse<JobResponse>> getActiveJobs(@RequestParam(defaultValue = "1") int page,
                                                                @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.<PageResponse<JobResponse>>builder().data(jobService.getActiveJobs(page, size)).build();
    }

    @GetMapping("/search")
    public ApiResponse<PageResponse<JobResponse>> searchJobs(@ModelAttribute JobSearchRequest request) {
        return ApiResponse.<PageResponse<JobResponse>>builder().data(jobService.searchJobs(request)).build();
    }

    @GetMapping("/my")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<PageResponse<JobResponse>> getMyJobs(@AuthenticationPrincipal String userId,
                                                            @RequestParam(defaultValue = "1") int page,
                                                            @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.<PageResponse<JobResponse>>builder().data(jobService.getMyJobs(userId, page, size)).build();
    }

    @GetMapping("/my/{id}")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<JobResponse> getMyJobById(@PathVariable String id,
                                                 @AuthenticationPrincipal String userId,
                                                 Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return ApiResponse.<JobResponse>builder().data(jobService.getMyJobById(id, userId, isAdmin)).build();
    }

    @GetMapping("/admin/all")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<JobResponse>> getAllJobs(@RequestParam(defaultValue = "1") int page,
                                                             @RequestParam(defaultValue = "10") int size,
                                                             @RequestParam(required = false) String moderationStatus,
                                                             @RequestParam(required = false) String keyword,
                                                             @RequestParam(required = false) String category) {
        return ApiResponse.<PageResponse<JobResponse>>builder()
                .data(jobService.getAllJobs(moderationStatus, keyword, category, page, size))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<JobResponse> getJobById(@PathVariable String id) {
        return ApiResponse.<JobResponse>builder().data(jobService.getJobById(id)).build();
    }

    @GetMapping("/{id}/related")
    public ApiResponse<java.util.List<JobResponse>> getRelatedJobs(@PathVariable String id) {
        return ApiResponse.<java.util.List<JobResponse>>builder().data(jobService.getRelatedJobs(id)).build();
    }

    @GetMapping("/{id}/related-companies")
    public ApiResponse<java.util.List<UserServiceClient.CompanyData>> getRelatedCompanies(@PathVariable String id) {
        return ApiResponse.<java.util.List<UserServiceClient.CompanyData>>builder()
                .data(jobService.getRelatedCompanies(id))
                .build();
    }

    @PostMapping("/admin/reindex")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Integer> reindexJobs() {
        int count = jobService.reindexAllJobs();
        return ApiResponse.<Integer>builder()
                .data(count)
                .message("Re-indexed " + count + " jobs")
                .build();
    }

    @GetMapping("/batch")
    public ApiResponse<List<JobResponse>> getJobsByIds(@RequestParam String ids) {
        List<String> idList = ids == null || ids.isBlank()
                ? List.of()
                : Arrays.asList(ids.split(","));
        return ApiResponse.<List<JobResponse>>builder()
                .data(jobService.getJobsByIds(idList))
                .build();
    }

    @GetMapping("/by-recruiter/{recruiterId}")
    public ApiResponse<List<JobResponse>> getByRecruiter(@PathVariable String recruiterId) {
        return ApiResponse.<List<JobResponse>>builder()
                .data(jobService.getActiveJobsByRecruiter(recruiterId))
                .build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<JobResponse> updateJob(@PathVariable String id,
                                              @RequestBody JobUpdateRequest request,
                                              @AuthenticationPrincipal String userId,
                                              Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return ApiResponse.<JobResponse>builder().data(jobService.updateJob(id, request, userId, isAdmin)).build();
    }

    @PatchMapping("/{id}/submit")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<JobResponse> submitJob(@PathVariable String id,
                                              @AuthenticationPrincipal String userId,
                                              Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return ApiResponse.<JobResponse>builder().data(jobService.submitJob(id, userId, isAdmin)).build();
    }

    @PatchMapping("/{id}/withdraw")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<JobResponse> withdrawJob(@PathVariable String id,
                                                @AuthenticationPrincipal String userId,
                                                Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return ApiResponse.<JobResponse>builder().data(jobService.withdrawJob(id, userId, isAdmin)).build();
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<JobResponse> activateJob(@PathVariable String id,
                                                @AuthenticationPrincipal String userId,
                                                Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return ApiResponse.<JobResponse>builder().data(jobService.activateJob(id, userId, isAdmin)).build();
    }

    @PatchMapping("/{id}/deactivate")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<JobResponse> deactivateJob(@PathVariable String id,
                                                  @AuthenticationPrincipal String userId,
                                                  Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return ApiResponse.<JobResponse>builder().data(jobService.deactivateJob(id, userId, isAdmin)).build();
    }

    @PatchMapping("/admin/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<JobResponse> approveJob(@PathVariable String id,
                                               @AuthenticationPrincipal String userId) {
        return ApiResponse.<JobResponse>builder().data(jobService.approveJob(id, userId)).build();
    }

    @PatchMapping("/admin/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<JobResponse> rejectJob(@PathVariable String id,
                                              @Valid @RequestBody JobRejectRequest request,
                                              @AuthenticationPrincipal String userId) {
        return ApiResponse.<JobResponse>builder().data(jobService.rejectJob(id, request, userId)).build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<Void> deleteJob(@PathVariable String id,
                                       @AuthenticationPrincipal String userId,
                                       Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        jobService.deleteJob(id, userId, isAdmin);
        return ApiResponse.<Void>builder().message("Delete job successfully").build();
    }

    @PostMapping("/internal/deactivate-excess")
    public ApiResponse<Integer> deactivateExcessActiveJobs(
            @RequestParam String recruiterId,
            @RequestParam int keepCount) {
        int deactivated = jobService.deactivateExcessActiveJobs(recruiterId, keepCount);
        return ApiResponse.<Integer>builder()
                .data(deactivated)
                .message("Deactivated " + deactivated + " excess job(s)")
                .build();
    }
}
