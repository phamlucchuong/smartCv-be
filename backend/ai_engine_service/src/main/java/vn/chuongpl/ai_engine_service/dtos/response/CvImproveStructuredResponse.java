package vn.chuongpl.ai_engine_service.dtos.response;

import vn.chuongpl.ai_engine_service.dtos.response.CvImprovementResponse.ImprovementTip;
import java.util.List;

public record CvImproveStructuredResponse(
        List<StrengthItem> strengths,
        List<WeaknessItem> weaknesses,
        List<ImprovementTip> tips
) {}
