package vn.chuongpl.ai_engine_service.features.analysis;

import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class PromptBuilder {

    private final ResourceLoader resourceLoader;

    public String buildAnalyzePrompt(Map<String, Object> vars) {
        return apply(load("prompts/analyze_cv.md"), vars);
    }

    public String buildImprovePrompt(Map<String, Object> vars) {
        return apply(load("prompts/improve_cv.md"), vars);
    }

    public String buildRecommendPrompt(Map<String, Object> vars) {
        return apply(load("prompts/recommend_jobs.md"), vars);
    }

    public String buildInterviewQuestionsPrompt(Map<String, Object> vars) {
        return apply(load("prompts/interview_questions.md"), vars);
    }

    public String buildAssessmentGeneratePrompt(Map<String, Object> vars) {
        return apply(load("prompts/generate_assessment.md"), vars);
    }

    public String buildExtractSkillsPrompt(Map<String, Object> vars) {
        return apply(load("prompts/extract_skills.md"), vars);
    }

    public String buildExtractJobTargetPrompt(Map<String, Object> vars) {
        return apply(load("prompts/extract_job_target.md"), vars);
    }

    public String buildImproveStructuredPrompt(Map<String, Object> vars) {
        return apply(load("prompts/improve_cv_structured.md"), vars);
    }

    public String buildExtractCvStructuredPrompt(Map<String, Object> vars) {
        return apply(load("prompts/extract_cv_structured.md"), vars);
    }

    public String buildExtractJdRequirementsPrompt(Map<String, Object> vars) {
        return apply(load("prompts/extract_jd_requirements.md"), vars);
    }

    public String buildExtractOnetRequirementsPrompt(Map<String, Object> vars) {
        return apply(load("prompts/extract_onet_requirements.md"), vars);
    }

    public String systemPrompt() {
        return load("prompts/skill.md");
    }

    private String load(String path) {
        try {
            Resource resource = resourceLoader.getResource("classpath:" + path);
            return new String(resource.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot load prompt template: " + path, e);
        }
    }

    private String apply(String template, Map<String, Object> vars) {
        String content = template;
        for (Map.Entry<String, Object> entry : vars.entrySet()) {
            content = content.replace("{{" + entry.getKey() + "}}", String.valueOf(entry.getValue()));
        }
        return content;
    }
}
