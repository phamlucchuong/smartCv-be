package vn.chuongpl.ai_engine_service.dtos.request;

import jakarta.validation.constraints.NotBlank;

public record CvFullAnalysisRequest(
        @NotBlank String cvId,
        String jobId
) {}
