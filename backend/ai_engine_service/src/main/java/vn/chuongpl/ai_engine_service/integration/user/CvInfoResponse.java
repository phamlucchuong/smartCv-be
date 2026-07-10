package vn.chuongpl.ai_engine_service.integration.user;

public record CvInfoResponse(
        String cvId,
        String cvUrl,
        String filename,
        String ownerId
) {}
