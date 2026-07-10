package vn.chuongpl.ai_engine_service.features.admin;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.AccessLevel;
import lombok.Data;
import lombok.experimental.FieldDefaults;
import vn.chuongpl.ai_engine_service.model.AiProvider;

@Data
@FieldDefaults(level = AccessLevel.PRIVATE)
public class AiProviderConfigRequest {
    @NotBlank
    String name;
    @NotNull
    AiProvider provider;
    String apiKey;
    @NotBlank
    String model;
    String baseUrl;
    String deploymentName;
    String apiVersion;
}
