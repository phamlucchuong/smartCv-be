package vn.chuongpl.user_service.features.candidate;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.mapping.MongoId;
import vn.chuongpl.user_service.enums.JobType;
import vn.chuongpl.user_service.features.candidate.settings.CandidateSettings;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Document(collection = "candidates")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Candidate {
    @MongoId(FieldType.STRING)
    String id;

    @Field(name = "user_id")
    String userId;

    // ── Basic info ────────────────────────────────────────────────────────────
    LocalDate dob;
    String gender;
    String address;
    String bio;

    /** Professional headline, e.g. "Senior Java Developer" */
    String title;

    @Field(name = "avatar_url")
    String avatarUrl;

    // ── Skills & experience ──────────────────────────────────────────────────
    List<String> skills;

    @Field(name = "years_of_experience")
    Integer yearsOfExperience;

    List<WorkExperience> experiences;
    List<Education> educations;
    List<Certification> certifications;
    List<Language> languages;

    // ── Preferences ──────────────────────────────────────────────────────────
    @Field(name = "job_type")
    JobType jobType;

    @Field(name = "preferred_location")
    String preferredLocation;

    @Field(name = "expected_salary_min")
    Integer expectedSalaryMin;

    @Field(name = "expected_salary_max")
    Integer expectedSalaryMax;

    // ── Online presence ───────────────────────────────────────────────────────
    @Field(name = "portfolio_url")
    String portfolioUrl;

    @Field(name = "github_url")
    String githubUrl;

    @Field(name = "linkedin_url")
    String linkedinUrl;

    // ── CV ────────────────────────────────────────────────────────────────────
    @Field(name = "cv_url")
    String cvUrl;

    @Builder.Default
    @Field(name = "cvs")
    List<CvItem> cvs = new ArrayList<>();

    // ── Settings ──────────────────────────────────────────────────────────────
    @Builder.Default
    @Field(name = "settings")
    CandidateSettings settings = new CandidateSettings();

    // ── Job suggestions cache ─────────────────────────────────────────────────
    @Builder.Default
    @Field(name = "job_suggestions")
    List<JobSuggestion> jobSuggestions = new ArrayList<>();

    @Field(name = "suggestions_updated_at")
    LocalDateTime suggestionsUpdatedAt;

    // ── Company follows ───────────────────────────────────────────────────────
    @Builder.Default
    @Field(name = "followed_company_ids")
    List<String> followedCompanyIds = new ArrayList<>();

    // ── Active package ────────────────────────────────────────────────────────
    @Field(name = "active_package_id")
    String activePackageId;

    @Field(name = "package_activated_at")
    LocalDateTime packageActivatedAt;

    @Field(name = "package_expires_at")
    LocalDateTime packageExpiresAt;

    @Field(name = "last_payment_order_id")
    String lastPaymentOrderId;

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
