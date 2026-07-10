package vn.chuongpl.application_service.features.application;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.MongoId;
import org.springframework.data.mongodb.core.mapping.FieldType;
import vn.chuongpl.application_service.enums.AiScoringStatus;
import vn.chuongpl.application_service.enums.ApplicationStatus;

import java.time.LocalDateTime;
import java.util.List;

@Document(collection = "applications")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class Application {
    @MongoId(FieldType.STRING)
    String id;

    @Field("candidate_id")
    String candidateId;

    @Field("job_id")
    String jobId;

    @Field("recruiter_id")
    String recruiterId;

    @Field("candidate_email")
    String candidateEmail;

    @Field("job_title")
    String jobTitle;

    @Field("company_name")
    String companyName;

    @Field("job_location")
    String jobLocation;

    @Field("salary_min")
    Double salaryMin;

    @Field("salary_max")
    Double salaryMax;

    @Field("job_skills")
    java.util.List<String> jobSkills;

    @Field("job_type")
    String jobType;

    @Builder.Default
    ApplicationStatus status = ApplicationStatus.PENDING;

    @Field("cover_letter")
    String coverLetter;

    @Field("cv_url")
    String cvUrl;

    @Field("ai_score")
    Integer aiScore;

    @Field("matched_skills")
    List<String> matchedSkills;

    @Field("missing_skills")
    List<String> missingSkills;

    @Builder.Default
    @Field("ai_status")
    AiScoringStatus aiStatus = AiScoringStatus.PENDING;

    @Field("recruiter_notes")
    String recruiterNotes;

    @Field("rejection_reason")
    String rejectionReason;

    @Field("applied_at")
    LocalDateTime appliedAt;

    @Field("updated_at")
    LocalDateTime updatedAt;

    @Builder.Default
    boolean deleted = false;

    @Field("deleted_at")
    LocalDateTime deletedAt;
}
