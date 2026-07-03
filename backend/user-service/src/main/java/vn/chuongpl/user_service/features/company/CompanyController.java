package vn.chuongpl.user_service.features.company;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.PageResponse;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.integration.job.JobSummary;

import java.util.List;

@RestController
@RequestMapping("/api/companies")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class CompanyController {
    CompanyService companyService;
    CandidateService candidateService;

    @GetMapping
    public ApiResponse<PageResponse<CompanyResponse>> getAll(
            @RequestParam(defaultValue = "1") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String query,
            @RequestParam(required = false) String industry,
            @RequestParam(required = false) String companySize,
            @RequestParam(required = false) String location,
            @RequestParam(required = false) String category) {
        return ApiResponse.<PageResponse<CompanyResponse>>builder()
                .data(companyService.getAll(page, size, query, industry, companySize, location, category))
                .build();
    }

    @GetMapping("/{id}")
    public ApiResponse<CompanyResponse> getById(@PathVariable String id) {
        return ApiResponse.<CompanyResponse>builder()
                .data(companyService.getById(id))
                .build();
    }

    @PostMapping("/{id}/follow")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> follow(@PathVariable String id, @AuthenticationPrincipal String userId) {
        candidateService.followCompany(userId, id);
        return ApiResponse.<Void>builder().message("Company followed").build();
    }

    @DeleteMapping("/{id}/follow")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> unfollow(@PathVariable String id, @AuthenticationPrincipal String userId) {
        candidateService.unfollowCompany(userId, id);
        return ApiResponse.<Void>builder().message("Company unfollowed").build();
    }

    @GetMapping("/followed")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<List<CompanyResponse>> getFollowed(@AuthenticationPrincipal String userId) {
        return ApiResponse.<List<CompanyResponse>>builder()
                .data(companyService.getByIds(candidateService.getFollowedCompanyIds(userId)))
                .build();
    }

    @GetMapping("/{id}/jobs")
    public ApiResponse<List<JobSummary>> getCompanyJobs(@PathVariable String id) {
        return ApiResponse.<List<JobSummary>>builder()
                .data(companyService.getCompanyJobs(id))
                .build();
    }

    @GetMapping("/{id}/related")
    public ApiResponse<List<CompanyResponse>> getRelatedCompanies(@PathVariable String id) {
        return ApiResponse.<List<CompanyResponse>>builder()
                .data(companyService.getRelatedCompanies(id))
                .build();
    }

    @GetMapping("/by-recruiter/{recruiterId}")
    public ApiResponse<CompanyResponse> getByRecruiterId(@PathVariable String recruiterId) {
        return ApiResponse.<CompanyResponse>builder()
                .data(companyService.getByRecruiterId(recruiterId))
                .build();
    }
}
