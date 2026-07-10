package vn.chuongpl.user_service.features.role;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import vn.chuongpl.user_service.dtos.request.CreateRoleRequest;
import vn.chuongpl.user_service.dtos.response.RoleResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.permission.Permission;
import vn.chuongpl.user_service.features.permission.PermissionService;
import vn.chuongpl.user_service.features.user.User;
import vn.chuongpl.user_service.features.user.UserRepository;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class RoleService {
    RoleRepository roleRepository;
    UserRepository userRepository;
    RoleMapper roleMapper;
    PermissionService permissionService;

    public RoleResponse createRole(CreateRoleRequest request) {
        String roleName = normalizeRoleName(request.getName());
        if (roleRepository.existsById(roleName)) {
            throw new AppException(ErrorCode.ROLE_ALREADY_EXISTS);
        }

        List<Permission> permissions = permissionService.getAllById(request.getPermissions());
        Role role = new Role(roleName, normalizeDescription(request.getDescription()), new HashSet<>(permissions));
        return roleMapper.toRoleResponse(roleRepository.save(role));
    }

    public Optional<Role> findById(String name) {
        return roleRepository.findById(normalizeRoleName(name));
    }

    public List<RoleResponse> getAllRole() {
        return roleRepository.findAll()
                .stream()
                .sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName()))
                .map(roleMapper::toRoleResponse)
                .toList();
    }

    public RoleResponse updateRole(String name, CreateRoleRequest request) {
        var role = roleRepository.findById(normalizeRoleName(name))
                .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        role.setDescription(normalizeDescription(request.getDescription()));
        List<Permission> permissions = permissionService.getAllById(request.getPermissions());
        role.setPermissions(new HashSet<>(permissions));
        return roleMapper.toRoleResponse(roleRepository.save(role));
    }

    public void deleteRole(String name) {
        String roleName = normalizeRoleName(name);
        roleRepository.findById(roleName).orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND));
        roleRepository.deleteById(roleName);

        List<User> usersToUpdate = userRepository.findAll().stream()
                .filter(user -> user.getRoles() != null && user.getRoles().stream().anyMatch(role -> roleName.equals(role.getName())))
                .peek(user -> user.setRoles(removeRole(user.getRoles(), roleName)))
                .toList();

        if (!usersToUpdate.isEmpty()) {
            userRepository.saveAll(usersToUpdate);
        }
    }

    public RoleResponse getRoleByName(String roleName) {
        return roleMapper.toRoleResponse(
                roleRepository.findById(normalizeRoleName(roleName))
                        .orElseThrow(() -> new AppException(ErrorCode.ROLE_NOT_FOUND))
        );
    }

    private Set<Role> removeRole(Set<Role> roles, String roleName) {
        return roles.stream()
                .filter(role -> !roleName.equals(role.getName()))
                .collect(java.util.stream.Collectors.toSet());
    }

    private String normalizeRoleName(String name) {
        return name == null ? "" : name.trim();
    }

    private String normalizeDescription(String description) {
        return description == null ? "" : description.trim();
    }
}
