package vn.chuongpl.job_service.features.job;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import vn.chuongpl.job_service.enums.JobModerationStatus;
import vn.chuongpl.job_service.enums.JobVisibilityStatus;

import java.util.List;
import java.util.Optional;

@Repository
public interface JobRepository extends MongoRepository<Job, String> {
    Optional<Job> findByIdAndDeletedFalse(String id);

    Page<Job> findByDeletedFalse(Pageable pageable);

    Page<Job> findByRecruiterIdAndDeletedFalse(String recruiterId, Pageable pageable);

    Page<Job> findByRecruiterIdInAndDeletedFalse(List<String> recruiterIds, Pageable pageable);

    Page<Job> findByModerationStatusAndVisibilityStatusAndDeletedFalse(
            JobModerationStatus moderationStatus,
            JobVisibilityStatus visibilityStatus,
            Pageable pageable
    );

    boolean existsByIdAndRecruiterId(String id, String recruiterId);

    boolean existsByRecruiterIdAndNormalizedTitleAndDeletedFalse(String recruiterId, String normalizedTitle);

    boolean existsByRecruiterIdAndNormalizedTitleAndDeletedFalseAndIdNot(String recruiterId, String normalizedTitle, String id);

    java.util.List<Job> findTop5ByModerationStatusAndVisibilityStatusAndSkillsInAndIdNotAndDeletedFalse(
            JobModerationStatus moderationStatus,
            JobVisibilityStatus visibilityStatus,
            java.util.List<String> skills,
            String id);

    java.util.List<Job> findTop5ByCategoryAndModerationStatusAndVisibilityStatusAndIdNotAndDeletedFalse(
            vn.chuongpl.job_service.enums.JobCategory category,
            JobModerationStatus moderationStatus,
            JobVisibilityStatus visibilityStatus,
            String id);

    java.util.List<Job> findAllByIdInAndDeletedFalse(java.util.List<String> ids);

    java.util.List<Job> findTop20ByRecruiterIdAndModerationStatusAndVisibilityStatusAndDeletedFalse(
            String recruiterId,
            JobModerationStatus moderationStatus,
            JobVisibilityStatus visibilityStatus
    );

    java.util.List<Job> findByModerationStatusAndVisibilityStatusAndDeadlineBeforeAndDeletedFalse(
            JobModerationStatus moderationStatus,
            JobVisibilityStatus visibilityStatus,
            java.time.LocalDate date
    );

    Page<Job> findByModerationStatusAndDeletedFalse(JobModerationStatus moderationStatus, Pageable pageable);

    java.util.List<Job> findAllByRecruiterIdAndModerationStatusAndVisibilityStatusAndDeletedFalse(
            String recruiterId,
            JobModerationStatus moderationStatus,
            JobVisibilityStatus visibilityStatus
    );
}
