package vn.chuongpl.ai_engine_service.model;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.features.admin.AiProviderConfig;
import vn.chuongpl.ai_engine_service.features.admin.AiProviderConfigRepository;
import vn.chuongpl.ai_engine_service.features.analysis.AiUsageLogRepository;

import java.time.LocalDateTime;
import java.util.List;

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

    AiModelGatewayRouter router;

    @BeforeEach
    void setUp() {
        router = new AiModelGatewayRouter(repository, factory, usageLogRepository);
    }

    @Test
    void init_with_active_config_sets_gateway() {
        var config = AiProviderConfig.builder().provider(AiProvider.GROQ).build();
        when(repository.findAllByActiveTrue()).thenReturn(List.of(config));
        when(factory.create(config)).thenReturn(mockGateway);
        when(mockGateway.provider()).thenReturn(AiProvider.GROQ);

        router.init();

        assertThat(router.getActiveProvider()).isEqualTo("groq");
    }

    @Test
    void init_with_no_active_config_leaves_gateway_null() {
        when(repository.findAllByActiveTrue()).thenReturn(List.of());

        router.init();

        assertThat(router.getActiveProvider()).isEqualTo("none");
    }

    @Test
    void call_with_no_active_config_throws_PROVIDER_NOT_CONFIGURED() {
        when(repository.findAllByActiveTrue()).thenReturn(List.of());
        router.init();

        assertThatThrownBy(() -> router.call("sys", "user"))
            .isInstanceOf(AppException.class)
            .extracting(e -> ((AppException) e).getErrorCode())
            .isEqualTo(ErrorCode.PROVIDER_NOT_CONFIGURED);
    }

    @Test
    void call_lazily_loads_config_seeded_after_startup() {
        var config = AiProviderConfig.builder().provider(AiProvider.GROQ).apiKey("key").build();
        when(repository.findAllByActiveTrue())
                .thenReturn(List.of())
                .thenReturn(List.of(config));
        when(factory.create(config)).thenReturn(mockGateway);
        when(mockGateway.provider()).thenReturn(AiProvider.GROQ);
        when(mockGateway.call("sys", "user")).thenReturn("response");

        router.init();
        assertThat(router.getActiveProvider()).isEqualTo("none");

        String result = router.call("sys", "user");

        assertThat(result).isEqualTo("response");
        assertThat(router.getActiveProvider()).isEqualTo("groq");
    }

    @Test
    void call_delegates_to_active_gateway() {
        var config = AiProviderConfig.builder().provider(AiProvider.GEMINI).build();
        when(repository.findAllByActiveTrue()).thenReturn(List.of(config));
        when(factory.create(config)).thenReturn(mockGateway);
        lenient().when(mockGateway.provider()).thenReturn(AiProvider.GEMINI);
        when(mockGateway.call("sys", "user")).thenReturn("response");
        router.init();

        String result = router.call("sys", "user");

        assertThat(result).isEqualTo("response");
        verify(mockGateway).call("sys", "user");
    }

    @Test
    void call_saves_usage_log_with_assigned_string_id() {
        var config = AiProviderConfig.builder().provider(AiProvider.GEMINI).build();
        when(repository.findAllByActiveTrue()).thenReturn(List.of(config));
        when(factory.create(config)).thenReturn(mockGateway);
        when(mockGateway.provider()).thenReturn(AiProvider.GEMINI);
        when(mockGateway.call("sys", "user")).thenReturn("response");
        router.init();

        router.call("sys", "user");

        verify(usageLogRepository).save(argThat(logRecord ->
                logRecord.getId() != null && !logRecord.getId().isBlank()));
    }

    @Test
    void activate_swaps_gateway_and_persists() {
        when(repository.findAllByActiveTrue()).thenReturn(List.of());
        router.init();

        var newConfig = AiProviderConfig.builder().id("cfg-1").provider(AiProvider.GEMINI)
                .apiKey("key").model("gemini-1.5-flash").build();
        when(factory.create(newConfig)).thenReturn(mockGateway);
        when(mockGateway.provider()).thenReturn(AiProvider.GEMINI);
        when(repository.save(any())).thenReturn(newConfig);

        router.activate(newConfig);

        assertThat(router.getActiveProvider()).isEqualTo("gemini");
        verify(repository, atLeastOnce()).save(any());
    }

    @Test
    void init_with_multiple_active_configs_picks_latest_and_deactivates_others() {
        var older = AiProviderConfig.builder()
                .id("cfg-old").provider(AiProvider.GEMINI).model("gemini-2.0-flash")
                .active(true).updatedAt(LocalDateTime.of(2026, 7, 4, 0, 0)).build();
        var newer = AiProviderConfig.builder()
                .id("cfg-new").provider(AiProvider.AZURE_OPENAI).model("gpt-5.4-mini")
                .active(true).updatedAt(LocalDateTime.of(2026, 7, 4, 0, 18)).build();
        when(repository.findAllByActiveTrue()).thenReturn(List.of(older, newer));
        when(factory.create(newer)).thenReturn(mockGateway);
        when(mockGateway.provider()).thenReturn(AiProvider.AZURE_OPENAI);

        router.init();

        assertThat(router.getActiveProvider()).isEqualTo("azure_openai");
        verify(repository).save(argThat(c -> "cfg-old".equals(c.getId()) && !c.isActive()));
        verify(repository, never()).save(argThat(c -> "cfg-new".equals(c.getId())));
        verify(factory, never()).create(older);
    }

    @Test
    void activate_deactivates_all_currently_active_configs() {
        var activeA = AiProviderConfig.builder()
                .id("cfg-a").provider(AiProvider.GEMINI).model("gemini-2.0-flash").active(true).build();
        var activeB = AiProviderConfig.builder()
                .id("cfg-b").provider(AiProvider.AZURE_OPENAI).model("gpt-5.4-mini").active(true).build();
        when(repository.findAllByActiveTrue())
                .thenReturn(List.of())
                .thenReturn(List.of(activeA, activeB));
        router.init();

        var target = AiProviderConfig.builder()
                .id("cfg-target").provider(AiProvider.GROQ).apiKey("key").model("llama-3.3-70b-versatile").build();
        when(factory.create(target)).thenReturn(mockGateway);
        when(mockGateway.provider()).thenReturn(AiProvider.GROQ);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        router.activate(target);

        assertThat(router.getActiveProvider()).isEqualTo("groq");
        verify(repository).save(argThat(c -> "cfg-a".equals(c.getId()) && !c.isActive()));
        verify(repository).save(argThat(c -> "cfg-b".equals(c.getId()) && !c.isActive()));
        verify(repository).save(argThat(c -> "cfg-target".equals(c.getId()) && c.isActive()));
    }

    @Test
    void getActiveProvider_returns_none_when_no_gateway() {
        when(repository.findAllByActiveTrue()).thenReturn(List.of());
        router.init();

        assertThat(router.getActiveProvider()).isEqualTo("none");
    }
}
