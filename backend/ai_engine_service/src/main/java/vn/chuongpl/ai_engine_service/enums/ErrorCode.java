package vn.chuongpl.ai_engine_service.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized error"),
    UNAUTHENTICATED(1005, "Unauthenticated"),
    UNAUTHORIZED(1006, "You do not have permission"),
    CV_TEXT_REQUIRED(8001, "CV text or URL is required"),
    JOB_ID_REQUIRED(8002, "Job ID is required"),
    JOB_NOT_FOUND(8003, "Job not found"),
    AI_PROCESSING_FAILED(8004, "AI processing failed"),
    INVALID_TOP_K(8005, "topK must be between 1 and 50"),
    JOB_SERVICE_UNAVAILABLE(8006, "Job service is currently unavailable"),
    PROVIDER_NOT_CONFIGURED(8007, "No AI provider is configured or active"),
    PROVIDER_NOT_FOUND(8008, "AI provider config not found"),
    PROVIDER_ACTIVE(8009, "Cannot delete the currently active provider"),
    CV_NOT_FOUND(8010, "CV not found"),
    USER_SERVICE_UNAVAILABLE(8011, "User service is currently unavailable"),
    AI_CREDIT_EXHAUSTED(8012, "Insufficient AI credit quota"),
    AI_MODEL_NAME_REQUIRED(8013, "AI model name is required"),
    AI_MODEL_ID_REQUIRED(8014, "AI model id is required"),
    PROVIDER_MODEL_NOT_FOUND(8015, "AI model config not found"),
    PROVIDER_MODEL_ALREADY_EXISTS(8016, "AI model config already exists"),
    AI_PROVIDER_QUOTA_EXCEEDED(8017, "AI provider quota or rate limit exceeded");

    private final int code;
    private final String message;
}
