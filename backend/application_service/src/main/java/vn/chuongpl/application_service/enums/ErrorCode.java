package vn.chuongpl.application_service.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized error"),
    UNAUTHENTICATED(1005, "Unauthenticated"),
    UNAUTHORIZED(1006, "You do not have permission to perform this action"),
    APPLICATION_NOT_FOUND(7001, "Application not found"),
    APPLICATION_ALREADY_EXISTS(7002, "You have already applied for this job"),
    APPLICATION_STATUS_TERMINAL(7003, "Application is already in a terminal state"),
    APPLICATION_INVALID_TRANSITION(7004, "Invalid status transition"),
    APPLICATION_REJECTION_REASON_REQUIRED(7008, "Rejection reason is required when rejecting an application"),
    JOB_NOT_FOUND(7005, "Job not found"),
    JOB_NOT_ACCEPTING_APPLICATIONS(7006, "This job is not accepting applications"),
    JOB_SERVICE_UNAVAILABLE(7007, "Job service is currently unavailable"),
    ASSESSMENT_NOT_FOUND(8001, "Assessment not found"),
    ATTEMPT_NOT_FOUND(8002, "Attempt not found"),
    ATTEMPT_ALREADY_IN_PROGRESS(8003, "An attempt is already in progress for this assessment"),
    ATTEMPT_ALREADY_SUBMITTED(8004, "This attempt has already been submitted"),
    ATTEMPT_NOT_SUBMITTED(8005, "Attempt has not been submitted yet"),
    AI_SERVICE_UNAVAILABLE(8006, "AI service is currently unavailable"),
    AI_CREDIT_EXHAUSTED(8012, "Insufficient AI credit quota");

    private final int code;
    private final String message;
}
