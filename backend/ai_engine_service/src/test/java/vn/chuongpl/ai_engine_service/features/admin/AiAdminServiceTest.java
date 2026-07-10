package vn.chuongpl.ai_engine_service.features.admin;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.ai_engine_service.enums.ErrorCode;
import vn.chuongpl.ai_engine_service.exception.AppException;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;
import vn.chuongpl.ai_engine_service.model.AiProvider;
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
    void create_new_model_creates_document() {
        when(repository.existsByProviderAndModel(AiProvider.GROQ, "llama-3.1-8b-instant")).thenReturn(false);
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        var request = new AiProviderConfigRequest();
        request.setName("Groq Fast");
        request.setProvider(AiProvider.GROQ);
        request.setApiKey("gsk-test");
        request.setModel("llama-3.1-8b-instant");
        request.setBaseUrl("https://api.groq.com/openai");

        AiProviderConfigResponse response = service.create(request);

        assertThat(response.getProvider()).isEqualTo(AiProvider.GROQ);
        assertThat(response.getName()).isEqualTo("Groq Fast");
        assertThat(response.isConfigured()).isTrue();
        verify(repository).save(argThat(c -> c.getId() != null && !c.getId().isBlank()
                && !"gsk-test".equals(c.getApiKey())
                && cipher.decrypt(c.getApiKey()).equals("gsk-test")));
    }

    @Test
    void create_duplicate_provider_and_model_throws() {
        when(repository.existsByProviderAndModel(AiProvider.GROQ, "llama-3.1-8b-instant")).thenReturn(true);

        var request = new AiProviderConfigRequest();
        request.setName("Groq Fast");
        request.setProvider(AiProvider.GROQ);
        request.setApiKey("gsk-test");
        request.setModel("llama-3.1-8b-instant");

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROVIDER_MODEL_ALREADY_EXISTS);
    }

    @Test
    void create_azure_without_required_fields_throws() {
        var request = new AiProviderConfigRequest();
        request.setName("Azure Main");
        request.setProvider(AiProvider.AZURE_OPENAI);
        request.setApiKey("azure-key");
        request.setModel("gpt-4o");

        assertThatThrownBy(() -> service.create(request))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROVIDER_NOT_CONFIGURED);
    }

    @Test
    void activate_calls_router_activate_by_id() {
        var config = AiProviderConfig.builder()
                .id("cfg-1")
                .provider(AiProvider.GEMINI)
                .name("Gemini Main")
                .apiKey("key")
                .model("gemini-2.5-flash")
                .build();
        when(repository.findById("cfg-1")).thenReturn(Optional.of(config));
        when(repository.findById("cfg-1")).thenReturn(Optional.of(config));

        service.activate("cfg-1");

        verify(router).activate(config);
    }

    @Test
    void activate_model_not_found_throws() {
        when(repository.findById("cfg-1")).thenReturn(Optional.empty());
        when(repository.findTopByNameIgnoreCaseOrderByUpdatedAtDesc("cfg-1")).thenReturn(Optional.empty());
        when(repository.findTopByModelIgnoreCaseOrderByUpdatedAtDesc("cfg-1")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.activate("cfg-1"))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROVIDER_MODEL_NOT_FOUND);
    }

    @Test
    void activate_by_model_value_falls_back_to_matching_config() {
        var config = AiProviderConfig.builder()
                .id("cfg-2")
                .provider(AiProvider.GROQ)
                .name("Groq Fast")
                .apiKey("key")
                .model("llama-3.1-8b-instant")
                .build();
        when(repository.findById("llama-3.1-8b-instant")).thenReturn(Optional.empty());
        when(repository.findTopByNameIgnoreCaseOrderByUpdatedAtDesc("llama-3.1-8b-instant")).thenReturn(Optional.empty());
        when(repository.findTopByModelIgnoreCaseOrderByUpdatedAtDesc("llama-3.1-8b-instant"))
                .thenReturn(Optional.of(config));
        when(repository.findById("cfg-2")).thenReturn(Optional.of(config));

        service.activate("llama-3.1-8b-instant");

        verify(router).activate(config);
    }

    @Test
    void activate_provider_without_required_api_key_throws() {
        var config = AiProviderConfig.builder()
                .id("cfg-1")
                .provider(AiProvider.GEMINI)
                .model("gemini-2.5-flash")
                .apiKey(null)
                .build();
        when(repository.findById("cfg-1")).thenReturn(Optional.of(config));

        assertThatThrownBy(() -> service.activate("cfg-1"))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROVIDER_NOT_CONFIGURED);
    }

    @Test
    void delete_active_provider_throws_PROVIDER_ACTIVE() {
        var config = AiProviderConfig.builder()
                .id("cfg-1")
                .provider(AiProvider.GROQ)
                .active(true)
                .apiKey("key")
                .build();
        when(repository.findById("cfg-1")).thenReturn(Optional.of(config));

        assertThatThrownBy(() -> service.delete("cfg-1"))
                .isInstanceOf(AppException.class)
                .extracting(e -> ((AppException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROVIDER_ACTIVE);
    }

    @Test
    void delete_inactive_provider_removes_document() {
        var config = AiProviderConfig.builder()
                .id("cfg-1")
                .provider(AiProvider.GROQ)
                .active(false)
                .apiKey("key")
                .build();
        when(repository.findById("cfg-1")).thenReturn(Optional.of(config));

        service.delete("cfg-1");

        verify(repository).delete(config);
    }

    @Test
    void listAll_returns_sorted_responses_without_apiKey() {
        when(repository.findAll()).thenReturn(List.of(
                AiProviderConfig.builder()
                        .id("cfg-2")
                        .provider(AiProvider.GEMINI)
                        .name("Gemini")
                        .model("gemini-2.5-flash")
                        .active(false)
                        .build(),
                AiProviderConfig.builder()
                        .id("cfg-1")
                        .provider(AiProvider.GROQ)
                        .name("Groq")
                        .apiKey("secret")
                        .model("llama-3.1-8b-instant")
                        .active(true)
                        .build()
        ));

        List<AiProviderConfigResponse> result = service.listAll();

        assertThat(result).hasSize(2);
        assertThat(result.get(0).getId()).isEqualTo("cfg-1");
        assertThat(result.get(0).isConfigured()).isTrue();
        assertThat(result.get(1).isConfigured()).isFalse();
    }
}
