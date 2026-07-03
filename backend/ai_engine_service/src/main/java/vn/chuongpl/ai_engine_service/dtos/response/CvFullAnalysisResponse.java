package vn.chuongpl.ai_engine_service.dtos.response;

import vn.chuongpl.ai_engine_service.dtos.response.CvImprovementResponse.ImprovementTip;
import java.util.List;

public record CvFullAnalysisResponse(
        int overallScore,
        String scoreLabel,
        String targetPosition,
        int matchScore,
        List<String> matchedSkills,
        List<String> missingSkills,
        List<String> extraSkills,
        String summary,
        String summaryVi,
        List<StrengthItem> strengths,
        List<WeaknessItem> weaknesses,
        List<ImprovementTip> tips,
        List<String> extractedSkills
) {}
