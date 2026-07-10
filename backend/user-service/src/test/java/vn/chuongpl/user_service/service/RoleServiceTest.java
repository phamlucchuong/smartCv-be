package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.dtos.request.CreateRoleRequest;
import vn.chuongpl.user_service.dtos.response.RoleResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.permission.Permission;
import vn.chuongpl.user_service.features.permission.PermissionService;
import vn.chuongpl.user_service.features.role.Role;
import vn.chuongpl.user_service.features.role.RoleMapper;
import vn.chuongpl.user_service.features.role.RoleRepository;
import vn.chuongpl.user_service.features.role.RoleService;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RoleServiceTest {

    @Mock
    RoleRepository roleRepository;
    @Mock
    UserRepository userRepository;
    @Mock
    RoleMapper roleMapper;
    @Mock
    PermissionService permissionService;

    @InjectMocks
    RoleService roleService;

    @Test
    void createRole_shouldThrowWhenRoleAlreadyExists() {
        when(roleRepository.existsById("ADMIN")).thenReturn(true);

        AppException ex = assertThrows(
                AppException.class,
                () -> roleService.createRole(new CreateRoleRequest("ADMIN", "desc", List.of()))
        );

        assertEquals(ErrorCode.ROLE_ALREADY_EXISTS, ex.getErrorCode());
        verify(roleRepository, never()).save(any(Role.class));
    }

    @Test
    void updateRole_shouldKeepOriginalNameAndReplacePermissions() {
        Role existingRole = Role.builder()
                .name("MODERATOR")
                .description("Old")
                .permissions(Set.of())
                .build();
        Permission permission = Permission.builder().name("user.read").build();
        RoleResponse mapped = RoleResponse.builder().name("MODERATOR").description("Updated").build();

        when(roleRepository.findById("MODERATOR")).thenReturn(Optional.of(existingRole));
        when(permissionService.getAllById(List.of("user.read"))).thenReturn(List.of(permission));
        when(roleRepository.save(existingRole)).thenReturn(existingRole);
        when(roleMapper.toRoleResponse(existingRole)).thenReturn(mapped);

        RoleResponse actual = roleService.updateRole(
                "MODERATOR",
                new CreateRoleRequest("SHOULD_NOT_RENAME", "Updated", List.of("user.read"))
        );

        assertEquals("MODERATOR", existingRole.getName());
        assertEquals("Updated", existingRole.getDescription());
        assertEquals(Set.of(permission), existingRole.getPermissions());
        assertEquals("MODERATOR", actual.getName());
    }

    @Test
    void deleteRole_shouldRemoveRoleFromAssignedUsers() {
        Role moderatorRole = Role.builder().name("MODERATOR").build();
        Role adminRole = Role.builder().name("ADMIN").build();
        User affectedUser = User.builder().id("u1").roles(Set.of(moderatorRole, adminRole)).build();
        User unaffectedUser = User.builder().id("u2").roles(Set.of(adminRole)).build();

        when(roleRepository.findById("MODERATOR")).thenReturn(Optional.of(moderatorRole));
        when(userRepository.findAll()).thenReturn(List.of(affectedUser, unaffectedUser));

        roleService.deleteRole("MODERATOR");

        assertEquals(Set.of(adminRole), affectedUser.getRoles());
        verify(roleRepository).deleteById("MODERATOR");
        verify(userRepository).saveAll(List.of(affectedUser));
    }
}
