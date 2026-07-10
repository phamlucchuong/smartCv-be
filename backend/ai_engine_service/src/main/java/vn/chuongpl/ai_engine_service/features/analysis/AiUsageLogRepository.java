package vn.chuongpl.ai_engine_service.features.analysis;

import org.springframework.data.mongodb.repository.MongoRepository;
import java.time.LocalDateTime;
import java.util.List;

public interface AiUsageLogRepository extends MongoRepository<AiUsageLog, String> {
    List<AiUsageLog> findByCreatedAtBetween(LocalDateTime start, LocalDateTime end);
}
