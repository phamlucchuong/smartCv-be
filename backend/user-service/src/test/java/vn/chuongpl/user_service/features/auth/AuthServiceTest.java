package vn.chuongpl.user_service.features.auth;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSObject;
import com.nimbusds.jose.Payload;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import vn.chuongpl.user_service.dtos.request.GoogleAuthRequest;
import vn.chuongpl.user_service.dtos.response.AuthResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.role.Role;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.recruiter.RecruiterService;
import vn.chuongpl.user_service.features.role.RoleService;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserMapper;
import vn.chuongpl.user_service.features.user.UserService;
import vn.chuongpl.user_service.integration.notification.NotificationClient;

import java.text.ParseException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {
    private static final String SIGNER_KEY = "1234567890123456789012345678901234567890123456789012345678901234";

    @Mock
    private UserService userService;
    @Mock
    private RoleService roleService;
    @Mock
    private UserMapper userMapper;
    @Mock
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;
    @Mock
    private JwtBlacklistService jwtBlacklistService;
    @Mock
    private NotificationClient notificationClient;
    @Mock
    private CandidateService candidateService;
    @Mock
    private RecruiterService recruiterService;
    @Mock
    private GoogleIdTokenVerifierService googleIdTokenVerifierService;

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(
                userService,
                roleService,
                userMapper,
                passwordEncoder,
                jwtBlacklistService,
                notificationClient,
                candidateService,
                recruiterService,
                googleIdTokenVerifierService
        );
        ReflectionTestUtils.setField(authService, "SIGNER_KEY", SIGNER_KEY);
        ReflectionTestUtils.setField(authService, "VALID_DURATION", 5L);
        ReflectionTestUtils.setField(authService, "REFRESHABLE_DURATION", 1440L);
        ReflectionTestUtils.setField(authService, "LONG_REFRESHABLE_DURATION", 1440L);
    }

    @Test
    void refreshTokenRotatesTokensAndKeepsOneDayRefreshTtl() throws Exception {
        User user = new User();
        user.setId("user-1");

        String refreshToken = createRefreshToken(
                "user-1",
                Instant.now().minus(2, ChronoUnit.HOURS),
                Instant.now().plus(22, ChronoUnit.HOURS)
        );

        when(jwtBlacklistService.isBlacklisted(refreshToken)).thenReturn(false);
        when(userService.getById("user-1")).thenReturn(user);

        AuthResponse response = authService.refreshToken(refreshToken);

        assertNotEquals(refreshToken, response.getToken());
        assertNotEquals(refreshToken, response.getRefreshToken());

        SignedJWT accessJwt = SignedJWT.parse(response.getToken());
        SignedJWT refreshJwt = SignedJWT.parse(response.getRefreshToken());

        long accessTtlMinutes = ttlMinutes(accessJwt);
        long refreshTtlMinutes = ttlMinutes(refreshJwt);

        assertTrue(accessTtlMinutes >= 4 && accessTtlMinutes <= 5);
        assertTrue(refreshTtlMinutes >= 1439 && refreshTtlMinutes <= 1440);
        verify(jwtBlacklistService).addTokenToBlacklist(eq(refreshToken), anyLong());
    }

    @Test
    void refreshTokenReturnsNewRefreshTokenInsteadOfReusingTheOldOne() throws Exception {
        User user = new User();
        user.setId("user-1");

        String refreshToken = createRefreshToken(
                "user-1",
                Instant.now().minus(10, ChronoUnit.MINUTES),
                Instant.now().plus(1, ChronoUnit.DAYS)
        );

        when(jwtBlacklistService.isBlacklisted(refreshToken)).thenReturn(false);
        when(userService.getById("user-1")).thenReturn(user);

        AuthResponse response = authService.refreshToken(refreshToken);

        assertTrue(response.isAuthenticated());
        assertNotEquals(refreshToken, response.getRefreshToken());
    }

    @Test
    void authenticateWithGoogleCreatesRecruiterAccountAndProfile() {
        Role recruiterRole = Role.builder().name("RECRUITER").build();
        GoogleTokenPayload googleToken = new GoogleTokenPayload(
                "google-sub-1",
                "recruiter@example.com",
                true,
                "Recruiter User",
                "Recruiter",
                "User",
                null
        );

        when(googleIdTokenVerifierService.verify("google-id-token")).thenReturn(googleToken);
        when(userService.findAllByEmail("recruiter@example.com")).thenReturn(java.util.List.of());
        when(roleService.findById("RECRUITER")).thenReturn(Optional.of(recruiterRole));
        when(userService.saveUser(any(User.class))).thenAnswer(invocation -> {
            User user = invocation.getArgument(0);
            user.setId("user-google-1");
            return user;
        });

        AuthResponse response = authService.authenticateWithGoogle(new GoogleAuthRequest() {{
            setIdToken("google-id-token");
            setRole("RECRUITER");
        }});

        assertTrue(response.isAuthenticated());
        verify(recruiterService).createBasicProfile("user-google-1");
    }

    @Test
    void authenticateWithGoogleLinksExistingLocalCandidate() {
        Role candidateRole = Role.builder().name("CANDIDATE").build();
        User existing = User.builder()
                .id("user-local-1")
                .email("candidate@example.com")
                .password("hashed")
                .verified(false)
                .roles(Set.of(candidateRole))
                .build();
        GoogleTokenPayload googleToken = new GoogleTokenPayload(
                "google-sub-2",
                "candidate@example.com",
                true,
                "Candidate User",
                "Candidate",
                "User",
                null
        );

        when(googleIdTokenVerifierService.verify("google-id-token")).thenReturn(googleToken);
        when(userService.findAllByEmail("candidate@example.com")).thenReturn(java.util.List.of(existing));
        when(userService.saveUser(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        AuthResponse response = authService.authenticateWithGoogle(new GoogleAuthRequest() {{
            setIdToken("google-id-token");
            setRole("CANDIDATE");
        }});

        assertTrue(response.isAuthenticated());
        verify(candidateService).createBasicProfile("user-local-1");
    }

    @Test
    void authenticateWithGoogleRejectsRoleMismatch() {
        Role candidateRole = Role.builder().name("CANDIDATE").build();
        User existing = User.builder()
                .id("user-local-2")
                .email("candidate@example.com")
                .fullName("Candidate User")
                .verified(true)
                .authProvider("LOCAL")
                .googleSubject("google-sub-3")
                .roles(Set.of(candidateRole))
                .build();
        GoogleTokenPayload googleToken = new GoogleTokenPayload(
                "google-sub-3",
                "candidate@example.com",
                true,
                "Candidate User",
                "Candidate",
                "User",
                null
        );

        when(googleIdTokenVerifierService.verify("google-id-token")).thenReturn(googleToken);
        when(userService.findAllByEmail("candidate@example.com")).thenReturn(java.util.List.of(existing));

        AppException exception = assertThrows(AppException.class, () -> authService.authenticateWithGoogle(new GoogleAuthRequest() {{
            setIdToken("google-id-token");
            setRole("RECRUITER");
        }}));

        assertTrue(exception.getErrorCode() == ErrorCode.ROLE_MISMATCH);
    }

    @Test
    void authenticateWithGoogleRejectsGoogleSubjectConflict() {
        Role candidateRole = Role.builder().name("CANDIDATE").build();
        User existing = User.builder()
                .id("user-local-3")
                .email("candidate@example.com")
                .verified(true)
                .googleSubject("google-sub-old")
                .roles(Set.of(candidateRole))
                .build();
        GoogleTokenPayload googleToken = new GoogleTokenPayload(
                "google-sub-new",
                "candidate@example.com",
                true,
                "Candidate User",
                "Candidate",
                "User",
                null
        );

        when(googleIdTokenVerifierService.verify("google-id-token")).thenReturn(googleToken);
        when(userService.findAllByEmail("candidate@example.com")).thenReturn(java.util.List.of(existing));

        AppException exception = assertThrows(AppException.class, () -> authService.authenticateWithGoogle(new GoogleAuthRequest() {{
            setIdToken("google-id-token");
            setRole("CANDIDATE");
        }}));

        assertTrue(exception.getErrorCode() == ErrorCode.GOOGLE_ACCOUNT_CONFLICT);
    }

    private String createRefreshToken(String subject, Instant issueTime, Instant expirationTime) throws Exception {
        JWTClaimsSet claimsSet = new JWTClaimsSet.Builder()
                .subject(subject)
                .issuer("vn.chuongpl.user_service")
                .issueTime(Date.from(issueTime))
                .expirationTime(Date.from(expirationTime))
                .jwtID(UUID.randomUUID().toString())
                .claim("scope", "ROLE_CANDIDATE")
                .build();

        JWSObject jwsObject = new JWSObject(new JWSHeader(JWSAlgorithm.HS512), new Payload(claimsSet.toJSONObject()));
        jwsObject.sign(new MACSigner(SIGNER_KEY));
        return jwsObject.serialize();
    }

    private long ttlMinutes(SignedJWT signedJWT) throws ParseException {
        long millis = signedJWT.getJWTClaimsSet().getExpirationTime().getTime()
                - signedJWT.getJWTClaimsSet().getIssueTime().getTime();
        return millis / 60000;
    }
}
