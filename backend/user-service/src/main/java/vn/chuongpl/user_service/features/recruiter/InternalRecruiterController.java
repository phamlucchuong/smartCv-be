package vn.chuongpl.user_service.features.recruiter;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.request.QuotaDeltaRequest;
import vn.chuongpl.user_service.dtos.response.RecruiterProfileResponse;
import vn.chuongpl.user_service.features.company.CompanyResponse;
import vn.chuongpl.user_service.features.company.CompanyService;

import java.util.List;
import java.util.Map;

/**
 * Internal endpoints consumed only by peer microservices (job_service, payment_service).
 * Security: guarded by InternalAuthFilter (X-Gateway-Secret header). No JWT required.
 */
@RestController
@RequestMapping("/api/internal/recruiters")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class InternalRecruiterController {

    RecruiterService recruiterService;
    CompanyService companyService;

    /** Called by application_service to resolve Recruiter._id → User._id for FCM/notification routing. */
    @GetMapping("/{id}/user-id")
    public ApiResponse<Map<String, String>> getUserId(@PathVariable String id) {
        return ApiResponse.<Map<String, String>>builder()
                .data(Map.of("userId", recruiterService.getUserIdByRecruiterId(id)))
                .build();
    }

    /** Called by job_service to verify recruiter status and quota before creating a job. */
    @GetMapping("/by-user/{userId}")
    public ApiResponse<RecruiterProfileResponse> getProfile(@PathVariable String userId) {
        return ApiResponse.<RecruiterProfileResponse>builder()
                .data(recruiterService.getProfile(userId))
                .build();
    }

    /** Called by payment_service after a successful invoice payment to credit quota. */
    @PostMapping("/by-user/{userId}/quota")
    public ApiResponse<RecruiterProfileResponse> addQuota(@PathVariable String userId,
                                                           @RequestBody QuotaDeltaRequest request) {
        return ApiResponse.<RecruiterProfileResponse>builder()
                .data(recruiterService.addQuota(userId, request))
                .message("Quota updated")
                .build();
    }

    @PostMapping("/by-user/{userId}/consume-ai-credit")
    public ApiResponse<Void> consumeAiCredit(@PathVariable String userId) {
        recruiterService.consumeMonthlyAiCredit(userId);
        return ApiResponse.<Void>builder().message("AI credit consumed").build();
    }

    /** Called by job_service on createJob — atomically deducts 1 job post slot. */
    @PostMapping("/by-user/{userId}/consume-job-quota")
    public ApiResponse<Void> consumeJobQuota(@PathVariable String userId) {
        recruiterService.consumeJobQuota(userId);
        return ApiResponse.<Void>builder().message("Job quota consumed").build();
    }

    /** Called by job_service on closeJob/deleteJob — refunds 1 job post slot. */
    @PostMapping("/by-user/{userId}/refund-job-quota")
    public ApiResponse<Void> refundJobQuota(@PathVariable String userId) {
        recruiterService.refundJobQuota(userId);
        return ApiResponse.<Void>builder().message("Job quota refunded").build();
    }

    /** Called by job_service to fetch companies in the same job category. */
    @GetMapping("/by-category")
    public ApiResponse<List<CompanyResponse>> getByCategory(
            @RequestParam String category,
            @RequestParam(defaultValue = "5") int limit) {
        return ApiResponse.<List<CompanyResponse>>builder()
                .data(companyService.getByCategory(category, limit))
                .build();
    }
}
