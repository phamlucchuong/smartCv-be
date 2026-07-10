package vn.chuongpl.user_service.features.candidate;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface CandidateRepository extends MongoRepository<Candidate, String> {
    Optional<Candidate> findByUserIdAndDeletedFalse(String userId);

    Optional<Candidate> findByIdAndDeletedFalse(String id);

    Page<Candidate> findAllByDeletedFalse(Pageable pageable);

    @Query("{ 'cvs.id': ?0, 'deleted': false }")
    Optional<Candidate> findByCvId(String cvId);
}
