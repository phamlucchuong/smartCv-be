package vn.chuongpl.user_service.features.permission;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.request.CreatePermissionRequest;
import vn.chuongpl.user_service.dtos.response.PermissionResponse;


@RestController
@RequestMapping("/api/permission")
@PreAuthorize("hasRole('ADMIN')")
public class PermissionController {
    @Autowired
    private PermissionService permissionService;

    @PostMapping
    public ApiResponse<PermissionResponse> createPermission(@RequestBody CreatePermissionRequest request){
        return ApiResponse.<PermissionResponse>builder()
                .data(permissionService.createPermission(request))
                .build();
    }

    @GetMapping("/all")
    public ApiResponse<List<PermissionResponse>> getAllPermission(){
        ApiResponse<List<PermissionResponse> >apiResponse = new ApiResponse<>();
        apiResponse.setData(permissionService.getAllPermissionResponses());
        return apiResponse;
    }

    @DeleteMapping("/{name}")
    public ApiResponse<Void> deletePermission(@PathVariable String name){
        permissionService.deletePermission(name);
        return ApiResponse.<Void>builder().build();
    }

}
