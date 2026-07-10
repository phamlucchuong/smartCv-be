package vn.chuongpl.user_service.features.permission;

import java.util.List;
import java.util.Locale;
import java.util.Objects;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vn.chuongpl.user_service.dtos.request.CreatePermissionRequest;
import vn.chuongpl.user_service.dtos.response.PermissionResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;

@Service
public class PermissionService {
    @Autowired
    PermissionRepository permissionRepository;
    @Autowired
    PermissionMapper permissionMapper;

    public List<Permission> getAllById(List<String> permissions) {
        List<String> normalizedNames = normalizePermissionNames(permissions);
        List<Permission> existingPermissions = permissionRepository.findAllById(normalizedNames);
        if (existingPermissions.size() != normalizedNames.size()) {
            throw new AppException(ErrorCode.PERMISSION_NOT_FOUND);
        }
        return existingPermissions;
    }

    public PermissionResponse createPermission(CreatePermissionRequest request){
        String normalizedName = normalizePermissionName(request.getName());
        if(permissionRepository.existsById(normalizedName)){
            throw new AppException(ErrorCode.PERMISSION_EXISTED);
        }
        var permission = permissionMapper.toPermission(
                new CreatePermissionRequest(normalizedName, normalizeDescription(request.getDescription()))
        );
        return permissionMapper.toPermissionResponse(permissionRepository.save(permission));
    }

    public List<PermissionResponse> getAllPermissionResponses(){
        List<PermissionResponse> permissions = permissionRepository
                .findAll()
                .stream()
                .sorted((left, right) -> left.getName().compareToIgnoreCase(right.getName()))
                .map(permissionMapper::toPermissionResponse)
                .toList();
        return permissions;
    }
    public void deletePermission(String name){
        permissionRepository.deleteById(normalizePermissionName(name));
    }

    private List<String> normalizePermissionNames(List<String> permissions) {
        if (permissions == null) {
            return List.of();
        }

        return permissions.stream()
                .filter(Objects::nonNull)
                .map(this::normalizePermissionName)
                .distinct()
                .toList();
    }

    private String normalizePermissionName(String name) {
        return name == null ? "" : name.trim().toLowerCase(Locale.ROOT);
    }

    private String normalizeDescription(String description) {
        return description == null ? "" : description.trim();
    }
}
