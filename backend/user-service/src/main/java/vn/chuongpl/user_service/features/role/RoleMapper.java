package vn.chuongpl.user_service.features.role;



import org.mapstruct.Mapping;
import org.mapstruct.Mapper;
import vn.chuongpl.user_service.dtos.response.RoleResponse;

@Mapper(componentModel = "spring")
public interface RoleMapper {
    @Mapping(source = "permissions", target = "permissionResponseSet")
    RoleResponse toRoleResponse(Role role);
}
