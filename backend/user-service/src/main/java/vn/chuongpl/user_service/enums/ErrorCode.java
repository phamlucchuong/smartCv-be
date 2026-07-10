package vn.chuongpl.user_service.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

@Getter
@AllArgsConstructor
public enum ErrorCode {
    UNCATEGORIZED_EXCEPTION(9999, "Uncategorized error"),
    AUTHENTICATION_FAILED(1001, "Incorrect password"),
    USER_NOT_FOUND(1004, "User not found"),
    UNAUTHENTICATED(1005, "Unauthenticated"),
    UNAUTHORIZED(1006, "You do not have permission to perform this action"),
    PERMISSION_EXISTED(1007, "Permission already exists"),
    PERMISSION_NOT_FOUND(1012, "Permission not found"),
    ROLE_ALREADY_EXISTS(1008, "Role already exists"),
    ROLE_NOT_FOUND(1009, "Role not found"),
    INVALID_ROLE(1010, "Invalid role, must be CANDIDATE or RECRUITER"),
    ROLE_MISMATCH(1016, "Account does not have the required role"),
    GOOGLE_AUTH_INVALID(1017, "Invalid Google identity token"),
    GOOGLE_AUTH_NOT_CONFIGURED(1018, "Google sign-in is not configured"),
    GOOGLE_ACCOUNT_CONFLICT(1019, "Google account does not match the linked account"),
    SERVICE_PACKAGE_ALREADY_EXISTS(1013, "Service package already exists"),
    SERVICE_PACKAGE_NOT_FOUND(1014, "Service package not found"),
    INVALID_SERVICE_PACKAGE_CONFIG(1015, "Invalid service package configuration"),
    EMAIL_EXISTED(3001, "Email already exists"),
    PHONE_EXISTED(3006, "Phone number already exists"),
    INVALID_OTP(3002, "Invalid or expired OTP"),
    USER_NOT_VERIFIED(3003, "User not verified, please verify with OTP"),
    USER_ALREADY_VERIFIED(3004, "User is already verified"),
    WRONG_PASSWORD(3005, "Current password is incorrect"),
    CANDIDATE_EXISTED(4001, "Candidate profile already exists"),
    CANDIDATE_NOT_FOUND(4002, "Candidate profile not found"),
    CV_NOT_FOUND(4003, "CV not found"),
    RECRUITER_EXISTED(5001, "Recruiter profile already exists"),
    RECRUITER_NOT_FOUND(5002, "Recruiter profile not found"),
    COMPANY_NOT_FOUND(5003, "Company not found"),
    RECRUITER_PROFILE_INCOMPLETE(5004, "Please complete all required profile fields before submitting"),
    RECRUITER_PROFILE_LOCKED(5005, "Profile cannot be edited while under review"),
    RECRUITER_INVALID_STATUS_TRANSITION(5006, "Cannot submit profile from current status"),
    FILE_REQUIRED(6001, "File is required"),
    FILE_TOO_LARGE(6002, "File must not exceed 5MB"),
    INVALID_FILE_TYPE(6003, "Only PDF files are accepted"),
    FILE_UPLOAD_FAILED(6004, "Failed to upload file, please try again"),
    INSUFFICIENT_QUOTA(6005, "Insufficient job post quota"),
    INSUFFICIENT_AI_QUOTA(6008, "Insufficient AI credit quota"),
    INVALID_IMAGE_TYPE(6006, "Only JPEG, PNG, and WebP images are accepted"),
    IMAGE_TOO_LARGE(6007, "Avatar image must not exceed 2MB"),
    USER_LOCKED(1011, "User account is locked"),
    INVALID_CATEGORY(1022, "Invalid job category");

    private int code;
    private String message;
}
