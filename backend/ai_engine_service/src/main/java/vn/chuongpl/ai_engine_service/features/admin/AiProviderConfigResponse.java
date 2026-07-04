package vn.chuongpl.ai_engine_service.features.admin;

import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.ai_engine_service.model.AiProvider;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiProviderConfigResponse {
    String id;
    String name;
    AiProvider provider;
    String model;
    String baseUrl;
    String deploymentName;
    String apiVersion;
    boolean active;
    boolean configured;
    LocalDateTime updatedAt;
}
