package vn.chuongpl.ai_engine_service.dtos.response;

import java.util.List;

public record CvImprovementResponse(
        List<String> strengths,
        List<String> weaknesses,
        List<ImprovementTip> tips
) {
    public record ImprovementTip(
            String area,
            String suggestion,
            String suggestionVi,
            String priority
    ) {
    }
}
