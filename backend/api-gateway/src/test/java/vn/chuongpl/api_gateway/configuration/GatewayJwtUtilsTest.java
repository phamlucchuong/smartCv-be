package vn.chuongpl.api_gateway.configuration;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Date;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class GatewayJwtUtilsTest {

    private static final String SECRET = "0123456789012345678901234567890123456789012345678901234567890123";

    GatewayJwtUtils gatewayJwtUtils;

    @BeforeEach
    void setUp() {
        gatewayJwtUtils = new GatewayJwtUtils();
        ReflectionTestUtils.setField(gatewayJwtUtils, "signerKey", SECRET);
    }

    @Test
    void verify_shouldReturnClaimsForValidToken() throws Exception {
        String token = signToken("user-1", "ROLE_USER", new Date(System.currentTimeMillis() + 60_000), SECRET);

        JWTClaimsSet claims = gatewayJwtUtils.verify(token);

        assertEquals("user-1", gatewayJwtUtils.extractUserId(claims));
        assertEquals("ROLE_USER", gatewayJwtUtils.extractScope(claims));
    }

    @Test
    void verify_shouldThrowWhenTokenExpired() throws Exception {
        String token = signToken("user-1", "ROLE_USER", new Date(System.currentTimeMillis() - 60_000), SECRET);

        assertThrows(IllegalArgumentException.class, () -> gatewayJwtUtils.verify(token));
    }

    private String signToken(String subject, String scope, Date expiration, String secret) throws Exception {
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(subject)
                .expirationTime(expiration)
                .claim("scope", scope)
                .build();
        SignedJWT signedJwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS512), claims);
        signedJwt.sign(new MACSigner(secret));
        return signedJwt.serialize();
    }
}
