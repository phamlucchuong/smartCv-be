package vn.chuongpl.user_service.features.auth;

public record GoogleTokenPayload(
        String subject,
        String email,
        boolean emailVerified,
        String fullName,
        String givenName,
        String familyName,
        String pictureUrl
) {
}
