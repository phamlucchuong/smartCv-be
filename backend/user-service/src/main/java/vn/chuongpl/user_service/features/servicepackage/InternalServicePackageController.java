package vn.chuongpl.user_service.features.servicepackage;

import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.response.ServicePackageResponse;

/**
 * Internal endpoints for peer microservices (payment-service).
 * Guarded by InternalAuthFilter (X-Gateway-Secret). No JWT required.
 */
@RestController
@RequestMapping("/api/internal/packages")
@RequiredArgsConstructor
@FieldDefaults(level = lombok.AccessLevel.PRIVATE, makeFinal = true)
public class InternalServicePackageController {

    ServicePackageService servicePackageService;

    @GetMapping("/{packageId}")
    public ApiResponse<ServicePackageResponse> getById(@PathVariable String packageId) {
        return ApiResponse.<ServicePackageResponse>builder()
                .data(servicePackageService.getById(packageId))
                .build();
    }
}
