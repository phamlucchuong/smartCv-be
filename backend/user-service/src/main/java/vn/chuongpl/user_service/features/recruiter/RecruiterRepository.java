package vn.chuongpl.user_service.features.recruiter;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import vn.chuongpl.user_service.enums.JobCategory;
import vn.chuongpl.user_service.enums.RecruiterStatus;

import java.util.List;
import java.util.Optional;

@Repository
public interface RecruiterRepository extends MongoRepository<Recruiter, String> {
    Optional<Recruiter> findByUserIdAndDeletedFalse(String userId);

    Optional<Recruiter> findByIdAndDeletedFalse(String id);

    Page<Recruiter> findAllByDeletedFalse(Pageable pageable);

    Page<Recruiter> findAllByStatusAndDeletedFalse(RecruiterStatus status, Pageable pageable);

    List<Recruiter> findTop5ByIndustryAndIdNotAndStatusAndDeletedFalse(
            String industry, String id, RecruiterStatus status);

    List<Recruiter> findTop5ByCategoryAndIdNotAndStatusAndDeletedFalse(
            JobCategory category, String id, RecruiterStatus status);

    List<Recruiter> findByCategoryAndStatusAndDeletedFalse(
            JobCategory category, RecruiterStatus status, Pageable pageable);
}
