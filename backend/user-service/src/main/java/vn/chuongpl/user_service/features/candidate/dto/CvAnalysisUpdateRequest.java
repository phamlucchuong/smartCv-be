package vn.chuongpl.user_service.features.candidate.dto;

import vn.chuongpl.user_service.features.candidate.CvAnalysisStatus;

public record CvAnalysisUpdateRequest(
        String analysisResult,
        CvAnalysisStatus analysisStatus
) {}
