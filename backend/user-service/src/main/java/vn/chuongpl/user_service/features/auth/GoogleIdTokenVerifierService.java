package vn.chuongpl.user_service.features.auth;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.proc.JWSKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.RemoteJWKSet;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;
import lombok.experimental.FieldDefaults;
import lombok.experimental.NonFinal;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;

import java.net.MalformedURLException;
import java.net.URL;
import java.text.ParseException;
import java.time.Instant;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@FieldDefaults(level = lombok.AccessLevel.PRIVATE)
public class GoogleIdTokenVerifierService {
    private static final Set<String> ALLOWED_ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    @NonFinal
    @Value("${google.oauth.client-id:}")
    String clientId;

    @NonFinal
    @Value("${google.oauth.allowed-audiences:}")
    String allowedAudiences;

    @NonFinal
    @Value("${google.oauth.jwk-set-uri:https://www.googleapis.com/oauth2/v3/certs}")
    String jwkSetUri;

    volatile ConfigurableJWTProcessor<SecurityContext> jwtProcessor;

    public GoogleTokenPayload verify(String idToken) {
        if (!StringUtils.hasText(idToken)) {
            throw new AppException(ErrorCode.GOOGLE_AUTH_INVALID);
        }

        Set<String> audiences = resolveAllowedAudiences();
        if (audiences.isEmpty()) {
            throw new AppException(ErrorCode.GOOGLE_AUTH_NOT_CONFIGURED);
        }

        try {
            JWTClaimsSet claims = getJwtProcessor().process(idToken, null);
            validateClaims(claims, audiences);
            return new GoogleTokenPayload(
                    claims.getSubject(),
                    claims.getStringClaim("email"),
                    extractBooleanClaim(claims, "email_verified"),
                    claims.getStringClaim("name"),
                    claims.getStringClaim("given_name"),
                    claims.getStringClaim("family_name"),
                    claims.getStringClaim("picture")
            );
        } catch (ParseException | com.nimbusds.jose.proc.BadJOSEException | com.nimbusds.jose.JOSEException e) {
            throw new AppException(ErrorCode.GOOGLE_AUTH_INVALID);
        }
    }

    private ConfigurableJWTProcessor<SecurityContext> getJwtProcessor() {
        ConfigurableJWTProcessor<SecurityContext> current = jwtProcessor;
        if (current != null) {
            return current;
        }
        synchronized (this) {
            if (jwtProcessor == null) {
                jwtProcessor = buildJwtProcessor();
            }
            return jwtProcessor;
        }
    }

    private ConfigurableJWTProcessor<SecurityContext> buildJwtProcessor() {
        DefaultJWTProcessor<SecurityContext> processor = new DefaultJWTProcessor<>();
        JWKSource<SecurityContext> keySource = new RemoteJWKSet<>(googleJwkSetUrl());
        JWSKeySelector<SecurityContext> selector =
                new com.nimbusds.jose.proc.JWSVerificationKeySelector<>(JWSAlgorithm.RS256, keySource);
        processor.setJWSKeySelector(selector);
        return processor;
    }

    private URL googleJwkSetUrl() {
        try {
            return new URL(jwkSetUri);
        } catch (MalformedURLException e) {
            throw new AppException(ErrorCode.GOOGLE_AUTH_NOT_CONFIGURED);
        }
    }

    private Set<String> resolveAllowedAudiences() {
        LinkedHashSet<String> audiences = Arrays.stream(allowedAudiences.split(","))
                .map(String::trim)
                .filter(StringUtils::hasText)
                .collect(Collectors.toCollection(LinkedHashSet::new));
        if (StringUtils.hasText(clientId)) {
            audiences.add(clientId.trim());
        }
        return audiences;
    }

    private void validateClaims(JWTClaimsSet claims, Set<String> allowedAudienceSet) throws ParseException {
        List<String> tokenAudiences = claims.getAudience();
        if (tokenAudiences == null || tokenAudiences.stream().noneMatch(allowedAudienceSet::contains)) {
            throw new AppException(ErrorCode.GOOGLE_AUTH_INVALID);
        }

        if (!ALLOWED_ISSUERS.contains(claims.getIssuer())) {
            throw new AppException(ErrorCode.GOOGLE_AUTH_INVALID);
        }

        if (claims.getExpirationTime() == null || claims.getExpirationTime().toInstant().isBefore(Instant.now())) {
            throw new AppException(ErrorCode.GOOGLE_AUTH_INVALID);
        }

        if (!StringUtils.hasText(claims.getSubject()) || !StringUtils.hasText(claims.getStringClaim("email"))) {
            throw new AppException(ErrorCode.GOOGLE_AUTH_INVALID);
        }

        if (!extractBooleanClaim(claims, "email_verified")) {
            throw new AppException(ErrorCode.GOOGLE_AUTH_INVALID);
        }
    }

    private boolean extractBooleanClaim(JWTClaimsSet claims, String claimName) throws ParseException {
        Object value = claims.getClaim(claimName);
        if (value instanceof Boolean bool) {
            return bool;
        }
        if (value instanceof String text) {
            return Boolean.parseBoolean(text);
        }
        return Objects.equals(Boolean.TRUE, value);
    }
}
