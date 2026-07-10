package vn.chuongpl.ai_engine_service.features.analysis;

import java.util.List;

public record StructuredCvProfile(
        CandidateProfile candidateProfile,
        SkillProfile skills,
        List<ExperienceItem> experience,
        List<String> education,
        List<String> certifications,
        List<ProjectItem> projects
) {
    public record CandidateProfile(
            List<String> targetRoles,
            String seniorityLevel,
            List<String> domains,
            int yearsOfExperience
    ) {}

    public record SkillProfile(
            List<String> technical,
            List<String> tools,
            List<String> frameworks,
            List<String> databases,
            List<String> cloud,
            List<String> softSkills,
            List<String> languages
    ) {}

    public record ExperienceItem(
            String title,
            String company,
            int durationMonths,
            List<String> responsibilities,
            List<String> achievements,
            List<String> evidenceSkills
    ) {}

    public record ProjectItem(
            String name,
            String summary,
            List<String> evidenceSkills
    ) {}
}
