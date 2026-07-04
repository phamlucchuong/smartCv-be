package vn.chuongpl.ai_engine_service.dtos.response;

import java.util.List;

public record ScoreBreakdownResponse(
        int skillMatchScore,
        int experienceMatchScore,
        int seniorityMatchScore,
        int domainMatchScore,
        int bonusScore,
        List<String> appliedCaps
) {
}
