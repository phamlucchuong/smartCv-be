package vn.chuongpl.ai_engine_service.model;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AiProviderTest {

    @Test
    void from_groq_returns_GROQ() {
        assertThat(AiProvider.from("groq")).isEqualTo(AiProvider.GROQ);
    }

    @Test
    void from_gemini_aliases_return_GEMINI() {
        assertThat(AiProvider.from("gemini")).isEqualTo(AiProvider.GEMINI);
        assertThat(AiProvider.from("google")).isEqualTo(AiProvider.GEMINI);
        assertThat(AiProvider.from("google_gemini")).isEqualTo(AiProvider.GEMINI);
        assertThat(AiProvider.from("GEMINI")).isEqualTo(AiProvider.GEMINI);
    }

    @Test
    void from_azure_aliases_return_AZURE_OPENAI() {
        assertThat(AiProvider.from("azure")).isEqualTo(AiProvider.AZURE_OPENAI);
        assertThat(AiProvider.from("azure_openai")).isEqualTo(AiProvider.AZURE_OPENAI);
        assertThat(AiProvider.from("azure-openai")).isEqualTo(AiProvider.AZURE_OPENAI);
    }

    @Test
    void from_llama_aliases_return_LLAMA_3() {
        assertThat(AiProvider.from("llama")).isEqualTo(AiProvider.LLAMA_3);
        assertThat(AiProvider.from("llama3")).isEqualTo(AiProvider.LLAMA_3);
        assertThat(AiProvider.from("llama_3")).isEqualTo(AiProvider.LLAMA_3);
        assertThat(AiProvider.from("llama-3")).isEqualTo(AiProvider.LLAMA_3);
    }

    @Test
    void from_unknown_throws_IllegalArgumentException() {
        assertThatThrownBy(() -> AiProvider.from("unknown"))
            .isInstanceOf(IllegalArgumentException.class)
            .hasMessageContaining("Unknown AI provider: unknown");
    }
}
