package vn.chuongpl.application_service.dtos.request;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AssessmentGenerateRequest(
        @NotBlank @Size(max = 200) String jobName,
        String level,
        String difficulty,
        @Min(1) @Max(20) int numQuestions
) {}
