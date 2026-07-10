package vn.chuongpl.user_service.features.recruiter;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import jakarta.validation.Valid;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.PageResponse;
import vn.chuongpl.user_service.dtos.request.RecruiterRequest;
import vn.chuongpl.user_service.dtos.request.RecruiterStatusRequest;
import vn.chuongpl.user_service.dtos.response.RecruiterPublicResponse;
import vn.chuongpl.user_service.dtos.response.RecruiterResponse;
import vn.chuongpl.user_service.enums.RecruiterStatus;

@RestController
@RequestMapping("/api/recruiters")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class RecruiterController {
    RecruiterService recruiterService;

    @PostMapping
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<RecruiterResponse> create(@RequestBody RecruiterRequest request) {
        return ApiResponse.<RecruiterResponse>builder().data(recruiterService.create(request)).build();
    }

    @GetMapping("/{id}")
    public ApiResponse<RecruiterPublicResponse> getById(@PathVariable String id) {
        return ApiResponse.<RecruiterPublicResponse>builder().data(recruiterService.getById(id)).build();
    }

    @GetMapping("/user/{userId}")
    public ApiResponse<RecruiterPublicResponse> getByUserId(@PathVariable String userId) {
        return ApiResponse.<RecruiterPublicResponse>builder().data(recruiterService.getByUserId(userId)).build();
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<RecruiterResponse> getMe(@AuthenticationPrincipal String userId) {
        return ApiResponse.<RecruiterResponse>builder().data(recruiterService.getMe(userId)).build();
    }

    @PostMapping("/me/submit")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<RecruiterResponse> submitForApproval(@AuthenticationPrincipal String userId) {
        return ApiResponse.<RecruiterResponse>builder().data(recruiterService.submitForApproval(userId)).build();
    }

    @PostMapping("/me/business-license")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<RecruiterResponse> uploadBusinessLicense(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<RecruiterResponse>builder().data(recruiterService.uploadBusinessLicense(userId, file)).build();
    }

    @PostMapping("/me/logo")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<String> uploadLogo(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<String>builder().data(recruiterService.uploadLogo(userId, file)).build();
    }

    @PostMapping("/me/banner")
    @PreAuthorize("hasRole('RECRUITER')")
    public ApiResponse<String> uploadBanner(
            @RequestParam("file") MultipartFile file,
            @AuthenticationPrincipal String userId) {
        return ApiResponse.<String>builder().data(recruiterService.uploadBanner(userId, file)).build();
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<PageResponse<RecruiterResponse>> getAll(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) RecruiterStatus status,
            @RequestParam(required = false) String keyword) {
        return ApiResponse.<PageResponse<RecruiterResponse>>builder().data(recruiterService.getAll(page, size, status, keyword)).build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('RECRUITER') or hasRole('ADMIN')")
    public ApiResponse<RecruiterResponse> update(@PathVariable String id,
                                                 @RequestBody RecruiterRequest request,
                                                 @AuthenticationPrincipal String userId,
                                                 Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return ApiResponse.<RecruiterResponse>builder().data(recruiterService.update(id, request, userId, isAdmin)).build();
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<RecruiterResponse> updateStatus(@PathVariable String id,
                                                       @Valid @RequestBody RecruiterStatusRequest request) {
        return ApiResponse.<RecruiterResponse>builder().data(recruiterService.updateStatus(id, request)).build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable String id) {
        recruiterService.delete(id);
        return ApiResponse.<Void>builder().build();
    }
}
