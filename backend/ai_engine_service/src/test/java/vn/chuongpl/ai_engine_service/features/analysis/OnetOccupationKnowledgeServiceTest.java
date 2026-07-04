package vn.chuongpl.ai_engine_service.features.analysis;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.junit.jupiter.api.extension.ExtendWith;
import vn.chuongpl.ai_engine_service.config.OnetProperties;
import vn.chuongpl.ai_engine_service.integration.onet.OnetClient;
import vn.chuongpl.ai_engine_service.integration.onet.OnetEducationResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetJobZoneResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetKnowledgeResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetOverviewResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetSearchResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetSkillsResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetTasksResponse;
import vn.chuongpl.ai_engine_service.integration.onet.OnetTechnologySkillsResponse;
import vn.chuongpl.ai_engine_service.model.AiModelGatewayRouter;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OnetOccupationKnowledgeServiceTest {

    @Mock OnetClient onetClient;
    @Mock PromptBuilder promptBuilder;
    @Mock AiModelGatewayRouter modelRouter;

    private OnetOccupationKnowledgeService service;

    @BeforeEach
    void setUp() {
        OnetProperties properties = new OnetProperties();
        properties.setEnabled(true);
        properties.setSearchLimit(5);
        properties.setUsername("user");
        properties.setPassword("pass");
        service = new OnetOccupationKnowledgeService(onetClient, promptBuilder, modelRouter, properties);
        when(promptBuilder.systemPrompt()).thenReturn("system");
    }

    @Test
    void resolve_returns_structured_job_profile_from_best_matching_occupation() {
        StructuredCvProfile cvProfile = new StructuredCvProfile(
                new StructuredCvProfile.CandidateProfile(List.of("Backend Engineer"), "Mid", List.of("Tech"), 4),
                new StructuredCvProfile.SkillProfile(List.of("Java"), List.of(), List.of(), List.of(), List.of(), List.of(), List.of()),
                List.of(),
                List.of(),
                List.of(),
                List.of()
        );

        when(onetClient.searchOccupations("Backend Engineer", 5)).thenReturn(new OnetSearchResponse(List.of(
                new OnetSearchResponse.Occupation("15-1252.00", "Software Developers", "x"),
                new OnetSearchResponse.Occupation("15-2051.00", "Data Scientists", "y")
        )));
        when(onetClient.getOverview("15-1252.00")).thenReturn(new OnetOverviewResponse(
                "15-1252.00",
                "Software Developers",
                "Research, design, and develop software systems.",
                List.of("Backend Engineer", "Application Developer")
        ));
        when(onetClient.getJobZone("15-1252.00")).thenReturn(new OnetJobZoneResponse(
                "15-1252.00", "Software Developers", "Job Zone Four", "Bachelor's degree", "Two to four years"
        ));
        when(onetClient.getTasks("15-1252.00")).thenReturn(new OnetTasksResponse(
                List.of(new OnetTasksResponse.Task("Develop and test software applications."))
        ));
        when(onetClient.getSkills("15-1252.00")).thenReturn(new OnetSkillsResponse(
                List.of(new OnetSkillsResponse.Element("Programming", "Writing computer programs"),
                        new OnetSkillsResponse.Element("Critical Thinking", "Use logic and reasoning"))
        ));
        when(onetClient.getKnowledge("15-1252.00")).thenReturn(new OnetKnowledgeResponse(
                List.of(new OnetKnowledgeResponse.Element("Computers and Electronics", "Knowledge of software"))
        ));
        when(onetClient.getTechnologySkills("15-1252.00")).thenReturn(new OnetTechnologySkillsResponse(
                List.of(new OnetTechnologySkillsResponse.Category("Databases", List.of("PostgreSQL", "MySQL"))),
                List.of("Git", "Docker", "Spring Boot")
        ));
        when(onetClient.getEducation("15-1252.00")).thenReturn(new OnetEducationResponse(
                List.of(new OnetEducationResponse.ResponseItem("Bachelor's degree", 68))
        ));

        when(promptBuilder.buildExtractOnetRequirementsPrompt(anyMap())).thenReturn("onet prompt");
        when(modelRouter.call("system", "onet prompt")).thenReturn("""
                {
                  "jobInfo": {
                    "title": "Software Developers",
                    "seniorityLevel": "Mid",
                    "domain": "Tech",
                    "employmentType": "Full-time"
                  },
                  "requirements": {
                    "mustHaveSkills": ["Programming"],
                    "niceToHaveSkills": ["Critical Thinking"],
                    "mustHaveTools": ["Git", "Docker"],
                    "mustHaveFrameworks": ["Spring Boot"],
                    "mustHaveDatabases": ["PostgreSQL"],
                    "mustHaveCloud": [],
                    "mustHaveLanguages": [],
                    "mustHaveCertifications": [],
                    "minYearsExperience": 3
                  },
                  "responsibilitySignals": ["Develop and test software applications."],
                  "screeningQuestions": []
                }
                """);

        Optional<OnetJobProfile> result = service.resolve(cvProfile);

        assertThat(result).isPresent();
        assertThat(result.get().targetPosition()).isEqualTo("Software Developers");
        assertThat(result.get().requirements().requirements().mustHaveFrameworks()).contains("Spring Boot");
        assertThat(result.get().jobDescription()).contains("Research, design, and develop software systems.");
        verify(onetClient).getOverview("15-1252.00");
    }
}
