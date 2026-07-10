package vn.chuongpl.user_service.integration.notification;

public record CvAnalysisDoneMessage(String userId, String cvId, String filename) {}
