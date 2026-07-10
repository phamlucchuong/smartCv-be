package vn.chuongpl.user_service.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vn.chuongpl.user_service.dtos.request.ServicePackageUpsertRequest;
import vn.chuongpl.user_service.dtos.response.ServicePackageResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;
import vn.chuongpl.user_service.features.servicepackage.ServicePackage;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageMapper;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageRepository;
import vn.chuongpl.user_service.features.servicepackage.ServicePackageService;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ServicePackageServiceTest {

    @Mock
    ServicePackageRepository servicePackageRepository;
    @Mock
    ServicePackageMapper servicePackageMapper;

    @InjectMocks
    ServicePackageService servicePackageService;

    @Test
    void create_shouldGenerateSlugAndNormalizeFeatures() {
        ServicePackageUpsertRequest request = ServicePackageUpsertRequest.builder()
                .name(" Premium Plus ")
                .price(15000L)
                .aiCredits(25)
                .jobLimit(12)
                .cvLimit(-1)
                .durationDays(30)
                .featured(true)
                .features(List.of("  AI screening ", "", "Priority support", "AI screening"))
                .build();
        ServicePackage mapped = ServicePackage.builder().build();
        ServicePackage saved = ServicePackage.builder()
                .id("premium-plus")
                .name("Premium Plus")
                .price(15000L)
                .aiCredits(25)
                .jobLimit(12)
                .cvLimit(-1)
                .durationDays(30)
                .featured(true)
                .features(List.of("AI screening", "Priority support"))
                .build();
        ServicePackageResponse response = ServicePackageResponse.builder().id("premium-plus").name("Premium Plus").build();

        when(servicePackageRepository.findByNameIgnoreCase("Premium Plus")).thenReturn(Optional.empty());
        when(servicePackageMapper.toEntity(request)).thenReturn(mapped);
        when(servicePackageRepository.save(mapped)).thenReturn(saved);
        when(servicePackageMapper.toResponse(saved)).thenReturn(response);

        ServicePackageResponse actual = servicePackageService.create(request);

        assertEquals("premium-plus", mapped.getId());
        assertEquals("Premium Plus", mapped.getName());
        assertEquals(30, mapped.getDurationDays());
        assertEquals(List.of("AI screening", "Priority support"), mapped.getFeatures());
        assertEquals(response, actual);
    }

    @Test
    void create_shouldThrowWhenNameAlreadyExists() {
        ServicePackageUpsertRequest request = ServicePackageUpsertRequest.builder()
                .name("Plus")
                .price(10000L)
                .aiCredits(20)
                .jobLimit(10)
                .cvLimit(10)
                .durationDays(30)
                .build();

        when(servicePackageRepository.findByNameIgnoreCase("Plus"))
                .thenReturn(Optional.of(ServicePackage.builder().id("plus").name("Plus").build()));

        AppException exception = assertThrows(AppException.class, () -> servicePackageService.create(request));

        assertEquals(ErrorCode.SERVICE_PACKAGE_ALREADY_EXISTS, exception.getErrorCode());
        verify(servicePackageRepository, never()).save(any());
    }

    @Test
    void update_shouldPreserveIdAndAllowSameName() {
        ServicePackage existing = ServicePackage.builder()
                .id("plus")
                .name("Plus")
                .price(10000L)
                .aiCredits(20)
                .jobLimit(10)
                .cvLimit(10)
                .durationDays(30)
                .featured(true)
                .features(List.of("Old"))
                .build();
        ServicePackageUpsertRequest request = ServicePackageUpsertRequest.builder()
                .name("Plus")
                .price(12000L)
                .aiCredits(30)
                .jobLimit(-1)
                .cvLimit(20)
                .durationDays(null)
                .featured(false)
                .features(List.of(" New feature "))
                .build();
        ServicePackageResponse response = ServicePackageResponse.builder().id("plus").name("Plus").build();

        when(servicePackageRepository.findById("plus")).thenReturn(Optional.of(existing));
        when(servicePackageRepository.findByNameIgnoreCase("Plus")).thenReturn(Optional.of(existing));
        when(servicePackageRepository.save(existing)).thenReturn(existing);
        when(servicePackageMapper.toResponse(existing)).thenReturn(response);

        ServicePackageResponse actual = servicePackageService.update("plus", request);

        assertEquals("plus", existing.getId());
        assertEquals(12000L, existing.getPrice());
        assertEquals(30, existing.getAiCredits());
        assertEquals(-1, existing.getJobLimit());
        assertEquals(20, existing.getCvLimit());
        assertNull(existing.getDurationDays());
        assertFalse(existing.isFeatured());
        assertEquals(List.of("New feature"), existing.getFeatures());
        assertEquals(response, actual);
    }

    @Test
    void delete_shouldThrowWhenPackageMissing() {
        when(servicePackageRepository.findById("missing")).thenReturn(Optional.empty());

        AppException exception = assertThrows(AppException.class, () -> servicePackageService.delete("missing"));

        assertEquals(ErrorCode.SERVICE_PACKAGE_NOT_FOUND, exception.getErrorCode());
        verify(servicePackageRepository, never()).delete(any());
    }
}
