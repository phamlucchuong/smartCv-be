package vn.chuongpl.ai_engine_service.features.analysis;

import java.util.List;

public record StructuredJobRequirements(
        JobInfo jobInfo,
        RequirementProfile requirements,
        List<String> responsibilitySignals,
        List<String> screeningQuestions
) {
    public record JobInfo(
            String title,
            String seniorityLevel,
            String domain,
            String employmentType
    ) {}

    public record RequirementProfile(
            List<String> mustHaveSkills,
            List<String> niceToHaveSkills,
            List<String> mustHaveTools,
            List<String> mustHaveFrameworks,
            List<String> mustHaveDatabases,
            List<String> mustHaveCloud,
            List<String> mustHaveLanguages,
            List<String> mustHaveCertifications,
            int minYearsExperience
    ) {}
}
