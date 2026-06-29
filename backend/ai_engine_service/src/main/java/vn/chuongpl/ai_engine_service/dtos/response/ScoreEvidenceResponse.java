package vn.chuongpl.ai_engine_service.dtos.response;

import java.util.List;

public record ScoreEvidenceResponse(
        List<String> matchedMustHaveSkills,
        List<String> missingMustHaveSkills,
        List<String> matchedNiceToHaveSkills,
        List<String> experienceSignals,
        String yearsExperienceSummary,
        List<String> concerns
) {
}
