package vn.chuongpl.user_service;

import org.junit.jupiter.api.Test;
import org.springframework.security.access.prepost.PreAuthorize;
import vn.chuongpl.user_service.dtos.ApiResponse;
import vn.chuongpl.user_service.dtos.request.ServicePackageUpsertRequest;
import vn.chuongpl.user_service.dtos.response.ServicePackageResponse;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageController;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageService;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ServicePackageControllerTest {

    private final ServicePackageService servicePackageService = mock(ServicePackageService.class);
    private final ServicePackageController controller = new ServicePackageController(servicePackageService);

    @Test
    void create_shouldReturnCreatedPackage() {
        ServicePackageUpsertRequest request = ServicePackageUpsertRequest.builder()
                .name("Plus")
                .price(10000L)
                .aiCredits(20)
                .jobLimit(10)
                .cvLimit(10)
                .build();
        ServicePackageResponse response = ServicePackageResponse.builder().id("plus").name("Plus").build();
        when(servicePackageService.create(request)).thenReturn(response);

        ApiResponse<ServicePackageResponse> actual = controller.create(request);

        assertEquals("Created service package successfully", actual.getMessage());
        assertEquals(response, actual.getData());
        verify(servicePackageService).create(request);
    }

    @Test
    void controller_shouldRequireAdminRole() throws NoSuchMethodException {
        Method createMethod = ServicePackageController.class.getMethod("create", ServicePackageUpsertRequest.class);
        PreAuthorize annotation = createMethod.getAnnotation(PreAuthorize.class);

        assertEquals("hasRole('ADMIN')", annotation.value());
    }

    @Test
    void update_shouldKeepPackageIdInEndpoint() throws NoSuchMethodException {
        Method method = ServicePackageController.class.getMethod(
                "update",
                String.class,
                ServicePackageUpsertRequest.class
        );

        assertEquals("/api/packages", ServicePackageController.class.getAnnotation(org.springframework.web.bind.annotation.RequestMapping.class).value()[0]);
        assertEquals("/{packageId}", method.getAnnotation(org.springframework.web.bind.annotation.PutMapping.class).value()[0]);
    }
}
