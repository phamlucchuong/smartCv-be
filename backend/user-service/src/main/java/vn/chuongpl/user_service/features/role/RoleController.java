package vn.chuongpl.user_service.features.role;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.request.CreateRoleRequest;
import vn.chuongpl.user_service.dtos.response.RoleResponse;

import java.util.List;

@RestController
@RequestMapping("/api/role")
@PreAuthorize("hasRole('ADMIN')")
public class RoleController {
    @Autowired
    RoleService roleService;
//    @Autowired
//    private PathPatternRequestMatcher.Builder builder;

    @PostMapping
    public ApiResponse<RoleResponse> createRole(@RequestBody CreateRoleRequest request) {
        return ApiResponse.<RoleResponse>builder()
                .data(roleService.createRole(request)).build();
    }

    @GetMapping("{roleName}")
    public ApiResponse<RoleResponse> getRoleById(@PathVariable String roleName) {
        return ApiResponse.<RoleResponse>builder()
                .data(roleService.getRoleByName(roleName))
                .build();
    }

    @GetMapping
    public ApiResponse<List<RoleResponse>> getAllRole() {
        return ApiResponse.<List<RoleResponse>>builder()
                .data(roleService.getAllRole())
                .build();
    }

    @PutMapping("/{name}")
    public ApiResponse<RoleResponse> updateRole(@PathVariable String name, @RequestBody CreateRoleRequest request) {
        return ApiResponse.<RoleResponse>builder()
                .data(roleService.updateRole(name, request))
                .build();
    }

    @DeleteMapping("/{name}")
    public ApiResponse<Void> deleteRole(@PathVariable String name) {
        roleService.deleteRole(name);
        return ApiResponse.<Void>builder().build();
    }
}
