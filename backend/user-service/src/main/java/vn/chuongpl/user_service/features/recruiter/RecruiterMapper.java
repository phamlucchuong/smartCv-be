package vn.chuongpl.user_service.features.recruiter;

import org.mapstruct.*;
import vn.chuongpl.user_service.dtos.request.RecruiterRequest;
import vn.chuongpl.user_service.dtos.response.RecruiterPublicResponse;
import vn.chuongpl.user_service.dtos.response.RecruiterResponse;
import vn.chuongpl.user_service.features.user.User;

@Mapper(componentModel = "spring")
public interface RecruiterMapper {

    Recruiter toRecruiter(RecruiterRequest request);

    @Mapping(target = "id",        source = "recruiter.id")
    @Mapping(target = "userId",    source = "user.id")
    @Mapping(target = "fullName",  source = "user.fullName")
    @Mapping(target = "email",     source = "user.email")
    @Mapping(target = "phone",     source = "user.phone")
    @Mapping(target = "category",  source = "recruiter.category")
    @Mapping(target = "createdAt", source = "recruiter.createdAt")
    @Mapping(target = "updatedAt", source = "recruiter.updatedAt")
    RecruiterResponse toRecruiterResponse(Recruiter recruiter, User user);

    @Mapping(target = "id",        source = "recruiter.id")
    @Mapping(target = "userId",    source = "user.id")
    @Mapping(target = "fullName",  source = "user.fullName")
    @Mapping(target = "email",     source = "user.email")
    @Mapping(target = "phone",     source = "user.phone")
    @Mapping(target = "createdAt", source = "recruiter.createdAt")
    @Mapping(target = "updatedAt", source = "recruiter.updatedAt")
    RecruiterPublicResponse toRecruiterPublicResponse(Recruiter recruiter, User user);

    @BeanMapping(nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
    @Mapping(target = "userId",        ignore = true)
    @Mapping(target = "status",        ignore = true)
    @Mapping(target = "rejectionNote", ignore = true)
    @Mapping(target = "quotaJobPost",  ignore = true)
    @Mapping(target = "quotaCvViews",  ignore = true)
    void updateRecruiter(@MappingTarget Recruiter recruiter, RecruiterRequest request);
}
