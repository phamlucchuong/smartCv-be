package vn.chuongpl.job_service.features.job;

import lombok.*;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;
import org.springframework.data.mongodb.core.mapping.MongoId;
import vn.chuongpl.job_service.enums.ExperienceLevel;
import vn.chuongpl.job_service.enums.JobCategory;
import vn.chuongpl.job_service.enums.JobModerationStatus;
import vn.chuongpl.job_service.enums.JobType;
import vn.chuongpl.job_service.enums.JobVisibilityStatus;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
@Document(collection = "jobs")
public class Job {
    @MongoId(FieldType.STRING)
    String id;
    @Field("recruiter_id")
    String recruiterId;
    String title;
    @Field("normalized_title")
    String normalizedTitle;
    String description;
    String company;
    String location;
    @Field("salary_min")
    Double salaryMin;
    @Field("salary_max")
    Double salaryMax;
    JobType jobType;
    ExperienceLevel experienceLevel;
    List<String> skills;
    List<String> requirements;
    List<String> benefits;
    @Builder.Default
    @Field("moderation_status")
    JobModerationStatus moderationStatus = JobModerationStatus.DRAFT;
    @Builder.Default
    @Field("visibility_status")
    JobVisibilityStatus visibilityStatus = JobVisibilityStatus.INACTIVE;
    String moderationNote;
    String reviewedBy;
    LocalDateTime reviewedAt;
    LocalDate deadline;
    Integer openings;
    Integer qualifiedThreshold;
    Integer rejectThreshold;
    Boolean autoRejectEnabled;
    String requiredTest;
    @Field("category")
    JobCategory category;
    @Builder.Default
    boolean deleted = false;
    LocalDateTime deletedAt;
    @CreatedDate
    LocalDateTime createdAt;
    @LastModifiedDate
    LocalDateTime updatedAt;
}
