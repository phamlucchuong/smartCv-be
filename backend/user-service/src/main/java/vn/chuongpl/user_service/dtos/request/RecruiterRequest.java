package vn.chuongpl.user_service.dtos.request;

import lombok.*;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.user_service.enums.JobCategory;
import vn.chuongpl.user_service.enums.RecruiterStatus;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class RecruiterRequest {
    String userId;

    // ── Company info ──────────────────────────────────────────────────────────
    String companyName;
    String companyWebsite;
    String companyAddress;
    String companyCity;
    String companyDescription;
    String companyPhone;

    /** e.g. "1-10", "11-50", "51-200", "201-500", "500+" */
    String companySize;

    /** e.g. STARTUP, CORPORATION, AGENCY, OUTSOURCING, PRODUCT */
    String companyType;

    Integer foundedYear;
    String industry;
    JobCategory category;
    java.util.List<String> benefits;
    Double rating;
    Integer reviewCount;

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

    // ── Admin-only fields (ignored in updateRecruiter mapper) ─────────────────
    RecruiterStatus status;
    Integer quotaJobPost;
    Integer quotaCvViews;
}
