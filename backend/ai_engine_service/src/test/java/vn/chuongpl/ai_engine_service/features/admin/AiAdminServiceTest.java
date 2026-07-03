package vn.chuongpl.ai_engine_service.features.admin;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.model.AiProvider;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;
import vn.chuongpl.ai_engine_service.security.AiCredentialCipher;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AiAdminServiceTest {

    private static final String TEST_KEY = "MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDE=";

    @Mock AiProviderConfigRepository repository;
    @Mock AiModelGatewayRouter router;

    AiCredentialCipher cipher;
    AiAdminService service;

    @BeforeEach
    void setUp() {
        cipher = new AiCredentialCipher(TEST_KEY);
        service = new AiAdminService(repository, router, cipher);
    }

    @Test
    void upsert_new_provider_creates_document() {
        when(repository.findByProvider(AiProvider.GROQ)).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var request = new AiProviderConfigRequest();
        request.setApiKey("gsk-test");
        request.setModel("llama-3.1-8b-instant");
        request.setBaseUrl("https://api.groq.com/openai");

        AiProviderConfigResponse response = service.upsert("groq", request);

        assertThat(response.getProvider()).isEqualTo(AiProvider.GROQ);
        assertThat(response.isConfigured()).isTrue();
        assertThat(response.getModel()).isEqualTo("llama-3.1-8b-instant");
        verify(repository).save(argThat(c -> c.getId() != null && !c.getId().isBlank()
                && !"gsk-test".equals(c.getApiKey())
                && cipher.decrypt(c.getApiKey()).equals("gsk-test")));
    }

    @Test
    void upsert_existing_provider_keeps_apiKey_when_null() {
        var existing = AiProviderConfig.builder()
                .provider(AiProvider.GROQ).apiKey("original-key").model("old-model").build();
        when(repository.findByProvider(AiProvider.GROQ)).thenReturn(Optional.of(existing));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var request = new AiProviderConfigRequest();
        request.setApiKey(null);
        request.setModel("new-model");
        request.setBaseUrl("https://api.groq.com/openai");

        service.upsert("groq", request);

        verify(repository).save(argThat(c -> "original-key".equals(c.getApiKey())
                && "new-model".equals(c.getModel())));
    }

    @Test
    void activate_calls_router_activate() {
        var config = AiProviderConfig.builder()
                .provider(AiProvider.GEMINI).apiKey("key").model("gemini-1.5-flash").build();
        when(repository.findByProvider(AiProvider.GEMINI)).thenReturn(Optional.of(config));
        doNothing().when(router).activate(config);

        service.activate("gemini");

        verify(router).activate(config);
    }

    @Test
    void activate_provider_not_found_throws_PROVIDER_NOT_FOUND() {
        when(repository.findByProvider(AiProvider.GEMINI)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.activate("gemini"))
            .isInstanceOf(AppException.class)
            .extracting(e -> ((AppException) e).getErrorCode())
            .isEqualTo(ErrorCode.PROVIDER_NOT_FOUND);
    }

    @Test
    void activate_provider_without_apiKey_throws_PROVIDER_NOT_CONFIGURED() {
        var config = AiProviderConfig.builder()
                .provider(AiProvider.GEMINI).apiKey(null).build();
        when(repository.findByProvider(AiProvider.GEMINI)).thenReturn(Optional.of(config));

        assertThatThrownBy(() -> service.activate("gemini"))
            .isInstanceOf(AppException.class)
            .extracting(e -> ((AppException) e).getErrorCode())
            .isEqualTo(ErrorCode.PROVIDER_NOT_CONFIGURED);
    }

    @Test
    void delete_active_provider_throws_PROVIDER_ACTIVE() {
        var config = AiProviderConfig.builder()
                .provider(AiProvider.GROQ).active(true).apiKey("key").build();
        when(repository.findByProvider(AiProvider.GROQ)).thenReturn(Optional.of(config));

        assertThatThrownBy(() -> service.delete("groq"))
            .isInstanceOf(AppException.class)
            .extracting(e -> ((AppException) e).getErrorCode())
            .isEqualTo(ErrorCode.PROVIDER_ACTIVE);
    }

    @Test
    void delete_inactive_provider_removes_document() {
        var config = AiProviderConfig.builder()
                .provider(AiProvider.GROQ).active(false).apiKey("key").build();
        when(repository.findByProvider(AiProvider.GROQ)).thenReturn(Optional.of(config));

        service.delete("groq");

        verify(repository).delete(config);
    }

    @Test
    void listAll_returns_responses_without_apiKey() {
        when(repository.findAll()).thenReturn(List.of(
            AiProviderConfig.builder().provider(AiProvider.GROQ).apiKey("secret").model("m1").build(),
            AiProviderConfig.builder().provider(AiProvider.GEMINI).apiKey(null).model("m2").build()
        ));

        List<AiProviderConfigResponse> result = service.listAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).isConfigured()).isTrue();
        assertThat(result.get(1).isConfigured()).isFalse();
    }

    @Test
    void listAll_never_exposes_raw_oauthToken() {
        when(repository.findAll()).thenReturn(List.of(
            AiProviderConfig.builder().provider(AiProvider.CLAUDE_AGENT_SDK).oauthToken("raw-oauth-secret").build()
        ));

        List<AiProviderConfigResponse> result = service.listAll();

        assertThat(result.get(0).isOauthConfigured()).isTrue();
    }
}
