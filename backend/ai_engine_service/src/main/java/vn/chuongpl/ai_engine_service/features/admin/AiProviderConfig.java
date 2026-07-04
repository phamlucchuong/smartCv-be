package vn.chuongpl.ai_engine_service.features.admin;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.CompoundIndexes;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import vn.chuongpl.ai_engine_service.model.AiProvider;

import java.time.LocalDateTime;

@Document("ai_provider_configs")
@CompoundIndexes({
        @CompoundIndex(def = "{'provider': 1, 'model': 1}", unique = true)
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiProviderConfig {

    @Id
    String id;

    @Indexed
    AiProvider provider;

    String name;
    String apiKey;
    String model;
    String baseUrl;
    String deploymentName;
    String apiVersion;

    @Indexed
    boolean active;
    LocalDateTime updatedAt;
}
