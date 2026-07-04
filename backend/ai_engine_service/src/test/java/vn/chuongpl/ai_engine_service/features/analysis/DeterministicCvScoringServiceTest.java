package vn.chuongpl.ai_engine_service.features.analysis;

import org.junit.jupiter.api.Test;
import vn.chuongpl.ai_engine_service.dtos.response.CvAnalysisResponse;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DeterministicCvScoringServiceTest {

    private final DeterministicCvScoringService scoringService = new DeterministicCvScoringService();

    @Test
    void score_returns_explainable_breakdown_for_strong_match() {
        StructuredCvProfile cvProfile = new StructuredCvProfile(
                new StructuredCvProfile.CandidateProfile(List.of("Backend Engineer"), "Mid", List.of("FinTech"), 4),
                new StructuredCvProfile.SkillProfile(
                        List.of("Java", "REST API", "Spring Boot", "Docker", "PostgreSQL"),
                        List.of("Git", "Postman"),
                        List.of("Spring Boot"),
                        List.of("PostgreSQL"),
                        List.of("AWS"),
                        List.of("Communication"),
                        List.of("English")
                ),
                List.of(new StructuredCvProfile.ExperienceItem(
                        "Backend Engineer",
                        "ABC",
                        36,
                        List.of("Built APIs"),
                        List.of("Reduced latency"),
                        List.of("Java", "Spring Boot", "REST API", "PostgreSQL", "Docker")
                )),
                List.of("BSc Computer Science"),
                List.of("AWS Certified Developer"),
                List.of(new StructuredCvProfile.ProjectItem("Payments", "Payment APIs", List.of("Java", "Docker")))
        );

        StructuredJobRequirements jobRequirements = new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo("Backend Engineer", "Mid", "FinTech", "Full-time"),
                new StructuredJobRequirements.RequirementProfile(
                        List.of("Java", "REST API"),
                        List.of("Docker"),
                        List.of("Git"),
                        List.of("Spring Boot"),
                        List.of("PostgreSQL"),
                        List.of("AWS"),
                        List.of("English"),
                        List.of(),
                        3
                ),
                List.of("Build backend APIs"),
                List.of()
        );

        CvAnalysisResponse response = scoringService.score(cvProfile, jobRequirements);

        assertThat(response.matchScore()).isGreaterThanOrEqualTo(85);
        assertThat(response.matchedSkills()).containsExactly("Java", "REST API", "Git", "Spring Boot", "PostgreSQL", "AWS", "English");
        assertThat(response.missingSkills()).isEmpty();
        assertThat(response.breakdown()).isNotNull();
        assertThat(response.breakdown().skillMatchScore()).isGreaterThanOrEqualTo(90);
        assertThat(response.evidence()).isNotNull();
        assertThat(response.evidence().yearsExperienceSummary()).contains("4 year(s)");
    }

    @Test
    void score_applies_cap_when_must_have_coverage_is_too_low() {
        StructuredCvProfile cvProfile = new StructuredCvProfile(
                new StructuredCvProfile.CandidateProfile(List.of("Backend Engineer"), "Junior", List.of("E-Commerce"), 1),
                new StructuredCvProfile.SkillProfile(
                        List.of("JavaScript"),
                        List.of("Git"),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of(),
                        List.of("English")
                ),
                List.of(new StructuredCvProfile.ExperienceItem(
                        "Frontend Intern",
                        "XYZ",
                        12,
                        List.of("Built UI"),
                        List.of(),
                        List.of("JavaScript")
                )),
                List.of(),
                List.of(),
                List.of()
        );

        StructuredJobRequirements jobRequirements = new StructuredJobRequirements(
                new StructuredJobRequirements.JobInfo("Backend Engineer", "Mid", "FinTech", "Full-time"),
                new StructuredJobRequirements.RequirementProfile(
                        List.of("Java", "Spring Boot", "REST API"),
                        List.of("Docker"),
                        List.of("Git"),
                        List.of(),
                        List.of("PostgreSQL"),
                        List.of(),
                        List.of("English"),
                        List.of(),
                        3
                ),
                List.of(),
                List.of()
        );

        CvAnalysisResponse response = scoringService.score(cvProfile, jobRequirements);

        assertThat(response.matchScore()).isLessThanOrEqualTo(55);
        assertThat(response.missingSkills()).contains("Java", "Spring Boot", "REST API", "PostgreSQL");
        assertThat(response.breakdown().appliedCaps()).isNotEmpty();
        assertThat(response.summary()).contains("capped");
    }
}
