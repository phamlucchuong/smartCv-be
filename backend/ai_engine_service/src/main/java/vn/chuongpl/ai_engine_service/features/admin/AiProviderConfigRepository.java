package vn.chuongpl.ai_engine_service.features.admin;

import org.springframework.data.mongodb.repository.MongoRepository;
import vn.chuongpl.ai_engine_service.model.AiProvider;

import java.util.List;
import java.util.Optional;

public interface AiProviderConfigRepository extends MongoRepository<AiProviderConfig, String> {
    List<AiProviderConfig> findByProviderOrderByUpdatedAtDesc(AiProvider provider);
    Optional<AiProviderConfig> findTopByProviderOrderByUpdatedAtDesc(AiProvider provider);
    Optional<AiProviderConfig> findTopByNameIgnoreCaseOrderByUpdatedAtDesc(String name);
    Optional<AiProviderConfig> findTopByModelIgnoreCaseOrderByUpdatedAtDesc(String model);
    boolean existsByProviderAndModel(AiProvider provider, String model);
    List<AiProviderConfig> findAllByActiveTrue();
}
