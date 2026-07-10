package vn.chuongpl.ai_engine_service.features.analysis;

public record OnetJobProfile(
        String targetPosition,
        String jobTitle,
        String jobDescription,
        String jobSkills,
        String jobRequirements,
        StructuredJobRequirements requirements
) {}
