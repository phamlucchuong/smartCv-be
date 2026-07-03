package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.util.ReflectionTestUtils;
import vn.chuongpl.user_service.dtos.PageResponse;
import vn.chuongpl.user_service.dtos.request.ChangePasswordRequest;
import vn.chuongpl.user_service.dtos.request.UpdateRolesRequest;
import vn.chuongpl.user_service.dtos.request.UserUpdateRequest;
import vn.chuongpl.user_service.dtos.response.UserResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.candidate.Candidate;
import vn.chuongpl.user_service.features.candidate.CandidateRepository;
import vn.chuongpl.user_service.features.role.Role;
import vn.chuongpl.user_service.features.role.RoleService;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserMapper;
import vn.chuongpl.user_service.features.user.UserRepository;
import vn.chuongpl.user_service.features.user.UserService;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    UserRepository userRepository;
    @Mock
    UserMapper userMapper;
    @Mock
    PasswordEncoder passwordEncoder;
    @Mock
    RoleService roleService;
    @Mock
    CandidateRepository candidateRepository;

    @InjectMocks
    UserService userService;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(userService, "defaultPageSize", 10);
    }

    @Test
    void changePassword_shouldThrowWhenCurrentPasswordDoesNotMatch() {
        User user = User.builder().id("u1").password("encoded-password").build();
        when(userRepository.findByIdAndDeletedFalse("u1")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong-password", "encoded-password")).thenReturn(false);

        AppException ex = assertThrows(
                AppException.class,
                () -> userService.changePassword("u1", new ChangePasswordRequest("wrong-password", "new-password"))
        );

        assertEquals(ErrorCode.AUTHENTICATION_FAILED, ex.getErrorCode());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateUserRoles_shouldNormalizeRoleNamesBeforeLookup() {
        User user = User.builder().id("u1").build();
        Role adminRole = Role.builder().name("ADMIN").build();
        UserResponse response = UserResponse.builder().id("u1").roles(Set.of("ADMIN")).build();

        when(userRepository.findByIdAndDeletedFalse("u1")).thenReturn(Optional.of(user));
        when(roleService.findById("admin")).thenReturn(Optional.empty());
        when(roleService.findById("ADMIN")).thenReturn(Optional.of(adminRole));
        when(userRepository.save(user)).thenReturn(user);
        when(userMapper.toUserResponse(user)).thenReturn(response);

        UserResponse actual = userService.updateUserRoles("u1", new UpdateRolesRequest(List.of("admin")));

        assertEquals(Set.of("ADMIN"), actual.getRoles());
        assertEquals(1, user.getRoles().size());
        verify(roleService).findById("admin");
        verify(roleService).findById("ADMIN");
    }

    // ── updateUserById uniqueness guards ────────────────────────────────────────

    @Test
    void updateUserById_shouldThrowEmailExistedWhenEmailTakenByAnotherUser() {
        User user = User.builder().id("u1").email("old@test.com").build();
        when(userRepository.findByIdAndDeletedFalse("u1")).thenReturn(Optional.of(user));
        when(userRepository.existsByEmailAndDeletedFalse("new@test.com")).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> userService.updateUserById("u1", new UserUpdateRequest(null, "new@test.com", null, null)));

        assertEquals(ErrorCode.EMAIL_EXISTED, ex.getErrorCode());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateUserById_shouldNotThrowWhenEmailIsUnchanged() {
        User user = User.builder().id("u1").email("same@test.com").build();
        when(userRepository.findByIdAndDeletedFalse("u1")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userMapper.toUserResponse(user)).thenReturn(UserResponse.builder().id("u1").build());

        // same email as current → uniqueness check must be skipped
        userService.updateUserById("u1", new UserUpdateRequest(null, "same@test.com", null, null));

        verify(userRepository, never()).existsByEmailAndDeletedFalse(any());
        verify(userRepository).save(user);
    }

    @Test
    void updateUserById_shouldThrowPhoneExistedWhenPhoneTakenByAnotherUser() {
        User user = User.builder().id("u1").phone("0901111111").build();
        when(userRepository.findByIdAndDeletedFalse("u1")).thenReturn(Optional.of(user));
        when(userRepository.existsByPhoneAndDeletedFalse("0909999999")).thenReturn(true);

        AppException ex = assertThrows(AppException.class,
                () -> userService.updateUserById("u1", new UserUpdateRequest(null, null, null, "0909999999")));

        assertEquals(ErrorCode.PHONE_EXISTED, ex.getErrorCode());
        verify(userRepository, never()).save(any(User.class));
    }

    @Test
    void updateUserById_shouldNotThrowWhenPhoneIsUnchanged() {
        User user = User.builder().id("u1").phone("0901111111").build();
        when(userRepository.findByIdAndDeletedFalse("u1")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userMapper.toUserResponse(user)).thenReturn(UserResponse.builder().id("u1").build());

        userService.updateUserById("u1", new UserUpdateRequest(null, null, null, "0901111111"));

        verify(userRepository, never()).existsByPhoneAndDeletedFalse(any());
        verify(userRepository).save(user);
    }

    @Test
    void updateUserById_shouldSkipUniquenessChecksWhenEmailAndPhoneAreNull() {
        User user = User.builder().id("u1").email("e@test.com").phone("0901111111").build();
        when(userRepository.findByIdAndDeletedFalse("u1")).thenReturn(Optional.of(user));
        when(userRepository.save(user)).thenReturn(user);
        when(userMapper.toUserResponse(user)).thenReturn(UserResponse.builder().id("u1").build());

        // null fields = partial update; no uniqueness check should run
        userService.updateUserById("u1", new UserUpdateRequest("New Name", null, null, null));

        verify(userRepository, never()).existsByEmailAndDeletedFalse(any());
        verify(userRepository, never()).existsByPhoneAndDeletedFalse(any());
        verify(userRepository).save(user);
    }

    @Test
    void getAllUsers_shouldFallbackToConfiguredPageSize() {
        User user = User.builder().id("u1").build();
        UserResponse response = UserResponse.builder().id("u1").build();
        PageRequest expectedPage = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt"));

        when(userRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(user), expectedPage, 1));
        when(userMapper.toUserResponse(user)).thenReturn(response);

        PageResponse<UserResponse> actual = userService.getAllUsers(0, 0, null, null, null);

        assertEquals(1, actual.getPage());
        assertEquals(10, actual.getPageSize());
        assertEquals(1, actual.getItems().size());
        verify(userRepository).findAll(eq(expectedPage));
        assertTrue(actual.getTotal() == 1);
    }

    @Test
    void getAllUsers_shouldAttachAvatarUrlWhenCandidateProfileExists() {
        User user = User.builder().id("u1").build();
        UserResponse response = UserResponse.builder().id("u1").build();
        PageRequest expectedPage = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "createdAt"));

        when(userRepository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(user), expectedPage, 1));
        when(userMapper.toUserResponse(user)).thenReturn(response);
        when(candidateRepository.findByUserIdAndDeletedFalse("u1"))
                .thenReturn(Optional.of(Candidate.builder().userId("u1").avatarUrl("https://cdn.example/avatar.png").build()));

        PageResponse<UserResponse> actual = userService.getAllUsers(1, 10, null, null, null);

        assertEquals("https://cdn.example/avatar.png", actual.getItems().get(0).getAvatarUrl());
    }
}
