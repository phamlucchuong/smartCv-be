package vn.chuongpl.application_service.features.assessment;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;
import vn.chuongpl.application_service.enums.AttemptStatus;

import java.util.List;
import java.util.Optional;

@Repository
public interface AssessmentAttemptRepository extends MongoRepository<AssessmentAttempt, String> {
    List<AssessmentAttempt> findByCandidateId(String candidateId);

    Optional<AssessmentAttempt> findByCandidateIdAndAssessmentIdAndStatus(
            String candidateId, String assessmentId, AttemptStatus status);

    List<AssessmentAttempt> findByAssessmentId(String assessmentId);
}
