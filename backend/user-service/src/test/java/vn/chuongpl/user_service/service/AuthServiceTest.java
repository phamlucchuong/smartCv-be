package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import vn.chuongpl.user_service.dtos.request.AuthRequest;
import vn.chuongpl.user_service.dtos.request.RegisterRequest;
import vn.chuongpl.user_service.dtos.response.UserResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.auth.AuthService;
import vn.chuongpl.user_service.features.auth.JwtBlacklistService;
import vn.chuongpl.user_service.features.candidate.CandidateService;
import vn.chuongpl.user_service.features.recruiter.RecruiterService;
import vn.chuongpl.user_service.features.role.Role;
import vn.chuongpl.user_service.features.role.RoleService;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserMapper;
import vn.chuongpl.user_service.features.user.UserService;
import vn.chuongpl.user_service.integration.notification.NotificationClient;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock
    UserService userService;
    @Mock
    RoleService roleService;
    @Mock
    UserMapper userMapper;
    @Mock
    PasswordEncoder passwordEncoder;
    @Mock
    JwtBlacklistService jwtBlacklistService;
    @Mock
    NotificationClient notificationClient;
    @Mock
    CandidateService candidateService;
    @Mock
    RecruiterService recruiterService;

    @InjectMocks
    AuthService authService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(authService, "SIGNER_KEY", "0123456789012345678901234567890123456789012345678901234567890123");
        ReflectionTestUtils.setField(authService, "VALID_DURATION", 15L);
        ReflectionTestUtils.setField(authService, "REFRESHABLE_DURATION", 60L);
        ReflectionTestUtils.setField(authService, "LONG_REFRESHABLE_DURATION", 1440L);
    }

    @Test
    void authenticated_shouldThrowWhenUserNotVerified() {
        User user = User.builder()
                .id("u1")
                .email("a@b.com")
                .password(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(10).encode("admin"))
                .verified(false)
                .roles(Set.of())
                .build();
        when(userService.findByEmailAndDeletedFalse("a@b.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("admin", user.getPassword())).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> authService.authenticated(AuthRequest.builder().email("a@b.com").password("admin").build()));
        assertEquals(ErrorCode.USER_NOT_VERIFIED, ex.getErrorCode());
        verify(notificationClient).sendOTP("a@b.com", "EMAIL", "VERIFY_ACCOUNT");
    }

    @Test
    void register_shouldAssignCandidateRole() {
        RegisterRequest request = new RegisterRequest("User A", "a@b.com", "12345678", "0909", "EMAIL", "CANDIDATE", null);
        User savedUser = User.builder().id("u1").email("a@b.com").roles(new HashSet<>()).createdAt(LocalDateTime.now()).build();
        UserResponse response = UserResponse.builder().id("u1").email("a@b.com").build();
        Role candidate = Role.builder().name("CANDIDATE").description("Job seeker").build();

        when(userService.findAllByEmail("a@b.com")).thenReturn(java.util.Collections.emptyList());
        when(roleService.findById("CANDIDATE")).thenReturn(Optional.of(candidate));
        when(passwordEncoder.encode("12345678")).thenReturn("encoded");
        when(userService.saveUser(any(User.class))).thenReturn(savedUser);
        when(userMapper.toUserResponse(savedUser)).thenReturn(response);

        UserResponse actual = authService.register(request);

        assertEquals("u1", actual.getId());
        verify(notificationClient).sendOTP("a@b.com", "EMAIL", "VERIFY_ACCOUNT");
    }

    @Test
    void register_shouldAssignRecruiterRole() {
        RegisterRequest request = new RegisterRequest("User B", "b@b.com", "12345678", "0908", "SMS", "RECRUITER", "ACME");
        User savedUser = User.builder().id("u2").email("b@b.com").roles(new HashSet<>()).createdAt(LocalDateTime.now()).build();
        UserResponse response = UserResponse.builder().id("u2").email("b@b.com").build();
        Role recruiter = Role.builder().name("RECRUITER").description("Company recruiter").build();

        when(userService.findAllByEmail("b@b.com")).thenReturn(java.util.Collections.emptyList());
        when(roleService.findById("RECRUITER")).thenReturn(Optional.of(recruiter));
        when(passwordEncoder.encode("12345678")).thenReturn("encoded");
        when(userService.saveUser(any(User.class))).thenReturn(savedUser);
        when(userMapper.toUserResponse(savedUser)).thenReturn(response);

        UserResponse actual = authService.register(request);

        assertEquals("u2", actual.getId());
        verify(notificationClient).sendOTP("0908", "SMS", "VERIFY_ACCOUNT");
        verify(recruiterService).createBasicProfile("u2", "ACME");
    }

    @Test
    void register_shouldOverwriteWhenUserExistsButUnverified() {
        RegisterRequest request = new RegisterRequest("User New", "a@b.com", "12345678", "0909", "EMAIL", "CANDIDATE", null);
        User existingUser = User.builder().id("u1").email("a@b.com").fullName("User Old").phone("0101").verified(false).build();
        UserResponse response = UserResponse.builder().id("u1").email("a@b.com").fullName("User New").build();
        Role candidate = Role.builder().name("CANDIDATE").description("Job seeker").build();

        when(userService.findAllByEmail("a@b.com")).thenReturn(java.util.Arrays.asList(existingUser));
        when(roleService.findById("CANDIDATE")).thenReturn(Optional.of(candidate));
        when(passwordEncoder.encode("12345678")).thenReturn("encoded");
        when(userService.saveUser(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(userMapper.toUserResponse(any(User.class))).thenReturn(response);

        UserResponse actual = authService.register(request);

        assertEquals("u1", actual.getId());
        assertEquals("User New", actual.getFullName());
        verify(notificationClient).sendOTP("a@b.com", "EMAIL", "VERIFY_ACCOUNT");
    }

    @Test
    void authenticated_shouldReturnAccessTokenKey() {
        String rawPassword = "12345678";
        String encoded = new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(10).encode(rawPassword);
        User user = User.builder().id("u1").email("a@b.com").password(encoded).verified(true).roles(Set.of()).build();
        when(userService.findByEmailAndDeletedFalse("a@b.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches(rawPassword, encoded)).thenReturn(true);

        Map<String, String> tokens = authService.authenticated(AuthRequest.builder().email("a@b.com").password(rawPassword).build());

        assertTrue(tokens.containsKey("accessToken"));
        assertTrue(tokens.containsKey("refreshToken"));
    }

    @Test
    void register_shouldThrowWhenRoleIsUnsupported() {
        RegisterRequest request = new RegisterRequest("User C", "c@b.com", "12345678", "0907", "EMAIL", "ADMIN", null);
        when(userService.findAllByEmail("c@b.com")).thenReturn(java.util.Collections.emptyList());

        AppException ex = assertThrows(AppException.class, () -> authService.register(request));

        assertEquals(ErrorCode.ROLE_NOT_FOUND, ex.getErrorCode());
        verifyNoInteractions(userMapper, roleService, notificationClient);
    }
}
