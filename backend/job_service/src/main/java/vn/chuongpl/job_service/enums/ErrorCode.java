package vn.chuongpl.job_service.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized error"),
    UNAUTHENTICATED(1005, "Unauthenticated"),
    UNAUTHORIZED(1006, "You do not have permission"),
    JOB_NOT_FOUND(2001, "Job not found"),
    JOB_NOT_OWNER(2002, "You are not the owner of this job"),
    JOB_STATUS_INVALID(2003, "Invalid status transition"),
    JOB_ALREADY_DELETED(2004, "Job has been deleted"),
    JOB_TITLE_ALREADY_EXISTS(2005, "Job title already exists"),
    RECRUITER_NOT_APPROVED(2006, "Your recruiter account must be approved before posting jobs");

    private final int code;
    private final String message;
}
