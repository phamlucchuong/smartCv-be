package vn.chuongpl.user_service.features.servicepackage;

import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.stereotype.Service;
import vn.chuongpl.user_service.dtos.request.ServicePackageUpsertRequest;
import vn.chuongpl.user_service.dtos.response.ServicePackageResponse;
import vn.chuongpl.user_service.enums.ErrorCode;
import vn.chuongpl.user_service.exception.AppException;

import java.text.Normalizer;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class ServicePackageService {
    Pattern NON_ASCII_PATTERN = Pattern.compile("[^a-z0-9]+");

    ServicePackageRepository servicePackageRepository;
    ServicePackageMapper servicePackageMapper;

    public ServicePackageResponse create(ServicePackageUpsertRequest request) {
        validateRequest(request);
        String normalizedName = normalizeName(request.getName());
        ensureNameAvailable(normalizedName, null);

        ServicePackage servicePackage = servicePackageMapper.toEntity(request);
        servicePackage.setId(generateId(normalizedName));
        servicePackage.setName(normalizedName);
        servicePackage.setDurationDays(request.getDurationDays());
        servicePackage.setCategory(request.getCategory() != null ? request.getCategory() : PackageCategory.STANDARD);
        servicePackage.setFeatures(normalizeFeatures(request.getFeatures()));
        servicePackage.setCreatedAt(LocalDateTime.now());
        servicePackage.setUpdatedAt(LocalDateTime.now());

        return servicePackageMapper.toResponse(servicePackageRepository.save(servicePackage));
    }

    public List<ServicePackageResponse> getAll(PackageCategory category) {
        List<ServicePackage> packages = category != null
                ? servicePackageRepository.findAllByCategory(category)
                : servicePackageRepository.findAll();
        return packages.stream()
                .sorted(Comparator.comparing(ServicePackage::getPrice).thenComparing(ServicePackage::getName, String.CASE_INSENSITIVE_ORDER))
                .map(servicePackageMapper::toResponse)
                .toList();
    }

    public ServicePackageResponse getById(String id) {
        return servicePackageMapper.toResponse(findEntity(id));
    }

    public ServicePackageResponse update(String id, ServicePackageUpsertRequest request) {
        validateRequest(request);
        ServicePackage existing = findEntity(id);
        String normalizedName = normalizeName(request.getName());
        ensureNameAvailable(normalizedName, existing.getId());

        existing.setName(normalizedName);
        existing.setPrice(request.getPrice());
        existing.setAiCredits(request.getAiCredits());
        existing.setJobLimit(request.getJobLimit());
        existing.setCvLimit(request.getCvLimit());
        existing.setDurationDays(request.getDurationDays());
        existing.setFeatured(request.isFeatured());
        existing.setFeatures(normalizeFeatures(request.getFeatures()));
        existing.setUpdatedAt(LocalDateTime.now());

        return servicePackageMapper.toResponse(servicePackageRepository.save(existing));
    }

    public void delete(String id) {
        ServicePackage existing = findEntity(id);
        servicePackageRepository.delete(existing);
    }

    private ServicePackage findEntity(String id) {
        return servicePackageRepository.findById(normalizeId(id))
                .orElseThrow(() -> new AppException(ErrorCode.SERVICE_PACKAGE_NOT_FOUND));
    }

    private void validateRequest(ServicePackageUpsertRequest request) {
        if (request == null) {
            throw new AppException(ErrorCode.INVALID_SERVICE_PACKAGE_CONFIG);
        }
        if (request.getPrice() == null || request.getPrice() < 0
                || request.getAiCredits() == null || request.getAiCredits() < 0
                || request.getJobLimit() == null || request.getJobLimit() < -1
                || request.getCvLimit() == null || request.getCvLimit() < -1
                || (request.getDurationDays() != null && request.getDurationDays() < 0)) {
            throw new AppException(ErrorCode.INVALID_SERVICE_PACKAGE_CONFIG);
        }
        if (normalizeName(request.getName()).isBlank()) {
            throw new AppException(ErrorCode.INVALID_SERVICE_PACKAGE_CONFIG);
        }
    }

    private void ensureNameAvailable(String name, String currentId) {
        servicePackageRepository.findByNameIgnoreCase(name)
                .filter(existing -> !Objects.equals(existing.getId(), currentId))
                .ifPresent(existing -> {
                    throw new AppException(ErrorCode.SERVICE_PACKAGE_ALREADY_EXISTS);
                });
    }

    private List<String> normalizeFeatures(List<String> features) {
        if (features == null) {
            return List.of();
        }

        return features.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(value -> !value.isBlank())
                .distinct()
                .toList();
    }

    private String normalizeName(String name) {
        return name == null ? "" : name.trim();
    }

    private String normalizeId(String id) {
        return id == null ? "" : id.trim().toLowerCase(Locale.ROOT);
    }

    private String generateId(String name) {
        String slug = Normalizer.normalize(name, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT);
        slug = NON_ASCII_PATTERN.matcher(slug).replaceAll("-");
        slug = slug.replaceAll("(^-+|-+$)", "");

        if (slug.isBlank()) {
            throw new AppException(ErrorCode.INVALID_SERVICE_PACKAGE_CONFIG);
        }

        return slug;
    }
}
