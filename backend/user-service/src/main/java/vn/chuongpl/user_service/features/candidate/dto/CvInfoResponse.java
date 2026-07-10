package vn.chuongpl.user_service.features.candidate.dto;

public record CvInfoResponse(
        String cvId,
        String cvUrl,
        String filename,
        String ownerId
) {}
