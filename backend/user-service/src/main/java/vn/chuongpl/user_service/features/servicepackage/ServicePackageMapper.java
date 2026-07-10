package vn.chuongpl.user_service.features.servicepackage;

import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import vn.chuongpl.user_service.dtos.request.ServicePackageUpsertRequest;
import vn.chuongpl.user_service.dtos.response.ServicePackageResponse;

@Mapper(componentModel = "spring")
public interface ServicePackageMapper {
    @Mapping(target = "id", ignore = true)
    @Mapping(target = "category", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    ServicePackage toEntity(ServicePackageUpsertRequest request);

    ServicePackageResponse toResponse(ServicePackage servicePackage);
}
