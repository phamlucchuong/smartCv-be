package vn.chuongpl.ai_engine_service.model;

import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatModel;

@RequiredArgsConstructor
public class Llama3ModelGateway implements AiModelGateway {

    private final OpenAiChatModel chatModel;

    @Override
    public String call(String systemPrompt, String userPrompt) {
        return ChatClient.builder(chatModel).build()
                .prompt()
                .system(systemPrompt)
                .user(userPrompt)
                .call()
                .content();
    }

    @Override
    public AiProvider provider() {
        return AiProvider.LLAMA_3;
    }
}
