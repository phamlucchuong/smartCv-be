package vn.chuongpl.user_service.features.candidate;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.request.SkillMergeRequest;
import vn.chuongpl.user_service.features.candidate.dto.CvAnalysisUpdateRequest;
import vn.chuongpl.user_service.features.candidate.dto.CvInfoResponse;
import vn.chuongpl.user_service.dtos.response.CandidateResponse;

@RestController
@RequestMapping("/api/internal/candidates")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class InternalCandidateController {

    CandidateService candidateService;

    @GetMapping("/by-user/{userId}")
    public ApiResponse<CandidateResponse> getProfile(@PathVariable String userId) {
        return ApiResponse.<CandidateResponse>builder()
                .data(candidateService.getByUserId(userId))
                .build();
    }

    @PatchMapping("/by-user/{userId}/skills")
    public ApiResponse<Void> mergeSkills(@PathVariable String userId,
                                         @RequestBody SkillMergeRequest request) {
        candidateService.mergeSkills(userId, request.getSkills());
        return ApiResponse.<Void>builder().message("Skills merged").build();
    }

    @GetMapping("/cvs/{cvId}")
    public ApiResponse<CvInfoResponse> getCvInfo(@PathVariable String cvId) {
        return ApiResponse.<CvInfoResponse>builder()
                .data(candidateService.getCvInfo(cvId))
                .message("CV info retrieved")
                .build();
    }

    @PatchMapping("/cvs/{cvId}/analysis")
    public ApiResponse<Void> updateCvAnalysis(@PathVariable String cvId,
                                               @RequestBody CvAnalysisUpdateRequest request) {
        candidateService.updateCvAnalysis(cvId, request.analysisResult(), request.analysisStatus());
        return ApiResponse.<Void>builder().message("CV analysis updated").build();
    }

    @PostMapping("/by-user/{userId}/consume-ai-credit")
    public ApiResponse<Void> consumeAiCredit(@PathVariable String userId) {
        candidateService.consumeMonthlyAiCredit(userId);
        return ApiResponse.<Void>builder().message("AI credit consumed").build();
    }
}
