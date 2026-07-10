package vn.chuongpl.ai_engine_service.features.analysis;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PromptBuilderTest {

    private final PromptBuilder promptBuilder = new PromptBuilder(new DefaultResourceLoader());

    @Test
    void buildExtractSkillsPrompt_shouldReplaceTemplateVariables() {
        String prompt = promptBuilder.buildExtractSkillsPrompt(Map.of(
                "CV_TEXT", "Built Java APIs with Spring Boot and Docker."
        ));

        assertTrue(prompt.contains("Built Java APIs with Spring Boot and Docker."));
        assertFalse(prompt.contains("{{CV_TEXT}}"));
    }

    @Test
    void buildAssessmentGeneratePrompt_shouldReplaceTemplateVariables() {
        String prompt = promptBuilder.buildAssessmentGeneratePrompt(Map.of(
                "JOB_NAME", "Java Developer",
                "LEVEL", "Junior",
                "DIFFICULTY", "Medium",
                "NUM_QUESTIONS", "5"
        ));
        assertTrue(prompt.contains("Java Developer"));
        assertFalse(prompt.contains("{{JOB_NAME}}"));
    }

    @Test
    void systemPrompt_shouldLoadSystemInstructions() {
        String prompt = promptBuilder.systemPrompt();

        assertTrue(prompt.contains("SmartCV AI"));
        assertTrue(prompt.contains("valid JSON"));
    }
}
