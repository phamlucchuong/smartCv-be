package vn.chuongpl.ai_engine_service.model;

public enum AiProvider {
    GROQ, AZURE_OPENAI, GEMINI, LLAMA_3;

    public static AiProvider from(String value) {
        return switch (value.trim().toLowerCase()) {
            case "groq"                                  -> GROQ;
            case "azure", "azure_openai", "azure-openai" -> AZURE_OPENAI;
            case "gemini", "google", "google_gemini"     -> GEMINI;
            case "llama", "llama3", "llama_3", "llama-3" -> LLAMA_3;
            default -> throw new IllegalArgumentException("Unknown AI provider: " + value);
        };
    }
}
