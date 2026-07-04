package vn.chuongpl.ai_engine_service;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.DefaultResourceLoader;
import vn.chuongpl.ai_engine_service.features.analysis.PromptBuilder;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class PromptBuilderNewMethodsTest {

    private final PromptBuilder promptBuilder = new PromptBuilder(new DefaultResourceLoader());

    @Test
    void buildExtractJobTargetPrompt_contains_cv_text() {
        String prompt = promptBuilder.buildExtractJobTargetPrompt(
                Map.of("CV_TEXT", "John Smith, Java Developer with 5 years experience"));
        assertThat(prompt).contains("John Smith");
        assertThat(prompt).contains("targetPosition");
    }

    @Test
    void buildImproveStructuredPrompt_contains_cv_and_job_vars() {
        String prompt = promptBuilder.buildImproveStructuredPrompt(Map.of(
                "CV_TEXT", "Java Developer",
                "JOB_TITLE", "Backend Engineer",
                "JOB_DESCRIPTION", "Build APIs",
                "JOB_SKILLS", "Java, Spring Boot",
                "JOB_REQUIREMENTS", "3+ years"
        ));
        assertThat(prompt).contains("Java Developer");
        assertThat(prompt).contains("Backend Engineer");
        assertThat(prompt).contains("area");
        assertThat(prompt).contains("detail");
    }

    @Test
    void buildExtractCvStructuredPrompt_contains_schema_fields() {
        String prompt = promptBuilder.buildExtractCvStructuredPrompt(Map.of(
                "CV_TEXT", "Java backend developer with Spring Boot and PostgreSQL"
        ));
        assertThat(prompt).contains("Java backend developer");
        assertThat(prompt).contains("candidateProfile");
        assertThat(prompt).contains("yearsOfExperience");
    }

    @Test
    void buildExtractJdRequirementsPrompt_contains_requirement_schema() {
        String prompt = promptBuilder.buildExtractJdRequirementsPrompt(Map.of(
                "JOB_TITLE", "Backend Engineer",
                "EXPERIENCE_LEVEL", "Mid",
                "JOB_SKILLS", "Java, Spring Boot",
                "JOB_REQUIREMENTS", "3+ years\nDocker",
                "JOB_DESCRIPTION", "Build APIs"
        ));
        assertThat(prompt).contains("Backend Engineer");
        assertThat(prompt).contains("mustHaveSkills");
        assertThat(prompt).contains("minYearsExperience");
    }

    @Test
    void buildExtractOnetRequirementsPrompt_contains_onet_payload() {
        String prompt = promptBuilder.buildExtractOnetRequirementsPrompt(Map.of(
                "TARGET_ROLE", "Backend Engineer",
                "TARGET_LEVEL", "Mid",
                "TARGET_YEARS", "4",
                "ONET_JOB_JSON", "{\"title\":\"Software Developers\",\"tasks\":[\"Build APIs\"]}"
        ));
        assertThat(prompt).contains("Backend Engineer");
        assertThat(prompt).contains("Software Developers");
        assertThat(prompt).contains("mustHaveSkills");
        assertThat(prompt).contains("Build APIs");
    }
}
