package vn.chuongpl.user_service.features.servicepackage;

import jakarta.validation.Valid;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.request.ServicePackageUpsertRequest;
import vn.chuongpl.user_service.dtos.response.ServicePackageResponse;

import java.util.List;

@RestController
@RequestMapping("/api/packages")
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ServicePackageController {
    ServicePackageService servicePackageService;

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ServicePackageResponse> create(@Valid @RequestBody ServicePackageUpsertRequest request) {
        return ApiResponse.<ServicePackageResponse>builder()
                .message("Created service package successfully")
                .data(servicePackageService.create(request))
                .build();
    }

    @GetMapping
    public ApiResponse<List<ServicePackageResponse>> getAll(
            @RequestParam(required = false) PackageCategory category) {
        return ApiResponse.<List<ServicePackageResponse>>builder()
                .message("Fetched service packages successfully")
                .data(servicePackageService.getAll(category))
                .build();
    }

    @GetMapping("/{packageId}")
    public ApiResponse<ServicePackageResponse> getById(@PathVariable String packageId) {
        return ApiResponse.<ServicePackageResponse>builder()
                .message("Fetched service package successfully")
                .data(servicePackageService.getById(packageId))
                .build();
    }

    @PutMapping("/{packageId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ServicePackageResponse> update(@PathVariable String packageId,
                                                      @Valid @RequestBody ServicePackageUpsertRequest request) {
        return ApiResponse.<ServicePackageResponse>builder()
                .message("Updated service package successfully")
                .data(servicePackageService.update(packageId, request))
                .build();
    }

    @DeleteMapping("/{packageId}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable String packageId) {
        servicePackageService.delete(packageId);
        return ApiResponse.<Void>builder()
                .message("Deleted service package successfully")
                .build();
    }
}
