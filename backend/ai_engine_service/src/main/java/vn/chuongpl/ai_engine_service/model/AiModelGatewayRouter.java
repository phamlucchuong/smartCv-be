package vn.chuongpl.ai_engine_service.model;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.features.admin.AiProviderConfig;
import vn.chuongpl.ai_engine_service.features.admin.AiProviderConfigRepository;

import java.time.LocalDateTime;
import java.util.UUID;
import vn.chuongpl.ai_engine_service.features.analysis.AiUsageLog;
import vn.chuongpl.ai_engine_service.features.analysis.AiUsageLogRepository;

@Component
@RequiredArgsConstructor
@Slf4j
public class AiModelGatewayRouter {

    private final AiProviderConfigRepository repository;
    private final AiModelGatewayFactory factory;
    private final AiUsageLogRepository usageLogRepository;

    private volatile AiModelGateway activeGateway;

    @PostConstruct
    void init() {
        loadActiveFromDb();
        if (activeGateway == null) {
            log.warn("No active AI provider configured. Seed the database (scripts/seed_master.mjs) "
                    + "or activate one via PUT /ai/api/ai/admin/providers/{provider}/activate");
        }
    }

    private synchronized void loadActiveFromDb() {
        if (activeGateway != null) return;
        repository.findByActiveTrue().ifPresent(config -> {
            activeGateway = factory.create(config);
            log.info("AI gateway initialized with provider: {}", config.getProvider());
        });
    }

    public String call(String systemPrompt, String userPrompt) {
        AiModelGateway gateway = activeGateway;
        if (gateway == null) {
            // Config may have been seeded after startup (e.g. seed_master.py) — retry from DB
            loadActiveFromDb();
            gateway = activeGateway;
        }
        if (gateway == null) throw new AppException(ErrorCode.PROVIDER_NOT_CONFIGURED);
        String response = gateway.call(systemPrompt, userPrompt);

        try {
            String providerName = gateway.provider().name();
            int promptTokens = (systemPrompt == null ? 0 : systemPrompt.length()) / 4 
                             + (userPrompt == null ? 0 : userPrompt.length()) / 4;
            int completionTokens = (response == null ? 0 : response.length()) / 4;
            
            double promptCost = promptTokens * getPromptPricePerToken(providerName);
            double completionCost = completionTokens * getCompletionPricePerToken(providerName);
            double totalCost = promptCost + completionCost;

            AiUsageLog logRecord = AiUsageLog.builder()
                    .id(UUID.randomUUID().toString())
                    .provider(providerName)
                    .promptTokens(promptTokens)
                    .completionTokens(completionTokens)
                    .cost(totalCost)
                    .createdAt(LocalDateTime.now())
                    .build();
            usageLogRepository.save(logRecord);
        } catch (Exception e) {
            log.error("Failed to save AI usage log", e);
        }

        return response;
    }

    private double getPromptPricePerToken(String provider) {
        if (provider == null) return 0.0000025;
        return switch (provider.toLowerCase()) {
            case "groq" -> 0.05 / 1_000_000.0;
            case "gemini" -> 0.075 / 1_000_000.0;
            case "anthropic" -> 3.0 / 1_000_000.0;
            case "azure_openai", "openai" -> 2.5 / 1_000_000.0;
            default -> 0.0000025;
        };
    }

    private double getCompletionPricePerToken(String provider) {
        if (provider == null) return 0.000010;
        return switch (provider.toLowerCase()) {
            case "groq" -> 0.10 / 1_000_000.0;
            case "gemini" -> 0.30 / 1_000_000.0;
            case "anthropic" -> 15.0 / 1_000_000.0;
            case "azure_openai", "openai" -> 10.0 / 1_000_000.0;
            default -> 0.000010;
        };
    }

    public void activate(AiProviderConfig config) {
        AiModelGateway gateway = factory.create(config);
        repository.findByActiveTrue().ifPresent(current -> {
            current.setActive(false);
            current.setUpdatedAt(LocalDateTime.now());
            repository.save(current);
        });
        config.setActive(true);
        config.setUpdatedAt(LocalDateTime.now());
        repository.save(config);
        activeGateway = gateway;
        log.info("AI provider switched to: {}", config.getProvider());
    }

    public String getActiveProvider() {
        AiModelGateway gateway = activeGateway;
        return gateway == null ? "none" : gateway.provider().name().toLowerCase();
    }
}
