package vn.chuongpl.user_service.features.recruiter;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.mapping.MongoId;
import vn.chuongpl.user_service.enums.JobCategory;
import vn.chuongpl.user_service.enums.RecruiterStatus;

import java.time.LocalDateTime;

@Document(collection = "recruiters")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Recruiter {
    @MongoId(FieldType.STRING)
    String id;

    @Field(name = "user_id")
    String userId;

    // ── Company info ──────────────────────────────────────────────────────────
    @Field(name = "company_name")
    String companyName;

    @Field(name = "company_website")
    String companyWebsite;

    @Field(name = "company_address")
    String companyAddress;

    @Field(name = "company_city")
    String companyCity;

    @Field(name = "company_description")
    String companyDescription;

    @Field(name = "company_phone")
    String companyPhone;

    @Field(name = "company_size")
    String companySize;

    @Field(name = "company_type")
    String companyType;

    @Field(name = "founded_year")
    Integer foundedYear;

    String industry;

    @Field("category")
    JobCategory category;

    // ── Enrichment ────────────────────────────────────────────────────────────
    @Builder.Default
    @Field(name = "benefits")
    java.util.List<String> benefits = new java.util.ArrayList<>();

    @Field(name = "rating")
    Double rating;

    @Field(name = "review_count")
    Integer reviewCount;

    // ── Media ─────────────────────────────────────────────────────────────────
    @Field(name = "logo_url")
    String logoUrl;

    @Field(name = "cover_image_url")
    String coverImageUrl;

    // ── Legal ─────────────────────────────────────────────────────────────────
    @Field(name = "tax_code")
    String taxCode;

    @Field(name = "business_license_url")
    String businessLicenseUrl;

    // ── Social links ──────────────────────────────────────────────────────────
    @Field(name = "linkedin_url")
    String linkedinUrl;

    @Field(name = "facebook_url")
    String facebookUrl;

    // ── HR contact ────────────────────────────────────────────────────────────
    @Field(name = "contact_name")
    String contactName;

    @Field(name = "contact_email")
    String contactEmail;

    @Field(name = "contact_phone")
    String contactPhone;

    // ── Status & approval ─────────────────────────────────────────────────────
    @Builder.Default
    RecruiterStatus status = RecruiterStatus.DRAFT;

    @Field(name = "rejection_note")
    String rejectionNote;

    @Field(name = "quota_job_post")
    @Builder.Default
    int quotaJobPost = 0;

    @Field(name = "quota_cv_views")
    @Builder.Default
    int quotaCvViews = 0;

    // ── Active package ────────────────────────────────────────────────────────
    @Field(name = "active_package_id")
    String activePackageId;

    @Field(name = "package_activated_at")
    LocalDateTime packageActivatedAt;

    @Field(name = "package_expires_at")
    LocalDateTime packageExpiresAt;

    @Field(name = "last_payment_order_id")
    String lastPaymentOrderId;

    @Field(name = "platform_fee_due_at")
    LocalDateTime platformFeeDueAt;

    @Field(name = "platform_fee_last_paid_at")
    LocalDateTime platformFeeLastPaidAt;

    @Field(name = "platform_fee_reminder_sent_at")
    LocalDateTime platformFeeReminderSentAt;

    @Field(name = "platform_fee_overdue_sent_at")
    LocalDateTime platformFeeOverdueSentAt;

    @Field(name = "platform_fee_locked_at")
    LocalDateTime platformFeeLockedAt;

    @Field(name = "package_expiry_warning_sent_at")
    LocalDateTime packageExpiryWarningSentAt;

    @Field(name = "package_downgraded_at")
    LocalDateTime packageDowngradedAt;

    @Field(name = "post_expiry_cleanup_at")
    LocalDateTime postExpiryCleanupAt;

    @Field(name = "monthly_ai_credits_used")
    @Builder.Default
    int monthlyAiCreditsUsed = 0;

    @Field(name = "monthly_ai_credits_month")
    String monthlyAiCreditsMonth;

    // ── Audit ─────────────────────────────────────────────────────────────────
    @Field(name = "created_at")
    LocalDateTime createdAt;

    @Field(name = "updated_at")
    LocalDateTime updatedAt;

    @Builder.Default
    boolean deleted = false;

    @Field(name = "deleted_at")
    LocalDateTime deletedAt;
}
