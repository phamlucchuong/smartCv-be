package vn.chuongpl.ai_engine_service.features.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;
import vn.chuongpl.ai_engine_service.model.AiProvider;
import vn.chuongpl.ai_engine_service.security.AiCredentialCipher;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AiAdminService {

    private final AiProviderConfigRepository repository;
    private final AiModelGatewayRouter router;
    private final AiCredentialCipher cipher;

    public AiProviderConfigResponse upsert(String providerStr, AiProviderConfigRequest request) {
        AiProvider provider = parseProvider(providerStr);
        AiProviderConfig config = repository.findByProvider(provider)
                .orElse(AiProviderConfig.builder()
                        .id(UUID.randomUUID().toString())
                        .provider(provider)
                        .build());

        if (request.getApiKey() != null) config.setApiKey(cipher.encrypt(request.getApiKey()));
        if (request.getOauthToken() != null) config.setOauthToken(cipher.encrypt(request.getOauthToken()));
        config.setModel(request.getModel());
        config.setBaseUrl(request.getBaseUrl());
        config.setDeploymentName(request.getDeploymentName());
        config.setApiVersion(request.getApiVersion());
        config.setUpdatedAt(LocalDateTime.now());
        return toResponse(repository.save(config));
    }

    public AiProviderConfigResponse activate(String providerStr) {
        AiProvider provider = parseProvider(providerStr);
        AiProviderConfig config = repository.findByProvider(provider)
                .orElseThrow(() -> new AppException(ErrorCode.PROVIDER_NOT_FOUND));
        if (config.getApiKey() == null || config.getApiKey().isBlank()) {
            throw new AppException(ErrorCode.PROVIDER_NOT_CONFIGURED);
        }
        router.activate(config);
        return toResponse(config);
    }

    public void delete(String providerStr) {
        AiProvider provider = parseProvider(providerStr);
        AiProviderConfig config = repository.findByProvider(provider)
                .orElseThrow(() -> new AppException(ErrorCode.PROVIDER_NOT_FOUND));
        if (config.isActive()) throw new AppException(ErrorCode.PROVIDER_ACTIVE);
        repository.delete(config);
    }

    public List<AiProviderConfigResponse> listAll() {
        return repository.findAll().stream().map(this::toResponse).toList();
    }

    public AiProviderConfigResponse getActive() {
        return repository.findByActiveTrue()
                .map(this::toResponse)
                .orElseThrow(() -> new AppException(ErrorCode.PROVIDER_NOT_CONFIGURED));
    }

    private AiProvider parseProvider(String value) {
        try {
            return AiProvider.from(value);
        } catch (IllegalArgumentException e) {
            throw new AppException(ErrorCode.PROVIDER_NOT_FOUND);
        }
    }

    private AiProviderConfigResponse toResponse(AiProviderConfig c) {
        return AiProviderConfigResponse.builder()
                .provider(c.getProvider())
                .model(c.getModel())
                .baseUrl(c.getBaseUrl())
                .deploymentName(c.getDeploymentName())
                .apiVersion(c.getApiVersion())
                .active(c.isActive())
                .configured(c.getApiKey() != null && !c.getApiKey().isBlank())
                .oauthConfigured(c.getOauthToken() != null && !c.getOauthToken().isBlank())
                .updatedAt(c.getUpdatedAt())
                .build();
    }
}
