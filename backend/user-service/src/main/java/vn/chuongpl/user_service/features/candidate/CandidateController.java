package vn.chuongpl.user_service.features.candidate;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.PageResponse;
import vn.chuongpl.user_service.dtos.request.CandidateRequest;
import vn.chuongpl.user_service.dtos.response.CandidateResponse;
import vn.chuongpl.user_service.dtos.response.CvUploadResponse;
import vn.chuongpl.user_service.features.candidate.settings.CandidateSettings;
import vn.chuongpl.user_service.features.candidate.settings.NotificationPreferences;
import vn.chuongpl.user_service.features.candidate.settings.PreferencesSettings;
import vn.chuongpl.user_service.features.candidate.settings.PreferencesSettingsRequest;
import vn.chuongpl.user_service.features.candidate.settings.PrivacySettings;
import vn.chuongpl.user_service.integration.ai.SkillExtractPublisher;

import java.util.List;

@RestController
@RequestMapping("/api/candidates")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class CandidateController {
    CandidateService candidateService;
    S3Service s3Service;
    SkillExtractPublisher skillExtractPublisher;

    @PostMapping
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<CandidateResponse> create(@RequestBody CandidateRequest request) {
        return ApiResponse.<CandidateResponse>builder().data(candidateService.create(request)).build();
    }

    @GetMapping("/{id}")
    public ApiResponse<CandidateResponse> getById(@PathVariable String id) {
        return ApiResponse.<CandidateResponse>builder().data(candidateService.getById(id)).build();
    }

    @GetMapping("/user/{userId}")
    public ApiResponse<CandidateResponse> getByUserId(@PathVariable String userId) {
        return ApiResponse.<CandidateResponse>builder().data(candidateService.getByUserId(userId)).build();
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN') or hasRole('RECRUITER')")
    public ApiResponse<PageResponse<CandidateResponse>> getAll(@RequestParam(defaultValue = "1") int page,
                                                               @RequestParam(defaultValue = "10") int size) {
        return ApiResponse.<PageResponse<CandidateResponse>>builder().data(candidateService.getAll(page, size)).build();
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('CANDIDATE') or hasRole('ADMIN')")
    public ApiResponse<CandidateResponse> update(@PathVariable String id,
                                                 @RequestBody CandidateRequest request,
                                                 @AuthenticationPrincipal String userId,
                                                 Authentication authentication) {
        boolean isAdmin = authentication.getAuthorities().stream().anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        return ApiResponse.<CandidateResponse>builder().data(candidateService.update(id, request, userId, isAdmin)).build();
    }

    @GetMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<CandidateResponse> getMe(@AuthenticationPrincipal String userId) {
        return ApiResponse.<CandidateResponse>builder().data(candidateService.getMe(userId)).build();
    }

    @PostMapping("/me/avatar")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<String> uploadAvatar(@RequestParam("file") MultipartFile file,
                                             @AuthenticationPrincipal String userId) {
        String avatarUrl = candidateService.uploadAvatar(userId, file);
        return ApiResponse.<String>builder()
                .data(avatarUrl)
                .message("Avatar uploaded successfully")
                .build();
    }

    @PostMapping("/cv/upload")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<CvUploadResponse> uploadCv(@RequestParam("file") MultipartFile file,
                                                   @AuthenticationPrincipal String userId) {
        S3Service.CvUploadResult result = s3Service.uploadCv(file, userId);
        candidateService.saveCvUrl(userId, result.url());
        candidateService.addCvToList(userId, result.s3Key(), result.url(), file.getOriginalFilename());
        skillExtractPublisher.publish(userId, result.url());
        return ApiResponse.<CvUploadResponse>builder()
                .message("CV uploaded successfully")
                .data(new CvUploadResponse(result.url()))
                .build();
    }

    @GetMapping("/cvs/{cvId}/url")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<java.util.Map<String, String>> refreshCvUrl(
            @PathVariable String cvId,
            @AuthenticationPrincipal String userId) {
        String freshUrl = candidateService.refreshCvUrl(userId, cvId);
        return ApiResponse.<java.util.Map<String, String>>builder()
                .data(java.util.Map.of("url", freshUrl))
                .message("URL refreshed")
                .build();
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable String id) {
        candidateService.delete(id);
        return ApiResponse.<Void>builder().build();
    }

    // ── CV Management ──────────────────────────────────────────────────────────

    @GetMapping("/cvs")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<List<CvItem>> listCvs(@AuthenticationPrincipal String userId) {
        return ApiResponse.<List<CvItem>>builder()
                .data(candidateService.listCvs(userId))
                .build();
    }

    @PatchMapping("/cvs/{cvId}/default")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> setDefaultCv(@PathVariable String cvId, @AuthenticationPrincipal String userId) {
        candidateService.setDefaultCv(userId, cvId);
        return ApiResponse.<Void>builder().message("Default CV updated").build();
    }

    @DeleteMapping("/cvs/{cvId}")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> deleteCv(@PathVariable String cvId, @AuthenticationPrincipal String userId) {
        candidateService.deleteCv(userId, cvId);
        return ApiResponse.<Void>builder().message("CV deleted").build();
    }

    @PostMapping("/cvs/{cvId}/reanalyze")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> reanalyzeCv(@PathVariable String cvId, @AuthenticationPrincipal String userId) {
        CvItem cv = candidateService.getCvAnalysis(userId, cvId);
        candidateService.markCvReanalyzing(userId, cvId);
        String urlForAnalysis = cv.getS3Key() != null
                ? s3Service.generateFreshUrl(cv.getS3Key()) : cv.getUrl();
        skillExtractPublisher.publish(userId, urlForAnalysis);
        return ApiResponse.<Void>builder().message("CV re-analysis triggered").build();
    }

    @GetMapping("/cvs/{cvId}/analysis")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<CvItem> getCvAnalysis(@PathVariable String cvId, @AuthenticationPrincipal String userId) {
        return ApiResponse.<CvItem>builder()
                .data(candidateService.getCvAnalysis(userId, cvId))
                .build();
    }

    // ── Settings ───────────────────────────────────────────────────────────────

    @GetMapping("/settings")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<CandidateSettings> getSettings(@AuthenticationPrincipal String userId) {
        return ApiResponse.<CandidateSettings>builder()
                .data(candidateService.getSettings(userId))
                .build();
    }

    @PutMapping("/settings/notifications")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> updateNotifications(@RequestBody NotificationPreferences prefs,
                                                  @AuthenticationPrincipal String userId) {
        candidateService.updateNotificationPreferences(userId, prefs);
        return ApiResponse.<Void>builder().message("Notification preferences updated").build();
    }

    @PutMapping("/settings/privacy")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> updatePrivacy(@RequestBody PrivacySettings privacy,
                                            @AuthenticationPrincipal String userId) {
        candidateService.updatePrivacySettings(userId, privacy);
        return ApiResponse.<Void>builder().message("Privacy settings updated").build();
    }

    @PutMapping("/settings/preferences")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<PreferencesSettings> updatePreferences(@RequestBody PreferencesSettingsRequest preferences,
                                                              @AuthenticationPrincipal String userId) {
        return ApiResponse.<PreferencesSettings>builder()
                .data(candidateService.updatePreferences(userId, preferences))
                .message("Preferences updated")
                .build();
    }

    @DeleteMapping("/me")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<Void> deleteMyAccount(@AuthenticationPrincipal String userId) {
        candidateService.deleteAccount(userId);
        return ApiResponse.<Void>builder().message("Account deactivated").build();
    }

    // ── Job Suggestions ────────────────────────────────────────────────────────

    @GetMapping("/job-suggestions")
    @PreAuthorize("hasRole('CANDIDATE')")
    public ApiResponse<List<EnrichedJobSuggestion>> getJobSuggestions(@AuthenticationPrincipal String userId) {
        return ApiResponse.<List<EnrichedJobSuggestion>>builder()
                .data(candidateService.getEnrichedJobSuggestions(userId))
                .build();
    }
}
