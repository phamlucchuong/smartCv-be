package vn.chuongpl.ai_engine_service.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.ai_engine_service.config.AiProviderProperties;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.features.admin.AiProviderConfig;
import vn.chuongpl.ai_engine_service.features.admin.AiProviderConfigRepository;
import vn.chuongpl.ai_engine_service.features.analysis.AiUsageLogRepository;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiModelGatewayRouterTest {

    @Mock AiProviderConfigRepository repository;
    @Mock AiModelGatewayFactory factory;
    @Mock AiModelGateway mockGateway;
    @Mock AiUsageLogRepository usageLogRepository;

    // Unconfigured properties (no env vars) — used by tests that expect no auto-seed
    AiProviderProperties emptyProps = new AiProviderProperties();

    AiModelGatewayRouter router;

    @BeforeEach
    void setUp() {
        router = new AiModelGatewayRouter(repository, factory, emptyProps, usageLogRepository);
    }

    @Test
    void init_with_active_config_sets_gateway() {
        var config = AiProviderConfig.builder().provider(AiProvider.GROQ).build();
        when(repository.findByActiveTrue()).thenReturn(Optional.of(config));
        when(factory.create(config)).thenReturn(mockGateway);
        when(mockGateway.provider()).thenReturn(AiProvider.GROQ);

        router.init();

        assertThat(router.getActiveProvider()).isEqualTo("groq");
    }

    @Test
    void init_with_no_active_config_and_no_env_keys_leaves_gateway_null() {
        when(repository.findByActiveTrue()).thenReturn(Optional.empty());

        router.init();

        assertThat(router.getActiveProvider()).isEqualTo("none");
    }

    @Test
    void init_with_env_key_seeds_and_activates_provider() {
        AiProviderProperties props = new AiProviderProperties();
        props.getGroq().setApiKey("gsk_testkey");
        props.getGroq().setModel("llama-3.3-70b-versatile");
        props.getGroq().setBaseUrl("https://api.groq.com/openai/v1");
        var seededConfig = AiProviderConfig.builder()
                .provider(AiProvider.GROQ)
                .apiKey("gsk_testkey")
                .active(true)
                .build();
        when(repository.findByActiveTrue()).thenReturn(Optional.empty());
        when(repository.findByProvider(AiProvider.GROQ)).thenReturn(Optional.empty());
        when(repository.save(any())).thenReturn(seededConfig);
        when(factory.create(any())).thenReturn(mockGateway);
        when(mockGateway.provider()).thenReturn(AiProvider.GROQ);

        AiModelGatewayRouter seedRouter = new AiModelGatewayRouter(repository, factory, props, usageLogRepository);
        seedRouter.init();

        assertThat(seedRouter.getActiveProvider()).isEqualTo("groq");
        verify(repository).save(any());
    }

    @Test
    void call_with_null_gateway_throws_PROVIDER_NOT_CONFIGURED() {
        when(repository.findByActiveTrue()).thenReturn(Optional.empty());
        router.init();

        assertThatThrownBy(() -> router.call("sys", "user"))
            .isInstanceOf(AppException.class)
            .extracting(e -> ((AppException) e).getErrorCode())
            .isEqualTo(ErrorCode.PROVIDER_NOT_CONFIGURED);
    }

    @Test
    void call_delegates_to_active_gateway() {
        var config = AiProviderConfig.builder().provider(AiProvider.GEMINI).build();
        when(repository.findByActiveTrue()).thenReturn(Optional.of(config));
        when(factory.create(config)).thenReturn(mockGateway);
        lenient().when(mockGateway.provider()).thenReturn(AiProvider.GEMINI);
        when(mockGateway.call("sys", "user")).thenReturn("response");
        router.init();

        String result = router.call("sys", "user");

        assertThat(result).isEqualTo("response");
        verify(mockGateway).call("sys", "user");
    }

    @Test
    void activate_swaps_gateway_and_persists() {
        when(repository.findByActiveTrue()).thenReturn(Optional.empty());
        router.init();

        var newConfig = AiProviderConfig.builder().provider(AiProvider.GEMINI)
                .apiKey("key").model("gemini-1.5-flash").build();
        when(factory.create(newConfig)).thenReturn(mockGateway);
        when(mockGateway.provider()).thenReturn(AiProvider.GEMINI);
        when(repository.save(any())).thenReturn(newConfig);

        router.activate(newConfig);

        assertThat(router.getActiveProvider()).isEqualTo("gemini");
        verify(repository, atLeastOnce()).save(any());
    }

    @Test
    void getActiveProvider_returns_none_when_no_gateway() {
        when(repository.findByActiveTrue()).thenReturn(Optional.empty());
        router.init();

        assertThat(router.getActiveProvider()).isEqualTo("none");
    }
}
