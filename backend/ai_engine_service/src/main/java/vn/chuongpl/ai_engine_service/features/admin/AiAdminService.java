package vn.chuongpl.ai_engine_service.features.admin;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.model.AiProvider;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;
import vn.chuongpl.ai_engine_service.security.AiCredentialCipher;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class AiAdminService {

    private final AiProviderConfigRepository repository;
    private final AiModelGatewayRouter router;
    private final AiCredentialCipher cipher;

    public AiProviderConfigResponse create(AiProviderConfigRequest request) {
        validateRequest(request);
        if (repository.existsByProviderAndModel(request.getProvider(), request.getModel())) {
            throw new AppException(ErrorCode.PROVIDER_MODEL_ALREADY_EXISTS);
        }

        AiProviderConfig config = AiProviderConfig.builder()
                .id(UUID.randomUUID().toString())
                .provider(request.getProvider())
                .name(request.getName().trim())
                .build();

        if (request.getApiKey() != null && !request.getApiKey().isBlank()) {
            config.setApiKey(cipher.encrypt(request.getApiKey().trim()));
        }
        config.setModel(request.getModel());
        config.setBaseUrl(request.getBaseUrl());
        config.setDeploymentName(request.getDeploymentName());
        config.setApiVersion(request.getApiVersion());
        config.setUpdatedAt(LocalDateTime.now());
        return toResponse(repository.save(config));
    }

    public AiProviderConfigResponse activate(String id) {
        AiProviderConfig config = resolveConfigForActivation(id);
        if (requiresApiKey(config.getProvider()) && (config.getApiKey() == null || config.getApiKey().isBlank())) {
            throw new AppException(ErrorCode.PROVIDER_NOT_CONFIGURED);
        }
        validateProviderSpecificFields(config);
        router.activate(config);
        return toResponse(repository.findById(config.getId()).orElse(config));
    }

    public void delete(String id) {
        AiProviderConfig config = resolveConfigReference(id)
                .orElseThrow(() -> new AppException(ErrorCode.PROVIDER_MODEL_NOT_FOUND));
        if (config.isActive()) throw new AppException(ErrorCode.PROVIDER_ACTIVE);
        repository.delete(config);
    }

    public List<AiProviderConfigResponse> listAll() {
        return repository.findAll().stream()
                .map(this::ensurePersistentId)
                .sorted(Comparator
                        .comparing(AiProviderConfig::isActive).reversed()
                        .thenComparing(AiProviderConfig::getUpdatedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .map(this::toResponse)
                .toList();
    }

    public AiProviderConfigResponse getActive() {
        return repository.findAllByActiveTrue().stream()
                .max(Comparator.comparing(AiProviderConfig::getUpdatedAt,
                        Comparator.nullsFirst(Comparator.naturalOrder())))
                .map(this::ensurePersistentId)
                .map(this::toResponse)
                .orElseThrow(() -> new AppException(ErrorCode.PROVIDER_NOT_CONFIGURED));
    }

    private AiProviderConfig resolveConfigForActivation(String id) {
        if (id == null || id.isBlank()) {
            throw new AppException(ErrorCode.AI_MODEL_ID_REQUIRED);
        }

        return resolveConfigReference(id)
                .orElseThrow(() -> new AppException(ErrorCode.PROVIDER_MODEL_NOT_FOUND));
    }

    private java.util.Optional<AiProviderConfig> resolveConfigReference(String value) {
        return repository.findById(value)
                .map(this::ensurePersistentId)
                .or(() -> resolveByMappedId(value))
                .or(() -> resolveByNameOrModel(value))
                .or(() -> resolveLegacyProviderKey(value));
    }

    private java.util.Optional<AiProviderConfig> resolveByMappedId(String value) {
        return repository.findAll().stream()
                .map(this::ensurePersistentId)
                .filter(config -> value.equals(config.getId()))
                .findFirst();
    }

    private java.util.Optional<AiProviderConfig> resolveByNameOrModel(String value) {
        return repository.findTopByNameIgnoreCaseOrderByUpdatedAtDesc(value)
                .or(() -> repository.findTopByModelIgnoreCaseOrderByUpdatedAtDesc(value))
                .map(this::ensurePersistentId);
    }

    private java.util.Optional<AiProviderConfig> resolveLegacyProviderKey(String value) {
        try {
            AiProvider provider = AiProvider.from(value);
            return repository.findTopByProviderOrderByUpdatedAtDesc(provider)
                    .map(config -> {
                        log.warn("Resolved legacy provider key '{}' to model '{}'", value, config.getModel());
                        return ensurePersistentId(config);
                    });
        } catch (RuntimeException ignored) {
            return java.util.Optional.empty();
        }
    }

    private AiProviderConfig ensurePersistentId(AiProviderConfig config) {
        if (config.getId() != null && !config.getId().isBlank()) {
            return config;
        }

        config.setId(UUID.randomUUID().toString());
        config.setUpdatedAt(LocalDateTime.now());
        return repository.save(config);
    }

    private void validateRequest(AiProviderConfigRequest request) {
        if (request.getProvider() == null) {
            throw new AppException(ErrorCode.PROVIDER_NOT_FOUND);
        }
        if (request.getName() == null || request.getName().isBlank()) {
            throw new AppException(ErrorCode.AI_MODEL_NAME_REQUIRED);
        }
        if (request.getModel() == null || request.getModel().isBlank()) {
            throw new AppException(ErrorCode.AI_MODEL_ID_REQUIRED);
        }
        if (requiresApiKey(request.getProvider()) && (request.getApiKey() == null || request.getApiKey().isBlank())) {
            throw new AppException(ErrorCode.PROVIDER_NOT_CONFIGURED);
        }

        validateProviderSpecificFields(AiProviderConfig.builder()
                .provider(request.getProvider())
                .model(request.getModel())
                .baseUrl(request.getBaseUrl())
                .deploymentName(request.getDeploymentName())
                .apiVersion(request.getApiVersion())
                .build());
    }

    private void validateProviderSpecificFields(AiProviderConfig config) {
        if (config.getProvider() == AiProvider.AZURE_OPENAI) {
            if (isBlank(config.getBaseUrl()) || isBlank(config.getDeploymentName()) || isBlank(config.getApiVersion())) {
                throw new AppException(ErrorCode.PROVIDER_NOT_CONFIGURED);
            }
        }
    }

    private boolean requiresApiKey(AiProvider provider) {
        return provider != AiProvider.LLAMA_3;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private AiProviderConfigResponse toResponse(AiProviderConfig c) {
        return AiProviderConfigResponse.builder()
                .id(c.getId())
                .name(c.getName())
                .provider(c.getProvider())
                .model(c.getModel())
                .baseUrl(c.getBaseUrl())
                .deploymentName(c.getDeploymentName())
                .apiVersion(c.getApiVersion())
                .active(c.isActive())
                .configured(c.getApiKey() != null && !c.getApiKey().isBlank())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
