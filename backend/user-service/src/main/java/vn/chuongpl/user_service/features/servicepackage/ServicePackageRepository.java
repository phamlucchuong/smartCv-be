package vn.chuongpl.user_service.features.servicepackage;

import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface ServicePackageRepository extends MongoRepository<ServicePackage, String> {
    Optional<ServicePackage> findByNameIgnoreCase(String name);
    List<ServicePackage> findAllByCategory(PackageCategory category);
}
