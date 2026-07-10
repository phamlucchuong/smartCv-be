package vn.chuongpl.application_service.features.assessment;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AssessmentRepository extends MongoRepository<Assessment, String> {
    List<Assessment> findByRecruiterId(String recruiterId);
    List<Assessment> findByJobId(String jobId);
    List<Assessment> findByCandidateId(String candidateId);
}
