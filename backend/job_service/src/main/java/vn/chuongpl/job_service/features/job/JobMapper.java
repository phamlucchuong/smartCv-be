package vn.chuongpl.job_service.features.job;

import org.mapstruct.*;
import vn.chuongpl.job_service.dtos.request.JobCreateRequest;
import vn.chuongpl.job_service.dtos.request.JobUpdateRequest;
import vn.chuongpl.job_service.dtos.response.JobResponse;

@Mapper(componentModel = "spring")
public interface JobMapper {
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "recruiterId", ignore = true)
    @Mapping(target = "normalizedTitle", ignore = true)
    @Mapping(target = "moderationStatus", ignore = true)
    @Mapping(target = "visibilityStatus", ignore = true)
    @Mapping(target = "moderationNote", ignore = true)
    @Mapping(target = "reviewedBy", ignore = true)
    @Mapping(target = "reviewedAt", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    @Mapping(target = "deleted", ignore = true)
    @Mapping(target = "deletedAt", ignore = true)
    Job toJob(JobCreateRequest request);

    JobResponse toJobResponse(Job job);

    @Mapping(target = "jobType", expression = "java(document.getJobType() == null ? null : vn.chuongpl.job_service.enums.JobType.valueOf(document.getJobType()))")
    @Mapping(target = "experienceLevel", expression = "java(document.getExperienceLevel() == null ? null : vn.chuongpl.job_service.enums.ExperienceLevel.valueOf(document.getExperienceLevel()))")
    @Mapping(target = "moderationStatus", expression = "java(document.getModerationStatus() == null ? null : vn.chuongpl.job_service.enums.JobModerationStatus.valueOf(document.getModerationStatus()))")
    @Mapping(target = "visibilityStatus", expression = "java(document.getVisibilityStatus() == null ? null : vn.chuongpl.job_service.enums.JobVisibilityStatus.valueOf(document.getVisibilityStatus()))")
    @Mapping(target = "category", expression = "java(document.getCategory() == null ? null : vn.chuongpl.job_service.enums.JobCategory.valueOf(document.getCategory()))")
    @Mapping(target = "updatedAt", source = "createdAt")
    @Mapping(target = "requirements", ignore = true)
    @Mapping(target = "benefits", ignore = true)
    JobResponse toJobResponse(JobDocument document);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    void updateJob(@MappingTarget Job job, JobUpdateRequest request);

    @Mapping(target = "jobType", expression = "java(job.getJobType() == null ? null : job.getJobType().name())")
    @Mapping(target = "experienceLevel", expression = "java(job.getExperienceLevel() == null ? null : job.getExperienceLevel().name())")
    @Mapping(target = "moderationStatus", expression = "java(job.getModerationStatus() == null ? null : job.getModerationStatus().name())")
    @Mapping(target = "visibilityStatus", expression = "java(job.getVisibilityStatus() == null ? null : job.getVisibilityStatus().name())")
    @Mapping(target = "category", expression = "java(job.getCategory() == null ? null : job.getCategory().name())")
    JobDocument toDocument(Job job);
}
