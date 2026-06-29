package vn.chuongpl.ai_engine_service.dtos.response;

import java.util.List;

public record CvAnalysisResponse(
        int matchScore,
        String scoreLabel,
        List<String> matchedSkills,
        List<String> missingSkills,
        List<String> extraSkills,
        String summary,
        ScoreBreakdownResponse breakdown,
        ScoreEvidenceResponse evidence
) {
}
