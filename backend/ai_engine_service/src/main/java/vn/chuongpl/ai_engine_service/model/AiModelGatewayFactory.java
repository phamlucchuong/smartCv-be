package vn.chuongpl.ai_engine_service.model;

import com.azure.ai.openai.OpenAIClientBuilder;
import com.azure.core.credential.AzureKeyCredential;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.azure.openai.AzureOpenAiChatModel;
import org.springframework.ai.azure.openai.AzureOpenAiChatOptions;
import org.springframework.ai.openai.OpenAiChatModel;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.ai.openai.api.OpenAiApi;
import org.springframework.stereotype.Component;
import vn.chuongpl.ai_engine_service.features.admin.AiProviderConfig;
import vn.chuongpl.ai_engine_service.security.AiCredentialCipher;

@Component
@RequiredArgsConstructor
public class AiModelGatewayFactory {

    private final AiCredentialCipher cipher;

    public AiModelGateway create(AiProviderConfig config) {
        return switch (config.getProvider()) {
            case GROQ             -> buildGroq(config);
            case GEMINI           -> buildGemini(config);
            case AZURE_OPENAI     -> buildAzure(config);
            case LLAMA_3          -> buildLlama3(config);
        };
    }

    private GroqModelGateway buildGroq(AiProviderConfig c) {
        var api = OpenAiApi.builder()
                .baseUrl(c.getBaseUrl())
                .apiKey(cipher.decrypt(c.getApiKey()))
                .build();
        var model = OpenAiChatModel.builder()
                .openAiApi(api)
                .defaultOptions(OpenAiChatOptions.builder()
                        .model(c.getModel())
                        .temperature(0.2)
                        .build())
                .build();
        return new GroqModelGateway(model);
    }

    private GeminiModelGateway buildGemini(AiProviderConfig c) {
        var api = OpenAiApi.builder()
                .baseUrl(c.getBaseUrl())
                .apiKey(cipher.decrypt(c.getApiKey()))
                .build();
        var model = OpenAiChatModel.builder()
                .openAiApi(api)
                .defaultOptions(OpenAiChatOptions.builder()
                        .model(c.getModel())
                        .temperature(0.2)
                        .build())
                .build();
        return new GeminiModelGateway(model);
    }

    private AzureOpenAiModelGateway buildAzure(AiProviderConfig c) {
        var openAiClientBuilder = new OpenAIClientBuilder()
                .credential(new AzureKeyCredential(cipher.decrypt(c.getApiKey())))
                .endpoint(c.getBaseUrl());
        var model = AzureOpenAiChatModel.builder()
                .openAIClientBuilder(openAiClientBuilder)
                .defaultOptions(AzureOpenAiChatOptions.builder()
                        .deploymentName(c.getDeploymentName())
                        .temperature(0.2)
                        .build())
                .build();
        return new AzureOpenAiModelGateway(model);
    }

    private Llama3ModelGateway buildLlama3(AiProviderConfig c) {
        var api = OpenAiApi.builder()
                .baseUrl(c.getBaseUrl() != null && !c.getBaseUrl().isBlank() ? c.getBaseUrl() : "http://localhost:11434/v1")
                .apiKey(c.getApiKey() != null ? cipher.decrypt(c.getApiKey()) : "no-key")
                .build();
        var model = OpenAiChatModel.builder()
                .openAiApi(api)
                .defaultOptions(OpenAiChatOptions.builder()
                        .model(c.getModel())
                        .temperature(0.2)
                        .build())
                .build();
        return new Llama3ModelGateway(model);
    }
}
