package vn.chuongpl.ai_engine_service.features.admin;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;
import vn.chuongpl.ai_engine_service.dtos.ApiResponse;

import java.util.List;

@RestController
@RequestMapping("/api/ai/admin/models")
@RequiredArgsConstructor
@PreAuthorize("hasAuthority('ROLE_ADMIN')")
@Validated
public class AiAdminController {

    private final AiAdminService adminService;

    @GetMapping
    public ApiResponse<List<AiProviderConfigResponse>> listModels() {
        return ApiResponse.<List<AiProviderConfigResponse>>builder()
                .data(adminService.listAll())
                .build();
    }

    @PostMapping
    public ApiResponse<AiProviderConfigResponse> createModel(
            @RequestBody @jakarta.validation.Valid AiProviderConfigRequest request) {
        return ApiResponse.<AiProviderConfigResponse>builder()
                .data(adminService.create(request))
                .build();
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> deleteModel(@PathVariable String id) {
        adminService.delete(id);
        return ApiResponse.<Void>builder().message("Model deleted").build();
    }

    @PutMapping("/{id}/activate")
    public ApiResponse<AiProviderConfigResponse> activateModel(@PathVariable String id) {
        return ApiResponse.<AiProviderConfigResponse>builder()
                .data(adminService.activate(id))
                .build();
    }

    @GetMapping("/active")
    public ApiResponse<AiProviderConfigResponse> getActiveModel() {
        return ApiResponse.<AiProviderConfigResponse>builder()
                .data(adminService.getActive())
                .build();
    }
}
