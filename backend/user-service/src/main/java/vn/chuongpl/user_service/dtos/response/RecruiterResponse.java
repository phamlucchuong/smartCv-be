package vn.chuongpl.user_service.dtos.response;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.user_service.enums.JobCategory;
import vn.chuongpl.user_service.enums.RecruiterStatus;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RecruiterResponse {
    String id;
    String userId;

    // ── From User ─────────────────────────────────────────────────────────────
    String fullName;
    String email;
    String phone;

    // ── Company info ──────────────────────────────────────────────────────────
    String companyName;
    String companyWebsite;
    String companyAddress;
    String companyCity;
    String companyDescription;
    String companyPhone;
    String companySize;
    String companyType;
    Integer foundedYear;
    String industry;
    JobCategory category;

    // ── Media ─────────────────────────────────────────────────────────────────
    String logoUrl;
    String coverImageUrl;

    // ── Legal ─────────────────────────────────────────────────────────────────
    String taxCode;
    String businessLicenseUrl;

    // ── Social links ──────────────────────────────────────────────────────────
    String linkedinUrl;
    String facebookUrl;

    // ── HR contact ────────────────────────────────────────────────────────────
    String contactName;
    String contactEmail;
    String contactPhone;

    // ── Status & approval ─────────────────────────────────────────────────────
    RecruiterStatus status;
    String rejectionNote;
    int quotaJobPost;
    int quotaCvViews;

    // ── Package Activation ───────────────────────────────────────────────────
    String activePackageId;
    LocalDateTime packageActivatedAt;
    LocalDateTime packageExpiresAt;
    Integer aiCreditsTotal;
    Integer aiCreditsUsed;
    Integer aiCreditsRemaining;
    LocalDateTime platformFeeDueAt;
    LocalDateTime platformFeeLastPaidAt;
    LocalDateTime platformFeeReminderSentAt;
    LocalDateTime platformFeeOverdueSentAt;
    LocalDateTime platformFeeLockedAt;

    // ── Audit ─────────────────────────────────────────────────────────────────
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
